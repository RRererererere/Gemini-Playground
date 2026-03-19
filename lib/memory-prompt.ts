import { Memory, getRelevantMemories, incrementMentions } from './memory-store';

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
): { prompt: string; usedMemoryIds: string[] } {
  if (!memoryEnabled) {
    return { prompt: '', usedMemoryIds: [] };
  }

  const relevant = getRelevantMemories(userMessages, chatId);

  if (relevant.length === 0) {
    return { prompt: '', usedMemoryIds: [] };
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

  parts.push('### Как использовать инструменты памяти:');
  parts.push('- save_memory → когда узнаёшь что-то важное и долгосрочное о пользователе');
  parts.push('- update_memory → когда пользователь противоречит или уточняет сохранённый факт');
  parts.push('- forget_memory → когда факт устарел или пользователь просит забыть');
  parts.push('- Связывай новые воспоминания с существующими через related_to — это строит граф знаний');
  parts.push('');
  parts.push('### КРИТИЧЕСКИ ВАЖНО:');
  parts.push('- Инструменты памяти выполняются АВТОМАТИЧЕСКИ и МОЛЧА в фоне');
  parts.push('- Ты ДОЛЖЕН продолжить свой текстовый ответ СРАЗУ после вызова memory tool');
  parts.push('- Пример: save_memory(fact="Зовут Дима") → "Приятно познакомиться, Дима!"');
  parts.push('- НЕ жди подтверждения, НЕ останавливайся - просто продолжай говорить');
  parts.push('- НЕ упоминай явно что ты что-то сохранил - используй память естественно');

  const usedMemoryIds = relevant.map(m => m.id);

  return {
    prompt: parts.join('\n'),
    usedMemoryIds,
  };
}

// Инкремент mentions после использования в промпте
export function markMemoriesUsed(memoryIds: string[], chatId?: string): void {
  if (memoryIds.length > 0) {
    incrementMentions(memoryIds, chatId);
  }
}
