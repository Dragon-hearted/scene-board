---
system: scene-board
type: acceptance-criteria
version: 1
lastUpdated: 2026-03-26
lastUpdatedBy: build-mode
---

# SceneBoard — Acceptance Criteria

## Hard Gates

These criteria are binary pass/fail and must all be satisfied before a storyboard is considered complete.

### Brief Intake & Context Gathering

- [ ] System accepts brief in at least one of the following formats: full script, reference video link, voice script only, raw idea, or any combination thereof
- [ ] System identifies and records which storyboard components were provided in the brief vs. which require generation
- [ ] System explicitly asks the user whether a voice script is needed before generating one
- [ ] System explicitly asks the user whether on-screen text is needed before generating it
- [ ] System explicitly asks the user to confirm shot duration and pacing before finalizing the scene breakdown
- [ ] System explicitly asks the user about the target platform before generating visual direction or NanoBanana Pro prompts
- [ ] System explicitly asks the user about the target aspect ratio before finalizing visual direction

### Dynamic Approval Workflow

- [ ] Every storyboard component NOT provided in the brief has a corresponding approval gate before it is locked in
- [ ] Every storyboard component provided in the brief is locked in without regeneration
- [ ] When multiple options are generated for a missing component, at least two distinct options are presented before the user is asked to approve
- [ ] No component proceeds to the next pipeline stage until its approval gate is cleared

### Scene Breakdown

- [ ] Every scene in the storyboard maps to exactly one shot (1 scene = 1 shot = 1 image)
- [ ] Every scene has an associated timestamp (start time and duration)
- [ ] The total scene duration matches the confirmed video duration
- [ ] Every scene has an associated voice script line if a voice script was confirmed as needed
- [ ] Every scene has associated on-screen text if on-screen text was confirmed as needed

### Character Sheet (Stage 4.5, optional)

- [ ] When ≥2 protagonists are detected in the approved scene breakdown, a Character Sheet section exists in the final storyboard — unless the user explicitly declined at the offer prompt, and the decline is recorded in the pipeline log
- [ ] Every character in the Character Sheet has a non-empty `lockedDescription` and all 6 views generated (`body-front`, `body-back`, `face-front`, `face-back`, `face-left`, `face-right`) — or an explicit `_failed_` marker in the storyboard cell for any missing view
- [ ] The anchor view (`body-front`) is always generated with NanoBanana Pro (`gemini-3-pro-image-preview`); non-anchor views may use Flash (`gemini-2.5-flash-image`)
- [ ] Every scene that features a named character from the Character Sheet includes exactly one view of that character (angle-matched via `pickViewForScene`) in its resolved `referenceImageIds`, subject to the 3-ref cap, with characters ordered by script appearance
- [ ] When >3 characters appear in one scene, the resolved reference list contains one view for each of the first 3 characters (no Scene-1 anchor, no explicit refs)
- [ ] On approval at the Stage 4.5 gate, the 6 PNG view files and `character.md` frontmatter are cached under `systems/scene-board/clients/{client}/characters/{slug}/` for future reuse

### NanoBanana Pro Prompts

- [ ] Every scene has exactly one NanoBanana Pro prompt
- [ ] No individual prompt exceeds 8192 characters
- [ ] No system instruction within any prompt exceeds 512 characters
- [ ] No scene references more than 3 reference images
- [ ] Every prompt explicitly specifies one of the four creative modes: Faithful, Expressive, Vision, or Image Asset
- [ ] Every scene that requires text rendering (title cards, CTAs, text overlays) is marked for Remotion treatment rather than NanoBanana Pro generation

### Image Generation

- [ ] Every scene with a NanoBanana Pro prompt has a corresponding generated image (or explicit "generation pending" marker if generation failed)
- [ ] Independent scenes are generated in parallel (not sequentially)
- [ ] Scenes that reference another scene's output are generated after their dependency
- [ ] Budget is checked before batch generation begins; user is warned if batch would exceed token ceiling
- [ ] Generated images are accessible via ImageEngine gallery URLs in the storyboard
- [ ] Aspect ratio in generation requests matches the storyboard's declared platform aspect ratio

### Kling Video Prompts

- [ ] Every scene that has a NanoBanana Pro prompt also has a corresponding Kling video prompt
- [ ] Scenes rendered via Remotion (text cards, CTAs) do NOT have Kling video prompts
- [ ] Every Kling prompt specifies mode as `image-to-video`
- [ ] Every Kling prompt specifies a duration (`5s` or `10s`)
- [ ] Every Kling prompt includes a motion & animation direction section describing subject movement
- [ ] Every Kling prompt includes a camera motion section
- [ ] Every Kling prompt includes a negative prompt
- [ ] No Kling prompt re-describes the visual scene (motion only — visuals come from the NanoBanana source image)

