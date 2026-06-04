---
system: "scene-board"
type: execution
driver: skill
skill: scene-board
mode: delegate
gates: native
version: 1
lastUpdated: "2026-06-04"
lastUpdatedBy: build-mode
---

# Execution — SceneBoard

How Execute Mode (`/adcelerate-execute`) runs this system. Execute Mode reads ONLY this manifest to decide how to run, then branches on `driver`.

## Invocation
Invoke the `scene-board` skill via the Skill tool, relaying the engineer's task input (the brief / script / references). Do NOT reconstruct its stages — the skill owns its own dynamic, approval-gated pipeline (see `.claude/skills/scene-board/SKILL.md`).

## Natural flow (awareness only — the system drives this on the skill path)
The skill runs its 8-stage pipeline end-to-end with its own gates:

0. **Client Selection** — identify client; load brand profile + `brand_category` from `client/`.
1. **Brief Intake** — parse the brief; classify each component as provided or missing.
2. **Context Gathering** — confirm brand, platform, audience, goals; fill gaps.
3. **Dynamic Generation & Approval** — generate options for every missing component; approval gates.
4. **Scene Breakdown** — variable-duration panels with timecodes (≤15s per sheet).
   - **4.5 Reference Sheets (optional)** — 4-view character/product sheets, routed by `brand_category`.
5. **Visual Direction** — lock the Style Anchor + per-panel direction.
6. **Phase 1 Composite Sheet + Phase 2 Cinematic Video Prompt** — generate the sheet(s), then the video prompt after sheet approval.
7. **Final Assembly** — compile the storyboard markdown + PDF.

## Where the agent must check / supply input
- **Client selection (stage 0)** — relay which client the storyboard is for (or "no client / one-off").
- **Missing brand_category / platform / audience (stage 2)** — supply these if the brief or loaded brand profile does not already cover them.
- **Relay the skill's [A]/[M]/[R] approval gates** at every generation step — especially generation & approval (stage 3), visual direction / Style Anchor (stage 5), and the Phase 1 sheet and Phase 2 video prompt (stage 6). The skill owns these gates; the executor only passes the engineer's [A]/[M]/[R] choice through.

## Validation
After the skill completes, validate the output against [acceptance-criteria.md](acceptance-criteria.md) (hard gates inline, soft criteria via the validator). Applies to both drivers.
