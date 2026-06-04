# SceneBoard — Scope

## Description
SceneBoard is a CLI-driven storyboard creation system that transforms video briefs (scripts, reference videos, voice scripts, or raw ideas) into a professional **two-phase storyboard deliverable**: a **Phase 1 composite multi-panel storyboard sheet image** (one per ≤15s block, generated via the ImageEngine HTTP service using GPT Image 2) plus a **Phase 2 cinematic video prompt** — leveraging the best available marketing, sales, social media, and ads skills.

## In Scope
- Accept flexible brief formats: full script, reference video link with proposed changes, voice script only, or raw idea.
- Fully dynamic approval workflow — for every storyboard component (script, voice script, visual direction, scene/panel breakdown, etc.):
  - If provided in the brief → lock it in, no generation needed.
  - If NOT provided → generate multiple options → present for approval.
  - Final step: curate the complete storyboard document from all approved components.
- Script generation using marketing, sales, social media, user engagement, and ads domain skills.
- **Composite storyboard sheet generation** — a single multi-panel sheet image per ≤15s block (numbered panels, per-panel timecodes + shot captions baked in), via the **ImageEngine HTTP service** (GPT Image 2 — ImageEngine's default provider).
- **Text-free shot content** — the imagery inside each panel frame is visually clean: no words, captions, subtitles, signage, UI text, watermarks, or lettering; the only permitted in-frame text/graphic is the brand logo and supplied brand assets. The storyboard's own panel-number badges, timecode labels, and one-line captions remain as presentation chrome.
- **Short panels** — each panel depicts a short shot of **≤2s, typically 1s**; the hard rules are no panel exceeds 2s, per-panel timecodes sum to the sheet's ≤15s window, and a panel-count cap (≤ ~15, sized to the grid).
- **Multi-sheet splitting** — videos longer than 15s split into N sheets (one per ≤15s block) with continuing timecodes.
- **Reference Sheet stage (Stage 4.5)** — auto-generate **4-view reference sheets** on a neutral grey background for **character and product** subjects, fed as reference images into the composite sheet for identity lock. A storyboard may use multiple character AND product sheets together.
- **`brand_category`-routed reusability** — clothing → per-storyboard sheets (with garment selection + reuse-vs-new-model prompt); product/service → reusable common sheets.
- **Phase 2 cinematic video prompt generation** — per-shot timecode, camera, dialogue, SFX, and a fixed closing Audio line, ready for an AI video tool.
- **Reference-based iterate flow** — change a panel by passing the approved sheet back to ImageEngine as a reference and regenerating the full sheet; full-sheet re-runs and Phase 2 regeneration.
- Style Anchor mechanism for cross-panel/cross-sheet visual consistency.
- CLI interface with interactive approval gates.
- Knowledge gathering phase — collect all context (including `brand_category`) before generation begins.
- **Client knowledge management** — per-client brand profiles at `client/{client}/` (brand positioning, visual direction, voice, `brand_category`), auto-loaded when generating storyboards.
- **PDF storyboard generation** — professional PDF output alongside markdown, embedding the sheet image(s), the Phase 1 prompt, the panel/timecode table, and the Phase 2 video prompt.

## Out of Scope
- Video rendering or editing (outputs the Phase 2 video prompt, does not call a video model).
- Audio/voiceover generation.
- Direct image-model integration — all image generation is delegated to the ImageEngine HTTP service.
- Client-facing web UI (CLI only for v1).

## Inputs
- Video brief (one or more of: script, reference video link, voice script, raw idea, proposed changes).
- Client/brand context (brand voice, target audience, platform, goals, `brand_category`).
- Character/product reference images and garment selection (clothing brands).
- Any reference materials the user provides.

## Outputs
- Professional storyboard document containing:
  - Style Anchor + 4-view reference sheets (character + product, when generated).
  - Final approved script and voice script (when applicable).
  - **Composite storyboard sheet image(s)** — one per ≤15s block — plus the generating Phase 1 prompt and a panel/timecode table.
  - **Phase 2 cinematic video prompt**.
  - Production notes.

## Environment Prerequisite
- The **ImageEngine HTTP service** must be running (default `http://localhost:3002`). SceneBoard performs ALL image generation through ImageEngine, which selects the underlying provider (GPT Image 2 is its default) and manages auth, cost, and rate limits centrally. No image-CLI binary is required by SceneBoard itself.

## Target Users
- Internal creative team (storyboard creation for client projects).
- Client-facing team (presenting storyboards to clients for approval).
