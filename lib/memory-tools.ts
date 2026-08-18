// Определения инструментов памяти в формате Gemini API
// Эти инструменты уже в правильном формате для отправки в API

export const MEMORY_TOOLS = [
  {
    name: 'save_memory',
    description: `Сохрани важный факт о пользователе в долгосрочную память.

Вызывай когда пользователь сообщает что-то значимое: предпочтения, проекты, технологии, убеждения, стиль общения, личный контекст. НЕ вызывай для: разовых просьб, временных состояний, вопросов которые задал пользователь.

⚠️ FIRE-AND-FORGET: Этот инструмент выполняется МГНОВЕННО на клиенте. Ты НЕ получишь functionResponse. Ты ДОЛЖЕН продолжить генерацию текста В ТОМ ЖЕ turn (Gemini API поддерживает functionCall + text в одном candidate).

Пример правильного использования:
Turn 1: [functionCall: save_memory(...)] + [text: "Приятно познакомиться!"]

scope:
- "local" — память только для этого чата (детали текущей задачи, временный контекст)
- "global" — память для всех чатов (предпочтения, стек, личность, убеждения)

Правило выбора scope: если факт будет полезен в любом будущем разговоре — global. Если только в контексте текущего чата — local.

related_to — массив ID существующих воспоминаний, с которыми этот факт связан. Используй чтобы строить граф знаний.`,
    parameters: {
      type: 'object',
      properties: {
        fact: {
          type: 'string',
          description: 'Чёткий, конкретный факт. Одна мысль — одно воспоминание.',
        },
        scope: {
          type: 'string',
          enum: ['local', 'global'],
          description: 'Область видимости: local (только этот чат) или global (все чаты)',
        },
        category: {
          type: 'string',
          enum: ['identity', 'tech', 'style', 'project', 'preference', 'belief', 'episode'],
          description: 'Категория воспоминания',
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: '3–6 слов для поиска по релевантности',
        },
        confidence: {
          type: 'number',
          description: '0.0–1.0. Явно сказал = 1.0, подразумевал = 0.7, предположение = 0.4',
        },
        related_to: {
          type: 'array',
          items: { type: 'string' },
          description: 'ID связанных воспоминаний (опционально)',
        },
      },
      required: ['fact', 'scope', 'category', 'keywords', 'confidence'],
    },
  },
  {
    name: 'update_memory',
    description: `Обнови существующее воспоминание.

Вызывай когда:
- Пользователь противоречит сохранённому факту
- Пользователь уточняет или дополняет ранее сказанное
- Факт устарел

Не создавай новое воспоминание если можно обновить существующее.

⚠️ FIRE-AND-FORGET: Выполняется мгновенно. НЕ жди functionResponse. Продолжай текст в том же turn.`,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID воспоминания которое обновляем',
        },
        fact: {
          type: 'string',
          description: 'Новый текст факта',
        },
        confidence: {
          type: 'number',
          description: 'Новый уровень уверенности 0.0–1.0',
        },
      },
      required: ['id', 'fact', 'confidence'],
    },
  },
  {
    name: 'forget_memory',
    description: `Удали воспоминание.

Вызывай когда факт стал неактуальным, ошибочным, или пользователь явно просит забыть.

⚠️ FIRE-AND-FORGET: Выполняется мгновенно. НЕ жди functionResponse. Продолжай текст в том же turn.`,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID воспоминания которое удаляем',
        },
        reason: {
          type: 'string',
          description: 'Причина удаления',
        },
      },
      required: ['id', 'reason'],
    },
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Инструменты визуальной памяти
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const IMAGE_MEMORY_TOOLS = [
  {
    name: 'save_image_memory',
    description: `ОБЯЗАТЕЛЬНО вызови этот инструмент когда пользователь присылает фото человека, места или объекта с именем/контекстом.

ПРИМЕРЫ когда ОБЯЗАТЕЛЬНО вызывать:
- "Это моя подруга Маша" → ВЫЗОВИ save_image_memory
- "Запомни этот логотип" → ВЫЗОВИ save_image_memory  
- "Это наш офис" → ВЫЗОВИ save_image_memory
- "Мой кот Барсик" → ВЫЗОВИ save_image_memory
- Любое фото с именем человека → ВЫЗОВИ save_image_memory

НЕ вызывай только для:
- Скриншот интерфейса с вопросом
- Фото ошибки для разовой помощи
- Временный черновик

Параметры:
- image_id: ID изображения из чата (реальный ID файла, например "ph_lqk7a3f9")
- description: Детальное описание (внешность, контекст, особенности)
- tags: 3-8 тегов ["person", "female", "friend", "dark_hair"]
- entities: Имена людей, бренды, места ["Маша", "Nike"]
- scope: "global" (запомнить навсегда) или "local" (только этот чат)`,
    parameters: {
      type: 'object',
      properties: {
        image_id: {
          type: 'string',
          description: 'ID изображения из чата (реальный ID файла)'
        },
        description: {
          type: 'string',
          description: 'Детальное описание для будущего поиска. Включи внешность, контекст, особенности.'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '3-8 тегов для поиска: ["person", "female", "friend", "dark_hair", "outdoor"]'
        },
        entities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Именованные сущности: имена людей, бренды, названия мест ["Маша", "Nike", "Офис"]'
        },
        scope: {
          type: 'string',
          enum: ['global', 'local'],
          description: 'global = запомнить навсегда, local = только этот чат'
        },
        save_annotations: {
          type: 'boolean',
          description: 'Сохранить текущие аннотации (если были созданы через annotate_regions)'
        },
        save_crops: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              x1_pct: { type: 'number' },
              y1_pct: { type: 'number' },
              x2_pct: { type: 'number' },
              y2_pct: { type: 'number' },
              label: { type: 'string', description: 'Что в этом кропе: "лицо Маши", "логотип"' },
              separate_memory: { type: 'boolean', description: 'Создать отдельное image memory для кропа' }
            }
          },
          description: 'Сохранить конкретные регионы как отдельные воспоминания'
        }
      },
      required: ['image_id', 'description', 'tags', 'entities', 'scope']
    }
  },
  {
    name: 'search_image_memories',
    description: `Найди сохранённые изображения по описанию/тегам.

Используй когда:
- Нужно найти ранее сохранённое фото для вставки в сайт
- Пользователь спрашивает "помнишь фото X?"
- Нужно вспомнить как выглядит человек/объект
- Поиск референсов из прошлых разговоров

Возвращает список найденных изображений с thumbnails и метаданными.`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Поисковый запрос: "фото Маши", "логотип Nike", "наш офис", "кот"'
        },
        scope: {
          type: 'string',
          enum: ['global', 'local'],
          description: 'Искать только в global или local (опционально)'
        },
        limit: {
          type: 'number',
          description: 'Сколько результатов вернуть (по умолчанию 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'recall_image_memory',
    description: `Достань конкретное изображение из памяти по ID.

Используй когда знаешь точный ID изображения из предыдущего поиска или контекста.
Возвращает полное изображение с метаданными.`,
    parameters: {
      type: 'object',
      properties: {
        image_memory_id: {
          type: 'string',
          description: 'ID image memory'
        }
      },
      required: ['image_memory_id']
    }
  }
];

// Экспортируем инструменты в формате для отправки в Gemini API
// (они уже в правильном формате functionDeclarations)
export function getMemoryToolsForAPI() {
  return MEMORY_TOOLS;
}

export function getImageMemoryToolsForAPI() {
  return IMAGE_MEMORY_TOOLS;
}

export function getAllMemoryToolsForAPI() {
  return [...MEMORY_TOOLS, ...IMAGE_MEMORY_TOOLS];
}
