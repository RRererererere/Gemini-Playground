/**
 * Central declaration of all node types and their ports
 * Single source of truth for Agent Editor
 */

export type PortType = 'text' | 'number' | 'boolean' | 'object' | 'array' | 'any';

export interface PortDef {
  id: string;           // unique port id on this node
  label: string;        // display name ("Prompt", "Result", "True branch")
  type: PortType;
  required: boolean;    // is connection/value required
  multi?: boolean;      // can accept multiple connections (for inputs)
  defaultValue?: any;   // default value if not connected
  description?: string; // tooltip
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
  settings: SettingDef[]; // settings fields that are NOT wire-ports
}

// ============================================================================
// AI NODES
// ============================================================================

const LLM_NODE: NodeDef = {
  type: 'llm',
  label: 'Нейросеть (LLM)',
  category: 'ai',
  description: 'Отправляет промпт в Google Gemini. Поддерживает историю, инструменты и "размышления" (Thinking).',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Основной вход для модели'
    },
    {
      id: 'prompt',
      label: 'Перезапись Сист. Промпта',
      type: 'text',
      required: false,
      defaultValue: '',
      description: 'Системный промпт (перезапишет тот, что указан ниже в настройках)'
    },
    {
      id: 'context',
      label: 'Контекст / Данные',
      type: 'any',
      required: false,
      description: 'Дополнительные данные или документы для нейросети'
    },
    {
      id: 'tools',
      label: 'Инструменты (Tools)',
      type: 'array',
      required: false,
      description: 'Массив инструментов (функций) доступных нейросети'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Ответ',
      type: 'text',
      required: true,
      description: 'Текст ответа'
    },
    {
      id: 'thinking',
      label: 'Размышления (Thinking)',
      type: 'text',
      required: false,
      description: 'Внутренние рассуждения модели (если включено)'
    },
    {
      id: 'tool_calls',
      label: 'Вызовы функций',
      type: 'array',
      required: false,
      description: 'Массив вызванных функций'
    },
    {
      id: 'error',
      label: 'Ошибка',
      type: 'text',
      required: false
    }
  ],
  settings: [
    {
      id: 'model',
      label: 'Model',
      type: 'select',
      options: [
        { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Exp)' },
        { value: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Thinking' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
      ],
      defaultValue: 'gemini-2.0-flash-exp'
    },
    {
      id: 'apiKeyIndex',
      label: 'API Key',
      type: 'select',
      description: 'Выберите API ключ из сохраненных в настройках'
    },
    {
      id: 'systemPrompt',
      label: 'Системный Промпт',
      type: 'textarea',
      defaultValue: 'Ты профессиональный ИИ-агент.',
      placeholder: 'Инструкции для нейросети...'
    },
    {
      id: 'includeThoughts',
      label: 'Включить размышления',
      type: 'checkbox',
      defaultValue: true,
      description: 'Запрашивать поток мыслей модели (для Gemini 2.x)'
    },
    {
      id: 'temperature',
      label: 'Температура',
      type: 'number',
      defaultValue: 0.7
    },
    {
      id: 'useHistoryStore',
      label: 'Использовать Базу Данных',
      type: 'checkbox',
      defaultValue: false
    },
    {
      id: 'historyStoreId',
      label: 'ID Базы',
      type: 'text',
      defaultValue: 'main'
    }
  ]
};

