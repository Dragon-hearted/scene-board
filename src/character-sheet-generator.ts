/**
 * Character sheet generator — Stage 4.5 of the SceneBoard pipeline.
 *
 * For each character, emits a 6-view batch (2 full-body + 4 face close-ups).
 * The anchor view (`body-front`) uses NanoBanana Pro; the other 5 views
 * chain off the anchor or each other using NanoBanana Flash, so every view
 * is pixel-referenced against the anchor's identity.
 *
 * The batch's `dependsOn` resolution runs inside image-engine, so by the
 * time a chained view executes its reference (the predecessor's generated
 * image ID) is already present in the images table.
 */

import {
  generateBatch,
  getBudgetStatus,
  type GenerationRequest,
  type BatchRequest,
  type BatchResult,
  type GenerationResult,
} from "./image-client";
import type {
  Character,
  CharacterRegistry,
  CharacterView,
  CharacterViewKey,
} from "./types/character";
import { CHARACTER_VIEW_KEYS } from "./types/character";

const ANCHOR_VIEW: CharacterViewKey = "body-front";
const ANCHOR_MODEL = "gemini-3-pro-image-preview" as const;
const CHAINED_MODEL = "gemini-2.5-flash-image" as const;

/** Which view each non-anchor view chains off. */
const VIEW_CHAIN: Record<
  Exclude<CharacterViewKey, typeof ANCHOR_VIEW>,
  CharacterViewKey
> = {
  "body-back": "body-front",
  "face-front": "body-front",
  "face-left": "face-front",
  "face-right": "face-front",
  "face-back": "body-back",
};

/** Aspect ratio per view. */
const VIEW_ASPECT: Record<CharacterViewKey, "3:4" | "1:1"> = {
  "body-front": "3:4",
  "body-back": "3:4",
  "face-front": "1:1",
  "face-back": "1:1",
  "face-left": "1:1",
  "face-right": "1:1",
};

/** Per-view framing directive appended to the prompt body. */
const VIEW_FRAMING: Record<CharacterViewKey, string> = {
  "body-front":
    "Full body, standing, facing camera head-on, arms relaxed at sides, neutral expression.",
  "body-back":
    "Full body, standing, facing directly away from camera, arms relaxed at sides. Identical pose to the front view, just rotated 180°.",
  "face-front":
    "Tight head-and-shoulders portrait, facing camera head-on, neutral expression, eye contact with camera.",
  "face-left":
    "Tight head-and-shoulders portrait in strict left profile (camera positioned 90° to the subject's left side, subject looking forward, only the left side of the face visible).",
  "face-right":
    "Tight head-and-shoulders portrait in strict right profile (camera positioned 90° to the subject's right side, subject looking forward, only the right side of the face visible).",
  "face-back":
    "Tight head-and-shoulders portrait from directly behind, showing the back of the head, hair, and shoulders.",
};

const SYSTEM_INSTRUCTION =
  "Character reference sheet view for storyboard continuity. Neutral studio seamless backdrop (off-white to light gray). Soft large key + fill, 85mm equivalent, eye-level. The subject must be identical to the reference image — preserve facial geometry, hair style + color, build, skin tone, and signature clothing exactly. Only the camera angle changes. Style: editorial portrait photography.";

export interface CharacterPortraitInput {
  character: Omit<Character, "portraits" | "anchorView" | "appearsInScenes"> & {
    appearsInScenes?: string[];
  };
  styleAnchor: string;
  brandContext?: string;
}

export interface CharacterSheetResult {
  registry: CharacterRegistry;
  /** Keyed by "{slug}:{viewKey}" for per-view error reporting. */
  errors: Map<string, string>;
  totalTokensUsed: number;
  budgetWarning?: string;
  /** Characters whose anchor view failed — all dependent views were skipped. */
  abortedCharacters: string[];
}

function sceneIdFor(slug: string, viewKey: CharacterViewKey): string {
  return `${slug}:${viewKey}`;
}

function parseSceneId(
  id: string,
): { slug: string; viewKey: CharacterViewKey } | null {
  const [slug, viewKey] = id.split(":") as [string, CharacterViewKey];
  if (!slug || !viewKey || !CHARACTER_VIEW_KEYS.includes(viewKey)) return null;
  return { slug, viewKey };
}

function buildPrompt(
  input: CharacterPortraitInput,
  viewKey: CharacterViewKey,
): string {
  const { character, styleAnchor, brandContext } = input;
  const framing = VIEW_FRAMING[viewKey];
  const parts = [
    styleAnchor.trim(),
    brandContext?.trim(),
    "",
    `Character reference — ${character.name}. ${character.lockedDescription}`,
    "",
    `View: ${framing}`,
    "",
    "Backdrop: seamless neutral studio. Lighting: soft large key at 45°, fill at 1:2 ratio, subtle rim for separation. No props beyond signature clothing. No text in image.",
  ].filter((p) => p !== undefined && p !== null);
  return parts.join("\n");
}

function buildAnchorRequest(input: CharacterPortraitInput): GenerationRequest {
  const { character } = input;
  return {
    prompt: buildPrompt(input, ANCHOR_VIEW),
    sceneId: sceneIdFor(character.slug, ANCHOR_VIEW),
    model: ANCHOR_MODEL,
    aspectRatio: VIEW_ASPECT[ANCHOR_VIEW],
    imageSize: "2K",
    forceImage: true,
    systemInstruction: SYSTEM_INSTRUCTION,
    ...(character.sourceRefImageIds &&
      character.sourceRefImageIds.length > 0 && {
        referenceImageIds: character.sourceRefImageIds,
      }),
  };
}

