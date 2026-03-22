# Как написать свой Skill
## Документация для разработчиков

---

## Что такое Skill

Skill — это объект TypeScript который описывает плагин для Gemini Playground. Скилл может:

- объявить инструменты (tools) которые Gemini будет вызывать
- автоматически выполнить логику когда Gemini вызвал инструмент
- инжектировать текст в системный промпт перед каждым запросом
- показывать уведомления, бейджи, обновлять панели в UI
- возвращать файлы, картинки, таблицы, код которые отображаются в чате
- читать файлы которые пользователь прикрепил к сообщению
- хранить данные между сессиями в изолированном localStorage

---

## Минимальный скилл

```ts
import type { Skill } from '@/lib/skills/types';

export const mySkill: Skill = {
  id: 'my_skill',           // уникальный ID, snake_case
  name: 'My Skill',         // название для маркета
  description: 'Описание',  // одна строка
  version: '1.0.0',
  icon: '🔧',               // emoji иконка
  category: 'utils',        // 'search' | 'data' | 'utils' | 'dev' | 'productivity' | 'fun'

  tools: [
    {
      name: 'my_tool',
      description: 'Описание инструмента — Gemini читает это и решает когда вызвать',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Входные данные' }
        },
        required: ['input']
      }
    }
  ],

  async onToolCall(toolName, args, ctx) {
    // Твоя логика здесь
    const result = doSomething(args.input as string);

    return {
      mode: 'respond',
      response: { result }   // Gemini видит этот объект и строит ответ
    };
  }
};
```

Зарегистрируй скилл в `lib/skills/built-in/index.ts`:
```ts
import { mySkill } from './my-skill';

export const BUILT_IN_SKILLS: Skill[] = [
  // ...существующие скиллы...
  mySkill,
];
```

Всё. Скилл появится в маркете и начнёт работать.

---

## Интерфейс Skill — полный

```ts
interface Skill {
  // ── Обязательные ─────────────────────────────────────────────────
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  category: SkillCategory;
  tools: GeminiToolDeclaration[];

  async onToolCall(
    toolName: string,
    args: Record<string, unknown>,
    ctx: SkillContext
  ): Promise<SkillToolResult>;

  // ── Опциональные ─────────────────────────────────────────────────
  longDescription?: string;     // подробное описание в маркете
  author?: string;
  tags?: string[];              // для поиска в маркете

  configSchema?: SkillConfigField[];   // поля настроек (API ключи и т.п.)

  onSystemPrompt?(ctx: SkillContext): string | null;
  // Вызывается перед КАЖДЫМ запросом к Gemini.
  // Возврати строку — она добавится к system prompt.
  // Возврати null — ничего не добавляется.

  onMessageComplete?(message: Message, ctx: SkillContext): void | Promise<void>;
  // Вызывается после того как Gemini закончил генерировать ответ.
  // Используй для анализа ответа и side effects.

  onInstall?(ctx: SkillContext): void;
  // Вызывается один раз при установке скилла.

  onUninstall?(ctx: SkillContext): void;
  // Вызывается при удалении скилла.

  getPanelData?(ctx: SkillContext): SkillPanelData | null;
  // Данные для боковой панели. Обновляется при каждом render.
}
```

---

## SkillToolResult — что вернуть из onToolCall

```ts
interface SkillToolResult {
  mode: 'respond' | 'fire_and_forget';
  response?: unknown;           // данные для Gemini (если mode = respond)
  artifacts?: SkillArtifact[];  // файлы/медиа для отображения в чате
}
```

### mode: 'respond'

Gemini получает `response` как результат вызова инструмента и продолжает генерацию на основе этих данных.

```ts
return {
  mode: 'respond',
  response: {
    temperature: 23.5,
    city: 'Moscow',
    description: 'Облачно'
  }
  // Gemini скажет: "В Москве сейчас 23.5°C, облачно"
};
```

### mode: 'fire_and_forget'