const PLANNER_NODE: NodeDef = {
  type: 'planner',
  label: 'Планировщик (Planner)',
  category: 'ai',
  description: 'Разбивает задачу на подзадачи. На выходе дает структурированный план.',
  inputs: [
    { id: 'input', label: 'Task', type: 'text', required: true }
  ],
  outputs: [
    { id: 'plan', label: 'Full Plan (JSON)', type: 'object', required: true },
    { id: 'step1', label: 'Step 1', type: 'text', required: false },
    { id: 'step2', label: 'Step 2', type: 'text', required: false },
    { id: 'step3', label: 'Step 3', type: 'text', required: false }
  ],
  settings: [
    {
      id: 'model',
      label: 'Model',
      type: 'select',
      options: [
        { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Exp)' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
      ],
      defaultValue: 'gemini-2.0-flash-exp'
    },
    {
      id: 'apiKeyIndex',
      label: 'API Key',
      type: 'select',
      description: 'Выберите API ключ'
    },
    {
      id: 'plannerPrompt',
      label: 'Инструкция по планированию',
      type: 'textarea',
      defaultValue: 'Разбей задачу на 3 логических этапа. Верни JSON с полями step1, step2, step3.'
    }
  ]
};


const SKILL_NODE: NodeDef = {
  type: 'skill',
  label: 'Навык (Skill)',
  category: 'ai',
  description: 'Выполнение навыка.',
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
      options: [], // populated dynamically from registry
      defaultValue: ''
    },
    {
      id: 'parameters',
      label: 'Parameters',
      type: 'json',
      defaultValue: {},
      description: 'Доп. параметры навыка'
    }
  ]
};

// ============================================================================
// MEMORY NODES
// ============================================================================

const MEMORY_READ_NODE: NodeDef = {
  type: 'memory_read',
  label: 'Чтение из Памяти',
  category: 'memory',
  description: 'Позволяет найти записи в постоянной памяти агента',
  inputs: [
    {
      id: 'query',
      label: 'Query',
      type: 'text',
      required: true,
      defaultValue: '',
      description: 'Запрос для поиска или ключ'
    }
  ],
  outputs: [
    {
      id: 'results',
      label: 'Results',
      type: 'array',
      required: false,
      description: 'Массив найденных записей'
    },
    {
      id: 'context_text',
      label: 'Context Text',
      type: 'text',
      required: false,
      description: 'Найденные данные как текст'
    },
    {
      id: 'output',
      label: 'Result (legacy)',
      type: 'any',
      required: false,
      description: 'Найденные данные (устаревший)'
    },
    {
      id: 'count',
      label: 'Count',
      type: 'number',
      required: false,
      description: 'Кол-во найденных результатов'
    },
    {
      id: 'found',
      label: 'Found',
      type: 'boolean',
      required: false,
      description: 'Были ли найдены данные'
    }
  ],
  settings: [
    {
      id: 'readMode',
      label: 'Read mode',
      type: 'select',
      options: [
        { value: 'semantic_search', label: 'Semantic search' },
        { value: 'exact_key', label: 'Exact key' },
        { value: 'list_all', label: 'List all' },
        { value: 'recent_n', label: 'Recent N' }
      ],
      defaultValue: 'semantic_search'
    },
    {
      id: 'scope',
      label: 'Scope',
      type: 'select',
      options: [
        { value: 'local', label: 'Local (current chat)' },
        { value: 'global', label: 'Global' }
      ],
      defaultValue: 'local'
    },
    {
      id: 'limit',
      label: 'Limit',
      type: 'number',
      defaultValue: 5,
      description: 'Максимальное кол-во результатов'
    }
  ]
};

