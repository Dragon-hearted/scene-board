# SceneBoard — Domain Knowledge

## Process Overview
SceneBoard takes a video brief of any format and produces a professional storyboard through a dynamic, approval-gated workflow. The system intelligently detects what's provided in the brief and only generates what's missing.

### Steps
1. **Brief Intake** — Accept the brief in any format (Instagram link with changes, detailed document, raw idea, script, voice script, etc.). Parse and identify which storyboard components are already provided vs. need generation.
2. **Context Gathering** — Collect all additional information needed: brand context, target audience, platform, goals, whether voice script and on-screen text are both needed, etc.
3. **Dynamic Generation & Approval Loop** — For each missing component, generate multiple options using the best available marketing/sales/social/ads skill frameworks, present for approval, and lock in once approved. Components include: script, voice script, scene breakdown, visual direction, etc.
4. **Scene Breakdown** — Break the approved script into individual shots. Each shot = one scene = one image to generate. The number of images equals the number of shots.
5. **Visual Direction** — For each scene, determine the best visuals that reflect the story and are understandable by the audience.
6. **NanoBanana Pro Prompt Generation** — Generate optimized NanoBanana Pro prompts for each scene to produce the required visuals.
7. **Final Storyboard Assembly** — Curate the complete storyboard document with all approved components, prompts, and reference guidance.

## Domain Concepts
- **Brief**: The input to SceneBoard. Can be anything — an Instagram link with proposed changes, a detailed document with everything specified, a raw idea, a script, a voice script, or any combination. There is no fixed format.
- **Shot/Scene**: A single continuous visual in the video. Each shot change marks a new scene. One shot = one image to generate via NanoBanana Pro.
- **NanoBanana Pro**: Image generation model (fal.ai `fal-ai/nanobanana-pro`). Key constraints: 8192 char prompt limit, 512 char system instruction, up to 3 reference images. Creative modes: Faithful (exact adherence), Expressive (creative liberties), Vision (artistic concept), Image Asset (single photo/illustration). Known limitation: all text rendering is garbled. Full prompt guide at `_bmad/wds/workflows/4-ux-design/data/guides/NANO-BANANA-PROMPT-GUIDE.md`.
- **NanoBanana (Flash)**: Faster/cheaper variant via Google AI (Gemini 2.0 Flash Exp). Good for iterations and single assets. Pro tier recommended for final storyboard visuals.
- **Voice Script**: Narration/dialogue audio for the video. Not always needed — SceneBoard asks whether the video requires it.
- **On-Screen Script/Text**: Text overlays that appear visually in the video. Not always needed — SceneBoard asks whether the video requires it.
- **Dynamic Workflow**: The core design principle — any component provided in the brief is locked in; any component missing is generated with options for approval. This applies uniformly to every part of the storyboard.

## Quality Standards

### Hard Requirements
- Storyboard must look professional — presentation quality that impresses clients on sight
- Script must be the best possible interpretation of the given brief
- NanoBanana Pro prompts must accurately match the visual direction for each scene — no mismatch between what's described and what the prompt will generate
- Reference images must align with the prompts and visual direction — no mismatches
- Shot duration/pacing must be confirmed with the user (no assumptions)
- Voice script and on-screen text inclusion must be explicitly confirmed with the user before generating

### Quality Signals
- **"Client gets flattened"** — the storyboard is so good that the client is immediately impressed and convinced
- Script uses the best audience engagement tactics available (hooks, emotional triggers, persuasion frameworks from marketing/psychology skills)
- Vague briefs are interpreted by capturing the key points, feelings, and energy of what was given — then producing the best possible output that honors that intent
- Prompts and reference images are cohesive and clearly convey the intended visual for each scene
- The complete document reads as a unified, professional creative deliverable

### Rejection Criteria
- Storyboard doesn't look professional
- NanoBanana Pro prompts and reference guidance are mismatched or low quality
- Script doesn't capture the brief's intent, energy, or feeling
- Visual direction doesn't reflect the story or isn't understandable by the audience

## Edge Cases & Gotchas

### Common Failures
- **Prompt/visual mismatch**: The #1 problem. NanoBanana Pro prompts produce visuals that don't match the product, don't fit the required style, or feel generic. SceneBoard must ensure prompts are highly specific to the product/brand and style direction.
- **Style inconsistency**: Generated visuals across scenes don't maintain a consistent style. Prompts must enforce style coherence across the entire storyboard.

#### Style Anchor System
To prevent style inconsistency across scenes, SceneBoard uses a Style Anchor mechanism:

