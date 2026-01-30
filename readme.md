# Heat Management Idle Game

A PWA idle game where you manage heat flow on a 16x16 grid to generate power and money.

## Live Demo

**https://bjuergens.github.io/claudetest123/**

Works on mobile and desktop. Can be installed to your home screen.

## Features

- Place fuel rods, ventilators, turbines, and more
- Manage heat transfer to avoid meltdowns
- Generate power and earn money
- Offline support via Service Workers
- Installable as a PWA

## Project Structure

```
src/
  constants.ts           # Shared game constants
  app.ts                 # PWA setup and game initialization
  game/
    HeatGame.ts          # Core game logic
    HeatGame.test.ts     # Unit tests
    HeatGameRenderer.ts  # Canvas rendering
deploy/                  # Build output (GitHub Pages)
e2e/                     # End-to-end tests
```

## Development

```bash
npm install      # Install dependencies
npm run build    # Compile TypeScript
npm test         # Run unit tests
npm run dev      # Build + serve with hot reload
```

## Browser Support

Works in all modern browsers with Service Worker support.
