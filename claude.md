# Claude Project Instructions

This file contains instructions for Claude AI when working with this project.

## Project Overview

This is an Idle Game PWA (Progressive Web App) project.

## Project Structure

```
.
├── deploy/              # GitHub Pages deployment folder
│   ├── index.html       # Main HTML file with PWA meta tags
│   ├── manifest.json    # PWA manifest configuration
│   ├── sw.js            # Service Worker for offline functionality
│   ├── app.js           # App logic and PWA registration
│   ├── styles.css       # Styling
│   ├── .nojekyll        # Disable Jekyll processing
│   └── icons/           # App icons
│       ├── icon-192.svg
│       └── icon-512.svg
├── .github/workflows/   # GitHub Actions workflows
├── claude.md            # This file - Claude instructions
├── readme.md            # Project documentation
└── LICENSE              # License file
```

## Development Guidelines

- All deployable web content goes in the `deploy/` folder
- GitHub Pages automatically deploys from the `deploy/` folder on push to main/master
- The PWA supports offline functionality via Service Workers

## Live Demo

The app is deployed at: https://bjuergens.github.io/claudetest123/
