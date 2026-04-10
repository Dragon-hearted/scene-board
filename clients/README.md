# SceneBoard Clients Directory

This directory contains client-specific brand knowledge, storyboards, and creative assets used by the SceneBoard system.

## Directory Convention

Each client gets a subdirectory named with their brand slug (lowercase, hyphenated):

```
clients/
  {client-slug}/
    brand.md              # Compiled brand profile (quick-reference)
    knowledge/            # Detailed brand knowledge files
      brand-positioning.md  # Full brand positioning & strategy
      visual-direction.md   # Visual identity & art direction
      {topic}.md            # Additional knowledge as needed
    storyboards/          # Generated storyboard outputs
      {project-name}/     # One directory per storyboard project
```

## Conventions

- **brand.md** is the quick-reference compiled profile. It should contain everything needed to generate on-brand creative in a single file.
- **knowledge/** holds detailed reference documents that expand on specific aspects of the brand (positioning strategy, visual identity, voice guidelines, etc.).
- **storyboards/** stores generated storyboard outputs organized by project.
- All files use markdown format for agent readability.
- Brand slugs should be lowercase with hyphens (e.g., `vindof`, `almost-gods`).

## Adding a New Client

1. Create the directory: `clients/{brand-slug}/`
2. Add `brand.md` with the compiled brand profile
3. Add detailed knowledge files under `knowledge/`
4. Create an empty `storyboards/` directory for outputs
