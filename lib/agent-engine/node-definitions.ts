/**
 * Центральная декларация всех типов нод и их портов
 * Единый источник правды для Agent Editor
 */

export type PortType = 'text' | 'number' | 'boolean' | 'object' | 'array' | 'any';

export interface PortDef {
  id: string;           // уникальный id порта на этой ноде
  label: string;        // отображаемое имя ("Prompt", "Result", "True branch")
  type: PortType;
  required: boolean;    // обязательно ли подключение/заполнение
  multi?: boolean;      // может ли принимать несколько подключений (для inputs)
  defaultValue?: any;   // значение по умолчанию если не подключено
  description?: string; // тултип
}

export interface SettingDef {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'json';
  options?: { value: string; label: string }[];
  defaultValue?: any;
  description?: string;
  placeholder?: string;
}

export interface NodeDef {
  type: string;
  label: string;
  category: 'ai' | 'memory' | 'logic' | 'chat' | 'utilities';
  description: string;
  inputs: PortDef[];
  outputs: PortDef[];
  settings: SettingDef[]; // поля настроек, которые НЕ являются wire-портами
}

// ============================================================================
// AI NODES
// ============================================================================

const LLM_NODE: NodeDef = {
  type: 'llm',
  label: 'LLM',
  category: 'ai',
  description: '🧠 Отправляет промпт в Google Gemini и возвращает ответ. Подключение: Input (текст) → LLM → Response (текст). Настройте модель, температуру и системный промпт в панели свойств.',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Основной ввод для модели'
    },
    {
      id: 'prompt',
      label: 'System Prompt',
      type: 'text',
      required: false,
      defaultValue: '',
      description: 'Системный промпт (можно заполнить вручную или подключить)'
    },
    {
      id: 'context',
      label: 'Context',
      type: 'object',
      required: false,
      description: 'Дополнительный контекст для модели'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Response',
      type: 'text',
      required: true,
      description: 'Ответ модели'
    },
    {
      id: 'error',
      label: 'Error',
      type: 'text',
      required: false,
      description: 'Ошибка если произошла'
    }
  ],
  settings: [
    {
      id: 'model',
      label: 'Модель',
      type: 'select',
      options: [], // Будет заполнено динамически из allModels
      defaultValue: 'gemini-2.0-flash-exp',
      description: 'Языковая модель для использования'
    },
    {
      id: 'apiKeyIndex',
      label: 'API Ключ',
      type: 'select',
      options: [], // Будет заполнено динамически из apiKeys
      defaultValue: '0',
      description: 'Какой API ключ использовать'
    },
    {
      id: 'temperature',
      label: 'Температура',
      type: 'number',
      defaultValue: 0.7,
      description: 'Креативность модели (0-2)'
    },
    {
      id: 'maxTokens',
      label: 'Макс. токены',
      type: 'number',
      defaultValue: 2048,
      description: 'Максимальное количество токенов в ответе'
    }
  ]
};

const SKILL_NODE: NodeDef = {
  type: 'skill',
  label: 'Skill',
  category: 'ai',
  description: 'Вызов навыка (встроенного или HF Space)',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Входные данные для навыка'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Result',
      type: 'any',
      required: true,
      description: 'Результат выполнения навыка'
    },
    {
      id: 'error',
      label: 'Error',
      type: 'text',
      required: false
    }
  ],
  settings: [
    {
      id: 'skillId',
      label: 'Skill',
      type: 'select',
      options: [], // заполняется динамически из registry
      defaultValue: ''
    },
    {
      id: 'parameters',
      label: 'Parameters',
      type: 'json',
      defaultValue: {},
      description: 'Дополнительные параметры навыка'
    }
  ]
};

// ============================================================================
// MEMORY NODES
// ============================================================================