Gemini **не получает** результат — он уже начал генерировать текст параллельно с вызовом инструмента (как memory tools). Используй когда хочешь сделать side effect и не прерывать поток.

```ts
return {
  mode: 'fire_and_forget'
  // Gemini уже пишет свой текст, твой инструмент выполнился тихо
};
```

---

## SkillArtifact — возврат файлов и медиа

Артефакты — это файлы/данные которые скилл возвращает **для отображения в чате**. Они рендерятся прямо под ответом модели.

```ts
interface SkillArtifact {
  type: 'image' | 'video' | 'audio' | 'document' | 'code' | 'table' | 'chart' | 'text' | 'custom';
  label?: string;         // заголовок над артефактом
  downloadable?: boolean; // кнопка скачать (default: true)
  filename?: string;      // имя файла при скачивании
  sendToGemini?: boolean; // отправить файл в Gemini как inlineData (default: false)
  
  data:
    | { kind: 'base64'; mimeType: string; base64: string }
    | { kind: 'url'; url: string; mimeType?: string }
    | { kind: 'text'; content: string; language?: string }
    | { kind: 'json'; value: unknown }
}
```

### Пример: вернуть картинку

```ts
return {
  mode: 'fire_and_forget',
  artifacts: [{
    type: 'image',
    label: 'Сгенерированный QR-код',
    data: {
      kind: 'base64',
      mimeType: 'image/png',
      base64: '...'  // base64 без data:image/png;base64, префикса
    },
    downloadable: true,
    filename: 'qr.png',
    sendToGemini: false
  }]
};
```

### Пример: вернуть код с подсветкой

```ts
return {
  mode: 'respond',
  response: { success: true },
  artifacts: [{
    type: 'code',
    label: 'Результат',
    data: {
      kind: 'text',
      content: 'SELECT * FROM users WHERE age > 18;',
      language: 'sql'
    },
    downloadable: true,
    filename: 'query.sql'
  }]
};
```

### Пример: вернуть таблицу

```ts
artifacts: [{
  type: 'table',
  label: 'Курсы валют',
  data: {
    kind: 'json',
    value: {
      headers: ['Валюта', 'Курс', 'Изменение'],
      rows: [
        ['USD', '92.5', '+0.3'],
        ['EUR', '100.1', '-0.1'],
      ]
    }
  }
}]
```

### Пример: отправить картинку в Gemini

Если хочешь чтобы Gemini увидел изображение которое создал скилл:

```ts
artifacts: [{
  type: 'image',
  data: { kind: 'base64', mimeType: 'image/png', base64: '...' },
  sendToGemini: true   // ← Gemini получит это как inlineData
}]
// Теперь можешь спросить Gemini: "Что ты видишь на этой картинке?"
```

---

## SkillContext — что доступно в onToolCall

```ts
interface SkillContext {
  chatId: string;           // ID текущего чата
  messages: Readonly<Message[]>;  // история сообщений
  config: Record<string, string>; // настройки скилла (API ключи и т.п.)
  storage: SkillStorage;    // изолированное хранилище
  emit: (event: SkillUIEvent) => void;  // UI события
  
  // Файлы из последнего сообщения пользователя
  attachedFiles: ReadonlyArray<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    getData(): Promise<string>;   // возвращает base64
    getBlob(): Promise<Blob>;     // возвращает Blob
  }>;
}
```

### ctx.storage — хранилище скилла

Каждый скилл получает изолированное хранилище в localStorage. Ключи разных скиллов не пересекаются.

```ts
// Сохранить
ctx.storage.set('last_query', 'some value');
ctx.storage.setJSON('user_prefs', { theme: 'dark', count: 42 });

// Прочитать
const val = ctx.storage.get('last_query');           // string | null
const prefs = ctx.storage.getJSON<UserPrefs>('user_prefs');  // T | null

// Удалить
ctx.storage.remove('last_query');
```

### ctx.emit — UI события

