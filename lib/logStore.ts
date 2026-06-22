const DB_NAME = 'gemini_studio_logs';
const DB_VERSION = 1;
const STORE_NAME = 'logs';
const MAX_LOGS = 1000;

export interface LogEntry {
  id: string;
  ts: number;
  provider: 'gemini' | 'openai' | 'anthropic';
  model: string;
  status: 'ok' | 'error' | 'aborted';
  statusCode?: number;
  durationMs: number;
  error?: string;
  chatId?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject(new Error('no window')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('ts', 'ts');
      }
    };
  });
  return dbPromise;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function addLog(entry: Omit<LogEntry, 'id'>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...entry, id: genId() });
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    trimOldLogs(db);
  } catch {
    // non-critical
  }
}

async function trimOldLogs(db: IDBDatabase): Promise<void> {
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const countReq = store.count();
    const count = await new Promise<number>((res, rej) => {
      countReq.onsuccess = () => res(countReq.result);
      countReq.onerror = () => rej(countReq.error);
    });
    if (count <= MAX_LOGS) return;
    const toDelete = count - MAX_LOGS;
    let deleted = 0;
    await new Promise<void>((res, rej) => {
      const curReq = store.index('ts').openCursor();
      curReq.onsuccess = () => {
        const cursor = curReq.result;
        if (!cursor || deleted >= toDelete) { res(); return; }
        cursor.delete();
        deleted++;
        cursor.continue();
      };
      curReq.onerror = () => rej(curReq.error);
    });
  } catch {}
}

export async function exportLogs(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const logs: LogEntry[] = [];
  await new Promise<void>((res, rej) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) { logs.push(cursor.value); cursor.continue(); }
      else res();
    };
    req.onerror = () => rej(req.error);
  });
  logs.sort((a, b) => a.ts - b.ts);
  const data = JSON.stringify({ version: 1, exportedAt: Date.now(), count: logs.length, logs }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gemini-studio-logs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteLogsDatabase(): Promise<void> {
  if (dbPromise) {
    try { const db = await dbPromise; db.close(); } catch {}
    dbPromise = null;
  }
  await new Promise<void>((res, rej) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
    req.onblocked = () => res();
  });
}

export async function getLogsCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise<number>((res, rej) => {
      const req = store.count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return 0;
  }
}
