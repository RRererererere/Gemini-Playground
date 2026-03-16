export interface TextPart {
  text: string;
}

export interface InlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export type Part = TextPart | InlineDataPart;

export interface AttachedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // base64
  previewUrl?: string; // object URL for images
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  parts: Part[];
  files?: AttachedFile[];
  isStreaming?: boolean;
  thinking?: string;       // размышления модели (обычные)
  deepThinking?: string;   // размышления DeepThink (фиолетовые)
  deepThinkAnalysis?: DeepThinkAnalysis; // результат анализа DeepThink (редактируемый)
  deepThinkError?: string; // ошибка при выполнении анализа
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
  temperature: number;
  createdAt: number;
  updatedAt: number;
}

// Сохранённый системный промпт
export interface SavedSystemPrompt {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// API ключ с метаданными для циркуляции
export interface ApiKeyEntry {
  key: string;
  label?: string;
  // Legacy global block (older versions). Still respected for safety, but UI can clear it.
  blockedUntil?: number; // timestamp when key becomes available again (global)
  // Per-model blocking (preferred). Map: modelName -> blockedUntil timestamp
  blockedByModel?: Record<string, number>;
  lastUsed?: number;
  errorCount: number;
}