### Storyboard Document Structure

- [ ] The final storyboard document contains all of the following sections: scene-by-scene breakdown, timestamps, approved script (if applicable), approved voice script (if applicable), on-screen text (if applicable), visual direction per scene, NanoBanana Pro prompts per scene, reference image guidance per scene
- [ ] Each scene block is self-contained — all information needed to generate and assemble that scene is present within it
- [ ] Scenes that require Remotion for text rendering are clearly distinguished from pure image generation scenes

### Partial Re-Run Support

- [ ] System allows re-running a specified subset of scenes (e.g., scenes 3–5) without regenerating approved scenes
- [ ] Re-running a scene does not reset or invalidate any other scene's approval state
- [ ] System preserves pipeline state between sessions to support surgical revisions

### Platform Compliance

- [ ] The storyboard specifies the target platform
- [ ] The specified aspect ratio is consistent with the target platform (9:16 for Reels/TikTok/Shorts, 16:9 for YouTube, 1:1 for feed posts)
- [ ] Total video duration is within the accepted range for the target platform

---

## Soft Criteria

These criteria require human judgment. They are assessed by reviewing the final storyboard document before client delivery.

### Professional Presentation Quality

The storyboard must read as a unified, polished creative deliverable — not a collection of generated fragments. **Document formatting** should be consistent throughout: fonts, scene numbering, spacing, and section headings should follow a clear hierarchy. **Section completeness** means no placeholder text, no TODO markers, and no unresolved approval gates remain in the final document. The overall impression when opening the storyboard should be that a skilled creative director assembled it — the "client gets flattened" standard is the benchmark.

### Script Quality and Brief Fidelity

The approved script must honor the intent, energy, and feeling of the original brief — even when the brief was vague or minimal. **Brief fidelity** is the primary signal: a reader familiar with the original brief should immediately recognize that the script captures what was asked for. **Audience engagement mechanics** should be present and appropriate to the video type: hooks in the first 2–3 seconds for ads, emotional narrative arcs for brand stories, pattern interrupts for social content. **Framework appropriateness** is evaluated by whether the chosen marketing/persuasion framework matches the video's goal — a product ad should not read like a brand story, and a TikTok should not read like a LinkedIn post. For vague briefs, the script should show creative interpretation that elevates the material rather than defaulting to generic language.

### Visual Direction Coherence

Each scene's visual direction must be specific enough that a designer could execute it without additional instructions. **Specificity** means the direction names the subject, environment, camera angle, lighting mood, and any key compositional elements. **Narrative alignment** is the signal that the visual reinforces what's being said or heard at that moment in the video — the image and the script line must work together, not in parallel. **Style consistency** across all scenes is critical: the visual language (color palette, photographic style, degree of abstraction, character design) should feel like a single coherent piece of work, not a collection of unrelated images.

### NanoBanana Pro Prompt Accuracy

The #1 failure mode is prompt/visual mismatch — prompts that generate the wrong product, the wrong style, or visuals that feel generic. **Prompt specificity** is the primary signal: each prompt must name the product or subject concretely, specify the brand's visual identity elements, and include enough compositional detail that the generated image would immediately be recognized as belonging to this storyboard. **Reference image alignment** means any reference images cited in a scene's guidance are stylistically and compositionally consistent with the prompt — they should reinforce the same visual direction, not introduce contradictions. **Mode selection appropriateness** should be evaluated: Faithful mode for product accuracy, Expressive for creative campaigns, Vision for abstract/conceptual scenes, Image Asset for isolated graphics.

### Kling Video Prompt Quality

The Kling video prompts should read as confident directorial instructions — not vague suggestions. **Motion specificity** is the primary signal: prompts should describe physics, timing, and gesture with enough detail that the generated clip would match the storyboard's intent. "She walks across the court" is insufficient; "She strolls with one hand in her pocket, camp collar shirt swaying with each step, wavy hair bouncing slightly" gives the model actionable physics. **Camera intent** must serve the narrative — a push-in during a reveal, static for a calm moment, handheld drift for POV shots. Camera motion that contradicts the scene's emotional beat fails this criterion. **Source image coherence** means the motion described must be physically possible given what's shown in the NanoBanana anchor frame — no contradictions between the still and the motion direction.

