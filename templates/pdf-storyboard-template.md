---
project: "{{project-name}}"
client: "{{client-name}}"
platform: "{{platform}}"
aspect_ratio: "{{aspect-ratio}}"
duration: "{{total-duration}}"
scenes: "{{scene-count}}"
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

## Project Specifications

| Field | Details |
|-------|---------|
| **Client** | {{client-name}} |
| **Platform** | {{platform}} |
| **Aspect Ratio** | {{aspect-ratio}} |
| **Total Duration** | {{total-duration}} |
| **Total Scenes** | {{scene-count}} |
| **Video Type** | {{video-type}} |
| **Goal** | {{video-goal}} |
| **Date** | {{date}} |
| **Status** | {{status}} |

---

## Style Anchor

{{style-anchor-content}}

---

## Scene-by-Scene Breakdown

| Seq | Scene Name | Visual Action & Composition | Audience Sees | Audio / Text |
|-----|-----------|---------------------------|---------------|-------------|
{{FOR EACH SCENE:}}
| {{N}} | {{scene-title}} | {{visual-direction-prose}} | {{on-screen-text-or-N/A}} | {{script-line}} |
{{END FOR EACH}}

---

## Detailed Scene Cards

{{FOR EACH SCENE:}}

### Scene {{N}} — {{scene-title}}

**Timestamp**: {{start-time}} - {{end-time}} ({{duration}})

| Element | Content |
|---------|---------|
| **Script** | {{script-line}} |
| **Voice Script** | {{voice-script-line-or-N/A}} |
| **On-Screen Text** | {{on-screen-text-or-N/A}} |
| **Visual Direction** | {{visual-direction-prose}} |

#### NanoBanana Pro Prompt

| Parameter | Value |
|-----------|-------|
| **Render Method** | {{nanobanana-pro or remotion}} |
| **Creative Mode** | {{Faithful or Expressive or Vision or Image Asset}} |

**System Instruction** ({{char-count}} chars):

```
{{system-instruction}}
```

**Prompt** ({{char-count}} chars):

```
{{prompt-text}}
```

**Reference Images**: {{reference-descriptions}}

---

{{END FOR EACH}}

## Production Notes

| Category | Details |
|----------|---------|
| **Color Palette** | {{color-palette}} |
| **Lighting** | {{lighting-notes}} |
| **Camera** | {{camera-notes}} |
| **Text Style** | {{text-style}} |
| **Music / Audio** | {{music-audio}} |

---

## B-Roll Shots

| # | Description | Duration | Purpose |
|---|------------|----------|---------|
{{FOR EACH B-ROLL:}}
| {{N}} | {{b-roll-description}} | {{b-roll-duration}} | {{b-roll-purpose}} |
{{END FOR EACH}}
