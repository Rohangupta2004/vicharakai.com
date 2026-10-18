/**
 * IndexedDB schema, migrations, and minimal promise-based access helpers.
 * Every store and index is created HERE and only here.
 * Offline-first: this database is the single source of truth (§13).
 */

const DB_NAME = 'vicharakai-v2';
const DB_VERSION = 1;

export const STORES = {
  kv: 'kv', // { key, value } — profile, settings, engine state
  consent: 'consent', // ConsentRecord
  concepts: 'concepts', // Concept + db_key `${exam_id}:${concept_id}`
  tasks: 'tasks', // StudyTask
  revisions: 'revisions', // RevisionTask
  doubts: 'doubts', // Doubt
  images: 'images', // { image_id, blob, created_at }
  testLogs: 'test_logs', // TestLog
} as const;

/** Append-only migration list — never edit an entry that has shipped. */
const MIGRATIONS: Array<(db: IDBDatabase) => void> = [
  (db) => {
    db.createObjectStore(STORES.kv, { keyPath: 'key' });
    db.createObjectStore(STORES.consent, { keyPath: 'consent_id' });
    const concepts = db.createObjectStore(STORES.concepts, { keyPath: 'db_key' });
    concepts.createIndex('by_exam', 'exam_id');
    const tasks = db.createObjectStore(STORES.tasks, { keyPath: 'task_id' });
    tasks.createIndex('by_exam', 'exam_id');
    const revisions = db.createObjectStore(STORES.revisions, { keyPath: 'rev_id' });
    revisions.createIndex('by_exam', 'exam_id');
    const doubts = db.createObjectStore(STORES.doubts, { keyPath: 'doubt_id' });
    doubts.createIndex('by_exam', 'exam_id');
    db.createObjectStore(STORES.images, { keyPath: 'image_id' });
    const testLogs = db.createObjectStore(STORES.testLogs, { keyPath: 'test_id' });
    testLogs.createIndex('by_exam', 'exam_id');
  },
];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = req.result;
      for (let v = e.oldVersion || 0; v < DB_VERSION; v++) MIGRATIONS[v]?.(db);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function dbGet<T>(name: string, key: IDBValidKey): Promise<T | undefined> {
  return wrap((await store(name, 'readonly')).get(key)) as Promise<T | undefined>;
}

export async function dbPut<T>(name: string, value: T): Promise<void> {
  await wrap((await store(name, 'readwrite')).put(value as unknown as object));
}

export async function dbBulkPut<T>(name: string, values: T[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(name, 'readwrite');
  const os = tx.objectStore(name);
  for (const v of values) os.put(v as unknown as object);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDelete(name: string, key: IDBValidKey): Promise<void> {
  await wrap((await store(name, 'readwrite')).delete(key));
}

export async function dbGetAll<T>(name: string): Promise<T[]> {
  return wrap((await store(name, 'readonly')).getAll()) as Promise<T[]>;
}

export async function dbGetAllByIndex<T>(name: string, index: string, value: IDBValidKey): Promise<T[]> {
  const os = await store(name, 'readonly');
  return wrap(os.index(index).getAll(value)) as Promise<T[]>;
}

export async function dbDeleteByIndex(name: string, index: string, value: IDBValidKey): Promise<void> {
  const os = await store(name, 'readwrite');
  const req = os.index(index).openCursor(value);
  await new Promise<void>((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      cursor.delete();
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}
