// ─────────────────────────────────────────────────────────────────────────────
// Context layer settings — что включается в запрос к модели
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'gemini_context_layers_config';

export type ContextLayerId =
  | 'memory_instructions'
  | 'memory_facts'
  | 'user_system'
  | 'skills'
  | 'rpg_style'
  | 'image_context'
  | 'deepthink_enhanced';

export interface ContextLayerState {
  enabled: boolean;
  /** null = дефолт из кода; строка = пользовательский override */
  customText: string | null;
}

export interface MessageFilterConfig {
  /** Скрытые feedback-хинты при регенерации (bridge_data) */
  excludeBridgeData: boolean;
  /** Скрытые старые ответы при регенерации с дизлайком */
  excludeRegeneratedHidden: boolean;
  /** Отдельные tool_response сообщения */
  excludeToolResponse: boolean;
}

export interface ContextLayersConfig {
  layers: Record<ContextLayerId, ContextLayerState>;
  /** Инструкции памяти даже если нет релевантных фактов */
  alwaysIncludeMemoryInstructions: boolean;
  messageFilters: MessageFilterConfig;
}

export const DEFAULT_MEMORY_INSTRUCTIONS_KEY = 'gemini_memory_instructions_override';

function defaultLayer(enabled = true): ContextLayerState {
  return { enabled, customText: null };
}

export const DEFAULT_CONTEXT_LAYERS_CONFIG: ContextLayersConfig = {
  layers: {
    memory_instructions: defaultLayer(true),
    memory_facts: defaultLayer(true),
    user_system: defaultLayer(true),
    skills: defaultLayer(true),
    rpg_style: defaultLayer(true),
    image_context: defaultLayer(true),
    deepthink_enhanced: defaultLayer(true),
  },
  alwaysIncludeMemoryInstructions: false,
  messageFilters: {
    excludeBridgeData: true,
    excludeRegeneratedHidden: true,
    excludeToolResponse: true,
  },
};

export function loadContextLayersConfig(): ContextLayersConfig {
  if (typeof window === 'undefined') return DEFAULT_CONTEXT_LAYERS_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONTEXT_LAYERS_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONTEXT_LAYERS_CONFIG,
      ...parsed,
      layers: {
        ...DEFAULT_CONTEXT_LAYERS_CONFIG.layers,
        ...(parsed.layers || {}),
      },
      messageFilters: {
        ...DEFAULT_CONTEXT_LAYERS_CONFIG.messageFilters,
        ...(parsed.messageFilters || {}),
      },
    };
  } catch {
    return DEFAULT_CONTEXT_LAYERS_CONFIG;
  }
}

export function saveContextLayersConfig(config: ContextLayersConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('[ContextLayers] save failed:', e);
  }
}

export function loadMemoryInstructionsOverride(): string | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(DEFAULT_MEMORY_INSTRUCTIONS_KEY);
  return v && v.trim() ? v : null;
}

export function saveMemoryInstructionsOverride(text: string | null): void {
  if (typeof window === 'undefined') return;
  if (!text || !text.trim()) {
    localStorage.removeItem(DEFAULT_MEMORY_INSTRUCTIONS_KEY);
  } else {
    localStorage.setItem(DEFAULT_MEMORY_INSTRUCTIONS_KEY, text);
  }
}

export function resetContextLayersConfig(): ContextLayersConfig {
  saveContextLayersConfig(DEFAULT_CONTEXT_LAYERS_CONFIG);
  saveMemoryInstructionsOverride(null);
  return DEFAULT_CONTEXT_LAYERS_CONFIG;
}

export const CONTEXT_LAYER_META: Record<
  ContextLayerId,
  { label: string; description: string; editable: boolean; link?: string }
> = {
  memory_instructions: {
    label: 'Инструкции памяти',
    description: 'Скрытые правила: save_memory, search_image_memories, workflow',
    editable: true,
    link: 'memory',
  },
  memory_facts: {
    label: 'Факты памяти',
    description: 'Автоматически подобранные факты о пользователе и чате',
    editable: false,
    link: 'memory',
  },
  user_system: {
    label: 'Системный промпт',
    description: 'Ваш основной system prompt из настроек',
    editable: true,
    link: 'system',
  },
  skills: {
    label: 'Скиллы',
    description: 'Инъекции от активных скиллов',
    editable: false,
    link: 'skills',
  },
  rpg_style: {
    label: 'RPG-профиль стиля',
    description: 'Предпочтения из лайков/дизлайков',
    editable: true,
    link: 'rpg',
  },
  image_context: {
    label: 'Контекст изображений',
    description: 'Список Available Images для zoom_region',
    editable: true,
  },
  deepthink_enhanced: {
    label: 'DeepThink enhanced',
    description: 'Итоговый промпт от анализатора (заменяет слои выше при успехе)',
    editable: false,
    link: 'deepthink',
  },
};
