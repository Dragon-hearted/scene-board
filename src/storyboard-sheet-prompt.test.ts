/**
 * Unit tests for the Phase 1 composite-sheet prompt composer.
 *
 * Covers: grid mapping (9/12/15/20), the vertical 9:16 row/col flip, the
 * panel-count cap, SHORT panel duration (each panel ≤2s, defaulting to ~1s),
 * `splitIntoSheets` for short-panel videos with continuing timecodes, timecode
 * arithmetic, the text-free shot-content instruction (with retained chrome), and
 * the presence of sections A–H in the composed prompt.
 */

import { describe, expect, test } from "bun:test";
import {
	type Beat,
	DEFAULT_PANEL_CAP,
	DEFAULT_PANEL_SECONDS,
	MAX_PANEL_SECONDS,
	MAX_SHEET_SECONDS,
	type PlacedBeat,
	actForPanel,
	assignTimecodes,
	composeStoryboardSheetPrompt,
	composeStoryboardSheets,
	formatSeconds,
	formatTimecode,
	gridForPanelCount,
	splitIntoSheets,
	suggestShotType,
	validateSheet,
} from "./storyboard-sheet-prompt";

function beat(over: Partial<Beat> = {}): Beat {
	return {
		shotType: over.shotType ?? "Medium",
		description: over.description ?? "A scene description.",
		...(over.action !== undefined && { action: over.action }),
		...(over.sceneName !== undefined && { sceneName: over.sceneName }),
		...(over.durationSeconds !== undefined && { durationSeconds: over.durationSeconds }),
	};
}

function evenBeats(n: number, durationSeconds?: number): Beat[] {
	return Array.from({ length: n }, (_, i) =>
		beat({
			shotType: "Medium",
			description: `Scene ${i + 1}`,
			...(durationSeconds !== undefined && { durationSeconds }),
		}),
	);
}

/** Build a placed beat directly (bypassing duration resolution) for validation tests. */
function placedBeat(panel: number, durationSeconds: number, startSeconds: number): PlacedBeat {
	return {
		shotType: "Medium",
		description: `Scene ${panel}`,
		panel,
		durationSeconds,
		timecode: { startSeconds, endSeconds: startSeconds + durationSeconds },
	};
}

// ─── Grid mapping ─────────────────────────────────────────────────────────────

describe("gridForPanelCount", () => {
	test("maps canonical landscape panel counts to the documented grids", () => {
		expect(gridForPanelCount(9)).toEqual({ rows: 3, cols: 3 });
		expect(gridForPanelCount(12)).toEqual({ rows: 3, cols: 4 });
		expect(gridForPanelCount(15)).toEqual({ rows: 3, cols: 5 });
		expect(gridForPanelCount(20)).toEqual({ rows: 4, cols: 5 });
	});

	test("picks the smallest canonical grid that fits a non-canonical count", () => {
		expect(gridForPanelCount(10)).toEqual({ rows: 3, cols: 4 }); // ≤12
		expect(gridForPanelCount(13)).toEqual({ rows: 3, cols: 5 }); // ≤15
	});

	test("flips rows × cols for vertical 9:16 (15 → 5×3)", () => {
		expect(gridForPanelCount(15, "9:16")).toEqual({ rows: 5, cols: 3 });
		expect(gridForPanelCount(9, "9:16")).toEqual({ rows: 3, cols: 3 });
		expect(gridForPanelCount(20, "3:4")).toEqual({ rows: 5, cols: 4 });
	});

	test("throws for a panel count below 1", () => {
		expect(() => gridForPanelCount(0)).toThrow(RangeError);
	});
});

// ─── Timecode arithmetic ──────────────────────────────────────────────────────

describe("timecode helpers", () => {
	test("formatSeconds renders MM:SS", () => {
		expect(formatSeconds(0)).toBe("00:00");
		expect(formatSeconds(7)).toBe("00:07");
		expect(formatSeconds(75)).toBe("01:15");
	});

	test("formatTimecode renders a MM:SS-MM:SS range", () => {
		expect(formatTimecode({ startSeconds: 0, endSeconds: 1 })).toBe("00:00-00:01");
		expect(formatTimecode({ startSeconds: 13, endSeconds: 15 })).toBe("00:13-00:15");
	});

	test("assignTimecodes places short panels contiguously from the start offset", () => {
		const placed = assignTimecodes(evenBeats(3, 2), { startSeconds: 0 });
		expect(placed.map((p) => p.panel)).toEqual([1, 2, 3]);
		expect(placed[0].timecode).toEqual({ startSeconds: 0, endSeconds: 2 });
		expect(placed[1].timecode).toEqual({ startSeconds: 2, endSeconds: 4 });
		expect(placed[2].timecode).toEqual({ startSeconds: 4, endSeconds: 6 });
	});

	test("assignTimecodes defaults beats with no duration to ~1s panels", () => {
		const placed = assignTimecodes(evenBeats(3));
		expect(placed.map((p) => p.durationSeconds)).toEqual([
			DEFAULT_PANEL_SECONDS,
			DEFAULT_PANEL_SECONDS,
			DEFAULT_PANEL_SECONDS,
		]);
		expect(placed[2].timecode.endSeconds).toBeCloseTo(3);
	});
});

