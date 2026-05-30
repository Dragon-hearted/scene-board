/**
 * Unit tests for the Phase 2 cinematic video-prompt composer.
 *
 * Covers: shot count == panel count, per-shot timecodes summing exactly to the
 * target duration, the fixed AUDIO_CLOSING_LINE, and style-adaptive blocks
 * (3D / live-action / anime / 2D / custom).
 */

import { describe, expect, test } from "bun:test";
import {
	AUDIO_CLOSING_LINE,
	type PanelInput,
	composeVideoPrompt,
	distributeShotDurations,
	toTimedShots,
} from "./video-prompt";

function panel(over: Partial<PanelInput> = {}): PanelInput {
	return {
		shotType: over.shotType ?? "Medium",
		description: over.description ?? "Something happens.",
		...(over.sceneName !== undefined && { sceneName: over.sceneName }),
		...(over.dialogue !== undefined && { dialogue: over.dialogue }),
		...(over.sfx !== undefined && { sfx: over.sfx }),
		...(over.camera !== undefined && { camera: over.camera }),
		...(over.durationSeconds !== undefined && { durationSeconds: over.durationSeconds }),
	};
}

function panels(n: number): PanelInput[] {
	return Array.from({ length: n }, (_, i) => panel({ description: `Beat ${i + 1}` }));
}

// ─── Time distribution ────────────────────────────────────────────────────────

describe("distributeShotDurations", () => {
	test("splits the duration evenly when no explicit durations are given", () => {
		const d = distributeShotDurations(panels(3), 15);
		expect(d.reduce((s, x) => s + x, 0)).toBeCloseTo(15);
		expect(d).toEqual([5, 5, 5]);
	});

	test("honours explicit durations and absorbs rounding drift into the last shot", () => {
		const d = distributeShotDurations([panel({ durationSeconds: 4 }), panel(), panel()], 15);
		expect(d[0]).toBe(4);
		expect(d.reduce((s, x) => s + x, 0)).toBeCloseTo(15);
	});

	test("returns an empty array for no panels", () => {
		expect(distributeShotDurations([], 15)).toEqual([]);
	});

	test("never emits negative or zero shot durations", () => {
		const d = distributeShotDurations([panel({ durationSeconds: 4 }), panel(), panel()], 15);
		for (const x of d) expect(x).toBeGreaterThan(0);
	});

	test("throws when durationSeconds is not positive", () => {
		expect(() => distributeShotDurations(panels(3), 0)).toThrow(RangeError);
		expect(() => distributeShotDurations(panels(3), -5)).toThrow(RangeError);
	});

	test("throws when explicit durations overspec the timeline", () => {
		expect(() =>
			distributeShotDurations([panel({ durationSeconds: 10 }), panel({ durationSeconds: 10 })], 15),
		).toThrow(RangeError);
	});

	test("throws when explicit durations leave no time for unspecified panels", () => {
		expect(() => distributeShotDurations([panel({ durationSeconds: 15 }), panel()], 15)).toThrow(
			RangeError,
		);
	});
});

describe("toTimedShots", () => {
	test("produces contiguous timecodes summing exactly to the duration", () => {
		const shots = toTimedShots(panels(4), 16);
		expect(shots).toHaveLength(4);
		expect(shots[0].startSeconds).toBe(0);
		// Contiguous: each shot starts where the previous ended.
		for (let i = 1; i < shots.length; i++) {
			expect(shots[i].startSeconds).toBeCloseTo(shots[i - 1].endSeconds);
		}
		expect(shots[shots.length - 1].endSeconds).toBeCloseTo(16);
	});

	test("numbers shots 1-based", () => {
		const shots = toTimedShots(panels(3), 15);
		expect(shots.map((s) => s.shotNumber)).toEqual([1, 2, 3]);
	});
});

// ─── composeVideoPrompt ───────────────────────────────────────────────────────

