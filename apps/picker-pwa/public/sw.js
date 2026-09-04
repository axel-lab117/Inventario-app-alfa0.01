const CACHE_NAME = 'wms-picker-v1';
const STATIC_ASSETS = [
  '/picker',
  '/picker/scan',
  '/picker/tasks',
  '/manifest.json',
];

const CACHE_STRATEGIES = {
  static: 'cache-first',
  api: 'network-first',
  images: 'cache-first',
};

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data === 'claim') self.clients.claim();
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-movements') {
    event.waitUntil(syncPendingMovements());
  }
});

async function syncPendingMovements() {
  const db = await openDB();
  const tx = db.transaction('movements', 'readonly');
  const store = tx.objectStore('movements');
  const pending = await store.getAll();

  for (const movement of pending) {
    try {
      const response = await fetch('/api/sync/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movement),
      });
      if (response.ok) {
        const writeTx = db.transaction('movements', 'readwrite');
        await writeTx.objectStore('movements').delete(movement.id);
        await writeTx.done;
      }
    } catch {
      break;
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wms-picker', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('movements')) {
        db.createObjectStore('movements', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sku-cache')) {
        db.createObjectStore('sku-cache', { keyPath: 'sku' });
      }
    };
  });
}