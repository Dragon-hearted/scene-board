---
system: "scene-board"
type: index
version: 2
lastUpdated: "2026-05-29"
lastUpdatedBy: builder-knowledge
---

# SceneBoard

## Summary
SceneBoard transforms video briefs of any format into a professional **two-phase storyboard deliverable** through a dynamic, approval-gated workflow: a **Phase 1 composite multi-panel storyboard sheet image** (one per ≤15s block, generated via the Higgsfield CLI using GPT Image 2, with ImageEngine HTTP as the automatic fallback) plus a **Phase 2 cinematic video prompt**. It serves both the internal creative team and the client-facing team, leveraging marketing, sales, social media, and ads skills.

## Entry Points
- **System metadata**: `src/index.ts`
- **Orchestration**: `src/orchestrate.ts` → `orchestrateStoryboard()` (gathers reference sheets → builds Phase 1 prompt per ≤15s sheet → generates via provider → builds Phase 2 prompt)

## Stage Definitions
1. **Brief Intake** — Ingest and parse the video brief (format, platform, tone, goal, audience).
2. **Context Gathering** — Clarify missing information, including `brand_category`, before proceeding.
3. **Dynamic Generation & Approval** — Generate draft script and panel structure; present for approval before continuing.
4. **Scene/Panel Breakdown** — Expand the approved structure into numbered panels with variable-duration timecodes (≤15s per sheet).
5. **Visual Direction** — Lock a Style Anchor and define per-panel visual direction.
6. **Reference Sheet stage (4.5, optional)** — Generate 4-view character/product reference sheets (Higgsfield → ImageEngine fallback), routed by `brand_category`.
7. **Phase 1 — Composite Storyboard Sheet** — Assemble the single A–H prompt and generate one composite sheet image per ≤15s block, passing all reference sheets as references.
8. **Phase 2 — Cinematic Video Prompt** — Emit a per-shot timed cinematic video prompt after sheet approval.
9. **Final Assembly** — Compile the storyboard markdown + PDF embedding the sheet(s), the Phase 1 prompt, the panel/timecode table, and the Phase 2 prompt.

## Key Source Files
- `src/higgsfield-client.ts` — Higgsfield CLI wrapper (primary transport)
- `src/image-client.ts` — ImageEngine HTTP client (fallback transport)
- `src/image-provider.ts` — provider façade (Higgsfield → ImageEngine)
- `src/storyboard-sheet-prompt.ts` — Phase 1 composite-sheet prompt composer (sections A–H, grid mapping, `splitIntoSheets`)
- `src/video-prompt.ts` — Phase 2 cinematic video-prompt composer
- `src/reference-sheet-generator.ts` — 4-view character/product reference-sheet generator + `resolveSheetReferences()`
- `src/orchestrate.ts` — `orchestrateStoryboard()` single orchestration entry
- `src/batch-generator.ts` — **@deprecated** legacy per-scene batch path (retained for historical compile only)

## Knowledge Files
- [Domain Knowledge](domain.md) — Domain expertise and tacit knowledge
- [Scope](scope.md) — System scope, boundaries, and constraints
- [Acceptance Criteria](acceptance-criteria.md) — Hard gates and soft quality criteria
- [Dependencies](dependencies.md) — Environment prerequisites, runtime, build, and optional dependencies
- [History](history.md) — Build, fix, and diagnosis history
- [Higgsfield CLI surface](higgsfield-cli.md) — confirmed CLI flag surface
- [Storyboard prompt builder](storyboard-prompt-builder.md) — Phase 1/Phase 2 methodology

## Cross-References
- Skills: ad-creative, copywriting, social-content, marketing-psychology, paid-ads, sales-enablement, content-strategy, prompt-writer
- GPT Image 2 prompt guide: `systems/prompt-writer/knowledge/models/image/gpt-image-2.md` (centralized in PromptWriter)
- Legacy NanoBanana Pro guide: `knowledge/nanobanana-pro-prompt-guide.md` (retained for reference; superseded)
