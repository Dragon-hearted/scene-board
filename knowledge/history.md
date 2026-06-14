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

### 2026-06-04 — Delivered: Quddle 15s Meta UGC app-install storyboard ("Watch · Connect · Earn")
- **System**: SceneBoard · **Mode**: Execute (fully autonomous, engineer-approved final delivery) · routed via `/adcelerate-execute` (skill driver, delegate).
- **Task**: 15s / 9:16 Meta Reels UGC **app-install** storyboard for new client Quddle. No brief/brand provided — gathered brand via web research (quddle.ai is JS-only; LinkedIn company page = "Stream.Shop.Shine / AI marketplace"). Engineer confirmed positioning **Watch + Connect + Earn**, UGC selfie presenter, full autonomy. Supplied 4-view reference (`quddle.png`) locked as on-screen face.
- **Pipeline**: brand research + AskUserQuestion (angle/autonomy/presenter) → new client profile (`brand.md` + knowledge/) → script (hook→Watch→Connect→Earn→CTA) → 9-panel breakdown (3×3, sums to 15s) → composite sheet via **Higgsfield CLI `gpt_image_2`** (9:16, 2k, high; reference attached) → markdown + Phase 2 cinematic prompt → PDF.
- **Output**: `client/quddle/storyboards/quddle-meta-install-15s/` → `sheet-1.png`, `quddle-meta-install-15s-v1.md`, `quddle-meta-install-15s-v1.pdf`, `phase1-prompt.txt`, `result.json`, `references/quddle-creator-reference.png`; brand profile at `client/quddle/brand.md`.
- **Validation**: hard gates PASS (4 engineer-authorized deviations: gates waived, single-option, Higgsfield-direct, in-frame UGC captions). Fresh-context `adcelerate-validator` run = **APPROVE WITH NOTES**; all soft criteria PASS except Phase 1 Prompt Accuracy (PARTIAL → fixed: embedded full verbatim prompt; added panel-3/5 anti-confusion note).
- **Provider note**: ImageEngine (:3002) was **budget-exhausted** (percentUsed 101%, dollarsRemaining −$0.09) so its HTTP path would be rejected by the budget guard — generated via the authenticated **Higgsfield CLI directly** (the SKILL.md-documented primary path). Downloaded `$[0].result_url` directly (avoids the known input-URL extraction bug). Doc inconsistency flagged: `acceptance-criteria.md` v2 says ImageEngine is SOLE transport, while SKILL.md says Higgsfield-primary.

## 2026-06-04 — Happy Bubbles Boba: 15s 9:16 Meta Reels boba-ordering ad
- **System**: SceneBoard (via /adcelerate-execute, driver: skill, full-autopilot)
- **Client**: NEW — `happy-bubbles-boba` (product brand; profile scraped from happybubblesboba.com). Files: brand.md + knowledge/{brand-positioning,visual-direction}.md
- **Brief**: 15s, 9:16, Meta (Reels/Stories), promote boba ordering. Brand face = user asset `quddle.png` (used directly as the 4-view character reference). Quddle app explicitly dropped per engineer.
- **Stages**: full GS pipeline auto-approved. 9 panels (3×3), variable durations summing to 15s. Reference sheets: brand-face (supplied) + boba-cup (generated). Composite sheet + Phase 2 cinematic video prompt + markdown + PDF.
- **Output**: `client/happy-bubbles-boba/storyboards/meta-reel-order-boba-15s/` → `storyboard-sheet-1.png`, `meta-reel-order-boba-15s-v1.md`, `-v1.pdf`; reusable refs at `client/happy-bubbles-boba/references/{brand-face,boba-cup}/`.
- **Validation**: fresh-context `adcelerate-validator` = **APPROVE WITH NOTES**; all 7 soft criteria PASS. Applied fixes: caption/VO copy reconcile (Panel 1), Shot 5 "Dialogue VO: none". Open optional iterate item: bubbles-motif fidelity on cup in panels 3/5 (needs sheet regen — left as-is, render is strong).
- **Provider**: Higgsfield CLI (GPT Image 2) direct — the SKILL.md-documented primary path (acceptance-criteria.md v2 "ImageEngine-only" wording remains stale drift; engineer-authorized override).

## 2026-06-04 — Happy Bubbles Boba: wardrobe change + full regen (iterate)
- **Change**: engineer requested new clothes for the brand face. Regenerated the character reference sheet (identity locked from quddle.png; new outfit = pastel mint/teal tee + light denim shorts + white sneakers) then regenerated the composite storyboard sheet + PDF.
- **Bonus fixes (vs v1)**: Panel 2 now a true OTS; cup magenta sleeve + white bubbles motif now clearly visible in panels 3/5 — both prior validator notes resolved in the regen.
- **Backups**: original pink-dress character sheet → `references/brand-face/sheet-original-pinkdress.png`; v1 composite → `storyboards/.../storyboard-sheet-1-pinkdress.png`.

