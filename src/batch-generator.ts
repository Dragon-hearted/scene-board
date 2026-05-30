/**
 * Batch generation orchestrator for SceneBoard.
 * Converts scene prompts into ImageEngine batch requests and
 * collects results/errors per scene.
 *
 * @deprecated LEGACY per-scene path. SceneBoard no longer generates "1 image
 * per scene"; it produces ONE composite multi-panel storyboard sheet per ≤15s
 * block via `orchestrate.ts` → `orchestrateStoryboard()`. This module is kept
 * only so historical storyboards / callers still compile, and is no longer part
 * of the active generation flow. `resolveReferenceImageIds()` here is superseded
 * by `resolveSheetReferences()` in `reference-sheet-generator.ts`. Do not wire
 * new work through `generateAllScenes()`/`regenerateScene()`.
 */

import {
	type BatchRequest,
	type GenerationRequest,
	type GenerationResult,
	generateBatch,
	generateSingle,
	getBudgetStatus,
} from "./image-client";
import type { Character, CharacterRegistry } from "./types/character";

export interface ScenePrompt {
	sceneId: string;
	prompt: string;
	model?: string;
	aspectRatio?: string;
	imageSize?: string;
	systemInstruction?: string;
	forceImage?: boolean;
	referenceImageIds?: string[];
	dependsOn?: string[];
	characters?: string[];
}

export interface BatchGenerationResult {
	results: Map<string, GenerationResult>;
	errors: Map<string, string>;
	totalTokensUsed: number;
	budgetWarning?: string;
}

const HARD_CAP = 3;

/**
 * Build the final `referenceImageIds` list for a scene, combining
 * character-sheet references (tier 0) with any explicit references
 * the scene already declared (tier 3). Character sheets always win;
 * explicit references fill remaining slots up to the 3-ref cap.
 */
export function resolveReferenceImageIds(
	scene: ScenePrompt,
	registry: CharacterRegistry,
): string[] {
	const sheetIds = (scene.characters ?? [])
		.map((slug) => registry.get(slug))
		.filter((c): c is Character => Boolean(c))
		.map((c) => c.sheet?.imageId)
		.filter((id): id is string => Boolean(id))
		.slice(0, HARD_CAP);

	const remaining = HARD_CAP - sheetIds.length;
	const explicit = (scene.referenceImageIds ?? [])
		.filter((id) => !sheetIds.includes(id))
		.slice(0, remaining);

	return [...sheetIds, ...explicit];
}

function toGenerationRequest(scene: ScenePrompt, registry: CharacterRegistry): GenerationRequest {
	const refs = resolveReferenceImageIds(scene, registry);
	return {
		prompt: scene.prompt,
		sceneId: scene.sceneId,
		...(scene.model && { model: scene.model as GenerationRequest["model"] }),
		...(scene.aspectRatio && {
			aspectRatio: scene.aspectRatio as GenerationRequest["aspectRatio"],
		}),
		...(scene.imageSize && { imageSize: scene.imageSize }),
		...(scene.systemInstruction && { systemInstruction: scene.systemInstruction }),
		...(scene.forceImage !== undefined && { forceImage: scene.forceImage }),
		...(refs.length > 0 && { referenceImageIds: refs }),
	};
}

export async function generateAllScenes(
	scenes: ScenePrompt[],
	registry: CharacterRegistry = new Map(),
): Promise<BatchGenerationResult> {
	const result: BatchGenerationResult = {
		results: new Map(),
		errors: new Map(),
		totalTokensUsed: 0,
	};

	// Check budget before starting
	const budget = await getBudgetStatus();
	if (budget.percentUsed >= 80) {
		result.budgetWarning = `Budget ${budget.percentUsed.toFixed(1)}% used — ${budget.tokensRemaining} tokens remaining`;
	}

	// Build batch request
	const items: GenerationRequest[] = scenes.map((scene) => toGenerationRequest(scene, registry));

	const dependencies = scenes
		.filter((s): s is ScenePrompt & { dependsOn: string[] } =>
			Boolean(s.dependsOn && s.dependsOn.length > 0),
		)
		.map((s) => ({ sceneId: s.sceneId, dependsOn: s.dependsOn }));

	const batchReq: BatchRequest = {
		items,
		...(dependencies.length > 0 && { dependencies }),
	};

	const batchResult = await generateBatch(batchReq);

	// Parse results
	for (const [sceneId, entry] of Object.entries(batchResult.results)) {
		if ("error" in entry) {
			result.errors.set(sceneId, entry.error);
		} else {
			result.results.set(sceneId, entry);
		}
	}

	result.totalTokensUsed = batchResult.totalTokens;

	return result;
}

export async function regenerateScene(
	scene: ScenePrompt,
	registry: CharacterRegistry = new Map(),
): Promise<GenerationResult> {
	return generateSingle(toGenerationRequest(scene, registry));
}
