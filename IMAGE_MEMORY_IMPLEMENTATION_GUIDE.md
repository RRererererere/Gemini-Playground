# Image Memory System — Implementation Guide

Краткое руководство по реализации Image Memory System. Полная архитектура в [IMAGE_MEMORY_ARCHITECTURE.md](./IMAGE_MEMORY_ARCHITECTURE.md).

## ✅ Что уже сделано

1. **Базовая инфраструктура**
   - `lib/image-memory-store.ts` — CRUD операции для визуальной памяти
   - `lib/image-memory-hash.ts` — pHash + SHA-256 для дедупликации
   - `lib/memory-tools.ts` — новые инструменты для Gemini

2. **Дедупликация**
   - Перцептивный хэш (pHash) для определения похожих изображений
   - SHA-256 для точных дубликатов
   - Hamming distance для сравнения pHash
   - Thumbnail generation 80x80

## 🚀 Следующие шаги

### Шаг 2: Обработка инструментов в app/page.tsx

Нужно добавить обработку трёх новых инструментов:

#### 2.1. save_image_memory

```typescript
// В app/page.tsx, в функции обработки tool calls

if (toolCall.name === 'save_image_memory') {
  const args = toolCall.args;
  
  // Найти изображение по image_id
  const imageId = args.image_id;
  const fileId = imageAliases.get(imageId) || imageId;
  
  // Получить файл из attachedFiles или из IndexedDB
  const file = attachedFiles.find(f => f.id === fileId);
  if (!file) {
    console.error('Image not found:', imageId);
    continue;
  }
  
  const base64 = await file.getData();
  
  // Получить размеры изображения
  const { width, height } = await getImageDimensions(base64, file.mimeType);
  
  // Получить контекст из последних сообщений
  const messageContext = messages
    .slice(-3)
    .map(m => m.content)
    .join(' ')
    .slice(-200);
  
  // Сохранить в память
  const memory = await saveImageMemory({
    base64,
    mimeType: file.mimeType,
    width,
    height,
    description: args.description,
    tags: args.tags,
    entities: args.entities,
    scope: args.scope,
    chatId: currentChatId,
    messageContext,
    annotations: args.save_annotations ? currentAnnotations : undefined,
    relatedMemoryIds: args.related_memory_ids || []
  });
  
  // Если нужно сохранить кропы
  if (args.save_crops && args.save_crops.length > 0) {
    for (const crop of args.save_crops) {
      if (crop.separate_memory) {
        // Создать кроп через cropAndScale
        const cropResult = await cropAndScale(
          base64,
          file.mimeType,
          crop.region,
          1 // без масштабирования
        );
        
        // Сохранить как отдельное image memory
        await saveImageMemory({
          base64: cropResult.base64,
          mimeType: cropResult.mimeType,
          width: cropResult.cropSize.width,
          height: cropResult.cropSize.height,
          description: `${crop.label} (кроп из: ${args.description})`,
          tags: [...args.tags, 'crop'],
          entities: args.entities,
          scope: args.scope,
          chatId: currentChatId,
          messageContext,
          sourceImageMemoryId: memory.id,
          cropRegion: crop.region
        });
      }
    }
  }
  
  console.log('[image-memory] Saved:', memory.id);
}
```

#### 2.2. search_image_memories

```typescript
if (toolCall.name === 'search_image_memories') {
  const args = toolCall.args;
  
  const results = searchImageMemories(
    args.query,
    args.scope,
    args.limit || 10
  );
  
  // Вернуть результаты в Gemini
  functionResponses.push({
    name: 'search_image_memories',
    response: {
      found: results.length,
      results: results.map(r => ({
        id: r.id,
        description: r.description,
        tags: r.tags,
        entities: r.entities,
        mentions: r.mentions,
        created_at: new Date(r.created_at).toLocaleDateString('ru-RU')
      }))
    }
  });
}
```

#### 2.3. recall_image_memory

