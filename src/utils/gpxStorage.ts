// IndexedDB utility for persistent caching of GPX files on client devices (tablet, desktop, mobile)

const DB_NAME = 'CyclingClimbingGpxStore';
const DB_VERSION = 1;
const STORE_NAME = 'gpxFiles';

interface GpxRecord {
  key: string; // activity id or dateStr (YYYYMMDD) or URL
  filename: string;
  xmlText: string;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Saves a GPX XML string into IndexedDB
 */
export async function saveGpxToIndexedDb(key: string, filename: string, xmlText: string): Promise<void> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: GpxRecord = {
        key,
        filename,
        xmlText,
        timestamp: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to save GPX to IndexedDB:', e);
  }
}

/**
 * Retrieves a GPX XML string from IndexedDB by key (activity id, date, or url)
 */
export async function getGpxFromIndexedDb(key: string): Promise<string | null> {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.xmlText) {
          resolve(req.result.xmlText);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}
