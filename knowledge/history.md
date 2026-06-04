---
system: "scene-board"
type: history
version: 2
lastUpdated: "2026-05-29"
lastUpdatedBy: builder-knowledge
---

# History — SceneBoard

## Build Log

### 2026-03-26 — Initial Build
- **Built by**: build-mode
- **Knowledge captured**: Domain knowledge, scope, acceptance criteria, dependencies, and stage definitions for the CLI-driven storyboard creation workflow
- **Acceptance criteria**: See acceptance-criteria.md
- **Validation**: Project scaffolded and dependencies installed; no test suite at scaffolding stage — bun test exits cleanly with 0 test files found (expected)

### 2026-03-30 — Feature: Kling Video Prompts
- **Added by**: diagnose-mode (feature addition)
- **Change**: Added Kling image-to-video prompt generation to the storyboard pipeline
- **Scope**: Each scene now generates a Kling video prompt alongside the NanoBanana Pro image prompt. Kling takes the NanoBanana still as an anchor frame and the prompt describes motion, camera movement, and animation direction.
- **Files modified**: domain.md, scope.md, dependencies.md, acceptance-criteria.md, index.md, storyboard-template.md, history.md
- **New files**: `_bmad/wds/workflows/4-ux-design/data/guides/KLING-VIDEO-PROMPT-GUIDE.md`

### 2026-05-29 — Refactor: Composite Storyboard Sheets via a GPT Image 2 CLI provider + Two-Phase Output
- **Added by**: build-mode team
- **Change**: Re-architected SceneBoard from "1 scene = 1 individual image via ImageEngine/NanoBanana" to a **two-phase deliverable**: a **Phase 1 composite multi-panel storyboard sheet** (one image per ≤15s block, numbered panels + per-panel timecodes + shot captions baked into a single render) plus a **Phase 2 cinematic video prompt**. Methodology ported from the storyboard-prompt-builder.
- **Image path**: Introduced a **dedicated GPT Image 2 CLI provider (primary) → ImageEngine HTTP (fallback)** provider abstraction. Image model changed to **GPT Image 2** — chosen partly because GPT Image 2 renders legible in-image text (panel numbers, timecodes, captions), unlike the legacy NanoBanana which garbled all text. **ImageEngine stays `active`** in the registry as the fallback transport. _(Superseded 2026-06-04 — see below — the CLI provider was removed and consolidated into ImageEngine as its default provider.)_
- **Reference sheets**: Generalized the legacy Stage 4.5 6-pose character sheet into a **4-view reference-sheet generator** supporting **two types — character and product** — each rendered on a neutral grey background, fed as reference images into the composite sheet. Reusability is routed by a new `brand_category` field (clothing | product | service) in `client/{client}/brand.md`: clothing → per-storyboard sheets (with garment selection + reuse-vs-new-model prompt); product/service → reusable common sheets.
- **Iterate**: Reworked to a **reference-based panel edit** — pass the approved sheet back as a reference and regenerate the full sheet.
- **Variable panel duration**: Dropped the legacy "1 panel ≈ 1 second" assumption — panels carry timecode ranges that sum to the sheet's ≤15s window; only the ≤15s sum and a grid-sized panel cap are enforced. Videos >15s split into N sheets via `splitIntoSheets()`. _(Superseded 2026-06-04 — panels are now short shots of ≤2s, defaulting to ~1s.)_
- **`generateAllScenes` retirement decision** (from T6): the per-scene batch path (`src/batch-generator.ts` → `generateAllScenes()` / `regenerateScene()`) is **retired from the active flow**. The file is **kept and marked `@deprecated`** (not deleted) so historical storyboards and callers still compile; it is no longer wired anywhere. The single active orchestration entry is `src/orchestrate.ts` → `orchestrateStoryboard()`. `resolveReferenceImageIds()` in `batch-generator.ts` is superseded by `resolveSheetReferences()` in `src/reference-sheet-generator.ts`. The legacy `src/character-sheet-generator.ts` was renamed to `src/reference-sheet-generator.ts`.
- **New source files**: the dedicated image-CLI client (since removed), `src/image-provider.ts`, `src/storyboard-sheet-prompt.ts`, `src/video-prompt.ts`, `src/orchestrate.ts` (+ unit tests).
- **Knowledge**: Updated `domain.md`, `scope.md`, `acceptance-criteria.md`, `dependencies.md`, `index.md`, `history.md`. Added the image-CLI surface doc (since removed) and `knowledge/storyboard-prompt-builder.md`. Documented the image CLI as an **environment prerequisite**, NOT a package.json dependency.
- **Registry**: Root `systems.yaml` scene-board entry updated (`stages`, `task_types`, `input_types`, `output_types`). PromptWriter registry adds `gpt-image-2.md`.
- **Recipes**: `justfile` + `package.json` add a `storyboard` (alias `sheet`) recipe running the orchestration entry and an image-CLI auth check recipe.
- **Files modified**: `knowledge/*.md`, `src/*` (see above), `templates/*`, `justfile`, `package.json`, root `systems.yaml`, root `knowledge/graph.yaml`, `.claude/skills/scene-board/*`, `systems/prompt-writer/knowledge/models/image/*`.

