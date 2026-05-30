# SceneBoard — Domain Knowledge

## Process Overview
SceneBoard takes a video brief of any format and produces a professional **two-phase storyboard deliverable** through a dynamic, approval-gated workflow. The system intelligently detects what's provided in the brief and only generates what's missing.

The defining shift from the legacy design: SceneBoard no longer renders **"1 scene = 1 individual image."** It produces a **single composite multi-panel storyboard SHEET image** per ≤15s block — numbered panels in a grid, each with a timecode and a one-line shot caption baked into the one render — followed by a **Phase 2 cinematic video prompt**. The methodology is ported from the storyboard-prompt-builder (`knowledge/storyboard-prompt-builder.md`).

### Steps
1. **Brief Intake** — Accept the brief in any format (Instagram link with changes, detailed document, raw idea, script, voice script, etc.). Parse and identify which storyboard components are already provided vs. need generation.
2. **Context Gathering** — Collect all additional information needed: brand context (including `brand_category`), target audience, platform, goals, whether voice script and on-screen text are both needed, etc.
3. **Dynamic Generation & Approval Loop** — For each missing component, generate multiple options using the best available marketing/sales/social/ads skill frameworks, present for approval, and lock in once approved. Components include: script, voice script, scene breakdown, visual direction, etc.
4. **Scene Breakdown** — Break the approved script into beats/panels. Each panel is a numbered cell on the composite sheet with its own timecode range and shot caption.
5. **Visual Direction** — Lock a Style Anchor, then determine the best visuals per panel that reflect the story and read clearly to the audience.
6. **Reference Sheet stage (Stage 4.5, optional)** — Generate **4-view reference sheets** for **character and/or product** subjects on a neutral grey background (Higgsfield GPT Image 2 → ImageEngine fallback). These are fed as reference images into the composite sheet for identity lock.
7. **Phase 1 — Composite Storyboard Sheet** — Assemble a single continuous GPT Image 2 prompt (sections A–H) and generate one composite multi-panel sheet image per ≤15s block via the Higgsfield CLI (ImageEngine fallback), passing all approved reference sheets as reference images.
8. **Phase 2 — Cinematic Video Prompt** — After sheet approval, emit a per-shot timed cinematic video prompt (timecode, camera, dialogue, SFX, fixed closing Audio line) ready for an AI video tool.
9. **Final Storyboard Assembly** — Curate the complete storyboard markdown + PDF embedding the sheet image(s), the generating Phase 1 prompt, the panel/timecode table, and the Phase 2 video prompt.

## Domain Concepts
- **Brief**: The input to SceneBoard. Can be anything — an Instagram link with proposed changes, a detailed document, a raw idea, a script, a voice script, or any combination. There is no fixed format.
- **Composite Storyboard Sheet**: The primary deliverable. A **single image** containing a header (brand + "15-SECOND STORYBOARD"), a grid of numbered panels, each panel carrying a timecode (e.g. `00:00-00:01`) and a one-line shot description. Generated as one render via GPT Image 2 (GPT Image 2 renders legible in-image text reliably, unlike NanoBanana). Reference look: `templates/examples/storyboard-sheet-example-1.png` / `-2.png`.
- **Panel**: One numbered cell in the sheet grid. **Variable-duration** — a panel may span more than one second; drop the legacy "1 panel ≈ 1 second" assumption. The only hard rules: per-panel timecodes sum to the sheet's ≤15s window, and a sensible panel cap (≤ ~15, sized to the grid).
- **Sheet (≤15s block)**: Each composite sheet covers **≤ 15 seconds**. Videos longer than 15s are split into multiple sheets (one per ≤15s block) with continuing timecodes via `splitIntoSheets()`.
- **Grid mapping**: panel count → grid. 9→3×3, 12→3×4, 15→3×5 (default), 20→4×5; vertical 9:16 flips rows×cols (e.g. 15→5×3).
- **GPT Image 2**: The image model (`gpt_image_2` on Higgsfield; `gpt-image-2`/`gpt-image-1.5` on the ImageEngine fallback). No separate system-instruction slot — the full prompt is one continuous body. Strong at rendering legible in-image text (panel numbers, timecodes, captions). Prompt guide: `systems/prompt-writer/knowledge/models/image/gpt-image-2.md`.
- **Higgsfield CLI**: The **primary** image transport. SceneBoard shells out to the globally-installed `higgsfield` binary (`higgsfield generate create gpt_image_2 … --wait --json`), parses the result URL, and downloads the image. Reference images via repeatable `--image` (up to ~8). See `knowledge/higgsfield-cli.md`.
- **ImageEngine (fallback)**: The existing typed HTTP client (`src/image-client.ts`, localhost:3002, wraps WisGate). Used **automatically** whenever the Higgsfield CLI is unavailable, unauthenticated, or fails. Caps at 3 reference images. ImageEngine remains `active` in the registry — it is the fallback transport, not retired.
- **Provider façade**: `src/image-provider.ts` — `generateImage()` tries Higgsfield first, falls back to `image-client.generateSingle()`; logs which provider served the request.
- **Reference Sheet (4-view)**: A generalized Stage 4.5 artifact (`src/reference-sheet-generator.ts`). Two types — **character** (FULL BODY FRONT / FULL BODY REAR / FRONT CLOSE-UP / PROFILE CLOSE-UP) and **product** (FRONT THREE-QUARTER / REAR STRAIGHT-ON / FRONT CLOSE-UP / PROFILE LEFT) — each rendered as four views on a neutral grey background with clean studio lighting, fed as reference image(s) into the composite sheet. Replaces the legacy 6-pose character-sheet layout.
- **brand_category**: A client brand profile field (`clothing | product | service`) that routes reference-sheet reusability — see "Reference Sheet Reusability" below.
- **Voice Script / On-Screen Text**: Narration/dialogue and text overlays. Not always needed — SceneBoard asks before generating.
- **Dynamic Workflow**: The core design principle — any component provided in the brief is locked in; any component missing is generated with options for approval.

