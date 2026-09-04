import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface WMSDB extends DBSchema {
  movements: {
    key: string;
    value: {
      id: string;
      boxCode: string;
      sku: string;
      type: 'REMOVE' | 'RETURN' | 'ADJUST' | 'OPEN_BOX';
      quantity: number;
      locationId: string;
      employeeId: string;
      timestamp: number;
      pending: boolean;
      idempotencyKey: string;
      syncedAt?: number;
    };
    indexes: { 'by-pending': boolean; 'by-timestamp': number };
  };
  'sku-cache': {
    key: string;
    value: {
      sku: string;
      variantId: string;
      name: string;
      condition: string;
      listingStatus: string;
      locationId: string;
      quantity: number;
      updatedAt: number;
    };
  };
  tasks: {
    key: string;
    value: {
      id: string;
      orderId: string;
      items: Array<{
        variantId: string;
        sku: string;
        name: string;
        locationId: string;
        requiredQuantity: number;
        pickedQuantity: number;
      }>;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      assignedAt: number;
      startedAt?: number;
      completedAt?: number;
    };
  };
  settings: {
    key: string;
    value: {
      key: string;
      value: unknown;
      updatedAt: number;
    };
  };
}

let dbInstance: IDBPDatabase<WMSDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<WMSDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<WMSDB>('wms-picker', 1, {
    upgrade(db) {
      const movStore = db.createObjectStore('movements', { keyPath: 'id' });
      movStore.createIndex('by-pending', 'pending');
      movStore.createIndex('by-timestamp', 'timestamp');

      db.createObjectStore('sku-cache', { keyPath: 'sku' });
      db.createObjectStore('tasks', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'key' });
    },
  });

  return dbInstance;
}

export async function addMovement(movement: WMSDB['movements']['value']) {
  const db = await getDB();
  await db.add('movements', movement);
  await requestBackgroundSync('sync-movements');
}

export async function getPendingMovements() {
  const db = await getDB();
  return db.getAllFromIndex('movements', 'by-pending', true);
}

export async function markMovementSynced(id: string) {
  const db = await getDB();
  const movement = await db.get('movements', id);
  if (movement) {
    movement.pending = false;
    movement.syncedAt = Date.now();
    await db.put('movements', movement);
  }
}

export async function cacheSKU(sku: WMSDB['sku-cache']['value']) {
  const db = await getDB();
  await db.put('sku-cache', { ...sku, updatedAt: Date.now() });
}

export async function getCachedSKU(sku: string) {
  const db = await getDB();
  return db.get('sku-cache', sku);
}

export async function getAllCachedSKUs() {
  const db = await getDB();
  return db.getAll('sku-cache');
}

export async function saveTasks(tasks: WMSDB['tasks']['value'][]) {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  await Promise.all(tasks.map(t => tx.store.put(t)));
  await tx.done;
}

export async function getTasks() {
  const db = await getDB();
  return db.getAll('tasks');
}

export async function getSetting(key: string) {
  const db = await getDB();
  const record = await db.get('settings', key);
  return record?.value;
}

export async function setSetting(key: string, value: unknown) {
  const db = await getDB();
  await db.put('settings', { key, value, updatedAt: Date.now() });
}

function requestBackgroundSync(tag: string) {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then(reg => {
      (reg as any).sync.register(tag).catch(console.error);
    });
  }
}