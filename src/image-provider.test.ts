/**
 * Unit tests for the image-provider façade — now ImageEngine-only.
 *
 * SceneBoard talks solely to ImageEngine over HTTP: `generateSingle` (with NO
 * `model`, so ImageEngine serves its default provider) returns a gallery record,
 * then `getImage(id)` is downloaded and written to the caller's `outPath`. Both
 * are mocked from `./image-client` so no live server is needed.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WORK_DIR = join(tmpdir(), "sb-image-provider-test");

// Mutable stubs the mocked image-client delegates to (set per test).
type GenSingle = (req: Record<string, unknown>) => Promise<Record<string, unknown>>;
let generateSingleImpl: GenSingle = async (req) => ({
	id: "img_default",
	imageUrl: "https://imageengine.local/out.png",
	model: "gpt-image-2",
	prompt: req.prompt,
});
const generateSingleCalls: Array<Record<string, unknown>> = [];

let getImageImpl: (id: string) => Promise<Buffer> = async () => Buffer.from("PNGDATA");
const getImageCalls: string[] = [];

mock.module("./image-client", () => ({
	generateSingle: (req: Record<string, unknown>) => {
		generateSingleCalls.push(req);
		return generateSingleImpl(req);
	},
	getImage: (id: string) => {
		getImageCalls.push(id);
		return getImageImpl(id);
	},
}));

const { generateImage } = await import("./image-provider");

describe("image-provider (ImageEngine-only)", () => {
	beforeEach(() => {
		mkdirSync(WORK_DIR, { recursive: true });
		generateSingleCalls.length = 0;
		getImageCalls.length = 0;
	});

	afterEach(() => {
		generateSingleImpl = async (req) => ({
			id: "img_default",
			imageUrl: "https://imageengine.local/out.png",
			model: "gpt-image-2",
			prompt: req.prompt,
		});
		getImageImpl = async () => Buffer.from("PNGDATA");
		rmSync(WORK_DIR, { recursive: true, force: true });
	});

	test("generates via ImageEngine and downloads the result to outPath", async () => {
		getImageImpl = async () => Buffer.from("SHEETBYTES");
		const outPath = join(WORK_DIR, "nested", "sheet.png");

		const result = await generateImage({ prompt: "a clean storyboard", outPath });

		expect(result.provider).toBe("image-engine");
		expect(result.localPath).toBe(outPath);
		expect(result.imageUrl).toBe("https://imageengine.local/out.png");
		expect(result.model).toBe("gpt-image-2");
		expect(result.imageId).toBe("img_default");
		// The gallery image was downloaded by id and written to outPath.
		expect(getImageCalls).toEqual(["img_default"]);
		expect(readFileSync(outPath).toString()).toBe("SHEETBYTES");
	});

	test("omits `model` and forces an image so ImageEngine serves its default provider", async () => {
		await generateImage({ prompt: "p", outPath: join(WORK_DIR, "o.png") });

		expect(generateSingleCalls).toHaveLength(1);
		expect(generateSingleCalls[0].model).toBeUndefined();
		expect(generateSingleCalls[0].forceImage).toBe(true);
		expect(generateSingleCalls[0].aspectRatio).toBe("16:9");
		expect(generateSingleCalls[0].openaiQuality).toBe("high");
	});

	test("forwards referenceImageIds, systemInstruction, and id→sceneId", async () => {
		await generateImage({
			prompt: "p",
			outPath: join(WORK_DIR, "o.png"),
			aspectRatio: "9:16",
			quality: "medium",
			referenceImageIds: ["ref-a", "ref-b"],
			systemInstruction: "stay consistent",
			id: "sheet-1",
		});

		const call = generateSingleCalls[0];
		expect(call.referenceImageIds).toEqual(["ref-a", "ref-b"]);
		expect(call.systemInstruction).toBe("stay consistent");
		expect(call.sceneId).toBe("sheet-1");
		expect(call.aspectRatio).toBe("9:16");
		expect(call.openaiQuality).toBe("medium");
	});

	test("does NOT send referenceImageIds when none are supplied", async () => {
		await generateImage({ prompt: "p", outPath: join(WORK_DIR, "o.png") });
		expect(generateSingleCalls[0].referenceImageIds).toBeUndefined();
		expect(generateSingleCalls[0].systemInstruction).toBeUndefined();
		expect(generateSingleCalls[0].sceneId).toBeUndefined();
	});

	test("propagates an ImageEngine failure", async () => {
		generateSingleImpl = async () => {
			throw new Error("image-engine unavailable");
		};
		await expect(generateImage({ prompt: "p", outPath: join(WORK_DIR, "o.png") })).rejects.toThrow(
			/image-engine unavailable/,
		);
	});
});