## Image Path: Higgsfield Primary → ImageEngine Fallback

- **Primary — Higgsfield CLI** (`src/higgsfield-client.ts`): spawns `higgsfield generate create gpt_image_2 … --aspect_ratio … --quality high --resolution 2k [--image …]… --wait --json`, parses the JSON job array for the result media URL, downloads to disk. Exposes `checkAuth()`. Typed errors: `HiggsfieldCliError` (non-zero exit / parse failure), `HiggsfieldTimeoutError` (wait exceeded), `HiggsfieldAuthError` (unauthenticated / session expired).
- **Fallback — ImageEngine HTTP** (`src/image-client.ts`): reused unchanged. The provider façade falls back on **any** Higgsfield failure via `generateSingle({ model: "gpt-image-2" })` with a `gpt-image-1.5` retry.
- **Aspect ratio mapping**: 16:9 landscape is the default for sheets; 9:16 vertical is supported (flips the grid rows×cols).
- **Reference cap**: Higgsfield ~8 refs (repeatable `--image`); ImageEngine 3 refs. The composite-sheet reference resolver prioritizes subjects appearing earliest/most often when over the cap.

## Reference Sheet Stage (Stage 4.5) — Character + Product, 4-view

The reference-sheet generator (`src/reference-sheet-generator.ts`) calls `image-provider.generateImage()` (Higgsfield primary → ImageEngine fallback), uses gpt-image-2, and emits 4-view sheets for two subject types. `[INSERT DESIRED STYLE]` is filled from the locked Style Anchor; the bracketed subject/garment slots are filled from the locked description (+ selected garments for clothing brands). Per-subject parallel generation with per-subject error handling is preserved.

**Character reference sheet (4 views):** FULL BODY FRONT (three-quarter, head-to-feet) · FULL BODY REAR (directly behind) · FRONT CLOSE-UP (head & shoulders, straight-on) · PROFILE CLOSE-UP (90° left profile). Clean studio lighting (soft key upper-left, gentle fill from the right), consistent identity/proportions/costume across all four views, no text/watermarks/extra figures/background.

**Product reference sheet (4 views):** FRONT THREE-QUARTER · REAR STRAIGHT-ON · FRONT CLOSE-UP · PROFILE LEFT-SIDE. Photorealistic product-photography style, neutral grey background, consistent device identity/proportions/colour/hardware across all four views, no text/watermarks/extra objects/background.

A single storyboard may use **multiple character AND product sheets together** (e.g. a model holding a soda can). The composite-sheet reference resolver (`resolveSheetReferences()`, adapted from the legacy `resolveReferenceImageIds()`) collects **all** approved reference sheets for the storyboard as the reference images passed into composite-sheet generation, capped at the provider's reference limit.

