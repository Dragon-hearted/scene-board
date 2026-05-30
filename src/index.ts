/**
 * SceneBoard — CLI Storyboard Creator
 *
 * Transforms video briefs into professional storyboards with:
 * - Dynamic approval-gated workflow
 * - Script, voice script, and scene breakdown generation
 * - Composite storyboard sheets via GPT Image 2 (Higgsfield CLI, ImageEngine fallback)
 * - Platform-aware output (aspect ratio, pacing, tone)
 */

export const system = {
	name: "scene-board",
	version: "0.2.0",
	description: "CLI-driven storyboard creation system",
} as const;
