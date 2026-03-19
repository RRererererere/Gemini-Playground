# 🧠 Система памяти для Gemini Studio

Полноценная RAG-система памяти, которая позволяет модели запоминать факты о пользователе и использовать их в будущих разговорах.

## ✨ Возможности

### Автоматическое запоминание
- Модель сама решает, что важно запомнить
- Три инструмента: `save_memory`, `update_memory`, `forget_memory`
- Категории: identity, tech, style, project, preference, belief, episode
- Уровень уверенности (0.0–1.0) для каждого факта

### Два типа памяти
- **Global** — память для всех чатов (предпочтения, стек, личность)
- **Local** — память только для текущего чата (детали задачи, временный контекст)

### Умный поиск
- Автоматический фильтр релевантности без LLM
- Всегда включает identity и style из global
- Остальные факты — по пересечению keywords с последними сообщениями
- Лимит 20 воспоминаний на запрос

### Граф знаний
- Связи между воспоминаниями через `related_to`
- Визуализация графа на D3.js
- Интерактивный граф с зумом и перетаскиванием

### UI
- **MemoryPill** — компактный индикатор операций с памятью в чате
- **MemoryModal** — полноценный менеджер памяти с двумя видами:
  - Список с поиском, фильтрами и инлайн-редактированием
  - Граф с визуализацией связей

## 📁 Структура файлов

```
lib/
  memory-store.ts       # CRUD операции, фильтр релевантности
  memory-tools.ts       # Определения инструментов для Gemini API
  memory-prompt.ts      # Сборка блока памяти для системного промпта

components/
  MemoryPill.tsx        # Индикатор операций с памятью в чате
  MemoryModal.tsx       # Модал со списком и графом
  MemoryGraph.tsx       # D3.js граф воспоминаний

types/index.ts          # Обновлённые типы (Message, MemoryOperation)
```

## 🚀 Как это работает

### 1. Включение памяти
В правом сайдбаре → секция "Инструменты" → переключатель "Память"

### 2. Автоматическое сохранение
Модель сама вызывает инструменты памяти когда:
- Пользователь сообщает что-то значимое
- Нужно обновить устаревший факт
- Пользователь просит забыть что-то

### 3. Использование в промпте
При каждом запросе:
1. Извлекаются релевантные воспоминания
2. Добавляются в системный промпт
3. Инкрементится счётчик `mentions`

### 4. Управление памятью
Кнопка "Управление памятью" → MemoryModal:
- **Список**: поиск, фильтры, редактирование, удаление
- **Граф**: визуализация связей, интерактивность

## 🎨 Дизайн

Полностью адаптирован под существующую дизайн-систему:
- Монохромная палитра с акцентами
- Категории воспоминаний имеют свои цвета
- Адаптивный дизайн (desktop + mobile)
- Анимации и transitions

## 🔧 Технические детали

### Хранение
- localStorage с ключами:
  - `memory_graph_global` — глобальная память
  - `memory_graph_local_{chatId}` — локальная память для чата

### Фильтр релевантности
```typescript
// Всегда включаем identity и style
const alwaysInclude = globalMemories.filter(
  m => m.category === 'identity' || m.category === 'style'
);

// Остальные — по пересечению keywords
const recentWords = extractWords(userMessages.slice(-2).join(' '));
const otherGlobal = globalMemories
  .filter(m => m.keywords.some(kw => recentWords.has(kw.toLowerCase())));

// Сортировка по confidence * mentions DESC
combined.sort((a, b) => (b.confidence * b.mentions) - (a.confidence * a.mentions));

// Лимит 20 штук
return combined.slice(0, 20);
```

### Интеграция с Gemini API
Инструменты памяти добавляются к существующим tools:
```typescript
// В API route отправляются отдельно
memoryTools: memoryEnabled ? MEMORY_TOOLS : []
```

