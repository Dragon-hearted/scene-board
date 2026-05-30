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

### 2026-05-29 — Refactor: Composite Storyboard Sheets via Higgsfield CLI (GPT Image 2) + Two-Phase Output
- **Added by**: build-mode team (`sceneboard-higgsfield`)
- **Change**: Re-architected SceneBoard from "1 scene = 1 individual image via ImageEngine/NanoBanana" to a **two-phase deliverable**: a **Phase 1 composite multi-panel storyboard sheet** (one image per ≤15s block, numbered panels + per-panel timecodes + shot captions baked into a single render) plus a **Phase 2 cinematic video prompt**. Methodology ported from the storyboard-prompt-builder.
- **Image path**: Introduced a **Higgsfield CLI primary → ImageEngine HTTP fallback** provider abstraction. Image model changed to **GPT Image 2** (`gpt_image_2` on Higgsfield; `gpt-image-2`/`gpt-image-1.5` on the ImageEngine fallback) — chosen partly because GPT Image 2 renders legible in-image text (panel numbers, timecodes, captions), unlike the legacy NanoBanana which garbled all text. **ImageEngine stays `active`** in the registry as the fallback transport.
- **Reference sheets**: Generalized the legacy Stage 4.5 6-pose character sheet into a **4-view reference-sheet generator** supporting **two types — character and product** — each rendered on a neutral grey background, fed as reference images into the composite sheet. Reusability is routed by a new `brand_category` field (clothing | product | service) in `client/{client}/brand.md`: clothing → per-storyboard sheets (with garment selection + reuse-vs-new-model prompt); product/service → reusable common sheets.
- **Iterate**: Reworked to a **reference-based panel edit** — pass the approved sheet back to Higgsfield as a reference and regenerate the full sheet (same path on the ImageEngine fallback).
- **Variable panel duration**: Dropped the legacy "1 panel ≈ 1 second" assumption — panels carry timecode ranges that sum to the sheet's ≤15s window; only the ≤15s sum and a grid-sized panel cap are enforced. Videos >15s split into N sheets via `splitIntoSheets()`.
- **`generateAllScenes` retirement decision** (from T6): the per-scene batch path (`src/batch-generator.ts` → `generateAllScenes()` / `regenerateScene()`) is **retired from the active flow**. The file is **kept and marked `@deprecated`** (not deleted) so historical storyboards and callers still compile; it is no longer wired anywhere. The single active orchestration entry is `src/orchestrate.ts` → `orchestrateStoryboard()`. `resolveReferenceImageIds()` in `batch-generator.ts` is superseded by `resolveSheetReferences()` in `src/reference-sheet-generator.ts`. The legacy `src/character-sheet-generator.ts` was renamed to `src/reference-sheet-generator.ts`.
- **New source files**: `src/higgsfield-client.ts`, `src/image-provider.ts`, `src/storyboard-sheet-prompt.ts`, `src/video-prompt.ts`, `src/orchestrate.ts` (+ unit tests).
- **Knowledge**: Updated `domain.md`, `scope.md`, `acceptance-criteria.md`, `dependencies.md`, `index.md`, `history.md`. Added `knowledge/higgsfield-cli.md` and `knowledge/storyboard-prompt-builder.md`. Documented the Higgsfield CLI as an **environment prerequisite** (`npm install -g @higgsfield/cli` + `higgsfield auth login`), NOT a package.json dependency.
- **Registry**: Root `systems.yaml` scene-board entry updated (`stages`, `task_types`, `input_types`, `output_types`). `knowledge/graph.yaml` adds `{ system: "higgsfield", type: "runtime" }` to scene-board `depends_on` and annotates the scene-board↔image-engine relationship as **fallback**. PromptWriter registry adds `gpt-image-2.md`.
- **Recipes**: `justfile` + `package.json` add a `storyboard` (alias `sheet`) recipe running the orchestration entry and a `higgsfield-auth` check recipe.
- **Files modified**: `knowledge/*.md`, `src/*` (see above), `templates/*`, `justfile`, `package.json`, root `systems.yaml`, root `knowledge/graph.yaml`, `.claude/skills/scene-board/*`, `systems/prompt-writer/knowledge/models/image/*`.

## Fix Log
_Entries added by diagnosis workflow._

## Diagnosis Log
_Entries added when system issues are investigated._
