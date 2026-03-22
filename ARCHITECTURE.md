# Gemini Playground — Архитектура и Структура Проекта

## 📋 Оглавление

1. [Общий обзор](#общий-обзор)
2. [Технологический стек](#технологический-стек)
3. [Архитектура приложения](#архитектура-приложения)
4. [Структура файлов](#структура-файлов)
5. [Ключевые компоненты](#ключевые-компоненты)
6. [Системы и подсистемы](#системы-и-подсистемы)
7. [Потоки данных](#потоки-данных)
8. [API Routes](#api-routes)
9. [Хранение данных](#хранение-данных)
10. [Типы данных](#типы-данных)

---

## Общий обзор

**Gemini Playground** — это полнофункциональная веб-платформа для работы с Google Gemini API, построенная на Next.js 14 с App Router. Проект представляет собой альтернативу Google AI Studio с расширенными возможностями:

- **Многопользовательская работа с API ключами** — round-robin ротация, per-model блокировка при rate limits
- **Система памяти** — сохранение фактов о пользователе (локальная и глобальная память)
- **Skills система** — расширяемая архитектура для добавления инструментов (built-in + HuggingFace Spaces)
- **DeepThink режим** — двухпроходный анализ с расширенным контекстом
- **Управление чатами** — сохранение, загрузка, экспорт/импорт
- **Мультимодальность** — поддержка изображений, аудио, видео, документов


---

## Технологический стек

### Frontend
- **Next.js 14.2.5** — React фреймворк с App Router
- **React 18** — UI библиотека
- **TypeScript 5** — типизация
- **Tailwind CSS 3.4** — стилизация
- **Lucide React** — иконки
- **React Markdown** — рендеринг markdown
- **rehype-highlight** — подсветка синтаксиса кода
- **remark-gfm** — GitHub Flavored Markdown
- **D3.js** — визуализация графов памяти
- **nanoid** — генерация уникальных ID

### Backend (API Routes)
- **Next.js API Routes** — серверные эндпоинты
- **Google Gemini API** — языковая модель
- **Server-Sent Events (SSE)** — стриминг ответов
- **IndexedDB** — хранение больших файлов
- **localStorage** — настройки и чаты

### Инфраструктура
- **Vercel** — деплой и хостинг (опционально)
- **Node.js** — серверная среда выполнения


---

## Архитектура приложения

### Общая схема

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Client)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              app/page.tsx (Main Component)             │ │
│  │  - State management (messages, settings, streaming)   │ │
│  │  - Event handlers (send, edit, delete, regenerate)    │ │
│  │  - Skills integration                                  │ │
│  │  - Memory integration                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│           │                    │                    │         │
│           ▼                    ▼                    ▼         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ ChatMessage  │   │  ChatInput   │   │   Sidebar    │    │
│  │  Component   │   │  Component   │   │  Component   │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Storage Layer (Client-side)               │ │
│  │  - localStorage: settings, chats, API keys, memory    │ │
│  │  - IndexedDB: large files (images, audio, video)      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/SSE
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server (API Routes)               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/chat       - Main streaming endpoint             │ │
│  │  /api/deepthink  - DeepThink analysis                  │ │
│  │  /api/models     - Fetch available models              │ │
│  │  /api/tokens     - Count tokens                        │ │
│  │  /api/translate  - Translate messages                  │ │
│  │  /api/hf-proxy   - Proxy to HuggingFace Spaces         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Google Gemini API                         │
│  - generativelanguage.googleapis.com                        │
│  - Streaming responses                                       │
│  - Function calling (tools)                                  │
│  - Multimodal inputs                                         │
└─────────────────────────────────────────────────────────────┘
```

### Архитектурные принципы

1. **Single Page Application (SPA)** — вся логика UI в одном компоненте `app/page.tsx`
2. **Server-Side Streaming** — ответы от Gemini стримятся через SSE
3. **Client-Side Storage** — все данные хранятся локально (privacy-first)
4. **Modular Systems** — память, скиллы, DeepThink — независимые подсистемы
5. **Type Safety** — строгая типизация через TypeScript
6. **Optimistic UI** — мгновенная реакция на действия пользователя


---

## Структура файлов

```
gemini-playground/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (серверные эндпоинты)
│   │   ├── chat/
│   │   │   └── route.ts          # Основной чат (SSE streaming)
│   │   ├── deepthink/
│   │   │   └── route.ts          # DeepThink анализ
│   │   ├── hf-proxy/
│   │   │   └── route.ts          # Проксирование HuggingFace Spaces
│   │   ├── models/
│   │   │   └── route.ts          # Получение списка моделей
│   │   ├── tokens/
│   │   │   └── route.ts          # Подсчёт токенов
│   │   └── translate/
│   │       └── route.ts          # Перевод текста
│   ├── globals.css               # Глобальные стили + CSS переменные
│   ├── layout.tsx                # Root layout (HTML, body, fonts)
│   └── page.tsx                  # Главная страница (1800+ строк)
│
├── components/                   # React компоненты
│   ├── ChatInput.tsx             # Поле ввода + прикрепление файлов
│   ├── ChatMessage.tsx           # Отображение сообщения (user/model)
│   ├── DeepThinkToggle.tsx       # Переключатель DeepThink режима
│   ├── HFSpaceManager.tsx        # Управление HuggingFace Spaces
│   ├── MemoryGraph.tsx           # Граф памяти (D3.js)
│   ├── MemoryModal.tsx           # Модальное окно памяти
│   ├── MemoryPill.tsx            # Пилюля памяти в чате
│   ├── Sidebar.tsx               # Боковая панель настроек
│   ├── SkillArtifactRenderer.tsx # Рендеринг артефактов скиллов
│   ├── SkillsMarket.tsx          # Маркетплейс скиллов
│   ├── SkillsUI.tsx              # UI для управления скиллами
│   └── ToolBuilder.tsx           # Конструктор инструментов
│
├── lib/                          # Утилиты и бизнес-логика
│   ├── apiKeyManager.ts          # Round-robin ротация API ключей
│   ├── fileStorage.ts            # IndexedDB для файлов
│   ├── gemini.ts                 # Утилиты для Gemini API
│   ├── memory-prompt.ts          # Инжекция памяти в промпт
│   ├── memory-store.ts           # CRUD операции с памятью
│   ├── memory-tools.ts           # Tool declarations для памяти
│   ├── storage.ts                # localStorage + IndexedDB
│   ├── useDeepThink.ts           # Хук для DeepThink
│   ├── useSkillsUI.ts            # Хук для Skills UI
│   └── skills/                   # Skills система
│       ├── built-in/             # Встроенные скиллы
│       │   ├── calculator.ts     # Калькулятор
│       │   ├── datetime.ts       # Дата и время
│       │   ├── index.ts          # Экспорт всех built-in
│       │   ├── notes.ts          # Заметки
│       │   ├── qr-generator.ts   # QR коды
│       │   ├── table-generator.ts # Таблицы
│       │   └── url-reader.ts     # Чтение URL
│       ├── hf-space/             # HuggingFace Spaces интеграция
│       │   ├── caller.ts         # HTTP вызовы к Spaces
│       │   ├── index.ts          # Экспорт
│       │   ├── parser.ts         # Парсинг Gradio API
│       │   ├── skill-factory.ts  # Создание скиллов из Spaces
│       │   └── types.ts          # Типы для HF Spaces
│       ├── executor.ts           # Выполнение скиллов
│       ├── index.ts              # Главный экспорт
│       ├── registry.ts           # Реестр скиллов
│       └── types.ts              # Типы для скиллов
│
├── types/
│   └── index.ts                  # Все TypeScript типы проекта
│
├── assets/                       # Документация и ресурсы
│   ├── ARTIFACTS_GUIDE.md        # Гайд по артефактам
│   ├── HF_SPACES_GUIDE.md        # Гайд по HuggingFace Spaces
│   ├── icon.svg                  # Иконка приложения
│   ├── SKILLS_ARCHITECTURE.md    # Архитектура скиллов
│   └── SKILLS_DEV_GUIDE.md       # Гайд по разработке скиллов
│
├── next.config.mjs               # Конфигурация Next.js
├── tailwind.config.js            # Конфигурация Tailwind
├── tsconfig.json                 # Конфигурация TypeScript
├── package.json                  # Зависимости и скрипты
├── vercel.json                   # Конфигурация Vercel
├── BUGFIXES.md                   # Список исправленных багов
└── README.md                     # Основная документация
```


---

## Ключевые компоненты

### 1. app/page.tsx — Главный компонент (God Component)

**Размер**: ~1850 строк  
**Роль**: Центральный компонент приложения, управляет всем состоянием и логикой

#### State Management

```typescript
// Сообщения и чат
const [messages, setMessages] = useState<Message[]>([]);
const [currentChatId, setCurrentChatId] = useState<string | null>(null);
const [chatTitle, setChatTitle] = useState('');
const [unsaved, setUnsaved] = useState(false);

// API ключи (множественные)
const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
const [activeKeyIndex, setActiveKeyIndex] = useState(0);

// Настройки модели
const [model, setModel] = useState('');
const [systemPrompt, setSystemPrompt] = useState('');
const [temperature, setTemperature] = useState(1.0);
const [thinkingBudget, setThinkingBudget] = useState(-1);
const [maxOutputTokens, setMaxOutputTokens] = useState(8192);

// UI состояние
const [isStreaming, setIsStreaming] = useState(false);
const [tokenCount, setTokenCount] = useState(0);
const [isCountingTokens, setIsCountingTokens] = useState(false);
const [error, setError] = useState('');

// Системы
const [memoryEnabled, setMemoryEnabled] = useState(true);
const deepThinkState = useDeepThink();
const skillsState = useSkillsUI();
```

#### Основные функции

**streamGeneration()** — главная функция генерации ответов
- Строит полный системный промпт (base + memory + skills)
- DeepThink Pass 1 (если включён)
- Отправляет запрос к `/api/chat` с SSE
- Обрабатывает стриминг (текст, thinking, tool calls)
- Tool execution loop (до 10 раундов)
- Memory tools (save_memory, update_memory, forget_memory)
- Skills tools (выполнение через executor)
- Обработка ошибок (rate limit, quota, invalid key)

**saveCurrentChat()** — сохранение чата
- Создаёт объект SavedChat
- Сохраняет в localStorage + IndexedDB (файлы)
- Обновляет список чатов локально (без перезагрузки)

**handleSend()** — отправка сообщения
- Создаёт новое user сообщение
- Добавляет прикреплённые файлы
- Вызывает streamGeneration()

**handleEdit()** — редактирование сообщения
- User message: регенерирует ответ с новым текстом
- Model message: обновляет текст без регенерации

**handleRegenerate()** — регенерация ответа
- Находит предыдущее user сообщение
- Вызывает streamGeneration() с историей до этого сообщения


### 2. components/ChatMessage.tsx — Отображение сообщения

**Роль**: Рендеринг одного сообщения (user или model)

#### Возможности
- Markdown рендеринг с подсветкой кода
- Отображение thinking (обычное и DeepThink)
- Tool calls (скрытые и видимые)
- Memory operations (save/update/forget)
- Skill artifacts (изображения, таблицы, графики)
- Кнопки действий (copy, edit, regenerate, continue, delete)
- Редактирование inline
- Блокировка контента (safety filters)
- Ошибки генерации

#### Структура сообщения

```typescript
interface Message {
  id: string;
  role: 'user' | 'model';
  parts: Part[];                    // Текст, thinking, inline data
  files?: AttachedFile[];           // Прикреплённые файлы
  toolCalls?: ToolCall[];           // Вызовы функций
  toolResponses?: ToolResponse[];   // Ответы функций
  memoryOperations?: MemoryOperation[]; // Операции с памятью
  skillArtifacts?: SkillArtifact[]; // Результаты скиллов
  thinking?: string;                // Обычное thinking
  deepThinking?: string;            // DeepThink thinking
  isStreaming?: boolean;            // Идёт генерация
  error?: string;                   // Ошибка генерации
  // ... и другие поля
}
```

### 3. components/ChatInput.tsx — Поле ввода

**Роль**: Ввод текста и прикрепление файлов

#### Возможности
- Textarea с автоматическим ростом
- Drag & drop файлов
- Превью прикреплённых файлов
- Поддержка форматов:
  - Изображения: PNG, JPG, WebP, GIF, HEIC, HEIF
  - Аудио: MP3, WAV, OGG, M4A, FLAC
  - Видео: MP4, MOV, AVI, WebM
  - Документы: PDF, TXT, JSON
- Конвертация в base64
- Сохранение в IndexedDB (большие файлы)
- Кнопка отправки / остановки

### 4. components/Sidebar.tsx — Боковая панель

**Роль**: Настройки и управление чатами

#### Секции

**API Keys**
- Добавление/удаление ключей
- Метки для ключей
- Индикация активного ключа
- Блокировка при rate limit (per-model)

**Models**
- Динамическая загрузка из API
- Фильтрация (только текстовые модели)
- Отображение лимитов (input/output tokens)
- Сортировка (новейшие первыми)

**System Prompt**
- Редактор системного промпта
- Сохранённые промпты (библиотека)
- Быстрое переключение

**Tools**
- Список активных инструментов
- Tool Builder (конструктор)
- Включение/выключение

**Settings**
- Temperature (0-2)
- Thinking Budget (-1 = auto, 0 = off, N = tokens)
- Max Output Tokens (настраиваемый лимит)
- Memory toggle

**Saved Chats**
- Список сохранённых чатов
- Загрузка чата
- Удаление чата
- Экспорт/импорт
- Drag & drop для сортировки

**Token Counter**
- Реальное количество токенов (с memory + skills)
- Визуальная шкала заполнения
- Индикатор подсчёта


---

## Системы и подсистемы

### 1. Memory System (Система памяти)

**Цель**: Сохранение фактов о пользователе для персонализации ответов

#### Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Memory System                         │
├─────────────────────────────────────────────────────────┤
│  lib/memory-store.ts      - CRUD операции               │
│  lib/memory-tools.ts      - Tool declarations           │
│  lib/memory-prompt.ts     - Инжекция в промпт           │
│  components/MemoryModal.tsx - UI управления             │
│  components/MemoryGraph.tsx - Визуализация (D3.js)      │
└─────────────────────────────────────────────────────────┘
```

#### Типы памяти

**Local Memory** (локальная)
- Привязана к конкретному чату
- Хранится в `localStorage` с ключом `memory_local_{chatId}`
- Используется для контекста текущего разговора

**Global Memory** (глобальная)
- Доступна во всех чатах
- Хранится в `localStorage` с ключом `memory_global`
- Используется для постоянных фактов о пользователе

#### Структура Memory

```typescript
interface Memory {
  id: string;                    // Уникальный ID (nanoid)
  fact: string;                  // Текст факта
  scope: 'local' | 'global';     // Область видимости
  category?: string;             // Категория (опционально)
  confidence: number;            // Уверенность (0-1)
  keywords: string[];            // Ключевые слова для поиска
  related_to?: string[];         // Связанные memory ID
  mentions: number;              // Сколько раз использовалась
  created_at: number;            // Timestamp создания
  updated_at: number;            // Timestamp обновления
}
```

#### Memory Tools

Модель может вызывать эти функции:

**save_memory** — сохранить новый факт
```typescript
{
  fact: string;
  scope: 'local' | 'global';
  category?: string;
  confidence?: number;
  keywords?: string[];
}
```

**update_memory** — обновить существующий факт
```typescript
{
  memory_id: string;
  fact?: string;
  confidence?: number;
  keywords?: string[];
}
```

**forget_memory** — удалить факт
```typescript
{
  memory_id: string;
  scope: 'local' | 'global';
}
```

#### Инжекция в промпт

При каждом запросе `buildMemoryPrompt()` строит промпт с релевантными воспоминаниями:

1. Извлекает ключевые слова из последних user сообщений
2. Ищет релевантные воспоминания (по keywords)
3. Сортирует по релевантности и mentions
4. Формирует промпт:

```
You have access to memory about the user:

[Global Memory]
- Fact 1 (confidence: 0.9, category: preferences)
- Fact 2 (confidence: 0.8, category: personal)

[Local Memory (this chat)]
- Fact 3 (confidence: 1.0, category: context)

Use this information to personalize your responses.
```

#### Memory UI

**MemoryModal** — модальное окно управления
- Список всех воспоминаний (local + global)
- Фильтрация по scope, category
- Редактирование фактов
- Удаление
- Экспорт/импорт

**MemoryGraph** — граф связей (D3.js)
- Узлы = воспоминания
- Рёбра = связи (related_to)
- Интерактивность (drag, zoom)
- Цвета по категориям

**MemoryPill** — пилюля в чате
- Показывает операции с памятью
- Клик → открывает MemoryModal


### 2. Skills System (Система навыков)

**Цель**: Расширение возможностей модели через внешние инструменты

#### Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Skills System                         │
├─────────────────────────────────────────────────────────┤
│  lib/skills/registry.ts       - Реестр скиллов          │
│  lib/skills/executor.ts       - Выполнение скиллов      │
│  lib/skills/types.ts          - Типы                    │
│  lib/skills/built-in/         - Встроенные скиллы       │
│  lib/skills/hf-space/         - HuggingFace интеграция  │
│  components/SkillsUI.tsx      - UI управления           │
│  components/SkillsMarket.tsx  - Маркетплейс             │
│  components/SkillArtifactRenderer.tsx - Рендеринг       │
└─────────────────────────────────────────────────────────┘
```

#### Типы скиллов

**Built-in Skills** (встроенные)
- `calculator` — математические вычисления
- `datetime` — текущая дата и время
- `notes` — сохранение заметок
- `qr-generator` — генерация QR кодов
- `table-generator` — создание таблиц
- `url-reader` — чтение содержимого URL

**HuggingFace Spaces Skills**
- Динамическое подключение Gradio Spaces
- Автоматический парсинг API
- Проксирование через `/api/hf-proxy`

#### Структура Skill

```typescript
interface Skill {
  id: string;                    // Уникальный ID
  name: string;                  // Название
  description: string;           // Описание для модели
  version: string;               // Версия
  author?: string;               // Автор
  enabled: boolean;              // Включён/выключен
  
  // Инструменты (функции)
  tools: SkillTool[];
  
  // Lifecycle hooks
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
  onMessageComplete?: (message: Message, chatId: string, allMessages: Message[]) => Promise<void>;
}

interface SkillTool {
  name: string;                  // Имя функции
  description: string;           // Описание
  parameters: ToolSchemaField[]; // Параметры (JSON Schema)
  execute: (args: any, context: SkillContext) => Promise<SkillToolResult>;
}

interface SkillToolResult {
  success: boolean;
  data?: any;                    // Данные для модели
  artifacts?: SkillArtifact[];   // Артефакты для UI
  error?: string;
}
```

#### Skill Artifacts (Артефакты)

Результаты работы скиллов, которые отображаются в UI:

```typescript
interface SkillArtifact {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'code' | 'table' | 'chart' | 'text' | 'custom';
  label?: string;
  data: 
    | { kind: 'base64'; mimeType: string; base64: string }
    | { kind: 'url'; url: string }
    | { kind: 'text'; content: string; language?: string }
    | { kind: 'json'; value: unknown }
    | { kind: 'blob'; blob: Blob; mimeType: string };
  sendToGemini?: boolean;        // Отправить в следующий запрос
  downloadable?: boolean;        // Можно скачать
  filename?: string;
}
```

#### Execution Flow

1. Модель вызывает skill tool (через function calling)
2. `executeSkillToolCall()` находит скилл в реестре
3. Вызывает `tool.execute()` с аргументами
4. Получает результат (data + artifacts)
5. Отправляет data обратно модели
6. Отображает artifacts в UI

#### HuggingFace Spaces Integration

**Подключение Space**:
1. Пользователь вводит URL Space (например `https://huggingface.co/spaces/user/space`)
2. `parseGradioSpace()` парсит Gradio API
3. `createSkillFromSpace()` создаёт Skill с tools
4. Skill добавляется в реестр

**Вызов Space**:
1. Модель вызывает tool
2. `callHFSpace()` отправляет запрос через `/api/hf-proxy`
3. Proxy делает запрос к Gradio API
4. Результат возвращается как artifact


### 3. DeepThink System (Система глубокого анализа)

**Цель**: Двухпроходный анализ для улучшения качества ответов

#### Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                  DeepThink System                        │
├─────────────────────────────────────────────────────────┤
│  lib/useDeepThink.ts          - React hook              │
│  app/api/deepthink/route.ts   - API endpoint            │
│  components/DeepThinkToggle.tsx - UI toggle             │
└─────────────────────────────────────────────────────────┘
```

#### Как работает

**Pass 1: Анализ** (DeepThink API)
1. Отправляет всю историю чата к `/api/deepthink`
2. Модель анализирует контекст и намерения пользователя
3. Генерирует расширенный системный промпт
4. Показывает процесс мышления (thinking)

**Pass 2: Ответ** (Main Chat API)
1. Использует расширенный промпт из Pass 1
2. Генерирует финальный ответ
3. Пользователь видит только результат (thinking скрыт)

#### DeepThink System Prompt

Специальный промпт для Pass 1:

```
Ты — внутренний аналитик и стратег.
Твоя задача: прочитать диалог, понять реальное намерение пользователя,
и создать системный промпт для модели-ответчика.

Анализируй:
- Реальное намерение (что пользователь хочет на самом деле)
- Стиль общения (формальный/неформальный)
- Настроение (радость/грусть/злость)
- Контекст (что важно учесть)
- Стратегию ответа (как лучше ответить)

Выведи только финальный системный промпт.
```

#### DeepThink Memory

Результаты предыдущих анализов сохраняются в сообщениях:
- Маркер: `[DeepThink context from previous assistant turn]`
- Используется для контекста в следующих анализах
- Помогает модели помнить предыдущие выводы

#### UI

**DeepThinkToggle** — переключатель
- Включение/выключение режима
- Индикатор анализа (spinner)
- Показ thinking в реальном времени

**Редактирование анализа**
- Пользователь может отредактировать результат Pass 1
- Регенерация ответа с новым промптом


### 4. API Key Management (Управление ключами)

**Цель**: Round-robin ротация ключей с per-model блокировкой при rate limits

#### Архитектура

```typescript
// lib/apiKeyManager.ts

interface ApiKeyEntry {
  key: string;                   // API ключ
  label?: string;                // Метка (опционально)
  blockedUntil?: number;         // Legacy global block
  blockedByModel?: Record<string, number>; // Per-model блокировка
  lastUsed?: number;             // Timestamp последнего использования
  errorCount: number;            // Счётчик ошибок
}
```

#### Функции

**getNextAvailableKey(keys, model)** — получить следующий доступный ключ
1. Фильтрует заблокированные ключи для данной модели
2. Сортирует по lastUsed (LRU)
3. Возвращает первый доступный

**blockKeyForModel(keys, key, model, durationMs)** — заблокировать ключ
- Устанавливает `blockedByModel[model] = Date.now() + durationMs`
- Сохраняет в localStorage

**isRateLimitError(status, message)** — проверка на rate limit
- HTTP 429
- Сообщения: "quota", "rate limit", "resource exhausted"

**isInvalidKeyError(message)** — проверка на невалидный ключ
- HTTP 401, 403
- Сообщения: "invalid api key", "permission denied"

#### Логика ротации

1. Пользователь отправляет сообщение
2. `getNextAvailableKey()` выбирает ключ
3. Запрос к Gemini API
4. Если rate limit:
   - Блокируем ключ на 60 секунд для этой модели
   - Пробуем следующий ключ
   - Повторяем до 3 раз
5. Если invalid key:
   - Помечаем ключ как невалидный
   - Показываем ошибку пользователю

#### UI

**Sidebar → API Keys**
- Список ключей с метками
- Индикация активного ключа
- Индикация заблокированных ключей
- Добавление/удаление ключей


---

## Потоки данных

### 1. Отправка сообщения (Happy Path)

```
User types message → handleSend()
  ↓
Create user Message object
  ↓
Add to messages state
  ↓
streamGeneration()
  ↓
Build system prompt:
  - Base system prompt
  - + Memory prompt (buildMemoryPrompt)
  - + Skills prompt (buildSkillsSystemPrompt)
  ↓
DeepThink Pass 1? (if enabled)
  ↓ YES
  POST /api/deepthink
    ↓
  Stream thinking
    ↓
  Get enhanced prompt
  ↓
POST /api/chat (SSE)
  ↓
Stream response:
  - Text chunks → append to message
  - Thinking → update message.thinking
  - Tool calls → execute tools
  ↓
Tool execution loop:
  - Memory tools → update localStorage
  - Skills tools → execute skill
  - Regular tools → execute function
  ↓
Send tool responses back to API
  ↓
Continue streaming
  ↓
Finish → mark message as complete
  ↓
Auto-save chat (if unsaved)
  ↓
Update token count
```

### 2. Tool Execution Flow

```
Model generates function call
  ↓
Parse tool call from stream
  ↓
Add to message.toolCalls
  ↓
Check tool type:
  ↓
  ├─ Memory tool? (save_memory, update_memory, forget_memory)
  │   ↓
  │   Execute immediately (fire-and-forget)
  │   ↓
  │   Update localStorage
  │   ↓
  │   Add to message.memoryOperations (for UI)
  │   ↓
  │   Continue streaming
  │
  ├─ Skill tool? (skill_*)
  │   ↓
  │   Find skill in registry
  │   ↓
  │   Execute skill.tool.execute()
  │   ↓
  │   Get result (data + artifacts)
  │   ↓
  │   Add artifacts to message.skillArtifacts
  │   ↓
  │   Send data back to model
  │   ↓
  │   Continue streaming
  │
  └─ Regular tool?
      ↓
      Execute tool function
      ↓
      Send response back to model
      ↓
      Continue streaming
```

### 3. Chat Save/Load Flow

**Save**:
```
User sends message → Auto-save triggered
  ↓
saveCurrentChat(messages)
  ↓
Create SavedChat object:
  - id, title, messages, model, systemPrompt, etc.
  ↓
Extract files from messages
  ↓
Save files to IndexedDB (fileStorage)
  ↓
Strip file data from messages (keep only fileId)
  ↓
Save chat to localStorage
  ↓
Update savedChats state (local update, no reload)
```

**Load**:
```
User clicks saved chat → handleLoadChat()
  ↓
Auto-save current chat (if unsaved)
  ↓
Load chat from localStorage
  ↓
Restore file data from IndexedDB
  ↓
Create Object URLs for previews (cached)
  ↓
Set messages, model, systemPrompt, etc.
  ↓
Update token count
```

### 4. File Upload Flow

```
User drops file / clicks attach
  ↓
Read file as ArrayBuffer
  ↓
Convert to base64
  ↓
Create AttachedFile object:
  - id (nanoid)
  - name, mimeType, size
  - data (base64)
  ↓
Save to IndexedDB (if > 100KB)
  ↓
Create Object URL for preview
  ↓
Add to message.files
  ↓
Send to Gemini API as inlineData part
```


---

## API Routes

### 1. /api/chat — Основной чат endpoint

**Метод**: POST  
**Content-Type**: application/json  
**Response**: Server-Sent Events (SSE)

#### Request Body

```typescript
{
  messages: Message[];           // История сообщений
  model: string;                 // ID модели (например "gemini-2.0-flash")
  systemInstruction?: string;    // Системный промпт
  tools?: ChatTool[];            // Инструменты (function declarations)
  memoryTools?: ChatTool[];      // Memory tools
  temperature?: number;          // 0-2
  thinkingBudget?: number;       // -1=auto, 0=off, N=tokens
  maxOutputTokens?: number;      // Лимит выходных токенов
  apiKey: string;                // API ключ
  includeThoughts?: boolean;     // Включить thinking
}
```

#### Response (SSE)

Стрим событий в формате:

```
data: {"text": "Hello"}
data: {"text": " world"}
data: {"thinking": "Let me think..."}
data: {"toolCall": {"name": "save_memory", "args": {...}}}
data: {"finishReason": "STOP"}
data: [DONE]
```

#### Обработка ошибок

```typescript
// Rate limit
{ error: "Rate limit exceeded", errorType: "rate_limit", retryAfterMs: 60000 }

// Invalid key
{ error: "Invalid API key", errorType: "invalid_key" }

// Quota exceeded
{ error: "Quota exceeded", errorType: "quota" }

// Safety block
{ error: "Content blocked", errorType: "safety", blockReason: "HARM_CATEGORY_HATE_SPEECH" }
```

### 2. /api/deepthink — DeepThink анализ

**Метод**: POST  
**Response**: SSE

#### Request Body

```typescript
{
  messages: Message[];
  systemInstruction: string;
  apiKey: string;
  model: string;
  deepThinkSystemPrompt: string;
}
```

#### Response

```
data: {"thinking": "Analyzing user intent..."}
data: {"enhancedPrompt": "You are a helpful assistant..."}
data: [DONE]
```

### 3. /api/models — Получение списка моделей

**Метод**: POST  
**Response**: JSON

#### Request Body

```typescript
{
  apiKey: string;
}
```

#### Response

```typescript
{
  models: GeminiModel[];
}

interface GeminiModel {
  name: string;                  // "models/gemini-2.0-flash"
  displayName: string;           // "Gemini 2.0 Flash"
  description: string;
  supportedGenerationMethods: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  version?: string;
}
```

### 4. /api/tokens — Подсчёт токенов

**Метод**: POST  
**Response**: JSON

#### Request Body

```typescript
{
  messages: Message[];
  model: string;
  systemInstruction: string;
  apiKey: string;
}
```

#### Response

```typescript
{
  totalTokens: number;
}
```

### 5. /api/translate — Перевод текста

**Метод**: POST  
**Response**: JSON

#### Request Body

```typescript
{
  text: string;
  from: string;  // Язык источника (например "en")
  to: string;    // Целевой язык (например "ru")
}
```

#### Response

```typescript
{
  translatedText: string;
}
```

### 6. /api/hf-proxy — Проксирование HuggingFace Spaces

**Метод**: POST  
**Response**: JSON

#### Request Body

```typescript
{
  spaceUrl: string;              // URL Space
  apiName: string;               // Имя API endpoint
  args: any[];                   // Аргументы
}
```

#### Response

```typescript
{
  data: any;                     // Результат от Gradio API
}
```


---

## Хранение данных

### localStorage

**Ключи**:

```typescript
// API Keys
'gemini_api_keys'                    // ApiKeyEntry[]
'gemini_active_key_index'            // number

// Chats
'gemini_chats'                       // SavedChat[] (без файлов)
'gemini_active_chat_id'              // string | null

// Settings
'gemini_system_prompts'              // SavedSystemPrompt[]
'gemini_deepthink_system_prompt'     // string

// Memory
'memory_global'                      // Memory[] (глобальная память)
'memory_local_{chatId}'              // Memory[] (локальная память чата)

// Skills
'skills_registry'                    // Skill[] (сохранённые скиллы)
'skills_hf_spaces'                   // HFSpace[] (подключённые Spaces)
```

**Лимиты**:
- ~5-10 MB на домен (зависит от браузера)
- При переполнении — автоматическое удаление старых данных (memory)

### IndexedDB

**База**: `gemini-studio`  
**Stores**:

```typescript
// Файлы из сообщений
'files' {
  fileId: string;                    // Primary key
  data: string;                      // base64
  mimeType: string;
  name: string;
  size: number;
}

// Большие артефакты скиллов
'artifacts' {
  artifactId: string;                // Primary key
  data: Blob | string;
  mimeType: string;
  type: string;
}
```

**Лимиты**:
- ~50 MB - 1 GB (зависит от браузера)
- Используется для файлов > 100 KB

### Стратегия хранения

**Малые данные** (< 100 KB) → localStorage
- Настройки
- Метаданные чатов
- Память
- Небольшие файлы

**Большие данные** (> 100 KB) → IndexedDB
- Изображения
- Аудио
- Видео
- Документы
- Артефакты скиллов

**Очистка**:
- Object URLs очищаются при удалении чата
- Старые воспоминания удаляются при переполнении
- Файлы удаляются вместе с чатом


---

## Типы данных

### Основные типы

#### Message

```typescript
interface Message {
  id: string;                        // Уникальный ID
  role: 'user' | 'model';            // Роль отправителя
  kind?: 'tool_response';            // Тип сообщения
  parts: Part[];                     // Части сообщения
  files?: AttachedFile[];            // Прикреплённые файлы
  
  // Tool calling
  toolCalls?: ToolCall[];            // Вызовы функций
  toolResponses?: ToolResponse[];    // Ответы функций
  
  // Memory
  memoryOperations?: MemoryOperation[]; // Операции с памятью
  
  // Skills
  skillArtifacts?: SkillArtifact[];  // Артефакты скиллов
  skillToolCalls?: SkillToolCall[];  // Вызовы skill tools
  
  // Thinking
  thinking?: string;                 // Обычное thinking
  deepThinking?: string;             // DeepThink thinking
  deepThinkAnalysis?: DeepThinkAnalysis; // Анализ DeepThink
  
  // Metadata
  apiKeySuffix?: string;             // Последние 4 символа ключа
  modelName?: string;                // Название модели
  isStreaming?: boolean;             // Идёт генерация
  
  // Errors
  error?: string;                    // Текст ошибки
  errorType?: 'rate_limit' | 'quota' | 'invalid_key' | ...;
  errorCode?: number;                // HTTP код
  errorRetryAfterMs?: number;        // Когда можно повторить
  
  // Safety
  isBlocked?: boolean;               // Заблокировано
  blockReason?: string;              // Причина блокировки
  finishReason?: string;             // Причина завершения
  
  // UI
  forceEdit?: boolean;               // Открыть редактор
}
```

#### Part

```typescript
type Part = TextPart | ThoughtPart | InlineDataPart;

interface TextPart {
  text: string;
}

interface ThoughtPart {
  text: string;
  thought: true;
  thoughtSignature?: string;
}

interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;                    // base64
  };
}
```

#### ToolCall

```typescript
interface ToolCall {
  id: string;                        // Уникальный ID
  name: string;                      // Имя функции
  args: unknown;                     // Аргументы (JSON)
  thoughtSignature?: string;         // Подпись thinking
  thought?: boolean;                 // Это thinking tool call
  status?: 'pending' | 'submitted';  // Статус
  result?: unknown;                  // Результат выполнения
  hidden?: boolean;                  // Скрыть в UI
  isMemoryTool?: boolean;            // Memory tool
}
```

#### ToolResponse

```typescript
interface ToolResponse {
  id: string;                        // Уникальный ID
  toolCallId?: string;               // ID вызова
  name: string;                      // Имя функции
  response: unknown;                 // Ответ (JSON)
  hidden?: boolean;                  // Скрыть в UI
  isMemoryTool?: boolean;            // Memory tool response
}
```

### Memory типы

#### Memory

```typescript
interface Memory {
  id: string;                        // nanoid(8)
  fact: string;                      // Текст факта
  scope: 'local' | 'global';         // Область видимости
  category?: string;                 // Категория
  confidence: number;                // 0-1
  keywords: string[];                // Ключевые слова
  related_to?: string[];             // Связанные memory ID
  mentions: number;                  // Счётчик использований
  created_at: number;                // Timestamp
  updated_at: number;                // Timestamp
}
```

#### MemoryOperation

```typescript
interface MemoryOperation {
  type: 'save' | 'update' | 'forget';
  scope: 'local' | 'global';
  fact?: string;                     // Новый факт
  oldFact?: string;                  // Старый факт (для update)
  category?: string;
  confidence?: number;
  reason?: string;                   // Причина операции
  memoryId?: string;                 // ID памяти
}
```

### Skills типы

#### Skill

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  enabled: boolean;
  tools: SkillTool[];
  
  // Lifecycle
  onLoad?: () => Promise<void>;
  onUnload?: () => Promise<void>;
  onMessageComplete?: (message: Message, chatId: string, allMessages: Message[]) => Promise<void>;
}
```

#### SkillArtifact

```typescript
interface SkillArtifact {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'code' | 'table' | 'chart' | 'text' | 'custom';
  label?: string;
  data: 
    | { kind: 'base64'; mimeType: string; base64: string }
    | { kind: 'url'; url: string; mimeType?: string }
    | { kind: 'text'; content: string; language?: string }
    | { kind: 'json'; value: unknown }
    | { kind: 'blob'; blob: Blob; mimeType: string }
    | { kind: 'stored'; stored: 'idb' };
  sendToGemini?: boolean;            // Отправить в следующий запрос
  downloadable?: boolean;            // Можно скачать
  filename?: string;
  skillId?: string;
}
```

### Chat типы

#### SavedChat

```typescript
interface SavedChat {
  id: string;                        // Уникальный ID
  title: string;                     // Название чата
  messages: Message[];               // Сообщения
  model: string;                     // ID модели
  systemPrompt: string;              // Системный промпт
  deepThinkSystemPrompt?: string;    // DeepThink промпт
  tools?: ChatTool[];                // Инструменты
  temperature: number;               // Температура
  createdAt: number;                 // Timestamp создания
  updatedAt: number;                 // Timestamp обновления
}
```

#### GeminiModel

```typescript
interface GeminiModel {
  name: string;                      // "models/gemini-2.0-flash"
  displayName: string;               // "Gemini 2.0 Flash"
  description: string;
  supportedGenerationMethods: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  version?: string;
}
```


---

## Особенности реализации

### 1. God Component Pattern

`app/page.tsx` — монолитный компонент (~1850 строк):

**Плюсы**:
- Простота понимания потока данных
- Нет prop drilling
- Быстрая разработка

**Минусы**:
- Сложность поддержки
- Долгая перекомпиляция
- Трудно тестировать

**Рекомендация**: Разбить на хуки:
- `useStreamGeneration` — логика стриминга
- `useChatManager` — управление чатами
- `useToolExecution` — выполнение tools

### 2. Hybrid Storage (localStorage + IndexedDB)

**Стратегия**:
- Метаданные → localStorage (быстрый доступ)
- Файлы → IndexedDB (большой объём)

**Преимущества**:
- Быстрая загрузка UI
- Поддержка больших файлов
- Синхронный доступ к настройкам

**Недостатки**:
- Сложность синхронизации
- Два источника истины
- Ручная очистка

### 3. Object URL Caching

**Проблема**: При каждой загрузке чата создавались новые Object URLs → утечка памяти

**Решение**:
```typescript
const previewUrlCache = new Map<string, string>();

function restoreFilePreviewUrl(file: AttachedFile) {
  const cacheKey = file.id;
  if (previewUrlCache.has(cacheKey)) {
    return previewUrlCache.get(cacheKey);
  }
  const url = URL.createObjectURL(blob);
  previewUrlCache.set(cacheKey, url);
  return url;
}

// При удалении чата
function revokePreviewUrls(fileIds: string[]) {
  fileIds.forEach(id => {
    const url = previewUrlCache.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlCache.delete(id);
    }
  });
}
```

### 4. Tool Execution Loop

**Проблема**: Модель может вызывать tools несколько раз подряд

**Решение**: Loop с лимитом раундов
```typescript
const MAX_TOOL_ROUNDS = 10;
let roundCount = 0;

while (roundCount < MAX_TOOL_ROUNDS) {
  // Stream response
  // Execute tools
  // Send tool responses back
  // Continue streaming
  
  if (no more tool calls) break;
  roundCount++;
}
```

### 5. Memory Tools (Fire-and-Forget)

**Проблема**: Memory tools не должны блокировать генерацию

**Решение**: Выполняем сразу, не ждём ответа модели
```typescript
if (isMemoryTool(toolCall)) {
  // Execute immediately
  executeMemoryTool(toolCall);
  
  // Don't send response back to model
  // Don't wait for next round
  
  // Continue streaming
}
```

### 6. Per-Model Key Blocking

**Проблема**: Rate limit на одной модели блокировал ключ для всех моделей

**Решение**: Блокировка per-model
```typescript
interface ApiKeyEntry {
  key: string;
  blockedByModel?: Record<string, number>; // model -> timestamp
}

function isKeyAvailableForModel(key: ApiKeyEntry, model: string) {
  const blockedUntil = key.blockedByModel?.[model];
  if (!blockedUntil) return true;
  return Date.now() > blockedUntil;
}
```

### 7. Token Counter с Memory + Skills

**Проблема**: Счётчик не учитывал memory и skills промпты

**Решение**: Строим полный effectiveSystemPrompt
```typescript
function countTokens(messages, systemPrompt) {
  // Build memory prompt
  const memoryPrompt = buildMemoryPrompt(messages);
  
  // Build skills prompt
  const skillsPrompt = buildSkillsSystemPrompt(messages);
  
  // Combine
  const effectiveSystemPrompt = 
    (memoryPrompt ? memoryPrompt + '\n\n' : '') +
    systemPrompt +
    (skillsPrompt || '');
  
  // Count with full prompt
  return countTokensAPI(messages, effectiveSystemPrompt);
}
```

### 8. Optimistic UI Updates

**Принцип**: Обновляем UI сразу, не ждём сервера

**Примеры**:
- Добавление сообщения → сразу в state
- Удаление чата → сразу из списка
- Сохранение чата → локальное обновление state

**Преимущества**:
- Мгновенная реакция
- Лучший UX
- Меньше перерисовок

**Недостатки**:
- Нужна обработка ошибок
- Возможна рассинхронизация


---

## Производительность и оптимизации

### 1. Debounced Token Counting

**Проблема**: Подсчёт токенов при каждом изменении сообщений

**Решение**: Debounce 400ms
```typescript
useEffect(() => {
  if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current);
  tokenDebounceRef.current = setTimeout(() => {
    countTokens(messages, systemPrompt, model, apiKey);
  }, 400);
}, [messages, systemPrompt]);
```

### 2. Parallel Chat Saves

**Проблема**: Последовательное сохранение N чатов

**Решение**: Promise.all
```typescript
// Было
for (const chat of chats) {
  await saveChatToStorage(chat);
}

// Стало
await Promise.all(chats.map(c => saveChatToStorage(c)));
```

### 3. Local State Updates

**Проблема**: Перезагрузка всех чатов после каждого сохранения

**Решение**: Локальное обновление state
```typescript
// Было
await saveChatToStorage(chat);
const updated = await loadSavedChats();
setSavedChats(updated);

// Стало
await saveChatToStorage(chat);
setSavedChats(prev => {
  const idx = prev.findIndex(c => c.id === chat.id);
  if (idx >= 0) {
    const updated = [...prev];
    updated[idx] = chat;
    return updated;
  }
  return [...prev, chat];
});
```

### 4. Lazy Loading Components

**Используется**:
- React.lazy для модальных окон
- Dynamic imports для больших библиотек (D3.js)

**Пример**:
```typescript
const MemoryGraph = lazy(() => import('./MemoryGraph'));

// В компоненте
<Suspense fallback={<Spinner />}>
  <MemoryGraph memories={memories} />
</Suspense>
```

### 5. Memoization

**useMemo** для тяжёлых вычислений:
```typescript
const visibleMessages = useMemo(
  () => messages.filter(m => m.kind !== 'tool_response'),
  [messages]
);
```

**useCallback** для стабильных функций:
```typescript
const handleSend = useCallback((text: string) => {
  // ...
}, [messages, model, apiKey]);
```

### 6. Virtual Scrolling (TODO)

**Проблема**: Рендеринг 1000+ сообщений тормозит

**Решение**: React Virtual или react-window
- Рендерить только видимые сообщения
- Динамическая высота элементов
- Smooth scrolling


---

## Безопасность

### 1. API Key Storage

**Хранение**: localStorage (client-side only)
- Ключи НЕ отправляются на сервер (кроме Gemini API)
- Нет бэкенда для хранения ключей
- Privacy-first подход

**Риски**:
- XSS атаки могут украсть ключи
- Доступ через DevTools

**Митигация**:
- Content Security Policy (CSP)
- Sanitization пользовательского ввода
- HTTPS only

### 2. Content Sanitization

**Markdown рендеринг**:
- react-markdown с безопасными настройками
- Запрет на HTML теги
- Whitelist компонентов

**File uploads**:
- Проверка MIME типов
- Лимит размера файла
- Конвертация в base64 (изоляция)

### 3. Rate Limiting

**Client-side**:
- Debounce запросов
- Блокировка ключей при rate limit
- Retry с exponential backoff

**Server-side** (Gemini API):
- Автоматический rate limiting
- Quota management

### 4. Error Handling

**Типы ошибок**:
- Network errors → retry
- Rate limit → block key, try next
- Invalid key → mark as invalid
- Safety block → show reason
- Quota exceeded → show error

**Логирование**:
- console.error для отладки
- Не логируем API ключи
- Не логируем личные данные


---

## Известные проблемы и ограничения

### 1. God Component

**Проблема**: `app/page.tsx` слишком большой (~1850 строк)

**Влияние**:
- Медленная разработка
- Сложность тестирования
- Долгая компиляция

**Решение**: Разбить на хуки и подкомпоненты

### 2. Stale Closure в streamGeneration

**Проблема**: `messages` не в dependencies, но используется внутри

**Влияние**: Skills получают устаревшие сообщения

**Решение**: Добавить в deps или использовать ref

### 3. localStorage Quota

**Проблема**: Лимит ~5-10 MB

**Влияние**: При переполнении — ошибки сохранения

**Решение**: 
- Автоматическое удаление старых данных (реализовано для memory)
- Миграция на IndexedDB для всех данных (TODO)

### 4. No Server-Side Persistence

**Проблема**: Все данные только в браузере

**Влияние**:
- Нет синхронизации между устройствами
- Потеря данных при очистке браузера
- Нет бэкапов

**Решение**: Опциональный бэкенд (TODO)

### 5. No Real-Time Collaboration

**Проблема**: Нет возможности совместной работы

**Влияние**: Один пользователь = один чат

**Решение**: WebSocket + shared state (TODO)

### 6. Limited File Size

**Проблема**: Gemini API лимит на размер запроса (~4.5 MB на Vercel)

**Влияние**: Большие файлы не отправляются

**Решение**: 
- Сжатие изображений
- Chunking для больших файлов
- File API от Gemini (TODO)

### 7. No Offline Support

**Проблема**: Требуется интернет для работы

**Влияние**: Нет доступа без сети

**Решение**: Service Worker + offline mode (TODO)

### 8. No Tests

**Проблема**: Нет unit/integration тестов

**Влияние**: Риск регрессий

**Решение**: Jest + React Testing Library (TODO)


---

## Roadmap и будущие улучшения

### Краткосрочные (1-2 месяца)

1. **Рефакторинг app/page.tsx**
   - Разбить на хуки (useStreamGeneration, useChatManager)
   - Вынести логику в отдельные файлы
   - Улучшить читаемость

2. **Toast уведомления**
   - Ошибки сохранения
   - Успешные операции
   - Rate limit warnings

3. **Memory дедупликация**
   - Проверка схожести фактов
   - Автоматическое слияние дубликатов
   - Улучшенный поиск

4. **Улучшенный Token Counter**
   - Breakdown по частям (system, messages, tools)
   - Прогноз стоимости
   - История использования

5. **Keyboard Shortcuts**
   - Ctrl+Enter → отправить
   - Ctrl+K → новый чат
   - Ctrl+/ → поиск по чатам

### Среднесрочные (3-6 месяцев)

1. **Опциональный Backend**
   - Синхронизация между устройствами
   - Облачное хранение чатов
   - Бэкапы

2. **Advanced Skills**
   - Web search skill
   - Code execution skill
   - Image generation skill
   - Database query skill

3. **Улучшенный UI**
   - Темы (light/dark/custom)
   - Кастомизация интерфейса
   - Responsive design для мобильных

4. **Export/Import**
   - Экспорт в Markdown
   - Экспорт в PDF
   - Импорт из ChatGPT
   - Импорт из Claude

5. **Search & Filter**
   - Полнотекстовый поиск по чатам
   - Фильтры по дате, модели, тегам
   - Избранные чаты

### Долгосрочные (6+ месяцев)

1. **Multi-User Support**
   - Аутентификация
   - Роли и права
   - Shared chats

2. **Advanced Memory**
   - Векторный поиск (embeddings)
   - Автоматическая категоризация
   - Временные связи (timeline)

3. **Plugins System**
   - Marketplace для плагинов
   - API для разработчиков
   - Sandboxed execution

4. **Voice Interface**
   - Speech-to-text
   - Text-to-speech
   - Voice commands

5. **Analytics**
   - Статистика использования
   - Стоимость токенов
   - Популярные модели


---

## Разработка и деплой

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Открыть http://localhost:3000
```

### Сборка для production

```bash
# Сборка
npm run build

# Запуск production сервера
npm start
```

### Деплой на Vercel

1. Подключить GitHub репозиторий
2. Vercel автоматически деплоит при push
3. Настроить environment variables (если нужны)

**Конфигурация** (vercel.json):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

### Environment Variables

**Не требуются** — все настройки в localStorage

Опционально (для будущих фич):
- `NEXT_PUBLIC_API_URL` — URL бэкенда
- `NEXT_PUBLIC_ANALYTICS_ID` — Google Analytics

### Структура деплоя

```
Vercel Edge Network
  ↓
Next.js Server (API Routes)
  ↓
Google Gemini API
```

**Регионы**: Автоматически (Vercel Edge)  
**CDN**: Встроенный (Vercel)  
**SSL**: Автоматический (Let's Encrypt)


---

## FAQ для разработчиков

### Как добавить новый built-in skill?

1. Создать файл в `lib/skills/built-in/my-skill.ts`
2. Реализовать интерфейс `Skill`
3. Экспортировать из `lib/skills/built-in/index.ts`
4. Skill автоматически появится в реестре

**Пример**:
```typescript
// lib/skills/built-in/my-skill.ts
import { Skill, SkillTool } from '../types';

const myTool: SkillTool = {
  name: 'my_function',
  description: 'Does something useful',
  parameters: [
    { id: '1', name: 'input', type: 'string', required: true }
  ],
  execute: async (args, context) => {
    const result = doSomething(args.input);
    return {
      success: true,
      data: result,
      artifacts: [
        {
          id: nanoid(),
          type: 'text',
          data: { kind: 'text', content: result }
        }
      ]
    };
  }
};

export const mySkill: Skill = {
  id: 'my-skill',
  name: 'My Skill',
  description: 'A useful skill',
  version: '1.0.0',
  enabled: true,
  tools: [myTool]
};
```

### Как изменить системный промпт по умолчанию?

Отредактировать `app/page.tsx`:
```typescript
const [systemPrompt, setSystemPrompt] = useState('Your new default prompt');
```

### Как добавить новый тип артефакта?

1. Добавить тип в `types/index.ts`:
```typescript
export type ArtifactType = 'image' | 'video' | ... | 'my-type';
```

2. Добавить рендеринг в `components/SkillArtifactRenderer.tsx`:
```typescript
case 'my-type':
  return <MyCustomRenderer artifact={artifact} />;
```

### Как изменить лимиты?

**Max tool rounds**:
```typescript
// app/page.tsx
const MAX_TOOL_ROUNDS = 10; // Изменить здесь
```

**Max output tokens**:
```typescript
// app/page.tsx
const [maxOutputTokens, setMaxOutputTokens] = useState(8192); // Изменить здесь
```

**Thinking budget**:
```typescript
// app/page.tsx
const [thinkingBudget, setThinkingBudget] = useState(-1); // -1=auto, 0=off, N=tokens
```

### Как добавить новую модель вручную?

Модели загружаются автоматически из API. Если нужно добавить вручную:

```typescript
// components/Sidebar.tsx
const customModels: GeminiModel[] = [
  {
    name: 'models/my-custom-model',
    displayName: 'My Custom Model',
    description: 'Custom model',
    supportedGenerationMethods: ['generateContent'],
    inputTokenLimit: 100000,
    outputTokenLimit: 8192
  }
];
```

### Как отладить стриминг?

1. Открыть DevTools → Network
2. Найти запрос к `/api/chat`
3. Смотреть EventStream
4. Или добавить логи в `app/page.tsx`:

```typescript
const reader = response.body!.getReader();
while (true) {
  const { done, value } = await reader.read();
  console.log('Chunk:', decoder.decode(value));
  // ...
}
```

### Как очистить все данные?

**Через UI**: Settings → Clear All Data (TODO)

**Через DevTools**:
```javascript
// Console
localStorage.clear();
indexedDB.deleteDatabase('gemini-studio');
location.reload();
```

### Как экспортировать все чаты?

**Через UI**: Sidebar → Export All Chats

**Программно**:
```typescript
import { loadSavedChats, exportChats } from '@/lib/storage';

const chats = await loadSavedChats();
exportChats(chats); // Скачает JSON файл
```

---

## Заключение

Gemini Playground — это мощная и расширяемая платформа для работы с Gemini API. Архитектура построена на принципах модульности, типобезопасности и privacy-first подхода.

**Ключевые особенности**:
- Полностью client-side (privacy)
- Расширяемая система скиллов
- Умная система памяти
- DeepThink для улучшения ответов
- Round-robin ротация API ключей

**Для контрибьюторов**:
- Код хорошо типизирован (TypeScript)
- Документация в коде
- Понятная структура файлов
- Открыт для расширений

**Контакты**:
- GitHub: [ссылка на репозиторий]
- Issues: [ссылка на issues]
- Discussions: [ссылка на discussions]

---

*Документация обновлена: 2024*
