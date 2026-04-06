export interface CanvasElement {
  type: 'click' | 'drag-image' | 'drag-text';
  tagName: string;
  innerText?: string;
  dataURL?: string;
  alt?: string;
  className?: string;
  id?: string;
}

// Gemini Bridge Protocol
export interface BridgePayload {
  eventType: string;        // "calculate", "analyze", "process" etc
  data: Record<string, any>; // User data from site
  format?: 'silent' | 'show' | 'auto'; // How to display in chat
}

export interface BridgeResponse {
  type: string;             // Event type to match
  html?: string;            // HTML to inject into site
  data?: Record<string, any>; // Any data for site
  message?: string;         // Optional message for chat
}

export type PreviewMode = 'interact' | 'inspect' | 'ai-app';

export type WebsiteType = 'static' | 'ai_interactive' | null;

export interface TextPart {
  text: string;
}

export interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export interface ThoughtPart {
  text: string;
  thought: true;
  thoughtSignature?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  thoughtSignature?: string;
  thought?: boolean;
  status?: 'pending' | 'submitted';
  result?: unknown;
  hidden?: boolean; // скрытый tool call (не показывается в UI, но отправляется в API)
  isMemoryTool?: boolean; // memory tool (не показывается в UI, но отправляется в API)
}

export interface ToolResponse {
  id: string;
  toolCallId?: string;
  name: string;
  response: unknown;
  extraParts?: Array<{ inlineData: { mimeType: string; data: string } }>; // sibling parts для Gemini 2.x multimodal
  hidden?: boolean; // скрытый response (не показывается в UI, но отправляется в API)
  isMemoryTool?: boolean; // memory tool response (не показывается в UI, но отправляется в API)
}

export type ToolSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface ToolSchemaField {
  id: string;
  name: string;
  type: ToolSchemaType;
  description?: string;
  required?: boolean;
  enumValues?: string[];
  properties?: ToolSchemaField[];
  items?: ToolSchemaField | null;
}

export interface ChatTool {
  id: string;
  name: string;
  description: string;
  parameters: ToolSchemaField[];
}

export type Part = TextPart | ThoughtPart | InlineDataPart;

export interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64
  previewUrl?: string; // object URL for browser previews (images, PDFs, etc.)
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  kind?: 'tool_response' | 'bridge_data' | 'regenerated_hidden'; // добавили regenerated_hidden для скрытых сообщений в аналитике
  parts: Part[];
  files?: AttachedFile[];
  annotationRefs?: AnnotationReference[]; // ссылки на аннотации для отображения
  skillArtifacts?: SkillArtifact[]; // результаты работы скиллов
  toolCalls?: ToolCall[];
  toolResponses?: ToolResponse[];
  memoryOperations?: MemoryOperation[]; // операции с памятью для отображения
  skillToolCalls?: SkillToolCall[]; // вызовы skill tools для отображения
  bridgeData?: BridgePayload; // данные от сайта через GeminiBridge
  apiKeySuffix?: string;   // last 4 chars of the API key used for generation
  isStreaming?: boolean;
  thinking?: string;       // размышления модели (обычные)
  deepThinking?: string;   // размышления DeepThink (фиолетовые)
  deepThinkAnalysis?: DeepThinkAnalysis; // результат анализа DeepThink (редактируемый)
  deepThinkError?: string; // ошибка при выполнении анализа
  deepThinkEnhancedPrompt?: string; // итоговый system prompt после DeepThink-анализа
  deepThinkOriginalPrompt?: string; // исходный system prompt ДО DeepThink (для diff в Insights)
  deepThinkInterrupted?: boolean; // DeepThink был прерван и ждёт решения пользователя
  preflightImageSearch?: {
    found: boolean;
    memories: Array<{
      id: string;
      description: string;
      tags: string[];
      entities: string[];
      thumbnailBase64: string;
      score?: number;
    }>;
    entities: string[];
    query: string;
    confidence: number;
  }; // результат preflight поиска изображений
  isBlocked?: boolean;     // заблокировано системами безопасности
  blockReason?: string;    // причина блокировки
  finishReason?: string;   // причина завершения
  modelName?: string;      // название модели, которая сгенерировала ответ
  // Ошибка генерации (Gemini API / сеть / quota / invalid key и т.п.)
  error?: string;
  errorType?: 'rate_limit' | 'quota' | 'invalid_key' | 'permission' | 'bad_request' | 'network' | 'timeout' | 'internal' | 'unknown';
  errorCode?: number;
  errorStatus?: string;
  errorRetryAfterMs?: number; // absolute timestamp when retry becomes available
  // UI helper: force-open editor for user prompt
  forceEdit?: boolean;
  // Arena: ID агента-отправителя (только в Arena режиме для model-сообщений)
  arenaAgentId?: string;
  // RPG Feedback: оценка сообщения пользователем
  feedback?: {
    rating: 'like' | 'dislike';
    comment?: string;
    timestamp: number;
    appliedToRegeneration?: boolean;
  };
}

