# Архитектура Skills + File System
## Gemini Playground — полная спецификация

---

## 1. Проблема которую мы решаем

Сейчас в приложении файлы существуют в двух параллельных измерениях:

**Измерение 1 — API уровень.** Gemini получает файлы как `inlineData` внутри `parts` сообщения. Это просто base64 + mimeType. Нейронка их "видит" и может анализировать.

**Измерение 2 — UI уровень.** Пользователь видит файлы через `AttachedFile` с `previewUrl` (object URL в памяти браузера). Большие файлы хранятся в IndexedDB, мелкие живут в памяти.

Скиллы разрушают эту упрощённую картину. Теперь появляется третий актор:

**Измерение 3 — Skill уровень.** Скилл может:
- **получить** файл от пользователя (прочитать изображение, которое тот прикрепил)
- **произвести** файл (сгенерировать картинку, скачать документ)
- **передать** файл в Gemini (чтобы нейронка его проанализировала)
- **отобразить** файл в чате как результат своей работы

Все три измерения должны работать согласованно. Вот как это строится.

---

## 2. Центральная концепция: SkillArtifact

Когда скилл возвращает что-то, что не является просто JSON-данными для Gemini, он возвращает **артефакт**.

```ts
interface SkillArtifact {
  id: string;           // уникальный ID, генерируется автоматически
  type: ArtifactType;   // что именно это такое
  label?: string;       // человекочитаемое название: "Скриншот", "График"
  
  // Данные — один из вариантов:
  data:
    | { kind: 'base64'; mimeType: string; base64: string }   // файл как base64
    | { kind: 'url'; url: string; mimeType?: string }         // внешний URL
    | { kind: 'text'; content: string; language?: string }    // текст/код
    | { kind: 'json'; value: unknown }                        // структурированные данные
    | { kind: 'blob'; blob: Blob; mimeType: string }          // blob (конвертируется в base64)

  // Поведение:
  sendToGemini?: boolean;   // отправлять ли в API как inlineData? (default: false)
  downloadable?: boolean;   // показывать кнопку скачать? (default: true для файлов)
  filename?: string;        // имя при скачивании
}

type ArtifactType =
  | 'image'       // картинка — рендерится как <img>
  | 'video'       // видео — рендерится как <video>
  | 'audio'       // аудио — рендерится как <audio>
  | 'document'    // PDF, docx и т.п. — рендерится как FilePreview
  | 'code'        // код — рендерится с подсветкой синтаксиса
  | 'table'       // таблица — рендерится как <table>
  | 'chart'       // график — рендерится через recharts/d3
  | 'text'        // просто текст
  | 'custom'      // скилл сам отвечает за рендеринг через renderArtifact()
```

Это всё что нужно знать скиллу. Он создаёт артефакт — система разбирается как его хранить, отображать и передавать Gemini.

---

## 3. Расширенный SkillToolResult

Сейчас `SkillToolResult` — это:
```ts
{ mode: 'fire_and_forget' | 'respond'; response?: unknown }
```

Добавляем поддержку артефактов:

```ts
interface SkillToolResult {
  mode: 'fire_and_forget' | 'respond';
  response?: unknown;           // JSON для Gemini (если mode = respond)
  artifacts?: SkillArtifact[];  // файлы/медиа для отображения в UI
}
```

Артефакты **ортогональны** режиму. Скилл может одновременно:
- вернуть `mode: 'respond'` с данными для Gemini
- И вернуть артефакты которые отобразятся в чате

Пример: скилл генерирует график. Он возвращает `{ mode: 'respond', response: { summary: "..." }, artifacts: [{ type: 'image', data: { kind: 'base64', ... } }] }`. Gemini получает текстовый summary, пользователь видит картинку.

---

## 4. Как артефакты попадают в Message

Добавляем новое поле в существующий тип `Message`:

```ts
interface Message {
  // ... всё что уже есть ...
  skillArtifacts?: SkillArtifact[];  // результаты работы скиллов
}
```

Почему не использовать `files`? Потому что `files: AttachedFile[]` — это то что **пользователь прикрепил**. `skillArtifacts` — это то что **скилл произвёл**. Семантически разные вещи, хотя рендериться могут похоже.

Поток данных:

```
Gemini вызывает tool
  → executor.executeSkillToolCall()
  → skill.onToolCall() возвращает { artifacts: [...] }
  → executor возвращает { artifacts, functionResponse, uiEvents }
  → page.tsx добавляет artifacts в текущее сообщение модели
    setMessages(msgs => msgs.map(m =>
      m.id === targetId
        ? { ...m, skillArtifacts: [...(m.skillArtifacts || []), ...newArtifacts] }
        : m
    ))
  → ChatMessage.tsx видит skillArtifacts и рендерит их
```

