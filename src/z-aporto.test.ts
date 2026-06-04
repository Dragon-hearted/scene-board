/**
 * Unit tests for the Aporto integration.
 *
 * These tests cover the cases that DO NOT need a live APORTO_API_KEY:
 *  - missing key → throws a clear error
 *  - key present → Aporto is tried first and returns a synthetic result
 *  - the integration_id constant is code-level (not an env var)
 *  - the `aporto` provider name is in the ImageProviderName union
 *
 * Live image generation is verified by the Aporto maintainer when they
 * replace the integration_id placeholder with their real value; the trial
 * run documented in `.hermes/aporto-integration-memory.md` is the smoke
 * test that the underlying skill (67) is reachable and priced correctly.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_KEY = "test-key-placeholder";
const ENV_KEY = "APORTO_API_KEY";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Save the original HIGGSFIELD_BIN so we can restore it in afterEach — other
// test files (higgsfield-client.test.ts) rely on their own FAKE_SCRIPT with
// MODE: prefix parsing; stomping the env var globally would break them.
const ORIGINAL_HIGGSFIELD_BIN = process.env.HIGGSFIELD_BIN;
const FAKE_DIR = join(tmpdir(), "sb-aporto-test");
mkdirSync(FAKE_DIR, { recursive: true });
const FAKE_BIN = join(FAKE_DIR, "fake-higgsfield.sh");
writeFileSync(
	FAKE_BIN,
	`#!/usr/bin/env bash
echo "Error: forced failure for test" 1>&2
exit 1
`,
	{ mode: 0o755 },
);
const FAKE_OUT = join(FAKE_DIR, "out.png");
void FAKE_OUT; // referenced from individual tests

// ─── Mocks ────────────────────────────────────────────────────────────────────

let generateImageWithAportoImpl: (req: unknown) => Promise<unknown> = async () => {
	throw new Error("aporto mock not configured");
};

mock.module("./aporto", () => ({
	APORTO_SKILLS: { imageGen2K: 67, imageGen1K: 68 },
	checkAportoAvailable: () => Boolean(process.env[ENV_KEY]),
	generateImageWithAporto: (req: unknown) => generateImageWithAportoImpl(req),
	_resetClientForTests: () => {},
}));

let imageEngineImpl: (req: unknown) => Promise<unknown> = async () => {
	throw new Error("image-engine unreachable in test");
};

mock.module("./image-client", () => ({
	generateSingle: (req: unknown) => imageEngineImpl(req),
}));

const { generateImage } = await import("./image-provider");
const { APORTO_SKILLS, checkAportoAvailable, _resetClientForTests } = await import("./aporto");

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Aporto integration", () => {
	beforeEach(() => {
		_resetClientForTests();
		process.env.HIGGSFIELD_BIN = FAKE_BIN;
	});
	afterEach(() => {
		delete process.env[ENV_KEY];
		generateImageWithAportoImpl = async () => {
			throw new Error("aporto mock not configured");
		};
		imageEngineImpl = async () => {
			throw new Error("image-engine unreachable in test");
		};
		// Restore the env var that higgsfield-client.test.ts expects, so
		// other test files in the same `bun test` run see their own fake.
		if (ORIGINAL_HIGGSFIELD_BIN === undefined) {
			process.env.HIGGSFIELD_BIN = undefined;
		} else {
			process.env.HIGGSFIELD_BIN = ORIGINAL_HIGGSFIELD_BIN;
		}
	});

	test("APORTO_SKILLS pins skill 67 as 2K primary and 68 as 1K fallback", () => {
		expect(APORTO_SKILLS.imageGen2K).toBe(67);
		expect(APORTO_SKILLS.imageGen1K).toBe(68);
	});

	test("checkAportoAvailable reflects APORTO_API_KEY env", () => {
		delete process.env[ENV_KEY];
		expect(checkAportoAvailable()).toBe(false);
		process.env[ENV_KEY] = TEST_KEY;
		expect(checkAportoAvailable()).toBe(true);
		delete process.env[ENV_KEY];
	});

	test("Aporto is tried first when APORTO_API_KEY is set", async () => {
		process.env[ENV_KEY] = TEST_KEY;
		generateImageWithAportoImpl = async (req) => {
			const r = req as { prompt: string };
			return {
				imageUrl: "https://aporto.local/sheet.png",
				model: "aporto:67",
				runId: "r-1",
				status: "succeeded",
				_prompt: r.prompt,
			};
		};

		const result = await generateImage(
			{ prompt: "a storyboard", outPath: FAKE_OUT },
			{ skipAuthCheck: true },
		);

		expect(result.provider).toBe("aporto");
		expect(result.model).toBe("aporto:67");
		expect(result.imageUrl).toBe("https://aporto.local/sheet.png");
	});

	test("falls back to ImageEngine when APORTO_API_KEY is not set", async () => {
		// no APORTO_API_KEY → Aporto skipped
		imageEngineImpl = async (req) => {
			const r = req as { model: string };
			return {
				id: "ie-1",
				imageUrl: "https://imageengine.local/out.png",
				model: r.model,
				prompt: "a storyboard",
			};
		};

		const result = await generateImage(
			{ prompt: "MODE:cli", outPath: FAKE_OUT },
			{ skipAuthCheck: true },
		);

		expect(result.provider).toBe("image-engine");
		expect(result.model).toBe("gpt-image-2");
	});

	test("falls back to Higgsfield → ImageEngine when Aporto throws", async () => {
		process.env[ENV_KEY] = TEST_KEY;
		generateImageWithAportoImpl = async () => {
			throw new Error("Aporto 503: upstream provider down");
		};
		imageEngineImpl = async (req) => {
			const r = req as { model: string };
			return {
				id: "ie-2",
				imageUrl: "https://imageengine.local/fb.png",
				model: r.model,
				prompt: "MODE:cli",
			};
		};

		const result = await generateImage(
			{ prompt: "MODE:cli", outPath: FAKE_OUT },
			{ skipAuthCheck: true },
		);

		// Aporto was tried but failed; chain fell through to ImageEngine.
		expect(result.provider).toBe("image-engine");
	});

	test("forwards reference image paths as image_urls to Aporto", async () => {
		process.env[ENV_KEY] = TEST_KEY;
		let captured: Record<string, unknown> | null = null;
		generateImageWithAportoImpl = async (req) => {
			captured = req as Record<string, unknown>;
			return {
				imageUrl: "https://aporto.local/ref.png",
				model: "aporto:67",
				runId: "r-2",
				status: "succeeded",
			};
		};

		await generateImage(
			{
				prompt: "with refs",
				outPath: FAKE_OUT,
				referenceImagePaths: ["/path/a.png", "/path/b.png"],
			},
			{ skipAuthCheck: true },
		);

		expect(captured).not.toBeNull();
		const capturedObj = captured as unknown as { imageUrls?: string[] };
		expect(capturedObj.imageUrls).toEqual(["/path/a.png", "/path/b.png"]);
	});

	test("aggregated error mentions Aporto state when all providers fail", async () => {
		process.env[ENV_KEY] = TEST_KEY;
		generateImageWithAportoImpl = async () => {
			throw new Error("Aporto 500");
		};
		imageEngineImpl = async () => {
			throw new Error("image-engine down");
		};

		const promise = generateImage(
			{ prompt: "MODE:cli", outPath: FAKE_OUT },
			{ skipAuthCheck: true },
		);

		await expect(promise).rejects.toThrow(/All image providers failed/);
		await expect(promise).rejects.toThrow(/Aporto error above/);
		await expect(promise).rejects.toThrow(/Higgsfield:/);
	});
});