// Артефакт скилла (импортируется из lib/skills/types.ts в рантайме)
export interface SkillArtifact {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'code' | 'table' | 'chart' | 'text' | 'custom' | 'annotated_image' | 'agent_card';
  label?: string;
  data: 
    | { kind: 'base64'; mimeType: string; base64: string }
    | { kind: 'url'; url: string; mimeType?: string }
    | { kind: 'text'; content: string; language?: string }
    | { kind: 'json'; value: unknown }
    | { kind: 'blob'; blob: Blob; mimeType: string }
    | { kind: 'stored'; stored: 'idb' } // большой артефакт в IndexedDB
    | { kind: 'annotations'; sourceImageId: string; annotations: AnnotationItem[] } // аннотированное изображение
    | { kind: 'agent'; agentId: string; name: string; description: string; avatarEmoji: string; model: string; enabledSkillIds: string[] }; // карточка агента
  sendToGemini?: boolean;
  downloadable?: boolean;
  filename?: string;
  skillId?: string;
}

// Annotation types for image analyser
export type AnnotationType = 'highlight' | 'pointer' | 'warning' | 'success' | 'info';
export type ArrowDirection = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none';

export interface AnnotationItem {
  x1_pct: number;
  y1_pct: number;
  x2_pct: number;
  y2_pct: number;
  label: string;
  type: AnnotationType;
  arrow_direction?: ArrowDirection;
}

// Ссылка на аннотацию в тексте сообщения
export interface AnnotationReference {
  id: string; // уникальный ID ссылки
  imageId: string; // ID изображения (file ID)
  imageName: string; // имя файла для отображения
  annotation: AnnotationItem; // сама аннотация
  color: string; // цвет маркера (соответствует типу аннотации)
}

// Вызов skill tool для отображения в чате
export interface SkillToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface DeepThinkAnalysis {
  enhancedSystemPrompt: string;
  characterDetails?: string;
  userStyle?: string;
  mood?: string;
  realIntent?: string;
  revealNow?: string;
  revealLater?: string;
  answerStrategy?: string;
  toneAdvice?: string;
  futureStrategy?: string;
}

export interface GeminiModel {
  name: string; // "models/gemini-2.0-flash"
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  version?: string;
}

export interface CountTokensResponse {
  totalTokens: number;
}

// Сохранённый чат
export interface SavedChat {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  systemPrompt: string;
  deepThinkSystemPrompt?: string;
  tools?: ChatTool[];
  temperature: number;
  createdAt: number;
  updatedAt: number;
  // Agent Creator: подчаты
  parentChatId?: string;      // если это подчат — ID родителя
  agentId?: string;           // если подчат создан агентом — его ID
  isSubChat?: boolean;        // флаг подчата
}