```typescript
if (toolCall.name === 'recall_image_memory') {
  const args = toolCall.args;
  
  const memory = await getImageMemory(args.image_memory_id);
  
  if (memory) {
    const base64 = await loadImageMemoryData(memory.id);
    
    // Инкрементим mentions
    incrementImageMemoryMentions([memory.id]);
    
    // Добавляем изображение в контекст для Gemini
    // Через inlineData в следующем запросе
    
    functionResponses.push({
      name: 'recall_image_memory',
      response: {
        id: memory.id,
        description: memory.description,
        tags: memory.tags,
        entities: memory.entities,
        size: `${memory.originalWidth}×${memory.originalHeight}`,
        recalled: true
      }
    });
    
    // Добавить в responseParts для Gemini
    responseParts.push({
      inlineData: {
        mimeType: memory.mimeType,
        data: base64
      }
    });
  } else {
    functionResponses.push({
      name: 'recall_image_memory',
      response: { error: 'Image memory not found' }
    });
  }
}
```

### Шаг 3: UI — Memory Modal с вкладкой изображений

#### 3.1. Обновить MemoryModal.tsx

```typescript
// Добавить state для вкладок
const [activeTab, setActiveTab] = useState<'text' | 'images'>('text');
const [imageMemories, setImageMemories] = useState<ImageMemoryMeta[]>([]);
const [imageSearchQuery, setImageSearchQuery] = useState('');

// Загрузить image memories
useEffect(() => {
  if (open && activeTab === 'images') {
    const memories = getImageMemoryIndex();
    setImageMemories(memories);
  }
}, [open, activeTab]);

// Поиск по изображениям
const filteredImages = useMemo(() => {
  if (!imageSearchQuery) return imageMemories;
  return searchImageMemories(imageSearchQuery, undefined, 50);
}, [imageMemories, imageSearchQuery]);

// Рендер вкладок
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setActiveTab('text')}
    className={activeTab === 'text' ? 'active' : ''}
  >
    📝 Текст
  </button>
  <button
    onClick={() => setActiveTab('images')}
    className={activeTab === 'images' ? 'active' : ''}
  >
    🖼️ Изображения
  </button>
</div>

{activeTab === 'images' && (
  <div>
    <input
      type="text"
      placeholder="🔍 Поиск по описанию, тегам..."
      value={imageSearchQuery}
      onChange={(e) => setImageSearchQuery(e.target.value)}
      className="w-full mb-4 px-3 py-2 border rounded"
    />
    
    <div className="grid grid-cols-4 gap-4">
      {filteredImages.map(mem => (
        <div key={mem.id} className="border rounded p-2">
          <img
            src={mem.thumbnailBase64}
            alt={mem.description}
            className="w-full h-20 object-cover rounded mb-2"
          />
          <div className="text-xs">
            <div className="font-semibold truncate">
              {mem.entities.join(', ') || 'Без имени'}
            </div>
            <div className="text-gray-500">
              {mem.tags.length} тегов
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

### Шаг 4: Website Builder — mem:// resolver

#### 4.1. Обновить LivePreviewPanel.tsx

```typescript
// Добавить функцию резолвинга mem:// ссылок
async function resolveMemoryRefs(html: string): Promise<string> {
  const refs = html.matchAll(/mem:\/\/(img_mem_[a-z0-9]+)/g);
  
  for (const [fullMatch, id] of refs) {
    // Извлекаем ID без префикса img_mem_
    const memoryId = id.replace('img_mem_', '');
    const imageData = await loadImageMemoryData(memoryId);
    
    if (imageData) {
      // Определяем MIME type
      const memory = await getImageMemory(memoryId);
      const mimeType = memory?.mimeType || 'image/jpeg';
      
      html = html.replace(
        fullMatch,
        `data:${mimeType};base64,${imageData}`
      );
    }
  }
  
  return html;
}

