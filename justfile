# scene-board
set dotenv-load := true

# `sheet` is an alias for the (skill-driven) storyboard entry notice
alias sheet := storyboard

# List all recipes
default:
  @just --list

# Run in development mode (watch)
dev:
  bun run dev

# Run tests
test:
  bun test

# Build for production
build:
  bun run build

# Lint code
lint:
  bun run lint

# Check and fix formatting
check:
  bun run check

# Storyboard generation is SKILL-DRIVEN (no standalone CLI). This recipe only
# prints guidance; the real flow runs through the scene-board skill, which calls
# orchestrateStoryboard() (src/orchestrate.ts) as a library entry.
storyboard *ARGS:
  @echo 'scene-board is skill-driven — invoke the scene-board skill (see .claude/skills/scene-board/SKILL.md).' >&2
  @echo 'There is no standalone CLI; src/orchestrate.ts exports orchestrateStoryboard() as a library entry only.' >&2
  @exit 1

# Check Higgsfield CLI auth status (primary image transport; falls back to ImageEngine when unauthenticated)
higgsfield-auth:
  higgsfield account status