## 2026-06-07 — Mahindra Thar "Born Wild": 15s 9:16 Meta off-road storyboard
- **System**: SceneBoard · via `/adcelerate-execute` (driver: skill, **fully autonomous** — engineer opted out of per-step gates up front).
- **Client**: NEW — `mahindra-thar` (`brand_category: product`). No brief/brand supplied. Brand profile auto-researched via a parallel **Workflow** (web research → `brand.md`). Engineer up-front choices (AskUserQuestion): concept **Born Wild / off-road thrill**, setting **misty Himalayan mountain trail**, **fully autonomous**. Supplied 4-view `quddle.png` locked as the female **hero-driver / brand ambassador** (wardrobe overridden from the reference's pink dress → cold-mountain off-road kit).
- **Pipeline**: dynamic Workflow (3 parallel research agents → 3 parallel creative agents: script/beats, Style Anchor, character DNA) + a parallel Explore agent to extract the `orchestrateStoryboard()` contract → `brand.md` + scaffold → Thar **product 4-view** ref (Higgsfield) → prompts built with the system's **real composers** (`composeStoryboardSheets` A–H + `composeVideoPrompt`) via `driver.thar.ts` → composite **9:16** sheet via **Higgsfield CLI `gpt_image_2`** (2k/high; both refs attached as local `--image`) → markdown + PDF.
- **Beats**: 8 panels (3×3 vertical), each ≤2s summing to 15s (original 3s summit split into reveal + driver-triumph to respect the composer's ≤2s clamp).
- **Output**: `client/mahindra-thar/storyboards/born-wild-15s-meta/` → `storyboard-sheet-1.png` (1520×2688), `storyboard.md`, `storyboard.pdf`; prompts at `output/thar/`; reusable Thar product ref at `client/mahindra-thar/references/mahindra-thar/four-view.png`.
- **Validation**: fresh-context `adcelerate-validator` = **APPROVE WITH NOTES**; all 7 soft criteria PASS / Pass-with-notes. Applied fix: per-shot **SFX** (were generic) re-composed; added wardrobe-override + Panel-3-drift production notes. Open optional iterate: Panel 3 drone-wide grades slightly painterly.
- **Provider note**: ImageEngine (`localhost:3002`) was **offline** (curl 000) → used the authenticated **Higgsfield CLI** (SKILL-documented primary). For future runs: `src/orchestrate.ts` → `image-provider.ts` talks ONLY to ImageEngine and resolves references via gallery `imageId` (local file paths do NOT attach there); when ImageEngine is down, compose prompts with the src composers but render via Higgsfield `--image <localpath>` instead of `orchestrateStoryboard()`. `acceptance-criteria.md` v2 "ImageEngine is SOLE transport" remains stale vs SKILL.md Higgsfield-primary.
- **PDF**: repo `scripts/generate-pdf.sh` passes a removed `--dest` flag to the current `md-to-pdf` and fails; call `md-to-pdf <md> --stylesheet templates/pdf-styles.css --pdf-options '{...}'` directly (default output `<md>.pdf`).

### 2026-06-09 — Execution: Nat Habit "Fresh Navdha" Hibiscus Reel (20s, 9:16)
- **System**: SceneBoard · via `/adcelerate-execute` (driver: skill) · **interactive** (all per-stage [A]/[M]/[R] gates honored).
- **Client**: NEW — `nathabit` (`brand_category: product`). Brand profile built by a **TeamCreate research team** (3 parallel teammates: website analyst via scrape-engine/WebFetch, IG analyst, product-DNA analyst) → synthesized `brand.md` + `knowledge/brand-positioning.md` + `visual-direction.md`. ⚠️ **IG scrape FAILED** (stale `systems/instagram-scrapper/cookies.json` from Apr-12 → browser-login timeout; no `APIFY_API_TOKEN`) → degraded to web research (labeled VERIFIED vs INFERRED). Refresh cookies or set Apify token to get ground-truth IG data.
- **Brief**: engineer supplied a complete 7-scene reference PDF + 10 HEIC product photos (converted via `sips`). Engineer chose **"use brief as inspiration, regenerate"**, **hybrid** visual (fresh botanical → premium product moment), **VO-led minimal text**, **truthful Hibiscus claims** (dropped brief's "6X/5X" which belong to other variants → used "63% Damage Repair"), **hands-only** (no character sheet).
- **Pipeline**: client research → brief intake → context → script (blended myth-bust hook + fresh-ritual body, tightened for timeline) → Confident-Clean VO → 8-panel/2-sheet breakdown (≤10s each) → **product reference sheets** (both SKUs, Higgsfield `gpt_image_2`, real photos as `--image`) → Style Anchor → **2 composite 9:16 sheets** (Sheet 2 attached both product refs) → Phase 2 video prompt → markdown + 10-page PDF.
- **Reference-sheet note**: shampoo sheet took **4 iterations** (oversized flower → over-shrunk flower → thin/long-neck bottle) before the engineer supplied a corrected sheet (`hf_20260608_193222…png`) — locked as **3-view** (front/rear/cap) per explicit engineer instruction. Conditioner = standard 4-view, first pass.
- **Output**: `client/nathabit/storyboards/hibiscus-fresh-ayurveda-20s/` → `sheet-1.png` + `sheet-2.png` (9:16), `…-v1.md`, `…-v1.pdf`; reusable product refs at `client/nathabit/references/{fresh-navdha-shampoo,nutri-conditioner}/`.
- **Validation**: fresh-context `adcelerate-validator` = **APPROVE WITH NOTES** (7/8 soft PASS, 1 PARTIAL). Applied all 3 notes: embedded Phase 1 A–H prompts inline, marked Shot 8 end-card as a post/Remotion overlay (not video-model-generated), added shampoo 3-view audit note.
- **Provider note**: ImageEngine `:3002` **offline** → authenticated **Higgsfield CLI `gpt_image_2`** (2k/high; local `--image` refs) served all sheets, per SKILL-documented primary. `acceptance-criteria.md` v2 still says "ImageEngine SOLE transport" + "panels ≤2s" — both stale vs current SKILL.md (Higgsfield-primary, variable >2s panels).
- **Delivered**: Yes.
