# Idle Game PWA

A simple idle game built as a Progressive Web App (PWA) with TypeScript.

## Live Demo

The app is automatically deployed to GitHub Pages:

**https://bjuergens.github.io/claudetest123/**

Test it directly on your mobile device - the PWA will work perfectly in your browser and can be installed to your home screen!

## PWA Features

- **Installable**: Can be installed on desktop and mobile devices
- **Offline Support**: Works without internet connection using Service Workers
- **Responsive Design**: Adapts to all screen sizes
- **Fast Loading**: Cached resources for instant loading

## Project Structure

```
.
├── src/                 # TypeScript source files
│   └── app.ts           # Main app logic
├── deploy/              # GitHub Pages deployment folder (build output)
│   ├── index.html       # Main HTML file with PWA meta tags
│   ├── manifest.json    # PWA manifest configuration
│   ├── sw.js            # Service Worker for offline functionality
│   ├── app.js           # Compiled from src/app.ts
│   ├── styles.css       # Styling
│   └── icons/           # App icons
├── .github/workflows/   # GitHub Actions for deployment
├── tsconfig.json        # TypeScript configuration
├── package.json         # npm dependencies and scripts
└── LICENSE              # License file
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build and serve:
   ```bash
   # Build once and serve
   npm run serve

   # Or: watch mode with live server (recommended for development)
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

4. The PWA should be installable (look for the install button in your browser)

## Build Commands

```bash
npm run build    # Compile TypeScript to deploy/
npm run watch    # Watch mode - recompile on changes
npm run serve    # Build + start local server
npm run dev      # Watch + serve concurrently
```

## Development

The TypeScript source is in `src/`. The compiled JavaScript goes to `deploy/`, which is served by GitHub Pages.

### Next Steps

- Implement game logic
- Add game state management
- Create resource generation mechanics
- Add upgrade systems
- Implement save/load functionality

## Browser Support

Works in all modern browsers that support:
- Service Workers
- Web App Manifest
- ES6+ JavaScript

## License

See LICENSE file for details.
