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
| ImageEngine | localhost:3002 | Centralized image generation via WisGate with cost/rate management |

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
| ImageEngine (wraps WisGate API) | Visual generation from scene prompts via centralized gateway | Storyboard images unavailable; text-only output still deliverable |
| ImageEngine Flash models | Fast scene concept iteration via gemini-3.1-flash or gemini-2.5-flash | Fallback to Pro model only; slower iteration |
| Kling (fal.ai) | Image-to-video generation from scene stills + motion prompts | Storyboard video clips unavailable; still images from NanoBanana still deliverable |

## System Dependencies
_Other Adcelerate systems this system depends on._

| System | Relationship | Purpose |
|--------|-------------|---------|
| PromptWriter | runtime dependency | Centralized prompt engineering knowledge for NanoBanana Pro, Kling, and all generation models. Stage 6 references prompt-writer model files. |

## Reference Files
- NanoBanana prompt guide: `systems/prompt-writer/knowledge/models/image/nanobanana-pro.md` (centralized in PromptWriter)
- Kling video prompt guide: `systems/prompt-writer/knowledge/models/video/kling.md` (centralized in PromptWriter)
- Visual direction: `systems/prompt-writer/knowledge/visual-direction/` (shot types, composition, lighting)

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| IMAGE_ENGINE_URL | http://localhost:3002 | ImageEngine API base URL |
