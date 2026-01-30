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
