---
project: "{{project-name}}"
client: "{{client-name}}"
brand_category: "{{brand-category}}"
platform: "{{platform}}"
aspect_ratio: "{{aspect-ratio}}"
duration: "{{total-duration}}"
sheets: "{{sheet-count}}"
panels: "{{panel-count}}"
date: "{{date}}"
status: "draft"
output_dir: "{{output-dir}}"
stylesheet: "../templates/pdf-styles.css"
pdf_options:
  format: "A4"
  margin: "20mm"
  printBackground: true
---

# {{project-name}}

{{subtitle — e.g., "15s Product Ad — Composite Storyboard Sheet + Cinematic Video Prompt"}}

## Project Specifications

| Field | Details |
|-------|---------|
| **Client** | {{client-name}} |
| **Brand Category** | {{brand-category}} |
| **Platform** | {{platform}} |
| **Aspect Ratio** | {{aspect-ratio}} |
| **Total Duration** | {{total-duration}} |
| **Sheets** | {{sheet-count}} @ ≤15s each |
| **Panels** | {{panel-count}} |
| **Video Type** | {{video-type}} |
| **Goal** | {{video-goal}} |
| **Image Provider** | Higgsfield (GPT Image 2) — ImageEngine fallback |
| **Date** | {{date}} |
| **Status** | {{status}} |

---

## Style Anchor

{{style-anchor-content}}

---

## Reference Sheets

> Omit entirely if Stage 4.5 was skipped.

{{FOR EACH REFERENCE SHEET:}}

### {{subject-name}} — {{character-or-product}} (4-view)

![{{subject-slug}}-reference-sheet]({{sheet-path-or-url}})

| Element | Content |
|---------|---------|
| **Type** | {{character \| product}} |
| **Locked Description** | {{locked-description}} |
| **Garments** (clothing only) | {{selected-garments-or-N/A}} |
| **Appears in Panels** | {{panel-list}} |
| **Provider / Model** | {{higgsfield \| image-engine}} / gpt_image_2 |

{{END FOR EACH}}

---

## Full Script

{{full-script}}

---

## Voice Script

{{voice-script-or-N/A}}

---

## Storyboard Sheet(s)

{{FOR EACH ≤15s BLOCK:}}

### Sheet {{S}} — {{block-label}}

![storyboard-sheet-{{S}}]({{sheet-path-or-url}})

**Phase 1 Prompt** (the exact prompt used to generate this sheet):

```
{{phase-1-prompt}}
```

| Panel | Timecode | Shot Type | Caption |
|-------|----------|-----------|---------|
{{FOR EACH PANEL IN SHEET:}}
| {{N}} | {{start}}–{{end}} | {{shot-type}} | {{caption}} |
{{END FOR EACH}}

---

{{END FOR EACH}}

## Phase 2 — Cinematic Video Prompt

```
{{production-header — sheet reference, consistency mandate, style block, focus block}}

SHOT 1 — {{SCENE NAME}}  [{{x}}s – {{y}}s]
{{shot type + camera, scene direction, dialogue, SFX, camera movement}}

SHOT 2 — {{SCENE NAME}}  [{{y}}s – {{z}}s]
{{...}}

Audio: Diegetic sound only — natural ambience, environmental foley, and subject-driven sound.
```

*Companion note: {{pacing choices, shots to watch, optional audio pairing}}*

---

## Production Notes

| Category | Details |
|----------|---------|
| **Color Palette** | {{color-palette}} |
| **Lighting** | {{lighting-notes}} |
| **Camera** | {{camera-notes}} |
| **Text / Type** | {{Sheet text rendered by GPT Image 2; brand wordmarks/end cards via Remotion}} |
| **Music / Audio** | {{music-audio}} |

---

## B-Roll Shots

> Only include if B-roll was identified during the pipeline.

| # | Description | Use During | Purpose |
|---|------------|------------|---------|
{{FOR EACH B-ROLL:}}
| {{N}} | {{b-roll-description}} | {{use-during-panel-or-block}} | {{b-roll-purpose}} |
{{END FOR EACH}}
