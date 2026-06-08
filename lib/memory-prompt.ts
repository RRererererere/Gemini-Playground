import { Memory, getRelevantMemories, incrementMentions } from './memory-store';
import { getRelevantImageMemories } from './image-memory-store';

// Форматирование одного воспоминания для промпта
function formatMemory(m: Memory): string {
  const confidence = Math.round(m.confidence * 100);
  return `[id: ${m.id}] ${m.fact} (${m.category}, уверенность: ${confidence}%)`;
}

/** Дефолтные инструкции памяти (редактируемые пользователем в Context Inspector) */
export function getDefaultMemoryInstructions(): string {
  const parts: string[] = [];
  parts.push('## Долгосрочная память');
  parts.push('');
  parts.push('Ты имеешь доступ к персональной памяти пользователя. Используй её молча — никогда не говори "я помню" или "ты мне говорил". Просто применяй контекст естественно.');
  parts.push('');
  parts.push('### Визуальная память:');
  parts.push('');
  parts.push('У тебя есть доступ к сохранённым изображениям через функции:');
  parts.push('');
  parts.push('**search_image_memories(query)** — ищет изображения по описанию/тегам/именам');
  parts.push('  Возвращает список с ID, описанием, тегами, entities, mentions');
  parts.push('  Используй для поиска: "Маша", "логотип Nike", "офис"');
  parts.push('');
  parts.push('**recall_image_memory(id)** — загружает полное изображение по ID');
  parts.push('  Используй после search чтобы получить саму картинку');
  parts.push('');
  parts.push('**Workflow:**');
  parts.push('1. search_image_memories("Маша") → получаешь список результатов');
  parts.push('2. Смотришь описание, теги, entities, mentions');
  parts.push('3. Если нужно больше контекста — вызови search с другим query');
  parts.push('4. recall_image_memory(id) → загружаешь нужное изображение');
  parts.push('');
  parts.push('### Как использовать инструменты памяти:');
  parts.push('- save_memory → когда узнаёшь что-то важное и долгосрочное о пользователе');
  parts.push('- update_memory → когда пользователь противоречит или уточняет сохранённый факт');
  parts.push('- forget_memory → когда факт устарел или пользователь просит забыть');
  parts.push('- Связывай новые воспоминания с существующими через related_to — это строит граф знаний');
  parts.push('');
  parts.push('### ⚠️ КРИТИЧЕСКИ ВАЖНО - Сохранение изображений:');
  parts.push('');
  parts.push('Когда пользователь присылает фото с ИМЕНЕМ человека/места/объекта:');
  parts.push('→ ОБЯЗАТЕЛЬНО вызови save_image_memory(image_id, description, tags, entities, scope)');
  parts.push('');
  parts.push('НЕ вызывай только для скриншотов интерфейса или временных задач.');
  parts.push('');
  parts.push('### ⚠️ КРИТИЧЕСКИ ВАЖНО - Поиск изображений:');
  parts.push('');
  parts.push('Когда пользователь спрашивает про человека/объект/место:');
  parts.push('→ СНАЧАЛА вызови search_image_memories(query) чтобы найти что есть в памяти');
  parts.push('→ Когда нашёл нужное — вызови recall_image_memory(id)');
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
  parts.push('НЕ упоминай явно что ты что-то сохранил - просто используй память естественно.');
  return parts.join('\n');
}

export interface BuildMemoryPromptOptions {
  memoryEnabled?: boolean;
  includeInstructions?: boolean;
  includeFacts?: boolean;
  customInstructions?: string | null;
  alwaysIncludeInstructions?: boolean;
}

export function buildMemoryFactsBlock(
  userMessages: string[],
  chatId?: string
): { facts: string; usedMemoryIds: string[]; usedImageMemoryIds: string[] } {
  const relevant = getRelevantMemories(userMessages, chatId);
  const relevantImages = getRelevantImageMemories(userMessages, chatId, 5);

  if (relevant.length === 0) {
    return { facts: '', usedMemoryIds: [], usedImageMemoryIds: relevantImages.map(m => m.id) };
  }

  const globalMems = relevant.filter(m => m.scope === 'global');
  const localMems = relevant.filter(m => m.scope === 'local');
  const parts: string[] = [];

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

  return {
    facts: parts.join('\n').trim(),
    usedMemoryIds: relevant.map(m => m.id),
    usedImageMemoryIds: relevantImages.map(m => m.id),
  };
}

export function buildMemoryInstructionsBlock(customInstructions?: string | null): string {
  return (customInstructions?.trim() || getDefaultMemoryInstructions()).trim();
}

// Сборка блока памяти для системного промпта
export function buildMemoryPrompt(
  userMessages: string[],
  chatId?: string,
  memoryEnabled: boolean = true,
  options: BuildMemoryPromptOptions = {}
): { prompt: string; usedMemoryIds: string[]; usedImageMemoryIds: string[] } {
  const {
    includeInstructions = true,
    includeFacts = true,
    customInstructions = null,
    alwaysIncludeInstructions = false,
  } = options;

  if (!memoryEnabled) {
    return { prompt: '', usedMemoryIds: [], usedImageMemoryIds: [] };
  }

  const { facts, usedMemoryIds, usedImageMemoryIds } = buildMemoryFactsBlock(userMessages, chatId);
  const hasFacts = Boolean(facts.trim());

  if (!hasFacts && !alwaysIncludeInstructions) {
    return { prompt: '', usedMemoryIds: [], usedImageMemoryIds: [] };
  }

  const parts: string[] = [];

  if (includeInstructions && (hasFacts || alwaysIncludeInstructions)) {
    parts.push(buildMemoryInstructionsBlock(customInstructions));
  }

  if (includeFacts && hasFacts) {
    parts.push(facts);
  }

  if (parts.length === 0) {
    return { prompt: '', usedMemoryIds: [], usedImageMemoryIds: [] };
  }

  return {
    prompt: parts.join('\n\n'),
    usedMemoryIds,
    usedImageMemoryIds,
  };
}

// Инкремент mentions после использования в промпте
// ВАЖНО: Теперь mentions инкрементится только при реальном использовании (recall_image_memory),
// а не при простом попадании в prompt. Это делает метрику честной.
export function markMemoriesUsed(
  memoryIds: string[], 
  imageMemoryIds: string[], 
  chatId?: string
): void {
  if (memoryIds.length > 0) {
    incrementMentions(memoryIds, chatId);
  }
  // imageMemoryIds НЕ инкрементим здесь — только при реальном recall
}
