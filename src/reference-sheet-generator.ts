/**
 * Reference-sheet generator — the generalized Stage 4.5 of the SceneBoard
 * pipeline (formerly `character-sheet-generator.ts`).
 *
 * Emits ONE composite 4-VIEW reference sheet image per subject, for TWO subject
 * types — `character` and `product` — each rendered on a NEUTRAL GREY background
 * with clean studio lighting. Generation is routed through the image-provider
 * façade (Higgsfield CLI `gpt_image_2` primary → ImageEngine HTTP fallback).
 *
 *   character — FULL BODY FRONT / FULL BODY REAR / FRONT CLOSE-UP / PROFILE
 *               CLOSE-UP. `[INSERT DESIRED STYLE]` is filled from the locked
 *               Style Anchor; `[DESCRIBE CHARACTER AND CLOTHING]` from the
 *               locked description + (clothing brands) the selected garments.
 *   product   — FRONT THREE-QUARTER / REAR STRAIGHT-ON / FRONT CLOSE-UP /
 *               PROFILE LEFT, photorealistic product-photography style.
 *
 * Reusability + caching is keyed off `brand_category` (read from
 * `client/{client}/brand.md`):
 *   - clothing → per-storyboard sheets under
 *     `client/{client}/storyboards/{project}/references/{slug}/`. Intake (in the
 *     skill) asks which garments the model wears and whether to reuse a cached
 *     model identity or generate a new one; here we support BOTH code paths —
 *     `reuseModelIdentity` re-renders a cached identity (passed as reference
 *     images) wearing the new outfit; otherwise a fresh model is generated.
 *   - product → reusable common sheets under `client/{client}/references/{slug}/`
 *     shared across storyboards.
 *
 * Per-subject generation runs in parallel with per-subject error handling: a
 * failed subject records its error keyed by slug and the others still complete.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { downloadToFile } from "./higgsfield-client";
import {
	type ImageProviderName,
	type ProviderAspectRatio,
	type ProviderQuality,
	type ProviderResolution,
	generateImage,
} from "./image-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SheetType = "character" | "product";

/** Brand reusability routing, read from `client/{client}/brand.md`. */
export type BrandCategory = "clothing" | "product" | "service";

/** Provider reference-image caps (Higgsfield ~8, ImageEngine 3). */
export const HIGGSFIELD_REF_CAP = 8;
export const IMAGE_ENGINE_REF_CAP = 3;

export interface ReferenceSubject {
	/** Stable slug used as the cache key + filename. */
	slug: string;
	/** Display name woven into the prompt. */
	name: string;
	/** Sheet template to use. */
	type: SheetType;
	/** Locked subject description (character look or product details). */
	lockedDescription: string;
	/**
	 * For clothing characters: the brand garments the model wears in THIS
	 * storyboard. Folded into `[DESCRIBE CHARACTER AND CLOTHING]`.
	 */
	garments?: string[];
	/**
	 * Reference image LOCAL PATHS that anchor this subject's look (e.g. a cached
	 * model identity to re-render in a new outfit, or brand product photos).
	 * Consumed by the Higgsfield transport.
	 */
	referenceImagePaths?: string[];
	/** ImageEngine gallery ids for the fallback transport (optional). */
	sourceRefImageIds?: string[];
	/**
	 * Clothing reuse-cached-identity branch: when true, the prompt instructs the
	 * model to preserve the SAME established identity (from the reference images)
	 * and only change the outfit to the described garments.
	 */
	reuseModelIdentity?: boolean;
	/**
	 * How often / how prominently the subject appears in the storyboard. Used to
	 * prioritise which sheets fill the provider reference cap. Higher wins.
	 */
	appearanceCount?: number;
}

export interface ReferenceSheetInput {
	subjects: ReferenceSubject[];
	/** Locked Style Anchor prose — fills `[INSERT DESIRED STYLE]` (characters). */
	styleAnchor: string;
	/** Client slug (cache routing). */
	client: string;
	/** Brand reusability category (cache routing). */
	brandCategory: BrandCategory;
	/** Project / storyboard slug — REQUIRED for clothing (per-storyboard cache). */
	project?: string;
	/** Root client data directory. Defaults to "client". */
	clientRoot?: string;
	/** Sheet aspect ratio. Defaults to 16:9. */
	aspectRatio?: ProviderAspectRatio;
	resolution?: ProviderResolution;
	quality?: ProviderQuality;
	/** Skip the Higgsfield auth probe (tests). */
	skipAuthCheck?: boolean;
}

