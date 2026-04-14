import type { SceneStateConfig, SceneStateCategory } from '@/types';
import { DEFAULT_SCENE_CATEGORIES } from '@/types';

const SCENE_STATE_CONFIG_KEY = 'deepthink_scene_state_config';

const DEFAULT_CONFIG: SceneStateConfig = {
  enabledCategories: ['spatial', 'characters', 'narrative', 'mood'],
  customCategories: [],
  categoryOrder: ['spatial', 'characters', 'narrative', 'mood', 'objects', 'tasks', 'visual', 'lore'],
  aiInstructions: '',
  pinned: false,
  autoEnabled: true,
};

export function loadSceneStateConfig(): SceneStateConfig {
  try {
    const stored = localStorage.getItem(SCENE_STATE_CONFIG_KEY);
    if (!stored) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      // Ensure arrays are merged properly
      enabledCategories: parsed.enabledCategories || DEFAULT_CONFIG.enabledCategories,
      customCategories: parsed.customCategories || [],
      categoryOrder: parsed.categoryOrder || DEFAULT_CONFIG.categoryOrder,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveSceneStateConfig(config: SceneStateConfig): void {
  try {
    localStorage.setItem(SCENE_STATE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save scene state config:', e);
  }
}

/**
 * Получить все категории (дефолтные + кастомные) с учётом config
 */
export function getSceneStateCategories(config: SceneStateConfig): SceneStateCategory[] {
  // Default categories with enabled status
  const defaults: SceneStateCategory[] = DEFAULT_SCENE_CATEGORIES.map(d => ({
    ...d,
    enabled: config.enabledCategories.includes(d.id),
    custom: false,
  }));

  // Custom categories
  const customs: SceneStateCategory[] = config.customCategories.map(c => ({
    ...c,
    label: c.label || c.id,
    icon: c.icon || '📋',
    custom: true,
  }));

  // Sort by categoryOrder, then append any uncategorized
  const orderMap = new Map<string, number>();
  config.categoryOrder.forEach((id, idx) => orderMap.set(id, idx));

  const all = [...defaults, ...customs];
  all.sort((a, b) => {
    const aOrder = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
    const bOrder = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
    return aOrder - bOrder;
  });

  return all;
}

/**
 * Получить JSON массив enabled категорий для промпта DeepThink
 */
export function getEnabledCategoryIdsForPrompt(config: SceneStateConfig): string[] {
  return config.enabledCategories;
}
