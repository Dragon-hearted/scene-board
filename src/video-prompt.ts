/**
 * Phase 2 — Cinematic Video Prompt composer.
 *
 * Ports the `knowledge/storyboard-prompt-builder.md` Phase 2 methodology into a
 * pure, typed composer. It maps the APPROVED storyboard panels into timed
 * cinematic shots (one shot per panel) and assembles a single continuous video
 * prompt: a production header (reference-image mandate, character-consistency
 * mandate, style block, focus block), then the timed shots, then the FIXED
 * closing Audio line.
 *
 * Invariants:
 *  - Shot count == panel count.
 *  - Per-shot timecodes are contiguous and sum to the target duration.
 *  - The prompt always ends with the exact AUDIO_CLOSING_LINE.
 *
 * Pure (no I/O) → trivially unit-testable.
 */

// ─── Fixed closing line (non-negotiable, byte-for-byte) ───────────────────────

export const AUDIO_CLOSING_LINE =
	"Audio: Diegetic sound only — natural ambience, environmental foley, and subject-driven sound.";

// ─── Types ───────────────────────────────────────────────────────────────────

export type VisualStyleKey = "3d" | "live-action" | "anime" | "2d";

export interface VideoSubject {
	name: string;
	/** Compact identifying description ("character DNA"). */
	description: string;
}

/** An approved storyboard panel to expand into a cinematic shot. */
export interface PanelInput {
	/** Shot type — Wide, Medium, Close-up, etc. */
	shotType: string;
	/** Scene description (expanded into cinematic direction). */
	description: string;
	/** Scene name used in the "SHOT N — NAME" label. */
	sceneName?: string;
	/** Dialogue line(s). Accepts "Character: line" or raw text. */
	dialogue?: string;
	/** Sound-effect / ambient note for the shot. */
	sfx?: string;
	/** Camera-movement verb phrase (e.g. "slow dolly-in"). Auto-derived if absent. */
	camera?: string;
	/** Variable shot duration in seconds. Auto-distributed if absent. */
	durationSeconds?: number;
}

export interface VideoPromptInput {
	/** Title used in the production header. */
	title?: string;
	/** Visual style — canonical key or freeform text. */
	style: VisualStyleKey | string;
	/** Locked Style Anchor prose; expanded into motion terms when present. */
	styleDescription?: string;
	/** Characters/products whose look must stay identical across shots. */
	subjects?: VideoSubject[];
	/** The approved panels (one shot each). */
	panels: PanelInput[];
	/** Total video duration in seconds (shots sum to this). */
	durationSeconds: number;
	/** Note describing the reference keyframe (defaults to the storyboard sheet). */
	referenceImageNote?: string;
	/** Optional target video tool (Kling/Veo/Sora/Seedance) for tailoring. */
	targetTool?: string;
}

export interface TimedShot extends PanelInput {
	/** 1-based shot number. */
	shotNumber: number;
	durationSeconds: number;
	startSeconds: number;
	endSeconds: number;
}

// ─── Style-adaptive motion blocks ─────────────────────────────────────────────

interface MotionProfile {
	/** Style block (cinematic motion terms). */
	styleBlock: string;
	/** Default camera verbs to rotate through when a panel omits one. */
	cameraVerbs: string[];
}