export interface ReferenceSheet {
	slug: string;
	name: string;
	type: SheetType;
	/** The exact prompt used to generate the sheet. */
	prompt: string;
	/** Local path on disk — ALWAYS set on success (downloaded if URL-only). */
	localPath?: string;
	/** Remote URL the provider returned. */
	imageUrl: string;
	/** Model that served the request. */
	model: string;
	/** Transport that served the request. */
	provider: ImageProviderName;
	/** ImageEngine gallery id when available (for fallback ref chaining). */
	imageId?: string;
	/** Priority weight for the composite-sheet reference cap. */
	appearanceCount: number;
}

export interface ReferenceSheetResult {
	/** Keyed by subject slug — successful sheets only. */
	sheets: Map<string, ReferenceSheet>;
	/** Keyed by subject slug — one possible failure per subject. */
	errors: Map<string, string>;
}

// ─── brand_category routing ─────────────────────────────────────────────────

/**
 * Read the `brand_category` field from a `brand.md` file. Tolerates YAML
 * frontmatter (`brand_category: clothing`), a plain markdown line
 * (`Brand Category: clothing`), and the bold markdown form
 * (`**Brand Category**: clothing`). Returns undefined when absent/unreadable.
 * `apparel` is normalised to `clothing`.
 */
export async function readBrandCategory(brandMdPath: string): Promise<BrandCategory | undefined> {
	let text: string;
	try {
		text = await readFile(brandMdPath, "utf8");
	} catch {
		return undefined;
	}
	const match = text.match(/brand[\s_*-]*category[\s_*]*["']?\s*[:=]\s*["']?([a-zA-Z]+)/i);
	const value = match?.[1]?.toLowerCase();
	if (value === "clothing" || value === "apparel") return "clothing";
	if (value === "product") return "product";
	if (value === "service") return "service";
	return undefined;
}

/**
 * Resolve the cache directory for a subject's reference sheet, keyed off
 * `brand_category`:
 *   - clothing → per-storyboard `client/{client}/storyboards/{project}/references/{slug}`
 *   - product/service → reusable `client/{client}/references/{slug}`
 */
export function resolveSheetDir(opts: {
	clientRoot?: string;
	client: string;
	project?: string;
	brandCategory: BrandCategory;
	slug: string;
}): string {
	const root = opts.clientRoot ?? "client";
	if (opts.brandCategory === "clothing") {
		if (!opts.project) {
			throw new Error(
				"clothing brand_category requires a `project` for per-storyboard reference sheets",
			);
		}
		return join(root, opts.client, "storyboards", opts.project, "references", opts.slug);
	}
	// product (and service) → reusable common sheets shared across storyboards.
	return join(root, opts.client, "references", opts.slug);
}

// ─── Prompt composers (4-view templates) ──────────────────────────────────────

/** Fold the locked description + selected garments into the clothing slot. */
function describeCharacterAndClothing(subject: ReferenceSubject): string {
	const base = subject.lockedDescription.trim().replace(/\.+$/, "");
	if (subject.garments && subject.garments.length > 0) {
		const outfit = subject.garments
			.map((g) => g.trim())
			.filter(Boolean)
			.join(", ");
		return `${base}, wearing ${outfit}`;
	}
	return base;
}

/**
 * Compose the 4-view CHARACTER reference-sheet prompt. Reproduces the canonical
 * template (FULL BODY FRONT / FULL BODY REAR / FRONT CLOSE-UP / PROFILE CLOSE-UP)
 * on a neutral grey background, substituting `[DESCRIBE CHARACTER AND CLOTHING]`
 * and `[INSERT DESIRED STYLE]`.
 */
export function composeCharacterSheetPrompt(
	subject: ReferenceSubject,
	styleAnchor: string,
): string {
	const desc = describeCharacterAndClothing(subject);
	const style = styleAnchor.trim() || "the established project style";

	const reuseClause = subject.reuseModelIdentity
		? " This is the SAME established model identity shown in the attached reference image(s) — preserve their face, hair, body, proportions, and skin tone exactly; only change the outfit to the clothing described above."
		: "";

	return [
		"CHARACTER REFERENCE SHEET FOR STYLE",
		`Show the same ${desc}.${reuseClause}`,
		"Character reference sheet — four views on a neutral grey background:",
		"[VIEW 1 — FULL BODY, FRONT] Full-body front-facing three-quarter view of this character, full body visible head to feet.",
		"[VIEW 2 — FULL BODY, REAR] Full-body rear view of the same character, directly from behind. Full body visible head to feet.",
		"[VIEW 3 — FRONT CLOSE-UP] Head and shoulders close-up, straight-on front view. Sharp detail on skin texture, accessories, and costume surface detail. Chest and shoulder armour/clothing visible at the bottom of frame.",
		"[VIEW 4 — PROFILE CLOSE-UP] Head and shoulders close-up, 90-degree left profile view. Neck and upper shoulder visible.",
		`Lighting & presentation: Clean studio lighting — soft key light upper left, gentle fill from the right. Consistent character identity, proportions, and costume details across all four views. No text, no watermarks, no extra figures, no background environment, in the ${style}.`,
	].join("\n");
}

/**
 * Compose the 4-view PRODUCT reference-sheet prompt. Reproduces the canonical
 * template (FRONT THREE-QUARTER / REAR STRAIGHT-ON / FRONT CLOSE-UP / PROFILE
 * LEFT) on a neutral grey background, photorealistic product-photography style,
 * filling the product name + details from the locked description.
 */
export function composeProductSheetPrompt(subject: ReferenceSubject): string {
	const name = subject.name.trim();
	const detail = subject.lockedDescription.trim().replace(/\.+$/, "");
	return [
		`PRODUCT REFERENCE SHEET — ${name}`,
		`Show the same ${name}: ${detail}.`,
		"Product reference sheet — four views on a neutral grey background:",
		`[VIEW 1 — FRONT, THREE-QUARTER] Front-facing three-quarter view of the ${name}. Full ${name} visible top to bottom. Show the primary front face, branding placement, and key surface detail.`,
		`[VIEW 2 — REAR, STRAIGHT-ON] Full rear view of the same ${name}, directly from behind. Show the back surface, materials, and any rear-facing detail.`,
		"[VIEW 3 — FRONT CLOSE-UP] Top-third close-up, straight-on front view. Fine surface, edge, and material detail.",
		`[VIEW 4 — PROFILE, LEFT SIDE] Full left-profile close-up showing the ${name} edge-on. Show thickness, profile silhouette, and side detail.`,
		"Lighting & presentation: Clean studio lighting — soft key light upper left, gentle fill from the right. Consistent device identity, proportions, colour, and hardware details across all four views. Photorealistic product photography style. No text, no watermarks, no extra objects, no background environment.",
	].join("\n");
}

/** Select + compose the correct template for a subject. */
export function composeReferenceSheetPrompt(
	subject: ReferenceSubject,
	styleAnchor: string,
): string {
	return subject.type === "product"
		? composeProductSheetPrompt(subject)
		: composeCharacterSheetPrompt(subject, styleAnchor);
}

// ─── Composite-sheet reference resolution ─────────────────────────────────────

export interface ResolvedSheetReferences {
	/** Local paths for the Higgsfield transport (capped at the Higgsfield cap). */
	referenceImagePaths: string[];
	/** Gallery ids for the ImageEngine fallback (capped at the ImageEngine cap). */
	referenceImageIds: string[];
}

/**
 * Adapt the legacy `resolveReferenceImageIds()` into a composite-sheet
 * reference resolver: ALL approved reference sheets (multiple character +
 * multiple product) become the reference images passed into composite-sheet
 * generation. Subjects appearing earliest/most often are prioritised when the
 * provider reference cap is exceeded (Higgsfield ~8 paths; ImageEngine 3 ids).
 *
 * Returns BOTH a Higgsfield path list and an ImageEngine id list so the same
 * resolved set works whichever transport serves the composite generation.
 */
export function resolveSheetReferences(
	sheets: ReferenceSheet[],
	opts: { higgsfieldCap?: number; imageEngineCap?: number } = {},
): ResolvedSheetReferences {
	const higgsfieldCap = opts.higgsfieldCap ?? HIGGSFIELD_REF_CAP;
	const imageEngineCap = opts.imageEngineCap ?? IMAGE_ENGINE_REF_CAP;

	// Stable sort by appearanceCount desc; ties keep input order ("earliest").
	const ranked = sheets
		.map((sheet, index) => ({ sheet, index }))
		.sort((a, b) => {
			const byCount = (b.sheet.appearanceCount ?? 0) - (a.sheet.appearanceCount ?? 0);
			return byCount !== 0 ? byCount : a.index - b.index;
		})
		.map((entry) => entry.sheet);

	const referenceImagePaths: string[] = [];
	const referenceImageIds: string[] = [];
	for (const sheet of ranked) {
		if (sheet.localPath && !referenceImagePaths.includes(sheet.localPath)) {
			referenceImagePaths.push(sheet.localPath);
		}
		if (sheet.imageId && !referenceImageIds.includes(sheet.imageId)) {
			referenceImageIds.push(sheet.imageId);
		}
	}

	return {
		referenceImagePaths: referenceImagePaths.slice(0, higgsfieldCap),
		referenceImageIds: referenceImageIds.slice(0, imageEngineCap),
	};
}

// ─── Generation ───────────────────────────────────────────────────────────────

/**
 * Generate 4-view reference sheets for each subject, in parallel, with
 * per-subject error handling. Each sheet is routed through the image-provider
 * (Higgsfield primary → ImageEngine fallback) and written to the brand_category
 * cache directory. When the provider serves a URL only (ImageEngine), the image
 * is downloaded so EVERY successful sheet has a local path usable as a
 * composite-sheet reference.
 */
export async function generateReferenceSheets(
	input: ReferenceSheetInput,
): Promise<ReferenceSheetResult> {
	const result: ReferenceSheetResult = {
		sheets: new Map(),
		errors: new Map(),
	};
	if (input.subjects.length === 0) return result;

	const settled = await Promise.allSettled(
		input.subjects.map(async (subject): Promise<ReferenceSheet> => {
			const prompt = composeReferenceSheetPrompt(subject, input.styleAnchor);
			const dir = resolveSheetDir({
				clientRoot: input.clientRoot,
				client: input.client,
				project: input.project,
				brandCategory: input.brandCategory,
				slug: subject.slug,
			});
			const outPath = join(dir, `${subject.slug}-reference-sheet.png`);

			const image = await generateImage(
				{
					prompt,
					aspectRatio: input.aspectRatio ?? "16:9",
					...(input.resolution && { resolution: input.resolution }),
					...(input.quality && { quality: input.quality }),
					...(subject.referenceImagePaths &&
						subject.referenceImagePaths.length > 0 && {
							referenceImagePaths: subject.referenceImagePaths,
						}),
					...(subject.sourceRefImageIds &&
						subject.sourceRefImageIds.length > 0 && {
							referenceImageIds: subject.sourceRefImageIds,
						}),
					outPath,
					id: subject.slug,
				},
				{ skipAuthCheck: input.skipAuthCheck },
			);

			// Ensure a local path exists even when ImageEngine served (URL only),
			// so the sheet can be used as a composite-sheet reference.
			let localPath = image.localPath;
			if (!localPath && image.imageUrl) {
				await downloadToFile(image.imageUrl, outPath);
				localPath = outPath;
			}

			return {
				slug: subject.slug,
				name: subject.name,
				type: subject.type,
				prompt,
				...(localPath && { localPath }),
				imageUrl: image.imageUrl,
				model: image.model,
				provider: image.provider,
				appearanceCount: subject.appearanceCount ?? 0,
			};
		}),
	);

	settled.forEach((outcome, idx) => {
		const slug = input.subjects[idx].slug;
		if (outcome.status === "fulfilled") {
			result.sheets.set(slug, outcome.value);
		} else {
			result.errors.set(
				slug,
				outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
			);
		}
	});

	return result;
}