// Использовать перед рендером
useEffect(() => {
  if (htmlContent) {
    resolveMemoryRefs(htmlContent).then(resolved => {
      setResolvedHtml(resolved);
    });
  }
}, [htmlContent]);
```

#### 4.2. Добавить инструмент в website-builder.ts

```typescript
// В массив tools добавить:
{
  name: 'insert_image_from_memory',
  description: `Найди и вставь изображение из визуальной памяти пользователя в сайт.
  
  1. Вызови этот инструмент с поисковым запросом
  2. Получишь список найденных изображений с ID
  3. Используй формат <img src="mem://img_mem_ID" alt="описание"> в HTML коде
  
  Примеры:
  - query: "фото Маши" → <img src="mem://img_mem_abc123" alt="Маша">
  - query: "логотип компании" → <img src="mem://img_mem_xyz789" alt="Логотип">`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Поисковый запрос для поиска изображения'
      },
      usage_hint: {
        type: 'string',
        description: 'Как будет использоваться: "hero banner", "profile photo", "logo", "gallery"'
      }
    },
    required: ['query']
  }
}

// Обработка в onToolCall:
if (toolName === 'insert_image_from_memory') {
  const results = searchImageMemories(args.query, undefined, 5);
  
  return {
    mode: 'respond',
    response: {
      found: results.length,
      images: results.map(r => ({
        id: `img_mem_${r.id}`,
        description: r.description,
        tags: r.tags,
        size: `${r.originalWidth}×${r.originalHeight}`,
        usage: `<img src="mem://img_mem_${r.id}" alt="${r.description}">`
      }))
    }
  };
}
```

### Шаг 5: Chat Input — кнопка "From memory"

#### 5.1. Обновить ChatInput.tsx

```typescript
// Добавить state
const [showMemoryPicker, setShowMemoryPicker] = useState(false);

// Добавить кнопку рядом с attach
<button
  onClick={() => setShowMemoryPicker(true)}
  className="p-2 hover:bg-gray-100 rounded"
  title="Вставить из памяти"
>
  🖼️
</button>

// Modal для выбора изображения
{showMemoryPicker && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
      <h3 className="text-lg font-semibold mb-4">Выбрать из памяти</h3>
      
      <input
        type="text"
        placeholder="🔍 Поиск..."
        className="w-full mb-4 px-3 py-2 border rounded"
        onChange={(e) => {
          const results = searchImageMemories(e.target.value);
          setSearchResults(results);
        }}
      />
      
      <div className="grid grid-cols-3 gap-4">
        {searchResults.map(mem => (
          <div
            key={mem.id}
            onClick={async () => {
              // Загрузить полное изображение
              const base64 = await loadImageMemoryData(mem.id);
              
              // Добавить как обычный файл
              const file: AttachedFile = {
                id: `recalled_${mem.id}`,
                name: `${mem.entities.join('_') || 'image'}.jpg`,
                mimeType: mem.mimeType,
                size: Math.round((base64.length * 3) / 4),
                data: base64
              };
              
              setAttachedFiles(prev => [...prev, file]);
              setShowMemoryPicker(false);
            }}
            className="cursor-pointer hover:opacity-80"
          >
            <img
              src={mem.thumbnailBase64}
              alt={mem.description}
              className="w-full h-24 object-cover rounded"
            />
            <div className="text-xs mt-1 truncate">
              {mem.entities.join(', ') || mem.description}
            </div>
          </div>
        ))}
      </div>
      
      <button
        onClick={() => setShowMemoryPicker(false)}
        className="mt-4 px-4 py-2 bg-gray-200 rounded"
      >
        Закрыть
      </button>
    </div>
  </div>
)}
```

### Шаг 6: Промпт с инструкциями

#### 6.1. Обновить lib/memory-prompt.ts

```typescript
// Добавить секцию про визуальную память

