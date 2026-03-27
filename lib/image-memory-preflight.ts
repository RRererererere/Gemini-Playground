/**
 * Preflight Image Memory Lookup
 * 
 * Автоматически ищет релевантные изображения в памяти перед отправкой запроса к модели.
 * Это превращает систему из "инструменты доступны" в "система сама думает".
 */

import { searchImageMemories, type ImageMemoryMeta } from './image-memory-store';

/**
 * Извлекает entities и ключевые слова из текста пользователя
 */
export function extractEntities(text: string): string[] {
  const entities: string[] = [];
  
  // Паттерны для извлечения имён и сущностей
  const patterns = [
    // Имена с заглавной буквы (русские и латинские)
    /\b([А-ЯЁA-Z][а-яёa-z]+(?:\s+[А-ЯЁA-Z][а-яёa-z]+)?)\b/g,
    // Упоминания "это X", "про X", "о X"
    /(?:это|про|о|об)\s+([а-яёa-z]+(?:\s+[а-яёa-z]+)?)/gi,
    // Вопросы "кто такой X", "что такое X"
    /(?:кто|что)\s+(?:такой|такая|такое|это)\s+([а-яёa-z]+(?:\s+[а-яёa-z]+)?)/gi,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        entities.push(match[1].trim());
      }
    }
  });
  
  // Убираем дубликаты и служебные слова
  const stopWords = new Set(['это', 'про', 'такой', 'такая', 'такое', 'кто', 'что']);
  const uniqueEntities = Array.from(new Set(entities));
  return uniqueEntities.filter(e => e.length > 2 && !stopWords.has(e.toLowerCase()));
}

/**
 * Результат preflight поиска
 */
export interface PreflightResult {
  found: boolean;
  memories: ImageMemoryMeta[];
  entities: string[];
  query: string;
  confidence: number; // 0-1, насколько уверены что нужно использовать память
}

/**
 * Выполняет preflight поиск изображений в памяти
 */
export function preflightImageMemoryLookup(
  userMessage: string,
  chatId?: string
): PreflightResult {
  // Извлекаем entities
  const entities = extractEntities(userMessage);
  
  if (entities.length === 0) {
    return {
      found: false,
      memories: [],
      entities: [],
      query: '',
      confidence: 0,
    };
  }
  
  // Ищем по entities (без scope фильтра — ищем везде)
  const query = entities.join(' ');
  const memories = searchImageMemories(query, undefined, 5);
  
  // Вычисляем confidence на основе:
  // 1. Количества найденных изображений
  // 2. Релевантности (score из searchImageMemories)
  // 3. Наличия прямых упоминаний entities в запросе
  let confidence = 0;
  
  if (memories.length > 0) {
    // Базовый confidence от количества результатов
    confidence = Math.min(memories.length / 3, 1) * 0.5;
    
    // Добавляем за релевантность (предполагаем что searchImageMemories возвращает отсортированные)
    const avgScore = memories.reduce((sum, m) => sum + (m.score || 0), 0) / memories.length;
    confidence += avgScore * 0.3;
    
    // Проверяем прямые упоминания entities
    const lowerMessage = userMessage.toLowerCase();
    const directMentions = entities.filter(e => 
      lowerMessage.includes(e.toLowerCase())
    ).length;
    confidence += (directMentions / entities.length) * 0.2;
    
    confidence = Math.min(confidence, 1);
  }
  
  return {
    found: memories.length > 0,
    memories,
    entities,
    query,
    confidence,
  };
}

/**
 * Определяет, нужно ли автоматически добавить изображения в контекст
 */
export function shouldAutoInjectImages(result: PreflightResult): boolean {
  // Автоматически добавляем если confidence > 0.6
  return result.confidence > 0.6;
}

/**
 * Форматирует preflight результат для отображения в UI
 */
export function formatPreflightTrace(result: PreflightResult): string {
  if (!result.found) {
    return '';
  }
  
  const entityStr = result.entities.slice(0, 3).join(', ');
  const more = result.entities.length > 3 ? ` +${result.entities.length - 3}` : '';
  
  return `🔍 Найдено ${result.memories.length} изображений: ${entityStr}${more}`;
}
