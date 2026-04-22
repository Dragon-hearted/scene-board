/**
 * Character sheet types for SceneBoard's multi-protagonist consistency pipeline.
 *
 * A character sheet is a 6-view reference set per character (2 full-body +
 * 4 face angles) used to keep each character visually identical across all
 * scenes they appear in. Views are chained so that non-anchor views reference
 * the anchor, keeping identity locked even when chained views are rendered
 * by the cheaper Flash model.
 */

export type CharacterViewKey =
  | "body-front"
  | "body-back"
  | "face-front"
  | "face-back"
  | "face-left"
  | "face-right";

export const CHARACTER_VIEW_KEYS: readonly CharacterViewKey[] = [
  "body-front",
  "body-back",
  "face-front",
  "face-back",
  "face-left",
  "face-right",
] as const;

export interface CharacterView {
  imageId: string;
  imageUrl: string;
  model: string;
  generatedAt: string;
}

export type CharacterPortraitSet = Partial<Record<CharacterViewKey, CharacterView>>;

export interface Character {
  slug: string;
  name: string;
  lockedDescription: string;
  portraits: CharacterPortraitSet;
  anchorView: CharacterViewKey;
  sourceRefImageIds?: string[];
  tags?: string[];
  appearsInScenes: string[];
}

export type CharacterRegistry = Map<string /* slug */, Character>;
