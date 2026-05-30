---
system: scene-board
type: acceptance-criteria
version: 2
lastUpdated: 2026-05-29
lastUpdatedBy: builder-knowledge
---

# SceneBoard — Acceptance Criteria

## Hard Gates

These criteria are binary pass/fail and must all be satisfied before a storyboard is considered complete.

### Brief Intake & Context Gathering

- [ ] System accepts brief in at least one of the following formats: full script, reference video link, voice script only, raw idea, or any combination thereof
- [ ] System identifies and records which storyboard components were provided in the brief vs. which require generation
- [ ] System explicitly asks the user whether a voice script is needed before generating one
- [ ] System explicitly asks the user whether on-screen text is needed before generating it
- [ ] System explicitly asks the user to confirm shot duration and pacing before finalizing the scene/panel breakdown
- [ ] System explicitly asks the user about the target platform before generating visual direction or the composite-sheet prompt
- [ ] System explicitly asks the user about the target aspect ratio before finalizing visual direction
- [ ] When a client is selected, `brand_category` (clothing | product | service) is read from `client/{client}/brand.md` to route reference-sheet reusability

### Dynamic Approval Workflow

- [ ] Every storyboard component NOT provided in the brief has a corresponding approval gate before it is locked in
- [ ] Every storyboard component provided in the brief is locked in without regeneration
- [ ] When multiple options are generated for a missing component, at least two distinct options are presented before the user is asked to approve
- [ ] No component proceeds to the next pipeline stage until its approval gate is cleared

### Scene / Panel Breakdown

- [ ] The approved script is broken into panels, each mapped to a numbered cell on the composite sheet
- [ ] Every panel has a timecode range (e.g. `00:00-00:01`); panels are **variable-duration** (a panel may span more than one second)
- [ ] Per-panel timecodes sum to the sheet's window, and each sheet covers **≤ 15 seconds**
- [ ] The panel count stays within the grid cap (≤ ~15, sized to the chosen grid)
- [ ] Videos longer than 15s are split into multiple sheets (one per ≤15s block) with correct continuing timecodes
- [ ] Every panel has an associated voice script line if a voice script was confirmed as needed
- [ ] Every panel has associated on-screen text if on-screen text was confirmed as needed

### Reference Sheets (Stage 4.5, optional)

- [ ] Reference sheets are generated as **4-view** sheets on a neutral grey background for **character** and/or **product** subjects (matching the templates in `knowledge/storyboard-prompt-builder.md`)
- [ ] The character sheet uses the 4 views: FULL BODY FRONT / FULL BODY REAR / FRONT CLOSE-UP / PROFILE CLOSE-UP; the product sheet uses: FRONT THREE-QUARTER / REAR STRAIGHT-ON / FRONT CLOSE-UP / PROFILE LEFT
- [ ] Each sheet's `[INSERT DESIRED STYLE]` is filled from the locked Style Anchor; bracketed subject/garment slots are filled from the locked description (+ selected garments for clothing brands)
- [ ] Reference sheets are generated via Higgsfield (`gpt_image_2`) with automatic ImageEngine fallback (`gpt-image-2` → `gpt-image-1.5`)
- [ ] **All** approved reference sheets for the storyboard (multiple character + multiple product) are passed as reference images into the composite-sheet generation, capped at the provider limit (~8 Higgsfield / 3 ImageEngine), prioritizing subjects appearing earliest/most often
- [ ] Reusability follows `brand_category`: `clothing` → per-storyboard sheets under `client/{client}/storyboards/{project}/references/{slug}/` with garment-selection + reuse-vs-new-model prompts; `product`/`service` → reusable common sheets under `client/{client}/references/{slug}/`
- [ ] On approval, the sheet image + metadata are cached at the brand_category-appropriate path for reuse

### Phase 1 — Composite Storyboard Sheet