---

## 5. Хранение артефактов

Артефакты бывают большими (видео, изображения). Нельзя держать всё в памяти.

**Стратегия хранения:**

```
Размер артефакта
  < 100KB  → держим base64 прямо в Message (в памяти / localStorage)
  > 100KB  → strip из Message, храним в IndexedDB (как уже делается с files)
             в Message остаётся только { id, type, label, stored: 'idb' }
```

Для этого расширяем существующий `fileStorage.ts` — он уже умеет сохранять/загружать по ID, просто добавляем prefix `skill_artifact_`.

При загрузке чата из localStorage — артефакты восстанавливаются из IndexedDB точно так же как сейчас восстанавливаются `files`. Функции `stripFileData` и `restoreFileData` в `storage.ts` расширяются чтобы обрабатывать и `skillArtifacts`.

---

## 6. Рендеринг артефактов в ChatMessage

`ChatMessage.tsx` получает `message.skillArtifacts` и рендерит каждый через **SkillArtifactRenderer**:

```tsx
function SkillArtifactRenderer({ artifact }: { artifact: SkillArtifact }) {
  switch (artifact.type) {
    case 'image':
      // Использует существующий FilePreview / ImageModal
      return <ArtifactImage artifact={artifact} />;

    case 'video':
      // Использует существующий VideoPlayer
      return <ArtifactVideo artifact={artifact} />;

    case 'audio':
      // Использует существующий AudioPlayer
      return <ArtifactAudio artifact={artifact} />;

    case 'document':
      // Использует существующий FilePreview для PDF
      return <ArtifactDocument artifact={artifact} />;

    case 'code':
      // Использует SyntaxHighlighter который уже есть
      return <ArtifactCode artifact={artifact} />;

    case 'table':
      return <ArtifactTable artifact={artifact} />;

    case 'chart':
      return <ArtifactChart artifact={artifact} />;

    case 'custom':
      // Скилл предоставляет React компонент
      const skill = getSkillById(artifact.skillId);
      return skill?.renderArtifact?.(artifact) ?? null;
  }
}
```

Важно: мы **не дублируем код рендеринга**. `ArtifactImage` внутри использует тот же `<img>` и `ImageModal` что уже существует для `AttachedFile`. Разница только в источнике данных.

---

## 7. Как скилл читает файлы пользователя

### Проблема

Пользователь прикрепил картинку. Он хочет чтобы скилл её обработал (например, скилл-редактор изображений). Как скилл получает доступ к этому файлу?

### Решение: файлы в SkillContext

Расширяем `SkillContext` (который уже получает `messages`):

```ts
interface SkillContext {
  chatId: string;
  messages: Readonly<Message[]>;
  
  // Файлы ПОСЛЕДНЕГО сообщения пользователя
  // (то что он прикрепил перед тем как задать вопрос)
  attachedFiles: ReadonlyArray<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    getData(): Promise<string>; // возвращает base64
    getBlob(): Promise<Blob>;
  }>;

  config: Record<string, string>;
  storage: SkillStorage;
  emit: (event: SkillUIEvent) => void;
}
```

Скилл пишет просто:
```ts
async onToolCall(toolName, args, ctx) {
  const imageFile = ctx.attachedFiles.find(f => f.mimeType.startsWith('image/'));
  if (!imageFile) return { mode: 'respond', response: { error: 'Нужна картинка' } };
  
  const base64 = await imageFile.getData();
  // ... обрабатываем ...
}
```

### Как executor строит attachedFiles

В `executor.ts` при вызове `createContext()`:

```ts
function createContext(skill, chatId, messages, emitter): SkillContext {
  // Находим последнее user сообщение
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  
  const attachedFiles = (lastUserMsg?.files ?? []).map(file => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    getData: async () => {
      // Если data уже в памяти — возвращаем
      if (file.data) return file.data;
      // Иначе загружаем из IndexedDB
      const data = await loadFileData(file.id);
      return data ?? '';
    },
    getBlob: async () => {
      const base64 = await this.getData(); // через getData выше
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return new Blob([arr], { type: file.mimeType });
    }
  }));

  return { chatId, messages, attachedFiles, config, storage, emit: emitter };
}
```

---

## 8. Как файл попадает в Gemini от скилла

Есть два сценария:

### Сценарий A: скилл возвращает данные которые Gemini должен проанализировать

Скилл сгенерировал картинку и хочет чтобы Gemini её описал. Скилл возвращает:

