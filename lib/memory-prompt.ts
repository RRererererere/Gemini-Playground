import { Memory, getRelevantMemories, incrementMentions } from './memory-store';
import { 
  ImageMemoryMeta, 
  getRelevantImageMemories, 
  incrementImageMemoryMentions 
} from './image-memory-store';

// Форматирование одного воспоминания для промпта
function formatMemory(m: Memory): string {
  const confidence = Math.round(m.confidence * 100);
  return `[id: ${m.id}] ${m.fact} (${m.category}, уверенность: ${confidence}%)`;
}

// Сборка блока памяти для системного промпта
export function buildMemoryPrompt(
  userMessages: string[],
  chatId?: string,
  memoryEnabled: boolean = true
): { prompt: string; usedMemoryIds: string[]; usedImageMemoryIds: string[] } {
  if (!memoryEnabled) {
    return { prompt: '', usedMemoryIds: [], usedImageMemoryIds: [] };
  }

  const relevant = getRelevantMemories(userMessages, chatId);
  const relevantImages = getRelevantImageMemories(userMessages, chatId, 5);

  if (relevant.length === 0 && relevantImages.length === 0) {
    return { prompt: '', usedMemoryIds: [], usedImageMemoryIds: [] };
  }

  const globalMems = relevant.filter(m => m.scope === 'global');
  const localMems = relevant.filter(m => m.scope === 'local');

  const parts: string[] = [];

  parts.push('## Долгосрочная память');
  parts.push('');
  parts.push('Ты имеешь доступ к персональной памяти пользователя. Используй её молча — никогда не говори "я помню" или "ты мне говорил". Просто применяй контекст естественно.');
  parts.push('');

  if (globalMems.length > 0) {
    parts.push('### Что ты знаешь о пользователе:');
    globalMems.forEach(m => parts.push(`- ${formatMemory(m)}`));
    parts.push('');
  }

  if (localMems.length > 0) {
    parts.push('### Контекст текущего чата:');
    localMems.forEach(m => parts.push(`- ${formatMemory(m)}`));
    parts.push('');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Визуальная память
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (relevantImages.length > 0) {
    parts.push('### Визуальная память:');
    parts.push('');
    parts.push('У тебя есть доступ к сохранённым изображениям:');
    parts.push('');
    
    relevantImages.forEach(mem => {
      const entityStr = mem.entities.length > 0 ? mem.entities.join(', ') : 'Изображение';
      parts.push(`- **${entityStr}** (ID: ${mem.id})`);
      parts.push(`  ${mem.description}`);
      parts.push(`  Теги: ${mem.tags.join(', ')}`);
      if (mem.mentions > 0) {
        parts.push(`  Использовано: ${mem.mentions} раз`);
      }
      parts.push('');
    });
    
    parts.push('Используй `recall_image_memory(id)` чтобы вспомнить изображение.');
    parts.push('Используй `search_image_memories(query)` для поиска по описанию.');
    parts.push('');
  }

  parts.push('### Как использовать инструменты памяти:');
  parts.push('- save_memory → когда узнаёшь что-то важное и долгосрочное о пользователе');
  parts.push('- update_memory → когда пользователь противоречит или уточняет сохранённый факт');
  parts.push('- forget_memory → когда факт устарел или пользователь просит забыть');
  parts.push('- Связывай новые воспоминания с существующими через related_to — это строит граф знаний');
  parts.push('');
  
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Правила сохранения изображений
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  parts.push('### ⚠️ КРИТИЧЕСКИ ВАЖНО - Сохранение изображений:');
  parts.push('');
  parts.push('Когда пользователь присылает фото с ИМЕНЕМ человека/места/объекта:');
  parts.push('→ ОБЯЗАТЕЛЬНО вызови save_image_memory(image_id, description, tags, entities, scope)');
  parts.push('');
  parts.push('Примеры ОБЯЗАТЕЛЬНОГО вызова:');
  parts.push('- "Это моя подруга Маша" → save_image_memory(img_1, "Девушка Маша...", ["person","female","friend"], ["Маша"], "global")');
  parts.push('- "Запомни этот логотип Nike" → save_image_memory(img_1, "Логотип Nike...", ["logo","brand"], ["Nike"], "global")');
  parts.push('- "Это наш офис" → save_image_memory(img_1, "Офис пользователя...", ["office","place"], [], "global")');
  parts.push('');
  parts.push('НЕ вызывай только для скриншотов интерфейса или временных задач.');
  parts.push('');
  parts.push('⚠️ FIRE-AND-FORGET: Вызови и СРАЗУ продолжай текст. НЕ жди ответа!');
  parts.push('');
  
  parts.push('### КРИТИЧЕСКИ ВАЖНО - КАК РАБОТАЮТ ИНСТРУМЕНТЫ ПАМЯТИ:');
  parts.push('');
  parts.push('Memory tools (save_memory, update_memory, forget_memory, save_image_memory):');
  parts.push('1. Вызови функцию через functionCall');
  parts.push('2. Система выполнит её МГНОВЕННО на клиенте');
  parts.push('3. Ты получишь functionResponse с { success: true }');
  parts.push('4. ПОСЛЕ получения ответа продолжи генерацию текста');
  parts.push('');
  parts.push('ПРАВИЛЬНО:');
  parts.push('  Turn 1: functionCall(save_memory)');
  parts.push('  Turn 2: [получаешь response] + text("Приятно познакомиться, Дима!")');
  parts.push('');
  parts.push('НЕПРАВИЛЬНО:');
  parts.push('  Turn 1: text("Приятно познакомиться!") БЕЗ вызова save_memory');
  parts.push('');
  parts.push('НЕ упоминай явно что ты что-то сохранил - просто используй память естественно.');

  const usedMemoryIds = relevant.map(m => m.id);
  const usedImageMemoryIds = relevantImages.map(m => m.id);

  return {
    prompt: parts.join('\n'),
    usedMemoryIds,
    usedImageMemoryIds,
  };
}

// Инкремент mentions после использования в промпте
export function markMemoriesUsed(
  memoryIds: string[], 
  imageMemoryIds: string[], 
  chatId?: string
): void {
  if (memoryIds.length > 0) {
    incrementMentions(memoryIds, chatId);
  }
  if (imageMemoryIds.length > 0) {
    incrementImageMemoryMentions(imageMemoryIds);
  }
}