const MEMORY_WRITE_NODE: NodeDef = {
  type: 'memory_write',
  label: 'Запись в Память',
  category: 'memory',
  description: 'Сохранить данные или результаты в постоянную память',
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
      description: 'Сохраненные данные'
    }
  ],
  settings: [
    {
      id: 'writeMode',
      label: 'Write mode',
      type: 'select',
      options: [
        { value: 'direct_save', label: 'Direct save' },
        { value: 'upsert', label: 'Upsert' },
        { value: 'append', label: 'Append' }
      ],
      defaultValue: 'direct_save'
    },
    {
      id: 'scope',
      label: 'Scope',
      type: 'select',
      options: [
        { value: 'local', label: 'Local (current chat)' },
        { value: 'global', label: 'Global' }
      ],
      defaultValue: 'local'
    },
    {
      id: 'ttl',
      label: 'TTL (seconds)',
      type: 'number',
      defaultValue: 0,
      description: 'Время жизни сек (0 = навсегда)'
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
  description: 'Route data based on a condition. Write a JavaScript expression that returns true/false. Input goes to either the True or False output.',
  inputs: [
    {
      id: 'input',
      label: 'Data',
      type: 'any',
      required: true,
      description: 'Данные для оценки условия'
    },
    {
      id: 'condition',
      label: 'Condition (override)',
      type: 'text',
      required: false,
      defaultValue: '',
      description: 'Переопределить JS условие (ожидается boolean)'
    }
  ],
  outputs: [
    {
      id: 'condition_true',
      label: 'True',
      type: 'any',
      required: false,
      description: 'Выход при True'
    },
    {
      id: 'condition_false',
      label: 'False',
      type: 'any',
      required: false,
      description: 'Выход при False'
    }
  ],
  settings: [
    {
      id: 'conditionCode',
      label: 'Condition Expression',
      type: 'textarea',
      defaultValue: 'input !== null && input !== undefined',
      placeholder: 'typeof input === "string" && input.length > 0',
      description: 'JavaScript expression returning true/false. Available: context (all inputs), input (data).'
    }
  ]
};

const ROUTER_NODE: NodeDef = {
  type: 'router',
  label: 'Маршрутизатор (Router)',
  category: 'logic',
  description: 'Разделяет входящий запрос на несколько путей в зависимости от условия',
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
      label: 'Routing Mode',
      type: 'select',
      options: [
        { value: 'if_else', label: 'If-Else chain' },
        { value: 'regex_match', label: 'Regex match' },
        { value: 'llm_classify', label: 'LLM classify' },
        { value: 'js_expression', label: 'JS expression' }
      ],
      defaultValue: 'if_else'
    },
    {
      id: 'routeACondition',
      label: 'Route A Condition',
      type: 'text',
      defaultValue: ''
    },
    {
      id: 'routeBCondition',
      label: 'Route B Condition',
      type: 'text',
      defaultValue: ''
    },
    {
      id: 'routeCCondition',
      label: 'Route C Condition',
      type: 'text',
      defaultValue: ''
    }
  ]
};

const LOOP_NODE: NodeDef = {
  type: 'loop',
  label: 'Loop',
  category: 'logic',
  description: 'Iterate over elements',
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
      description: 'Результат обработки элемента'
    }
  ],
  outputs: [
    {
      id: 'current_item',
      label: 'Current Item',
      type: 'any',
      required: false,
      description: 'Текущий элемент'
    },
    {
      id: 'loop_done',
      label: 'Done',
      type: 'array',
      required: false,
      description: 'Все результаты после цикла'
    }
  ],
  settings: [
    {
      id: 'maxIterations',
      label: 'Max Iterations',
      type: 'number',
      defaultValue: 100,
      description: 'Макс. кол-во итераций'
    },
    {
      id: 'iterateOver',
      label: 'Iterate over',
      type: 'select',
      options: [
        { value: 'array_items', label: 'Array items' },
        { value: 'range', label: 'Number range' },
        { value: 'json_array_field', label: 'JSON array field' }
      ],
      defaultValue: 'array_items'
    },
    {
      id: 'agentId',
      label: 'Sub-Agent (Loop Body)',
      type: 'select',
      description: 'Агент, который будет запущен для каждого элемента'
    }
  ]
};

