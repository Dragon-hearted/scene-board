/**
 * Phase 1 — Composite Storyboard Sheet prompt composer.
 *
 * Ports the `knowledge/storyboard-prompt-builder.md` Phase 1 methodology into a
 * pure, typed TypeScript composer. The output is a SINGLE continuous prompt
 * (sections A–H) that instructs GPT Image 2 (via ImageEngine) to render ONE
 * composite multi-panel storyboard sheet: a header bar, a numbered panel grid,
 * and per-panel timecodes + one-line shot captions baked into the image.
 *
 * Key invariants:
 *  - Each sheet covers ≤ 15 seconds.
 *  - Each panel depicts a SHORT shot of at most 2 seconds, defaulting to ~1
 *    second. A beat WITHOUT an explicit duration becomes a 1s panel; a beat WITH
 *    one is clamped to (0, 2]s. The hard rules are (a) no panel exceeds 2s, (b)
 *    the per-panel timecodes still sum to the sheet's ≤15s window, and (c) a
 *    sensible panel-count cap sized to the grid.
 *  - Videos longer than 15s split into multiple sheets via `splitIntoSheets`,
 *    with CONTINUING timecodes across sheets (sheet 2 starts where sheet 1 ends).
 *
 * Everything here is pure (no I/O) so it is trivially unit-testable.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Hard ceiling for a single sheet's covered time window, in seconds. */
export const MAX_SHEET_SECONDS = 15;

/** Hard ceiling for a single panel's shot duration, in seconds. */
export const MAX_PANEL_SECONDS = 2;

/** Default per-panel shot duration when a beat omits one, in seconds. */
export const DEFAULT_PANEL_SECONDS = 1;

/** Recommended default panel-count cap for a single ≤15s sheet. */
export const DEFAULT_PANEL_CAP = 15;

/** Absolute panel ceiling — the largest supported grid (4×5). */
export const MAX_PANELS_PER_SHEET = 20;

/** Floating-point slack when comparing summed durations to the window. */
const EPSILON = 0.001;

// ─── Types ───────────────────────────────────────────────────────────────────

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3";

/** Canonical visual-style keys with adaptive style/tone/art-direction blocks. */
export type VisualStyleKey = "3d" | "live-action" | "anime" | "2d";

export interface Grid {
	rows: number;
	cols: number;
}

export interface Timecode {
	/** Inclusive start, in seconds, on the (possibly global) timeline. */
	startSeconds: number;
	/** Exclusive end, in seconds. */
	endSeconds: number;
}

/**
 * A single narrative beat = one storyboard panel. Each panel is a SHORT shot:
 * `durationSeconds` is OPTIONAL — omit it to default to ~1s (DEFAULT_PANEL_SECONDS)
 * and any explicit value is clamped to (0, MAX_PANEL_SECONDS]s.
 */
export interface Beat {
	/** Shot type — Wide, Medium, Close-up, Low Angle, Macro, etc. */
	shotType: string;
	/** One-line scene description (becomes the panel caption). */
	description: string;
	/** Optional VISUAL action note — what happens on screen ("None" allowed). Never printed as dialogue. */
	action?: string;
	/**
	 * Optional spoken line / voiceover text for this panel — the quoted content only
	 * (e.g. `We built this for you.`). Printed as a separate, clearly-labeled caption
	 * line BENEATH the frame (never rendered inside the depicted shot). Omit (or "None")
	 * for silent panels.
	 */
	dialogue?: string;
	/**
	 * Optional speaker attribution for {@link dialogue}. A character name (e.g. `Mira`)
	 * → `Mira: "…"`; the literal `VO` (case-insensitive) → `VO: "…"` for narration; omit
	 * → generic `Dialogue: "…"`.
	 */
	speaker?: string;
	/** Optional scene name used as a panel label. */
	sceneName?: string;
	/** Short panel duration in seconds (≤ 2). Omit to default to ~1s. */
	durationSeconds?: number;
}

