/**
 * Unit tests for the image-provider façade — focused on the FALLBACK trigger:
 * when Higgsfield (primary) fails, the request must fall back to the ImageEngine
 * HTTP client.
 *
 * We point `HIGGSFIELD_BIN` at a fake binary that always exits non-zero (so the
 * Higgsfield path always throws) and mock `./image-client` so the ImageEngine
 * leg is observable without a live server. `skipAuthCheck` bypasses the auth
 * probe so the spawn path is exercised directly.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Fake higgsfield binary. Shares the SAME path + mode-aware script as
// higgsfield-client.test.ts so behaviour is identical regardless of which test
// file evaluates higgsfield-client (and captures the module-level BINARY)
// first. The provider tests pass a "MODE:cli" prompt to force a deterministic,
// network-free Higgsfield failure so the ImageEngine fallback is exercised.
const FAKE_SCRIPT = [
	"#!/usr/bin/env bash",
	"mode=success",
	'for a in "$@"; do',
	'  case "$a" in',
	'    MODE:*) mode="${a#MODE:}" ;;',
	"  esac",
	"done",
	'case "$mode" in',
	'  auth) echo "Error: session expired, please log in" 1>&2; exit 1 ;;',
	'  timeout) echo "Error: wait timeout exceeded before job finished" 1>&2; exit 1 ;;',
	'  cli) echo "Error: something broke internally" 1>&2; exit 1 ;;',
	'  badjson) echo "this is not json" ;;',
	'  nourl) echo "[{\\"id\\":\\"job1\\",\\"results\\":[{\\"status\\":\\"done\\"}]}]" ;;',
	'  success) echo "[{\\"id\\":\\"job1\\",\\"results\\":[{\\"url\\":\\"https://example.com/sheet.png\\"}]}]" ;;',
	"esac",
	"",
].join("\n");

const FAKE_DIR = join(tmpdir(), "sb-higgsfield-client-test");
mkdirSync(FAKE_DIR, { recursive: true });
const FAKE_BIN = join(FAKE_DIR, "fake-higgsfield.sh");
writeFileSync(FAKE_BIN, FAKE_SCRIPT, { mode: 0o755 });
process.env.HIGGSFIELD_BIN = FAKE_BIN;

// Mutable stub the mocked image-client delegates to (set per test).
type GenSingle = (req: Record<string, unknown>) => Promise<Record<string, unknown>>;
let generateSingleImpl: GenSingle = async () => {
	throw new Error("image-engine unavailable");
};
const generateSingleCalls: Array<Record<string, unknown>> = [];

mock.module("./image-client", () => ({
	generateSingle: (req: Record<string, unknown>) => {
		generateSingleCalls.push(req);
		return generateSingleImpl(req);
	},
}));

const { generateImage } = await import("./image-provider");

describe("image-provider fallback", () => {
	beforeEach(() => {
		generateSingleCalls.length = 0;
	});

	afterEach(() => {
		generateSingleImpl = async () => {
			throw new Error("image-engine unavailable");
		};
	});

	test("falls back to ImageEngine (gpt-image-2) when Higgsfield fails", async () => {
		generateSingleImpl = async (req) => ({
			id: "img_1",
			imageUrl: "https://imageengine.local/out.png",
			model: req.model,
			prompt: req.prompt,
		});

		const result = await generateImage(
			{ prompt: "MODE:cli", outPath: join(FAKE_DIR, "o.png") },
			{ skipAuthCheck: true },
		);

		expect(result.provider).toBe("image-engine");
		expect(result.model).toBe("gpt-image-2");
		expect(result.imageUrl).toBe("https://imageengine.local/out.png");
		expect(generateSingleCalls).toHaveLength(1);
		expect(generateSingleCalls[0].forceImage).toBe(true);
	});

	test("retries ImageEngine with gpt-image-1.5 when gpt-image-2 fails", async () => {
		generateSingleImpl = async (req) => {
			if (req.model === "gpt-image-2") throw new Error("primary model down");
			return {
				id: "img_2",
				imageUrl: "https://imageengine.local/fallback.png",
				model: req.model,
				prompt: req.prompt,
			};
		};

		const result = await generateImage(
			{ prompt: "MODE:cli", outPath: join(FAKE_DIR, "o.png") },
			{ skipAuthCheck: true },
		);

		expect(result.provider).toBe("image-engine");
		expect(result.model).toBe("gpt-image-1.5");
		expect(generateSingleCalls.map((c) => c.model)).toEqual(["gpt-image-2", "gpt-image-1.5"]);
	});

	test("forwards referenceImageIds and systemInstruction to ImageEngine", async () => {
		generateSingleImpl = async (req) => ({
			id: "img_3",
			imageUrl: "https://imageengine.local/ref.png",
			model: req.model,
			prompt: req.prompt,
		});

		await generateImage(
			{
				prompt: "MODE:cli",
				outPath: join(FAKE_DIR, "o.png"),
				referenceImageIds: ["ref-a", "ref-b"],
				systemInstruction: "stay consistent",
			},
			{ skipAuthCheck: true },
		);

		expect(generateSingleCalls[0].referenceImageIds).toEqual(["ref-a", "ref-b"]);
		expect(generateSingleCalls[0].systemInstruction).toBe("stay consistent");
	});

	test("throws an aggregated error naming all providers when everything fails", async () => {
		generateSingleImpl = async () => {
			throw new Error("image-engine totally down");
		};

		const promise = generateImage(
			{ prompt: "MODE:cli", outPath: join(FAKE_DIR, "o.png") },
			{ skipAuthCheck: true },
		);

		await expect(promise).rejects.toThrow(/All image providers failed/);
		await expect(promise).rejects.toThrow(/Higgsfield:/);
		await expect(promise).rejects.toThrow(/ImageEngine gpt-image-2/);
		await expect(promise).rejects.toThrow(/ImageEngine gpt-image-1.5/);
		// Both ImageEngine models were attempted.
		expect(generateSingleCalls.map((c) => c.model)).toEqual(["gpt-image-2", "gpt-image-1.5"]);
	});
});