- [ ] `src/storyboard-sheet-prompt.ts` produces a **single continuous** Phase 1 prompt containing sections A–H
- [ ] Panel count maps to the correct grid (9→3×3, 12→3×4, 15→3×5, 20→4×5; 9:16 vertical flips rows×cols)
- [ ] The sheet is generated as **one composite image** per ≤15s block via the provider (Higgsfield primary → ImageEngine fallback), with all approved reference sheets passed as reference images
- [ ] The aspect ratio passed to the provider matches the storyboard's declared platform aspect ratio (16:9 default, 9:16 vertical)
- [ ] Each sheet contains a header (brand + "15-SECOND STORYBOARD"), numbered panels, per-panel timecodes, and one-line shot captions
- [ ] The provider façade logs which provider (Higgsfield / ImageEngine) served each request

### Phase 2 — Cinematic Video Prompt

- [ ] `src/video-prompt.ts` produces a Phase 2 cinematic video prompt whose shot count matches the panel count
- [ ] Each shot has a timecode, SHOT N label, shot type + camera, scene direction, dialogue, SFX, and a camera-movement verb
- [ ] Shot timecodes sum to the target duration
- [ ] The prompt ends with the fixed closing line: `Audio: Diegetic sound only — natural ambience, environmental foley, and subject-driven sound.`
- [ ] Language is style-adaptive (3D / live-action / anime / 2D)

### Iterate Flow

- [ ] Changing a panel passes the existing approved sheet to Higgsfield (or ImageEngine on fallback) **as a reference image** with a "reproduce the sheet exactly, change only Panel N" instruction, then regenerates the **full sheet**
- [ ] Full-sheet re-runs and Phase 2 regeneration are supported without redoing the whole pipeline
- [ ] Pipeline state (locked script, Style Anchor, reference sheets, approved sheets) is preserved between sessions

### Image Generation Path

- [ ] The Higgsfield CLI is the primary transport; ImageEngine HTTP is the automatic fallback on any Higgsfield failure (CLI unavailable, unauthenticated, timeout, non-zero exit)
- [ ] `image-engine` remains `active` in the registry as the fallback transport
- [ ] Generated images are downloaded to disk and embedded/referenced in the storyboard
- [ ] Higgsfield CLI is documented as an environment prerequisite (global install + `higgsfield auth login`), NOT a package.json dependency

### Storyboard Document Structure

- [ ] The final storyboard document contains: Project specs → Style Anchor → Reference Sheets (character + product, 4-view) → Full Script → Voice Script → **Storyboard Sheet(s)** (embedded composite image per ≤15s block + the Phase 1 prompt used + a panel/timecode table) → **Phase 2 Cinematic Video Prompt** → Production Notes
- [ ] No active per-scene "1 image per scene" / NanoBanana-primary / Kling-per-scene blocks remain (legacy references retained only where explicitly marked as superseded)
- [ ] The final storyboard markdown + PDF embed the sheet image(s), the generating prompt, the panel/timecode table, and the Phase 2 video prompt

### Platform Compliance

- [ ] The storyboard specifies the target platform
- [ ] The specified aspect ratio is consistent with the target platform (9:16 for Reels/TikTok/Shorts, 16:9 for YouTube, 1:1 for feed posts)
- [ ] Total video duration is within the accepted range for the target platform; sheet count = ceil(duration / 15s)

---

## Soft Criteria

These criteria require human judgment. They are assessed by reviewing the final storyboard document before client delivery.

### Professional Presentation Quality

The storyboard must read as a unified, polished creative deliverable — not a collection of generated fragments. **Document formatting** should be consistent throughout: fonts, panel numbering, spacing, and section headings should follow a clear hierarchy. **Section completeness** means no placeholder text, no TODO markers, and no unresolved approval gates remain in the final document. The composite sheet should look like a real storyboard sheet — legible panel numbers, timecodes, and captions in-image. The "client gets flattened" standard is the benchmark.

### Script Quality and Brief Fidelity

The approved script must honor the intent, energy, and feeling of the original brief — even when the brief was vague or minimal. **Brief fidelity** is the primary signal. **Audience engagement mechanics** should be present and appropriate to the video type (hooks in the first 2–3 seconds for ads, emotional arcs for brand stories, pattern interrupts for social). **Framework appropriateness** is evaluated by whether the chosen marketing/persuasion framework matches the video's goal.

### Visual Direction Coherence

