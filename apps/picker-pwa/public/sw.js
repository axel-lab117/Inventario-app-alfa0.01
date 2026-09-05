// Service Worker for Picker PWA - Background Sync + Offline Support
const CACHE_NAME = 'wms-picker-v1';
const STATIC_ASSETS = [
  '/picker/',
  '/picker/scan',
  '/picker/tasks',
  '/picker/history',
  '/picker/returns',
  '/manifest.json',
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first for API, cache first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls - network first with offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET requests
          if (request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: try cache
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - cache first
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
  }
});

// Background Sync - flush pending movements
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-movements') {
    event.waitUntil(flushPendingMovements());
  }
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function flushPendingMovements() {
  try {
    const db = await openDB();
    const pending = await db.getAllFromIndex('movements', 'by-pending', true);

    for (const movement of pending) {
      try {
        const response = await fetch('/api/v1/inventory/scan/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': movement.idempotencyKey,
          },
          body: JSON.stringify({
            boxCode: movement.boxCode,
            locationId: movement.locationId,
          }),
        });

        if (response.ok) {
          movement.pending = false;
          movement.syncedAt = Date.now();
          await db.put('movements', movement);
          // Notify clients
          notifyClients({ type: 'MOVEMENT_SYNCED', movementId: movement.id });
        } else if (response.status === 409) {
          // Conflict - already processed
          movement.pending = false;
          movement.syncedAt = Date.now();
          await db.put('movements', movement);
        } else {
          console.error('Sync failed:', response.status, await response.text());
        }
      } catch (err) {
        console.error('Movement sync error:', err);
      }
    }
  } catch (err) {
    console.error('Background sync error:', err);
  }
}

async function syncTasks() {
  try {
    const db = await openDB();
    const tasks = await db.getAll('tasks');
    
    // Sync task status updates
    for (const task of tasks) {
      if (task.status === 'COMPLETED' && !task.syncedAt) {
        try {
          const response = await fetch(`/api/v1/picking/tasks/${task.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            task.syncedAt = Date.now();
            await db.put('tasks', task);
          }
        } catch (err) {
          console.error('Task sync error:', err);
        }
      }
    }
  } catch (err) {
    console.error('Task sync error:', err);
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.data,
    actions: data.actions || [],
    tag: data.tag || 'wms-notification',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action) {
    // Handle action buttons
    clients.openWindow(`/picker${event.action}`);
  } else {
    // Default click - open app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/picker') && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow('/picker');
      })
    );
  }
});

// Notify all clients
function notifyClients(message: any) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => client.postMessage(message));
  });
}

// Simple IndexedDB wrapper for SW
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wms-picker', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

console.log('WMS Picker SW loaded');