// IndexedDB-backed local stash for uploaded runs. Each entry keys by
// the opaque content-addressable runId (`<HASH_VERSION><15-char hash>`)
// so re-uploading the same .run file overwrites in place — dedup is
// implicit. Phase 2 adds an optional Supabase mirror for sharing; the
// IDB record is always primary so the page works offline and without
// a sid round-trip.

const DB_NAME = "scare-the-spire";
const DB_VERSION = 1;
const STORE_RUNS = "runs";

export interface StoredRun {
  runId: string;
  raw: string;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RUNS)) {
        const store = db.createObjectStore(STORE_RUNS, { keyPath: "runId" });
        store.createIndex("savedAt", "savedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRun(input: {
  runId: string;
  raw: string;
}): Promise<StoredRun> {
  const record: StoredRun = { ...input, savedAt: Date.now() };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RUNS, "readwrite");
    tx.objectStore(STORE_RUNS).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve(record);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadRun(runId: string): Promise<StoredRun | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RUNS, "readonly");
    const req = tx.objectStore(STORE_RUNS).get(runId);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as StoredRun | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function listRuns(): Promise<StoredRun[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RUNS, "readonly");
    const req = tx.objectStore(STORE_RUNS).getAll();
    req.onsuccess = () => {
      db.close();
      const result = (req.result as StoredRun[] | undefined) ?? [];
      result.sort((a, b) => b.savedAt - a.savedAt);
      resolve(result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteRun(runId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RUNS, "readwrite");
    tx.objectStore(STORE_RUNS).delete(runId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
