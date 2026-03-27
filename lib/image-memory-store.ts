// ─────────────────────────────────────────────────────────────────────────────
// Image Memory Store — визуальная память для изображений
// ─────────────────────────────────────────────────────────────────────────────

import { nanoid } from 'nanoid';
import { saveFileData, loadFileData, deleteFileData } from './fileStorage';
import { 
  computeCryptoHash, 
  computePerceptualHash, 
  hammingDistance,
  createThumbnail 
} from './image-memory-hash';

export type ImageMemoryScope = 'local' | 'global';

export interface StoredAnnotation {
  x1_pct: number;
  y1_pct: number;
  x2_pct: number;
  y2_pct: number;
  label: string;
  type: 'highlight' | 'pointer' | 'warning' | 'success' | 'info';
}

export interface ImageMemory {
  id: string;
  
  // Хэши для дедупликации
  pHash: string;              // перцептивный хэш 64-bit hex
  cryptoHash: string;         // SHA-256 точный дубликат
  
  // Хранение
  thumbnailBase64: string;    // миниатюра 80x80 (~3KB)
  fullImageKey: string;       // ключ в IndexedDB
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  
  // Семантика (генерирует Gemini)
  description: string;
  tags: string[];
  entities: string[];         // именованные сущности
  scope: ImageMemoryScope;
  
  // Контекст сохранения
  savedFromChatId: string;
  savedFromMessageContext: string;
  
  // Время и использование
  created_at: number;
  updated_at: number;
  mentions: number;
  
  // Аннотации
  annotations?: StoredAnnotation[];
  
  // Связи
  sourceImageMemoryId?: string;  // если это кроп из другого изображения
  cropRegion?: {
    x1_pct: number;
    y1_pct: number;
    x2_pct: number;
    y2_pct: number;
  };
  derivedCropIds: string[];      // ID кропов из этого изображения
  relatedMemoryIds: string[];    // связанные текстовые воспоминания
  relatedImageIds: string[];     // связанные другие image memories
}

// Метаданные без blob — живут в localStorage
export type ImageMemoryMeta = Omit<ImageMemory, 'fullImageKey'> & {
  hasFull: boolean;
  score?: number; // Опциональный score для результатов поиска
};

