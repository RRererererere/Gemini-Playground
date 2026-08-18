/**
 * HuggingFace Space Skill Factory
 * Превращает ParsedHFSpace в живой Skill
 */

import type { Skill, SkillToolResult } from '../types';
import type { ParsedHFSpace, ParsedHFEndpoint } from './parser';
import { toGeminiParameterType } from './parser';
import { callHFSpaceEndpoint } from './caller';

const STORAGE_KEY = 'hf_spaces';

export interface StoredHFSpace {
  spaceId: string;
  title: string;
  apiUrl: string;
  enabled: boolean;
  addedAt: number;
  token?: string;
  parsed: ParsedHFSpace;
}

/**
 * Создаёт Skill из ParsedHFSpace
 */
export function createHFSpaceSkill(stored: StoredHFSpace): Skill {
  const space = stored.parsed;
  
  // Создаём tool для каждого эндпоинта
  const tools = space.endpoints.map(endpoint => ({
    name: `hf_${sanitizeId(space.spaceId)}_${endpoint.id}`,
    description: buildToolDescription(endpoint, space.title),
    parameters: {
      type: 'object' as const,
      properties: endpoint.parameters.reduce((acc, param) => {
        acc[param.name] = toGeminiParameterType(param);
        return acc;
      }, {} as Record<string, any>),
      required: endpoint.parameters
        .filter(p => !p.optional)
        .map(p => p.name),
    },
  }));

  return {
    id: `hf_${sanitizeId(space.spaceId)}`,
    name: space.title,
    description: `HuggingFace Space: ${space.spaceId}`,
    longDescription: `Интеграция с HuggingFace Space ${space.spaceId}. Доступно ${space.endpoints.length} эндпоинтов.`,
    version: '1.0.0',
    icon: '🤗',
    category: 'utils',
    author: space.spaceId.split('/')[0],
    tags: ['huggingface', 'ai', 'ml', space.spaceId],

    tools,

    async onToolCall(toolName, args, ctx) {
      // Находим эндпоинт по имени tool
      const endpointId = parseInt(toolName.split('_').pop() || '0');
      const endpoint = space.endpoints.find(e => e.id === endpointId);
      
      if (!endpoint) {
        return {
          mode: 'respond',
          response: { error: 'Эндпоинт не найден' },
        };
      }

      // Проверяем файлы если нужны
      if (endpoint.hasFileInput && ctx.attachedFiles.length === 0) {
        ctx.emit({
          type: 'toast',
          message: `Прикрепи файл для ${endpoint.name}`,
          variant: 'warning',
        });
        return {
          mode: 'respond',
          response: { error: 'Требуется прикреплённый файл' },
        };
      }

      ctx.emit({
        type: 'toast',
        message: `🤗 Вызываю ${space.title}...`,
      });

      try {
        const result = await callHFSpaceEndpoint(
          space.apiUrl,
          endpoint,
          args,
          ctx.attachedFiles,
          stored.token
        );

        ctx.emit({
          type: 'toast',
          message: `✅ ${space.title} завершён`,
          variant: 'success',
        });

        return {
          mode: 'fire_and_forget',
          artifacts: result.artifacts,
        };
      } catch (err) {
        ctx.emit({
          type: 'toast',
          message: `Ошибка ${space.title}: ${err}`,
          variant: 'error',
        });

        return {
          mode: 'respond',
          response: { error: String(err) },
        };
      }
    },

    onInstall(ctx) {
      ctx.emit({
        type: 'toast',
        message: `🤗 ${space.title} подключён!`,
        variant: 'success',
      });
    },
  };
}

function buildToolDescription(endpoint: ParsedHFEndpoint, spaceTitle: string): string {
  let desc = `${spaceTitle} - ${endpoint.name}`;
  if (endpoint.description) desc += `: ${endpoint.description}`;
  
  if (endpoint.hasFileInput) {
    desc += ' (требуется прикреплённый файл)';
  }
  
  return desc;
}

function sanitizeId(spaceId: string): string {
  return spaceId.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

export function saveHFSpace(space: StoredHFSpace): void {
  const spaces = loadStoredHFSpaces();
  const existing = spaces.findIndex(s => s.spaceId === space.spaceId);
  
  if (existing >= 0) {
    spaces[existing] = space;
  } else {
    spaces.push(space);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces));
}

export function loadStoredHFSpaces(): StoredHFSpace[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function deleteHFSpace(spaceId: string): void {
  const spaces = loadStoredHFSpaces().filter(s => s.spaceId !== spaceId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces));
}

export function toggleHFSpace(spaceId: string, enabled: boolean): void {
  const spaces = loadStoredHFSpaces();
  const space = spaces.find(s => s.spaceId === spaceId);
  if (space) {
    space.enabled = enabled;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces));
  }
}

/**
 * Загружает все активные HF Space скиллы
 */
export function loadHFSpaceSkills(): Skill[] {
  return loadStoredHFSpaces()
    .filter(s => s.enabled)
    .map(s => createHFSpaceSkill(s));
}
