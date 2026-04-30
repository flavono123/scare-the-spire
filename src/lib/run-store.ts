// IndexedDB-backed local stash for uploaded runs. Each entry keys by
// the opaque content-addressable runId (`<HASH_VERSION><15-char hash>`)
// so re-uploading the same .run file overwrites in place — dedup is
// implicit. Phase 2 adds an optional Supabase mirror for sharing; the
// IDB record is always primary so the page works offline and without
// a sid round-trip.

const DB_NAME = "scare-the-spire";
const DB_VERSION = 1;
const STORE_RUNS = "runs";

// "upload" — uploaded by the visitor in this browser. Owned by them.
// "donation-cache" — pulled from Supabase when visiting a shared URL,
// cached locally only for fast revisit. NOT owned by the visitor and
// must not appear in "내 런" (otherwise viewing someone else's shared
// run would silently adopt it as theirs).
export type StoredRunOrigin = "upload" | "donation-cache";

export interface StoredRun {
  runId: string;
  raw: string;
  savedAt: number;
  // Optional for backward compat with entries written before the
  // origin field existed. Treat absent origin as "upload".
  origin?: StoredRunOrigin;
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
  origin?: StoredRunOrigin;
}): Promise<StoredRun> {
  const record: StoredRun = {
    runId: input.runId,
    raw: input.raw,
    origin: input.origin ?? "upload",
    savedAt: Date.now(),
  };
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

// Visitor's own uploads only — excludes runs cached from visiting a
// shared donation URL. Use this for "내 런" surfaces.
export async function listOwnRuns(): Promise<StoredRun[]> {
  const all = await listRuns();
  return all.filter((r) => (r.origin ?? "upload") !== "donation-cache");
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