const MEMORY_READ_NODE: NodeDef = {
  type: 'memory_read',
  label: 'Memory Read',
  category: 'memory',
  description: 'Чтение из памяти',
  inputs: [
    {
      id: 'query',
      label: 'Query',
      type: 'text',
      required: true,
      defaultValue: '',
      description: 'Поисковый запрос или ключ'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Result',
      type: 'any',
      required: true,
      description: 'Найденные данные'
    },
    {
      id: 'found',
      label: 'Found',
      type: 'boolean',
      required: true,
      description: 'Были ли найдены данные'
    }
  ],
  settings: [
    {
      id: 'readMode',
      label: 'Режим чтения',
      type: 'select',
      options: [
        { value: 'semantic_search', label: 'Семантический поиск' },
        { value: 'exact_key', label: 'Точный ключ' },
        { value: 'list_all', label: 'Все записи' },
        { value: 'recent_n', label: 'Последние N' }
      ],
      defaultValue: 'semantic_search'
    },
    {
      id: 'scope',
      label: 'Область',
      type: 'select',
      options: [
        { value: 'local', label: 'Локально (текущий чат)' },
        { value: 'global', label: 'Глобально' }
      ],
      defaultValue: 'local'
    },
    {
      id: 'limit',
      label: 'Лимит',
      type: 'number',
      defaultValue: 5,
      description: 'Максимальное количество результатов'
    }
  ]
};

const MEMORY_WRITE_NODE: NodeDef = {
  type: 'memory_write',
  label: 'Memory Write',
  category: 'memory',
  description: 'Запись в память',
  inputs: [
    {
      id: 'key',
      label: 'Key',
      type: 'text',
      required: true,
      defaultValue: '',
      description: 'Ключ для сохранения'
    },
    {
      id: 'value',
      label: 'Value',
      type: 'any',
      required: true,
      description: 'Данные для сохранения'
    }
  ],
  outputs: [
    {
      id: 'success',
      label: 'Success',
      type: 'boolean',
      required: true,
      description: 'Успешно ли сохранено'
    },
    {
      id: 'output',
      label: 'Saved Data',
      type: 'any',
      required: true,
      description: 'Сохранённые данные'
    }
  ],
  settings: [
    {
      id: 'writeMode',
      label: 'Режим записи',
      type: 'select',
      options: [
        { value: 'direct_save', label: 'Прямое сохранение' },
        { value: 'upsert', label: 'Добавить/заменить' },
        { value: 'append', label: 'Дописать' }
      ],
      defaultValue: 'direct_save'
    },
    {
      id: 'scope',
      label: 'Область',
      type: 'select',
      options: [
        { value: 'local', label: 'Локально (текущий чат)' },
        { value: 'global', label: 'Глобально' }
      ],
      defaultValue: 'local'
    },
    {
      id: 'ttl',
      label: 'TTL (секунды)',
      type: 'number',
      defaultValue: 0,
      description: 'Время жизни (0 = бессрочно)'
    }
  ]
};

// ============================================================================
// LOGIC NODES
// ============================================================================

const CONDITION_NODE: NodeDef = {
  type: 'condition',
  label: 'Condition',
  category: 'logic',
  description: '❓ Маршрутизация данных по условию. Напишите JavaScript выражение, которое возвращает true/false. Input попадет либо в True, либо в False выход.',
  inputs: [
    {
      id: 'input',
      label: 'Data',
      type: 'any',
      required: true,
      description: 'Данные для проверки и передачи в ветку'
    },
    {
      id: 'condition',
      label: 'Condition (override)',
      type: 'text',
      required: false,
      defaultValue: '',
      description: 'Переопределение JS-условия из настроек. Ожидается: boolean.'
    }
  ],
  outputs: [
    {
      id: 'condition_true',
      label: 'True',
      type: 'any',
      required: false,
      description: 'Выход если условие истинно'
    },
    {
      id: 'condition_false',
      label: 'False',
      type: 'any',
      required: false,
      description: 'Выход если условие ложно'
    }
  ],
  settings: [
    {
      id: 'conditionCode',
      label: 'Condition Expression',
      type: 'textarea',
      defaultValue: 'input !== null && input !== undefined',
      placeholder: 'typeof input === "string" && input.length > 0',
      description: 'JavaScript выражение, возвращающее true/false. Доступны: context (все входы), input (данные).'
    }
  ]
};