### Reference Sheet Reusability — routed by `brand_category`

Read from `client/{client}/brand.md` (`brand_category: clothing | product | service`):

| brand_category | Reference sheets | Cache path | Clothing intake |
|---|---|---|---|
| `clothing` | **Per-storyboard** (model wears that storyboard's selected garments) | `client/{client}/storyboards/{project}/references/{slug}/` | Asks **which brand garments the model wears**, and **per storyboard** `[R] Reuse cached model identity` / `[N] New model this storyboard` (reuse pulls a cached identity and re-renders it wearing the new outfit) |
| `product` | **Reusable common sheets** shared across storyboards | `client/{client}/references/{slug}/` | n/a |
| `service` | Reusable (treated like product for sheet purposes) | `client/{client}/references/{slug}/` | n/a |

## Phase 1 — Composite Sheet Prompt (sections A–H)

`src/storyboard-sheet-prompt.ts` ports the storyboard-prompt-builder Phase 1 logic into a single continuous prompt with sections A–H: title/format header, style declaration, character/product descriptions, visual tone, layout details (grid for the panel count), per-panel scene breakdown (numbered, with timecodes + captions), art-direction footer, render/format footer. Character/product DNA (locked descriptions + reference sheets) is woven into panel descriptions; shot-type variety and three-act pacing helpers are applied. `splitIntoSheets(beats, durationSeconds)` returns N sheet specs for >15s videos with correct continuing timecodes.

## Phase 2 — Cinematic Video Prompt

`src/video-prompt.ts` ports Phase 2: approved panels → timed shots (timecode, SHOT N label, shot type + camera, scene direction, dialogue, SFX, camera-movement verb), a production header (reference-image mandate, character consistency, style block), and the **fixed closing line**: `Audio: Diegetic sound only — natural ambience, environmental foley, and subject-driven sound.` Language is style-adaptive (3D / live-action / anime / 2D); time distribution sums to the target duration; shot count matches panel count.

## Quality Standards

### Hard Requirements
- Storyboard must look professional — presentation quality that impresses clients on sight ("client gets flattened").
- Script must be the best possible interpretation of the given brief.
- The composite-sheet Phase 1 prompt must accurately match the locked visual direction and Style Anchor for every panel — no mismatch between what's described and what gets rendered.
- Reference sheets must align with the locked descriptions and the Style Anchor — no mismatches.
- Panel timecodes must sum to the sheet's ≤15s window; the panel count must stay within the grid cap.
- Shot duration/pacing must be confirmed with the user (no assumptions).
- Voice script and on-screen text inclusion must be explicitly confirmed with the user before generating.

### Quality Signals
- **"Client gets flattened"** — the storyboard is so good that the client is immediately impressed and convinced.
- Script uses the best audience engagement tactics available (hooks, emotional triggers, persuasion frameworks).
- Vague briefs are interpreted by capturing the key points, feelings, and energy of what was given.
- The composite sheet reads as a single coherent piece — consistent style, legible panel text, sensible pacing across panels.
- The complete document reads as a unified, professional creative deliverable.

### Rejection Criteria
- Storyboard doesn't look professional.
- The Phase 1 prompt and the locked visual direction are mismatched or low quality.
- Script doesn't capture the brief's intent, energy, or feeling.
- Visual direction doesn't reflect the story or isn't understandable by the audience.

### Visual Consistency Protocol

Consistency across panels and across sheets is enforced cumulatively:

0. **Reference Sheets (pixel anchor, Stage 4.5)** — All approved 4-view character/product sheets are passed as reference images into the composite-sheet generation (Higgsfield up to ~8; ImageEngine 3). Identity/product is pinned across every panel that features the subject. Highest-priority signal when present.
1. **Style Anchor Preamble (baseline)** — A condensed visual identity woven into the Phase 1 prompt's style declaration (section B). Handles palette, photographic/illustration style, lighting mood, camera conventions. When reference sheets exist, the Style Anchor must NOT redefine a subject's physical appearance — it only constrains stylistic treatment.
2. **Character/Product DNA (text)** — Locked physical/product descriptions woven verbatim into the relevant panel descriptions.
3. **Cross-sheet continuity** — For multi-sheet (>15s) storyboards, the same reference sheets + Style Anchor + DNA carry across all sheets so the look holds from block to block.

## Iterate Flow — Reference-Based Panel Edit

To change a panel, SceneBoard passes the **approved storyboard sheet image back to Higgsfield as a reference image** with an instruction to reproduce the sheet exactly while changing only the named panel(s), then regenerates the **full sheet** (same reference-based edit path on the ImageEngine fallback). Best-effort caveat applies — the model reproduces, not pixel-copies. Full-sheet re-runs and Phase 2 regeneration are also supported. This replaces the legacy per-scene re-generation model.

## Edge Cases & Gotchas

### Common Failures
- **Prompt/visual mismatch**: The #1 problem. The Phase 1 prompt must be highly specific to the product/brand and the locked Style Anchor — generic prompts produce generic sheets.
- **Style inconsistency across panels/sheets**: Enforced via the Style Anchor preamble in section B + reference sheets. Without the anchor, panels drift.
- **In-image text**: GPT Image 2 renders legible panel numbers, timecodes, and short captions reliably — a deliberate reason for the model choice (legacy NanoBanana garbled all text). Keep captions short; long paragraphs of in-image text still degrade.

#### Style Anchor System
1. **Style Anchor Document** — At the start of visual direction, generate a Style Anchor defining: color palette, photographic/illustration style, degree of abstraction, lighting mood, camera conventions, and subject representation rules.
2. **Lock-in** — Presented for approval before any Phase 1 prompt is assembled.
3. **Enforcement** — The Style Anchor is woven into section B of every Phase 1 prompt and `[INSERT DESIRED STYLE]` of every reference-sheet prompt. Non-negotiable.
4. **Override** — Individual panels may override specific properties (e.g. a desaturated flashback) only when explicit, intentional, and approved.

#### Contradictory Briefs
Research proven market precedents that balanced the tension; if none exist, resolve creatively; present the approach for approval before proceeding.

#### Reference Video Links (Instagram, etc.)
Analyze shot composition, style, pacing, transitions, tone. Distinguish what the client wants to keep vs. change ("like this" = recreate style/structure with their product; "similar but with X changes" = keep template, swap specified elements).

#### Platform-Aware Storyboards
Output adapts to the target platform: aspect ratio (9:16 vertical sheets flip the grid; 16:9 landscape is default), duration constraints (drives sheet count), tone and pacing norms. Asked during context gathering.

#### Multi-Sheet Splitting (>15s)
Videos longer than 15s split into N sheets (one per ≤15s block) via `splitIntoSheets()`, with continuing per-panel timecodes. Each sheet is its own composite image; all share the same reference sheets, Style Anchor, and DNA.

#### Partial Re-Runs / Iteration
Re-run a sheet (reference-based panel edit) or regenerate Phase 2 without redoing the whole pipeline. Pipeline state (locked script, Style Anchor, reference sheets, approved sheets) is preserved.

#### Text-Heavy Scenes
GPT Image 2 handles short in-image captions/timecodes well. For dense text overlays in the final video (title cards, CTAs), Remotion remains the recommended downstream tool — mark those panels for Remotion treatment.

## Tacit Knowledge

### Framework Selection
Determine the best marketing/engagement framework by: analyzing the brief (ad / showcase / explainer / testimonial / brand story), asking targeted questions, cross-referencing skills (ad-creative, copywriting, marketing-psychology, social-content), and matching framework to intent (sell → hook→problem→solution→CTA; brand awareness → emotional narrative; testimonial → trust-building; showcase → feature-driven; viral → pattern interrupt). Blend frameworks when the brief calls for it.

### Video Type Determines Structure
- **Ad (15-30s)**: Fast-paced, hook in first 2-3s, tight CTA, high impact per panel.
- **Product showcase**: Feature-focused, clean visuals, moderate pacing.
- **Brand story (60s+)**: Narrative arc, more panels/sheets with longer holds.
- **Social (Reels/TikTok)**: Trend-aware, fast cuts, native feel, vertical 9:16.
- **Explainer**: Problem → solution flow, clear visual metaphors.
- Duration and platform fundamentally change the panel count, pacing, and number of sheets.

### Experience-Based Rules
- **Garbage in, gold out**: Extract the essence (feeling, energy, intent) even from a vague brief.
- **Visuals + story alignment = client approval**.
- **The brief is flexible, the output is not**: Any input format; always a polished, professional storyboard.
- **Ask, don't assume**: shot duration, voice script, on-screen text, platform, aspect ratio, `brand_category` — always confirm.
- **Variable panel duration**: never assume 1 panel = 1 second. Read per-panel timecode ranges from the scene breakdown; only enforce the ≤15s sum and the panel-count cap.
- **Style consistency** comes from the Style Anchor (section B) carried into every Phase 1 prompt; **subject consistency** comes from the 4-view reference sheets passed as reference images.

## Client System

Per-client brand knowledge is loaded automatically when generating storyboards.

### Directory Structure
```
client/
  {client-slug}/
    brand.md              # Compiled brand profile (quick-reference) — includes brand_category
    knowledge/            # Detailed brand knowledge files
      brand-positioning.md
      visual-direction.md
    references/           # Reusable reference sheets (product/service brand_category)
      {slug}/             # 4-view sheet + metadata, reused across storyboards
    storyboards/          # Generated storyboard outputs
      {project}/
        references/{slug}/ # Per-storyboard reference sheets (clothing brand_category)
      {project-name}-v{N}.md   # Markdown storyboard
      {project-name}-v{N}.pdf  # PDF storyboard
```

### How Brand Knowledge Is Loaded
1. **Stage 0 (Client Selection)** asks which client the storyboard is for.
2. If selected, `brand.md` is read into context — including `brand_category`, brand voice, style philosophy, audience, visual direction, positioning.
3. Detailed `knowledge/` files load for deeper context.
4. `brand_category` routes Stage 4.5 reference-sheet reusability (clothing → per-storyboard; product/service → reusable).
5. The brand context informs the Style Anchor, ensuring visual consistency with the client's identity.

### Client Management
The `[MC] Manage Client` capability creates/updates client profiles (including the `brand_category` prompt) through a guided workflow. See `manage-client.md`.

## PDF Output

SceneBoard generates a professional PDF storyboard alongside the markdown.

### PDF Structure
1. **Project Specs Header** — Duration, Format, Style, Product, Model, Setting, Audio.
2. **Style Anchor** + **Reference Sheets** (character + product, 4-view).
3. **Storyboard Sheet(s)** — the embedded composite image per ≤15s block, the Phase 1 prompt used, and a panel/timecode table.
4. **Phase 2 Cinematic Video Prompt**.
5. **Production Notes** — color palette, lighting, camera style, music direction.

### Output Location
- **With client context**: `client/{client}/storyboards/{project-name}-v{N}.{md,pdf}`.
- **Without client context**: User-specified location.

Both versions saved; previous versions preserved (not overwritten) when iterating.

## Dependencies
- Marketing/Sales/Social/Ads skills: `ad-creative`, `copywriting`, `social-content`, `marketing-psychology`, `paid-ads`, `sales-enablement`, `content-strategy`.
- **Higgsfield CLI** — primary image transport (global binary; environment prerequisite, not an npm dep). See `dependencies.md`.
- **ImageEngine** — fallback image transport (localhost:3002, wraps WisGate). Stays `active`.
- **PromptWriter** — authoritative prompt-knowledge source: `systems/prompt-writer/knowledge/models/image/gpt-image-2.md` and the storyboard-prompt-builder methodology.
- **Remotion** — downstream text-heavy scene rendering (title cards, CTAs).

## Input/Output Specifications
### Inputs
- Brief: any format (Instagram link, detailed doc, raw idea, script, voice script, or combination).
- Brand/client context (incl. `brand_category`) gathered during context phase.
- Character/product reference images (for reference-sheet accuracy) and garment selection (clothing brands).
- User approval decisions at each gate.

### Outputs
- Professional storyboard document containing:
  - Style Anchor + 4-view reference sheets (character + product, when generated).
  - Approved script (if applicable), voice script (if applicable), on-screen text (if applicable).
  - **Composite storyboard sheet image(s)** — one per ≤15s block — with the generating Phase 1 prompt and a panel/timecode table.
  - **Phase 2 cinematic video prompt**.
  - Production notes.

## Reference Guides
- Phase 1/Phase 2 methodology: `knowledge/storyboard-prompt-builder.md`.
- Higgsfield CLI surface: `knowledge/higgsfield-cli.md`.
- GPT Image 2 storyboard-sheet prompt guide: `systems/prompt-writer/knowledge/models/image/gpt-image-2.md` (centralized in PromptWriter).
- Legacy NanoBanana Pro guide (`knowledge/nanobanana-pro-prompt-guide.md`) is retained for reference only — superseded by the GPT Image 2 / storyboard-builder guidance and no longer the active path.