// Операция с памятью для отображения в чате
export interface MemoryOperation {
  type: 'save' | 'update' | 'forget' | 'save_image' | 'search_image' | 'recall_image';
  scope?: 'local' | 'global';
  fact?: string;
  oldFact?: string;
  category?: string;
  confidence?: number;
  reason?: string;
  memoryId?: string;
  // Для save_image
  description?: string;
  tags?: string[];
  entities?: string[];
  thumbnailBase64?: string;
  // Для search_image
  query?: string;
  results?: Array<{
    id: string;
    description: string;
    tags: string[];
    entities: string[];
    thumbnailBase64: string;
  }>;
}

// Сохранённый системный промпт
export interface SavedSystemPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Provider Support Types
// ─────────────────────────────────────────────────────────────────────────────

// Провайдер — Google AI или любой OpenAI-compatible эндпоинт
export interface Provider {
  id: string;            // 'google' (builtin) | crypto.randomUUID() (custom)
  name: string;          // 'Google AI' | 'OpenRouter' | 'Ollama'
  type: 'gemini' | 'openai';
  baseUrl: string;       // для openai: 'https://openrouter.ai/api/v1'
  isBuiltin: boolean;    // true только для Google AI
  createdAt: number;
}

// Кэш моделей провайдера — в localStorage
export interface ProviderModelsCache {
  providerId: string;
  models: UniversalModel[];
  fetchedAt: number;
}

// Унифицированная модель — работает для обоих типов провайдеров
export interface UniversalModel {
  id: string;            // 'models/gemini-2.5-flash' или 'gpt-4o'
  displayName: string;
  providerId: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  // только для gemini:
  supportedGenerationMethods?: string[];
}

// Текущий выбор модели — теперь с провайдером
export interface ActiveModel {
  providerId: string;
  modelId: string;       // полный ID модели
}

// API ключ с метаданными для циркуляции
export interface ApiKeyEntry {
  key: string;
  label?: string;
  providerId: string;    // НОВОЕ: к какому провайдеру относится ключ
  // Legacy global block (older versions). Still respected for safety, but UI can clear it.
  blockedUntil?: number; // timestamp when key becomes available again (global)
  // Per-model blocking (preferred). Map: modelName -> blockedUntil timestamp
  blockedByModel?: Record<string, number>;
  lastUsed?: number;
  errorCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Analysis Types
// ─────────────────────────────────────────────────────────────────────────────

// ZoomRegion - percentage-based coordinates for image regions
export interface ZoomRegion {
  x1_pct: number; // 0-100
  y1_pct: number; // 0-100
  x2_pct: number; // 0-100
  y2_pct: number; // 0-100
}

// ImageAnalysisMetadata - metadata for zoom operations
export interface ImageAnalysisMetadata {
  imageIdentifier: string; // file ID (e.g., "ph_abc123")
  reason: string; // Why this region was zoomed
  scale: string; // "3x", "4x", etc.
  originalSize: string; // "1920×1080px"
  cropSize: string; // "640×360px"
  scaledSize: string; // "1920×1080px"
  timestamp?: number; // When analysis was performed
}

// ─────────────────────────────────────────────────────────────────────────────
// File Editor Types
// ─────────────────────────────────────────────────────────────────────────────

// Открытый файл в редакторе
export interface OpenFile {
  id: string;           // уникальный ID
  name: string;         // "App.tsx", "styles.css"
  language: string;     // "typescript", "python", "html" etc
  content: string;      // ТЕКУЩЕЕ содержимое (not base64!)
  originalContent: string; // оригинал для diff/reset
  mimeType: string;
  isDirty: boolean;     // есть ли несохранённые правки
  history: FileHistoryEntry[]; // история правок
}

export interface FileHistoryEntry {
  timestamp: number;
  content: string;
  description: string; // "Added logging to handleClick"
}

export interface FileDiffOp {
  type: 'search_replace';
  search: string;       // что ищем (может быть неточным — fuzzy)
  replace: string;      // на что меняем
  description?: string; // что это за правка
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Creator Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  avatarEmoji: string;
  avatarImageMemoryId?: string;
  referenceImageIds: string[];
  enabledSkillIds: string[];
  model: string;
  temperature: number;
  creatorChatId: string;
  createdAt: number;
  updatedAt: number;
}
