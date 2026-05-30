# Higgsfield CLI — GPT Image 2 surface (confirmed)

SceneBoard's **primary** image path shells out to the globally-installed `higgsfield`
CLI to generate images with the `gpt_image_2` model. The **ImageEngine HTTP service
stays active as the automatic fallback** (used whenever the CLI is unavailable,
unauthenticated, or fails). This note records the confirmed CLI surface so the
TS wrapper (`src/higgsfield-client.ts`) and provider façade (`src/image-provider.ts`)
can be wired without re-running live discovery.

> Discovery was performed live by the team lead against CLI **v0.1.40**
> (`higgsfield 0.1.40 … built 2026-05-12`). Do **not** re-run `higgsfield auth login`
> or guess flags — the facts below are authoritative. Re-confirm the model schema
> anytime with `higgsfield model get gpt_image_2 --json`.

## Prerequisite (environment, not an npm dep)

The `higgsfield` binary is installed globally — it is **not** a package.json
dependency. Install one of:

```bash
npm install -g @higgsfield/cli
# or: curl -fsSL https://raw.githubusercontent.com/higgsfield-ai/cli/main/install.sh | sh
# or: brew install higgsfield-ai/tap/higgsfield
```

One-time auth (opens a browser, ~5s) — **already done on this machine**, creds
live in `~/.config/higgsfield`:

```bash
higgsfield auth login
```

## Generate invocation (the command the wrapper builds)

```bash
higgsfield generate create gpt_image_2 \
  --prompt "…composite storyboard sheet prompt…" \
  --aspect_ratio 16:9 \
  --quality high \
  --resolution 2k \
  [--image <path-or-id>]... \
  --wait --json
```

### Flags & enums (confirmed)

| Flag | Values | Default | Notes |
|------|--------|---------|-------|
| `--prompt` | free text | — | The full prompt body. GPT Image 2 has no separate system slot. |
| `--aspect_ratio` | `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `3:2`, `2:3` | `1:1` | Sheets use **`16:9`** (landscape); vertical uses **`9:16`**. |
| `--quality` | `low`, `medium`, `high` | `high` | |
| `--resolution` | `1k`, `2k`, `4k` | `2k` | |
| `--image` | path or uploaded media id | — | **Reference image. REPEATABLE** (pass once per ref), role `image`. Supports 1+ up to **~8** references. Local file paths auto-upload. (Contrast: ImageEngine fallback caps at **3** refs.) |
| `--wait` | flag | off | Blocks until the job finishes, then prints the result. |
| `--wait-timeout` | duration | `10m` | e.g. `--wait-timeout 5m`. |
| `--wait-interval` | duration | `3s` | Poll interval while waiting. |
| `--json` | global flag | off | Machine-readable output. With `--wait`, prints the **final job object array** on stdout. |

### Output shape & download

`--wait --json` prints the completed job as a **JSON array of job objects** on
stdout. The wrapper parses it for the **result media URL** (the generated image is
returned as a URL, not bytes), then downloads it to the target path via `fetch` →
write file. Expect a structure along the lines of an array where each job object
carries the output media (URL field) once status is completed; parse defensively
(search nested `url`/`media`/`output` fields) since exact key names may shift
across CLI minor versions.

## Auth check

The wrapper exposes `checkAuth()`. Implement it with a cheap call (e.g.
`higgsfield account status`, or attempt a lightweight model query) and treat
output/stderr containing `Session expired`, `Not authenticated`, or a non-zero
exit as **unauthenticated** → surface a typed `HiggsfieldAuthError` so the
provider falls back to ImageEngine.

## Error mapping (for typed errors in the wrapper)

- Non-zero exit / parse failure → `HiggsfieldCliError`
- Wait exceeded `--wait-timeout` → `HiggsfieldTimeoutError`
- Unauthenticated / session expired → `HiggsfieldAuthError`

The provider façade treats **any** of these as a trigger to fall back to the
ImageEngine HTTP client (`image-client.generateSingle`, `gpt-image-2` →
`gpt-image-1.5` retry).

## Authoritative references

- Skill: `.agents/skills/higgsfield-generate/SKILL.md`
- `.agents/skills/higgsfield-generate/references/media-inputs.md` (reference-image
  handling, `--image` semantics)
- `.agents/skills/higgsfield-generate/references/model-catalog.md` (model list +
  per-model flag support)
- Live schema: `higgsfield model get gpt_image_2 --json`
