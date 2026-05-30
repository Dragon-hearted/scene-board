/**
 * Character sheet types for SceneBoard's multi-protagonist consistency pipeline.
 *
 * A character sheet is a single composite 4-view reference image per character
 * (full-body front, full-body rear, front close-up, profile close-up) on a
 * neutral grey studio backdrop. One 4-view sheet carries every angle the
 * composite storyboard sheet needs to lock identity across all scenes the
 * character appears in.
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
	/** Composite 4-view reference sheet; undefined when generation failed. */
	sheet?: CharacterView;
	sourceRefImageIds?: string[];
	tags?: string[];
	appearsInScenes: string[];
}

export type CharacterRegistry = Map<string /* slug */, Character>;
