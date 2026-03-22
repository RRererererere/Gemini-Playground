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
