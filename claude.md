# Claude Project Instructions

This file contains instructions for Claude AI when working with this project.

## Project Overview

This is a **Heat Management Idle Game** - a PWA where players manage heat flow on a 16x16 grid to generate power and money. See `GAME_VISION.md` for the full game design document.

## Project Structure

```
.
├── src/                 # TypeScript source files
│   ├── app.ts           # PWA setup and registration
│   └── game/            # Game-specific code
│       ├── HeatGame.ts          # Core game logic (grid, heat, economy)
│       ├── HeatGame.test.ts     # Unit tests for game logic
│       └── HeatGameRenderer.ts  # UI/rendering (canvas, overlays)
├── deploy/              # GitHub Pages deployment folder (compiled output)
│   ├── index.html       # Main HTML file with PWA meta tags
│   ├── manifest.json    # PWA manifest configuration
│   ├── sw.js            # Service Worker for offline functionality
│   ├── styles.css       # Styling
│   └── icons/           # App icons
├── GAME_VISION.md       # Game design document
├── vitest.config.ts     # Test configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies and scripts
├── claude.md            # This file - Claude instructions
└── readme.md            # Project documentation
```

## Architecture

### Game Logic (`HeatGame.ts`)
- Manages 16x16 grid of cells
- Handles heat simulation (generation, transfer, dissipation)
- Structure management (building, breaking, meltdowns)
- Power generation and money economy
- Event system for UI updates

### Renderer (`HeatGameRenderer.ts`)
- Canvas-based grid visualization
- Heat overlay with color gradients
- Structure rendering with symbols
- Mouse interaction handling
- Build menu and UI panels

## Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run dev          # Build + serve with hot reload
```

## Development Guidelines

- All source code goes in `src/`
- TypeScript compiles to `deploy/` folder
- Game logic should be tested - add tests for new features
- Keep game logic separate from rendering (MVC pattern)
- The PWA supports offline functionality via Service Workers

## Live Demo

The app is deployed at: https://bjuergens.github.io/claudetest123/
