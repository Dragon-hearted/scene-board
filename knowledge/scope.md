# SceneBoard — Scope

## Description
SceneBoard is a CLI-driven storyboard creation system that transforms video briefs (scripts, reference videos, voice scripts, or raw ideas) into professional storyboards complete with scripts, timestamps, voice scripts, and NanoBanana Pro prompts for visual generation — leveraging the best available marketing, sales, social media, and ads skills.

## In Scope
- Accept flexible brief formats: full script, reference video link with proposed changes, voice script only, or raw idea
- Fully dynamic approval workflow — for every storyboard component (script, voice script, visual direction, timestamps, etc.):
  - If provided in the brief → lock into it, no generation needed
  - If NOT provided → generate multiple options → present for approval
  - This applies uniformly to all parts: script, voice script, scene breakdowns, visual direction, NanoBanana prompts, etc.
  - Final step: curate the complete storyboard document from all approved components
- Script generation using marketing, sales, social media, user engagement, and ads domain skills
- Professional storyboard output with: scene descriptions, timestamps, script lines, voice script, and visual direction
- NanoBanana Pro prompt generation for each scene/visual
- Reference image guidance alongside prompts (what to look for, what to generate)
- CLI interface with interactive approval gates
- Knowledge gathering phase — collect all context needed before generation begins

## Out of Scope
- Direct visual/image generation (future integration — prompts only for now)
- Video rendering or editing
- Audio/voiceover generation
- Direct integration with NanoBanana Pro API (outputs prompts, does not call the API)
- Client-facing web UI (CLI only for v1)

## Inputs
- Video brief (one or more of: script, reference video link, voice script, raw idea, proposed changes)
- Client/brand context (brand voice, target audience, platform, goals)
- Any reference materials the user provides

## Outputs
- Professional storyboard document containing:
  - Scene-by-scene breakdown with timestamps
  - Final approved script
  - Voice script (narration/dialogue per scene)
  - Visual direction per scene
  - NanoBanana Pro prompts per scene for visual generation
  - Reference image guidance per scene

## Target Users
- Internal creative team (storyboard creation for client projects)
- Client-facing team (presenting storyboards to clients for approval)
- Future: expanded use cases as the system evolves
