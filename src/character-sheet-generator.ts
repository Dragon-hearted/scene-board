/**
 * Character sheet generator — Stage 4.5 of the SceneBoard pipeline.
 *
 * Emits ONE composite reference-sheet image per character. The image shows
 * the same character across six panels (large face close-up, left profile,
 * right profile, back-of-head, full-body front, full-body back) on a clean
 * white seamless studio backdrop. A single NanoBanana Pro generation per
 * character — no batch, no chained generations. Downstream scenes reference
 * this one image, and Pro can pull identity from whichever panel matches
 * the scene's camera angle.
 */

import {
  generateSingle,
  getBudgetStatus,
  type GenerationRequest,
  type GenerationResult,
} from "./image-client";
import type {
  Character,
  CharacterRegistry,
  CharacterView,
} from "./types/character";

const SHEET_MODEL = "gemini-3-pro-image-preview" as const;
const SHEET_ASPECT = "16:9" as const;
const SHEET_IMAGE_SIZE = "2K";

const SYSTEM_INSTRUCTION =
  "Professional character reference sheet for storyboard continuity. Six-panel studio layout on a clean white seamless backdrop. Soft even studio lighting, 85mm equivalent, eye-level. The same character appears in every panel — preserve facial geometry, hair style + color, build, skin tone, and signature clothing exactly. Only the camera angle changes per panel. Editorial portrait photography, no text or labels.";

const LAYOUT_BODY =
  "Layout: a single wide image on a clean white seamless studio backdrop, showing the same character in six panels arranged as a reference sheet:\n" +
  "- A large close-up portrait of the face, facing camera head-on, neutral expression, eye contact with camera.\n" +
  "- A tight head-and-shoulders portrait in strict left profile (camera 90° to the subject's left side).\n" +
  "- A tight head-and-shoulders portrait in strict right profile (camera 90° to the subject's right side).\n" +
  "- A view from directly behind the head, showing hair and the back of the shoulders.\n" +
  "- A full-body front view: standing, arms relaxed at sides, facing camera head-on, neutral expression.\n" +
  "- A full-body back view: standing, facing directly away from camera, arms relaxed at sides, identical pose to the front view just rotated 180°.\n" +
  "\n" +
  "Every panel shares the same white seamless backdrop, the same soft key + fill lighting, and the same character — same hair, face, skin, build, and signature clothing. Only the camera angle changes between panels.\n" +
  "\n" +
  "No text in image. No labels between panels. No branding.";

export interface CharacterPortraitInput {
  character: Omit<Character, "sheet" | "appearsInScenes"> & {
    appearsInScenes?: string[];
  };
  styleAnchor: string;
  brandContext?: string;
}

export interface CharacterSheetResult {
  registry: CharacterRegistry;
  /** Keyed by character slug — one possible failure per character. */
  errors: Map<string, string>;
  totalTokensUsed: number;
  budgetWarning?: string;
}

function buildPrompt(input: CharacterPortraitInput): string {
  const { character, styleAnchor, brandContext } = input;
  const parts = [
    styleAnchor.trim(),
    brandContext?.trim(),
    "",
    `Character reference sheet — ${character.name}. ${character.lockedDescription}`,
    "",
    LAYOUT_BODY,
  ].filter((p): p is string => typeof p === "string");
  return parts.join("\n");
}

function buildSheetRequest(input: CharacterPortraitInput): GenerationRequest {
  const { character } = input;
  return {
    prompt: buildPrompt(input),
    sceneId: character.slug,
    model: SHEET_MODEL,
    aspectRatio: SHEET_ASPECT,
    imageSize: SHEET_IMAGE_SIZE,
    forceImage: true,
    systemInstruction: SYSTEM_INSTRUCTION,
    ...(character.sourceRefImageIds &&
      character.sourceRefImageIds.length > 0 && {
        referenceImageIds: character.sourceRefImageIds,
      }),
  };
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
 * Generate composite character sheets for each input character.
 *
 * Runs one `generateSingle` call per character in parallel. A failed
 * generation records the error keyed by slug; the character still appears
 * in the registry with `sheet` undefined so downstream rendering can mark
 * it as failed / retryable.
 */
export async function generateCharacterSheet(
  inputs: CharacterPortraitInput[],
): Promise<CharacterSheetResult> {
  const result: CharacterSheetResult = {
    registry: new Map(),
    errors: new Map(),
    totalTokensUsed: 0,
  };

  if (inputs.length === 0) return result;

  const budget = await getBudgetStatus();
  if (budget.percentUsed >= 80) {
    result.budgetWarning = `Budget ${budget.percentUsed.toFixed(1)}% used — ${budget.tokensRemaining} tokens remaining before Stage 4.5 starts`;
  }

  // Seed the registry with empty character entries so every input has a
  // slot — we fill `sheet` only on success, leaving it undefined on failure.
  for (const input of inputs) {
    result.registry.set(input.character.slug, {
      slug: input.character.slug,
      name: input.character.name,
      lockedDescription: input.character.lockedDescription,
      ...(input.character.sourceRefImageIds && {
        sourceRefImageIds: input.character.sourceRefImageIds,
      }),
      ...(input.character.tags && { tags: input.character.tags }),
      appearsInScenes: input.character.appearsInScenes ?? [],
    });
  }

  // Fan out one generation per character. Independent characters run in
  // parallel; a single failure doesn't block siblings.
  const settled = await Promise.allSettled(
    inputs.map((input) => generateSingle(buildSheetRequest(input))),
  );

  settled.forEach((outcome, idx) => {
    const slug = inputs[idx].character.slug;
    if (outcome.status === "fulfilled") {
      const generation = outcome.value;
      result.totalTokensUsed += generation.tokenUsage.totalTokens;
      const character = result.registry.get(slug);
      if (character) {
        character.sheet = resultToView(generation);
      }
    } else {
      const message =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      result.errors.set(slug, message);
    }
  });

  return result;
}
