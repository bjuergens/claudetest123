# Idle Game PWA

A simple idle game built as a Progressive Web App (PWA).

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
├── deploy/              # GitHub Pages deployment folder
│   ├── index.html       # Main HTML file with PWA meta tags
│   ├── manifest.json    # PWA manifest configuration
│   ├── sw.js            # Service Worker for offline functionality
│   ├── app.js           # App logic and PWA registration
│   ├── styles.css       # Styling
│   └── icons/           # App icons
├── .github/workflows/   # GitHub Actions for deployment
├── claude.md            # Claude AI instructions
└── LICENSE              # License file
```

## Local Development

1. Serve the files from the deploy folder using a local web server:
   ```bash
   # Using Python
   cd deploy && python3 -m http.server 8000

   # Using Node.js
   npx serve deploy
   ```

2. Open your browser and navigate to `http://localhost:8000`

3. The PWA should be installable (look for the install button in your browser)

## Development

The basic PWA infrastructure is now in place. Ready to add idle game mechanics!

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