const ROUTER_NODE: NodeDef = {
  type: 'router',
  label: 'Router',
  category: 'logic',
  description: 'Маршрутизация по условиям',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Данные для маршрутизации'
    }
  ],
  outputs: [
    {
      id: 'route_a',
      label: 'Route A',
      type: 'any',
      required: false
    },
    {
      id: 'route_b',
      label: 'Route B',
      type: 'any',
      required: false
    },
    {
      id: 'route_c',
      label: 'Route C',
      type: 'any',
      required: false
    },
    {
      id: 'default',
      label: 'Default',
      type: 'any',
      required: false
    }
  ],
  settings: [
    {
      id: 'routerMode',
      label: 'Режим маршрутизации',
      type: 'select',
      options: [
        { value: 'if_else', label: 'Цепочка If-Else' },
        { value: 'regex_match', label: 'Совпадение Regex' },
        { value: 'llm_classify', label: 'Классификация LLM' },
        { value: 'js_expression', label: 'JS-выражение' }
      ],
      defaultValue: 'if_else'
    },
    {
      id: 'routeACondition',
      label: 'Условие маршрута A',
      type: 'text',
      defaultValue: ''
    },
    {
      id: 'routeBCondition',
      label: 'Условие маршрута B',
      type: 'text',
      defaultValue: ''
    },
    {
      id: 'routeCCondition',
      label: 'Условие маршрута C',
      type: 'text',
      defaultValue: ''
    }
  ]
};

const LOOP_NODE: NodeDef = {
  type: 'loop',
  label: 'Loop',
  category: 'logic',
  description: 'Итерация по элементам',
  inputs: [
    {
      id: 'items',
      label: 'Items',
      type: 'array',
      required: true,
      description: 'Массив для итерации'
    },
    {
      id: 'loop_body',
      label: 'Body Result',
      type: 'any',
      required: false,
      description: 'Результат обработки текущего элемента'
    }
  ],
  outputs: [
    {
      id: 'current_item',
      label: 'Current Item',
      type: 'any',
      required: false,
      description: 'Текущий элемент итерации'
    },
    {
      id: 'loop_done',
      label: 'Done',
      type: 'array',
      required: false,
      description: 'Все результаты после завершения'
    }
  ],
  settings: [
    {
      id: 'maxIterations',
      label: 'Макс. итераций',
      type: 'number',
      defaultValue: 100,
      description: 'Максимальное количество итераций'
    },
    {
      id: 'iterateOver',
      label: 'Итерировать по',
      type: 'select',
      options: [
        { value: 'array_items', label: 'Элементы массива' },
        { value: 'range', label: 'Диапазон чисел' },
        { value: 'json_array_field', label: 'Поле JSON-массива' }
      ],
      defaultValue: 'array_items'
    }
  ]
};

const MERGE_NODE: NodeDef = {
  type: 'merge',
  label: 'Merge',
  category: 'logic',
  description: 'Объединение нескольких потоков',
  inputs: [
    {
      id: 'input_a',
      label: 'Input A',
      type: 'any',
      required: false,
      description: 'Первый поток'
    },
    {
      id: 'input_b',
      label: 'Input B',
      type: 'any',
      required: false,
      description: 'Второй поток'
    },
    {
      id: 'input_c',
      label: 'Input C',
      type: 'any',
      required: false,
      description: 'Третий поток'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Merged',
      type: 'any',
      required: true,
      description: 'Объединённый результат'
    }
  ],
  settings: [
    {
      id: 'mergeMode',
      label: 'Режим объединения',
      type: 'select',
      options: [
        { value: 'concat_text', label: 'Склеить текст' },
        { value: 'merge_objects', label: 'Слить объекты' },
        { value: 'array_collect', label: 'Собрать в массив' },
        { value: 'first_non_null', label: 'Первое непустое' }
      ],
      defaultValue: 'merge_objects'
    },
    {
      id: 'separator',
      label: 'Разделитель',
      type: 'text',
      defaultValue: '\n',
      description: 'Разделитель для concat_text'
    }
  ]
};

