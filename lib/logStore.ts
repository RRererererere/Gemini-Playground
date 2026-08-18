// ═══════════════════════════════════════════════════════════════════
// Тотальное логирование действий пользователя (чат + Arena)
// Хранится в IndexedDB на стороне клиента. Никаких внешних отправок.
// ═══════════════════════════════════════════════════════════════════

import type { Message, MemoryOperation } from '@/types';
import { getVisibleMessageText } from '@/lib/gemini';

const DB_NAME = 'gemini_studio_logs';
const DB_VERSION = 1;
const STORE_NAME = 'logs';

// ─────────────────────────────────────────────────────────────────────
// Типы событий
// ─────────────────────────────────────────────────────────────────────

export type LogEventType =
  // Генерация / стриминг
  | 'send'              // пользователь отправил новое сообщение
  | 'stream_start'      // начало стриминга assistant-сообщения
  | 'stream_done'       // стрим успешно завершён
  | 'stream_error'      // ошибка стрима (HTTP/network/quota)
  | 'stream_aborted'    // прервано пользователем
  // Правки (главное для анализа нейросетью)
  | 'edit_message'      // изменены parts существующего сообщения
  | 'delete_message'    // удалено сообщение
  | 'regenerate'        // перегенерация ответа модели
  | 'branch'            // создание ветки/альтернативы
  // Фидбек
  | 'feedback'          // like/dislike
  // Чат- lifecycle
  | 'load_chat'
  | 'new_chat'
  | 'clear_chat';

export type LogSource = 'chat' | 'arena';

// Снимок сообщения — всё ценное, кроме бинарных данных (base64)
export interface LogMessageSnapshot {
  id: string;
  role: 'user' | 'model';
  text: string;
  thinking?: string;
  deepThinking?: string;
  deepThinkAnalysis?: object;
  feedback?: { rating: 'like' | 'dislike'; comment?: string; timestamp: number };
  finishReason?: string;
  modelName?: string;
  arenaAgentId?: string;
  // toolCalls без бинарных результатов — только имя и аргументы
  toolCalls?: Array<{ name: string; args: unknown }>;
  // memoryOperations без больших thumbnailBase64 (обрезаем)
  memoryOperations?: MemoryOperation[];
  error?: string;
  errorType?: string;
}

export interface LogEntry {
  id: string;
  ts: number;
  type: LogEventType;
  source: LogSource;
  chatId?: string;
  messageId?: string;
  // Для мутаций — снимки до/после
  before?: LogMessageSnapshot;
  after?: LogMessageSnapshot;
  // Для событий генерации (обратно-совместимо со старым форматом)
  provider?: 'gemini' | 'openai' | 'anthropic';
  model?: string;
  status?: 'ok' | 'error' | 'aborted';
  statusCode?: number;
  durationMs?: number;
  error?: string;
  // Для regenerate/branch — цепочка затронутых id
  affectedMessageIds?: string[];
  // Кол-во сообщений в чате на момент события (для load_chat/clear_chat)
  messageCount?: number;
}

// ─────────────────────────────────────────────────────────────────────
// DB
// ─────────────────────────────────────────────────────────────────────

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
        store.createIndex('chatId', 'chatId');
      }
    };
  });
  return dbPromise;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─────────────────────────────────────────────────────────────────────
// Сериализация сообщения — всё, кроме бинарников
// ─────────────────────────────────────────────────────────────────────

function trimThumbnail(thumb?: string): string | undefined {
  if (!thumb) return undefined;
  // Обрезаем base64 до 200 символов — только для индикатора наличия
  if (thumb.length > 200) return thumb.slice(0, 200) + '…';
  return thumb;
}

function sanitizeMemoryOps(ops?: MemoryOperation[]): MemoryOperation[] | undefined {
  if (!ops || ops.length === 0) return undefined;
  return ops.map(op => {
    const sanitized: MemoryOperation = { ...op };
    if (sanitized.thumbnailBase64) {
      sanitized.thumbnailBase64 = trimThumbnail(sanitized.thumbnailBase64);
    }
    if (sanitized.results) {
      sanitized.results = sanitized.results.map(r => ({
        ...r,
        thumbnailBase64: trimThumbnail(r.thumbnailBase64) || '',
      }));
    }
    return sanitized;
  });
}

export function serializeMessage(msg: Message): LogMessageSnapshot {
  const snap: LogMessageSnapshot = {
    id: msg.id,
    role: msg.role,
    text: getVisibleMessageText(msg.parts),
  };
  if (msg.thinking) snap.thinking = msg.thinking;
  if (msg.deepThinking) snap.deepThinking = msg.deepThinking;
  if (msg.deepThinkAnalysis) snap.deepThinkAnalysis = msg.deepThinkAnalysis;
  if (msg.feedback) snap.feedback = msg.feedback;
  if (msg.finishReason) snap.finishReason = msg.finishReason;
  if (msg.modelName) snap.modelName = msg.modelName;
  if (msg.arenaAgentId) snap.arenaAgentId = msg.arenaAgentId;
  if (msg.error) snap.error = msg.error;
  if (msg.errorType) snap.errorType = msg.errorType;

  // toolCalls: оставляем только name + args, выкидываем результаты/сигнатуры
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    snap.toolCalls = msg.toolCalls.map(tc => ({
      name: tc.name,
      args: tc.args,
    }));
  }

  // memoryOperations: обрезаем большие thumbnail'ы
  const memOps = sanitizeMemoryOps(msg.memoryOperations);
  if (memOps) snap.memoryOperations = memOps;

  return snap;
}

// ─────────────────────────────────────────────────────────────────────
// Запись
// ─────────────────────────────────────────────────────────────────────

// Главная функция — fire-and-forget, не бросает в UI
export async function addLogEntry(entry: Omit<LogEntry, 'id' | 'ts'>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ ...entry, id: genId(), ts: Date.now() });
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    // non-critical: при переполнении тихо падаем, но не роняем UI
  }
}

// ─────────────────────────────────────────────────────────────────────
// Чтение / экспорт / удаление
// ─────────────────────────────────────────────────────────────────────

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
  const data = JSON.stringify({ version: 2, exportedAt: Date.now(), count: logs.length, logs }, null, 2);
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

// ─────────────────────────────────────────────────────────────────────
// Storage estimate — для экрана-предупреждения
// ─────────────────────────────────────────────────────────────────────

export interface StorageEstimateInfo {
  usage: number;     // bytes
  quota: number;     // bytes
  ratio: number;     // 0..1
  available: boolean;
}

export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0, ratio: 0, available: false };
  }
  try {
    const est = await navigator.storage.estimate();
    const usage = est.usage || 0;
    const quota = est.quota || 0;
    return {
      usage,
      quota,
      ratio: quota > 0 ? usage / quota : 0,
      available: true,
    };
  } catch {
    return { usage: 0, quota: 0, ratio: 0, available: false };
  }
}
