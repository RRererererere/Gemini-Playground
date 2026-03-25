import type { Message, SkillArtifact } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// UI Events — то что скилл может делать с интерфейсом
// ─────────────────────────────────────────────────────────────────────────────

export type SkillUIEvent =
  | { type: 'toast'; message: string; variant?: 'default' | 'success' | 'error' | 'warning' }
  | { type: 'badge'; skillId: string; text: string; color?: string }
  | { type: 'badge_clear'; skillId: string }
  | { type: 'panel_update'; skillId: string; data: unknown }
  | { type: 'system_prompt_changed' } // хинт что system prompt обновился

// ─────────────────────────────────────────────────────────────────────────────
// Tool call result — что вернуть Gemini после вызова инструмента
// ─────────────────────────────────────────────────────────────────────────────

export type ToolCallMode =
  | 'fire_and_forget' // как memory — не ждём ответа, модель продолжает
  | 'respond';        // отправляем functionResponse, модель обрабатывает

export interface SkillToolResult {
  mode: ToolCallMode;
  response?: unknown; // только если mode === 'respond'
  responseParts?: Array<{ inlineData: { mimeType: string; data: string } }>; // sibling parts для Gemini 2.x
  artifacts?: SkillArtifact[]; // файлы/медиа для отображения в UI
}

// ─────────────────────────────────────────────────────────────────────────────
// Context — что скилл получает при вызове
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  getJSON<T>(key: string): T | null;
  setJSON<T>(key: string, value: T): void;
}

export interface AttachedFileRef {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  getData(): Promise<string>; // возвращает base64
  getBlob(): Promise<Blob>;
}

export interface SkillContext {
  /** ID текущего чата */
  chatId: string;
  /** Снапшот сообщений (read-only) */
  messages: Readonly<Message[]>;
  /** Файлы из последнего сообщения пользователя */
  attachedFiles: ReadonlyArray<AttachedFileRef>;
  /** Конфиг пользователя (API ключи и т.п.) */
  config: Record<string, string>;
  /** Хранилище изолированное для этого скилла */
  storage: SkillStorage;
  /** Эмитить UI событие */
  emit: (event: SkillUIEvent) => void;
  /** Алиасы изображений (img_1 -> file.id) для удобной ссылки */
  imageAliases?: Map<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config schema — что пользователь должен настроить
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'toggle';
  options?: string[]; // для select
  placeholder?: string;
  required?: boolean;
  description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini tool declaration (нативный формат)
// ─────────────────────────────────────────────────────────────────────────────

export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel — опциональный UI блок который скилл рендерит в сайдбаре
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillPanelData {
  title: string;
  items: Array<{
    label: string;
    value: string;
    highlight?: boolean;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill — главный интерфейс плагина
// ─────────────────────────────────────────────────────────────────────────────

export type SkillCategory = 'search' | 'data' | 'utils' | 'dev' | 'productivity' | 'fun';

export interface Skill {
  /** Уникальный идентификатор, snake_case */
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  version: string;
  icon: string; // emoji
  category: SkillCategory;
  author?: string;
  tags?: string[];

  /** Поля для настройки (API ключи и т.п.) */
  configSchema?: SkillConfigField[];

  /**
   * Tool declarations для Gemini API.
   * Добавляются к functionDeclarations при каждом запросе.
   */
  tools: GeminiToolDeclaration[];

  /**
   * Хук системного промпта.
   * Вызывается перед каждым запросом к API.
   * Возврати строку — она будет добавлена к system prompt.
   * Возврати null — ничего не добавляется.
   */
  onSystemPrompt?: (ctx: SkillContext) => string | null;

  /**
   * Исполнение tool call.
   * Вызывается когда Gemini вызывает инструмент из этого скилла.
   *
   * fire_and_forget → как memory, модель продолжает без ответа
   * respond → отправляем functionResponse, модель видит результат
   */
  onToolCall(
    toolName: string,
    args: Record<string, unknown>,
    ctx: SkillContext
  ): Promise<SkillToolResult>;

  /**
   * Хук после завершения ответа модели.
   * Можно анализировать сообщение и делать side effects.
   * Возвращает массив артефактов для добавления в сообщение.
   */
  onMessageComplete?: (message: Message, ctx: SkillContext) => SkillArtifact[] | void | Promise<SkillArtifact[] | void>;

  /** Вызывается при установке скилла */
  onInstall?: (ctx: SkillContext) => void;

  /** Вызывается при удалении скилла */
  onUninstall?: (ctx: SkillContext) => void;

  /** Данные для панели в сайдбаре (опционально) */
  getPanelData?: (ctx: SkillContext) => SkillPanelData | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry — что хранится в localStorage
// ─────────────────────────────────────────────────────────────────────────────

export interface InstalledSkillRecord {
  id: string;
  installedAt: number;
  enabled: boolean;
  config: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Executor events — то что возвращает executor в page.tsx
// ─────────────────────────────────────────────────────────────────────────────

export interface SkillExecutionResult {
  /** Отправить как functionResponse (null = fire_and_forget) */
  functionResponse: unknown | null;
  /** Sibling parts для Gemini 2.x (например, изображения рядом с functionResponse) */
  responseParts?: Array<{ inlineData: { mimeType: string; data: string } }>;
  /** UI события для обработки */
  uiEvents: SkillUIEvent[];
  /** Артефакты для добавления в сообщение */
  artifacts: SkillArtifact[];
}
