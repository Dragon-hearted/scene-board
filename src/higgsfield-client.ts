/**
 * Higgsfield CLI wrapper — SceneBoard's PRIMARY image transport.
 *
 * Shells out to the globally-installed `higgsfield` binary (v0.1.40+) to
 * generate images with the `gpt_image_2` model, blocks with `--wait --json`,
 * parses the result media URL out of the final job object array, and downloads
 * the image to disk.
 *
 * No new npm runtime deps — the binary is an ENVIRONMENT prerequisite
 * (`npm install -g @higgsfield/cli`, then `higgsfield auth login` once).
 * See knowledge/higgsfield-cli.md for the confirmed CLI surface.
 *
 * The provider façade (image-provider.ts) treats any thrown error here as a
 * signal to fall back to the ImageEngine HTTP client.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// ─── Public types ───

export type HiggsfieldAspectRatio = "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "3:2" | "2:3";

export type HiggsfieldQuality = "low" | "medium" | "high";

export type HiggsfieldResolution = "1k" | "2k" | "4k";

export interface HiggsfieldGenerateRequest {
	/** Full prompt body. GPT Image 2 has no separate system slot. */
	prompt: string;
	/** Aspect ratio enum. Defaults to 16:9 (landscape sheet). */
	aspectRatio?: HiggsfieldAspectRatio;
	/** Output resolution. Defaults to 2k. */
	resolution?: HiggsfieldResolution;
	/** Quality knob. Defaults to high. */
	quality?: HiggsfieldQuality;
	/**
	 * Reference image paths or uploaded media ids. Each becomes a repeated
	 * `--image` flag (role `image`). Local paths auto-upload. Up to ~8.
	 */
	referenceImagePaths?: string[];
	/**
	 * Gallery / previously-uploaded media ids to reuse as references. Each is
	 * serialized as an additional repeated `--image` flag (passed through
	 * unchanged) alongside `referenceImagePaths`.
	 */
	referenceImageIds?: string[];
	/** Absolute/relative path the downloaded image is written to. */
	outPath: string;
	/** Wait timeout passed to `--wait-timeout` (default 10m). */
	waitTimeout?: string;
	/** Poll interval passed to `--wait-interval` (default 3s). */
	waitInterval?: string;
}

export interface HiggsfieldGenerateResult {
	/** Local filesystem path the image was downloaded to. */
	localPath: string;
	/** The remote media URL the CLI returned. */
	imageUrl: string;
	/** Model id used (always gpt_image_2 here). */
	model: string;
}

// ─── Typed errors (let the provider decide on fallback) ───

/** Base class so the provider can `instanceof HiggsfieldError` for fallback. */
export class HiggsfieldError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "HiggsfieldError";
	}
}

/** Not authenticated / session expired — run `higgsfield auth login`. */
export class HiggsfieldAuthError extends HiggsfieldError {
	constructor(message: string) {
		super(message);
		this.name = "HiggsfieldAuthError";
	}
}

/** `--wait-timeout` exceeded before the job reached a terminal state. */
export class HiggsfieldTimeoutError extends HiggsfieldError {
	constructor(message: string) {
		super(message);
		this.name = "HiggsfieldTimeoutError";
	}
}

/** Non-zero exit, unparseable stdout, missing binary, or no URL in result. */
export class HiggsfieldCliError extends HiggsfieldError {
	constructor(message: string) {
		super(message);
		this.name = "HiggsfieldCliError";
	}
}

// ─── Internals ───

const BINARY = process.env.HIGGSFIELD_BIN || "higgsfield";
const MODEL = "gpt_image_2";

const AUTH_HINTS = [
	"session expired",
	"not authenticated",
	"please log in",
	"please login",
	"auth login",
	"unauthorized",
	"unauthenticated",
];

const TIMEOUT_HINTS = ["timed out", "timeout", "deadline exceeded", "wait timeout"];

const NOT_FOUND_HINTS = ["command not found", "no such file", "enoent"];