1. **Style Anchor Document**: At the start of visual direction (Stage 5), generate a "Style Anchor" that defines: color palette, photographic/illustration style, degree of abstraction, lighting mood, camera style conventions, and character/product representation rules.
2. **Lock-in**: The Style Anchor is presented to the user for approval before any scene-level prompts are generated. No prompts are written until the anchor is locked in.
3. **Enforcement**: Every NanoBanana Pro prompt must include the Style Anchor's constraints as a prefix/preamble, ensuring all scenes share the same visual language. This is non-negotiable — prompts without the anchor preamble will produce visually unrelated images.
4. **Override**: Individual scenes can override specific Style Anchor properties if the narrative requires it (e.g., a flashback scene shifting to desaturated tones), but overrides must be explicit and intentional — clearly marked in the prompt and approved by the user.

### Non-Obvious Behaviors

#### Contradictory Briefs
When a brief has contradictions (e.g., "fun but corporate"), SceneBoard should:
1. Research if similar combinations have been done successfully in the market
2. Take inspiration from proven examples that balanced those tensions
3. If no precedent exists, be extremely creative in finding a resolution
4. Present the approach to the user for approval before proceeding

#### Reference Video Links (Instagram, etc.)
When a client provides a video link as a brief:
- Analyze the video carefully — shot composition, style, pacing, transitions, tone
- Interpret the client's intent from their instructions alongside the video:
  - "We want something like this" = recreate the style/structure with their product
  - "Similar style and shots but with X changes" = keep the template, swap specified elements
  - Client can also ask for complete style changes while keeping the structure, or vice versa
- The key: understand what the client wants to keep vs. what they want to change

#### Platform-Aware Storyboards
Storyboard output must adapt to the target platform:
- Aspect ratio (9:16 for Reels/TikTok/Shorts, 16:9 for YouTube, 1:1 for feed posts, etc.)
- Duration constraints per platform
- Tone and pacing norms (fast-cut for TikTok, longer takes for YouTube, professional for LinkedIn)
- These should be asked during context gathering

#### Partial Re-Runs
SceneBoard must support re-running parts of the pipeline after revisions:
- Regenerate specific scenes (e.g., scenes 3-5 only) without redoing the entire storyboard
- Re-prompt specific NanoBanana generations while keeping approved scenes intact
- Pipeline state must be preserved to enable surgical revisions

#### Text-Heavy Scenes
Since NanoBanana Pro cannot render text reliably (garbled output):
- For title cards, CTA screens, text overlays — use Remotion skill for text rendering
- Future: find a better alternative to handle text in visuals
- Storyboard should clearly mark which scenes need text overlay treatment vs. pure image generation

## Tacit Knowledge

### Decision Heuristics

#### Framework Selection System
SceneBoard must autonomously determine the best marketing/engagement framework by:
1. Analyzing the brief — what type of video is it? (ad, showcase, explainer, testimonial, brand story, etc.)
2. Asking the user targeted questions to fill gaps in understanding
3. Cross-referencing available skills (ad-creative, copywriting, marketing-psychology, social-content, etc.) to select the right approach
4. Matching framework to intent:
   - Selling a product/service → hook → problem → solution → CTA
   - Brand awareness → storytelling, emotional narrative
   - Social proof / testimonials → trust-building framework
   - Product showcase → feature-driven, visual-first approach
   - Engagement/viral → pattern interrupt, curiosity loops
5. The system should be smart enough to blend frameworks when a brief calls for it

#### Video Type Determines Structure
- **Ad (15-30s)**: Fast-paced, hook in first 2-3 seconds, tight CTA, minimal scenes, high impact per shot
- **Product showcase**: Feature-focused, clean visuals, let the product speak, moderate pacing
- **Brand story (60s+)**: Narrative arc, emotional build, more scenes with longer holds
- **Social content (Reels/TikTok)**: Trend-aware, fast cuts, attention-grabbing hooks, native feel
- **Explainer**: Problem → solution flow, clear visual metaphors, educational pacing
- Duration and platform fundamentally change the storyboard structure, pacing, and number of shots