### 2026-06-04 — Three fixes: text-free scenes, short panels (≤2s), and ImageEngine-only image path
- **Added by**: build-mode team (`adcelerate-fixes`), branch `feat/storyboard-textfree-shortpanels-imageengine`
- **Fix 1 — Text-free shot content**: The Phase 1 composer (`src/storyboard-sheet-prompt.ts`) now instructs that the imagery INSIDE each panel frame must contain no words, captions, subtitles, signage, on-screen UI text, watermarks, labels, or lettering — the only permitted in-frame text/graphic is the brand logo and supplied brand assets. The instruction (woven into `buildLayoutDetails`, `buildArtDirectionFooter`, and `buildRenderFooter`) explicitly preserves the storyboard's OWN presentation chrome (panel-number badge, top-right timecode label, one-line caption beneath each frame).
- **Fix 2 — Short panels (≤2s, default ~1s)**: Added `MAX_PANEL_SECONDS = 2` and `DEFAULT_PANEL_SECONDS = 1`. `resolveDurations` now defaults a beat WITHOUT an explicit duration to 1s (no more even-distribution math) and clamps an explicit duration to (0, 2]s; `validateSheet` flags any panel > 2s. The top-of-file invariants and the layout/render prose were reversed from the old "variable duration / not 1 panel ≈ 1 second" wording to "each panel is a short shot of ≤2s, typically 1s" (sheet still ≤15s).
- **Fix 3 — ImageEngine-only image path**: Removed the dedicated image-CLI provider from SceneBoard. `src/image-provider.ts` now calls ONLY the ImageEngine HTTP client with NO `model` (so ImageEngine serves its new default GPT Image 2 provider), then downloads the result via `getImage(id)` and writes it to `outPath`; it returns `{ localPath, imageUrl, model, provider: "image-engine", imageId }`. Dropped `skipAuthCheck`, `referenceImagePaths`, the aspect-mapping helper, and the FALLBACK_* model constants. `ImageProviderName` is now just `"image-engine"`.
- **Removed files**: the dedicated image-CLI client + its test, and the image-CLI surface knowledge doc. The `package.json` image-CLI auth script was also removed.
- **Plumbing**: `src/orchestrate.ts` dropped the now-removed provider-cap, `skipAuthCheck`, and `referenceImagePaths` knobs from `StoryboardOrchestrationInput` and the `generateImage` call (keeps `referenceImageIds`). `src/reference-sheet-generator.ts` dropped the local-path/cap plumbing — `ResolvedSheetReferences` now exposes `referenceImageIds` only, reference sheets always carry a gallery `imageId`, and they chain cleanly as `referenceImageIds` (matching the image-engine quirk that ids resolve against the IMAGES table).
- **Tests**: `storyboard-sheet-prompt.test.ts` updated for the 1s default, the >2s `validateSheet` failure, and the text-free / chrome assertions; `image-provider.test.ts` rewritten to mock `generateSingle` + `getImage` and assert the ImageEngine download-to-`outPath` path; `reference-sheet.test.ts` updated to the id-only resolver.
- **Docs**: Scrubbed the removed provider from `README.md`, `knowledge/{index,scope,dependencies,domain,acceptance-criteria}.md`, `knowledge/usage.yaml`, `knowledge/storyboard-prompt-builder.md`, and `templates/*`, reworded to "ImageEngine (GPT Image 2 is its default provider)".
- **Validation**: `bunx tsc --noEmit` clean; `bun test` green.

## Fix Log
_Entries added by diagnosis workflow._

## Diagnosis Log
_Entries added when system issues are investigated._

## Execution Log
_Entries added by Execute Mode delivery._

### 2026-06-04 — Delivered: Quddle 15s Meta UGC storyboard ("The Last Swipe")
- **System**: SceneBoard · **Mode**: Execute (fully autonomous, engineer-approved final delivery)
- **Task**: 15s / 9:16 Meta (Reels/Stories) app-install UGC storyboard for new client Quddle (AI social/connection app); supplied 4-view reference (`quddle.png`) locked as the on-screen face.
- **Pipeline**: brand research (workflow) → 3-way concept judge panel → script + scene breakdown → composite sheet via the GPT Image 2 CLI provider (9:16, 2k) → markdown + Phase 2 video prompt + PDF.
- **Output**: `client/quddle/storyboards/meta-15s-ugc-v1/` → `storyboard-sheet-1.png`, `the-last-swipe-v1.md`, `the-last-swipe-v1.pdf`, `result.json`; brand profile at `client/quddle/brand.md`.
- **Validation**: output hard gates PASS; soft criteria self-assessed strong (no fresh-context validator run).
- **Provider note / bug found**: the image-CLI client's `extractImageUrl()` returned the LAST URL in the `--wait --json` job object, which is the uploaded INPUT reference (`params.medias[].data.url`) rather than the generated output (`result_url`). With a reference image attached this downloaded the input verbatim. Worked around by downloading `$[0].result_url` directly. _(Moot as of 2026-06-04 — image generation now goes through ImageEngine, which returns the output URL directly.)_
- **Generation helper**: `_drivers/quddle-driver.ts` (untracked) — thin bun driver over `composeStoryboardSheets` + `generateImage` + `composeVideoPrompt`.
