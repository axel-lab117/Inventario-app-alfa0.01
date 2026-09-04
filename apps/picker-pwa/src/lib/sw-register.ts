export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/picker/' })
        .then(reg => {
          console.log('SW registered:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showUpdateAvailable();
                }
              });
            }
          });
        })
        .catch(err => console.log('SW registration failed:', err));
    });
  }
}

function showUpdateAvailable() {
  const event = new CustomEvent('sw-update-available');
  window.dispatchEvent(event);
}

export function unregisterSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
  }
}

export function requestBackgroundSync(tag: string) {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(reg => {
      (reg as any).sync.register(tag).catch(console.error);
    });
  }
}