const SPLIT_NODE: NodeDef = {
  type: 'split',
  label: 'Split',
  category: 'logic',
  description: 'Разделение данных на части',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Данные для разделения'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Items',
      type: 'array',
      required: true,
      description: 'Массив разделённых элементов'
    }
  ],
  settings: [
    {
      id: 'splitMode',
      label: 'Режим разделения',
      type: 'select',
      options: [
        { value: 'by_newline', label: 'По переносу строки' },
        { value: 'by_comma', label: 'По запятой' },
        { value: 'by_regex', label: 'По Regex' },
        { value: 'json_array', label: 'JSON массив' },
        { value: 'fixed_chunks', label: 'Фиксированные куски' }
      ],
      defaultValue: 'by_newline'
    },
    {
      id: 'delimiter',
      label: 'Разделитель',
      type: 'text',
      defaultValue: '\n',
      description: 'Разделитель (для regex или custom)'
    }
  ]
};

// ============================================================================
// CHAT NODES
// ============================================================================

const CHAT_INPUT_NODE: NodeDef = {
  type: 'chat_input',
  label: 'Chat Input',
  category: 'chat',
  description: 'Получение ввода из чата',
  inputs: [],
  outputs: [
    {
      id: 'output',
      label: 'Message',
      type: 'text',
      required: true,
      description: 'Сообщение пользователя'
    },
    {
      id: 'metadata',
      label: 'Metadata',
      type: 'object',
      required: false,
      description: 'Метаданные сообщения'
    }
  ],
  settings: [
    {
      id: 'source',
      label: 'Источник',
      type: 'select',
      options: [
        { value: 'active_chat', label: 'Активный чат' },
        { value: 'chat_id', label: 'Конкретный Chat ID' },
        { value: 'last_message', label: 'Последнее сообщение' },
        { value: 'full_history', label: 'Полная история' }
      ],
      defaultValue: 'active_chat'
    }
  ]
};

const CHAT_OUTPUT_NODE: NodeDef = {
  type: 'chat_output',
  label: 'Chat Output',
  category: 'chat',
  description: 'Отправка сообщения в чат',
  inputs: [
    {
      id: 'input',
      label: 'Message',
      type: 'text',
      required: true,
      description: 'Сообщение для отправки'
    }
  ],
  outputs: [
    {
      id: 'success',
      label: 'Success',
      type: 'boolean',
      required: true,
      description: 'Успешно ли отправлено'
    }
  ],
  settings: [
    {
      id: 'target',
      label: 'Target',
      type: 'select',
      options: [
        { value: 'active_chat', label: 'Активный чат' },
        { value: 'chat_id', label: 'Конкретный Chat ID' },
        { value: 'new_message', label: 'Новое сообщение' },
        { value: 'append', label: 'Дописать к последнему' }
      ],
      defaultValue: 'active_chat'
    },
    {
      id: 'streamOutput',
      label: 'Потоковая отправка',
      type: 'checkbox',
      defaultValue: false,
      description: 'Потоковая отправка'
    }
  ]
};