```ts
// Тост (уведомление снизу справа)
ctx.emit({ type: 'toast', message: 'Готово!', variant: 'success' });
// variant: 'default' | 'success' | 'error' | 'warning'

// Бейдж рядом с кнопкой скиллов
ctx.emit({ type: 'badge', skillId: ctx.skillId, text: '42 записи', color: '#6366f1' });

// Убрать бейдж
ctx.emit({ type: 'badge_clear', skillId: ctx.skillId });

// Обновить данные панели в сайдбаре
ctx.emit({ type: 'panel_update', skillId: ctx.skillId, data: { items: [...] } });
```

### ctx.attachedFiles — читать файлы пользователя

```ts
async onToolCall(toolName, args, ctx) {
  // Найти первое изображение
  const image = ctx.attachedFiles.find(f => f.mimeType.startsWith('image/'));
  
  if (!image) {
    return { mode: 'respond', response: { error: 'Прикрепи изображение' } };
  }

  // Получить данные
  const base64 = await image.getData();
  const blob = await image.getBlob();
  
  // ... обработать ...
}
```

### ctx.messages — история чата

```ts
// Найти последний вопрос пользователя
const lastUser = [...ctx.messages].reverse().find(m => m.role === 'user');
const text = lastUser?.parts.find(p => 'text' in p)?.text ?? '';

// Посчитать количество сообщений
const count = ctx.messages.length;
```

---

## onSystemPrompt — инжекция в system prompt

Вызывается перед каждым запросом к Gemini. Возвращённая строка добавляется к системному промпту.

```ts
onSystemPrompt(ctx) {
  const notes = ctx.storage.getJSON<Note[]>('notes') ?? [];
  if (notes.length === 0) return null;

  return `У пользователя ${notes.length} заметок:\n${notes.map(n => `- ${n.title}`).join('\n')}`;
}
```

> ⚠️ Не делай ничего тяжёлого здесь. Это вызывается при каждом запросе. Только читай данные из storage или ctx.messages.

---

## configSchema — настройки скилла

Если скиллу нужен API ключ или другие настройки от пользователя:

```ts
configSchema: [
  {
    key: 'api_key',
    label: 'OpenWeather API Key',
    type: 'password',
    required: true,
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    description: 'Получи бесплатно на openweathermap.org'
  },
  {
    key: 'units',
    label: 'Единицы измерения',
    type: 'select',
    options: ['metric', 'imperial'],
    required: false,
  }
]
```

Пользователь вводит значения в маркете через шестерёнку ⚙️. В `onToolCall` читаешь через:
```ts
const apiKey = ctx.config.api_key;   // string
const units = ctx.config.units ?? 'metric';
```

---

## onInstall / onUninstall — lifecycle хуки

```ts
onInstall(ctx) {
  // Инициализируем дефолтные данные
  ctx.storage.setJSON('settings', { enabled: true, limit: 100 });
  ctx.emit({ type: 'toast', message: '🎉 Скилл установлен!', variant: 'success' });
},

onUninstall(ctx) {
  // Можно почистить данные — или оставить (пользователь переустановит и сохранит прогресс)
  ctx.emit({ type: 'toast', message: 'Скилл удалён', variant: 'default' });
}
```

---

## onMessageComplete — хук после ответа

Вызывается после того как Gemini закончил генерировать ответ. Используй для:
- анализа того что сказала модель
- автоматического сохранения чего-то
- обновления панели

```ts
async onMessageComplete(message, ctx) {
  // Посчитать сколько раз модель использовала наш скилл в этом сеансе
  const count = parseInt(ctx.storage.get('call_count') ?? '0');
  ctx.storage.set('call_count', String(count + 1));

  // Обновить бейдж
  ctx.emit({ type: 'badge', skillId: 'my_skill', text: `${count + 1} вызовов` });
}
```

---

## getPanelData — данные для сайдбара

Если хочешь показывать данные в боковой панели:

