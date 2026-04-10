---
project: "{{project-name}}"
client: "{{client-name}}"
platform: "{{platform}}"
aspect_ratio: "{{aspect-ratio}}"
duration: "{{total-duration}}"
scenes: "{{scene-count}}"
date: "{{date}}"
status: "draft"
output_dir: "systems/scene-board/clients/{{client-slug}}/storyboards"
---

# {{project-name}} — Storyboard

## Project Overview
- **Client**: {{client-name}}
- **Platform**: {{platform}}
- **Aspect Ratio**: {{aspect-ratio}}
- **Total Duration**: {{total-duration}}
- **Total Scenes**: {{scene-count}}
- **Video Type**: {{video-type}}
- **Goal**: {{video-goal}}

---

## Style Anchor

{{style-anchor-content}}

---

## Full Script

{{full-script}}

---

## Voice Script

{{voice-script-or-N/A}}

---

## Scene Breakdown

{{FOR EACH SCENE:}}

### Scene {{N}} — {{scene-title}}

**Timestamp**: {{start-time}} → {{end-time}} ({{duration}})

#### Script
> {{script-line}}

#### Voice Script
> {{voice-script-line-or-N/A}}

#### On-Screen Text
> {{on-screen-text-or-N/A}}

#### Visual Direction
{{visual-direction-prose}}

#### NanoBanana Pro Prompt

**Render Method**: {{nanobanana-pro | remotion}}
**Creative Mode**: {{Faithful | Expressive | Vision | Image Asset}}

**System Instruction** ({{char-count}} chars):
```
{{system-instruction}}
```

**Prompt** ({{char-count}} chars):
```
{{prompt-text}}
```

> Remember: All NanoBanana Pro prompts must end with "No text in image." to prevent garbled text artifacts.

**Reference Images**:
1. {{reference-description-1}}
2. {{reference-description-2}}
3. {{reference-description-3}}

#### Kling Video Prompt

**Mode**: image-to-video
**Duration**: {{5s | 10s}}
**Source**: Scene {{N}} NanoBanana Pro output

**Motion & Animation Direction**:
```
{{motion-direction — how the subject moves, gestures, physics, expressions changing, secondary motion like wind/reflections/background}}
```

**Camera Motion**:
```
{{camera-motion — static, slow pan, tracking, dolly, handheld drift, push in, orbit, etc.}}
```

**Negative Prompt**:
```
{{negative-terms — e.g. morphing, sliding feet, cartoonish, 3D render, floating limbs, jittery motion, text morphing}}
```

> Note: Kling prompts describe motion and camera only. The visual scene is inherited from the NanoBanana Pro source image. Scenes rendered via Remotion (text cards) do not get Kling prompts.

---

{{END FOR EACH}}

## Production Notes

{{any-additional-notes}}
