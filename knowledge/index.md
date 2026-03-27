---
system: "scene-board"
type: index
version: 1
lastUpdated: "2026-03-26"
lastUpdatedBy: build-mode
---

# SceneBoard

## Summary
SceneBoard transforms video briefs of any format into professional storyboards through a dynamic, approval-gated workflow. It serves both the internal creative team and client-facing team, leveraging marketing, sales, social media, and ads skills to produce scripts, scene breakdowns, timestamps, voice scripts, visual direction, and NanoBanana Pro prompts.

## Entry Points
- **Main**: `src/index.ts`

## Stage Definitions
1. **Brief Intake** — Ingest and parse the video brief (format, platform, tone, goal, audience)
2. **Context Gathering** — Clarify missing information via targeted questions before proceeding
3. **Dynamic Generation & Approval** — Generate draft script and scene structure; present for approval before continuing
4. **Scene Breakdown** — Expand approved structure into full scene-by-scene breakdowns with timestamps
5. **Visual Direction** — Add framing, composition, and visual direction notes per scene
6. **NanoBanana Prompt Generation** — Produce NanoBanana Pro image prompts for each scene
7. **Final Assembly** — Compile the complete storyboard document with all layers

## Knowledge Files
- [Domain Knowledge](domain.md) — Domain expertise and tacit knowledge
- [Scope](scope.md) — System scope, boundaries, and constraints
- [Acceptance Criteria](acceptance-criteria.md) — Hard gates and soft quality criteria
- [Dependencies](dependencies.md) — Runtime, build, and optional dependencies
- [History](history.md) — Build, fix, and diagnosis history

## Cross-References
- Skills: ad-creative, copywriting, social-content, marketing-psychology, paid-ads, sales-enablement, content-strategy
- External guide: `_bmad/wds/workflows/4-ux-design/data/guides/NANO-BANANA-PROMPT-GUIDE.md`
