# Aporto Integration Memory — scene-board

## Repository
- **Original:** https://github.com/Dragon-hearted/scene-board
- **Fork:** https://github.com/aporto-tech/scene-board
- **Branch:** `aporto-integration`
- **Local:** `/home/ubuntu/hermes-agent/work/scene-board-fork`
- **Upstream head:** `ecbc975 docs: rich Features + step-by-step Usage README (#6)`
- **TypeScript / Bun runtime** — pure TypeScript, no compiled output expected.

## Existing AI Providers Found
1. **Higgsfield CLI** (PRIMARY image transport) — `gpt_image_2`
   - `src/higgsfield-client.ts:102` — `Bun.spawn(['higgsfield', 'generate', 'create', 'gpt_image_2', …])`
   - Requires global `@higgsfield/cli` binary + `higgsfield auth login`
2. **ImageEngine HTTP** (FALLBACK) — chain `gpt-image-2` → `gpt-image-1.5`
   - `src/image-provider.ts:81-82` — declared constants
   - `src/image-client.ts` — fetch POST `${IMAGE_ENGINE_URL}/api/generate` (default `http://localhost:3002`)
3. **ImageEngine declared but unused** (type-only): `gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`, `gemini-2.5-flash-image`
   - `src/image-client.ts:9-12` (WisGateModel type)

## Aporto Discovery Results (no key required)

Query: `"gpt image text to image"` — top 10:
| Skill ID | Name | Price | Sim | Input types |
|---|---|---|---|---|
| 67 | **GPT Image Text-to-Image 2 2K** | $0.05 | 0.65 | prompt, image |
| 68 | GPT Image Text-to-Image 2 1K | $0.03 | 0.64 | prompt, image |
| 66 | GPT Image Text-to-Image 2 4K | $0.08 | 0.64 | prompt, image |
| 275 | GPT Image Text-to-Image 1.5 | $0.02 | 0.65 | prompt, image |
| 64 | GPT Image Image-to-Image 2 2K | $0.05 | 0.59 | image, prompt |
| 65 | GPT Image Image-to-Image 2 1K | $0.03 | 0.59 | image, prompt |
| 63 | GPT Image Image-to-Image 2 4K | $0.08 | 0.59 | image, prompt |
| 274 | GPT Image Image-to-Image 1.5 | $0.02 | 0.59 | image, prompt |

## Discovery Decision
- **Chosen PRIMARY:** skill **67** — "GPT Image Text-to-Image 2 2K"
  - Maps directly to Higgsfield's `gpt_image_2` (same backend: KIE)
  - 2K is scene-board's default resolution (`resolution: "2k"` in provider request)
  - Text + image input → matches our usage (optional reference images)
- **Chosen FALLBACK:** skill **68** — "GPT Image Text-to-Image 2 1K"
  - Maps to ImageEngine's `gpt-image-1.5` chain endpoint
  - Cheaper, lower resolution — graceful degradation
- **Rejected:** skill 66 (4K, $0.08 — more expensive than repo needs)
- **Rejected:** skill 64/65/63/274 (image-to-image variants — wrong direction; we need text-to-image)

## Trial Run Verification
`npx @aporto-tech/sdk aporto run 67 --param prompt="a sunset" --no-wait`
- Response: `{"success":true,"trial":true,"status":"running","runId":"e523f5cc-…","skillId":67,"skillName":"GPT Image Text-to-Image 2 2K","provider":"KIE - gpt image 2, text-to-image, 2k","costUSD":0.05}`
- Trial mode works **without `APORTO_API_KEY`** — confirms provider, schema, pricing
- Full poll requires `APORTO_API_KEY` (skipping for CI; documented in README)

## Files Changed (planned)
| File | Change |
|---|---|
| `src/aporto.ts` (new) | Aporto client + pinned `APORTO_SKILLS` + `integration_id` + `runSkill` wrapper |
| `src/aporto.test.ts` (new) | Unit tests: missing key, skill selection, params, error path, attribution header |
| `src/image-provider.ts` | Add Aporto as PRIMARY (or after Higgsfield), preserve Higgsfield+ImageEngine as fallback chain |
| `src/image-client.ts` | Leave intact (still fallback), no breaking changes |
| `src/higgsfield-client.ts` | Leave intact, no changes (fallback only) |
| `package.json` | No new runtime deps (use SDK as `npx` not import) — or `@aporto-tech/sdk` if we use SDK directly |
| `.env.example` (new) | `APORTO_API_KEY=…` placeholder |
| `README.md` | New "Aporto" section: setup, integration_id explainer, skill IDs source |
| `.gitignore` | Confirm `.env` excluded |

## Which Calls Were Converted
- **Phase 1 composite-sheet image generation** (the ONE AI call in the entire codebase)
- All other "models" mentioned in `knowledge/` and `video-prompt.ts` are pure text prompts (not API calls) — NOT routed through Aporto

## Tests Run
- `bun test` — pending (will run after code complete)
- Trial run via `aporto run 67` — ✅ confirmed provider+schema

## Open Issues / Assumptions
- **SDK vs raw HTTP:** using `@aporto-tech/sdk` 0.6.0 (latest) via `import { AportoClient }` for the runtime client. Discovery is via `npx aporto discover` (no key needed).
- **AportoClient integration:** SDK uses `apiKey` + `integrationId` first-class options, so attribution is clean. If SDK is too heavy, fall back to raw `fetch` to `https://api.aporto.tech/v1/skills/.../run`.
- **`integration_id` is code-level placeholder** `"APORTO_INTEGRATION_ID"` — maintainer replaces before merge.
- **Trial runs** are free + keyless; production runs require `APORTO_API_KEY` env at runtime.
- **`Higgsfield` + `ImageEngine` stay as fallbacks** for users who want zero Aporto dependency.

## Hard Rules Compliance
- ❌ No PR before manual approval — STOP after push
- ❌ No ready-to-merge PR — only `gh pr create --draft`
- ❌ No `APORTO_API_KEY` in source
- ❌ No `integration_id` in `.env.example`
- ❌ No discovery in runtime
- ❌ No unrelated refactors
- ❌ Return shapes preserved (imageUrl always present; localPath optional)