/** A beat after timecode placement within a sheet. */
export interface PlacedBeat extends Beat {
	/** 1-based panel number within its sheet. */
	panel: number;
	/** Resolved per-panel duration in seconds (always > 0). */
	durationSeconds: number;
	/** Timecode on the global timeline (continues across sheets). */
	timecode: Timecode;
}

/** Subject "DNA" woven into panel descriptions for cross-panel consistency. */
export interface SubjectDNA {
	name: string;
	/** Compact 80–150 char visual description. */
	description: string;
	kind?: "character" | "product";
}

/** A fully-placed sheet (one ≤15s block). */
export interface SheetSpec {
	/** 0-based sheet index. */
	sheetIndex: number;
	/** 1-based sheet number. */
	sheetNumber: number;
	/** Total sheets in the parent video. */
	totalSheets: number;
	beats: PlacedBeat[];
	/** Global start of this sheet's window, in seconds. */
	startSeconds: number;
	/** Global end of this sheet's window, in seconds. */
	endSeconds: number;
	/** Covered duration (endSeconds − startSeconds), always ≤ MAX_SHEET_SECONDS. */
	durationSeconds: number;
}

export interface StoryboardSheetPromptInput {
	/** Project / film title, e.g. "The Little Inventor & The Lost Robot". */
	title: string;
	/** Brand name shown in the header bar (optional). */
	brand?: string;
	/** Genre clause, e.g. "sci-fi adventure short film". */
	genre?: string;
	/** Visual style — a canonical key OR freeform text. */
	style: VisualStyleKey | string;
	/** Locked Style Anchor prose (overrides the default style block when set). */
	styleDescription?: string;
	/** Mood/grading/lighting prose for section D (optional). */
	visualTone?: string;
	/** Sheet aspect ratio. Defaults to 16:9. */
	aspectRatio?: AspectRatio;
	/** Characters + products whose DNA is woven across panels. */
	subjects?: SubjectDNA[];
	/** The beats for THIS sheet (already split, if a multi-sheet video). */
	beats: Beat[];
	/** Window for this sheet, in seconds. Defaults to 15. */
	durationSeconds?: number;
	/** 1-based sheet number (multi-sheet videos). Defaults to 1. */
	sheetNumber?: number;
	/** Total sheet count (multi-sheet videos). Defaults to 1. */
	totalSheets?: number;
	/** Global start offset for continuing timecodes. Defaults to 0. */
	startSeconds?: number;
	/** Override the header label (default derived from duration). */
	headerLabel?: string;
	/** Override the panel-count cap. Defaults to DEFAULT_PANEL_CAP. */
	panelCap?: number;
}

export interface ValidationResult {
	valid: boolean;
	errors: string[];
}

// ─── Style profiles (style-adaptive sections B / D / G) ───────────────────────

interface StyleProfile {
	/** B) Style declaration. */
	styleDeclaration: string;
	/** D) Visual tone default. */
	visualTone: string;
	/** G) Art-direction footer. */
	artDirection: string;
}