// ─── Short panel duration ─────────────────────────────────────────────────────

describe("short panel duration", () => {
	test("defaults missing durations to 1s and clamps explicit durations to ≤2s", () => {
		const beats: Beat[] = [
			beat({ durationSeconds: 2 }),
			beat({ durationSeconds: 5 }), // over the cap → clamped to 2
			beat(), // missing → defaults to 1
			beat({ durationSeconds: 1.5 }),
		];
		const placed = assignTimecodes(beats);
		expect(placed.map((p) => p.durationSeconds)).toEqual([2, 2, 1, 1.5]);
		// Every panel respects the per-panel cap.
		for (const p of placed) {
			expect(p.durationSeconds).toBeLessThanOrEqual(MAX_PANEL_SECONDS);
		}
		expect(validateSheet(placed).valid).toBe(true);
	});

	test("validateSheet flags a panel longer than the 2s per-panel cap", () => {
		const placed = [placedBeat(1, 1, 0), placedBeat(2, 3, 1)];
		const result = validateSheet(placed);
		expect(result.valid).toBe(false);
		expect(result.errors.join(" ")).toMatch(/panel 2.*2s per-panel cap/);
	});

	test("validateSheet flags durations summing beyond the 15s window", () => {
		// 8 panels at the 2s cap sum to 16s > the 15s sheet window.
		const placed = assignTimecodes(evenBeats(8, 2));
		const result = validateSheet(placed);
		expect(result.valid).toBe(false);
		expect(result.errors.join(" ")).toMatch(/exceeding the 15s sheet window/);
	});

	test("validateSheet flags a panel count over the cap", () => {
		const placed = assignTimecodes(evenBeats(16, 0.5));
		const result = validateSheet(placed);
		expect(result.valid).toBe(false);
		expect(result.errors.join(" ")).toMatch(/exceeds cap/);
	});
});

// ─── Panel-count cap on the composer ──────────────────────────────────────────

describe("composeStoryboardSheetPrompt panel cap", () => {
	test("throws when beats exceed the default panel cap (15)", () => {
		expect(() =>
			composeStoryboardSheetPrompt({
				title: "Too Many",
				style: "3d",
				beats: evenBeats(DEFAULT_PANEL_CAP + 1, 0.5),
			}),
		).toThrow(RangeError);
	});

	test("accepts exactly the panel cap", () => {
		const prompt = composeStoryboardSheetPrompt({
			title: "Exactly Capped",
			style: "3d",
			beats: evenBeats(DEFAULT_PANEL_CAP, 1),
		});
		expect(prompt.length).toBeGreaterThan(0);
	});

	test("throws on empty beats", () => {
		expect(() =>
			composeStoryboardSheetPrompt({ title: "Empty", style: "3d", beats: [] }),
		).toThrow();
	});
});

// ─── splitIntoSheets ──────────────────────────────────────────────────────────

describe("splitIntoSheets", () => {
	test("keeps a short-panel video that fits in 15s on a single sheet", () => {
		const sheets = splitIntoSheets(evenBeats(5, 2), 10);
		expect(sheets).toHaveLength(1);
		expect(sheets[0].startSeconds).toBe(0);
		expect(sheets[0].endSeconds).toBeCloseTo(10);
		expect(sheets[0].durationSeconds).toBeLessThanOrEqual(MAX_SHEET_SECONDS + 0.001);
	});

	test("splits a >15s run of 1s panels into ≤15s sheets with continuing timecodes", () => {
		const sheets = splitIntoSheets(evenBeats(20, 1), 20);
		expect(sheets).toHaveLength(2);
		expect(sheets[0].startSeconds).toBe(0);
		expect(sheets[0].endSeconds).toBeCloseTo(15);
		// Sheet 2 continues exactly where sheet 1 ended.
		expect(sheets[1].startSeconds).toBeCloseTo(15);
		expect(sheets[1].endSeconds).toBeCloseTo(20);
		// Panel numbers reset per sheet.
		expect(sheets[1].beats[0].panel).toBe(1);
		// Global timecodes do NOT reset.
		expect(sheets[1].beats[0].timecode.startSeconds).toBeCloseTo(15);
		// Sheet numbering metadata is correct.
		expect(sheets.map((s) => s.sheetNumber)).toEqual([1, 2]);
		expect(sheets[0].totalSheets).toBe(2);
	});

	test("every sheet stays within the ≤15s window", () => {
		const sheets = splitIntoSheets(evenBeats(40, 1), 40);
		expect(sheets.length).toBeGreaterThan(1);
		for (const sheet of sheets) {
			expect(sheet.durationSeconds).toBeLessThanOrEqual(MAX_SHEET_SECONDS + 0.001);
		}
		expect(sheets[sheets.length - 1].endSeconds).toBeCloseTo(40);
	});

	test("opens a new sheet when the panel cap is reached even within 15s", () => {
		// 12 short beats of 1s each fit in 12s, but a cap of 5 forces 3 sheets.
		const sheets = splitIntoSheets(evenBeats(12, 1), 12, { panelCap: 5 });
		expect(sheets.length).toBe(3);
		expect(sheets[0].beats.length).toBe(5);
	});

	test("returns no sheets for an empty beat list", () => {
		expect(splitIntoSheets([], 15)).toEqual([]);
	});
});

