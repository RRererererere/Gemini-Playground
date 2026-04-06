import { nanoid } from 'nanoid';

export type MemoryScope = 'local' | 'global';
export type MemoryCategory = 'identity' | 'tech' | 'style' | 'project' | 'preference' | 'belief' | 'episode';

export interface Memory {
  id: string;
  fact: string;
  scope: MemoryScope;
  category: MemoryCategory;
  keywords: string[];
  confidence: number; // 0.0–1.0
  mentions: number;
  created_at: number;
  updated_at: number;
  related_to: string[];
}

const GLOBAL_KEY = 'memory_graph_global';
const LOCAL_KEY_PREFIX = 'memory_graph_local_';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Export/Import для бэкапа
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function exportAllMemories(): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Экспортируем глобальную память
  const globalMemory = localStorage.getItem(GLOBAL_KEY);
  if (globalMemory) {
    result[GLOBAL_KEY] = globalMemory;
  }
  
  // Экспортируем все локальные memory (итерируем все ключи с префиксом)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LOCAL_KEY_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        result[key] = value;
      }
    }
  }
  
  return result;
}

export function importAllMemories(memories: Record<string, string>): void {
  for (const [key, value] of Object.entries(memories)) {
    localStorage.setItem(key, value);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRUD операции
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getMemories(scope: MemoryScope, chatId?: string): Memory[] {
  const key = scope === 'global' ? GLOBAL_KEY : `${LOCAL_KEY_PREFIX}${chatId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMemory(
  data: Omit<Memory, 'id' | 'mentions' | 'created_at' | 'updated_at'>,
  chatId?: string
): Memory {
  const memory: Memory = {
    ...data,
    id: nanoid(8),
    mentions: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const memories = getMemories(data.scope, chatId);
  memories.push(memory);

  const key = data.scope === 'global' ? GLOBAL_KEY : `${LOCAL_KEY_PREFIX}${chatId}`;
  
  try {
    localStorage.setItem(key, JSON.stringify(memories));
  } catch (err: any) {
    // Защита от QuotaExceededError
    if (err.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded. Removing oldest memories...');
      
      // Удаляем 20% самых старых воспоминаний
      const toRemove = Math.ceil(memories.length * 0.2);
      const sorted = [...memories].sort((a, b) => a.created_at - b.created_at);
      const toKeep = sorted.slice(toRemove);
      
      try {
        localStorage.setItem(key, JSON.stringify(toKeep));
        console.log(`Removed ${toRemove} old memories to free space`);
        
        // Возвращаем память если она попала в сохранённые
        const saved = toKeep.find(m => m.id === memory.id);
        if (!saved) {
          throw new Error('Memory quota exceeded. Please delete old memories.');
        }
      } catch {
        throw new Error('Memory storage full. Please delete old memories manually.');
      }
    } else {
      throw err;
    }
  }

  return memory;
}

export function updateMemory(
  id: string,
  scope: MemoryScope,
  patch: Partial<Pick<Memory, 'fact' | 'confidence' | 'keywords' | 'category' | 'related_to'>>,
  chatId?: string
): Memory | null {
  const memories = getMemories(scope, chatId);
  const idx = memories.findIndex(m => m.id === id);
  if (idx === -1) return null;

  memories[idx] = {
    ...memories[idx],
    ...patch,
    updated_at: Date.now(),
  };

  const key = scope === 'global' ? GLOBAL_KEY : `${LOCAL_KEY_PREFIX}${chatId}`;
  
  try {
    localStorage.setItem(key, JSON.stringify(memories));
  } catch (err: any) {
    if (err.name === 'QuotaExceededError') {
      throw new Error('Memory storage full. Cannot update memory.');
    }
    throw err;
  }

  return memories[idx];
}

export function forgetMemory(id: string, scope: MemoryScope, chatId?: string): void {
  const memories = getMemories(scope, chatId);
  const filtered = memories.filter(m => m.id !== id);

  const key = scope === 'global' ? GLOBAL_KEY : `${LOCAL_KEY_PREFIX}${chatId}`;
  localStorage.setItem(key, JSON.stringify(filtered));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Фильтр релевантности
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function extractWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-zа-яё0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

export function getRelevantMemories(userMessages: string[], chatId?: string): Memory[] {
  const globalMemories = getMemories('global');
  const localMemories = chatId ? getMemories('local', chatId) : [];

  // Всегда включаем identity и style из global
  const alwaysInclude = globalMemories.filter(
    m => m.category === 'identity' || m.category === 'style'
  );

  // Извлекаем слова из последних 2 сообщений пользователя
  const recentWords = extractWords(
    userMessages.slice(-2).join(' ')
  );

  // Остальные global — по пересечению keywords
  const otherGlobal = globalMemories
    .filter(m => m.category !== 'identity' && m.category !== 'style')
    .filter(m => m.keywords.some(kw => recentWords.has(kw.toLowerCase())));

  // Все local для текущего чата
  const allLocal = localMemories;

  // Объединяем и сортируем по confidence * mentions DESC
  const combined = [...alwaysInclude, ...otherGlobal, ...allLocal];
  combined.sort((a, b) => (b.confidence * b.mentions) - (a.confidence * a.mentions));

  // Лимит 20 штук
  return combined.slice(0, 20);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Инкремент mentions при включении в промпт
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function incrementMentions(ids: string[], chatId?: string): void {
  const globalIds = new Set<string>();
  const localIds = new Set<string>();

  // Определяем scope каждого ID
  const globalMemories = getMemories('global');
  const localMemories = chatId ? getMemories('local', chatId) : [];

  ids.forEach(id => {
    if (globalMemories.find(m => m.id === id)) globalIds.add(id);
    if (localMemories.find(m => m.id === id)) localIds.add(id);
  });

  // Инкрементим global
  if (globalIds.size > 0) {
    const updated = globalMemories.map(m =>
      globalIds.has(m.id) ? { ...m, mentions: m.mentions + 1 } : m
    );
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(updated));
  }

  // Инкрементим local
  if (localIds.size > 0 && chatId) {
    const updated = localMemories.map(m =>
      localIds.has(m.id) ? { ...m, mentions: m.mentions + 1 } : m
    );
    localStorage.setItem(`${LOCAL_KEY_PREFIX}${chatId}`, JSON.stringify(updated));
  }
}