const MERGE_NODE: NodeDef = {
  type: 'merge',
  label: 'Merge',
  category: 'logic',
  description: 'Combine multiple streams',
  inputs: [
    {
      id: 'input_a',
      label: 'Input A',
      type: 'any',
      required: false,
      description: 'Поток 1'
    },
    {
      id: 'input_b',
      label: 'Input B',
      type: 'any',
      required: false,
      description: 'Поток 2'
    },
    {
      id: 'input_c',
      label: 'Input C',
      type: 'any',
      required: false,
      description: 'Поток 3'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Merged',
      type: 'any',
      required: true,
      description: 'Объединенный результат'
    }
  ],
  settings: [
    {
      id: 'mergeMode',
      label: 'Merge mode',
      type: 'select',
      options: [
        { value: 'concat_text', label: 'Concatenate text' },
        { value: 'merge_objects', label: 'Merge objects' },
        { value: 'array_collect', label: 'Collect into array' },
        { value: 'first_non_null', label: 'First non-null' }
      ],
      defaultValue: 'merge_objects'
    },
    {
      id: 'separator',
      label: 'Separator',
      type: 'text',
      defaultValue: '\n',
      description: 'Separator for concat_text'
    }
  ]
};

const SPLIT_NODE: NodeDef = {
  type: 'split',
  label: 'Split',
  category: 'logic',
  description: 'Split data into parts',
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
      description: 'Массив разбитых элементов'
    }
  ],
  settings: [
    {
      id: 'splitMode',
      label: 'Split mode',
      type: 'select',
      options: [
        { value: 'by_newline', label: 'By newline' },
        { value: 'by_comma', label: 'By comma' },
        { value: 'by_regex', label: 'By regex' },
        { value: 'json_array', label: 'JSON array' },
        { value: 'fixed_chunks', label: 'Fixed chunks' }
      ],
      defaultValue: 'by_newline'
    },
    {
      id: 'delimiter',
      label: 'Separator',
      type: 'text',
      defaultValue: '\n',
      description: 'Разделитель'
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
  description: 'Получить ввод из чата',
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
      label: 'Source',
      type: 'select',
      options: [
        { value: 'active_chat', label: 'Active chat' },
        { value: 'chat_id', label: 'Specific Chat ID' },
        { value: 'last_message', label: 'Last message' },
        { value: 'full_history', label: 'Full history' }
      ],
      defaultValue: 'active_chat'
    }
  ]
};

const CHAT_OUTPUT_NODE: NodeDef = {
  type: 'chat_output',
  label: 'Chat Output',
  category: 'chat',
  description: 'Отправить сообщение',
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
      description: 'Успешно ли отправлено сообщение'
    }
  ],
  settings: [
    {
      id: 'target',
      label: 'Target',
      type: 'select',
      options: [
        { value: 'active_chat', label: 'Active chat' },
        { value: 'chat_id', label: 'Specific Chat ID' },
        { value: 'new_message', label: 'New message' },
        { value: 'append', label: 'Append to last' }
      ],
      defaultValue: 'active_chat'
    },
    {
      id: 'streamOutput',
      label: 'Stream Output',
      type: 'checkbox',
      defaultValue: false,
      description: 'Отправлять по частям (stream)'
    }
  ]
};

const DATABASE_HUB_NODE: NodeDef = {
  type: 'database_hub',
  label: 'База Данных (Chat History)',
  category: 'chat',
  description: 'Визуальный хаб для хранения и управления сообщениями. Не требует проводов, работает глобально.',
  inputs: [],
  outputs: [],
  settings: [
    {
      id: 'storeId',
      label: 'Store ID',
      type: 'text',
      defaultValue: 'main',
      placeholder: 'Идентификатор базы',
      description: 'Глобальное имя базы, к которому могут обращаться нейросети.'
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
  description: 'Трансформация данных',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Данные для трансформации'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Result',
      type: 'any',
      required: true,
      description: 'Трансформированные данные'
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
      label: 'Transform type',
      type: 'select',
      options: [
        { value: 'js_expression', label: 'JS expression' },
        { value: 'extract_field', label: 'Extract field' },
        { value: 'format_string', label: 'Format string' },
        { value: 'json_parse', label: 'JSON Parse' },
        { value: 'json_stringify', label: 'JSON Stringify' }
      ],
      defaultValue: 'js_expression'
    },
    {
      id: 'expression',
      label: 'Expression',
      type: 'textarea',
      defaultValue: 'return input;',
      description: 'JS код для трансформации',
      placeholder: 'return input.toUpperCase();'
    }
  ]
};

