# SceneBoard — Scope

## Description
SceneBoard is a CLI-driven storyboard creation system that transforms video briefs (scripts, reference videos, voice scripts, or raw ideas) into a professional **two-phase storyboard deliverable**: a **Phase 1 composite multi-panel storyboard sheet image** (one per ≤15s block, generated via the Higgsfield CLI using GPT Image 2, with ImageEngine HTTP as the automatic fallback) plus a **Phase 2 cinematic video prompt** — leveraging the best available marketing, sales, social media, and ads skills.

## In Scope
- Accept flexible brief formats: full script, reference video link with proposed changes, voice script only, or raw idea.
- Fully dynamic approval workflow — for every storyboard component (script, voice script, visual direction, scene/panel breakdown, etc.):
  - If provided in the brief → lock it in, no generation needed.
  - If NOT provided → generate multiple options → present for approval.
  - Final step: curate the complete storyboard document from all approved components.
- Script generation using marketing, sales, social media, user engagement, and ads domain skills.
- **Composite storyboard sheet generation** — a single multi-panel sheet image per ≤15s block (numbered panels, per-panel timecodes + shot captions baked in), via the **Higgsfield CLI** (`higgsfield generate create gpt_image_2 … --wait --json`) as the primary path, with the **ImageEngine HTTP service as an automatic fallback**.
- **Variable panel duration** — panels may span more than one second; the only hard rules are per-panel timecodes summing to the sheet's ≤15s window and a panel-count cap (≤ ~15, sized to the grid).
- **Multi-sheet splitting** — videos longer than 15s split into N sheets (one per ≤15s block) with continuing timecodes.
- **Reference Sheet stage (Stage 4.5)** — auto-generate **4-view reference sheets** on a neutral grey background for **character and product** subjects, fed as reference images into the composite sheet for identity lock. A storyboard may use multiple character AND product sheets together.
- **`brand_category`-routed reusability** — clothing → per-storyboard sheets (with garment selection + reuse-vs-new-model prompt); product/service → reusable common sheets.
- **Phase 2 cinematic video prompt generation** — per-shot timecode, camera, dialogue, SFX, and a fixed closing Audio line, ready for an AI video tool.
- **Reference-based iterate flow** — change a panel by passing the approved sheet back to Higgsfield as a reference and regenerating the full sheet (same path on the ImageEngine fallback); full-sheet re-runs and Phase 2 regeneration.
- Style Anchor mechanism for cross-panel/cross-sheet visual consistency.
- CLI interface with interactive approval gates.
- Knowledge gathering phase — collect all context (including `brand_category`) before generation begins.
- **Client knowledge management** — per-client brand profiles at `client/{client}/` (brand positioning, visual direction, voice, `brand_category`), auto-loaded when generating storyboards.
- **PDF storyboard generation** — professional PDF output alongside markdown, embedding the sheet image(s), the Phase 1 prompt, the panel/timecode table, and the Phase 2 video prompt.

## Out of Scope
- Video rendering or editing (outputs the Phase 2 video prompt, does not call a video model).
- Audio/voiceover generation.
- The Higgsfield interactive MCP path (CLI is used for scriptable/non-interactive runs).
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
- The **Higgsfield CLI** must be installed globally (`npm install -g @higgsfield/cli`) and authenticated once (`higgsfield auth login`). This is an environment prerequisite, not a package.json dependency. When the CLI is unavailable, SceneBoard falls back to the ImageEngine HTTP service automatically.

## Target Users
- Internal creative team (storyboard creation for client projects).
- Client-facing team (presenting storyboards to clients for approval).
