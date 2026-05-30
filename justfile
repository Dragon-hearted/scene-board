# scene-board
set dotenv-load := true

# `sheet` is an alias for the composite storyboard generation entry
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

# Generate a storyboard: composite sheet(s) (≤15s/block) + Phase 2 video prompt
# via Higgsfield CLI (GPT Image 2) → ImageEngine fallback. Runs orchestrateStoryboard.
storyboard *ARGS:
  bun run src/orchestrate.ts {{ARGS}}

# Check Higgsfield CLI auth status (primary image transport; falls back to ImageEngine when unauthenticated)
higgsfield-auth:
  higgsfield account status
