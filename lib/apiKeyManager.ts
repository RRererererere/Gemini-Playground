import type { ApiKeyEntry } from '@/types';

const STORAGE_KEY = 'gemini_api_keys';
const BLOCK_DURATION_MS = 10 * 60 * 60 * 1000; // 10 часов

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
  lastUsedIndex: number
): { key: string; index: number } | null {
  if (keys.length === 0) return null;

  const now = Date.now();
  const count = keys.length;

  // Пробуем начиная со следующего после lastUsed
  for (let i = 1; i <= count; i++) {
    const idx = (lastUsedIndex + i) % count;
    const entry = keys[idx];

    // Если ключ заблокирован, проверяем истёк ли срок
    if (entry.blockedUntil && entry.blockedUntil > now) {
      continue; // ещё заблокирован
    }

    return { key: entry.key, index: idx };
  }

  return null; // все заблокированы
}

// Пометить ключ как заблокированный (rate limit / 429)
export function markKeyBlocked(keys: ApiKeyEntry[], index: number): ApiKeyEntry[] {
  const now = Date.now();
  return keys.map((k, i) => {
    if (i !== index) return k;
    return {
      ...k,
      blockedUntil: now + BLOCK_DURATION_MS,
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
    if (k.blockedUntil && k.blockedUntil <= now) {
      return { ...k, blockedUntil: undefined };
    }
    return k;
  });
}

// Получить статус ключа
export function getKeyStatus(entry: ApiKeyEntry): 'active' | 'blocked' | 'cooling' {
  const now = Date.now();
  if (!entry.blockedUntil || entry.blockedUntil <= now) return 'active';
  // cooling — заблокирован, но осталось < 1 часа
  if (entry.blockedUntil - now < 60 * 60 * 1000) return 'cooling';
  return 'blocked';
}

// Время до разблокировки в читаемом формате
export function timeUntilUnblock(entry: ApiKeyEntry): string {
  if (!entry.blockedUntil) return '';
  const ms = entry.blockedUntil - Date.now();
  if (ms <= 0) return '';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
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
