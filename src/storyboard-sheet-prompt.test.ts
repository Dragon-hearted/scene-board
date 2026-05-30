/**
 * Unit tests for the Phase 1 composite-sheet prompt composer.
 *
 * Covers: grid mapping (9/12/15/20), the vertical 9:16 row/col flip, the
 * panel-count cap, VARIABLE panel duration (uneven timecodes summing to ≤15s),
 * `splitIntoSheets` for 15/30/60s videos with continuing timecodes, timecode
 * arithmetic, and the presence of sections A–H in the composed prompt.
 */

import { describe, expect, test } from "bun:test";
import {
	type Beat,
	DEFAULT_PANEL_CAP,
	MAX_SHEET_SECONDS,
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

	test("assignTimecodes places beats contiguously from the start offset", () => {
		const placed = assignTimecodes(evenBeats(3, 5), { windowSeconds: 15, startSeconds: 0 });
		expect(placed.map((p) => p.panel)).toEqual([1, 2, 3]);
		expect(placed[0].timecode).toEqual({ startSeconds: 0, endSeconds: 5 });
		expect(placed[1].timecode).toEqual({ startSeconds: 5, endSeconds: 10 });
		expect(placed[2].timecode).toEqual({ startSeconds: 10, endSeconds: 15 });
	});

	test("assignTimecodes auto-distributes the window across beats with no duration", () => {
		const placed = assignTimecodes(evenBeats(3), { windowSeconds: 15 });
		expect(placed.map((p) => p.durationSeconds)).toEqual([5, 5, 5]);
		expect(placed[2].timecode.endSeconds).toBeCloseTo(15);
	});
});

// ─── Variable panel duration ──────────────────────────────────────────────────

describe("variable panel duration", () => {
	test("honours uneven explicit durations that sum to the ≤15s window", () => {
		const beats: Beat[] = [
			beat({ durationSeconds: 2 }),
			beat({ durationSeconds: 5 }),
			beat({ durationSeconds: 1 }),
			beat({ durationSeconds: 7 }),
		];
		const placed = assignTimecodes(beats, { windowSeconds: 15 });
		expect(placed.map((p) => p.durationSeconds)).toEqual([2, 5, 1, 7]);
		// Timecodes follow the variable durations, not 1-per-second.
		expect(placed[3].timecode).toEqual({ startSeconds: 8, endSeconds: 15 });
		const total = placed.reduce((s, p) => s + p.durationSeconds, 0);
		expect(total).toBeLessThanOrEqual(MAX_SHEET_SECONDS);
		expect(validateSheet(placed).valid).toBe(true);
	});

	test("validateSheet flags durations summing beyond the 15s window", () => {
		const placed = assignTimecodes([beat({ durationSeconds: 10 }), beat({ durationSeconds: 9 })], {
			windowSeconds: 19,
		});
		const result = validateSheet(placed);
		expect(result.valid).toBe(false);
		expect(result.errors.join(" ")).toMatch(/exceeding the 15s sheet window/);
	});

	test("validateSheet flags a panel count over the cap", () => {
		const placed = assignTimecodes(evenBeats(16, 0.5), { windowSeconds: 8 });
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

// ─── splitIntoSheets (15 / 30 / 60s) ──────────────────────────────────────────

describe("splitIntoSheets", () => {
	test("keeps a ≤15s video in a single sheet", () => {
		const sheets = splitIntoSheets(evenBeats(5, 3), 15);
		expect(sheets).toHaveLength(1);
		expect(sheets[0].startSeconds).toBe(0);
		expect(sheets[0].endSeconds).toBeCloseTo(15);
		expect(sheets[0].durationSeconds).toBeLessThanOrEqual(MAX_SHEET_SECONDS + 0.001);
	});

	test("splits a 30s video into two ≤15s sheets with continuing timecodes", () => {
		const sheets = splitIntoSheets(evenBeats(10, 3), 30);
		expect(sheets).toHaveLength(2);
		expect(sheets[0].startSeconds).toBe(0);
		expect(sheets[0].endSeconds).toBeCloseTo(15);
		// Sheet 2 continues exactly where sheet 1 ended.
		expect(sheets[1].startSeconds).toBeCloseTo(15);
		expect(sheets[1].endSeconds).toBeCloseTo(30);
		// Panel numbers reset per sheet.
		expect(sheets[1].beats[0].panel).toBe(1);
		// Global timecodes do NOT reset.
		expect(sheets[1].beats[0].timecode.startSeconds).toBeCloseTo(15);
		// Sheet numbering metadata is correct.
		expect(sheets.map((s) => s.sheetNumber)).toEqual([1, 2]);
		expect(sheets[0].totalSheets).toBe(2);
	});

	test("splits a 60s video into four ≤15s sheets", () => {
		const sheets = splitIntoSheets(evenBeats(20, 3), 60);
		expect(sheets).toHaveLength(4);
		for (const sheet of sheets) {
			expect(sheet.durationSeconds).toBeLessThanOrEqual(MAX_SHEET_SECONDS + 0.001);
		}
		expect(sheets[3].endSeconds).toBeCloseTo(60);
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
			beats: evenBeats(10, 3),
			durationSeconds: 30,
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
			beat({ shotType: "Wide", description: "Mira tinkers in her workshop", durationSeconds: 5 }),
			beat({ shotType: "Close-up", description: "Bolt's eye flickers on", durationSeconds: 5 }),
			beat({ shotType: "Medium", description: "They shake hands", durationSeconds: 5 }),
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
		expect(prompt).toContain("Panel 1 [00:00-00:05]");
		expect(prompt).toContain("Panel 3 [00:10-00:15]");
		expect(prompt).toContain("Mira tinkers in her workshop");
	});

	test("weaves subject DNA for consistency", () => {
		expect(prompt).toContain("Mira");
		expect(prompt).toContain("Bolt");
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
