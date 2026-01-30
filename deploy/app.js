import { HeatGame } from './game/HeatGame.js';
import { HeatGameRenderer } from './game/HeatGameRenderer.js';
// State
let deferredPrompt = null;
let waitingServiceWorker = null;
// DOM Elements
const installButton = document.getElementById('install-button');
const updateButton = document.getElementById('update-button');
const statusElement = document.getElementById('pwa-status');
const canvas = document.getElementById('game-canvas');
const gameUI = document.getElementById('game-ui');
// Update PWA status display
function updatePWAStatus(status) {
    if (statusElement) {
        statusElement.textContent = status;
    }
}
// Show update available button
function showUpdateButton() {
    if (updateButton) {
        updateButton.style.display = 'block';
    }
}
// Hide update button
function hideUpdateButton() {
    if (updateButton) {
        updateButton.style.display = 'none';
    }
}
// Handle SW update click
function handleUpdateClick() {
    if (waitingServiceWorker) {
        waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    }
}
// Register Service Worker with update detection
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
            console.log('Service Worker registered:', registration.scope);
            updatePWAStatus('Registered');
            // Check for updates on registration
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker)
                    return;
                console.log('SW: Update found, new worker installing...');
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New SW is installed but waiting
                        console.log('SW: New version available');
                        waitingServiceWorker = newWorker;
                        showUpdateButton();
                        updatePWAStatus('Update available');
                    }
                });
            });
            // Check if there's already a waiting worker
            if (registration.waiting) {
                waitingServiceWorker = registration.waiting;
                showUpdateButton();
                updatePWAStatus('Update available');
            }
        })
            .catch((error) => {
            console.error('Service Worker registration failed:', error);
            updatePWAStatus('Registration failed');
        });
        // Reload page when new SW takes over
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing)
                return;
            refreshing = true;
            console.log('SW: Controller changed, reloading...');
            window.location.reload();
        });
    });
}
// Update button click handler
if (updateButton) {
    updateButton.addEventListener('click', handleUpdateClick);
}
// PWA Install functionality
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installButton) {
        installButton.style.display = 'block';
    }
    updatePWAStatus('Ready to install');
});
if (installButton) {
    installButton.addEventListener('click', async () => {
        if (!deferredPrompt)
            return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        if (outcome === 'accepted') {
            updatePWAStatus('Installed');
        }
        deferredPrompt = null;
        if (installButton) {
            installButton.style.display = 'none';
        }
    });
}
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    updatePWAStatus('Installed');
    deferredPrompt = null;
});
// Initialize status on load
window.addEventListener('load', () => {
    if (!('serviceWorker' in navigator)) {
        updatePWAStatus('Not supported');
    }
    else if (window.matchMedia('(display-mode: standalone)').matches) {
        updatePWAStatus('Running as app');
    }
});
// ============================================
// Game Initialization
// ============================================
function initGame() {
    if (!canvas) {
        console.error('Game canvas not found');
        return;
    }
    // Create game instance
    const game = new HeatGame(500);
    // Create renderer
    const renderer = new HeatGameRenderer(game, canvas, {
        cellSize: 28,
        gridPadding: 8,
    });
    // Setup UI if container exists
    if (gameUI) {
        renderer.createUI(gameUI);
    }
    // Handle cell clicks
    renderer.onCellClick((x, y, button) => {
        if (button === 0) {
            // Left click - build selected structure
            const structure = renderer.getSelectedStructure();
            if (game.canBuild(x, y, structure)) {
                game.build(x, y, structure);
            }
        }
        else if (button === 2) {
            // Right click - demolish
            game.demolish(x, y);
        }
    });
    // Game loop
    const TICK_INTERVAL = 100; // ms per tick
    let lastTick = 0;
    function gameLoop(timestamp) {
        if (timestamp - lastTick >= TICK_INTERVAL) {
            game.tick();
            lastTick = timestamp;
        }
        renderer.render();
        renderer.updateUI();
        requestAnimationFrame(gameLoop);
    }
    // Start the game loop
    requestAnimationFrame(gameLoop);
    console.log('Heat Management Game initialized');
}
// Start game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
}
else {
    initGame();
}
