/**
 * Universal Image Store
 * 
 * Единое хранилище для ВСЕХ изображений в системе:
 * - Изображения из чата (ph_abc123, ph_def456...)
 * - Кадры из видео (frame_001, frame_002...)
 * - Recalled изображения из памяти (img_mem_xyz)
 * - Артефакты от скиллов
 * - Временные изображения
 * 
 * ВАЖНО: Модель видит только то что в текущем чате или сохранено в память.
 * НО Image Analyser может работать с ЛЮБЫМ ID.
 */

import { saveFileData, loadFileData, deleteFileData } from './fileStorage';

export type ImageSource = 'chat' | 'video' | 'memory' | 'skill' | 'recalled' | 'temp';

export interface UniversalImage {
  id: string;              // Уникальный ID (ph_abc123, frame_001, img_mem_xyz)
  source: ImageSource;     // Откуда изображение
  mimeType: string;
  width: number;
  height: number;
  created_at: number;
  expires_at?: number;     // TTL для временных (timestamp)
  
  // Метаданные
  chatId?: string;         // К какому чату относится
  messageId?: string;      // К какому сообщению относится
  parentId?: string;       // Родительское изображение (для кропов)
  metadata?: Record<string, any>; // Доп данные
}

const INDEX_KEY = 'universal_image_index';
const IMAGE_KEY_PREFIX = 'univ_img_';