const CODE_NODE: NodeDef = {
  type: 'code',
  label: 'Code',
  category: 'utilities',
  description: 'Выполнить любой JS код',
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
      description: 'Результат вычисления'
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
      defaultValue: '// Your code here\nreturn input;',
      description: 'JS код',
      placeholder: 'const result = input * 2;\nreturn result;'
    }
  ]
};

const HTTP_REQUEST_NODE: NodeDef = {
  type: 'http_request',
  label: 'HTTP Request',
  category: 'utilities',
  description: 'Запрос к внешнему API',
  inputs: [
    {
      id: 'url',
      label: 'URL',
      type: 'text',
      required: true,
      defaultValue: '',
      description: 'URL'
    },
    {
      id: 'body',
      label: 'Body',
      type: 'object',
      required: false,
      description: 'Тело запроса'
    },
    {
      id: 'headers',
      label: 'Headers',
      type: 'object',
      required: false,
      description: 'HTTP Заголовки (Headers)'
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
      description: 'Код ответа'
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
      label: 'Method',
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
      label: 'Auth type',
      type: 'select',
      options: [
        { value: 'none', label: 'None' },
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
  description: 'Вывод для дебага',
  inputs: [
    {
      id: 'input',
      label: 'Input',
      type: 'any',
      required: true,
      description: 'Данные для логов'
    }
  ],
  outputs: [
    {
      id: 'output',
      label: 'Pass-through',
      type: 'any',
      required: true,
      description: 'Оригинальные данные (сквозной)'
    }
  ],
  settings: [
    {
      id: 'debugLabel',
      label: 'Label',
      type: 'text',
      defaultValue: 'Debug',
      description: 'Заголовок в логе'
    },
    {
      id: 'logLevel',
      label: 'Log level',
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
      label: 'Show in run panel',
      type: 'checkbox',
      defaultValue: true
    }
  ]
};

const INPUT_NODE: NodeDef = {
  type: 'agent_input',
  label: 'Input',
  category: 'utilities',
  description: 'Вход агента',
  inputs: [],
  outputs: [
    {
      id: 'output',
      label: 'Data',
      type: 'any',
      required: true,
      description: 'Данные для следующего узла'
    }
  ],
  settings: [
    {
      id: 'inputType',
      label: 'Input Source',
      type: 'select',
      options: [
        { value: 'user_input', label: 'Ask user' },
        { value: 'static', label: 'Static value' },
        { value: 'chat_message', label: 'Last chat message' },
      ],
      defaultValue: 'static',
      description: 'Источник входных данных'
    },
    {
      id: 'fieldLabel',
      label: 'Field Label',
      type: 'text',
      defaultValue: 'Your message',
      placeholder: 'e.g.: "Enter your question"',
      description: 'Ярлык поля ввода'
    },
    {
      id: 'placeholder',
      label: 'Placeholder text',
      type: 'text',
      placeholder: 'e.g.: "Enter text here..."',
      description: 'Текст плейсхолдера'
    },
    {
      id: 'initialValue',
      label: 'Static value',
      type: 'textarea',
      defaultValue: '',
      description: 'Статическое значение',
      placeholder: '{"message": "Hello"}'
    }
  ]
};

const OUTPUT_NODE: NodeDef = {
  type: 'agent_output',
  label: 'Output',
  category: 'utilities',
  description: 'Выход агента',
  inputs: [
    {
      id: 'input',
      label: 'Final Result',
      type: 'any',
      required: true,
      description: 'Финальный результат для вывода'
    }
  ],
  outputs: [],
  settings: [
    {
      id: 'outputType',
      label: 'Output type',
      type: 'select',
      options: [
        { value: 'display', label: 'Display in RunPanel' },
        { value: 'json', label: 'JSON format' },
        { value: 'text', label: 'Plain text' },
      ],
      defaultValue: 'display'
    },
    {
      id: 'outputLabel',
      label: 'Output Label',
      type: 'text',
      defaultValue: 'Result',
      placeholder: 'e.g.: "AI Response"'
    }
  ]
};

const TEXT_NODE: NodeDef = {
  type: 'text',
  label: 'Text',
  category: 'utilities',
  description: 'Простой статичный текст',
  inputs: [],
  outputs: [
    {
      id: 'output',
      label: 'Text',
      type: 'text',
      required: true,
      description: 'Текст'
    }
  ],
  settings: [
    {
      id: 'content',
      label: 'Content',
      type: 'textarea',
      defaultValue: '',
      description: 'Текст',
      placeholder: 'Enter text here...'
    }
  ]
};

// ============================================================================
// NEW UTILITY NODES
// ============================================================================

const TEMPLATE_NODE: NodeDef = {
  type: 'template',
  label: 'Template',
  category: 'utilities',
  description: 'Текстовый шаблон с переменными {{var...}}',
  inputs: [
    { id: 'var1', label: 'Variable 1', type: 'any', required: false, description: 'Переменная 1' },
    { id: 'var2', label: 'Variable 2', type: 'any', required: false, description: 'Переменная 2' },
    { id: 'var3', label: 'Variable 3', type: 'any', required: false, description: 'Переменная 3' },
  ],
  outputs: [
    { id: 'output', label: 'Result', type: 'text', required: true, description: 'Собранный текст' }
  ],
  settings: [
    {
      id: 'template',
      label: 'Template',
      type: 'textarea',
      defaultValue: 'Hello, {{var1}}! You said: {{var2}}',
      placeholder: 'Use {{var1}}, {{var2}}, {{var3}} for substitution',
      description: 'Шаблон'
    }
  ]
};

const VARIABLE_NODE: NodeDef = {
  type: 'variable',
  label: 'Variable',
  category: 'utilities',
  description: 'Временная переменная на один запуск',
  inputs: [
    { id: 'set_value', label: 'Set Value', type: 'any', required: false, description: 'Установить значение' }
  ],
  outputs: [
    { id: 'value', label: 'Value', type: 'any', required: true, description: 'Текущее значение' }
  ],
  settings: [
    { id: 'varName', label: 'Variable name', type: 'text', defaultValue: 'myVar', description: 'Уникальное имя' },
    { id: 'initialValue', label: 'Initial value', type: 'textarea', defaultValue: '', description: 'Дефолтное значение' }
  ]
};

const JSON_EXTRACT_NODE: NodeDef = {
  type: 'json_extract',
  label: 'JSON Extract',
  category: 'utilities',
  description: 'Извлечь поле из JSON',
  inputs: [
    { id: 'input', label: 'JSON Input', type: 'any', required: true, description: 'JSON' }
  ],
  outputs: [
    { id: 'output', label: 'Value', type: 'any', required: true, description: 'Значение' },
    { id: 'error', label: 'Error', type: 'text', required: false, description: 'Ошибка, если нет' }
  ],
  settings: [
    {
      id: 'path',
      label: 'JSON Path',
      type: 'text',
      defaultValue: 'data.result',
      placeholder: 'data.items[0].name',
      description: 'Путь (dot notation)'
    },
    {
      id: 'parseFirst',
      label: 'Parse JSON string',
      type: 'checkbox',
      defaultValue: true,
      description: 'Парсить перед поиском'
    }
  ]
};

const DELAY_NODE: NodeDef = {
  type: 'delay',
  label: 'Delay',
  category: 'utilities',
  description: 'Задержка',
  inputs: [
    { id: 'input', label: 'Pass-through', type: 'any', required: true, description: 'Data to pass through' }
  ],
  outputs: [
    { id: 'output', label: 'Pass-through', type: 'any', required: true, description: 'Same data after delay' }
  ],
  settings: [
    { id: 'milliseconds', label: 'Delay (ms)', type: 'number', defaultValue: 1000, description: 'Миллисекунды (мсек)' }
  ]
};

const SUBAGENT_NODE: NodeDef = {
  type: 'subagent',
  label: 'Sub-Agent',
  category: 'ai',
  description: 'Запустить агента в агенте',
  inputs: [
    { id: 'input', label: 'Input', type: 'any', required: true, description: 'Вход для саб-агента' }
  ],
  outputs: [
    { id: 'output', label: 'Result', type: 'any', required: true, description: 'Результат' },
    { id: 'error', label: 'Error', type: 'text', required: false, description: 'Ошибка саб-агента' }
  ],
  settings: [
    {
      id: 'agentId',
      label: 'Agent',
      type: 'select',
      options: [], // populated dynamically from getGraphs()
      defaultValue: '',
      description: 'ID графа (агента)'
    }
  ]
};

// ============================================================================

const GLOBAL_DB_NODE: NodeDef = {
  type: 'global_db',
  label: 'Глобальная БД',
  category: 'memory',
  description: 'Пользовательская база данных (Key-Value) для хранения любой информации.',
  inputs: [],
  outputs: [],
  settings: [
    {
      id: 'storeId',
      label: 'ID Базы',
      type: 'text',
      defaultValue: 'my_db',
      placeholder: 'Идентификатор глобальной БД',
      description: 'Имя хранилища. Доступно для Memory Read и Memory Write.'
    }
  ]
};

const FEEDBACK_NODE: NodeDef = {
  type: 'feedback',
  label: 'Обратная связь',
  category: 'logic',
  description: 'Приостанавливает выполнение агента до получения обратной связи.',
  inputs: [
    {
      id: 'input',
      label: 'Входные данные',
      type: 'any',
      required: false,
      description: 'Данные для оценки'
    }
  ],
  outputs: [
    {
      id: 'feedback_result',
      label: 'Результат',
      type: 'object',
      required: true,
      description: 'JSON объект: { reaction: "like"|"dislike", message: "...", context: "..." }'
    }
  ],
  settings: [
    {
      id: 'promptText',
      label: 'Текст сообщения',
      type: 'text',
      defaultValue: 'Оцените ответ ИИ',
      description: 'Текст запроса для пользователя'
    }
  ]
};

// REGISTRY
// ============================================================================

export const NODE_DEFINITIONS: Record<string, NodeDef> = {
  global_db: GLOBAL_DB_NODE,
  feedback: FEEDBACK_NODE,
  // AI
  llm: LLM_NODE,
  planner: PLANNER_NODE,
  skill: SKILL_NODE,
  subagent: SUBAGENT_NODE,
  
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
  database_hub: DATABASE_HUB_NODE,
  
  // Utilities
  transform: TRANSFORM_NODE,
  code: CODE_NODE,
  http_request: HTTP_REQUEST_NODE,
  debug: DEBUG_NODE,
  input: INPUT_NODE,
  output: OUTPUT_NODE,
  text: TEXT_NODE,
  template: TEMPLATE_NODE,
  variable: VARIABLE_NODE,
  json_extract: JSON_EXTRACT_NODE,
  delay: DELAY_NODE,
  
  // Aliases for backward compatibility
  agent_input: INPUT_NODE,
  agent_output: OUTPUT_NODE,
  memory: MEMORY_READ_NODE, // Legacy memory node
};

// Utility functions for ports
export function getNodeDef(nodeType: string): NodeDef | undefined {
  return NODE_DEFINITIONS[nodeType];
}

export function getPortColor(portType: PortType): string {
  const colors: Record<PortType, string> = {
    text: '#818cf8',     // indigo — muted
    number: '#34d399',   // emerald — muted
    boolean: '#f472b6',  // pink — muted
    object: '#fb923c',   // orange — muted
    array: '#fbbf24',    // yellow — muted
    any: '#94a3b8'       // slate
  };
  return colors[portType];
}

export function isPortCompatible(sourceType: PortType, targetType: PortType): boolean {
  if (sourceType === 'any' || targetType === 'any') return true;
  return sourceType === targetType;
}