const STYLE_PROFILES: Record<VisualStyleKey, StyleProfile> = {
	"3d": {
		styleDeclaration:
			"Premium 3D animated feature-film style in the spirit of Pixar and DreamWorks — cinematic rendering, expressive character animation, appealing stylised proportions, subsurface skin scattering, soft global illumination, and warm motivated lighting.",
		visualTone:
			"Warm cinematic colour grade, gentle volumetric light, soft contact shadows, shallow depth of field on emotional beats, and a polished family-film atmosphere.",
		artDirection:
			"Render with feature-animation polish: readable silhouettes, expressive faces, varied camera angles, rich texture detail on hair/fabric/surfaces, atmospheric depth, and clean compositional balance per panel.",
	},
	"live-action": {
		styleDeclaration:
			"Cinematic live-action style — photoreal film-stock look, anamorphic lensing, practical motivated lighting, grounded realism, and naturalistic performance.",
		visualTone:
			"Filmic colour grade with controlled contrast, natural skin tones, subtle film grain, motivated practical sources, and a grounded, believable atmosphere.",
		artDirection:
			"Render like a director-of-photography's frames: naturalistic lighting, lens-accurate depth of field, micro-expression detail, varied focal lengths and angles, and continuity-safe composition per panel.",
	},
	anime: {
		styleDeclaration:
			"High-quality anime style with studio-grade production values (Ghibli/Trigger/MAPPA energy depending on tone) — clean cel-shading, dynamic line work, expressive eyes, and painterly backgrounds.",
		visualTone:
			"Saturated yet harmonious palette, crisp cel shadows, light bloom on highlights, atmospheric background painting, and emotive lighting that shifts with the beat.",
		artDirection:
			"Render with anime craft: confident line weight, dramatic angles, impact framing on peaks, particle/light effects where motivated, and strong figure-to-ground readability per panel.",
	},
	"2d": {
		styleDeclaration:
			"Hand-drawn 2D animation style — consistent line weight, flat-but-considered colour fills, traditional shading, and painterly layered backgrounds.",
		visualTone:
			"Cohesive hand-painted palette, soft graphic shadows, gentle texture on lines and fills, and parallax-friendly background depth.",
		artDirection:
			"Render with traditional-animation appeal: clean draughtsmanship, expressive posing, varied staging, considered negative space, and clear silhouette reads per panel.",
	},
};

/**
 * Normalise a freeform style string to a canonical key when recognisable;
 * returns null for genuinely custom styles (caller falls back to freeform prose).
 */
