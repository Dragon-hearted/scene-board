/**
 * Unit tests for the Higgsfield CLI wrapper.
 *
 * Strategy:
 *  - `buildGenerateArgs` / `extractImageUrl` are pure → tested directly.
 *  - `generateImage` spawns the CLI → we point `HIGGSFIELD_BIN` at a fake bash
 *    binary whose behaviour is driven by a `MODE:<x>` token embedded in the
 *    PROMPT (which is always passed as an argv element). Encoding the mode in a
 *    per-call argument (rather than a shared env var) keeps each test fully
 *    deterministic with no cross-test leakage. For the success path we stub
 *    `globalThis.fetch` so the download step never touches the network.
 *
 * The env var pointing at the fake binary MUST be set before the module is
 * first evaluated (BINARY is a module-level const), so the module is loaded via
 * dynamic import after the assignment — there are no static imports of it.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─── Fake CLI binary (behaviour chosen by a MODE:<x> token in the prompt) ─────

const FAKE_SCRIPT = [
	"#!/usr/bin/env bash",
	"mode=success",
	'for a in "$@"; do',
	'  case "$a" in',
	'    MODE:*) mode="${a#MODE:}" ;;',
	"  esac",
	"done",
	'case "$mode" in',
	'  auth) echo "Error: session expired, please log in" 1>&2; exit 1 ;;',
	'  timeout) echo "Error: wait timeout exceeded before job finished" 1>&2; exit 1 ;;',
	'  cli) echo "Error: something broke internally" 1>&2; exit 1 ;;',
	'  badjson) echo "this is not json" ;;',
	'  nourl) echo "[{\\"id\\":\\"job1\\",\\"results\\":[{\\"status\\":\\"done\\"}]}]" ;;',
	'  success) echo "[{\\"id\\":\\"job1\\",\\"results\\":[{\\"url\\":\\"https://example.com/sheet.png\\"}]}]" ;;',
	"esac",
	"",
].join("\n");

const FAKE_DIR = join(tmpdir(), "sb-higgsfield-client-test");
mkdirSync(FAKE_DIR, { recursive: true });
const FAKE_BIN = join(FAKE_DIR, "fake-higgsfield.sh");
writeFileSync(FAKE_BIN, FAKE_SCRIPT, { mode: 0o755 });
process.env.HIGGSFIELD_BIN = FAKE_BIN;

const {
	buildGenerateArgs,
	extractImageUrl,
	generateImage,
	HiggsfieldAuthError,
	HiggsfieldTimeoutError,
	HiggsfieldCliError,
} = await import("./higgsfield-client");

// ─── buildGenerateArgs ────────────────────────────────────────────────────────

describe("buildGenerateArgs", () => {
	test("uses defaults (16:9 / high / 2k) and the gpt_image_2 model", () => {
		const args = buildGenerateArgs({ prompt: "a sheet", outPath: "/tmp/o.png" });
		expect(args.slice(0, 3)).toEqual(["generate", "create", "gpt_image_2"]);
		expect(args).toContain("--prompt");
		expect(args[args.indexOf("--prompt") + 1]).toBe("a sheet");
		expect(args[args.indexOf("--aspect_ratio") + 1]).toBe("16:9");
		expect(args[args.indexOf("--quality") + 1]).toBe("high");
		expect(args[args.indexOf("--resolution") + 1]).toBe("2k");
		// Always blocks for a machine-readable result.
		expect(args).toContain("--wait");
		expect(args).toContain("--json");
	});

	test("honours explicit aspect ratio, quality, and resolution", () => {
		const args = buildGenerateArgs({
			prompt: "p",
			outPath: "/tmp/o.png",
			aspectRatio: "9:16",
			quality: "medium",
			resolution: "4k",
		});
		expect(args[args.indexOf("--aspect_ratio") + 1]).toBe("9:16");
		expect(args[args.indexOf("--quality") + 1]).toBe("medium");
		expect(args[args.indexOf("--resolution") + 1]).toBe("4k");
	});

	test("emits a repeatable --image flag per reference image path", () => {
		const args = buildGenerateArgs({
			prompt: "p",
			outPath: "/tmp/o.png",
			referenceImagePaths: ["/a.png", "/b.png", "/c.png"],
		});
		const imageFlags = args.filter((a) => a === "--image");
		expect(imageFlags).toHaveLength(3);
		// Each --image is immediately followed by its path.
		const idxs = args.flatMap((a, i) => (a === "--image" ? [i] : []));
		expect(idxs.map((i) => args[i + 1])).toEqual(["/a.png", "/b.png", "/c.png"]);
	});

	test("omits --image entirely when no references are given", () => {
		const args = buildGenerateArgs({ prompt: "p", outPath: "/tmp/o.png" });
		expect(args).not.toContain("--image");
	});

	test("passes through wait-timeout and wait-interval when set", () => {
		const args = buildGenerateArgs({
			prompt: "p",
			outPath: "/tmp/o.png",
			waitTimeout: "5m",
			waitInterval: "2s",
		});
		expect(args[args.indexOf("--wait-timeout") + 1]).toBe("5m");
		expect(args[args.indexOf("--wait-interval") + 1]).toBe("2s");
	});
});

// ─── extractImageUrl ──────────────────────────────────────────────────────────

describe("extractImageUrl", () => {
	test("parses a URL out of the nested job-array shape", () => {
		const parsed = [{ id: "job1", results: [{ url: "https://cdn.x/out.png" }] }];
		expect(extractImageUrl(parsed)).toBe("https://cdn.x/out.png");
	});

	test("returns the LAST image URL when several are present", () => {
		const parsed = {
			jobs: [{ media: "https://cdn.x/first.jpg" }, { media: "https://cdn.x/second.webp" }],
		};
		expect(extractImageUrl(parsed)).toBe("https://cdn.x/second.webp");
	});

	test("falls back to any http(s) URL when no file extension is present", () => {
		const parsed = [{ output: "https://cdn.x/media/abc123" }];
		expect(extractImageUrl(parsed)).toBe("https://cdn.x/media/abc123");
	});

	test("returns undefined when there is no URL at all", () => {
		expect(extractImageUrl([{ id: "job1", status: "done" }])).toBeUndefined();
		expect(extractImageUrl({})).toBeUndefined();
	});
});

// ─── generateImage: error / timeout / success handling ────────────────────────
// The MODE:<x> token in the prompt selects the fake binary's behaviour.

describe("generateImage error classification", () => {
	test("throws HiggsfieldAuthError on auth failure", async () => {
		await expect(
			generateImage({ prompt: "MODE:auth", outPath: join(FAKE_DIR, "o.png") }),
		).rejects.toBeInstanceOf(HiggsfieldAuthError);
	});

	test("throws HiggsfieldTimeoutError on timeout", async () => {
		await expect(
			generateImage({ prompt: "MODE:timeout", outPath: join(FAKE_DIR, "o.png") }),
		).rejects.toBeInstanceOf(HiggsfieldTimeoutError);
	});

	test("throws HiggsfieldCliError on a generic non-zero exit", async () => {
		await expect(
			generateImage({ prompt: "MODE:cli", outPath: join(FAKE_DIR, "o.png") }),
		).rejects.toBeInstanceOf(HiggsfieldCliError);
	});

	test("throws HiggsfieldCliError when stdout is not valid JSON", async () => {
		await expect(
			generateImage({ prompt: "MODE:badjson", outPath: join(FAKE_DIR, "o.png") }),
		).rejects.toBeInstanceOf(HiggsfieldCliError);
	});

	test("throws HiggsfieldCliError when the result has no media URL", async () => {
		await expect(
			generateImage({ prompt: "MODE:nourl", outPath: join(FAKE_DIR, "o.png") }),
		).rejects.toBeInstanceOf(HiggsfieldCliError);
	});
});

describe("generateImage success path", () => {
	const originalFetch = globalThis.fetch;
	const outPath = join(FAKE_DIR, "downloaded-sheet.png");

	beforeEach(() => {
		// Stub the download so we never touch the network.
		globalThis.fetch = (async () =>
			new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
				status: 200,
			})) as unknown as typeof fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		try {
			rmSync(outPath);
		} catch {
			/* ignore */
		}
	});

	test("parses the URL, downloads the image, and returns the result", async () => {
		const result = await generateImage({ prompt: "MODE:success", outPath });
		expect(result.imageUrl).toBe("https://example.com/sheet.png");
		expect(result.localPath).toBe(outPath);
		expect(result.model).toBe("gpt_image_2");
	});
});