const CHAT_HISTORY_NODE: NodeDef = {
  type: 'chat_history',
  label: 'История чата',
  category: 'chat',
  description: '📜 Хранилище сообщений, привязанное к текущему чату. Каждый стор имеет свой ID. Нода может читать, записывать, фильтровать сообщения и конвертировать историю в текст для LLM.',
  inputs: [
    {
      id: 'message',
      label: 'Сообщение',
      type: 'text',
      required: false,
      description: 'Текст сообщения для записи (только при операции write/append)'
    },
    {
      id: 'seed_messages',
      label: 'Начальные сообщения',
      type: 'array',
      required: false,
      description: 'Массив сообщений для инициализации стора (только при операции seed)'
    }
  ],
  outputs: [
    {
      id: 'messages',
      label: 'Сообщения',
      type: 'array',
      required: false,
      description: 'Массив объектов ChatHistoryMessage'
    },
    {
      id: 'text',
      label: 'Текст',
      type: 'text',
      required: false,
      description: 'История в виде plain text — готово для LLM'
    },
    {
      id: 'gemini_format',
      label: 'Gemini Format',
      type: 'array',
      required: false,
      description: 'Массив {role, parts} для прямой подачи в Gemini API'
    },
    {
      id: 'count',
      label: 'Кол-во',
      type: 'number',
      required: false,
      description: 'Количество сообщений в сторе'
    }
  ],
  settings: [
    {
      id: 'storeId',
      label: 'ID хранилища',
      type: 'text',
      defaultValue: 'main',
      placeholder: 'например: game_history, context, memory',
      description: 'Уникальное имя стора в рамках текущего чата'
    },
    {
      id: 'operation',
      label: 'Операция',
      type: 'select',
      options: [
        { value: 'read', label: '📖 Читать' },
        { value: 'append', label: '✏️ Добавить сообщение' },
        { value: 'seed', label: '🌱 Инициализировать (seed)' },
        { value: 'clear', label: '🗑️ Очистить' },
        { value: 'read_and_append', label: '📖✏️ Читать + добавить' },
      ],
      defaultValue: 'read'
    },
    {
      id: 'writeRole',
      label: 'Роль для записи',
      type: 'select',
      options: [
        { value: 'user', label: 'user' },
        { value: 'assistant', label: 'assistant' },
        { value: 'system', label: 'system' }
      ],
      defaultValue: 'user',
      description: 'Роль добавляемого сообщения (при операции append/read_and_append)'
    },
    {
      id: 'filterRole',
      label: 'Фильтр по роли',
      type: 'select',
      options: [
        { value: 'all', label: 'Все' },
        { value: 'user', label: 'Только user' },
        { value: 'assistant', label: 'Только assistant' },
        { value: 'system', label: 'Только system' }
      ],
      defaultValue: 'all',
      description: 'Фильтр для операции read'
    },
    {
      id: 'limit',
      label: 'Лимит сообщений',
      type: 'number',
      defaultValue: 0,
      description: 'Последние N сообщений (0 = все)'
    },
    {
      id: 'textFormat',
      label: 'Формат текста',
      type: 'select',
      options: [
        { value: 'with_roles', label: 'С ролями: "User: ...\nAssistant: ..."' },
        { value: 'plain', label: 'Только текст' },
        { value: 'xml', label: '<user>...</user><assistant>...</assistant>' }
      ],
      defaultValue: 'with_roles',
      description: 'Как форматировать выход text'
    }
  ]
};

// ============================================================================
// UTILITY NODES
// ============================================================================

const TRANSFORM_NODE: NodeDef = {
  type: 'transform',
  label: 'Transform',
  category: 'utilities',
  description: 'Преобразование данных',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Данные для преобразования'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Result',
      type: 'any',
      required: true,
      description: 'Преобразованные данные'
    },
    {
      id: 'error',
      label: 'Error',
      type: 'text',
      required: false
    }
  ],
  settings: [
    {
      id: 'transformType',
      label: 'Тип преобразования',
      type: 'select',
      options: [
        { value: 'js_expression', label: 'JS-выражение' },
        { value: 'extract_field', label: 'Извлечь поле' },
        { value: 'format_string', label: 'Форматировать строку' },
        { value: 'json_parse', label: 'JSON Parse' },
        { value: 'json_stringify', label: 'JSON Stringify' }
      ],
      defaultValue: 'js_expression'
    },
    {
      id: 'expression',
      label: 'Выражение',
      type: 'textarea',
      defaultValue: 'return input;',
      description: 'JavaScript код для преобразования',
      placeholder: 'return input.toUpperCase();'
    }
  ]
};