export function normalizeStyle(style: string): VisualStyleKey | null {
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

function styleProfile(style: string): StyleProfile {
	const key = normalizeStyle(style);
	if (key) return STYLE_PROFILES[key];
	// Custom style: build a profile that quotes the user's descriptor verbatim.
	return {
		styleDeclaration: `Rendered entirely in the following visual style: ${style}. Treat this as the authoritative art-direction brief for every panel.`,
		visualTone: `Colour grade, lighting, and atmosphere consistent with: ${style}.`,
		artDirection: `Maintain the ${style} aesthetic across all panels with consistent rendering quality, varied camera angles, and clear per-panel composition.`,
	};
}

// ─── Grid mapping ─────────────────────────────────────────────────────────────

/** Canonical landscape grids by panel count (16:9 orientation). */
const GRID_TABLE: ReadonlyArray<[number, Grid]> = [
	[9, { rows: 3, cols: 3 }],
	[12, { rows: 3, cols: 4 }],
	[15, { rows: 3, cols: 5 }],
	[20, { rows: 4, cols: 5 }],
];

function isVertical(aspect: AspectRatio): boolean {
	return aspect === "9:16" || aspect === "3:4" || aspect === "2:3";
}

/**
 * Map a panel count → grid. Canonical counts (9/12/15/20) use the documented
 * grids; other counts pick the smallest canonical grid that fits, falling back
 * to a near-square grid for counts above 20. For vertical aspect ratios the
 * rows and columns are flipped (e.g. 15 → 5×3 instead of 3×5).
 */
export function gridForPanelCount(count: number, aspect: AspectRatio = "16:9"): Grid {
	if (count < 1) {
		throw new RangeError(`panel count must be ≥ 1, got ${count}`);
	}

	let base: Grid | undefined;
	for (const [n, grid] of GRID_TABLE) {
		if (count <= n) {
			base = grid;
			break;
		}
	}
	if (!base) {
		// Above 20 — derive a near-square landscape grid.
		const cols = Math.ceil(Math.sqrt(count));
		const rows = Math.ceil(count / cols);
		base = { rows, cols };
	}

	return isVertical(aspect)
		? { rows: base.cols, cols: base.rows }
		: { rows: base.rows, cols: base.cols };
}

// ─── Timecode helpers ─────────────────────────────────────────────────────────

/** Format a seconds value as `MM:SS`. */
export function formatSeconds(totalSeconds: number): string {
	const safe = Math.max(0, Math.round(totalSeconds));
	const mm = Math.floor(safe / 60);
	const ss = safe % 60;
	return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Format a timecode range as `MM:SS-MM:SS`. */
export function formatTimecode(t: Timecode): string {
	return `${formatSeconds(t.startSeconds)}-${formatSeconds(t.endSeconds)}`;
}

/**
 * Resolve per-beat durations. Each panel is a SHORT shot: a beat with an
 * explicit `durationSeconds` is clamped to (0, MAX_PANEL_SECONDS]; a beat
 * without one defaults to DEFAULT_PANEL_SECONDS (~1s). We do NOT spread a window
 * evenly across panels — every panel is at most 2s, typically 1s.
 */
function resolveDurations(beats: Beat[]): number[] {
	return beats.map((b) =>
		typeof b.durationSeconds === "number" && b.durationSeconds > 0
			? Math.min(b.durationSeconds, MAX_PANEL_SECONDS)
			: DEFAULT_PANEL_SECONDS,
	);
}

/**
 * Place beats on a continuous timeline starting at `startSeconds`, assigning a
 * 1-based panel number and a resolved duration to each.
 */
export function assignTimecodes(
	beats: Beat[],
	options: { windowSeconds?: number; startSeconds?: number } = {},
): PlacedBeat[] {
	let cursor = options.startSeconds ?? 0;
	const durations = resolveDurations(beats);

	return beats.map((beat, i) => {
		const durationSeconds = durations[i];
		const startSeconds = cursor;
		const endSeconds = cursor + durationSeconds;
		cursor = endSeconds;
		return {
			...beat,
			panel: i + 1,
			durationSeconds,
			timecode: { startSeconds, endSeconds },
		};
	});
}

// ─── Multi-sheet splitting ────────────────────────────────────────────────────

/**
 * Split a beat list spanning `durationSeconds` into N sheet specs, one per
 * ≤15s block, with CONTINUING global timecodes across sheets. A new sheet opens
 * when adding the next beat would overflow either the 15s window or the panel
 * cap. Panel numbers reset to 1 within each sheet; timecodes stay on the global
 * timeline (sheet 2 begins where sheet 1 ended).
 */
export function splitIntoSheets(
	beats: Beat[],
	durationSeconds: number,
	options: { panelCap?: number } = {},
): SheetSpec[] {
	if (beats.length === 0) return [];

	const panelCap = clampPanelCap(options.panelCap ?? DEFAULT_PANEL_CAP);
	const placed = assignTimecodes(beats, {
		windowSeconds: durationSeconds,
		startSeconds: 0,
	});

	// Partition into windows ≤ MAX_SHEET_SECONDS / ≤ panelCap.
	const groups: PlacedBeat[][] = [];
	let current: PlacedBeat[] = [];
	let windowStart = placed[0]?.timecode.startSeconds ?? 0;

	for (const beat of placed) {
		// A single beat longer than the sheet window can never fit on any sheet;
		// reject it rather than emitting a sheet that violates the ≤15s invariant.
		const beatDuration = beat.timecode.endSeconds - beat.timecode.startSeconds;
		if (beatDuration > MAX_SHEET_SECONDS + EPSILON) {
			throw new RangeError(
				`Beat at ${beat.timecode.startSeconds}s spans ${beatDuration.toFixed(2)}s, ` +
					`exceeding the ${MAX_SHEET_SECONDS}s sheet window — it cannot fit on any sheet.`,
			);
		}
		const wouldOverflowTime = beat.timecode.endSeconds - windowStart > MAX_SHEET_SECONDS + EPSILON;
		const wouldOverflowCount = current.length >= panelCap;
		if (current.length > 0 && (wouldOverflowTime || wouldOverflowCount)) {
			groups.push(current);
			current = [];
			windowStart = beat.timecode.startSeconds;
		}
		current.push(beat);
	}
	if (current.length > 0) groups.push(current);

	const totalSheets = groups.length;
	return groups.map((group, sheetIndex) => {
		const startSeconds = group[0].timecode.startSeconds;
		const endSeconds = group[group.length - 1].timecode.endSeconds;
		// Re-number panels 1-based within the sheet; keep global timecodes.
		const renumbered = group.map((b, i) => ({ ...b, panel: i + 1 }));
		return {
			sheetIndex,
			sheetNumber: sheetIndex + 1,
			totalSheets,
			beats: renumbered,
			startSeconds,
			endSeconds,
			durationSeconds: endSeconds - startSeconds,
		};
	});
}

function clampPanelCap(cap: number): number {
	if (!Number.isFinite(cap) || cap < 1) return DEFAULT_PANEL_CAP;
	return Math.min(cap, MAX_PANELS_PER_SHEET);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate a placed sheet: panel-count cap and that per-panel timecodes sum to
 * ≤ the ≤15s window. Pure — returns a structured result rather than throwing.
 */
export function validateSheet(
	beats: PlacedBeat[],
	options: { panelCap?: number; maxSeconds?: number } = {},
): ValidationResult {
	const errors: string[] = [];
	const panelCap = clampPanelCap(options.panelCap ?? DEFAULT_PANEL_CAP);
	const maxSeconds = options.maxSeconds ?? MAX_SHEET_SECONDS;

	if (beats.length === 0) {
		errors.push("sheet has no panels");
	}
	if (beats.length > panelCap) {
		errors.push(
			`panel count ${beats.length} exceeds cap ${panelCap} (≤ ${MAX_PANELS_PER_SHEET} absolute)`,
		);
	}

	const summed = beats.reduce((acc, b) => acc + b.durationSeconds, 0);
	if (summed > maxSeconds + EPSILON) {
		errors.push(
			`panel durations sum to ${summed.toFixed(2)}s, exceeding the ${maxSeconds}s sheet window`,
		);
	}
	for (const b of beats) {
		if (b.durationSeconds <= 0) {
			errors.push(`panel ${b.panel} has non-positive duration`);
		}
		if (b.durationSeconds > MAX_PANEL_SECONDS + EPSILON) {
			errors.push(
				`panel ${b.panel} lasts ${b.durationSeconds.toFixed(2)}s, exceeding the ${MAX_PANEL_SECONDS}s per-panel cap (each panel is a short shot of ≤${MAX_PANEL_SECONDS}s)`,
			);
		}
	}

	return { valid: errors.length === 0, errors };
}

// ─── Narrative pacing helpers ─────────────────────────────────────────────────

export type ActLabel = "setup" | "inciting incident" | "rising tension" | "climax" | "denouement";

/** Map a panel position (0-based) to a three-act pacing label. */
export function actForPanel(index: number, total: number): ActLabel {
	if (total <= 1) return "climax";
	const t = index / (total - 1);
	if (t < 0.2) return "setup";
	if (t < 0.4) return "inciting incident";
	if (t < 0.7) return "rising tension";
	if (t < 0.87) return "climax";
	return "denouement";
}

const SHOT_ROTATION = [
	"Wide establishing",
	"Medium",
	"Close-up",
	"Over-the-shoulder",
	"Low angle",
	"High angle",
	"Dynamic",
	"Macro",
];

/**
 * Suggest a shot type that differs from the previous panel's, cycling through a
 * varied rotation. Used to fill gaps and enforce "never repeat consecutively".
 */
export function suggestShotType(index: number, previous?: string): string {
	let candidate = SHOT_ROTATION[index % SHOT_ROTATION.length];
	if (previous && candidate.toLowerCase() === previous.toLowerCase()) {
		candidate = SHOT_ROTATION[(index + 1) % SHOT_ROTATION.length];
	}
	return candidate;
}

// ─── Prompt assembly (sections A–H) ───────────────────────────────────────────

function durationLabel(seconds: number): string {
	return `${Math.round(seconds)}-SECOND`;
}

function subjectsByKind(subjects: SubjectDNA[] | undefined, kind: SubjectDNA["kind"]) {
	return (subjects ?? []).filter((s) => (s.kind ?? "character") === kind);
}

function buildHeader(
	input: StoryboardSheetPromptInput,
	grid: Grid,
	panelCount: number,
	windowSeconds: number,
): string {
	const label = input.headerLabel ?? `${durationLabel(windowSeconds)} STORYBOARD`;
	const brandClause = input.brand ? `${input.brand} — ` : "";
	const genreClause = input.genre ? ` for a ${input.genre}` : "";
	const sheetClause =
		(input.totalSheets ?? 1) > 1
			? ` This is sheet ${input.sheetNumber ?? 1} of ${input.totalSheets}, covering ${formatSeconds(
					input.startSeconds ?? 0,
				)}–${formatSeconds((input.startSeconds ?? 0) + windowSeconds)} of the full video.`
			: "";
	return [
		`A) TITLE & FORMAT — A complete, professional ${durationLabel(windowSeconds)} animation/film storyboard presentation sheet titled "${input.title}"${genreClause}.`,
		`Render it as ONE single composite image. Across the very top, a clean header bar reads "${brandClause}${label}".`,
		`The sheet presents ${panelCount} sequential cinematic panels arranged in a clean ${grid.rows}×${grid.cols} grid (${grid.rows} rows × ${grid.cols} columns), numbered left-to-right, top-to-bottom.${sheetClause}`,
	].join(" ");
}

function buildStyleDeclaration(input: StoryboardSheetPromptInput): string {
	const profile = styleProfile(input.style);
	const declaration = input.styleDescription?.trim() || profile.styleDeclaration;
	return `B) STYLE — ${declaration}`;
}

function buildSubjectDescriptions(input: StoryboardSheetPromptInput): string {
	const characters = subjectsByKind(input.subjects, "character");
	const products = subjectsByKind(input.subjects, "product");
	if (characters.length === 0 && products.length === 0) {
		return "C) CAST & SUBJECTS — Build any required characters and props from the scene descriptions below, keeping their look identical across every panel.";
	}
	const parts: string[] = ["C) CAST & SUBJECTS —"];
	for (const c of characters) {
		parts.push(`${c.name}: ${c.description.trim()}.`);
	}
	for (const p of products) {
		parts.push(`${p.name} (product): ${p.description.trim()}.`);
	}
	parts.push(
		"Keep every subject's identity, proportions, colours, and signature details identical across all panels; the attached reference sheet image(s) are the authority on their look.",
	);
	return parts.join(" ");
}

function buildVisualTone(input: StoryboardSheetPromptInput): string {
	const profile = styleProfile(input.style);
	return `D) VISUAL TONE — ${input.visualTone?.trim() || profile.visualTone}`;
}

function buildLayoutDetails(grid: Grid, panelCount: number): string {
	return [
		"E) SHEET LAYOUT — Present it as a polished film/animation production storyboard sheet:",
		`a neutral presentation board background, ${panelCount} evenly-sized rectangular panels in a clean ${grid.rows}×${grid.cols} grid with crisp gutters and thin borders between frames.`,
		"Each panel depicts a short shot of at most 2 seconds, typically 1 second.",
		"Each panel carries, baked into the image, the storyboard's own presentation chrome: a panel number badge in the top-left corner, a timecode label (e.g. 00:00-00:01) in the top-right corner, and — directly beneath the frame, in a clean sans-serif typeface — a caption block of up to two stacked lines: first a single one-line shot-description caption, then (only when that panel has spoken words) a separate, clearly-labeled dialogue/voiceover line in the form `Speaker: “line”` (a character name), `VO: “line”` (narration), or `Dialogue: “line”` (unattributed). The dialogue/VO text is printed ONLY in this caption block beneath the frame — never inside the depicted shot.",
		"CRITICAL — TEXT-FREE SHOT CONTENT: the imagery INSIDE every panel frame (the depicted shot itself) must contain NO words, captions, subtitles, dialogue, speech bubbles, signage, on-screen UI text, watermarks, labels, or lettering of any kind — the depicted scene must be visually clean. The ONLY in-frame text or graphic permitted within the depicted shot is the brand logo and any supplied brand assets. This restriction applies ONLY to the DEPICTED SHOT CONTENT and does NOT remove the storyboard's own panel-number badge, top-right timecode label, the one-line shot caption, or the labeled dialogue/VO caption line beneath each frame — those are presentation chrome and MUST still be rendered.",
		"Studio-quality typography, consistent alignment, generous margins, and a professional storyboard-presentation aesthetic.",
	].join(" ");
}

/**
 * Format a beat's spoken line into the labeled caption string printed beneath the
 * panel, or `undefined` when the panel is silent. Label rule:
 *   - speaker set and not "VO"  → `Mira: “We built this for you.”`
 *   - speaker === "VO" (any case) → `VO: “Built for you.”`
 *   - dialogue set, no speaker     → `Dialogue: “Built for you.”`
 *   - no dialogue (or "none")      → undefined (no line emitted)
 */
export function formatPanelDialogue(beat: Pick<Beat, "dialogue" | "speaker">): string | undefined {
	const line = beat.dialogue?.trim();
	if (!line || line.toLowerCase() === "none") return undefined;
	const speaker = beat.speaker?.trim();
	const label = !speaker ? "Dialogue" : speaker.toLowerCase() === "vo" ? "VO" : speaker;
	return `${label}: “${line}”`;
}

function buildSceneBreakdown(beats: PlacedBeat[], subjects: SubjectDNA[] | undefined): string {
	const total = beats.length;
	const lines: string[] = ["F) SCENE BREAKDOWN —"];
	let prevShot: string | undefined;

	for (let i = 0; i < beats.length; i++) {
		const beat = beats[i];
		const shotType = beat.shotType?.trim() || suggestShotType(i, prevShot);
		prevShot = shotType;
		const act = actForPanel(i, total);
		const tc = formatTimecode(beat.timecode);

		const segments: string[] = [
			`Panel ${beat.panel} [${tc}] — ${shotType} shot (${act}).`,
			beat.description.trim().replace(/\s+$/, ""),
		];

		// Weave a subject DNA reminder roughly every third panel for consistency.
		const subj = (subjects ?? [])[i % Math.max(1, (subjects ?? []).length)];
		if (subj && i % 3 === 0) {
			segments.push(`Keep ${subj.name} consistent: ${subj.description.trim()}.`);
		}
		if (beat.action && beat.action.trim().toLowerCase() !== "none") {
			segments.push(`On-screen action: ${beat.action.trim()}.`);
		}
		const dialogueCaption = formatPanelDialogue(beat);
		if (dialogueCaption) {
			segments.push(
				`Caption line beneath the frame (dialogue/VO — print verbatim, NOT inside the shot): ${dialogueCaption}.`,
			);
		}
		lines.push(segments.join(" "));
	}
	return lines.join(" ");
}

function buildArtDirectionFooter(input: StoryboardSheetPromptInput): string {
	const profile = styleProfile(input.style);
	return `G) ART DIRECTION — ${profile.artDirection} Vary shot types across the sequence (never repeat the same shot type in consecutive panels) and escalate emotional intensity toward the climax. Keep the depicted shot content text-free: no words, captions, subtitles, dialogue, speech bubbles, signage, on-screen UI text, watermarks, labels, or lettering inside the frames — the only permitted in-frame text/graphic is the brand logo and supplied brand assets (the storyboard's own panel-number badges, timecode labels, one-line shot captions, and labeled dialogue/VO caption lines beneath each frame remain).`;
}

function buildRenderFooter(aspect: AspectRatio): string {
	return [
		"H) RENDERING & FORMAT —",
		`Output a single masterpiece-quality, production-ready composite storyboard sheet at ${aspect} aspect ratio.`,
		"Each panel depicts a short shot of at most 2 seconds, typically 1 second.",
		"Keep the depicted shot content text-free — no words, captions, subtitles, dialogue, speech bubbles, signage, on-screen UI text, watermarks, or lettering inside the frames; the only permitted in-frame text/graphic is the brand logo and supplied brand assets — while STILL rendering the storyboard's own panel-number badges, top-right timecode labels, one-line shot captions, and the labeled dialogue/VO caption lines beneath each frame as presentation chrome.",
		"Sharp focus, high detail, clean legible captions, dialogue/VO lines, and timecodes, and a cohesive look across every panel. This is one professional storyboard presentation sheet, not separate images.",
	].join(" ");
}

/**
 * Compose the full Phase 1 composite-sheet prompt for a single ≤15s sheet.
 * Returns one continuous block of natural-language prose with sections A–H.
 */
export function composeStoryboardSheetPrompt(input: StoryboardSheetPromptInput): string {
	if (input.beats.length === 0) {
		throw new Error("composeStoryboardSheetPrompt: beats must not be empty");
	}
	const aspect = input.aspectRatio ?? "16:9";
	const windowSeconds = input.durationSeconds ?? MAX_SHEET_SECONDS;
	const panelCap = clampPanelCap(input.panelCap ?? DEFAULT_PANEL_CAP);

	// A single sheet must fit inside the ≤15s window; a caller-supplied window
	// larger than that would yield a self-contradictory sheet.
	if (windowSeconds > MAX_SHEET_SECONDS + EPSILON) {
		throw new RangeError(
			`composeStoryboardSheetPrompt: durationSeconds ${windowSeconds}s exceeds the ${MAX_SHEET_SECONDS}s sheet window; split with splitIntoSheets first`,
		);
	}

	if (input.beats.length > panelCap) {
		throw new RangeError(
			`composeStoryboardSheetPrompt: ${input.beats.length} panels exceeds cap ${panelCap}; split with splitIntoSheets first`,
		);
	}

	const placed = assignTimecodes(input.beats, {
		windowSeconds,
		startSeconds: input.startSeconds ?? 0,
	});

	// Reject placements whose timing cannot fit the declared window (per-panel
	// durations summing past the window, non-positive durations, panel overflow).
	const validation = validateSheet(placed, { panelCap, maxSeconds: windowSeconds });
	if (!validation.valid) {
		throw new RangeError(
			`composeStoryboardSheetPrompt: invalid sheet timing — ${validation.errors.join("; ")}`,
		);
	}

	const grid = gridForPanelCount(placed.length, aspect);

	const sections = [
		buildHeader(input, grid, placed.length, windowSeconds),
		buildStyleDeclaration(input),
		buildSubjectDescriptions(input),
		buildVisualTone(input),
		buildLayoutDetails(grid, placed.length),
		buildSceneBreakdown(placed, input.subjects),
		buildArtDirectionFooter(input),
		buildRenderFooter(aspect),
	];

	return sections.join("\n\n");
}

/**
 * Convenience: split a long video into sheets, then compose a prompt per sheet.
 * Returns one entry per ≤15s block with its placed beats and grid.
 */
export function composeStoryboardSheets(
	input: Omit<
		StoryboardSheetPromptInput,
		"beats" | "sheetNumber" | "totalSheets" | "startSeconds"
	> & {
		beats: Beat[];
		durationSeconds: number;
	},
): Array<{ sheet: SheetSpec; grid: Grid; prompt: string }> {
	const sheets = splitIntoSheets(input.beats, input.durationSeconds, {
		panelCap: input.panelCap,
	});
	const aspect = input.aspectRatio ?? "16:9";

	return sheets.map((sheet) => {
		const grid = gridForPanelCount(sheet.beats.length, aspect);
		const prompt = composeStoryboardSheetPrompt({
			...input,
			beats: sheet.beats.map((b) => ({
				shotType: b.shotType,
				description: b.description,
				action: b.action,
				dialogue: b.dialogue,
				speaker: b.speaker,
				sceneName: b.sceneName,
				durationSeconds: b.durationSeconds,
			})),
			durationSeconds: sheet.durationSeconds,
			startSeconds: sheet.startSeconds,
			sheetNumber: sheet.sheetNumber,
			totalSheets: sheet.totalSheets,
		});
		return { sheet, grid, prompt };
	});
}
