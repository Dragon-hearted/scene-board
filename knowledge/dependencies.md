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
| **Higgsfield CLI** | `npm install -g @higgsfield/cli` (or the install.sh / Homebrew tap) | **Primary** image transport. SceneBoard shells out to the global `higgsfield` binary (`higgsfield generate create gpt_image_2 … --wait --json`). Not a package.json dep — the TS wrapper (`src/higgsfield-client.ts`) invokes the binary via Bun's child process. |
| **Higgsfield auth** | `higgsfield auth login` (one-time, opens a browser, ~5s) | Authenticates the CLI; creds live in `~/.config/higgsfield`. When unauthenticated, SceneBoard falls back to ImageEngine automatically. |

> The Higgsfield CLI is the **primary** path; the **ImageEngine HTTP service is the automatic fallback** whenever the CLI is unavailable, unauthenticated, times out, or fails. See `knowledge/higgsfield-cli.md` for the confirmed CLI flag surface and `src/image-provider.ts` for the façade logic.

## Runtime Dependencies
_Required for the system to execute._

| Dependency | Version | Purpose |
|-----------|---------|---------|
| md-to-pdf | ^5.2.4 | PDF storyboard generation from the markdown template |
| ImageEngine | localhost:3002 | **Fallback** image transport — centralized generation via WisGate with cost/rate management (`gpt-image-2` → `gpt-image-1.5` retry) |

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
| Higgsfield (GPT Image 2 via CLI) | **Primary** composite-sheet + reference-sheet generation | Automatic fallback to ImageEngine HTTP; storyboard still produced |
| ImageEngine (wraps WisGate API) | **Fallback** image transport (`gpt-image-2` / `gpt-image-1.5`) | If both Higgsfield and ImageEngine fail, text-only storyboard still deliverable (prompts + Phase 2) |

## System Dependencies
_Other Adcelerate systems this system depends on._

| System | Relationship | Purpose |
|--------|-------------|---------|
| Higgsfield | runtime (primary image transport, env prerequisite) | GPT Image 2 generation via the global CLI |
| image-engine | runtime (fallback image transport) | ImageEngine HTTP service; stays `active` |
| PromptWriter | runtime dependency | Centralized prompt-engineering knowledge. Phase 1/reference-sheet generation references `systems/prompt-writer/knowledge/models/image/gpt-image-2.md` and the storyboard-prompt-builder methodology. |

## Reference Files
- GPT Image 2 storyboard-sheet prompt guide: `systems/prompt-writer/knowledge/models/image/gpt-image-2.md` (centralized in PromptWriter)
- Higgsfield CLI surface: `knowledge/higgsfield-cli.md`
- Phase 1/Phase 2 methodology: `knowledge/storyboard-prompt-builder.md`
- Legacy NanoBanana Pro guide: `knowledge/nanobanana-pro-prompt-guide.md` (retained for reference; superseded)

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| IMAGE_ENGINE_URL | http://localhost:3002 | ImageEngine API base URL (fallback transport) |