```ts
return {
  mode: 'respond',
  response: {
    // Специальный ключ — executor распознаёт и конвертирует в inlineData
    _inline_data: {
      mimeType: 'image/png',
      base64: '...',
    },
    caption: 'Сгенерированное изображение',
  },
  artifacts: [{
    type: 'image',
    label: 'Результат генерации',
    data: { kind: 'base64', mimeType: 'image/png', base64: '...' },
    sendToGemini: true,
  }]
}
```

Когда `sendToGemini: true` в артефакте — executor при формировании `functionResponse` добавляет файл как `inlineData` part:

```ts
// В executor.ts — buildFunctionResponse()
function buildFunctionResponse(result: SkillToolResult, toolName: string) {
  const geminiParts: any[] = [];
  
  // Основной JSON ответ
  geminiParts.push({ 
    functionResponse: { name: toolName, response: result.response ?? {} } 
  });
  
  // Артефакты помеченные sendToGemini
  for (const artifact of result.artifacts ?? []) {
    if (!artifact.sendToGemini) continue;
    
    if (artifact.data.kind === 'base64') {
      geminiParts.push({
        inlineData: {
          mimeType: artifact.data.mimeType,
          data: artifact.data.base64,
        }
      });
    }
  }
  
  return geminiParts;
}
```

Gemini получает tool response И изображение в одном turn — это поддерживается API.

### Сценарий B: пользователь прикрепил файл, скилл его пересылает в Gemini

Это уже работает! Файлы пользователя идут в `parts` сообщения как `inlineData`. Скилл не нужен для этого — Gemini уже видит прикреплённые файлы. Скилл нужен только если хочет **дополнительно обработать** файл сам (resize, convert, extract text) перед тем как Gemini его увидит.

---

## 9. API Route — что меняется

`/api/chat/route.ts` сейчас принимает `memoryTools` как готовые declarations. Добавляем `skillToolResults` в тело запроса:

**Нет.** Route не меняется принципиально. Вся логика скиллов остаётся на клиенте. Route просто проксирует в Gemini. Скиллы исполняются в браузере, их результаты добавляются в следующий turn как `functionResponse`.

Единственное что меняется в route — поддержка `inlineData` в functionResponse частях. Сейчас route строит functionResponse как чистый JSON объект. Для артефактов с `sendToGemini: true` нужно поддержать отправку `parts` массива вместо одного `response` объекта.

Это небольшое изменение в `normalizeIncomingPart()` в route.ts — он должен уметь принять `functionResponse` с `parts: [...]` вместо `response: {...}`.

---

## 10. Полный жизненный цикл (сводная схема)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. ПОДГОТОВКА ЗАПРОСА (page.tsx)                                  │
│                                                                    │
│  systemPrompt                                                      │
│    + buildSkillsSystemPrompt()  ← скиллы с onSystemPrompt()       │
│    = effectiveSystemPrompt                                         │
│                                                                    │
│  tools (ручные) + MEMORY_TOOLS + collectSkillTools()              │
│    = allDeclarations → отправляем в /api/chat                     │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. GEMINI ГЕНЕРИРУЕТ ОТВЕТ (SSE стрим)                            │
│                                                                    │
│  • text chunks → накапливаются                                    │
│  • functionCall → попадает в tool loop                            │
└───────────────────────────┬──────────────────────────────────────┘
                            │
              ┌─────────────┴──────────────┐
              ▼                            ▼
    ┌──────────────────┐        ┌──────────────────────┐
    │  Memory tool?    │        │  Skill tool?          │
    │  fire_and_forget │        │  executeSkillToolCall()│
    │  → localStorage  │        │                       │
    └──────────────────┘        │  1. createContext()   │
                                │     attachedFiles     │
                                │     от последнего msg │
                                │                       │
                                │  2. skill.onToolCall()│
                                │     → SkillToolResult │
                                │       .response       │
                                │       .artifacts      │
                                │       .mode           │
                                │                       │
                                │  3. artifacts →       │
                                │     большие → IndexedDB│
                                │     мелкие → память   │
                                │                       │
                                │  4. uiEvents →        │
                                │     toast, badge...   │
                                └──────────┬────────────┘
                                           │
              ┌────────────────────────────┘
              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. ОБНОВЛЕНИЕ MESSAGE (page.tsx)                                  │