const CODE_NODE: NodeDef = {
  type: 'code',
  label: 'Code',
  category: 'utilities',
  description: 'Выполнение произвольного JavaScript',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: false,
      description: 'Входные данные'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Result',
      type: 'any',
      required: true,
      description: 'Результат выполнения'
    },
    {
      id: 'error',
      label: 'Error',
      type: 'text',
      required: false
    }
  ],
  settings: [
    {
      id: 'code',
      label: 'Code',
      type: 'textarea',
      defaultValue: '// Ваш код здесь\nreturn input;',
      description: 'JavaScript код',
      placeholder: 'const result = input * 2;\nreturn result;'
    }
  ]
};

const HTTP_REQUEST_NODE: NodeDef = {
  type: 'http_request',
  label: 'HTTP Request',
  category: 'utilities',
  description: 'HTTP запрос к внешнему API',
  inputs: [
    {
      id: 'url',
      label: 'URL',
      type: 'text',
      required: true,
      defaultValue: '',
      description: 'URL для запроса'
    },
    {
      id: 'body',
      label: 'Body',
      type: 'object',
      required: false,
      description: 'Тело запроса (для POST/PUT)'
    },
    {
      id: 'headers',
      label: 'Headers',
      type: 'object',
      required: false,
      description: 'HTTP заголовки'
    }
  ],
  outputs: [
    {
      id: 'response',
      label: 'Response',
      type: 'object',
      required: true,
      description: 'Ответ сервера'
    },
    {
      id: 'status',
      label: 'Status',
      type: 'number',
      required: true,
      description: 'HTTP статус код'
    },
    {
      id: 'error',
      label: 'Error',
      type: 'text',
      required: false
    }
  ],
  settings: [
    {
      id: 'method',
      label: 'Метод',
      type: 'select',
      options: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'DELETE', label: 'DELETE' },
        { value: 'PATCH', label: 'PATCH' }
      ],
      defaultValue: 'GET'
    },
    {
      id: 'authType',
      label: 'Тип авторизации',
      type: 'select',
      options: [
        { value: 'none', label: 'Нет' },
        { value: 'bearer', label: 'Bearer Token' },
        { value: 'api_key', label: 'API Key' },
        { value: 'basic', label: 'Basic Auth' }
      ],
      defaultValue: 'none'
    }
  ]
};

const DEBUG_NODE: NodeDef = {
  type: 'debug',
  label: 'Debug',
  category: 'utilities',
  description: 'Отладочный вывод',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Данные для отладки'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Pass-through',
      type: 'any',
      required: true,
      description: 'Те же данные (pass-through)'
    }
  ],
  settings: [
    {
      id: 'debugLabel',
      label: 'Метка',
      type: 'text',
      defaultValue: 'Debug',
      description: 'Метка для вывода'
    },
    {
      id: 'logLevel',
      label: 'Уровень логирования',
      type: 'select',
      options: [
        { value: 'log', label: 'Log' },
        { value: 'warn', label: 'Warn' },
        { value: 'error', label: 'Error' }
      ],
      defaultValue: 'log'
    },
    {
      id: 'showInRunPanel',
      label: 'Показать в панели запуска',
      type: 'checkbox',
      defaultValue: true
    }
  ]
};

const INPUT_NODE: NodeDef = {
  type: 'input',
  label: 'Input',
  category: 'utilities',
  description: '📥 Точка входа пайплайна. При запуске запрашивает у пользователя текст (или использует статическое значение). Каждый агент должен содержать хотя бы одну Input ноду.',
  inputs: [],
  outputs: [
    {
      id: 'output',
      label: 'Data',
      type: 'any',
      required: true,
      description: 'Данные для передачи в следующую ноду'
    }
  ],
  settings: [
    {
      id: 'inputType',
      label: 'Источник входных данных',
      type: 'select',
      options: [
        { value: 'user_input', label: '💬 Спросить у пользователя' },
        { value: 'static', label: '📌 Статичное значение' },
        { value: 'chat_message', label: '💭 Последнее сообщение чата' },
      ],
      defaultValue: 'static',
      description: 'Откуда берутся входные данные'
    },
    {
      id: 'fieldLabel',
      label: 'Метка поля',
      type: 'text',
      defaultValue: 'Ваше сообщение',
      placeholder: 'например: "Введите ваш вопрос"',
      description: 'Подпись поля ввода в диалоге (только для user_input)'
    },
    {
      id: 'placeholder',
      label: 'Текст-заполнитель',
      type: 'text',
      placeholder: 'например: "Введите текст здесь..."',
      description: 'Текст-заполнитель в поле ввода'
    },
    {
      id: 'initialValue',
      label: 'Статичное значение',
      type: 'textarea',
      defaultValue: '',
      description: 'Используется когда Источник = Статичное значение',
      placeholder: '{"message": "Привет"}'
    }
  ]
};

