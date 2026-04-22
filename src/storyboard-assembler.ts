/**
 * Storyboard assembler — injects generated image metadata
 * into storyboard markdown after each scene's content, and
 * renders the Character Sheet section (Stage 4.5 output).
 */

import type { GenerationResult } from "./image-client";
import type {
  Character,
  CharacterRegistry,
  CharacterViewKey,
} from "./types/character";

export interface SceneImageMap {
  [sceneId: string]: {
    result?: GenerationResult;
    error?: string;
  };
}

/**
 * Converts BatchGenerationResult maps into a SceneImageMap.
 */
export function buildSceneImageMap(
  results: Map<string, GenerationResult>,
  errors: Map<string, string>,
): SceneImageMap {
  const map: SceneImageMap = {};

  for (const [sceneId, result] of results) {
    map[sceneId] = { result };
  }
  for (const [sceneId, error] of errors) {
    map[sceneId] = { ...map[sceneId], error };
  }

  return map;
}

function buildImageBlock(entry?: SceneImageMap[string]): string {
  if (entry?.result) {
    const r = entry.result;
    return [
      "#### Generated Image",
      `**Image ID**: ${r.id}`,
      `**Image URL**: ${r.imageUrl}`,
      "**Status**: generated",
      `**Model**: ${r.model}`,
      `**Tokens Used**: ${r.tokenUsage.totalTokens}`,
    ].join("\n");
  }

  if (entry?.error) {
    return [
      "#### Generated Image",
      "**Image ID**: pending",
      "**Image URL**: pending",
      "**Status**: failed",
      "**Model**: N/A",
      "**Tokens Used**: N/A",
    ].join("\n");
  }

  return [
    "#### Generated Image",
    "**Image ID**: pending",
    "**Image URL**: pending",
    "**Status**: pending",
    "**Model**: N/A",
    "**Tokens Used**: N/A",
  ].join("\n");
}

/**
 * Injects generated image sections into storyboard markdown.
 *
 * For each `### Scene N` block, inserts a "Generated Image" section
 * right before the next scene heading or `---` separator.
 */
export function assembleImages(
  markdown: string,
  sceneImages: SceneImageMap,
): string {
  // Split into lines for processing
  const lines = markdown.split("\n");
  const output: string[] = [];

  // Track scene boundaries: each scene starts at `### Scene N`
  // and ends at the next `### Scene` or `---` separator
  const scenePattern = /^### Scene (\d+)/;
  let currentSceneNumber: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sceneMatch = line.match(scenePattern);

    // If we hit a new scene heading or a `---` separator while tracking a scene,
    // inject the image block before this boundary
    if (currentSceneNumber !== null && (sceneMatch || line.trim() === "---")) {
      const entry =
        sceneImages[`scene-${currentSceneNumber}`] ??
        sceneImages[currentSceneNumber];

      output.push("");
      output.push(buildImageBlock(entry));
      output.push("");
      currentSceneNumber = null;
    }

    output.push(line);

    if (sceneMatch) {
      currentSceneNumber = sceneMatch[1];
    }
  }

  // Handle the last scene if the markdown doesn't end with `---`
  if (currentSceneNumber !== null) {
    const entry =
      sceneImages[`scene-${currentSceneNumber}`] ??
      sceneImages[currentSceneNumber];

    output.push("");
    output.push(buildImageBlock(entry));
  }

  return output.join("\n");
}

// ─── Character Sheet Assembly (Stage 4.5) ───

const FAILED_CELL = "_failed — retry at Stage 4.5 [M]_";

function viewCell(
  character: Character,
  viewKey: CharacterViewKey,
  altPrefix: string,
): string {
  const view = character.portraits[viewKey];
  if (!view) return FAILED_CELL;
  return `![${altPrefix}-${viewKey}](${view.imageUrl})`;
}

function viewIdLabel(
  character: Character,
  viewKey: CharacterViewKey,
): string {
  const view = character.portraits[viewKey];
  return `${viewKey} \`${view?.imageId ?? "missing"}\``;
}

function renderCharacter(character: Character): string {
  const lines: string[] = [];
  lines.push(`### ${character.name}`);
  lines.push("");
  lines.push("**Face views**");
  lines.push("");
  lines.push("| Front | Left profile | Right profile | Back |");
  lines.push("|---|---|---|---|");
  lines.push(
    `| ${viewCell(character, "face-front", character.slug)} | ${viewCell(character, "face-left", character.slug)} | ${viewCell(character, "face-right", character.slug)} | ${viewCell(character, "face-back", character.slug)} |`,
  );
  lines.push("");
  lines.push("**Full body views**");
  lines.push("");
  lines.push("| Front | Back |");
  lines.push("|---|---|");
  lines.push(
    `| ${viewCell(character, "body-front", character.slug)} | ${viewCell(character, "body-back", character.slug)} |`,
  );
  lines.push("");
  lines.push(`**Locked Description**: ${character.lockedDescription}`);
  lines.push("");
  const scenes = character.appearsInScenes.length
    ? character.appearsInScenes.join(", ")
    : "_pending scene assignment_";
  lines.push(`**Appears in Scenes**: ${scenes}`);
  lines.push("");
  const idParts = [
    viewIdLabel(character, "face-front"),
    viewIdLabel(character, "face-left"),
    viewIdLabel(character, "face-right"),
    viewIdLabel(character, "face-back"),
    viewIdLabel(character, "body-front"),
    viewIdLabel(character, "body-back"),
  ];
  lines.push(`**Image IDs**: ${idParts.join(" · ")}`);
  return lines.join("\n");
}

/**
 * Render the `## Character Sheet` section from a populated registry.
 * Returns "" when the registry is empty so callers can safely splice
 * the result into a template (opt-out users skip the section entirely).
 */
export function assembleCharacterSheet(registry: CharacterRegistry): string {
  if (!registry || registry.size === 0) return "";

  const sections = Array.from(registry.values()).map(renderCharacter);
  return ["## Character Sheet", "", ...sections.map((s) => `${s}\n`), "---"].join("\n\n");
}

export interface CharacterSheetDraftContext {
  projectOverview: string;
  styleAnchor: string;
}

/**
 * Render the partial "draft storyboard" shown at the Stage 4.5 approval gate.
 * Only Project Overview + Style Anchor + Character Sheet are included — no
 * scene noise — so the user can judge the sheet in isolation.
 */
export function assembleCharacterSheetDraft(
  registry: CharacterRegistry,
  context: CharacterSheetDraftContext,
): string {
  const parts = [
    "## Project Overview",
    "",
    context.projectOverview.trim(),
    "",
    "---",
    "",
    "## Style Anchor",
    "",
    context.styleAnchor.trim(),
    "",
    "---",
    "",
    assembleCharacterSheet(registry),
  ];
  return parts.filter((p) => p !== "").join("\n");
}
