/**
 * Batch generation orchestrator for SceneBoard.
 * Converts scene prompts into ImageEngine batch requests and
 * collects results/errors per scene.
 */

import {
  generateSingle,
  generateBatch,
  getBudgetStatus,
  type GenerationRequest,
  type GenerationResult,
  type BatchRequest,
} from "./image-client";
import type {
  Character,
  CharacterRegistry,
  CharacterViewKey,
} from "./types/character";

export type SceneCameraAngle =
  | "front"
  | "back"
  | "left"
  | "right"
  | "close-up"
  | "wide";

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
  cameraAngle?: SceneCameraAngle;
}

export interface BatchGenerationResult {
  results: Map<string, GenerationResult>;
  errors: Map<string, string>;
  totalTokensUsed: number;
  budgetWarning?: string;
}

const HARD_CAP = 3;

const ANGLE_TO_VIEW: Record<SceneCameraAngle, CharacterViewKey> = {
  front: "body-front",
  back: "body-back",
  left: "face-left",
  right: "face-right",
  "close-up": "face-front",
  wide: "body-front",
};

const FALLBACK_ORDER: CharacterViewKey[] = [
  "body-front",
  "face-front",
  "body-back",
  "face-left",
  "face-right",
  "face-back",
];

/**
 * Pick the best character-sheet view for a given scene camera angle.
 * Falls back through the standard ordering when the angle-matched view
 * is missing (e.g. generation failed).
 */
export function pickViewForScene(
  character: Character,
  angle?: SceneCameraAngle,
): string | undefined {
  const preferred = angle ? ANGLE_TO_VIEW[angle] : "body-front";
  const order = [preferred, ...FALLBACK_ORDER.filter((k) => k !== preferred)];
  for (const key of order) {
    const view = character.portraits[key];
    if (view?.imageId) return view.imageId;
  }
  return undefined;
}

/**
 * Build the final `referenceImageIds` list for a scene, combining
 * character view references (tier 0) with any explicit references
 * the scene already declared (tier 3). Character views always win;
 * explicit references fill remaining slots up to the 3-ref cap.
 */
export function resolveReferenceImageIds(
  scene: ScenePrompt,
  registry: CharacterRegistry,
): string[] {
  const viewIds = (scene.characters ?? [])
    .map((slug) => registry.get(slug))
    .filter((c): c is Character => Boolean(c))
    .map((c) => pickViewForScene(c, scene.cameraAngle))
    .filter((id): id is string => Boolean(id))
    .slice(0, HARD_CAP);

  const remaining = HARD_CAP - viewIds.length;
  const explicit = (scene.referenceImageIds ?? [])
    .filter((id) => !viewIds.includes(id))
    .slice(0, remaining);

  return [...viewIds, ...explicit];
}

function toGenerationRequest(
  scene: ScenePrompt,
  registry: CharacterRegistry,
): GenerationRequest {
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
  const items: GenerationRequest[] = scenes.map((scene) =>
    toGenerationRequest(scene, registry),
  );

  const dependencies = scenes
    .filter((s) => s.dependsOn && s.dependsOn.length > 0)
    .map((s) => ({ sceneId: s.sceneId, dependsOn: s.dependsOn! }));

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