export function buildMemoryPrompt(
  memories: Memory[],
  imageMemories: ImageMemoryMeta[]
): string {
  let prompt = '### Долгосрочная память\n\n';
  
  // Текстовая память (существующий код)
  // ...
  
  // Визуальная память
  if (imageMemories.length > 0) {
    prompt += '\n### Визуальная память\n\n';
    prompt += 'У тебя есть доступ к сохранённым изображениям:\n\n';
    
    imageMemories.forEach(mem => {
      prompt += `- **${mem.entities.join(', ') || 'Изображение'}** (ID: ${mem.id})\n`;
      prompt += `  ${mem.description}\n`;
      prompt += `  Теги: ${mem.tags.join(', ')}\n`;
      if (mem.mentions > 0) {
        prompt += `  Использовано: ${mem.mentions} раз\n`;
      }
      prompt += '\n';
    });
    
    prompt += '\nИспользуй `recall_image_memory(id)` чтобы вспомнить изображение.\n';
    prompt += 'Используй `search_image_memories(query)` для поиска по описанию.\n\n';
  }
  
  // Инструкции по классификации
  prompt += '\n### Правила сохранения изображений\n\n';
  prompt += 'При получении изображения ВСЕГДА оценивай его тип:\n\n';
  prompt += '**Тип A (СОХРАНЯТЬ через save_image_memory):**\n';
  prompt += '- Фото человека с именем или контекстом\n';
  prompt += '- Логотип, бренд, референс\n';
  prompt += '- Место, объект с идентификацией\n';
  prompt += '- Любое изображение которое понадобится в будущем\n\n';
  prompt += '**Тип B (НЕ СОХРАНЯТЬ):**\n';
  prompt += '- Скриншот интерфейса с вопросом "куда нажать"\n';
  prompt += '- Фото ошибки/бага для разовой помощи\n';
  prompt += '- Временный черновик\n';
  prompt += '- Абстрактная картинка без контекста\n\n';
  
  return prompt;
}
```

## 🎯 Приоритеты

1. **Высокий приоритет** (критично для работы):
   - Обработка `save_image_memory` в app/page.tsx
   - Обработка `search_image_memories` и `recall_image_memory`
   - Промпт с инструкциями

2. **Средний приоритет** (улучшает UX):
   - Memory Modal с вкладкой изображений
   - Chat Input кнопка "From memory"

3. **Низкий приоритет** (дополнительные фичи):
   - Website Builder интеграция
   - Панель медиа в LivePreviewPanel

## 🧪 Тестирование

### Базовый сценарий

1. Отправить фото с текстом "Это моя подруга Маша"
2. Gemini должен вызвать `save_image_memory` автоматически
3. Проверить что изображение появилось в localStorage (`image_memory_index`)
4. Проверить что полное изображение в IndexedDB (`img_mem_full_*`)
5. В новом чате написать "Помнишь мою подругу?"
6. Gemini должен вызвать `search_image_memories("подруга")`
7. Найти Машу и вспомнить контекст

### Дедупликация

1. Отправить одно и то же фото дважды
2. Проверить что создалась только одна запись
3. Проверить что `mentions` увеличился

### Кропы

1. Отправить групповое фото
2. Gemini создаёт аннотации для каждого лица
3. Вызывает `save_image_memory` с `save_crops`
4. Проверить что создались отдельные image memories для каждого кропа
5. Проверить что `sourceImageMemoryId` указывает на оригинал

## 📝 Чеклист

- [ ] Обработка `save_image_memory` в app/page.tsx
- [ ] Обработка `search_image_memories` в app/page.tsx
- [ ] Обработка `recall_image_memory` в app/page.tsx
- [ ] Промпт с инструкциями в memory-prompt.ts
- [ ] Memory Modal вкладка "Изображения"
- [ ] Chat Input кнопка "From memory"
- [ ] Website Builder `mem://` resolver
- [ ] Website Builder инструмент `insert_image_from_memory`
- [ ] Тестирование базового сценария
- [ ] Тестирование дедупликации
- [ ] Тестирование кропов

## 🚨 Важные замечания

1. **Fire-and-forget инструменты**: `save_image_memory` не возвращает functionResponse в Gemini. Он выполняется на клиенте мгновенно.

2. **Хэширование асинхронное**: pHash требует загрузки изображения в Image(), это занимает время. Используй Promise.all для параллельного вычисления.

3. **Квота localStorage**: При превышении квоты автоматически удаляются 20% самых старых записей.

4. **IndexedDB может быть недоступен**: Всегда проверяй `typeof window !== 'undefined'` перед использованием.

5. **Thumbnail качество**: Используется JPEG с quality 0.8 для баланса между размером и качеством.
