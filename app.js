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
let deferredPrompt;
const installButton = document.getElementById('install-button');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installButton.style.display = 'block';
  updatePWAStatus('Ready to install');
});

installButton.addEventListener('click', async () => {
  if (!deferredPrompt) {
    return;
  }

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  console.log(`User response to install prompt: ${outcome}`);

  if (outcome === 'accepted') {
    updatePWAStatus('Installed ✓');
  }

  deferredPrompt = null;
  installButton.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  updatePWAStatus('Installed ✓');
  deferredPrompt = null;
});

// Check if app is running as PWA
if (window.matchMedia('(display-mode: standalone)').matches) {
  updatePWAStatus('Running as app ✓');
}

function updatePWAStatus(status) {
  const statusElement = document.getElementById('pwa-status');
  if (statusElement) {
    statusElement.textContent = status;
  }
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