const OUTPUT_NODE: NodeDef = {
  type: 'output',
  label: 'Output',
  category: 'utilities',
  description: '📤 Финальный шаг пайплайна. Показывает результат пользователю. Подключите выход любой ноды сюда чтобы отобразить его после выполнения.',
  inputs: [
    {
      id: 'input',
      label: 'Final Result',
      type: 'any',
      required: true,
      description: 'Финальный результат для отображения'
    }
  ],
  outputs: [],
  settings: [
    {
      id: 'outputType',
      label: 'Тип вывода',
      type: 'select',
      options: [
        { value: 'display', label: '👁 Показать в RunPanel' },
        { value: 'json', label: '{ } JSON формат' },
        { value: 'text', label: '📝 Обычный текст' },
      ],
      defaultValue: 'display'
    },
    {
      id: 'outputLabel',
      label: 'Метка вывода',
      type: 'text',
      defaultValue: 'Результат',
      placeholder: 'например: "Ответ AI"'
    }
  ]
};

const TEXT_NODE: NodeDef = {
  type: 'text',
  label: 'Text',
  category: 'utilities',
  description: 'Статический текст для промптов и данных',
  inputs: [],
  outputs: [
    {
      id: 'output',
      label: 'Text',
      type: 'text',
      required: true,
      description: 'Текстовое значение'
    }
  ],
  settings: [
    {
      id: 'content',
      label: 'Содержимое',
      type: 'textarea',
      defaultValue: '',
      description: 'Текстовое содержимое',
      placeholder: 'Введите текст здесь...'
    }
  ]
};

// ============================================================================
// REGISTRY
// ============================================================================

export const NODE_DEFINITIONS: Record<string, NodeDef> = {
  // AI
  llm: LLM_NODE,
  skill: SKILL_NODE,
  
  // Memory
  memory_read: MEMORY_READ_NODE,
  memory_write: MEMORY_WRITE_NODE,
  
  // Logic
  condition: CONDITION_NODE,
  router: ROUTER_NODE,
  loop: LOOP_NODE,
  merge: MERGE_NODE,
  split: SPLIT_NODE,
  
  // Chat
  chat_input: CHAT_INPUT_NODE,
  chat_output: CHAT_OUTPUT_NODE,
  chat_history: CHAT_HISTORY_NODE,
  
  // Utilities
  transform: TRANSFORM_NODE,
  code: CODE_NODE,
  http_request: HTTP_REQUEST_NODE,
  debug: DEBUG_NODE,
  input: INPUT_NODE,
  output: OUTPUT_NODE,
  text: TEXT_NODE,
  
  // Aliases для обратной совместимости
  agent_input: INPUT_NODE,
  agent_output: OUTPUT_NODE,
  memory: MEMORY_READ_NODE, // Legacy memory node
};

// Утилиты для работы с портами
export function getNodeDef(nodeType: string): NodeDef | undefined {
  return NODE_DEFINITIONS[nodeType];
}

export function getPortColor(portType: PortType): string {
  const colors: Record<PortType, string> = {
    text: '#818cf8',     // indigo
    number: '#34d399',   // emerald
    boolean: '#f472b6',  // pink
    object: '#fb923c',   // orange
    array: '#facc15',    // yellow
    any: '#94a3b8'       // slate
  };
  return colors[portType];
}

export function isPortCompatible(sourceType: PortType, targetType: PortType): boolean {
  if (sourceType === 'any' || targetType === 'any') return true;
  return sourceType === targetType;
}
