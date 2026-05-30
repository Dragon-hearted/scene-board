/**
 * Unit tests for the reference-sheet generator's PURE surface:
 *  - character vs product template selection
 *  - 4-view layout text + neutral-grey-background presentation
 *  - `[INSERT DESIRED STYLE]` / `[DESCRIBE CHARACTER AND CLOTHING]` substitution
 *  - brand_category routing (clothing → per-storyboard path; product → reusable)
 *  - the clothing reuse-vs-new-model branch
 *  - `readBrandCategory` parsing + reference resolution / capping
 *
 * No image generation is exercised here (that path is covered by the
 * image-provider fallback tests); these are all pure / fs-read functions.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	HIGGSFIELD_REF_CAP,
	IMAGE_ENGINE_REF_CAP,
	type ReferenceSheet,
	type ReferenceSubject,
	composeCharacterSheetPrompt,
	composeProductSheetPrompt,
	composeReferenceSheetPrompt,
	readBrandCategory,
	resolveSheetDir,
	resolveSheetReferences,
} from "./reference-sheet-generator";

function charSubject(over: Partial<ReferenceSubject> = {}): ReferenceSubject {
	return {
		slug: over.slug ?? "mira",
		name: over.name ?? "Mira",
		type: "character",
		lockedDescription: over.lockedDescription ?? "a freckled 9-year-old inventor in brass goggles",
		...(over.garments !== undefined && { garments: over.garments }),
		...(over.referenceImagePaths !== undefined && {
			referenceImagePaths: over.referenceImagePaths,
		}),
		...(over.reuseModelIdentity !== undefined && { reuseModelIdentity: over.reuseModelIdentity }),
		...(over.appearanceCount !== undefined && { appearanceCount: over.appearanceCount }),
	};
}

function productSubject(over: Partial<ReferenceSubject> = {}): ReferenceSubject {
	return {
		slug: over.slug ?? "fizz-can",
		name: over.name ?? "Fizz Cola Can",
		type: "product",
		lockedDescription: over.lockedDescription ?? "a 330ml aluminium can with a red wave logo",
		...(over.appearanceCount !== undefined && { appearanceCount: over.appearanceCount }),
	};
}

// ─── Template selection ───────────────────────────────────────────────────────

describe("composeReferenceSheetPrompt template selection", () => {
	test("selects the CHARACTER template for character subjects", () => {
		const prompt = composeReferenceSheetPrompt(charSubject(), "watercolour storybook style");
		expect(prompt).toContain("CHARACTER REFERENCE SHEET");
		expect(prompt).not.toContain("PRODUCT REFERENCE SHEET");
	});

	test("selects the PRODUCT template for product subjects", () => {
		const prompt = composeReferenceSheetPrompt(productSubject(), "watercolour storybook style");
		expect(prompt).toContain("PRODUCT REFERENCE SHEET");
		expect(prompt).toMatch(/photorealistic product photography/i);
	});
});

// ─── 4-view layout text ───────────────────────────────────────────────────────

describe("4-view layout text", () => {
	test("character sheet renders four named views on a neutral grey background", () => {
		const prompt = composeCharacterSheetPrompt(charSubject(), "3D Pixar style");
		expect(prompt).toContain("four views on a neutral grey background");
		expect(prompt).toContain("[VIEW 1 — FULL BODY, FRONT]");
		expect(prompt).toContain("[VIEW 2 — FULL BODY, REAR]");
		expect(prompt).toContain("[VIEW 3 — FRONT CLOSE-UP]");
		expect(prompt).toContain("[VIEW 4 — PROFILE CLOSE-UP]");
	});

	test("product sheet renders its four named views", () => {
		const prompt = composeProductSheetPrompt(productSubject());
		expect(prompt).toContain("four views on a neutral grey background");
		expect(prompt).toContain("[VIEW 1 — FRONT, THREE-QUARTER]");
		expect(prompt).toContain("[VIEW 2 — REAR, STRAIGHT-ON]");
		expect(prompt).toContain("[VIEW 3 — FRONT CLOSE-UP]");
		expect(prompt).toContain("[VIEW 4 — PROFILE, LEFT SIDE]");
	});
});

// ─── Placeholder substitution ─────────────────────────────────────────────────

describe("placeholder substitution", () => {
	test("fills [INSERT DESIRED STYLE] from the style anchor with no literal placeholder left", () => {
		const prompt = composeCharacterSheetPrompt(charSubject(), "moody neo-noir comic style");
		expect(prompt).toContain("moody neo-noir comic style");
		expect(prompt).not.toContain("[INSERT DESIRED STYLE]");
	});

	test("fills [DESCRIBE CHARACTER AND CLOTHING] from the locked description", () => {
		const prompt = composeCharacterSheetPrompt(charSubject(), "any style");
		expect(prompt).toContain("a freckled 9-year-old inventor in brass goggles");
		expect(prompt).not.toContain("[DESCRIBE CHARACTER AND CLOTHING]");
	});

	test("folds selected garments into the clothing slot", () => {
		const prompt = composeCharacterSheetPrompt(
			charSubject({ garments: ["the Aero hoodie", "cargo joggers"] }),
			"any style",
		);
		expect(prompt).toContain("wearing the Aero hoodie, cargo joggers");
	});

	test("falls back to a default style label when the anchor is empty", () => {
		const prompt = composeCharacterSheetPrompt(charSubject(), "   ");
		expect(prompt).toContain("the established project style");
	});
});

// ─── Clothing reuse-vs-new-model branch ───────────────────────────────────────

describe("clothing reuse-vs-new-model branch", () => {
	test("reuseModelIdentity adds the preserve-identity instruction", () => {
		const prompt = composeCharacterSheetPrompt(
			charSubject({ reuseModelIdentity: true, garments: ["the Aero hoodie"] }),
			"any style",
		);
		expect(prompt).toContain("SAME established model identity");
		expect(prompt).toMatch(/only change the outfit/i);
	});

	test("a new-model sheet omits the preserve-identity instruction", () => {
		const prompt = composeCharacterSheetPrompt(
			charSubject({ reuseModelIdentity: false, garments: ["the Aero hoodie"] }),
			"any style",
		);
		expect(prompt).not.toContain("SAME established model identity");
	});
});

// ─── brand_category routing ───────────────────────────────────────────────────

describe("resolveSheetDir (brand_category routing)", () => {
	test("clothing → per-storyboard references path", () => {
		const dir = resolveSheetDir({
			client: "acme",
			project: "spring-launch",
			brandCategory: "clothing",
			slug: "mira",
		});
		expect(dir).toBe(join("client", "acme", "storyboards", "spring-launch", "references", "mira"));
	});

	test("product → reusable common references path (no storyboard segment)", () => {
		const dir = resolveSheetDir({
			client: "acme",
			brandCategory: "product",
			slug: "fizz-can",
		});
		expect(dir).toBe(join("client", "acme", "references", "fizz-can"));
		expect(dir).not.toContain("storyboards");
	});

	test("service → reusable common references path", () => {
		const dir = resolveSheetDir({ client: "acme", brandCategory: "service", slug: "logo" });
		expect(dir).toBe(join("client", "acme", "references", "logo"));
	});

	test("clothing without a project throws", () => {
		expect(() =>
			resolveSheetDir({ client: "acme", brandCategory: "clothing", slug: "mira" }),
		).toThrow(/requires a `project`/);
	});

	test("honours a custom client root", () => {
		const dir = resolveSheetDir({
			clientRoot: "data/clients",
			client: "acme",
			brandCategory: "product",
			slug: "x",
		});
		expect(dir).toBe(join("data/clients", "acme", "references", "x"));
	});
});

// ─── readBrandCategory ────────────────────────────────────────────────────────

describe("readBrandCategory", () => {
	const dir = mkdtempSync(join(tmpdir(), "sb-brand-"));

	function writeBrand(name: string, body: string): string {
		const path = join(dir, name);
		writeFileSync(path, body);
		return path;
	}

	test("parses YAML-frontmatter style brand_category", async () => {
		const path = writeBrand("a.md", "---\nbrand_category: clothing\n---\n# Brand\n");
		expect(await readBrandCategory(path)).toBe("clothing");
	});

	test("parses a markdown-line style brand category", async () => {
		const path = writeBrand("b.md", "Brand Category: product\n");
		expect(await readBrandCategory(path)).toBe("product");
	});

	test("normalises apparel → clothing", async () => {
		const path = writeBrand("c.md", "brand_category = apparel\n");
		expect(await readBrandCategory(path)).toBe("clothing");
	});

	test("returns undefined when the field is absent", async () => {
		const path = writeBrand("d.md", "# Just a brand doc\n");
		expect(await readBrandCategory(path)).toBeUndefined();
	});

	test("returns undefined when the file does not exist", async () => {
		expect(await readBrandCategory(join(dir, "nope.md"))).toBeUndefined();
	});
});

// ─── Composite-sheet reference resolution ─────────────────────────────────────

describe("resolveSheetReferences", () => {
	function sheet(over: Partial<ReferenceSheet>): ReferenceSheet {
		return {
			slug: over.slug ?? "s",
			name: over.name ?? "S",
			type: over.type ?? "character",
			prompt: "p",
			imageUrl: over.imageUrl ?? "https://x/img.png",
			model: "gpt_image_2",
			provider: over.provider ?? "higgsfield",
			appearanceCount: over.appearanceCount ?? 0,
			...(over.localPath !== undefined && { localPath: over.localPath }),
			...(over.imageId !== undefined && { imageId: over.imageId }),
		};
	}

	test("collects local paths and image ids from all sheets", () => {
		const refs = resolveSheetReferences([
			sheet({ slug: "a", localPath: "/a.png", imageId: "id-a" }),
			sheet({ slug: "b", localPath: "/b.png", imageId: "id-b" }),
		]);
		expect(refs.referenceImagePaths).toEqual(["/a.png", "/b.png"]);
		expect(refs.referenceImageIds).toEqual(["id-a", "id-b"]);
	});

	test("prioritises higher appearanceCount, then input order on ties", () => {
		const refs = resolveSheetReferences([
			sheet({ slug: "low", localPath: "/low.png", appearanceCount: 1 }),
			sheet({ slug: "high", localPath: "/high.png", appearanceCount: 9 }),
			sheet({ slug: "mid", localPath: "/mid.png", appearanceCount: 5 }),
		]);
		expect(refs.referenceImagePaths).toEqual(["/high.png", "/mid.png", "/low.png"]);
	});

	test("caps Higgsfield paths at the provider limit, prioritising by appearance", () => {
		const many = Array.from({ length: HIGGSFIELD_REF_CAP + 4 }, (_, i) =>
			sheet({ slug: `s${i}`, localPath: `/s${i}.png`, appearanceCount: i }),
		);
		const refs = resolveSheetReferences(many);
		expect(refs.referenceImagePaths).toHaveLength(HIGGSFIELD_REF_CAP);
		// Highest appearanceCount wins the first slot.
		expect(refs.referenceImagePaths[0]).toBe(`/s${many.length - 1}.png`);
	});

	test("caps ImageEngine ids at its (smaller) limit", () => {
		const many = Array.from({ length: IMAGE_ENGINE_REF_CAP + 3 }, (_, i) =>
			sheet({ slug: `s${i}`, imageId: `id-${i}`, appearanceCount: i }),
		);
		const refs = resolveSheetReferences(many);
		expect(refs.referenceImageIds).toHaveLength(IMAGE_ENGINE_REF_CAP);
	});
});
