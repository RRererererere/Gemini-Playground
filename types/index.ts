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
}

export interface DeepThinkAnalysis {
  characterDetails?: string;
  userStyle: string;
  mood: string;
  realIntent: string;
  revealNow?: string;
  revealLater?: string;
  answerStrategy: string;
  toneAdvice: string;
  futureStrategy?: string;
  enhancedSystemPrompt: string;
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
  blockedUntil?: number; // timestamp когда ключ снова будет доступен
  lastUsed?: number;
  errorCount: number;
}