```ts
getPanelData(ctx) {
  const items = ctx.storage.getJSON<string[]>('history') ?? [];
  if (items.length === 0) return null;

  return {
    title: `История (${items.length})`,
    items: items.map(item => ({
      label: item,
      value: '...',
      highlight: false
    }))
  };
}
```

---

## Полный пример: Weather Skill

```ts
import type { Skill } from '@/lib/skills/types';

export const weatherSkill: Skill = {
  id: 'weather',
  name: 'Weather',
  description: 'Текущая погода и прогноз через OpenWeatherMap.',
  version: '1.0.0',
  icon: '🌤️',
  category: 'data',
  author: 'Built-in',
  tags: ['weather', 'forecast', 'temperature'],

  configSchema: [
    {
      key: 'api_key',
      label: 'OpenWeatherMap API Key',
      type: 'password',
      required: true,
      description: 'Бесплатный ключ на openweathermap.org'
    }
  ],

  tools: [
    {
      name: 'get_weather',
      description: 'Возвращает текущую погоду в городе. Вызывай когда пользователь спрашивает о погоде.',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: 'Название города на английском'
          }
        },
        required: ['city']
      }
    }
  ],

  async onToolCall(toolName, args, ctx) {
    const apiKey = ctx.config.api_key;
    if (!apiKey) {
      ctx.emit({ type: 'toast', message: 'Нужен API ключ OpenWeatherMap', variant: 'error' });
      return { mode: 'respond', response: { error: 'API key not configured' } };
    }

    const city = args.city as string;
    ctx.emit({ type: 'toast', message: `🌤️ Загружаю погоду для ${city}...` });

    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ru`
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const weather = {
        city: data.name,
        country: data.sys.country,
        temp: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        description: data.weather[0].description,
        humidity: data.main.humidity,
        wind_speed: Math.round(data.wind.speed * 3.6), // m/s → km/h
        icon: data.weather[0].icon,
      };

      ctx.emit({
        type: 'badge',
        skillId: 'weather',
        text: `${weather.city} ${weather.temp}°C`,
        color: '#f59e0b'
      });

      return {
        mode: 'respond',
        response: weather,
        // Добавляем иконку погоды как артефакт
        artifacts: [{
          type: 'image',
          label: `Погода в ${weather.city}`,
          data: {
            kind: 'url',
            url: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`,
            mimeType: 'image/png'
          },
          downloadable: false,
          sendToGemini: false
        }]
      };

    } catch (err) {
      ctx.emit({ type: 'toast', message: `Ошибка загрузки погоды: ${err}`, variant: 'error' });
      return { mode: 'respond', response: { error: String(err) } };
    }
  },

  onInstall(ctx) {
    ctx.emit({
      type: 'toast',
      message: '🌤️ Weather установлен! Настрой API ключ в ⚙️',
      variant: 'success'
    });
  }
};
```

---

## Checklist для нового скилла

- [ ] Уникальный `id` в snake_case
- [ ] `description` для tools понятны Gemini (он читает их чтобы решить когда вызывать)
- [ ] `onToolCall` всегда возвращает `SkillToolResult` (не throw)
- [ ] Ошибки обрабатываются внутри и возвращаются как `{ mode: 'respond', response: { error: '...' } }`
- [ ] `fire_and_forget` использован только когда модель должна продолжать без ответа
- [ ] API ключи и секреты идут через `configSchema`, не хардкодятся
- [ ] Тяжёлые операции в `onToolCall`, не в `onSystemPrompt`
- [ ] Скилл добавлен в `BUILT_IN_SKILLS` в `lib/skills/built-in/index.ts`

---

## Структура файлов

```
lib/skills/
  types.ts              ← интерфейсы (Skill, SkillToolResult, SkillArtifact...)
  registry.ts           ← установка/удаление/конфиг скиллов
  executor.ts           ← рантайм (вызов onToolCall, сборка context...)
  index.ts              ← публичный API
  built-in/
    index.ts            ← регистрация всех встроенных скиллов
    datetime.ts         ← твой скилл кладёшь сюда
    calculator.ts
    ...
```
