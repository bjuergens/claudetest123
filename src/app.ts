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

  // Game loop state
  let lastTick = 0;
  let running = true;
  let paused = false;
  let ticksSinceLastSave = 0;

  // Pause/unpause functions
  function setPaused(newPaused: boolean): void {
    paused = newPaused;
    // If unpausing after a crash, restart the loop
    if (!newPaused && !running) {
      running = true;
      requestAnimationFrame(gameLoop);
      showToast('Game resumed', 'info');
    }
  }

  function isPaused(): boolean {
    return paused;
  }

  if (gameUI) {
    renderer.createUI(gameUI, {
      onResetSave: resetGame,
      onPauseToggle: setPaused,
      isPaused: isPaused,
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

  function gameLoop(timestamp: number): void {
    if (!running) return;

    try {
      // Only tick if not paused
      if (!paused && timestamp - lastTick >= TICK_INTERVAL) {
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
      paused = true;
      handleGameCrash(error, game);
    }
  }

  requestAnimationFrame(gameLoop);
}

/**
 * Show a toast notification
 */
function showToast(message: string, type: 'info' | 'error' | 'warning' = 'info', duration: number = 5000): void {
  const toast = document.createElement('div');
  toast.className = `game-toast game-toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 6px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 10001;
    animation: toast-slide-in 0.3s ease-out;
    max-width: 400px;
    word-wrap: break-word;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    ${type === 'error' ? 'background: #d32f2f; color: white;' : ''}
    ${type === 'warning' ? 'background: #f57c00; color: white;' : ''}
    ${type === 'info' ? 'background: #1976d2; color: white;' : ''}
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Add animation styles if not present
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes toast-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes toast-slide-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    toast.style.animation = 'toast-slide-out 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function handleGameCrash(error: unknown, game: HeatGame): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'Error';

  // Log detailed crash info to console
  const crashInfo = {
    error: errorMessage,
    errorName,
    timestamp: new Date().toISOString(),
    gameState: {
      money: game.getMoney(),
      ticks: game.getTickCount(),
      meltdowns: game.getMeltdownCount(),
      totalPower: game.getTotalPowerGenerated(),
    },
  };

  console.error('=== GAME CRASH ===');
  console.error('Error:', errorMessage);
  console.error('Error name:', errorName);
  console.error('Crash info:', JSON.stringify(crashInfo, null, 2));
  if (error instanceof Error && error.stack) {
    console.error('Stack trace:', error.stack);
  }

  // Show toast notification
  showToast(
    `Game crashed: ${errorName}. Game paused. Use Options → Resume to try again.`,
    'error',
    10000
  );

  // Also log a helpful message about recovery
  console.info('Game has been paused. You can try to resume from the Options menu.');
  console.info('If the crash persists, consider resetting your save from the Options menu.');
}

// Start game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