// ─── composeStoryboardSheets convenience ──────────────────────────────────────

describe("composeStoryboardSheets", () => {
	test("returns one prompt per ≤15s sheet for a long video", () => {
		const result = composeStoryboardSheets({
			title: "Long Film",
			style: "anime",
			beats: evenBeats(10, 2),
			durationSeconds: 20,
		});
		expect(result).toHaveLength(2);
		for (const entry of result) {
			expect(entry.prompt).toContain("A) TITLE & FORMAT");
			expect(entry.grid.rows).toBeGreaterThan(0);
		}
	});
});

// ─── Sections A–H presence ────────────────────────────────────────────────────

describe("composeStoryboardSheetPrompt sections", () => {
	const prompt = composeStoryboardSheetPrompt({
		title: "The Lost Robot",
		brand: "ACME",
		genre: "sci-fi adventure short film",
		style: "3d",
		visualTone: "warm dusk light",
		subjects: [
			{ name: "Mira", description: "a freckled 9-year-old inventor in goggles", kind: "character" },
			{ name: "Bolt", description: "a dented copper robot", kind: "product" },
		],
		beats: [
			beat({ shotType: "Wide", description: "Mira tinkers in her workshop", durationSeconds: 2 }),
			beat({ shotType: "Close-up", description: "Bolt's eye flickers on", durationSeconds: 2 }),
			beat({ shotType: "Medium", description: "They shake hands", durationSeconds: 1 }),
		],
	});

	test("includes all eight labelled sections A–H", () => {
		for (const section of [
			"A) TITLE & FORMAT",
			"B) STYLE",
			"C) CAST & SUBJECTS",
			"D) VISUAL TONE",
			"E) SHEET LAYOUT",
			"F) SCENE BREAKDOWN",
			"G) ART DIRECTION",
			"H) RENDERING & FORMAT",
		]) {
			expect(prompt).toContain(section);
		}
	});

	test("renders the header bar with brand + duration label and the grid", () => {
		expect(prompt).toContain("ACME — 15-SECOND STORYBOARD");
		expect(prompt).toContain("3×3"); // 3 panels → 3×3 grid
	});

	test("bakes per-panel timecodes and captions into the scene breakdown", () => {
		expect(prompt).toContain("Panel 1 [00:00-00:02]");
		expect(prompt).toContain("Panel 3 [00:04-00:05]");
		expect(prompt).toContain("Mira tinkers in her workshop");
	});

	test("weaves subject DNA for consistency", () => {
		expect(prompt).toContain("Mira");
		expect(prompt).toContain("Bolt");
	});

	test("instructs text-free shot content while permitting the brand logo", () => {
		// No in-frame text inside the depicted shots.
		expect(prompt).toMatch(/no words, captions, subtitles/i);
		expect(prompt).toMatch(/watermarks/i);
		// The only permitted in-frame text/graphic is the brand logo / brand assets.
		expect(prompt).toMatch(/brand logo/i);
	});

	test("retains the storyboard's own panel-number / timecode / caption chrome", () => {
		expect(prompt).toMatch(/panel number badge/i);
		expect(prompt).toMatch(/timecode label/i);
		expect(prompt).toMatch(/caption/i);
		// The chrome is explicitly preserved as presentation chrome.
		expect(prompt).toMatch(/presentation chrome/i);
	});

	test("describes each panel as a short shot of at most 2 seconds", () => {
		expect(prompt).toMatch(/short shot of at most 2 seconds/i);
	});
});

// ─── Pacing helpers ───────────────────────────────────────────────────────────

describe("pacing helpers", () => {
	test("actForPanel walks through the three-act labels", () => {
		expect(actForPanel(0, 10)).toBe("setup");
		expect(actForPanel(9, 10)).toBe("denouement");
		expect(actForPanel(0, 1)).toBe("climax");
	});

	test("suggestShotType never repeats the previous shot consecutively", () => {
		const first = suggestShotType(0);
		const next = suggestShotType(1, first);
		expect(next.toLowerCase()).not.toBe(first.toLowerCase());
	});
});
