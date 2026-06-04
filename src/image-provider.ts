/**
 * Image provider façade — the SINGLE entry point both the composite-sheet
 * generator and the reference-sheet generator use to produce an image.
 *
 * SceneBoard talks ONLY to ImageEngine over HTTP (src/image-client.ts). It omits
 * `model` so ImageEngine serves its default GPT Image 2 provider (with
 * ImageEngine's own gemini fallback). The result image is downloaded from the
 * gallery and written to the caller's `outPath`, and the gallery `imageId` is
 * returned so callers can chain it as a `referenceImageIds` reference later.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { generateSingle, getImage } from "./image-client";

// ─── Provider-facing request/response ───

/** SceneBoard-level aspect ratios used across the pipeline. */
export type ProviderAspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3";

export type ProviderQuality = "low" | "medium" | "high";

export type ProviderResolution = "1k" | "2k" | "4k";

export type ImageProviderName = "image-engine";

export interface ProviderImageRequest {
	/** Full prompt body. */
	prompt: string;
	/** Aspect ratio. Defaults to 16:9 (landscape sheet). */
	aspectRatio?: ProviderAspectRatio;
	/** Output resolution. Defaults to 2k. */
	resolution?: ProviderResolution;
	/** Quality. Defaults to high. */
	quality?: ProviderQuality;
	/** Gallery reference-image ids (ImageEngine resolves these against the images table). */
	referenceImageIds?: string[];
	/** Where the downloaded image is written. */
	outPath: string;
	/** Optional identifier echoed back (e.g. character slug, sheet index). */
	id?: string;
	/** Optional system instruction forwarded to ImageEngine. */
	systemInstruction?: string;
}

export interface ProviderImageResult {
	/** Local path the downloaded image was written to. */
	localPath: string;
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
	/** ImageEngine gallery id — persist it to chain as a `referenceImageIds` ref later. */
	imageId: string;
}

/** Simple structured logger so operators can see which transport served. */
function logProvider(provider: ImageProviderName, detail: string): void {
	console.error(`[image-provider] served by ${provider} — ${detail}`);
}

/**
 * Generate an image via ImageEngine and download it to `outPath`.
 *
 * No `model` is passed, so ImageEngine serves its default GPT Image 2 provider.
 */
export async function generateImage(req: ProviderImageRequest): Promise<ProviderImageResult> {
	const result = await generateSingle({
		prompt: req.prompt,
		aspectRatio: req.aspectRatio ?? "16:9",
		forceImage: true,
		openaiQuality: req.quality ?? "high",
		...(req.referenceImageIds?.length ? { referenceImageIds: req.referenceImageIds } : {}),
		...(req.systemInstruction ? { systemInstruction: req.systemInstruction } : {}),
		...(req.id ? { sceneId: req.id } : {}),
	});

	const buf = await getImage(result.id);
	await mkdir(dirname(req.outPath), { recursive: true });
	await writeFile(req.outPath, buf);

	logProvider("image-engine", `${result.model} → ${req.outPath}`);
	return {
		localPath: req.outPath,
		imageUrl: result.imageUrl,
		model: result.model,
		provider: "image-engine",
		prompt: req.prompt,
		id: req.id,
		imageId: result.id,
	};
}