### Platform and Pacing Awareness

The storyboard's rhythm must feel native to the target platform. **Pacing** is assessed by reviewing shot durations: ads (15–30s) should have short, high-impact shots; TikTok/Reels should feel fast-cut; brand stories (60s+) should have longer holds that allow emotional beats to land. **Tone calibration** means the script's voice and the visual direction's energy match the platform's content norms — LinkedIn requires professional restraint, TikTok rewards authenticity and energy, YouTube allows more depth. A storyboard that would feel out of place if natively published on its target platform fails this criterion.

### Contradictory Brief Resolution

When a brief contains apparent contradictions (e.g., "fun but corporate," "luxury but accessible"), the storyboard must show evidence of a deliberate resolution strategy. **Research-informed approach** is the signal — the chosen direction should reference or be inspired by examples of successful executions of similar tensions in the market. **Approval coverage** means the resolution approach was presented to the user before the storyboard was built around it, and the user approved the direction. A storyboard that ignores the contradiction or defaults to one extreme without acknowledgment fails this criterion.

### Reference Video Interpretation (when applicable)

When the brief included a reference video link, the storyboard must demonstrate that the reference was analyzed with care. **Selective preservation** is the key signal: elements the client wanted to keep (composition, pacing, style, structure) should be clearly reflected in the storyboard, while elements the client wanted to change should be absent. The visual direction and scene breakdown should be traceable back to specific aspects of the reference video — not a generic interpretation of the brief description alone.

---

## Validation Notes

### Automated / Programmatic Checks

Hard gates are designed to be verifiable without subjective judgment. The following can be checked by inspecting the storyboard document and pipeline logs:

- **Prompt length**: parse each NanoBanana Pro prompt and assert `len(prompt) <= 8192` and `len(system_instruction) <= 512`
- **Reference image count**: assert no scene has more than 3 reference image entries
- **Creative mode presence**: assert each prompt block contains one of: `Faithful`, `Expressive`, `Vision`, `Image Asset`
- **Scene-shot mapping**: assert the number of scenes equals the number of NanoBanana Pro prompt blocks
- **Timestamp coverage**: assert every scene has a non-empty timestamp field and that timestamps are non-overlapping and sum to the total video duration
- **Approval gate completeness**: pipeline logs should show an approval event for every generated component before it was advanced
- **Remotion flagging**: assert any scene whose on-screen text field is non-empty has a `render: remotion` flag rather than `render: nanobanana`
- **Platform aspect ratio consistency**: assert the declared aspect ratio matches the declared platform using a lookup table
- **Kling prompt presence**: assert every scene with a NanoBanana prompt also has a Kling video prompt block
- **Kling mode check**: assert every Kling prompt block specifies `image-to-video`
- **Kling duration check**: assert every Kling prompt block specifies a duration of `5s` or `10s`
- **Kling motion presence**: assert every Kling prompt block has non-empty motion direction and camera motion fields
- **Kling negative prompt presence**: assert every Kling prompt block has a non-empty negative prompt
- **Character Sheet completeness** (when Stage 4.5 ran): assert every character in the registry has all 6 view keys present with a non-empty `imageId`, or an explicit failed marker in the rendered section
- **Character-view coverage**: for each scene whose visual note references a character slug, assert the scene's `referenceImageIds` contains the image ID returned by `pickViewForScene(character, scene.cameraAngle)` — i.e., the correct angle-matched view is actually threaded into the scene prompt

### Human Review Checklist

Before delivery, a human reviewer should assess the soft criteria by going through the storyboard with the following questions:

1. Does the script feel like the best possible interpretation of the brief — would the client recognize their intent?
2. Does each scene's visual direction give a designer enough information to execute without asking questions?
3. Are the NanoBanana Pro prompts specific to this product/brand, or do they read as generic?
4. Is the visual style consistent across all scenes, or do scenes feel like they belong to different projects?
5. Does the pacing feel native to the target platform?
6. Is the document presentation quality high enough to share directly with a client?
7. If the brief contained contradictions, was the resolution approach surfaced and approved before the storyboard was built?
8. If a reference video was provided, does the storyboard clearly reflect what the client wanted to keep and what they wanted to change?
9. Do the Kling video prompts describe specific, physically plausible motion for each scene?
10. Does the camera motion in each Kling prompt serve the scene's emotional intent?
11. Are the Kling motion directions consistent with what's shown in the NanoBanana anchor images?