Each panel's visual direction must be specific enough that a designer (or the model) could execute it without additional instructions. **Specificity** names the subject, environment, camera angle, lighting mood, and key compositional elements. **Narrative alignment** means the panel image reinforces what's said/heard at that moment. **Style consistency** across all panels and sheets is critical — the Style Anchor (section B) and the 4-view reference sheets must make the whole sheet feel like a single coherent piece.

### Phase 1 Prompt Accuracy

The #1 failure mode is prompt/visual mismatch. **Prompt specificity** is the primary signal: the Phase 1 prompt must name the product/subject concretely, encode the brand's visual identity, weave in character/product DNA, and include enough per-panel detail that the rendered sheet is immediately recognizable as belonging to this storyboard. **Reference-sheet alignment** means the passed reference images are stylistically and compositionally consistent with the prompt. **Sections A–H present** — the prompt should follow the storyboard-prompt-builder structure.

### Phase 2 Video Prompt Quality

The Phase 2 prompt should read as confident directorial instructions. **Motion/camera specificity** per shot, **time distribution** that sums to the target duration, **style-adaptive language** matching the look (3D / live-action / anime / 2D), and the **fixed closing Audio line** present. Camera intent must serve the narrative beat.

### Reference Sheet Quality

The 4-view sheets must show consistent identity/proportions/detail across all four views on a clean neutral grey background, with no text/watermarks/extra figures/background. For clothing brands, the model must wear the selected garments; product sheets must be photorealistic and match the real product (ideally with the brand's product photos passed as additional references).

### Platform and Pacing Awareness

The storyboard's rhythm must feel native to the target platform — ads short and high-impact, TikTok/Reels fast-cut and vertical, brand stories with longer holds. **Tone calibration** matches the platform's content norms.

### Contradictory Brief Resolution

When a brief contains apparent contradictions, the storyboard must show a deliberate, research-informed resolution that was surfaced and approved before the storyboard was built around it.

### Reference Video Interpretation (when applicable)

When the brief included a reference video link, the storyboard must demonstrate the reference was analyzed with care — elements to keep (composition, pacing, style, structure) reflected, elements to change absent.

---

## Validation Notes

### Automated / Programmatic Checks

- **Single-prompt structure**: assert the Phase 1 prompt is one continuous body and contains the section A–H markers
- **Grid mapping**: assert panel count maps to the expected grid (incl. 9:16 vertical flip)
- **Variable panel duration**: assert per-panel timecodes may be uneven and sum to ≤15s per sheet
- **Sheet splitting**: assert `splitIntoSheets()` returns ceil(duration / 15s) sheets with continuing timecodes for 15/30/60s
- **Panel-count cap**: assert panel count ≤ the grid cap
- **Phase 2 shot count**: assert shot count == panel count and timecodes sum to the target duration
- **Phase 2 closing line**: assert the fixed Audio line is present
- **Reference-sheet templates**: assert character vs product template selection, the 4-view layout text, and `[INSERT DESIRED STYLE]` / `[DESCRIBE …]` substitution
- **brand_category routing**: assert clothing → per-storyboard path; product/service → reusable path; clothing reuse-vs-new-model branch exists
- **Provider fallback**: assert `image-provider.generateImage()` falls back to ImageEngine on Higgsfield failure and logs the serving provider
- **Aspect ratio consistency**: assert the declared aspect ratio matches the declared platform via a lookup table
- **Registry**: assert `image-engine` status is `active`; assert `higgsfield` runtime dependency present in `knowledge/graph.yaml`

### Human Review Checklist

1. Does the script feel like the best possible interpretation of the brief?
2. Does each panel's visual direction give enough information to execute without questions?
3. Is the Phase 1 prompt specific to this product/brand, or generic?
4. Is the visual style consistent across all panels and sheets?
5. Does the composite sheet look like a real, legible storyboard sheet (panel numbers, timecodes, captions)?
6. Does the pacing feel native to the target platform?
7. Do the 4-view reference sheets show consistent identity across all four views?
8. Does the Phase 2 video prompt read as confident, time-distributed directorial instruction ending with the fixed Audio line?
9. If the brief contained contradictions, was the resolution surfaced and approved?
10. If a reference video was provided, does the storyboard reflect what to keep vs. change?
11. Is the document presentation quality high enough to share directly with a client?