function buildChainedRequest(
  input: CharacterPortraitInput,
  viewKey: Exclude<CharacterViewKey, typeof ANCHOR_VIEW>,
): GenerationRequest {
  const { character } = input;
  return {
    prompt: buildPrompt(input, viewKey),
    sceneId: sceneIdFor(character.slug, viewKey),
    model: CHAINED_MODEL,
    aspectRatio: VIEW_ASPECT[viewKey],
    imageSize: "2K",
    forceImage: true,
    systemInstruction: SYSTEM_INSTRUCTION,
    // image-engine resolves dependsOn at runtime; its own batch executor
    // writes the predecessor's generated image into the images table so
    // referenceImageIds can refer to that parent by its own sceneId.
    // For the typed batch payload we set referenceImageIds to the
    // parent's sceneId placeholder — image-engine substitutes the actual
    // image ID once the parent completes (per memory note about
    // referenceImageIds resolving against the images table via sqlite).
    referenceImageIds: [sceneIdFor(character.slug, VIEW_CHAIN[viewKey])],
  };
}

function buildBatchForCharacter(
  input: CharacterPortraitInput,
): { items: GenerationRequest[]; dependencies: BatchRequest["dependencies"] } {
  const items: GenerationRequest[] = [buildAnchorRequest(input)];
  const dependencies: NonNullable<BatchRequest["dependencies"]> = [];

  for (const viewKey of CHARACTER_VIEW_KEYS) {
    if (viewKey === ANCHOR_VIEW) continue;
    const typed = viewKey as Exclude<CharacterViewKey, typeof ANCHOR_VIEW>;
    items.push(buildChainedRequest(input, typed));
    dependencies.push({
      sceneId: sceneIdFor(input.character.slug, typed),
      dependsOn: [sceneIdFor(input.character.slug, VIEW_CHAIN[typed])],
    });
  }

  return { items, dependencies };
}

function resultToView(result: GenerationResult): CharacterView {
  return {
    imageId: result.id,
    imageUrl: result.imageUrl,
    model: result.model,
    generatedAt: result.createdAt,
  };
}

/**
 * Generate 6-view character sheets for each input character.
 *
 * The anchor view of each character is checked first; if it failed, the
 * remaining 5 dependent views for that character are reported as aborted
 * (single actionable error rather than 6 cascading ones).
 */
export async function generateCharacterSheet(
  inputs: CharacterPortraitInput[],
): Promise<CharacterSheetResult> {
  const result: CharacterSheetResult = {
    registry: new Map(),
    errors: new Map(),
    totalTokensUsed: 0,
    abortedCharacters: [],
  };

  if (inputs.length === 0) return result;

  const budget = await getBudgetStatus();
  if (budget.percentUsed >= 80) {
    result.budgetWarning = `Budget ${budget.percentUsed.toFixed(1)}% used — ${budget.tokensRemaining} tokens remaining before Stage 4.5 starts`;
  }

  // Build a combined batch so image-engine's executor can parallelize
  // independent characters (all anchors run concurrently; their chained
  // views wait on their own anchor via dependsOn, not on other characters).
  const allItems: GenerationRequest[] = [];
  const allDeps: NonNullable<BatchRequest["dependencies"]> = [];
  for (const input of inputs) {
    const { items, dependencies } = buildBatchForCharacter(input);
    allItems.push(...items);
    if (dependencies) allDeps.push(...dependencies);
  }

  const batchReq: BatchRequest = {
    items: allItems,
    ...(allDeps.length > 0 && { dependencies: allDeps }),
  };

  const batchResult: BatchResult = await generateBatch(batchReq);
  result.totalTokensUsed = batchResult.totalTokens;

  // Seed the registry with empty portrait sets so we can fill them view-by-view.
  for (const input of inputs) {
    result.registry.set(input.character.slug, {
      slug: input.character.slug,
      name: input.character.name,
      lockedDescription: input.character.lockedDescription,
      anchorView: ANCHOR_VIEW,
      portraits: {},
      ...(input.character.sourceRefImageIds && {
        sourceRefImageIds: input.character.sourceRefImageIds,
      }),
      ...(input.character.tags && { tags: input.character.tags }),
      appearsInScenes: input.character.appearsInScenes ?? [],
    });
  }

  // First pass: detect anchor failures so we can mark the character as aborted
  // and skip recording partial results for chained views that wouldn't make sense.
  const abortedSlugs = new Set<string>();
  for (const [sceneId, entry] of Object.entries(batchResult.results)) {
    const parsed = parseSceneId(sceneId);
    if (!parsed) continue;
    if (parsed.viewKey === ANCHOR_VIEW && "error" in entry) {
      abortedSlugs.add(parsed.slug);
      result.abortedCharacters.push(parsed.slug);
      result.errors.set(sceneId, entry.error);
    }
  }

  // Second pass: record successes and per-view failures.
  for (const [sceneId, entry] of Object.entries(batchResult.results)) {
    const parsed = parseSceneId(sceneId);
    if (!parsed) continue;
    const { slug, viewKey } = parsed;
    const character = result.registry.get(slug);
    if (!character) continue;

    if ("error" in entry) {
      // Anchor error already recorded above; avoid duplicating.
      if (!(viewKey === ANCHOR_VIEW)) {
        result.errors.set(sceneId, entry.error);
      }
      continue;
    }

    // If the anchor failed, chained views may have succeeded against stale
    // references — but there's nothing anchoring identity, so ignore them.
    if (abortedSlugs.has(slug) && viewKey !== ANCHOR_VIEW) continue;

    character.portraits[viewKey] = resultToView(entry);
  }

  return result;
}
