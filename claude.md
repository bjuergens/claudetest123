# Claude Project Instructions

## Project Overview

Heat Management Idle Game - a PWA where players manage heat flow on a 16x16 grid to generate power and money. See `GAME_VISION.md` for full game design.

## Project Structure

```
src/
  constants.ts           # Shared game constants (GRID_SIZE, CELL_SIZE, etc.)
  app.ts                 # PWA setup and game initialization
  game/
    HeatGame.ts          # Core game logic (grid, heat, economy)
    HeatGame.test.ts     # Unit tests
    HeatGameRenderer.ts  # Canvas rendering and UI
deploy/                  # GitHub Pages deployment (compiled output)
e2e/                     # Playwright e2e tests
```

## Architecture

- **constants.ts** - Single source of truth for game constants
- **HeatGame.ts** - Pure game logic, no DOM dependencies
- **HeatGameRenderer.ts** - Canvas rendering and UI, depends on HeatGame
- **app.ts** - PWA registration, game loop, event wiring

## Error Handling Philosophy

**Fail fast.** Let errors surface immediately so we can fix them.

- **Don't silently swallow exceptions** - at minimum log a warning, but prefer not catching at all
- **Methods should check preconditions** and throw if context is invalid
- **No unnecessary null checks** - if we get null pointer errors, the game crashes and we fix it
- **Null checks are OK** when methods legitimately return null (e.g., `getCell` for out-of-bounds)
- **The game loop has a top-level try-catch** that:
  - Stops the game gracefully
  - Logs the error and game state to console
  - Shows a crash banner to the user
- **It's OK for the game to crash** from unexpected exceptions - we want to know about bugs

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run unit tests
npm run test:e2e     # Run e2e tests
npm run dev          # Build + serve with hot reload
```

## Guidelines

- Game logic must be testable without DOM
- Keep rendering separate from game state
- Add tests for new game features
- PWA supports offline via Service Workers

## Live Demo

https://bjuergens.github.io/claudetest123/