describe("composeVideoPrompt", () => {
	test("emits exactly one SHOT block per panel", () => {
		const prompt = composeVideoPrompt({
			style: "3d",
			panels: panels(5),
			durationSeconds: 15,
		});
		const shotMatches = prompt.match(/SHOT \d+ —/g) ?? [];
		expect(shotMatches).toHaveLength(5);
	});

	test("always ends with the fixed AUDIO closing line", () => {
		const prompt = composeVideoPrompt({
			style: "live-action",
			panels: panels(3),
			durationSeconds: 12,
		});
		expect(prompt).toContain(AUDIO_CLOSING_LINE);
		expect(prompt.trimEnd().endsWith(AUDIO_CLOSING_LINE)).toBe(true);
	});

	test("shot timecodes in the prompt sum to the target duration", () => {
		const prompt = composeVideoPrompt({
			style: "3d",
			panels: panels(3),
			durationSeconds: 15,
		});
		// Last shot's end timecode must read 00:15.
		expect(prompt).toContain("00:15]");
		expect(prompt).toContain("[00:00 –");
	});

	test("includes dialogue and SFX lines per shot", () => {
		const prompt = composeVideoPrompt({
			style: "anime",
			panels: [panel({ dialogue: "Mira: We did it!", sfx: "whirring servos" })],
			durationSeconds: 5,
		});
		expect(prompt).toContain("Dialogue: Mira: We did it!");
		expect(prompt).toContain("SFX: whirring servos");
	});

	test("defaults dialogue to None and SFX to ambience when absent", () => {
		const prompt = composeVideoPrompt({
			style: "3d",
			panels: [panel()],
			durationSeconds: 5,
		});
		expect(prompt).toContain("Dialogue: None");
		expect(prompt).toContain("SFX: natural ambience for the scene");
	});

	test("throws on empty panels", () => {
		expect(() => composeVideoPrompt({ style: "3d", panels: [], durationSeconds: 5 })).toThrow();
	});
});

// ─── Style-adaptive blocks ────────────────────────────────────────────────────

describe("style-adaptive STYLE block", () => {
	test("3D style references feature-animation language", () => {
		const prompt = composeVideoPrompt({ style: "3d", panels: panels(2), durationSeconds: 10 });
		expect(prompt).toMatch(/Pixar|DreamWorks|3D animated/);
	});

	test("anime style references anime motion language", () => {
		const prompt = composeVideoPrompt({
			style: "anime",
			panels: panels(2),
			durationSeconds: 10,
		});
		expect(prompt).toMatch(/Anime motion|speed lines|sakuga/);
	});

	test("live-action style references film grammar", () => {
		const prompt = composeVideoPrompt({
			style: "live-action",
			panels: panels(2),
			durationSeconds: 10,
		});
		expect(prompt).toMatch(/live-action|Steadicam|film grammar/i);
	});

	test("2D style references hand-drawn animation", () => {
		const prompt = composeVideoPrompt({ style: "2d", panels: panels(2), durationSeconds: 10 });
		expect(prompt).toMatch(/2D animation|hand-drawn|parallax/i);
	});

	test("a custom style string is quoted verbatim into the STYLE block", () => {
		const prompt = composeVideoPrompt({
			style: "claymation stop-motion",
			panels: panels(2),
			durationSeconds: 10,
		});
		expect(prompt).toContain("claymation stop-motion");
	});

	test("character consistency mandate lists the subjects", () => {
		const prompt = composeVideoPrompt({
			style: "3d",
			subjects: [{ name: "Mira", description: "freckled inventor in goggles" }],
			panels: panels(2),
			durationSeconds: 10,
		});
		expect(prompt).toMatch(/CHARACTER CONSISTENCY/);
		expect(prompt).toContain("Mira");
	});

	test("includes a REFERENCE mandate to the storyboard keyframe", () => {
		const prompt = composeVideoPrompt({ style: "3d", panels: panels(2), durationSeconds: 10 });
		expect(prompt).toMatch(/REFERENCE:/);
	});
});
