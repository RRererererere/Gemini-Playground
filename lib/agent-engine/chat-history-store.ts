// Chat History Store - хранилище сообщений для агентов
// Каждый стор привязан к chatId и имеет уникальный storeId

import { nanoid } from 'nanoid';

export interface ChatHistoryMessage {
  id: string;           // nanoid
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>; // произвольные данные
}

export interface ChatHistoryStore {
  storeId: string;      // задаётся пользователем, e.g. "game_history"
  chatId: string;       // ID текущего чата в Playground
  messages: ChatHistoryMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Получить ключ localStorage для стора
 */
function getStoreKey(chatId: string, storeId: string): string {
  return `chat_history_store_${chatId}_${storeId}`;
}

/**
 * Получить стор (или создать пустой)
 */
export function getChatHistoryStore(chatId: string, storeId: string): ChatHistoryStore {
  if (typeof window === 'undefined') {
    return {
      storeId,
      chatId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  const key = getStoreKey(chatId, storeId);
  const raw = localStorage.getItem(key);

  if (!raw) {
    const newStore: ChatHistoryStore = {
      storeId,
      chatId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return newStore;
  }

  try {
    return JSON.parse(raw) as ChatHistoryStore;
  } catch {
    return {
      storeId,
      chatId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

/**
 * Сохранить стор целиком
 */
export function saveChatHistoryStore(store: ChatHistoryStore): void {
  if (typeof window === 'undefined') return;

  const key = getStoreKey(store.chatId, store.storeId);
  const updated = { ...store, updatedAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(updated));
}

/**
 * Добавить сообщение
 */
export function appendMessage(
  chatId: string,
  storeId: string,
  message: Omit<ChatHistoryMessage, 'id' | 'timestamp'>
): ChatHistoryMessage {
  const store = getChatHistoryStore(chatId, storeId);

  const newMessage: ChatHistoryMessage = {
    ...message,
    id: nanoid(),
    timestamp: Date.now(),
  };

  store.messages.push(newMessage);
  saveChatHistoryStore(store);

  return newMessage;
}

/**
 * Получить все сообщения (с опциональным фильтром по role, limit, offset)
 */
export function getMessages(
  chatId: string,
  storeId: string,
  options?: {
    role?: 'user' | 'assistant' | 'system';
    limit?: number;       // последние N сообщений
    offset?: number;
  }
): ChatHistoryMessage[] {
  const store = getChatHistoryStore(chatId, storeId);
  let messages = store.messages;

  // Фильтр по роли
  if (options?.role) {
    messages = messages.filter(m => m.role === options.role);
  }

  // Offset
  if (options?.offset && options.offset > 0) {
    messages = messages.slice(options.offset);
  }

  // Limit (последние N)
  if (options?.limit && options.limit > 0) {
    messages = messages.slice(-options.limit);
  }

  return messages;
}

/**
 * Конвертировать в текст (для подачи в LLM)
 */
export function toPlainText(
  messages: ChatHistoryMessage[],
  options?: {
    includeRoles?: boolean;      // "User: ...\nAssistant: ..."
    separator?: string;          // между сообщениями
  }
): string {
  const includeRoles = options?.includeRoles ?? true;
  const separator = options?.separator ?? '\n\n';

  return messages
    .map(m => {
      if (includeRoles) {
        const roleLabel = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
        return `${roleLabel}: ${m.content}`;
      }
      return m.content;
    })
    .join(separator);
}

/**
 * Конвертировать в Gemini API format
 */
export function toGeminiMessages(
  messages: ChatHistoryMessage[]
): Array<{ role: string; parts: [{ text: string }] }> {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    parts: [{ text: m.content }],
  }));
}

/**
 * Очистить стор
 */
export function clearStore(chatId: string, storeId: string): void {
  if (typeof window === 'undefined') return;

  const key = getStoreKey(chatId, storeId);
  localStorage.removeItem(key);
}

/**
 * Список всех сторов в чате
 */
export function listStores(chatId: string): string[] {
  if (typeof window === 'undefined') return [];

  const prefix = `chat_history_store_${chatId}_`;
  const stores: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const storeId = key.replace(prefix, '');
      stores.push(storeId);
    }
  }

  return stores;
}

/**
 * Инициализировать стор начальными сообщениями (seed)
 */
export function seedStore(
  chatId: string,
  storeId: string,
  messages: Omit<ChatHistoryMessage, 'id' | 'timestamp'>[]
): void {
  const store = getChatHistoryStore(chatId, storeId);

  // Очищаем существующие сообщения
  store.messages = [];

  // Добавляем seed сообщения
  for (const msg of messages) {
    store.messages.push({
      ...msg,
      id: nanoid(),
      timestamp: Date.now(),
    });
  }

  saveChatHistoryStore(store);
}