Вызовы обрабатываются локально со скрытыми functionResponse:
```typescript
if (name === 'save_memory' && memoryEnabled) {
  const memory = saveMemory({ fact, scope, category, keywords, confidence });
  
  // 1. Добавляем MemoryPill для UI
  setMessages(prev => prev.map(m => ({
    ...m,
    memoryOperations: [...ops, { type: 'save', scope, fact, memoryId: memory.id }]
  })));
  
  // 2. Добавляем СКРЫТЫЙ toolCall + toolResponse для модели
  // Это позволяет модели видеть результат и не зацикливаться
  setMessages(prev => prev.map(m => ({
    ...m,
    toolCalls: [...(m.toolCalls || []), { 
      id: callId, 
      name, 
      args, 
      status: 'submitted',
      result: { success: true, id: memory.id },
      hidden: true // НЕ показывается в UI
    }],
    toolResponses: [...(m.toolResponses || []), {
      id: generateId(),
      toolCallId: callId,
      name,
      response: { success: true, id: memory.id },
      hidden: true // НЕ показывается в UI
    }]
  })));
}
```

**Почему скрытые functionResponse?**

Без functionResponse:
1. Модель вызывает save_memory()
2. Не получает подтверждения
3. Думает что функция не сработала
4. Вызывает снова → зацикливание ❌

Со скрытым functionResponse:
1. Модель вызывает save_memory()
2. Получает { success: true, id: "mem_123" }
3. Понимает что всё ок
4. Продолжает естественный диалог ✅

## 📊 Граф знаний

D3.js force-directed граф:
- Размер узла = `confidence * mentions`
- Цвет узла = категория
- Рёбра = связи `related_to`
- Интерактивность: zoom, drag, click

## 🎯 Примеры использования

### Сохранение факта
```
Пользователь: "Я работаю с Next.js и TypeScript"
Модель: [вызывает save_memory]
  fact: "Работает с Next.js и TypeScript"
  scope: "global"
  category: "tech"
  keywords: ["nextjs", "typescript", "react"]
  confidence: 1.0
```

### Обновление факта
```
Пользователь: "Теперь я перешёл на Rust"
Модель: [вызывает update_memory]
  id: "abc12345"
  fact: "Работает с Rust"
  confidence: 1.0
```

### Использование в промпте
```
## Долгосрочная память

### Что ты знаешь о пользователе:
- [id: abc12345] Работает с Rust (tech, уверенность: 100%)
- [id: def67890] Предпочитает краткие ответы (style, уверенность: 90%)

### Как использовать инструменты памяти:
- save_memory → когда узнаёшь что-то важное
- update_memory → когда пользователь противоречит факту
- forget_memory → когда факт устарел
```

## 🔐 Безопасность

- Все данные хранятся локально в localStorage
- Никакие данные не отправляются на сторонние серверы
- Память можно полностью отключить

## 🎨 Кастомизация

### Цвета категорий
```typescript
const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  identity: '#a855f7',
  tech: '#3b82f6',
  style: '#f59e0b',
  project: '#10b981',
  preference: '#ec4899',
  belief: '#8b5cf6',
  episode: '#6366f1',
};
```

### Лимиты
```typescript
// Максимум воспоминаний в промпте
const MAX_MEMORIES = 20;

// Минимальная длина слова для поиска
const MIN_WORD_LENGTH = 2;

// Количество последних сообщений для анализа
const RECENT_MESSAGES_COUNT = 2;
```

## 🐛 Отладка

Логи в консоли:
```typescript
console.log('Memory saved:', memory);
console.log('Relevant memories:', relevant);
console.log('Used memory IDs:', usedMemoryIds);
```

## 📝 TODO (опционально)

- [ ] Экспорт/импорт памяти
- [ ] Поиск по графу
- [ ] Автоматическая очистка старых воспоминаний
- [ ] Статистика использования памяти
- [ ] Векторный поиск (если добавить embeddings)

---

Система полностью интегрирована и готова к использованию! 🎉
