/**
 * Keeps the imported dataset in IndexedDB so it survives a reload — you import
 * your export once, not every time you open the app. Nothing leaves the browser.
 */
import type { RawDataset } from './data'

const DB_NAME = 'spotify-mapped'
const STORE = 'dataset'
const KEY = 'current'
const VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

export async function loadStored(): Promise<RawDataset | null> {
  try {
    const value = await tx<RawDataset | undefined>('readonly', (s) => s.get(KEY))
    return value ?? null
  } catch {
    // Private browsing or a blocked database is not an error worth showing —
    // the import screen is a perfectly good fallback.
    return null
  }
}

export async function saveStored(raw: RawDataset): Promise<void> {
  await tx('readwrite', (s) => s.put(raw, KEY))
}

export async function clearStored(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(KEY))
  } catch {
    /* nothing stored */
  }
}