│                                                                    │
│  message.skillArtifacts = [...prev, ...newArtifacts]              │
│                                                                    │
│  if mode === 'respond':                                            │
│    accumulatedResponses.push({                                    │
│      name: toolName,                                              │
│      response: result.response,                                   │
│      inlineParts: artifacts.filter(a => a.sendToGemini)          │
│    })                                                              │
│    → следующий раунд tool loop                                    │
│                                                                    │
│  if mode === 'fire_and_forget':                                    │
│    → модель продолжает без functionResponse                       │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. РЕНДЕРИНГ (ChatMessage.tsx)                                    │
│                                                                    │
│  message.skillArtifacts?.map(artifact =>                          │
│    <SkillArtifactRenderer artifact={artifact} />                  │
│  )                                                                 │
│                                                                    │
│  SkillArtifactRenderer смотрит на artifact.type:                  │
│    image   → <img> + zoom modal                                   │
│    video   → <video controls>                                     │
│    audio   → <audio controls>                                     │
│    code    → SyntaxHighlighter                                    │
│    table   → <table> с сортировкой                               │
│    chart   → recharts component                                   │
│    custom  → skill.renderArtifact(artifact)                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 11. Поддерживаемые типы данных — полная таблица

| Тип | Gemini видит | Пользователь видит | Скачать | sendToGemini |
|-----|-------------|-------------------|---------|-------------|
| `image` | base64 inlineData | `<img>` с zoom | ✓ | опционально |
| `video` | ❌ (слишком большое) | `<video controls>` | ✓ | нет |
| `audio` | base64 inlineData | `<audio controls>` | ✓ | опционально |
| `document` | base64 inlineData (PDF) | FilePreview/iframe | ✓ | опционально |
| `code` | в JSON response | SyntaxHighlighter | ✓ (как .txt) | да (как text) |
| `table` | в JSON response | HTML таблица | ✓ (как .csv) | да (как text) |
| `chart` | в JSON response | recharts | ✓ (как PNG) | опционально |
| `text` | в JSON response | markdown | нет | да |
| `custom` | скилл решает | `skill.renderArtifact()` | скилл решает | скилл решает |

---

## 12. Добавление скилла с файловым выходом — пример

**Скилл "Генератор QR-кода":**

```ts
export const qrCodeSkill: Skill = {
  id: 'qr_generator',
  tools: [{
    name: 'generate_qr',
    description: 'Генерирует QR-код для URL или текста',
    parameters: {
      type: 'object',
      properties: { content: { type: 'string' } },
      required: ['content']
    }
  }],

  async onToolCall(toolName, args, ctx) {
    // Генерируем QR через библиотеку (canvas → base64)
    const canvas = await generateQRCanvas(args.content as string);
    const base64 = canvas.toDataURL('image/png').split(',')[1];

    ctx.emit({ type: 'toast', message: '✅ QR-код готов!', variant: 'success' });

    return {
      mode: 'fire_and_forget',      // модель не ждёт результата
      artifacts: [{
        type: 'image',
        label: `QR: ${args.content}`,
        data: { kind: 'base64', mimeType: 'image/png', base64 },
        downloadable: true,
        filename: 'qr-code.png',
        sendToGemini: false,        // Gemini не нужно видеть QR
      }]
    };
  }
}
```

**Скилл "Анализ изображения"** (читает файл пользователя):

```ts
async onToolCall(toolName, args, ctx) {
  const imageFile = ctx.attachedFiles.find(f => f.mimeType.startsWith('image/'));
  if (!imageFile) {
    return { mode: 'respond', response: { error: 'Прикрепи изображение' } };
  }

  const base64 = await imageFile.getData();
  
  // Делаем что-то с файлом (например EXIF extraction)
  const exif = extractExifData(base64);

  return {
    mode: 'respond',               // Gemini получает EXIF данные
    response: { exif, filename: imageFile.name },
    artifacts: [{
      type: 'table',               // показываем EXIF как таблицу
      label: 'EXIF данные',
      data: { kind: 'json', value: exif },
    }]
  };
}
```

---

## 13. Что не меняется

- Вся логика memory (fire_and_forget, localStorage) — не трогаем
- `/api/chat/route.ts` — минимальные изменения только в normalizeIncomingPart
- `ChatInput.tsx` — не трогаем
- `Sidebar.tsx` — не трогаем
- `lib/storage.ts` — только добавляем обработку `skillArtifacts` рядом с существующей логикой `files`
- `lib/fileStorage.ts` — используем как есть, только с другим prefix для ключей

Вся новая логика изолирована в:
- `lib/skills/types.ts` — добавляем `SkillArtifact`
- `lib/skills/executor.ts` — добавляем buildFunctionResponse + attachedFiles в context
- `components/SkillArtifactRenderer.tsx` — новый компонент
- `components/ChatMessage.tsx` — добавляем рендер `skillArtifacts`
- `types/index.ts` — добавляем `skillArtifacts` в `Message`
