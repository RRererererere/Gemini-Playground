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
  parts.push('### КРИТИЧЕСКИ ВАЖНО - КАК РАБОТАЮТ ИНСТРУМЕНТЫ ПАМЯТИ:');
  parts.push('');
  parts.push('Memory tools (save_memory, update_memory, forget_memory) работают по принципу "fire-and-forget":');
  parts.push('1. Ты вызываешь функцию → она выполняется МГНОВЕННО и МОЛЧА на клиенте');
  parts.push('2. Ты НЕ получишь functionResponse - его вообще нет');
  parts.push('3. Ты ДОЛЖЕН продолжить генерацию текста В ТОМ ЖЕ turn');
  parts.push('4. Считай что функция ВСЕГДА выполняется успешно');
  parts.push('');
  parts.push('ПРАВИЛЬНО:');
  parts.push('  Один turn: functionCall(save_memory) + text("Приятно познакомиться, Дима!")');
  parts.push('');
  parts.push('НЕПРАВИЛЬНО:');
  parts.push('  Turn 1: functionCall(save_memory) [стоп]');
  parts.push('  Turn 2: text("Приятно...") ❌');
  parts.push('');
  parts.push('Gemini API поддерживает несколько parts в одном candidate - используй это!');
  parts.push('НЕ упоминай явно что ты что-то сохранил - просто используй память естественно.');

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
