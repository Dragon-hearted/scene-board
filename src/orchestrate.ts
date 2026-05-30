/**
 * Storyboard orchestration — the SINGLE end-to-end entry that ties the pipeline
 * together for the composite-sheet + two-phase deliverable:
 *
 *   1. Gather reference sheets (generate them, or accept already-approved ones).
 *   2. Resolve ALL approved sheets into the composite-sheet reference set
 *      (capped at the provider reference limit).
 *   3. Split the beats into ≤15s sheets and build a Phase 1 composite-sheet
 *      prompt per sheet (storyboard-sheet-prompt.ts).
 *   4. Generate each composite sheet via the image-provider (Higgsfield primary
 *      → ImageEngine fallback) with all reference-sheet refs attached.
 *   5. Build a Phase 2 cinematic video prompt per sheet (video-prompt.ts).
 *
 * Composite sheets are generated in parallel with per-sheet error handling: a
 * failed sheet records its error and the others still complete. This SUPERSEDES
 * the per-scene `generateAllScenes` batch path in batch-generator.ts (now
 * retired — see knowledge/history.md).
 */

import { join } from "node:path";
import {
	type ProviderAspectRatio,
	type ProviderImageResult,
	type ProviderQuality,
	type ProviderResolution,
	generateImage,
} from "./image-provider";
import {
	type ReferenceSheet,
	type ReferenceSheetInput,
	type ResolvedSheetReferences,
	generateReferenceSheets,
	resolveSheetReferences,
} from "./reference-sheet-generator";
import {
	type Beat,
	type Grid,
	type PlacedBeat,
	type StoryboardSheetPromptInput,
	composeStoryboardSheets,
} from "./storyboard-sheet-prompt";
import { type PanelInput, type VideoPromptInput, composeVideoPrompt } from "./video-prompt";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryboardOrchestrationInput {
	/**
	 * Generate reference sheets first (character + product). Omit when the
	 * caller already has approved sheets (pass `approvedReferenceSheets`).
	 */
	referenceSheetInput?: ReferenceSheetInput;
	/** Already-approved reference sheets to fold into the reference set. */
	approvedReferenceSheets?: ReferenceSheet[];
	/**
	 * Phase 1 input minus the per-sheet placement fields — supply the FULL beat
	 * list + total duration; the orchestrator auto-splits into ≤15s sheets.
	 */
	phase1: Omit<
		StoryboardSheetPromptInput,
		"beats" | "sheetNumber" | "totalSheets" | "startSeconds"
	> & {
		beats: Beat[];
		durationSeconds: number;
	};
	/** Phase 2 input minus panels + duration (derived from each sheet's beats). */
	phase2: Omit<VideoPromptInput, "panels" | "durationSeconds">;
	/** Directory the composite sheet images are written to. */
	sheetOutDir: string;
	/** Filename for sheet N. Defaults to `storyboard-sheet-{n}.png`. */
	sheetFileName?: (sheetNumber: number) => string;
	/** Provider reference caps (override defaults). */
	higgsfieldCap?: number;
	imageEngineCap?: number;
	/** Composite-sheet output knobs. */
	resolution?: ProviderResolution;
	quality?: ProviderQuality;
	/** Skip the Higgsfield auth probe (tests). */
	skipAuthCheck?: boolean;
}

export interface OrchestratedSheet {
	sheetNumber: number;
	totalSheets: number;
	startSeconds: number;
	endSeconds: number;
	durationSeconds: number;
	grid: Grid;
	/** The Phase 1 prompt used to generate this sheet. */
	phase1Prompt: string;
	/** Generated composite sheet image (undefined when generation failed). */
	image?: ProviderImageResult;
	/** Error message when this sheet's generation failed. */
	error?: string;
	/** The Phase 2 cinematic video prompt for this sheet's window. */
	phase2Prompt: string;
}

