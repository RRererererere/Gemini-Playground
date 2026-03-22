// ─────────────────────────────────────────────────────────────────────────────
// Gradio API schema (то что возвращает /info)
// ─────────────────────────────────────────────────────────────────────────────

export interface GradioComponentMeta {
  label: string;
  type: string;         // 'string' | 'number' | 'boolean' | 'filepath' и т.п.
  python_type: {
    type: string;       // 'str' | 'int' | 'float' | 'bool' | 'filepath'
    description: string;
  };
  component: string;    // 'Textbox' | 'Image' | 'Audio' | 'Slider' | 'Checkbox' ...
  example_input?: unknown;
  serializer: string;   // 'StringSerializable' | 'ImgSerializable' | 'FileSerializable'
}

export interface GradioEndpointInfo {
  parameters: GradioComponentMeta[];
  returns: GradioComponentMeta[];
  type: { generator: boolean; cancel: boolean };
}

export interface GradioApiInfo {
  named_endpoints: Record<string, GradioEndpointInfo>;
  unnamed_endpoints: Record<string, GradioEndpointInfo>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Наше представление HF Space
// ─────────────────────────────────────────────────────────────────────────────

export type HFComponentType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'file'
  | 'number'
  | 'boolean'
  | 'choice'
  | 'unknown';

export interface HFParam {
  index: number;
  name: string;           // sanitized snake_case для Gemini tool
  label: string;          // оригинальный лейбл из Gradio
  type: HFComponentType;
  geminiType: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  gradioComponent: string;
}

export interface HFOutput {
  index: number;
  label: string;
  type: HFComponentType;
  gradioComponent: string;
}

export interface HFEndpoint {
  route: string;          // '/predict' | '/run/generate' | '/api/predict'
  name: string;           // человекочитаемое название
  toolName: string;       // snake_case для Gemini tool declaration
  description: string;    // описание для Gemini
  params: HFParam[];
  outputs: HFOutput[];
  hasFileInput: boolean;  // принимает ли файлы
  hasFileOutput: boolean; // возвращает ли файлы
}

export interface ParsedHFSpace {
  /** https://owner-space-name.hf.space */
  baseUrl: string;
  /** Оригинальный URL который ввёл пользователь */
  originalUrl: string;
  /** owner/space-name */
  spaceId: string;
  /** Название для отображения */
  title: string;
  /** Описание если есть */
  description?: string;
  /** Список эндпоинтов */
  endpoints: HFEndpoint[];
  /** Требует ли HF токен */
  requiresToken: boolean;
  /** Версия Gradio */
  gradioVersion?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Сохранённый space (в localStorage)
// ─────────────────────────────────────────────────────────────────────────────

export interface SavedHFSpace {
  id: string;               // 'hf_owner_spacename'
  parsedSpace: ParsedHFSpace;
  addedAt: number;
  hfToken?: string;         // опциональный HF токен
  enabled: boolean;
}
