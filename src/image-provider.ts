/**
 * Image provider façade — the SINGLE entry point both the composite-sheet
 * generator and the reference-sheet generator use to produce an image.
 *
 * Strategy:
 *   1. PRIMARY  — Higgsfield CLI (gpt_image_2) → downloads image to outPath.
 *   2. FALLBACK — ImageEngine HTTP client (gpt-image-2, then gpt-image-1.5 on
 *      its own failure). Reuses src/image-client.ts UNCHANGED as transport.
 *
 * Any Higgsfield failure (auth, timeout, CLI, no-URL) silently falls back to
 * ImageEngine so the pipeline keeps working when the CLI is logged out or down.
 * The provider logs which transport served each request.
 */

import {
	type HiggsfieldAspectRatio,
	type HiggsfieldQuality,
	type HiggsfieldResolution,
	checkAuth as higgsfieldCheckAuth,
	generateImage as higgsfieldGenerate,
} from "./higgsfield-client";
import { generateSingle } from "./image-client";

// ─── Provider-facing request/response ───

/** SceneBoard-level aspect ratios used across the pipeline. */
export type ProviderAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3";

export type ProviderQuality = "low" | "medium" | "high";

export type ProviderResolution = "1k" | "2k" | "4k";

export type ImageProviderName = "higgsfield" | "image-engine";

export interface ProviderImageRequest {
	/** Full prompt body. */
	prompt: string;
	/** Aspect ratio. Defaults to 16:9 (landscape sheet). */
	aspectRatio?: ProviderAspectRatio;
	/** Output resolution. Defaults to 2k. */
	resolution?: ProviderResolution;
	/** Quality. Defaults to high. */
	quality?: ProviderQuality;
	/**
	 * Reference inputs. Higgsfield consumes `referenceImagePaths` (local paths
	 * or ids via `--image`). The ImageEngine fallback consumes
	 * `referenceImageIds` (gallery ids). Pass whichever the caller has; both
	 * may be set and each transport uses the one it understands.
	 */
	referenceImagePaths?: string[];
	referenceImageIds?: string[];
	/** Where the Higgsfield transport writes the downloaded image. */
	outPath: string;
	/** Optional identifier echoed back (e.g. character slug, sheet index). */
	id?: string;
	/** Optional system instruction — honored only by the ImageEngine fallback. */
	systemInstruction?: string;
}

export interface ProviderImageResult {
	/** Local path when served by Higgsfield; may be undefined for ImageEngine. */
	localPath?: string;
	/** Remote URL (always present). */
	imageUrl: string;
	/** Model id that served the request. */
	model: string;
	/** Which transport served the request. */
	provider: ImageProviderName;
	/** The prompt used. */
	prompt: string;
	/** Echoed id. */
	id?: string;
}

const FALLBACK_PRIMARY_MODEL = "gpt-image-2" as const;
const FALLBACK_SECONDARY_MODEL = "gpt-image-1.5" as const;

/**
 * Map a SceneBoard aspect ratio to the Higgsfield CLI enum. Higgsfield's
 * enum covers the same values SceneBoard uses for sheets; pass through and
 * default to 16:9.
 */
export function toHiggsfieldAspect(ar?: ProviderAspectRatio): HiggsfieldAspectRatio {
	switch (ar) {
		case "9:16":
		case "1:1":
		case "4:3":
		case "3:4":
		case "3:2":
		case "2:3":
		case "16:9":
			return ar;
		default:
			return "16:9";
	}
}

/** Simple structured logger so operators can see which transport served. */
function logProvider(provider: ImageProviderName, detail: string): void {
	console.error(`[image-provider] served by ${provider} — ${detail}`);
}

/**
 * Generate an image, preferring Higgsfield and falling back to ImageEngine.
 *
 * @param req            normalized provider request
 * @param opts.skipAuthCheck  skip the cheap `checkAuth()` probe (tests).
 */
export async function generateImage(
	req: ProviderImageRequest,
	opts: { skipAuthCheck?: boolean } = {},
): Promise<ProviderImageResult> {
	// 1) Try Higgsfield (primary) unless we already know it's unauthenticated.
	let higgsfieldErr: unknown;
	try {
		const authed = opts.skipAuthCheck ? true : await higgsfieldCheckAuth();
		if (!authed) {
			throw new Error("Higgsfield not authenticated (checkAuth failed)");
		}
		const result = await higgsfieldGenerate({
			prompt: req.prompt,
			aspectRatio: toHiggsfieldAspect(req.aspectRatio),
			resolution: (req.resolution ?? "2k") as HiggsfieldResolution,
			quality: (req.quality ?? "high") as HiggsfieldQuality,
			referenceImagePaths: req.referenceImagePaths,
			outPath: req.outPath,
		});
		logProvider("higgsfield", `${result.model} → ${result.localPath}`);
		return {
			localPath: result.localPath,
			imageUrl: result.imageUrl,
			model: result.model,
			provider: "higgsfield",
			prompt: req.prompt,
			id: req.id,
		};
	} catch (err) {
		higgsfieldErr = err;
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[image-provider] Higgsfield failed, falling back to ImageEngine — ${message}`);
	}

	// 2) Fallback — ImageEngine HTTP (gpt-image-2 → gpt-image-1.5).
	try {
		return await generateViaImageEngine(req, FALLBACK_PRIMARY_MODEL);
	} catch (primaryErr) {
		const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
		try {
			return await generateViaImageEngine(req, FALLBACK_SECONDARY_MODEL);
		} catch (secondaryErr) {
			const secondaryMsg =
				secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr);
			const higgsfieldMsg =
				higgsfieldErr instanceof Error ? higgsfieldErr.message : String(higgsfieldErr);
			throw new Error(
				`All image providers failed. Higgsfield: ${higgsfieldMsg} | ` +
					`ImageEngine ${FALLBACK_PRIMARY_MODEL}: ${primaryMsg} | ` +
					`ImageEngine ${FALLBACK_SECONDARY_MODEL}: ${secondaryMsg}`,
			);
		}
	}
}

async function generateViaImageEngine(
	req: ProviderImageRequest,
	model: typeof FALLBACK_PRIMARY_MODEL | typeof FALLBACK_SECONDARY_MODEL,
): Promise<ProviderImageResult> {
	const result = await generateSingle({
		prompt: req.prompt,
		model,
		aspectRatio: req.aspectRatio ?? "16:9",
		forceImage: true,
		openaiQuality: req.quality ?? "high",
		...(req.referenceImageIds &&
			req.referenceImageIds.length > 0 && { referenceImageIds: req.referenceImageIds }),
		...(req.systemInstruction && { systemInstruction: req.systemInstruction }),
		...(req.id && { sceneId: req.id }),
	});
	logProvider("image-engine", `${result.model} → ${result.imageUrl}`);
	return {
		imageUrl: result.imageUrl,
		model: result.model,
		provider: "image-engine",
		prompt: req.prompt,
		id: req.id,
	};
}