// TTL по умолчанию для временных изображений (24 часа)
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Index Management
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getIndex(): UniversalImage[] {
  if (typeof window === 'undefined') return [];
  
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveIndex(index: UniversalImage[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (err: any) {
    if (err.name === 'QuotaExceededError') {
      console.error('[UniversalImageStore] localStorage quota exceeded');
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CRUD Operations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Сохраняет изображение в универсальное хранилище
 */
export async function saveUniversalImage(data: {
  id: string;
  source: ImageSource;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  chatId?: string;
  messageId?: string;
  parentId?: string;
  metadata?: Record<string, any>;
  ttl?: number; // TTL в миллисекундах (для временных)
}): Promise<UniversalImage> {
  const now = Date.now();
  
  const image: UniversalImage = {
    id: data.id,
    source: data.source,
    mimeType: data.mimeType,
    width: data.width,
    height: data.height,
    created_at: now,
    expires_at: data.ttl ? now + data.ttl : undefined,
    chatId: data.chatId,
    messageId: data.messageId,
    parentId: data.parentId,
    metadata: data.metadata,
  };
  
  // Сохраняем данные в IndexedDB
  const storageKey = `${IMAGE_KEY_PREFIX}${data.id}`;
  await saveFileData(storageKey, data.base64);
  
  // Обновляем индекс
  const index = getIndex();
  const existingIdx = index.findIndex(img => img.id === data.id);
  
  if (existingIdx >= 0) {
    index[existingIdx] = image;
  } else {
    index.push(image);
  }
  
  saveIndex(index);
  
  console.log(`[UniversalImageStore] Saved image: ${data.id} (${data.source})`);
  
  return image;
}

/**
 * Загружает изображение по ID
 */
export async function loadUniversalImage(id: string): Promise<{ image: UniversalImage; base64: string } | null> {
  const index = getIndex();
  const image = index.find(img => img.id === id);
  
  if (!image) {
    console.warn(`[UniversalImageStore] Image not found: ${id}`);
    return null;
  }
  
  // Проверяем TTL
  if (image.expires_at && Date.now() > image.expires_at) {
    console.log(`[UniversalImageStore] Image expired: ${id}`);
    await deleteUniversalImage(id);
    return null;
  }
  
  const storageKey = `${IMAGE_KEY_PREFIX}${id}`;
  const base64 = await loadFileData(storageKey);
  
  if (!base64) {
    console.warn(`[UniversalImageStore] Image data not found in IndexedDB: ${id}`);
    return null;
  }
  
  return { image, base64 };
}

/**
 * Получает метаданные изображения без загрузки данных
 */
export function getUniversalImageMeta(id: string): UniversalImage | null {
  const index = getIndex();
  const image = index.find(img => img.id === id);
  
  if (!image) return null;
  
  // Проверяем TTL
  if (image.expires_at && Date.now() > image.expires_at) {
    return null;
  }
  
  return image;
}

/**
 * Удаляет изображение
 */
export async function deleteUniversalImage(id: string): Promise<void> {
  const index = getIndex();
  const filtered = index.filter(img => img.id !== id);
  
  const storageKey = `${IMAGE_KEY_PREFIX}${id}`;
  await deleteFileData(storageKey);
  
  saveIndex(filtered);
  
  console.log(`[UniversalImageStore] Deleted image: ${id}`);
}

/**
 * Проверяет существует ли изображение
 */
export function hasUniversalImage(id: string): boolean {
  const index = getIndex();
  const image = index.find(img => img.id === id);
  
  if (!image) return false;
  
  // Проверяем TTL
  if (image.expires_at && Date.now() > image.expires_at) {
    return false;
  }
  
  return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cleanup
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Удаляет просроченные изображения
 */
export async function cleanupExpiredImages(): Promise<number> {
  const index = getIndex();
  const now = Date.now();
  
  const expired = index.filter(img => img.expires_at && now > img.expires_at);
  
  for (const img of expired) {
    await deleteUniversalImage(img.id);
  }
  
  if (expired.length > 0) {
    console.log(`[UniversalImageStore] Cleaned up ${expired.length} expired images`);
  }
  
  return expired.length;
}

/**
 * Удаляет изображения старше указанного времени
 */
export async function cleanupOldImages(maxAgeMs: number): Promise<number> {
  const index = getIndex();
  const now = Date.now();
  const cutoff = now - maxAgeMs;
  
  const old = index.filter(img => img.created_at < cutoff && img.source === 'temp');
  
  for (const img of old) {
    await deleteUniversalImage(img.id);
  }
  
  if (old.length > 0) {
    console.log(`[UniversalImageStore] Cleaned up ${old.length} old images`);
  }
  
  return old.length;
}

/**
 * Удаляет изображения из конкретного чата
 */
export async function cleanupChatImages(chatId: string): Promise<number> {
  const index = getIndex();
  const chatImages = index.filter(img => img.chatId === chatId && img.source === 'chat');
  
  for (const img of chatImages) {
    await deleteUniversalImage(img.id);
  }
  
  if (chatImages.length > 0) {
    console.log(`[UniversalImageStore] Cleaned up ${chatImages.length} images from chat ${chatId}`);
  }
  
  return chatImages.length;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Query
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Получает все изображения из чата
 */
export function getChatImages(chatId: string): UniversalImage[] {
  const index = getIndex();
  const now = Date.now();
  
  return index.filter(img => 
    img.chatId === chatId && 
    (!img.expires_at || now <= img.expires_at)
  );
}

/**
 * Получает изображения по источнику
 */
export function getImagesBySource(source: ImageSource): UniversalImage[] {
  const index = getIndex();
  const now = Date.now();
  
  return index.filter(img => 
    img.source === source && 
    (!img.expires_at || now <= img.expires_at)
  );
}

/**
 * Получает статистику хранилища
 */
export function getStorageStats(): {
  total: number;
  bySource: Record<ImageSource, number>;
  expired: number;
  totalSize: number; // Примерный размер в байтах
} {
  const index = getIndex();
  const now = Date.now();
  
  const bySource: Record<ImageSource, number> = {
    chat: 0,
    video: 0,
    memory: 0,
    skill: 0,
    recalled: 0,
    temp: 0,
  };
  
  let expired = 0;
  
  index.forEach(img => {
    bySource[img.source]++;
    if (img.expires_at && now > img.expires_at) {
      expired++;
    }
  });
  
  // Примерный размер (предполагаем ~100KB на изображение)
  const totalSize = index.length * 100 * 1024;
  
  return {
    total: index.length,
    bySource,
    expired,
    totalSize,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Auto-cleanup on load
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if (typeof window !== 'undefined') {
  // Запускаем cleanup при загрузке
  cleanupExpiredImages().catch(console.error);
  
  // Периодический cleanup каждые 5 минут
  setInterval(() => {
    cleanupExpiredImages().catch(console.error);
  }, 5 * 60 * 1000);
}
