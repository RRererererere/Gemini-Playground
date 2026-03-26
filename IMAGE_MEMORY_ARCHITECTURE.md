# Image Memory System — Архитектура и План Реализации

## 📋 Оглавление

1. [Проблема и Решение](#проблема-и-решение)
2. [Архитектура](#архитектура)
3. [Структура Данных](#структура-данных)
4. [Дедупликация](#дедупликация)
5. [Инструменты для Gemini](#инструменты-для-gemini)
6. [Интеграция с Image Analyser](#интеграция-с-image-analyser)
7. [Website Builder Integration](#website-builder-integration)
8. [UI Изменения](#ui-изменения)
9. [Проблемы и Решения](#проблемы-и-решения)
10. [План Реализации](#план-реализации)

---

## Проблема и Решение

### Что сейчас сломано

1. **Текстовая память без изображений**
   - `lib/memory-store.ts` хранит только `fact: string`
   - Gemini видит фото, отвечает, и навсегда забывает
   - При следующем упоминании — ноль контекста

2. **Аннотации не сохраняются**
   - Image Analyser создаёт аннотации через `annotate_regions`
   - После закрытия чата — всё пропало
   - Нет способа вспомнить что было обведено

3. **Website Builder не может использовать сохранённые медиа**
   - Нет механизма поиска по сохранённым изображениям
   - Невозможно вставить фото из предыдущего чата

### Решение: Image Memory System

**Ключевая концепция** — разделение на два типа изображений:

#### Тип A — Семантически значимые (СОХРАНЯТЬ)
- Фото человека: "это моя подруга Маша"
- Логотип, бренд, референс
- Скриншот продукта/результата
- Портфолио, дизайн
- Лицо, место, объект с именем/контекстом

#### Тип B — Утилитарные (НЕ СОХРАНЯТЬ)
- Скриншот сайта с вопросом "куда тыкать"
- Фото ошибки/бага
- Временный черновик
- Абстрактная картинка без контекста
- Просто "посмотри на это"

**Решение принимает Gemini**, не пользователь. Промпт содержит инструкцию по классификации.

---

## Архитектура

### Трёхуровневая система хранения

```
┌─────────────────────────────────────────────────────────────┐
│ localStorage: image_memory_index                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ImageMemoryMeta[] — весь список с thumbnail 80x80       │ │
│ │ Размер: ~200KB на 50 записей (3KB × 50 + мета)         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ IndexedDB: gemini_studio_files                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ img_mem_full_${id} — полное изображение base64          │ │
│ │ Размер: ~200KB-2MB на изображение                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ img_mem_annotated_${id} — с нарисованными аннотациями   │ │
│ │ Размер: ~200KB-1MB (PNG)                                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Почему именно так

- **Список всех воспоминаний нужен быстро** (для промпта, для UI) → localStorage, только мета
- **Полные изображения большие** → IndexedDB, там лимит 50-500MB
- **Thumbnail 80x80 маленький** (~3KB) → в мете, рядом с текстом, не нужен доп. запрос
- **Annotated-версия нужна только при открытии/показе** → IndexedDB, lazy-load

---

## Структура Данных

### ImageMemory (полная структура)

```typescript
interface ImageMemory {
  id: string;                    // nanoid(8)
  
  // Хэши для дедупликации
  pHash: string;                 // перцептивный хэш 64-bit hex — "fuzzy fingerprint"
  cryptoHash: string;            // SHA-256 — точный дубликат
  
  // Хранение
  thumbnailBase64: string;       // миниатюра 80x80 в base64 (~3KB) — для UI
  fullImageKey: string;          // ключ в IndexedDB под полное изображение
  mimeType: string;
  originalWidth: number;
  originalHeight: number;
  
  // Семантика (генерирует Gemini)
  description: string;           // "Маша, подруга пользователя, тёмные волосы, улыбается"
  tags: string[];                // ["person", "female", "friend", "Маша", "outdoor"]
  entities: string[];            // ["Маша"] — именованные сущности
  scope: 'global' | 'local';     // global = запомнить навсегда, local = только этот чат
  
  // Контекст сохранения
  savedFromChatId: string;
  savedFromMessageContext: string; // последние 200 символов разговора = "почему сохранили"
  
  // Время и использование
  created_at: number;
  updated_at: number;
  mentions: number;              // сколько раз достали из памяти
  
  // Аннотации
  annotations?: StoredAnnotation[]; // аннотации поверх оригинала
  
  // Связи
  sourceImageMemoryId?: string;  // если это кроп из другого изображения
  cropRegion?: { x1_pct, y1_pct, x2_pct, y2_pct };
  derivedCropIds: string[];      // ID кропов которые вышли из этого изображения
  relatedMemoryIds: string[];    // связанные текстовые воспоминания (из memory-store)
  relatedImageIds: string[];     // связанные другие image memories
}
```

### ImageMemoryMeta (для localStorage)

```typescript
type ImageMemoryMeta = Omit<ImageMemory, 'fullImageKey'> & {
  hasFull: boolean; // есть ли полное изображение в IndexedDB
};
```

### StoredAnnotation

```typescript
interface StoredAnnotation {
  x1_pct: number;
  y1_pct: number;
  x2_pct: number;
  y2_pct: number;
  label: string;
  type: 'highlight' | 'pointer' | 'warning' | 'success' | 'info';
}
```

---

## Дедупликация

### Двойной хэш: pHash + SHA-256

#### SHA-256 — точный дубликат (одинаковые байты)

```typescript
async function computeCryptoHash(base64: string): Promise<string> {
  const bytes = base64ToUint8Array(base64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return bufferToHex(hashBuffer);
}
```

#### pHash (Perceptual Hash, DCT-based) — похожие изображения

Реализация ~80 строк, работает в браузере без зависимостей:

1. Уменьшить до 32x32 через canvas
2. Перевести в grayscale
3. Применить 2D DCT
4. Взять верхний левый квадрант 8x8 = 64 бита
5. Сравнить каждый бит со средним значением

Результат: 64-битный хэш как hex-строка

#### Hamming Distance

```typescript
function hammingDistance(h1: string, h2: string): number {
  // XOR по битам, считаем единицы
  // Расстояние 0 = одинаковые, ≤10 = похожие, >10 = разные
}
```

### Порог дедупликации

```typescript
const DEDUP_THRESHOLD = 10; // Hamming distance

// Процесс сохранения:
// 1. cryptoHash совпадает → ТОЧНЫЙ дубликат, вернуть существующий (mentions++)
// 2. hammingDistance(pHash) ≤ 10 → ПОХОЖИЙ, предложить объединить
// 3. hammingDistance(pHash) > 10 → НОВОЕ изображение, сохранить
```

Если дубликат с правками — обновляем существующий (description, tags, mentions) + сохраняем как новый crop/variant с `sourceImageMemoryId`.

---

## Инструменты для Gemini

### 1. save_image_memory

```typescript
{
  name: 'save_image_memory',
  description: `Сохрани изображение в долгосрочную визуальную память.
  
  ВЫЗЫВАЙ когда:
  - Пользователь присылает фото человека которого надо запомнить
  - Фото объекта/места с идентификацией ("это наш офис", "этот логотип")
  - Референс который понадобится в будущих разговорах
  - Пользователь явно просит запомнить изображение
  
  НЕ ВЫЗЫВАЙ когда:
  - Скриншот с вопросом "где находится кнопка"
  - Временная задача (найди ошибку, прочитай текст)
  - Абстрактный пример без личного контекста
  
  ⚠️ FIRE-AND-FORGET: выполняется мгновенно. НЕ жди ответа. Продолжай текст.`,
  parameters: {
    image_id: string,      // ID изображения из чата
    description: string,   // детальное описание для будущего поиска
    tags: string[],        // ['person', 'female', 'Маша', 'friend']
    entities: string[],    // ['Маша', 'Nike'] — имена, бренды
    scope: 'global' | 'local',
    save_annotations: boolean, // сохранить текущие аннотации
    save_crops: [{         // сохранить конкретные обведённые регионы отдельно
      region: ZoomRegion,
      label: string,       // "лицо Маши", "логотип в углу"
      separate_memory: boolean // создать отдельное image memory для кропа
    }]
  }
}
```

### 2. search_image_memories

```typescript
{
  name: 'search_image_memories',
  description: `Найди сохранённые изображения по описанию/тегам.
  
  Используй когда нужно найти ранее сохранённое фото для вставки в сайт, чат, или ответ.`,
  parameters: {
    query: string,         // "фото Маши", "логотип Nike", "наш офис"
    scope?: 'global' | 'local',
    limit: number          // сколько результатов вернуть
  }
}
```

### 3. recall_image_memory

```typescript
{
  name: 'recall_image_memory',
  description: `Достань конкретное изображение из памяти по ID.`,
  parameters: {
    image_memory_id: string
  }
}
```

---

## Интеграция с Image Analyser

### Текущий флоу

`annotate_regions` создаёт временные аннотации поверх изображения в `AnnotationOverlay.tsx`. После закрытия или нового сообщения — пропадают.

### Новый флоу: "Обвёл → Подписал → Сохранил"

```
1. Пользователь кидает фото Маши

2. Gemini вызывает annotate_regions:
   annotations: [{ 
     x1:15, y1:5, x2:55, y2:85, 
     label: "Маша", 
     type: "success" 
   }]

3. Gemini ОДНОВРЕМЕННО вызывает save_image_memory:
   image_id: "img_1",
   description: "Маша, подруга пользователя. Тёмные волосы...",
   save_annotations: true,
   save_crops: [{
     region: {x1:15,y1:5,x2:55,y2:85}, 
     label: "лицо Маши", 
     separate_memory: true
   }]

4. В памяти сохраняется:
   - Полное фото с аннотациями (ImageMemory #A)
   - Кроп только лица Маши (ImageMemory #B, sourceImageMemoryId: #A)

5. В следующем чате: "Помнишь мою подругу?" 
   → Gemini находит #A и #B
```

---

## Website Builder Integration

### Проблема

Website Builder генерирует HTML. Как вставить в него изображение из IndexedDB, которое живёт только в браузере пользователя?

### Решение — Memory Reference Protocol

#### В HTML который генерирует Gemini:

```html
<img src="mem://img_mem_abc123" alt="Маша" />
<img src="mem://img_mem_xyz789" alt="логотип" />
```

#### Resolver в LivePreviewPanel.tsx:

```typescript
// Перед рендером HTML в iframe — резолвим все mem:// ссылки
async function resolveMemoryRefs(html: string): Promise<string> {
  const refs = html.matchAll(/mem:\/\/(img_mem_[a-z0-9]+)/g);
  
  for (const [fullMatch, id] of refs) {
    const imageData = await loadImageMemoryData(id);
    if (imageData) {
      html = html.replace(
        fullMatch, 
        `data:image/jpeg;base64,${imageData}`
      );
    }
  }
  
  return html;
}
```

### Новый инструмент для Website Builder

```typescript
{
  name: 'insert_image_from_memory',
  description: `Найди и вставь изображение из визуальной памяти пользователя в сайт.
  
  После вызова используй формат <img src="mem://ID"> в HTML коде сайта.`,
  parameters: {
    query: string,         // поисковый запрос
    usage_hint: string     // "hero banner", "profile photo", "logo"
  }
}
```

---

## Поиск по Image Memory

Поскольку у нас нет векторной БД — используем keyword matching + tag overlap, как в существующем `getRelevantMemories`:

```typescript
export function searchImageMemories(
  query: string,
  limit: number = 10
): ImageMemoryMeta[] {
  const index = getImageMemoryIndex();
  const queryWords = extractWords(query);
  
  const scored = index.map(mem => {
    const tagOverlap = mem.tags.filter(t => 
      queryWords.has(t.toLowerCase())
    ).length;
    
    const entityMatch = mem.entities.some(e => 
      query.toLowerCase().includes(e.toLowerCase())
    ) ? 3 : 0;
    
    const descriptionWords = extractWords(mem.description);
    const descOverlap = [...queryWords].filter(w => 
      descriptionWords.has(w)
    ).length;
    
    const score = tagOverlap * 2 + entityMatch + descOverlap + (mem.mentions * 0.1);
    
    return { mem, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.mem);
}
```

Это **не** векторный поиск, но для 50-200 сохранённых изображений — более чем достаточно. При упоминании "Маша" — тег `Маша` даст точное совпадение. При "подруга с тёмными волосами" — description matching поймает это.

---

## UI Изменения

### 1. Memory Modal — новая вкладка "Images"

```
Текущие вкладки: [Все] [Identity] [Tech] [Style] ...
Новые вкладки: [Текст] [Изображения]

Вкладка "Изображения":
┌─────────────────────────────────────┐
│  [🔍 Поиск по описанию...]          │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ 80px │ │ 80px │ │ 80px │        │
│  │thumb │ │thumb │ │thumb │        │
│  │      │ │      │ │      │        │
│  └──────┘ └──────┘ └──────┘        │
│  Маша     Офис     Nike             │
│  5 тегов  3 тега   2 тега           │
│                                     │
│  [+ Добавить вручную]               │
└─────────────────────────────────────┘
```

### 2. Chat Input — новая кнопка

Рядом с `📎 Attach file` добавляем `🖼️ From memory`. Открывает picker с поиском по image memories. Выбранное изображение вставляется как обычный файл в сообщение.

### 3. Аннотации — новая кнопка "Сохранить в память"

В `AnnotationOverlay.tsx` после создания аннотаций появляется кнопка:

```
[💾 Сохранить аннотации в память]
```

При клике — вызывает `save_image_memory` с текущими аннотациями + предлагает описание + теги (Gemini заполняет автоматически, пользователь может поправить).

### 4. Website Builder — панель "Media from memory"

В LivePreviewPanel при активном website builder:

```
┌──────────────────────────────┐
│ 📸 Media from memory         │
│ [🔍 Найди фото офиса...]     │
│                              │
│ ┌────┐ ┌────┐ ┌────┐        │
│ │    │ │    │ │    │ [Drag]  │
│ └────┘ └────┘ └────┘        │
└──────────────────────────────┘
```

Drag & Drop изображения на preview → вставляется как `<img src="mem://ID">` в HTML.

---

## Проблемы и Решения

### Проблема 1: Квота хранилища

localStorage лимит 5-10MB. Если сохранять 100 изображений с thumbnail 80x80 (~3KB) — это 300KB. В пределах лимита. Полные изображения (~300KB каждое × 100) = 30MB → IndexedDB, там лимит 50-500MB.

**Решение:** Thumbnail в localStorage-мете, полное только в IndexedDB. При открытии Memory Modal — показываем thumbnails сразу. При клике — загружаем полное асинхронно.

### Проблема 2: pHash в браузере без тяжёлых зависимостей

Нет готовой библиотеки. Нужна реализация в ~80 строк pure JS через Canvas API. DCT 8x8 — стандартная математика, реализуется без зависимостей.

**Решение:** Своя реализация в `lib/image-memory-hash.ts`. Canvas умеет `drawImage` + `getImageData` → всё что нужно для pHash.

### Проблема 3: Gemini должен понять какие изображения сохранять

Если не объяснить — будет сохранять всё или ничего.

**Решение:** В системный промпт (в `buildMemoryPrompt`) добавляем секцию:

```
### Визуальная память

При получении изображения ВСЕГДА оценивай:
- Тип A (СОХРАНЯТЬ): люди, места, объекты с именем/контекстом, референсы для будущего
- Тип B (НЕ СОХРАНЯТЬ): скриншоты интерфейса, баги, временные задачи, "куда тыкать"

Если тип A — немедленно вызывай save_image_memory (fire-and-forget).
```

### Проблема 4: Website Builder + base64 в iframe

HTML сайта с `data:image/jpeg;base64,HUGE_STRING` внутри кода — это кошмар для редактирования и квоты.

**Решение:** Хранить в HTML как `mem://id`, резолвить только при рендере. Пользователь видит читаемый HTML. При скачивании/экспорте — отдельная функция `resolveForExport()` которая подставляет base64.

### Проблема 5: Рекогниция — "помнишь эту женщину?"

Пользователь присылает новое фото Маши. Gemini должен понять что это та же Маша что в памяти.

**Решение (двухуровневый):**

1. **pHash:** если фото похожее (Hamming ≤ 10) — точно тот же файл → мгновенный матч
2. **Semantic:** Gemini вызывает `search_image_memories("женщина тёмные волосы подруга")` → находит запись → сопоставляет описание → докладывает пользователю "Да, это похоже на Машу из памяти"

Векторный поиск по эмбеддингам лиц был бы лучше, но он требует сервера. Для браузерного приложения — keyword + pHash достаточно для 80% случаев.

---

## План Реализации

### Шаг 1 — Базовая структура данных ✅

- [x] `lib/image-memory-store.ts` — CRUD для ImageMemory
- [x] `lib/image-memory-hash.ts` — pHash + SHA-256
- [x] Расширить `lib/memory-tools.ts` — новые инструменты

### Шаг 2 — Автосохранение из Image Analyser

- [ ] В `skill.ts` обработчик `annotate_regions` — добавить вызов save логики
- [ ] Расширить промпт с инструкциями для Gemini
- [ ] Обработка `save_image_memory` в `app/page.tsx`

### Шаг 3 — UI в Memory Modal

- [ ] Новая вкладка Images в `MemoryModal.tsx`
- [ ] Grid с thumbnails, поиск, удаление
- [ ] Детальный просмотр с аннотациями

### Шаг 4 — Website Builder интеграция

- [ ] `mem://` протокол resolver в `LivePreviewPanel.tsx`
- [ ] `insert_image_from_memory` инструмент в `website-builder.ts`
- [ ] Панель поиска медиа в UI

### Шаг 5 — "From memory" в чате

- [ ] Кнопка в `ChatInput.tsx`
- [ ] Picker с поиском
- [ ] Вставка выбранного изображения

### Шаг 6 — Промпт и контекст

- [ ] Обновить `lib/memory-prompt.ts` — добавить визуальную память в контекст
- [ ] Инструкции для Gemini по классификации Type A / Type B
- [ ] Автоматическое включение релевантных image memories в промпт

---

## Ключевые принципы

1. **Нет дубликатов** — двойной хэш (pHash + SHA-256), пересечение Hamming distance
2. **ИИ сам решает что сохранять** — через промпт с чёткими критериями Type A / Type B
3. **Без сервера** — всё в localStorage + IndexedDB, как и текущая система
4. **Аннотации = часть памяти** — не теряются, связаны с оригиналом и кропами через граф
5. **Website Builder через mem://** — чистый HTML, без вшитых base64, резолвится при рендере
6. **Обратная совместимость** — не ломает текущую память, новая таблица рядом

---

## Следующие шаги

1. Реализовать обработку `save_image_memory` в `app/page.tsx`
2. Добавить UI для Memory Modal с вкладкой изображений
3. Интегрировать с Image Analyser для автосохранения
4. Добавить `mem://` resolver в Website Builder
5. Обновить промпт с инструкциями по визуальной памяти