### Experience-Based Rules
- **Garbage in, gold out**: Even with a vague or minimal brief, SceneBoard's job is to extract the essence — the feeling, energy, and intent — and produce the best possible storyboard. Ask clarifying questions, but don't require a perfect brief to deliver excellent work.
- **Visuals + story alignment = client approval**: Clients approve when the visuals are high quality AND the story is clearly aligned with what they asked for in the brief. Both must be present.
- **The brief is flexible, the output is not**: Accept any input format, but the output must always be a polished, professional storyboard document. No excuses for rough output regardless of input quality.
- **Ask, don't assume**: For anything that could go multiple ways (shot duration, voice script needed, on-screen text needed, platform, aspect ratio), always ask the user rather than making assumptions.
- **Style consistency is enforced through a Style Anchor document generated once and carried into every scene prompt. Without this, scenes drift into visually unrelated images — the #2 failure mode after prompt/visual mismatch.**

## Dependencies
- Marketing/Sales/Social/Ads skills from Adcelerate skill library:
  - `ad-creative` — ad scripts, headlines, variations
  - `copywriting` — marketing copy, CTAs, value propositions
  - `social-content` — social media content creation
  - `marketing-psychology` — behavioral science, persuasion frameworks
  - `paid-ads` — campaign strategy, targeting
  - `sales-enablement` — pitch decks, demo scripts
  - `content-strategy` — editorial planning
- NanoBanana Pro — image generation model via fal.ai. Prompt guide: `_bmad/wds/workflows/4-ux-design/data/guides/NANO-BANANA-PROMPT-GUIDE.md`
- NanoBanana (Flash) — faster variant via Google AI for iterations
- Remotion — for text-heavy scenes (title cards, CTAs) since NanoBanana can't render text

## Input/Output Specifications
### Inputs
- Brief: any format (Instagram link, detailed doc, raw idea, script, voice script, or combination)
- Brand/client context gathered during context phase
- User approval decisions at each gate

### Outputs
- Professional storyboard document containing:
  - Scene-by-scene breakdown (1 scene = 1 shot = 1 image)
  - Timestamps per scene
  - Approved script (if applicable)
  - Approved voice script (if applicable)
  - On-screen text (if applicable)
  - Visual direction per scene
  - NanoBanana Pro prompts per scene
  - Reference image guidance per scene

## NanoBanana Pro — Scene-Level Prompt Guide

The NanoBanana Pro prompt guide (`_bmad/wds/workflows/4-ux-design/data/guides/NANO-BANANA-PROMPT-GUIDE.md`) is written for UX and web design use cases. This section bridges those patterns to video storyboard scene prompts.

### Translating UX Prompt Patterns to Scene Prompts

| UX Prompt Concept | Scene Prompt Equivalent |
|---|---|
| Page layout / sections | Scene composition / foreground-midground-background |
| UI components | Subject, props, environment elements |
| Content fields / copy | Action, gesture, expression |
| Color tokens / design system | Color palette, lighting mood, time of day |
| Typography hierarchy | Visual hierarchy through scale, focus, depth of field |
| Responsive breakpoints | Aspect ratio (9:16, 16:9, 1:1) |

### Scene-Level Prompt Structure

The recommended structure for a storyboard scene prompt:

1. **Creative mode preamble** (Faithful/Expressive/Vision/Image Asset)
2. **Scene context** — what moment in the story this is (e.g., "Opening shot establishing the problem")
3. **Subject** — who/what is in the frame, product placement
4. **Environment** — setting, location, background
5. **Camera** — angle (wide, medium, close-up, overhead), movement suggestion
6. **Lighting** — mood, time of day, key/fill balance
7. **Composition** — rule of thirds placement, leading lines, depth
8. **Style anchor reference** — link back to the style anchor constraints
9. **Brand elements** — logo placement, brand colors, product packaging

### Worked Example

**Scene 3 of 6 — Product Reveal (15s Instagram Reel)**

```
System instruction (480 chars):
"Professional commercial photographer creating a cinematic product shot for a social media ad. Clean, modern aesthetic with warm natural lighting. Product must be the clear focal point. Style: editorial product photography with lifestyle context."

Prompt (1200 chars):
"Close-up product shot of a matte black premium water bottle centered in frame on a light oak desk. Morning golden hour light streaming from the left through floor-to-ceiling windows. Shallow depth of field — bottle sharp, background soft bokeh of a minimalist home office. The bottle catches a subtle highlight along its curved edge. A small green plant and open notebook partially visible in soft focus behind. Color palette: warm neutrals, black product, touches of green. Aspect ratio: 9:16. The mood is calm, aspirational, morning routine. No text in image."
```

**Key differences from UX prompts:**
- Names a specific physical subject (not UI components)
- Describes camera angle and depth of field (not layout structure)
- Specifies lighting mood and time of day (not design tokens)
- Ends with "No text in image" (NanoBanana text limitation)
