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
image_provider: "higgsfield (gpt_image_2) — image-engine fallback"
output_dir: "client/{{client-slug}}/storyboards/{{project-slug}}"
---

# {{project-name}}

{{subtitle — e.g., "15s Product Ad — Composite Storyboard Sheet + Cinematic Video Prompt"}}

---

## PROJECT SPECIFICATIONS

| | |
|---|---|
| **Duration** | {{total-duration}} |
| **Format** | {{aspect-ratio}} ({{landscape-or-vertical}}) |
| **Sheets** | {{sheet-count}} @ ≤15s each |
| **Panels** | {{panel-count}} |
| **Style** | {{video-style}} |
| **Product** | {{product-name}} |
| **Model/Talent** | {{model-description}} |
| **Setting** | {{setting-description}} |
| **Audio** | {{audio-description}} |
| **Image Provider** | Higgsfield (GPT Image 2) — ImageEngine fallback |

---

## STYLE ANCHOR

{{style-anchor-content}}

---

## REFERENCE SHEETS

> Omit this entire section if Stage 4.5 was skipped (no character/product reference sheets generated).

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

> If a reference sheet failed to generate, the image line renders `_failed — retry at Stage 4.5 [M]_`.

---

## FULL SCRIPT

{{full-script}}

---

## VOICE SCRIPT

{{voice-script-or-N/A}}

---

## STORYBOARD SHEET(S)

{{FOR EACH ≤15s BLOCK:}}

### Sheet {{S}} — {{block-label, e.g. 00:00–00:15}}

![storyboard-sheet-{{S}}]({{sheet-path-or-url}})

**Phase 1 Prompt** (the exact continuous A–H prompt used to generate this sheet):
```
{{phase-1-prompt}}
```

| Panel | Timecode | Shot Type | Caption |
|-------|----------|-----------|---------|
{{FOR EACH PANEL IN SHEET:}}
| {{N}} | {{start}}–{{end}} | {{shot-type}} | {{caption}} |
{{END FOR EACH}}

{{END FOR EACH}}

---

## PHASE 2 — CINEMATIC VIDEO PROMPT

```
{{production-header — sheet reference, character/product consistency mandate, style block, focus block}}

SHOT 1 — {{SCENE NAME}}  [{{x}}s – {{y}}s]
{{shot type + camera, scene direction, dialogue, SFX, camera movement}}

SHOT 2 — {{SCENE NAME}}  [{{y}}s – {{z}}s]
{{...}}

{{... one shot per panel ...}}

Audio: Diegetic sound only — natural ambience, environmental foley, and subject-driven sound.
```

*Companion note: {{pacing choices, shots to watch, optional audio/music pairing}}*

---

## PRODUCTION NOTES

| Category | Details |
|----------|---------|
| **Color Palette** | {{color-palette}} |
| **Lighting** | {{lighting-description}} |
| **Camera** | {{camera-style}} |
| **Text / Type** | {{Sheet text rendered by GPT Image 2; brand wordmarks/end cards via Remotion}} |
| **Music** | {{music-description}} |

---

## B-ROLL SHOTS (optional)

> Only include if B-roll was identified during the pipeline.

| # | B-Roll Name | Use During | Audio / Text |
|---|------------|------------|--------------|
{{FOR EACH B-ROLL:}}
| {{N}} | **{{b-roll-name}}** | {{use-during-panel-or-block}} | {{b-roll-audio}} |
{{END FOR EACH}}

---

{{product-name}} | {{tagline}} | {{website}}