const INDEX_KEY = 'image_memory_index';
const DEDUP_THRESHOLD = 10; // Hamming distance ≤10 = похожие изображения

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRUD операции
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getImageMemoryIndex(): ImageMemoryMeta[] {
  if (typeof window === 'undefined') return [];
  
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveImageMemoryIndex(index: ImageMemoryMeta[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (err: any) {
    if (err.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded for image memory index');
      // Удаляем 20% самых старых
      const toRemove = Math.ceil(index.length * 0.2);
      const sorted = [...index].sort((a, b) => a.created_at - b.created_at);
      const toKeep = sorted.slice(toRemove);
      localStorage.setItem(INDEX_KEY, JSON.stringify(toKeep));
    } else {
      throw err;
    }
  }
}

/**
 * Сохраняет изображение в визуальную память
 * Автоматически проверяет дубликаты через pHash и SHA-256
 */
export async function saveImageMemory(data: {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  description: string;
  tags: string[];
  entities: string[];
  scope: ImageMemoryScope;
  chatId: string;
  messageContext: string;
  annotations?: StoredAnnotation[];
  sourceImageMemoryId?: string;
  cropRegion?: { x1_pct: number; y1_pct: number; x2_pct: number; y2_pct: number };
  relatedMemoryIds?: string[];
  relatedImageIds?: string[];
}): Promise<ImageMemory> {
  // Вычисляем хэши
  const [cryptoHash, pHash, thumbnail] = await Promise.all([
    computeCryptoHash(data.base64),
    computePerceptualHash(data.base64, data.mimeType),
    createThumbnail(data.base64, data.mimeType, 80)
  ]);
  
  // Проверяем дубликаты
  const index = getImageMemoryIndex();
  
  // Точный дубликат по SHA-256
  const exactDuplicate = index.find(m => m.cryptoHash === cryptoHash);
  if (exactDuplicate) {
    console.log('[image-memory] Exact duplicate found, incrementing mentions');
    exactDuplicate.mentions++;
    exactDuplicate.updated_at = Date.now();
    
    // Если новый scope = global, обновляем (global важнее local)
    if (data.scope === 'global' && exactDuplicate.scope === 'local') {
      console.log('[image-memory] Upgrading scope from local to global');
      exactDuplicate.scope = 'global';
    }
    
    // Обновляем description, tags, entities если они изменились
    if (data.description && data.description !== exactDuplicate.description) {
      exactDuplicate.description = data.description;
    }
    if (data.tags && data.tags.length > 0) {
      exactDuplicate.tags = Array.from(new Set([...exactDuplicate.tags, ...data.tags]));
    }
    if (data.entities && data.entities.length > 0) {
      exactDuplicate.entities = Array.from(new Set([...exactDuplicate.entities, ...data.entities]));
    }
    
    saveImageMemoryIndex(index);
    
    // Возвращаем существующий
    return {
      ...exactDuplicate,
      fullImageKey: `img_mem_full_${exactDuplicate.id}`
    };
  }
  
  // Похожее изображение по pHash
  const similarImages = index
    .map(m => ({ mem: m, distance: hammingDistance(pHash, m.pHash) }))
    .filter(({ distance }) => distance <= DEDUP_THRESHOLD)
    .sort((a, b) => a.distance - b.distance);
  
  if (similarImages.length > 0) {
    const similar = similarImages[0].mem;
    console.log(`[image-memory] Similar image found (Hamming distance: ${similarImages[0].distance})`);
    
    // Если это кроп из существующего — сохраняем как новый с sourceImageMemoryId
    if (data.sourceImageMemoryId) {
      // Продолжаем сохранение как новый
    } else {
      // Обновляем существующий
      similar.description = data.description;
      similar.tags = Array.from(new Set([...similar.tags, ...data.tags]));
      similar.entities = Array.from(new Set([...similar.entities, ...data.entities]));
      similar.mentions++;
      similar.updated_at = Date.now();
      
      // Если новый scope = global, обновляем (global важнее local)
      if (data.scope === 'global' && similar.scope === 'local') {
        console.log('[image-memory] Upgrading scope from local to global (similar image)');
        similar.scope = 'global';
      }
      
      if (data.annotations) {
        similar.annotations = data.annotations;
      }
      
      saveImageMemoryIndex(index);
      
      return {
        ...similar,
        fullImageKey: `img_mem_full_${similar.id}`
      };
    }
  }
  
  // Новое изображение — сохраняем полностью
  const id = nanoid(8);
  const fullImageKey = `img_mem_full_${id}`;
  
  // Сохраняем полное изображение в IndexedDB
  await saveFileData(fullImageKey, data.base64);
  
  // Если есть аннотации — сохраняем annotated версию
  if (data.annotations && data.annotations.length > 0) {
    const annotatedKey = `img_mem_annotated_${id}`;
    // TODO: генерация annotated изображения будет в отдельной функции
    // Пока просто сохраняем оригинал
    await saveFileData(annotatedKey, data.base64);
  }
  
  const memory: ImageMemory = {
    id,
    pHash,
    cryptoHash,
    thumbnailBase64: thumbnail,
    fullImageKey,
    mimeType: data.mimeType,
    originalWidth: data.width,
    originalHeight: data.height,
    description: data.description,
    tags: data.tags,
    entities: data.entities,
    scope: data.scope,
    savedFromChatId: data.chatId,
    savedFromMessageContext: data.messageContext,
    created_at: Date.now(),
    updated_at: Date.now(),
    mentions: 0,
    annotations: data.annotations,
    sourceImageMemoryId: data.sourceImageMemoryId,
    cropRegion: data.cropRegion,
    derivedCropIds: [],
    relatedMemoryIds: data.relatedMemoryIds || [],
    relatedImageIds: data.relatedImageIds || []
  };
  
  // Если это кроп — обновляем родительское изображение
  if (data.sourceImageMemoryId) {
    const parent = index.find(m => m.id === data.sourceImageMemoryId);
    if (parent) {
      parent.derivedCropIds.push(id);
    }
  }
  
  // Добавляем в индекс
  const meta: ImageMemoryMeta = {
    ...memory,
    hasFull: true
  };
  
  index.push(meta);
  saveImageMemoryIndex(index);
  
  return memory;
}

/**
 * Получает полное изображение из памяти
 */
export async function getImageMemory(id: string): Promise<ImageMemory | null> {
  const index = getImageMemoryIndex();
  const meta = index.find(m => m.id === id);
  
  if (!meta) return null;
  
  const fullImageKey = `img_mem_full_${id}`;
  
  return {
    ...meta,
    fullImageKey
  };
}

/**
 * Загружает base64 данные полного изображения
 */
export async function loadImageMemoryData(id: string): Promise<string | null> {
  const fullImageKey = `img_mem_full_${id}`;
  return await loadFileData(fullImageKey);
}

/**
 * Удаляет изображение из памяти
 */
export async function forgetImageMemory(id: string): Promise<void> {
  const index = getImageMemoryIndex();
  const filtered = index.filter(m => m.id !== id);
  
  // Удаляем из IndexedDB
  await deleteFileData(`img_mem_full_${id}`);
  await deleteFileData(`img_mem_annotated_${id}`);
  
  // Обновляем индекс
  saveImageMemoryIndex(filtered);
}

/**
 * Обновляет метаданные изображения
 */
export function updateImageMemory(
  id: string,
  patch: Partial<Pick<ImageMemory, 'description' | 'tags' | 'entities' | 'annotations' | 'relatedMemoryIds' | 'relatedImageIds'>>
): ImageMemoryMeta | null {
  const index = getImageMemoryIndex();
  const idx = index.findIndex(m => m.id === id);
  
  if (idx === -1) return null;
  
  index[idx] = {
    ...index[idx],
    ...patch,
    updated_at: Date.now()
  };
  
  saveImageMemoryIndex(index);
  return index[idx];
}

/**
 * Инкрементит mentions при использовании
 */
export function incrementImageMemoryMentions(ids: string[]): void {
  const index = getImageMemoryIndex();
  let changed = false;
  
  ids.forEach(id => {
    const mem = index.find(m => m.id === id);
    if (mem) {
      mem.mentions++;
      changed = true;
    }
  });
  
  if (changed) {
    saveImageMemoryIndex(index);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Поиск
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

/**
 * Поиск изображений по описанию/тегам/entities
 */
export function searchImageMemories(
  query: string,
  scope?: ImageMemoryScope,
  limit: number = 10
): ImageMemoryMeta[] {
  const index = getImageMemoryIndex();
  const queryWords = extractWords(query);
  
  const scored = index
    .filter(mem => !scope || mem.scope === scope)
    .map(mem => {
      // Tag overlap (вес 2)
      const tagOverlap = mem.tags.filter(t => 
        queryWords.has(t.toLowerCase())
      ).length;
      
      // Entity exact match (вес 3)
      const entityMatch = mem.entities.some(e => 
        query.toLowerCase().includes(e.toLowerCase())
      ) ? 3 : 0;
      
      // Description word overlap (вес 1)
      const descriptionWords = extractWords(mem.description);
      const descOverlap = Array.from(queryWords).filter(w => 
        descriptionWords.has(w)
      ).length;
      
      // Mentions bonus (вес 0.1)
      const mentionsBonus = mem.mentions * 0.1;
      
      const score = tagOverlap * 2 + entityMatch + descOverlap + mentionsBonus;
      
      return { mem, score };
    });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({ ...s.mem, score: s.score }));
}

/**
 * Получает релевантные изображения для текущего контекста
 */
export function getRelevantImageMemories(
  userMessages: string[],
  chatId?: string,
  limit: number = 5
): ImageMemoryMeta[] {
  const index = getImageMemoryIndex();
  
  // Всегда включаем global с entities (люди, бренды)
  const globalWithEntities = index.filter(
    m => m.scope === 'global' && m.entities.length > 0
  );
  
  // Извлекаем слова из последних 2 сообщений
  const recentWords = extractWords(
    userMessages.slice(-2).join(' ')
  );
  
  // Остальные global — по пересечению keywords
  const otherGlobal = index
    .filter(m => m.scope === 'global' && m.entities.length === 0)
    .filter(m => 
      m.tags.some(tag => recentWords.has(tag.toLowerCase())) ||
      extractWords(m.description).size > 0 && 
      Array.from(recentWords).some(w => extractWords(m.description).has(w))
    );
  
  // Все local для текущего чата
  const localMemories = chatId 
    ? index.filter(m => m.scope === 'local' && m.savedFromChatId === chatId)
    : [];
  
  // Объединяем и сортируем
  const combined = [...globalWithEntities, ...otherGlobal, ...localMemories];
  combined.sort((a, b) => b.mentions - a.mentions);
  
  return combined.slice(0, limit);
}
