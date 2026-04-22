/**
 * Character sheet types for SceneBoard's multi-protagonist consistency pipeline.
 *
 * A character sheet is a single composite reference image per character that
 * shows the character from six angles (large face close-up, left profile,
 * right profile, back-of-head, full-body front, full-body back) on a clean
 * white studio backdrop. One image carries every angle NanoBanana Pro needs
 * to lock identity across all scenes the character appears in.
 */

export interface CharacterView {
  imageId: string;
  imageUrl: string;
  model: string;
  generatedAt: string;
}

export interface Character {
  slug: string;
  name: string;
  lockedDescription: string;
  /** Composite 6-panel reference sheet; undefined when generation failed. */
  sheet?: CharacterView;
  sourceRefImageIds?: string[];
  tags?: string[];
  appearsInScenes: string[];
}

export type CharacterRegistry = Map<string /* slug */, Character>;
