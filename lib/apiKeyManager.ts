import type { ApiKeyEntry } from '@/types';

const STORAGE_KEY = 'gemini_api_keys';
const BLOCK_DURATION_MS = 10 * 60 * 60 * 1000; // 10 часов

function isBlockedForModel(entry: ApiKeyEntry, model: string | undefined, now: number): boolean {
  // Legacy global block
  if (entry.blockedUntil && entry.blockedUntil > now) return true;
  if (!model) return false;
  const until = entry.blockedByModel?.[model];
  return typeof until === 'number' && until > now;
}

// Загрузить ключи из localStorage
export function loadApiKeys(): ApiKeyEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ApiKeyEntry[];
  } catch {
    return [];
  }
}

// Сохранить ключи в localStorage
export function saveApiKeys(keys: ApiKeyEntry[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

// Добавить новый ключ
export function addApiKey(keys: ApiKeyEntry[], rawKey: string, label?: string): ApiKeyEntry[] {
  const key = rawKey.trim();
  if (!key) return keys;
  // Не добавлять дублирующийся
  if (keys.some(k => k.key === key)) return keys;
  const newEntry: ApiKeyEntry = {
    key,
    label: label || '',
    errorCount: 0,
  };
  return [...keys, newEntry];
}

// Удалить ключ
export function removeApiKey(keys: ApiKeyEntry[], key: string): ApiKeyEntry[] {
  return keys.filter(k => k.key !== key);
}

// Получить следующий доступный ключ (по round-robin)
// Возвращает ключ или null если все заблокированы
export function getNextAvailableKey(
  keys: ApiKeyEntry[],
  lastUsedIndex: number,
  model?: string
): { key: string; index: number } | null {
  if (keys.length === 0) return null;

  const now = Date.now();
  const count = keys.length;

  // Пробуем начиная со следующего после lastUsed
  for (let i = 1; i <= count; i++) {
    const idx = (lastUsedIndex + i) % count;
    const entry = keys[idx];

    // Если ключ заблокирован, проверяем истёк ли срок
    if (isBlockedForModel(entry, model, now)) {
      continue; // ещё заблокирован
    }

    return { key: entry.key, index: idx };
  }

  return null; // все заблокированы
}

// Пометить ключ как заблокированный (rate limit / 429)
export function markKeyBlocked(keys: ApiKeyEntry[], index: number, model?: string): ApiKeyEntry[] {
  const now = Date.now();
  return keys.map((k, i) => {
    if (i !== index) return k;
    // Per-model blocking by default (keeps other models available)
    const blockedByModel = { ...(k.blockedByModel || {}) };
    if (model) blockedByModel[model] = now + BLOCK_DURATION_MS;
    return {
      ...k,
      blockedByModel: model ? blockedByModel : k.blockedByModel,
      errorCount: k.errorCount + 1,
    };
  });
}

// Обновить lastUsed для ключа
export function markKeyUsed(keys: ApiKeyEntry[], index: number): ApiKeyEntry[] {
  return keys.map((k, i) => {
    if (i !== index) return k;
    return { ...k, lastUsed: Date.now() };
  });
}

// Разблокировать истёкшие ключи (вызвать при загрузке)
export function unblockExpiredKeys(keys: ApiKeyEntry[]): ApiKeyEntry[] {
  const now = Date.now();
  return keys.map(k => {
    let changed = false;
    const next: ApiKeyEntry = { ...k };
    if (next.blockedUntil && next.blockedUntil <= now) {
      next.blockedUntil = undefined;
      changed = true;
    }
    if (next.blockedByModel) {
      const cleaned: Record<string, number> = {};
      for (const [m, until] of Object.entries(next.blockedByModel)) {
        if (typeof until === 'number' && until > now) cleaned[m] = until;
        else changed = true;
      }
      next.blockedByModel = Object.keys(cleaned).length ? cleaned : undefined;
    }
    return changed ? next : k;
  });
}

// Получить статус ключа
export function getKeyStatus(entry: ApiKeyEntry, model?: string): 'active' | 'blocked' | 'cooling' {
  const now = Date.now();
  if (!isBlockedForModel(entry, model, now)) return 'active';
  const until = entry.blockedUntil && entry.blockedUntil > now
    ? entry.blockedUntil
    : (model ? entry.blockedByModel?.[model] : undefined);
  if (!until) return 'active';
  // cooling — заблокирован, но осталось < 1 часа
  if (until - now < 60 * 60 * 1000) return 'cooling';
  return 'blocked';
}

// Время до разблокировки в читаемом формате
export function timeUntilUnblock(entry: ApiKeyEntry, model?: string): string {
  const now = Date.now();
  const until = entry.blockedUntil && entry.blockedUntil > now
    ? entry.blockedUntil
    : (model ? entry.blockedByModel?.[model] : undefined);
  if (!until) return '';
  const ms = until - now;
  if (ms <= 0) return '';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}

export function unblockKey(keys: ApiKeyEntry[], index: number, model?: string): ApiKeyEntry[] {
  return keys.map((k, i) => {
    if (i !== index) return k;
    const next: ApiKeyEntry = { ...k };
    if (!model) {
      next.blockedUntil = undefined;
      next.blockedByModel = undefined;
      return next;
    }
    if (next.blockedByModel && model in next.blockedByModel) {
      const copy = { ...next.blockedByModel };
      delete copy[model];
      next.blockedByModel = Object.keys(copy).length ? copy : undefined;
    }
    // also allow clearing legacy global block from UI by passing model="__global__" if needed
    return next;
  });
}

// Проверить — является ли ошибка rate limit / key block
export function isRateLimitError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource exhausted') ||
    lower.includes('too many requests') ||
    lower.includes('rateLimitExceeded') ||
    lower.includes('userRateLimitExceeded')
  );
}

// Проверить — является ли ошибка невалидным ключом
export function isInvalidKeyError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('api key') && lower.includes('invalid') ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission denied') ||
    lower.includes('401') ||
    lower.includes('403') && lower.includes('key')
  );
}