const MOTION_PROFILES: Record<VisualStyleKey, MotionProfile> = {
	"3d": {
		styleBlock:
			"3D animated feature style (Pixar/DreamWorks): apply animation principles — squash & stretch, anticipation, follow-through, exaggerated readable expressions. Warm volumetric lighting with neon/practical accents and global illumination. Comedic/dramatic timing with expressive character animation.",
		cameraVerbs: [
			"slow dolly-in",
			"smooth orbit",
			"crane up",
			"snap zoom",
			"rack focus",
			"push-in",
			"tracking follow",
			"static hold",
		],
	},
	"live-action": {
		styleBlock:
			"Cinematic live-action: film grammar with handheld, Steadicam, crane, and selective Dutch angles. Practical motivated lighting and naturalistic colour. Subtle performance — micro-expressions and body language carry the emotion.",
		cameraVerbs: [
			"slow push-in",
			"handheld tracking",
			"Steadicam follow",
			"crane reveal",
			"rack focus",
			"static lock-off",
			"slow pan",
			"pull-out",
		],
	},
	anime: {
		styleBlock:
			"Anime motion: speed lines, impact frames, limited animation on holds, sakuga bursts on action peaks. Dramatic snap zooms, static wide holds, and rapid cuts. Particle effects, light bloom, dramatic shadows, and wind animation.",
		cameraVerbs: [
			"dramatic snap zoom",
			"static wide hold",
			"fast push-in",
			"whip pan",
			"slow tilt",
			"orbital sweep",
			"impact zoom",
			"rack focus",
		],
	},
	"2d": {
		styleBlock:
			"Hand-drawn 2D animation: smears, multiples, held poses with moving holds, consistent line weight with subtle boil. Painterly parallax backgrounds. Fluid character animation with secondary motion on hair and clothing.",
		cameraVerbs: [
			"slow push-in",
			"parallax pan",
			"held wide shot",
			"tilt up",
			"smooth track",
			"gentle zoom",
			"static hold",
			"pull-back reveal",
		],
	},
};

function normalizeStyle(style: string): VisualStyleKey | null {
	const s = style.trim().toLowerCase();
	if (/(3d|pixar|dreamworks|cgi|cg animation)/.test(s)) return "3d";
	if (/(live[\s-]?action|cinematic|photoreal|film)/.test(s)) return "live-action";
	if (/(anime|manga)/.test(s)) return "anime";
	if (/(2d|hand[\s-]?drawn|traditional anim|cel\b)/.test(s)) return "2d";
	if (s === "3d" || s === "live-action" || s === "anime" || s === "2d") {
		return s as VisualStyleKey;
	}
	return null;
}

function motionProfile(style: string): MotionProfile {
	const key = normalizeStyle(style);
	if (key) return MOTION_PROFILES[key];
	return {
		styleBlock: `Render and animate everything in this visual style: ${style}. Carry that aesthetic into motion, lighting, and camera language across every shot.`,
		cameraVerbs: [
			"slow push-in",
			"smooth tracking",
			"static hold",
			"slow pan",
			"crane reveal",
			"rack focus",
			"orbit",
			"pull-out",
		],
	};
}

// ─── Timecode formatting ──────────────────────────────────────────────────────

