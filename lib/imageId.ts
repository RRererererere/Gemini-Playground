// Генерация уникальных ID для изображений
const usedIds = new Set<string>();

/**
 * Генерирует уникальный ID для изображения в формате ph_{timestamp}{random}
 * Пример: ph_lqk7a3f9
 */
export function generateImageId(): string {
  let id: string;
  do {
    const timestamp = Date.now().toString(36).slice(-4);
    const random = Math.random().toString(36).slice(2, 6);
    id = `ph_${timestamp}${random}`;
  } while (usedIds.has(id));
  
  usedIds.add(id);
  return id;
}

/**
 * Проверяет, является ли строка валидным image ID
 */
export function isImageId(str: string): boolean {
  return /^ph_[a-z0-9]{8}$/.test(str);
}

/**
 * Очищает кэш использованных ID (для тестов)
 */
export function clearImageIdCache(): void {
  usedIds.clear();
}
