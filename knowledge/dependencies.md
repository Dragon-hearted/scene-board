---
system: "scene-board"
type: dependencies
version: 1
lastUpdated: "2026-03-26"
lastUpdatedBy: build-mode
---

# Dependencies — SceneBoard

## Runtime Dependencies
_Required for the system to execute._

| Dependency | Version | Purpose |
|-----------|---------|---------|
| (none) | — | SceneBoard is a CLI skill; no runtime npm dependencies required |

## Build Dependencies
_Required for development and building._

| Dependency | Version | Purpose |
|-----------|---------|---------|
| @biomejs/biome | ^1.9.0 | Linting and formatting |
| @types/bun | latest | Bun type definitions |
| typescript | ^5.7.0 | TypeScript compiler |

## Optional Dependencies
_Enhance functionality but not required._

| Dependency | Version | Purpose |
|-----------|---------|---------|
| remotion | TBD | Future: programmatic video/text-heavy scene rendering |

## Skills Referenced
_Adcelerate skills invoked during storyboard generation._

| Skill | Purpose |
|-------|---------|
| ad-creative | Paid ad storyboard structure and hooks |
| copywriting | Script writing and voice script refinement |
| social-content | Platform-native pacing and format guidance |
| marketing-psychology | Emotional arc and persuasion sequencing |
| paid-ads | CTA placement and conversion-focused scripting |
| sales-enablement | Client-facing narrative and objection handling |
| content-strategy | Content pillar alignment and brand voice |

## External Services
_APIs, models, or services the system depends on._

| Service | Purpose | Failure Impact |
|---------|---------|---------------|
| NanoBanana Pro (fal.ai) | Visual generation from scene prompts | Storyboard images unavailable; text-only output still deliverable |
| NanoBanana Flash (Google AI) | Fast scene concept iteration | Fallback to Pro only; slower iteration |
| Kling (fal.ai) | Image-to-video generation from scene stills + motion prompts | Storyboard video clips unavailable; still images from NanoBanana still deliverable |

## Reference Files
- NanoBanana prompt guide: `_bmad/wds/workflows/4-ux-design/data/guides/NANO-BANANA-PROMPT-GUIDE.md`
- Kling video prompt guide: `_bmad/wds/workflows/4-ux-design/data/guides/KLING-VIDEO-PROMPT-GUIDE.md`
