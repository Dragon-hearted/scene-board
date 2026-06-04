<div align="center">

![SceneBoard](images/hero.svg)

### Brief-to-storyboard CLI for short-form video

![Status](https://img.shields.io/badge/Status-active-brightgreen)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-Runtime-f9f1e1?logo=bun&logoColor=000)](https://bun.sh/)

</div>

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🏗 Architecture](#-architecture)
- [🛠 Tech Stack](#-tech-stack)
- [🚀 Getting Started](#-getting-started)
- [🚀 Usage](#-usage)
- [⚙️ Configuration](#️-configuration)
- [💻 Development](#-development)
- [📂 Project Structure](#-project-structure)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Two-phase storyboard deliverable** | Turns a video brief into a Phase 1 composite storyboard SHEET image plus a Phase 2 cinematic video prompt, via a dynamic approval-gated pipeline (orchestrateStoryboard, src/orchestrate.ts). |
| **Composite multi-panel storyboard sheet (Phase 1)** | Renders ONE multi-panel sheet image per block — header bar, numbered panel grid, and per-panel timecodes + one-line shot captions baked into a single render — not one image per scene (src/storyboard-sheet-prompt.ts, sections A–H). |
| **Phase 2 cinematic video prompt** | Per-shot timed prompt (timecode, SHOT N, shot type + camera, scene direction, dialogue, SFX, camera-movement verb) ready to paste into an AI video tool; always ends with the fixed Audio closing line (src/video-prompt.ts). |
| **≤15s multi-sheet splitting** | Videos longer than 15s split into N sheets (one per ≤15s block) with continuing timecodes across sheets (splitIntoSheets, src/storyboard-sheet-prompt.ts). |
| **Variable-duration timecoded panels** | Panels may span more than one second; per-panel timecodes must sum to the sheet's ≤15s window with a grid-sized panel cap (assignTimecodes, validateSheet). |
| **Adaptive grid mapping** | Panel count maps to a grid — 9→3×3, 12→3×4, 15→3×5 (default), 20→4×5 — with rows×cols flipped for vertical 9:16 (gridForPanelCount). |
| **4-view character reference sheets** | Generates a character sheet on neutral grey — FULL BODY FRONT / FULL BODY REAR / FRONT CLOSE-UP / PROFILE CLOSE-UP — filling [INSERT DESIRED STYLE] from the Style Anchor (composeCharacterSheetPrompt). |
| **4-view product reference sheets** | Generates a photorealistic product sheet on neutral grey — FRONT THREE-QUARTER / REAR STRAIGHT-ON / FRONT CLOSE-UP / PROFILE LEFT (composeProductSheetPrompt). A storyboard may combine multiple character AND product sheets. |
| **brand_category-routed reference reuse** | Reads brand_category (clothing \| product \| service) from client/{client}/brand.md to route caching: clothing → per-storyboard sheets; product/service → reusable common sheets (readBrandCategory, resolveSheetDir). |
| **Reuse-vs-new model identity branch** | For clothing brands, re-renders a cached model identity (passed as reference images) wearing newly selected garments, or generates a fresh model (reuseModelIdentity). |
| **Reference-image identity lock** | All approved reference sheets feed into composite-sheet generation as references, capped at the provider limit (~8 Higgsfield paths / 3 ImageEngine ids), prioritizing subjects appearing earliest/most often (resolveSheetReferences). |
| **Style Anchor system** | A locked Style Anchor (palette, render style, lighting, camera/character/product rules) is folded into every sheet and reference-sheet prompt to enforce cross-panel/cross-sheet visual consistency. |
| **Dynamic approval-gated workflow** | Every component (script, voice script, on-screen text, scene breakdown, visual direction, sheet, video prompt) is locked if provided in the brief, or generated as ≥2 options behind an [A]pprove/[M]odify/[R]eject gate if missing. |
| **Aporto-primary provider façade with Higgsfield + ImageEngine fallbacks** | `generateImage()` (src/image-provider.ts) calls the Aporto skill network (skill 67 "GPT Image Text-to-Image 2 2K") first, falls through to the Higgsfield CLI (`gpt_image_2`) when `APORTO_API_KEY` is unset, and finally to the ImageEngine HTTP service (`gpt-image-2` → `gpt-image-1.5`) on any Aporto/Higgsfield failure. Logs which transport served. |
| **Reference-based iterate flow** | Change one panel by passing the approved sheet back as a reference with a 'reproduce exactly, change only Panel N' instruction and regenerating the full sheet; full-sheet re-runs and Phase 2 regeneration without redoing the pipeline (.claude/skills/scene-board/iterate-storyboard.md). |
| **Client brand-profile management** | Per-client brand profiles under client/{client}/ (brand.md positioning, voice, visual direction, brand_category) auto-loaded into the pipeline (.claude/skills/scene-board/manage-client.md). |
| **PDF storyboard generation** | scripts/generate-pdf.sh converts a storyboard markdown into a styled A4 PDF via md-to-pdf, embedding the sheet image(s), Phase 1 prompt, panel/timecode table, and Phase 2 prompt (templates/pdf-styles.css). |
| **Markdown storyboard assembly** | Assembles the final storyboard document from templates/storyboard-template.md, embedding generated sheet images into the markdown (src/storyboard-assembler.ts). |
| **Platform-aware output** | Aspect ratio, grid orientation, duration limits, and pacing adapt to the target platform (9:16 Reels/TikTok/Shorts, 16:9 YouTube, 1:1 feed); sheet count = ceil(duration / 15s). |

---

## 🏗 Architecture

![Pipeline](images/pipeline.svg)

SceneBoard processes data through a multi-stage pipeline.

---

## 🛠 Tech Stack

### Backend

| Technology | Purpose |
|------------|---------|
| **TypeScript 5.7** | Type safety |
| **Bun** | JavaScript runtime & package manager |

---

## 🚀 Getting Started

### Prerequisites

- Bun v1.0+ — curl -fsSL https://bun.sh/install | bash (verified with bun 1.3.6)
- **Aporto API key** (PRIMARY image transport, runtime env) — get from https://app.aporto.tech/settings → Settings → API keys. When set, the pipeline routes image generation through Aporto's skill network (skill 67 "GPT Image Text-to-Image 2 2K"). When unset, the provider silently falls back to Higgsfield → ImageEngine.
- Higgsfield CLI (FALLBACK image transport, environment prerequisite — NOT a package.json dep) — `npm install -g @higgsfield/cli` (or the install.sh / brew higgsfield-ai/tap/higgsfield). Verified: higgsfield 0.1.40. Only used when `APORTO_API_KEY` is unset.
- Higgsfield auth — one-time `higgsfield auth login` (opens browser; creds in ~/.config/higgsfield). Unauthenticated → automatic ImageEngine fallback.
- ImageEngine HTTP service (FINAL FALLBACK image transport) running at http://localhost:3002 — used whenever Aporto and Higgsfield are both unavailable/unauthenticated/fails.
- md-to-pdf (installed via `bun install`; package.json dep ^5.2.4) — only needed for PDF output. Verified: 5.2.5.

### Install

```bash
cd systems/scene-board
bun install
```

---

## 🚀 Usage

### 1. Install dependencies

```bash
cd systems/scene-board && bun install
```

> **Expected:** Resolves and installs deps (@aporto-tech/sdk, md-to-pdf, @biomejs/biome, typescript, @types/bun). VERIFIED: '171 packages installed'.

### 2. Run the test suite

```bash
bun test
```

> **Expected:** VERIFIED: 98 pass, 0 fail, 214 expect() calls across 6 files (prompt composer, video prompt, reference sheet, higgsfield client, provider fallback, Aporto integration).

### 3. Lint / format check

```bash
bun run lint
```

> **Expected:** VERIFIED: 'Checked 29 files ... No fixes applied' (biome check clean). Use `bun run check` to auto-fix.

### 4. Build for production

```bash
bun run build
```

> **Expected:** VERIFIED: 'Bundled 1 module' → dist/index.js (system metadata entry point; the storyboard flow itself is a library + skill).

### 5. Check Higgsfield CLI auth (primary image transport)

```bash
bun run higgsfield-auth
```

> **Expected:** Runs `higgsfield account status`. VERIFIED authenticated: prints account email, plan, and remaining credits. Unauthenticated/exit≠0 → pipeline falls back to ImageEngine.

### 6. Confirm the GPT Image 2 model surface (no credits consumed)

```bash
higgsfield model get gpt_image_2 --json
```

> **Expected:** VERIFIED: JSON schema for gpt_image_2 — params aspect_ratio (1:1|4:3|3:4|16:9|9:16|3:2|2:3, default 1:1), quality (low|medium|high, default high), resolution (1k|2k|4k, default 2k), prompt (required), medias[], batch_size. Requires Higgsfield auth.

### 7. See the skill-driven entry notice (there is no storyboard CLI)

```bash
bun run storyboard   # or: just storyboard
```

> **Expected:** VERIFIED: prints 'scene-board is skill-driven — invoke the scene-board skill ... orchestrateStoryboard() ... is a library entry only' and exits 1. This is intentional, not an error.

### 8. Create a storyboard (the real flow — via the skill, in Claude Code)

```bash
Invoke the `scene-board` skill (see .claude/skills/scene-board/SKILL.md), then choose [GS] Generate Storyboard
```

> **Expected:** Runs the 8-stage approval-gated pipeline → composite sheet image(s) + Phase 2 video prompt + storyboard markdown under client/{client}/storyboards/{project}/. requires Higgsfield auth (or ImageEngine fallback) — not executed as a shell command (skill-driven, calls orchestrateStoryboard()).

### 9. Render a storyboard markdown to PDF

```bash
bun run generate-pdf path/to/storyboard.md   # or: bash scripts/generate-pdf.sh <input.md> [output.pdf]
```

> **Expected:** Converts the markdown to a styled A4 PDF via md-to-pdf (templates/pdf-styles.css), embedding sheet image(s), Phase 1 prompt, panel/timecode table, Phase 2 prompt. Requires an input storyboard .md — not executed (no sample storyboard present).

### Command Reference

| Command | Description |
|---------|-------------|
| `just --list` | List all justfile recipes (dotenv-load enabled). |
| `bun run dev` | Run src/index.ts in watch mode (system metadata entry). |
| `bun run build` | Bundle src/index.ts to dist/ (bun --target bun). |
| `bun test` | Run the bun test suite (91 tests). |
| `bun run lint` | biome check . (lint/format gate). |
| `bun run check` | biome check --write . (auto-fix lint/format). |
| `bun run storyboard  (alias: just sheet)` | Prints the skill-driven entry notice and exits 1 — no standalone CLI. |
| `bun run higgsfield-auth` | higgsfield account status — check the primary image-transport auth. |
| `bun run generate-pdf <input.md> [output.pdf]` | Convert a storyboard markdown to a styled PDF (scripts/generate-pdf.sh + md-to-pdf). |

---

## ⚙️ Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `APORTO_API_KEY` | No (recommended) | Aporto API key. When set, the pipeline routes image generation through the Aporto skill network (skill 67 — GPT Image 2 2K). Get one at https://app.aporto.tech/settings. When unset, the provider falls back to the Higgsfield CLI then the ImageEngine HTTP service. |
| `IMAGE_ENGINE_URL` | No | Base URL of the ImageEngine fallback HTTP service. Defaults to http://localhost:3002. The justfile loads a local .env (set dotenv-load). |
| `IMAGE_ENGINE_TIMEOUT_MS` | No | Per-request timeout for the ImageEngine HTTP call (ms). Defaults to 120000. |
| `HIGGSFIELD_BIN` | No | Path to the Higgsfield CLI binary. Defaults to `higgsfield` (must be on `$PATH`). |

### Maintainer attribution (`integration_id`)

The repository carries a code-level `integration_id` constant in `src/aporto.ts` (`"APORTO_INTEGRATION_ID"`) that is sent with every Aporto call so usage from this distributed code can be attributed back to the maintainer per the Aporto referral program.

This is **not** a secret and **not** an env var. It is intentionally committed to source so attribution cannot be silently turned off by a user. Before merging the integration upstream, replace the placeholder with your own integration ID from the Aporto Dashboard (https://app.aporto.tech). Runtime authentication still uses `APORTO_API_KEY`.

The Aporto skill IDs (67 = GPT Image 2 2K, 68 = GPT Image 2 1K) were picked once via `aporto discover` during integration and are pinned in `src/aporto.ts` as `APORTO_SKILLS`. End users do not need to run discovery at runtime.

### Aporto skill pricing (per generation request)

Prices are quoted in USD per single image generation, as returned by `aporto discover` at integration time. Each sheet the pipeline generates costs one request. A 12-sheet storyboard therefore costs roughly the per-request price × 12.

| Aporto skill | Model | Resolution | Price per request |
|---|---|---|---|
| **67** (primary, used by default) | GPT Image Text-to-Image 2 | 2K | **$0.05** |
| **68** (fallback) | GPT Image Text-to-Image 2 | 1K | **$0.03** |
| 66 | GPT Image Text-to-Image 2 | 4K | $0.08 |
| 275 | GPT Image Text-to-Image 1.5 | (n/a) | $0.02 |
| 274 | GPT Image Image-to-Image 1.5 | (n/a) | $0.02 |
| 63 | GPT Image Image-to-Image 2 | 4K | $0.08 |
| 64 | GPT Image Image-to-Image 2 | 2K | $0.05 |
| 65 | GPT Image Image-to-Image 2 | 1K | $0.03 |

These are Aporto's published per-request prices, not discounts. New Aporto accounts may qualify for a promotional **sign-up bonus of up to $3** in free credits (see the Aporto Dashboard for current terms and eligibility). Discounts and referral terms are governed by the Aporto program and change — check the dashboard before quoting numbers to end users.

---

## 💻 Development

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development mode |
| `bun run build` | Build for production |
| `bun test` | Run tests |
| `bun run lint` | Check code quality |

---

## 📂 Project Structure

```
scene-board/
├── README.md
├── biome.json
├── images
│   ├── hero.svg
│   └── pipeline.svg
├── justfile
├── knowledge
│   ├── acceptance-criteria.md
│   ├── dependencies.md
│   ├── domain.md
│   ├── higgsfield-cli.md
│   ├── history.md
│   ├── index.md
│   ├── nanobanana-pro-prompt-guide.md
│   ├── scope.md
│   └── storyboard-prompt-builder.md
├── package.json
├── scripts
│   └── generate-pdf.sh
├── src
│   ├── batch-generator.ts
│   ├── higgsfield-client.test.ts
│   ├── higgsfield-client.ts
│   ├── image-client.ts
│   ├── image-provider.test.ts
│   ├── image-provider.ts
│   ├── index.ts
│   ├── orchestrate.ts
│   ├── reference-sheet-generator.ts
│   ├── reference-sheet.test.ts
│   ├── storyboard-assembler.ts
│   ├── storyboard-sheet-prompt.test.ts
│   ├── storyboard-sheet-prompt.ts
│   ├── types
│   │   └── character.ts
│   ├── video-prompt.test.ts
│   └── video-prompt.ts
├── templates
│   ├── examples
│   │   ├── storyboard-sheet-example-1.png
│   │   └── storyboard-sheet-example-2.png
│   ├── pdf-storyboard-template.md
│   ├── pdf-styles.css
│   └── storyboard-template.md
├── tsconfig.json
└── vendor
    └── design-system
        └── tokens.css
```

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and ensure tests pass
4. Commit your changes and open a pull request

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with** 🧡 **using Bun, TypeScript**

</div>
