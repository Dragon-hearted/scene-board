---
system: "scene-board"
type: dependencies
version: 2
lastUpdated: "2026-05-29"
lastUpdatedBy: builder-knowledge
---

# Dependencies — SceneBoard

## Environment Prerequisites
_Required on the machine, but NOT package.json dependencies._

| Prerequisite | Install | Purpose |
|--------------|---------|---------|
| **ImageEngine HTTP service** | run the `image-engine` system (default `http://localhost:3002`) | The SOLE image transport. SceneBoard performs all image generation through ImageEngine over HTTP. ImageEngine selects the underlying provider (GPT Image 2 is its default) and centralizes auth, cost, and rate limiting. |

> SceneBoard talks ONLY to ImageEngine. It omits `model` on each request so ImageEngine serves its default GPT Image 2 provider, then downloads the result to disk. See `src/image-provider.ts` for the façade logic.

## Runtime Dependencies
_Required for the system to execute._

| Dependency | Version | Purpose |
|-----------|---------|---------|
| md-to-pdf | ^5.2.4 | PDF storyboard generation from the markdown template |
| ImageEngine | localhost:3002 | **Sole** image transport — centralized generation with cost/rate management; GPT Image 2 is its default provider |

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
| remotion | TBD | Downstream text-heavy scene rendering (title cards, CTAs) |

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
| ImageEngine (wraps WisGate + provider fleet) | **Sole** composite-sheet + reference-sheet image transport; GPT Image 2 is its default provider | If ImageEngine is unavailable, text-only storyboard still deliverable (prompts + Phase 2) |

## System Dependencies
_Other Adcelerate systems this system depends on._

| System | Relationship | Purpose |
|--------|-------------|---------|
| image-engine | runtime (sole image transport) | ImageEngine HTTP service; GPT Image 2 is its default provider |
| PromptWriter | runtime dependency | Centralized prompt-engineering knowledge. Phase 1/reference-sheet generation references `systems/prompt-writer/knowledge/models/image/gpt-image-2.md` and the storyboard-prompt-builder methodology. |

## Reference Files
- GPT Image 2 storyboard-sheet prompt guide: `systems/prompt-writer/knowledge/models/image/gpt-image-2.md` (centralized in PromptWriter)
- Phase 1/Phase 2 methodology: `knowledge/storyboard-prompt-builder.md`
- Legacy NanoBanana Pro guide: `knowledge/nanobanana-pro-prompt-guide.md` (retained for reference; superseded)

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| IMAGE_ENGINE_URL | http://localhost:3002 | ImageEngine API base URL (sole image transport) |