export interface StoryboardOrchestrationResult {
	/** All reference sheets used (generated + pre-approved). */
	referenceSheets: ReferenceSheet[];
	/** Reference-sheet generation failures, keyed by subject slug. */
	referenceErrors: Map<string, string>;
	/** The resolved composite-sheet reference set (capped at provider limit). */
	resolvedReferences: ResolvedSheetReferences;
	/** One entry per ≤15s composite sheet. */
	sheets: OrchestratedSheet[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function defaultSheetFileName(sheetNumber: number): string {
	return `storyboard-sheet-${sheetNumber}.png`;
}

/** Map a placed storyboard beat into a Phase 2 cinematic panel. */
function placedBeatToPanel(beat: PlacedBeat): PanelInput {
	return {
		shotType: beat.shotType,
		description: beat.description,
		...(beat.sceneName && { sceneName: beat.sceneName }),
		...(beat.action && { dialogue: beat.action }),
		durationSeconds: beat.durationSeconds,
	};
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Run the full composite-sheet + two-phase generation flow. Returns the
 * reference sheets, the resolved reference set, and one orchestrated sheet per
 * ≤15s block (each with its Phase 1 prompt, generated image, and Phase 2 prompt).
 */
export async function orchestrateStoryboard(
	input: StoryboardOrchestrationInput,
): Promise<StoryboardOrchestrationResult> {
	// 1) Gather reference sheets — generate, plus any pre-approved ones.
	const referenceSheets: ReferenceSheet[] = [...(input.approvedReferenceSheets ?? [])];
	const referenceErrors = new Map<string, string>();
	if (input.referenceSheetInput) {
		const generated = await generateReferenceSheets(input.referenceSheetInput);
		for (const sheet of generated.sheets.values()) referenceSheets.push(sheet);
		for (const [slug, err] of generated.errors) referenceErrors.set(slug, err);
	}

	// 2) Resolve ALL approved sheets into the composite-sheet reference set.
	const resolvedReferences = resolveSheetReferences(referenceSheets, {
		...(input.higgsfieldCap !== undefined && { higgsfieldCap: input.higgsfieldCap }),
		...(input.imageEngineCap !== undefined && { imageEngineCap: input.imageEngineCap }),
	});

	// 3) Split into ≤15s sheets + build a Phase 1 prompt per sheet.
	const composed = composeStoryboardSheets(input.phase1);
	const aspectRatio: ProviderAspectRatio =
		(input.phase1.aspectRatio as ProviderAspectRatio | undefined) ?? "16:9";
	const fileName = input.sheetFileName ?? defaultSheetFileName;

	// 4) Generate each composite sheet (parallel, per-sheet error handling) and
	//    5) build the Phase 2 video prompt for each.
	const settled = await Promise.allSettled(
		composed.map(async ({ sheet, grid, prompt }): Promise<OrchestratedSheet> => {
			const outPath = join(input.sheetOutDir, fileName(sheet.sheetNumber));

			let image: ProviderImageResult | undefined;
			let error: string | undefined;
			try {
				image = await generateImage(
					{
						prompt,
						aspectRatio,
						...(input.resolution && { resolution: input.resolution }),
						...(input.quality && { quality: input.quality }),
						...(resolvedReferences.referenceImagePaths.length > 0 && {
							referenceImagePaths: resolvedReferences.referenceImagePaths,
						}),
						...(resolvedReferences.referenceImageIds.length > 0 && {
							referenceImageIds: resolvedReferences.referenceImageIds,
						}),
						outPath,
						id: `sheet-${sheet.sheetNumber}`,
					},
					{ skipAuthCheck: input.skipAuthCheck },
				);
			} catch (err) {
				error = err instanceof Error ? err.message : String(err);
			}

			const phase2Prompt = composeVideoPrompt({
				...input.phase2,
				panels: sheet.beats.map(placedBeatToPanel),
				durationSeconds: sheet.durationSeconds,
			});

			return {
				sheetNumber: sheet.sheetNumber,
				totalSheets: sheet.totalSheets,
				startSeconds: sheet.startSeconds,
				endSeconds: sheet.endSeconds,
				durationSeconds: sheet.durationSeconds,
				grid,
				phase1Prompt: prompt,
				...(image && { image }),
				...(error && { error }),
				phase2Prompt,
			};
		}),
	);

	const sheets: OrchestratedSheet[] = settled.map((outcome, idx) => {
		if (outcome.status === "fulfilled") return outcome.value;
		const spec = composed[idx];
		const message =
			outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
		return {
			sheetNumber: spec.sheet.sheetNumber,
			totalSheets: spec.sheet.totalSheets,
			startSeconds: spec.sheet.startSeconds,
			endSeconds: spec.sheet.endSeconds,
			durationSeconds: spec.sheet.durationSeconds,
			grid: spec.grid,
			phase1Prompt: spec.prompt,
			error: message,
			phase2Prompt: "",
		};
	});

	return { referenceSheets, referenceErrors, resolvedReferences, sheets };
}
