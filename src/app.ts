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

// DOM Elements
const installButton = document.getElementById('install-button') as HTMLButtonElement | null;
const statusElement = document.getElementById('pwa-status');

// Update PWA status display
function updatePWAStatus(status: string): void {
  if (statusElement) {
    statusElement.textContent = status;
  }
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration.scope);
        updatePWAStatus('Registered ✓');
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
        updatePWAStatus('Registration failed');
      });
  });
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
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to install prompt: ${outcome}`);

    if (outcome === 'accepted') {
      updatePWAStatus('Installed ✓');
    }

    deferredPrompt = null;
    if (installButton) {
      installButton.style.display = 'none';
    }
  });
}

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  updatePWAStatus('Installed ✓');
  deferredPrompt = null;
});

// Check if app is running as PWA
if (window.matchMedia('(display-mode: standalone)').matches) {
  updatePWAStatus('Running as app ✓');
}

// Initialize status on load
window.addEventListener('load', () => {
  if (!('serviceWorker' in navigator)) {
    updatePWAStatus('Not supported');
  } else if (window.matchMedia('(display-mode: standalone)').matches) {
    updatePWAStatus('Running as app ✓');
  } else {
    updatePWAStatus('Available');
  }
});