/** Format seconds as `MM:SS`. */
export function formatSeconds(totalSeconds: number): string {
	const safe = Math.max(0, Math.round(totalSeconds));
	const mm = Math.floor(safe / 60);
	const ss = safe % 60;
	return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// ─── Time distribution ────────────────────────────────────────────────────────

/**
 * Distribute the target duration across panels, honouring explicit per-panel
 * durations and evenly splitting the remainder. The result is forced to sum
 * EXACTLY to `durationSeconds` (rounding drift is absorbed into the last shot).
 */
export function distributeShotDurations(panels: PanelInput[], durationSeconds: number): number[] {
	if (panels.length === 0) return [];

	const explicit = panels.map((p) =>
		typeof p.durationSeconds === "number" && p.durationSeconds > 0 ? p.durationSeconds : null,
	);
	const explicitSum = explicit.reduce<number>((acc, d) => acc + (d ?? 0), 0);
	const missingCount = explicit.filter((d) => d === null).length;

	let durations: number[];
	if (missingCount === 0) {
		durations = explicit as number[];
	} else {
		const remaining = durationSeconds - explicitSum;
		const perMissing = remaining > 0 ? remaining / missingCount : durationSeconds / panels.length;
		durations = explicit.map((d) => (d === null ? perMissing : d));
	}

	// Force the sum to equal durationSeconds exactly.
	const sum = durations.reduce((acc, d) => acc + d, 0);
	const drift = durationSeconds - sum;
	if (Math.abs(drift) > 1e-9) {
		durations[durations.length - 1] += drift;
	}
	return durations;
}

/** Place panels on a contiguous timeline starting at 0. */
export function toTimedShots(panels: PanelInput[], durationSeconds: number): TimedShot[] {
	const durations = distributeShotDurations(panels, durationSeconds);
	let cursor = 0;
	return panels.map((panel, i) => {
		const d = durations[i];
		const startSeconds = cursor;
		const endSeconds = cursor + d;
		cursor = endSeconds;
		return {
			...panel,
			shotNumber: i + 1,
			durationSeconds: d,
			startSeconds,
			endSeconds,
		};
	});
}

// ─── Header / shot rendering ──────────────────────────────────────────────────

function buildHeader(input: VideoPromptInput): string {
	const profile = motionProfile(input.style);
	const refNote =
		input.referenceImageNote?.trim() ||
		"Use the approved storyboard sheet as the visual keyframe reference. Follow its exact beat progression, framing structure, and emotional pacing shot-for-shot.";

	const lines: string[] = [];
	if (input.title) {
		lines.push(
			`CINEMATIC VIDEO PROMPT — "${input.title}" (${Math.round(input.durationSeconds)}s).`,
		);
	}
	lines.push(`REFERENCE: ${refNote}`);

	if (input.subjects && input.subjects.length > 0) {
		const dna = input.subjects.map((s) => `${s.name} — ${s.description.trim()}`).join("; ");
		lines.push(
			`CHARACTER CONSISTENCY (mandatory): keep these subjects identical in every shot — ${dna}.`,
		);
	}

	const styleBlock = input.styleDescription?.trim()
		? `${input.styleDescription.trim()} ${profile.styleBlock}`
		: profile.styleBlock;
	lines.push(`STYLE: ${styleBlock}`);

	if (input.targetTool) {
		lines.push(`TARGET TOOL: tailor camera complexity and pacing to ${input.targetTool}.`);
	}

	lines.push(
		"FOCUS: emotional readability, clear visual storytelling, continuity across cuts, and high motion quality.",
	);
	return lines.join("\n");
}

function renderShot(shot: TimedShot, cameraVerb: string): string {
	const name = (shot.sceneName ?? shot.shotType ?? `SHOT ${shot.shotNumber}`)
		.toString()
		.toUpperCase();
	const tc = `[${formatSeconds(shot.startSeconds)} – ${formatSeconds(shot.endSeconds)}]`;
	const lines: string[] = [
		`${tc} SHOT ${shot.shotNumber} — ${name}`,
		`Shot & camera: ${shot.shotType} shot, ${cameraVerb}.`,
		`Action: ${shot.description.trim()}`,
	];

	const dialogue = shot.dialogue?.trim();
	lines.push(`Dialogue: ${dialogue && dialogue.toLowerCase() !== "none" ? dialogue : "None"}`);

	const sfx = shot.sfx?.trim();
	lines.push(`SFX: ${sfx && sfx.length > 0 ? sfx : "natural ambience for the scene"}`);

	lines.push(`Camera: ${cameraVerb}.`);
	return lines.join("\n");
}

/**
 * Compose the full Phase 2 cinematic video prompt: production header, one timed
 * shot per panel, and the fixed closing Audio line. Returns one continuous
 * string (sections separated by blank lines).
 */
export function composeVideoPrompt(input: VideoPromptInput): string {
	if (input.panels.length === 0) {
		throw new Error("composeVideoPrompt: panels must not be empty");
	}
	const profile = motionProfile(input.style);
	const shots = toTimedShots(input.panels, input.durationSeconds);

	const blocks: string[] = [buildHeader(input)];
	shots.forEach((shot, i) => {
		const cameraVerb = shot.camera?.trim() || profile.cameraVerbs[i % profile.cameraVerbs.length];
		blocks.push(renderShot(shot, cameraVerb));
	});
	blocks.push(AUDIO_CLOSING_LINE);

	return blocks.join("\n\n");
}
