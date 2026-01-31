import { HeatGame, StructureType } from './game/HeatGame.js';
import { HeatGameRenderer } from './game/HeatGameRenderer.js';
import { CELL_SIZE, GRID_PADDING, TICK_INTERVAL } from './constants.js';
import { BUILD_VERSION } from './version.js';

const SAVE_KEY = 'heat-game-save';
const AUTOSAVE_INTERVAL = 10; // Save every 10 ticks

// PWA Install Prompt interface (not in standard lib.dom.d.ts)
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

// Make this file a module for declare global to work
export {};

// State
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waitingServiceWorker: ServiceWorker | null = null;

// DOM Elements
const installButton = document.getElementById('install-button') as HTMLButtonElement | null;
const updateButton = document.getElementById('update-button') as HTMLButtonElement | null;
const statusElement = document.getElementById('pwa-status');
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const gameUI = document.getElementById('game-ui') as HTMLElement | null;

// Update PWA status display
function updatePWAStatus(status: string): void {
  if (statusElement) {
    statusElement.textContent = status;
  }
}

// Show update available button
function showUpdateButton(): void {
  if (updateButton) {
    updateButton.style.display = 'block';
  }
}

// Hide update button
function hideUpdateButton(): void {
  if (updateButton) {
    updateButton.style.display = 'none';
  }
}

// Handle SW update click
function handleUpdateClick(): void {
  if (waitingServiceWorker) {
    waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Register Service Worker with update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        updatePWAStatus('Registered');

        // Check for updates on registration
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
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
        console.warn('Service Worker registration failed:', error);
        updatePWAStatus('Registration failed');
      });

    // When new SW takes over, show reload banner instead of auto-reloading
    navigator.serviceWorker.addEventListener('controllerchange', showReloadBanner);
  });
}

// Show a banner prompting user to reload for updates
function showReloadBanner(): void {
  // Check if banner already exists
  if (document.getElementById('reload-banner')) return;

  // Hide the update button to avoid duplicate UI
  hideUpdateButton();

  const banner = document.createElement('div');
  banner.id = 'reload-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #4a90d9;
    color: white;
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10000;
    font-family: system-ui, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;

  const message = document.createElement('span');
  message.textContent = 'A new version is available!';

  const reloadButton = document.createElement('button');
  reloadButton.textContent = 'Reload to update';
  reloadButton.style.cssText = `
    background: white;
    color: #4a90d9;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  `;
  reloadButton.addEventListener('click', () => {
    window.location.reload();
  });

  banner.appendChild(message);
  banner.appendChild(reloadButton);
  document.body.prepend(banner);

  updatePWAStatus('Reload to update');
}

// Update button click handler
if (updateButton) {
  updateButton.addEventListener('click', handleUpdateClick);
}

// PWA Install functionality
window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  if (installButton) {
    installButton.style.display = 'block';
  }
  updatePWAStatus('Ready to install');
});

if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

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
  updatePWAStatus('Installed');
  deferredPrompt = null;
});

// Initialize status on load
window.addEventListener('load', () => {
  if (!('serviceWorker' in navigator)) {
    updatePWAStatus('Not supported');
  } else if (window.matchMedia('(display-mode: standalone)').matches) {
    updatePWAStatus('Running as app');
  }
});

function loadGame(): HeatGame {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      console.log('Loading saved game...');
      return HeatGame.deserialize(saved);
    }
  } catch (error) {
    console.warn('Failed to load save, starting new game:', error);
  }
  return new HeatGame(500);
}

function saveGame(game: HeatGame): void {
  try {
    localStorage.setItem(SAVE_KEY, game.serialize());
  } catch (error) {
    console.warn('Failed to save game:', error);
  }
}

function resetGame(): void {
  if (confirm('Are you sure you want to reset your save? This cannot be undone.')) {
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  }
}

function initGame(): void {
  if (!canvas) {
    throw new Error('Game canvas element not found');
  }

  const game = loadGame();
  const renderer = new HeatGameRenderer(game, canvas, {
    cellSize: CELL_SIZE,
    gridPadding: GRID_PADDING,
  });

  if (gameUI) {
    renderer.createUI(gameUI, {
      onResetSave: resetGame,
      buildVersion: BUILD_VERSION,
    });
  }

  renderer.onCellClick((x, y, button) => {
    if (button === 0) {
      const structure = renderer.getSelectedStructure();
      const tier = renderer.getSelectedTier();
      if (game.canBuild(x, y, structure, tier)) {
        game.build(x, y, structure, tier);
      }
    } else if (button === 2) {
      game.demolish(x, y);
    }
  });

  let lastTick = 0;
  let running = true;
  let ticksSinceLastSave = 0;

  function gameLoop(timestamp: number): void {
    if (!running) return;

    try {
      if (timestamp - lastTick >= TICK_INTERVAL) {
        game.tick();
        lastTick = timestamp;

        // Autosave periodically
        ticksSinceLastSave++;
        if (ticksSinceLastSave >= AUTOSAVE_INTERVAL) {
          saveGame(game);
          ticksSinceLastSave = 0;
        }
      }
      renderer.render();
      renderer.updateUI();
      requestAnimationFrame(gameLoop);
    } catch (error) {
      running = false;
      handleGameCrash(error, game);
    }
  }

  requestAnimationFrame(gameLoop);
}

function handleGameCrash(error: unknown, game: HeatGame): void {
  const state = {
    money: game.getMoney(),
    ticks: game.getTickCount(),
    meltdowns: game.getMeltdownCount(),
    totalPower: game.getTotalPowerGenerated(),
    grid: game.getGridSnapshot(),
  };

  console.error('Game crashed:', error);
  console.error('Game state at crash:', JSON.stringify(state, null, 2));

  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0;
    background: #d32f2f; color: white; padding: 16px;
    font-family: monospace; z-index: 10000;
  `;
  banner.innerHTML = `
    <strong>Game crashed!</strong> ${error instanceof Error ? error.message : String(error)}
    <br><small>Check console for details. Refresh to restart.</small>
  `;
  document.body.prepend(banner);
}

// Start game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