const IMAGE_URL_RE = /\.(png|jpg|jpeg|webp|gif|avif)(\?|#|$)/i;

interface SpawnOutcome {
	exitCode: number;
	stdout: string;
	stderr: string;
}

/**
 * Run a higgsfield subcommand, capturing stdout/stderr. Uses Bun.spawn when
 * available, falling back to node:child_process so the module is testable and
 * portable. Never throws on non-zero exit — returns the outcome for the
 * caller to classify into a typed error.
 */
async function runHiggsfield(args: string[]): Promise<SpawnOutcome> {
	// Prefer Bun's native spawn when running under Bun.
	const bun = (globalThis as { Bun?: typeof import("bun") }).Bun;
	if (bun?.spawn) {
		try {
			const proc = bun.spawn([BINARY, ...args], {
				stdout: "pipe",
				stderr: "pipe",
			});
			const [stdout, stderr] = await Promise.all([
				new Response(proc.stdout).text(),
				new Response(proc.stderr).text(),
			]);
			const exitCode = await proc.exited;
			return { exitCode, stdout, stderr };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (NOT_FOUND_HINTS.some((h) => message.toLowerCase().includes(h))) {
				throw new HiggsfieldCliError(`Higgsfield binary "${BINARY}" not found: ${message}`);
			}
			throw new HiggsfieldCliError(`Failed to spawn higgsfield: ${message}`);
		}
	}

	// Node fallback (also used in unit tests that mock child_process).
	const { spawn } = await import("node:child_process");
	return new Promise<SpawnOutcome>((resolve, reject) => {
		const child = spawn(BINARY, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (d: Buffer) => {
			stdout += d.toString();
		});
		child.stderr?.on("data", (d: Buffer) => {
			stderr += d.toString();
		});
		child.on("error", (err: Error) => {
			if (NOT_FOUND_HINTS.some((h) => err.message.toLowerCase().includes(h))) {
				reject(new HiggsfieldCliError(`Higgsfield binary "${BINARY}" not found: ${err.message}`));
				return;
			}
			reject(new HiggsfieldCliError(`Failed to spawn higgsfield: ${err.message}`));
		});
		child.on("close", (code: number | null) => {
			resolve({ exitCode: code ?? 0, stdout, stderr });
		});
	});
}

/** Classify a failed CLI outcome into the most specific typed error. */
function classifyFailure(outcome: SpawnOutcome, context: string): HiggsfieldError {
	const haystack = `${outcome.stdout}\n${outcome.stderr}`.toLowerCase();
	if (AUTH_HINTS.some((h) => haystack.includes(h))) {
		return new HiggsfieldAuthError(
			`Higgsfield not authenticated (${context}). Run \`higgsfield auth login\`. ${outcome.stderr.trim()}`,
		);
	}
	if (TIMEOUT_HINTS.some((h) => haystack.includes(h))) {
		return new HiggsfieldTimeoutError(
			`Higgsfield generation timed out (${context}). ${outcome.stderr.trim()}`,
		);
	}
	return new HiggsfieldCliError(
		`Higgsfield CLI failed (${context}, exit ${outcome.exitCode}): ${outcome.stderr.trim() || outcome.stdout.trim()}`,
	);
}

/**
 * Recursively walk a parsed JSON value collecting any string that looks like
 * an image media URL. The exact key names in the `--wait --json` job array
 * can shift across CLI minor versions, so we search defensively rather than
 * hard-coding a path. Prefers fields named like url/media/output when present.
 */
export function extractImageUrl(parsed: unknown): string | undefined {
	const urls: string[] = [];

	const visit = (value: unknown): void => {
		if (typeof value === "string") {
			if (/^https?:\/\//i.test(value) && IMAGE_URL_RE.test(value)) {
				urls.push(value);
			}
			return;
		}
		if (Array.isArray(value)) {
			for (const item of value) visit(item);
			return;
		}
		if (value && typeof value === "object") {
			for (const v of Object.values(value as Record<string, unknown>)) visit(v);
		}
	};

	visit(parsed);

	if (urls.length > 0) return urls[urls.length - 1];

	// Fallback: any http(s) URL at all (in case the media has no file ext).
	const anyUrl: string[] = [];
	const visitAny = (value: unknown): void => {
		if (typeof value === "string") {
			if (/^https?:\/\//i.test(value)) anyUrl.push(value);
			return;
		}
		if (Array.isArray(value)) {
			for (const item of value) visitAny(item);
			return;
		}
		if (value && typeof value === "object") {
			for (const v of Object.values(value as Record<string, unknown>)) visitAny(v);
		}
	};
	visitAny(parsed);
	return anyUrl[anyUrl.length - 1];
}

/** Build the argv for a `generate create gpt_image_2 … --wait --json` call. */
export function buildGenerateArgs(req: HiggsfieldGenerateRequest): string[] {
	const args = [
		"generate",
		"create",
		MODEL,
		"--prompt",
		req.prompt,
		"--aspect_ratio",
		req.aspectRatio ?? "16:9",
		"--quality",
		req.quality ?? "high",
		"--resolution",
		req.resolution ?? "2k",
	];
	for (const ref of req.referenceImagePaths ?? []) {
		args.push("--image", ref);
	}
	for (const id of req.referenceImageIds ?? []) {
		args.push("--image", id);
	}
	if (req.waitTimeout) args.push("--wait-timeout", req.waitTimeout);
	if (req.waitInterval) args.push("--wait-interval", req.waitInterval);
	args.push("--wait", "--json");
	return args;
}

/**
 * Verify the CLI is present and authenticated. Returns true when a cheap
 * status call succeeds; false (never throws) when the binary is missing,
 * errors, or the session is unauthenticated — so the provider can decide to
 * skip Higgsfield and use the fallback.
 */
export async function checkAuth(): Promise<boolean> {
	try {
		const outcome = await runHiggsfield(["account", "status"]);
		if (outcome.exitCode !== 0) return false;
		const haystack = `${outcome.stdout}\n${outcome.stderr}`.toLowerCase();
		if (AUTH_HINTS.some((h) => haystack.includes(h))) return false;
		return true;
	} catch {
		return false;
	}
}

/**
 * Generate one image via the Higgsfield CLI and download it to `outPath`.
 * Throws a typed HiggsfieldError on any failure.
 */
export async function generateImage(
	req: HiggsfieldGenerateRequest,
): Promise<HiggsfieldGenerateResult> {
	const args = buildGenerateArgs(req);
	const outcome = await runHiggsfield(args);

	if (outcome.exitCode !== 0) {
		throw classifyFailure(outcome, "generate create gpt_image_2");
	}

	// Auth/timeout hints can appear even on exit 0 in some CLI versions, so we
	// classify them explicitly before attempting to parse the JSON payload.
	const haystack = `${outcome.stdout}\n${outcome.stderr}`.toLowerCase();
	if (AUTH_HINTS.some((h) => haystack.includes(h))) {
		throw new HiggsfieldAuthError(
			`Higgsfield reported an auth problem. Run \`higgsfield auth login\`. ${outcome.stderr.trim()}`,
		);
	}
	if (TIMEOUT_HINTS.some((h) => haystack.includes(h))) {
		throw new HiggsfieldTimeoutError(
			`Higgsfield generation timed out (generate create gpt_image_2). ${outcome.stderr.trim()}`,
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(outcome.stdout.trim());
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new HiggsfieldCliError(
			`Could not parse higgsfield --json output: ${message}. Raw: ${outcome.stdout.slice(0, 500)}`,
		);
	}

	const imageUrl = extractImageUrl(parsed);
	if (!imageUrl) {
		throw new HiggsfieldCliError(
			`No result media URL found in higgsfield output. Raw: ${outcome.stdout.slice(0, 500)}`,
		);
	}

	await downloadToFile(imageUrl, req.outPath);

	return { localPath: req.outPath, imageUrl, model: MODEL };
}

/** Default ceiling for the media download (ms). Overridable per call. */
const DOWNLOAD_TIMEOUT_MS = Number(process.env.HIGGSFIELD_DOWNLOAD_TIMEOUT_MS) || 30_000;

/**
 * Download a remote URL to a local path, creating parent dirs as needed.
 *
 * The request (and its body read) is bounded by an AbortController so a stalled
 * connection cannot hang the generation pipeline indefinitely — on timeout we
 * surface a `HiggsfieldTimeoutError` so the provider can fall back.
 */
export async function downloadToFile(
	url: string,
	outPath: string,
	timeoutMs: number = DOWNLOAD_TIMEOUT_MS,
): Promise<void> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) {
			throw new HiggsfieldCliError(
				`Failed to download generated image (${res.status} ${res.statusText}) from ${url}`,
			);
		}
		const buffer = Buffer.from(await res.arrayBuffer());
		await mkdir(dirname(outPath), { recursive: true });
		await writeFile(outPath, buffer);
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") {
			throw new HiggsfieldTimeoutError(
				`Timed out after ${timeoutMs}ms downloading generated image from ${url}.`,
			);
		}
		throw err;
	} finally {
		clearTimeout(timer);
	}
}
