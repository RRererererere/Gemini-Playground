import type { InstalledSkillRecord } from './types';

const REGISTRY_KEY = 'skills_registry';

// ─────────────────────────────────────────────────────────────────────────────
// Низкоуровневые операции с localStorage
// ─────────────────────────────────────────────────────────────────────────────

function readRegistry(): Record<string, InstalledSkillRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeRegistry(data: Record<string, InstalledSkillRecord>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(data));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/** Все установленные скиллы */
export function getInstalledSkills(): InstalledSkillRecord[] {
  return Object.values(readRegistry());
}

/** Один скилл по ID */
export function getInstalledSkill(id: string): InstalledSkillRecord | null {
  return readRegistry()[id] ?? null;
}

/** Установлен и включён? */
export function isSkillActive(id: string): boolean {
  const record = getInstalledSkill(id);
  return record !== null && record.enabled;
}

/** Установить скилл (или переустановить если уже есть) */
export function installSkill(id: string): InstalledSkillRecord {
  const registry = readRegistry();
  // Если уже установлен — не трогаем config, просто включаем
  if (registry[id]) {
    registry[id].enabled = true;
    writeRegistry(registry);
    return registry[id];
  }
  const record: InstalledSkillRecord = {
    id,
    installedAt: Date.now(),
    enabled: true,
    config: {},
  };
  registry[id] = record;
  writeRegistry(registry);
  return record;
}

/** Удалить скилл и его конфиг */
export function uninstallSkill(id: string): void {
  const registry = readRegistry();
  delete registry[id];
  writeRegistry(registry);
}

/** Включить/выключить без удаления */
export function setSkillEnabled(id: string, enabled: boolean): void {
  const registry = readRegistry();
  if (!registry[id]) return;
  registry[id].enabled = enabled;
  writeRegistry(registry);
}

/** Сохранить конфиг скилла (API ключи и т.п.) */
export function saveSkillConfig(id: string, config: Record<string, string>): void {
  const registry = readRegistry();
  if (!registry[id]) return;
  registry[id].config = { ...registry[id].config, ...config };
  writeRegistry(registry);
}

/** Получить конфиг скилла */
export function getSkillConfig(id: string): Record<string, string> {
  return getInstalledSkill(id)?.config ?? {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Кастомизация скиллов (описания и промпты)
// ─────────────────────────────────────────────────────────────────────────────

/** Получить кастомизацию скилла */
export function getSkillCustomization(id: string) {
  return getInstalledSkill(id)?.customization ?? null;
}

/** Сохранить кастомизацию скилла */
export function saveSkillCustomization(id: string, customization: import('./types').SkillCustomization): void {
  const registry = readRegistry();
  if (!registry[id]) return;
  registry[id].customization = customization;
  writeRegistry(registry);
}

/** Сбросить кастомизацию скилла к дефолтным значениям */
export function resetSkillCustomization(id: string): void {
  const registry = readRegistry();
  if (!registry[id]) return;
  delete registry[id].customization;
  writeRegistry(registry);
}

// ─────────────────────────────────────────────────────────────────────────────
// Экспорт/импорт настроек
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillsExport {
  version: string;
  exportedAt: number;
  skills: Array<{
    id: string;
    enabled: boolean;
    config: Record<string, string>;
    customization?: import('./types').SkillCustomization;
  }>;
}

/** Экспортировать все настройки скиллов */
export function exportSkillsSettings(): SkillsExport {
  const skills = getInstalledSkills();
  return {
    version: '1.0.0',
    exportedAt: Date.now(),
    skills: skills.map(s => ({
      id: s.id,
      enabled: s.enabled,
      config: s.config,
      customization: s.customization,
    })),
  };
}

/** Импортировать настройки скиллов */
export function importSkillsSettings(data: SkillsExport): { success: number; failed: number } {
  let success = 0;
  let failed = 0;

  for (const skillData of data.skills) {
    try {
      // Установить скилл если не установлен
      const existing = getInstalledSkill(skillData.id);
      if (!existing) {
        installSkill(skillData.id);
      }

      // Применить настройки
      setSkillEnabled(skillData.id, skillData.enabled);
      if (Object.keys(skillData.config).length > 0) {
        saveSkillConfig(skillData.id, skillData.config);
      }
      if (skillData.customization) {
        saveSkillCustomization(skillData.id, skillData.customization);
      }

      success++;
    } catch (err) {
      console.error(`Failed to import skill ${skillData.id}:`, err);
      failed++;
    }
  }

  return { success, failed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Изолированное хранилище для каждого скилла
// ─────────────────────────────────────────────────────────────────────────────

export function createSkillStorage(skillId: string) {
  const prefix = `skill_data_${skillId}_`;

  return {
    get(key: string): string | null {
      if (typeof window === 'undefined') return null;
      return localStorage.getItem(prefix + key);
    },
    set(key: string, value: string): void {
      if (typeof window === 'undefined') return;
      localStorage.setItem(prefix + key, value);
    },
    remove(key: string): void {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(prefix + key);
    },
    getJSON<T>(key: string): T | null {
      const raw = this.get(key);
      if (!raw) return null;
      try { return JSON.parse(raw) as T; } catch { return null; }
    },
    setJSON<T>(key: string, value: T): void {
      this.set(key, JSON.stringify(value));
    },
  };
}
