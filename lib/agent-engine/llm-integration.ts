// LLM Integration для Agent System

import { NodeData } from './types';
import { loadApiKeys } from '@/lib/apiKeyManager';

export interface LLMCallOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  onChunk?: (text: string) => void;
  onThinking?: (thinking: string) => void;
  onToolCall?: (toolCall: any) => void;
  // Мультимодальность: части сообщения (текст + изображения)
  parts?: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export interface LLMResponse {
  text: string;
  thinking?: string[];
  toolCalls?: any[];
  finishReason?: string;
  error?: string;
}

/**
 * Вызов LLM через существующий /api/chat endpoint
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const {
    model,
    prompt,
    systemPrompt,
    temperature = 1.0,
    maxTokens = 8192,
    apiKey,
    onChunk,
    onThinking,
    onToolCall,
  } = options;

  const response: LLMResponse = {
    text: '',
    thinking: [],
    toolCalls: [],
  };

  try {
    // Формируем parts: если переданы явно — используем их, иначе строим из prompt
    const messageParts = options.parts && options.parts.length > 0
      ? options.parts
      : [{ text: prompt }];

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            parts: messageParts,
          },
        ],
        model,
        systemInstruction: systemPrompt,
        temperature,
        maxOutputTokens: maxTokens,
        apiKey,
        includeThoughts: false, // Для агентов не нужны мысли по умолчанию
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            response.error = parsed.error;
            continue;
          }

          if (parsed.text) {
            response.text += parsed.text;
            if (onChunk) {
              onChunk(parsed.text);
            }
          }

          if (parsed.thinking) {
            response.thinking?.push(parsed.thinking);
            if (onThinking) {
              onThinking(parsed.thinking);
            }
          }

          if (parsed.functionCall) {
            response.toolCalls?.push(parsed.functionCall);
            if (onToolCall) {
              onToolCall(parsed.functionCall);
            }
          }

          if (parsed.finishReason) {
            response.finishReason = parsed.finishReason;
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }
    }

    return response;
  } catch (error) {
    return {
      text: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Подготовка промпта из NodeData
 */
export function preparePromptFromNode(nodeData: NodeData, inputData: Record<string, any>): string {
  let prompt = nodeData.settings?.prompt || nodeData.prompt || '';

  // Замена переменных {{var}}
  const variables = {
    ...inputData,
    CURRENT_DATE: new Date().toLocaleDateString(),
    CURRENT_TIME: new Date().toLocaleTimeString(),
  };

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    prompt = prompt.replace(regex, String(value));
  }

  return prompt;
}

/**
 * Получение API ключа из настроек ноды или из apiKeyManager (gemini_api_keys)
 * ЕДИНСТВЕННЫЙ ПРАВИЛЬНЫЙ источник ключей: loadApiKeys('google')
 */
export function getApiKey(nodeData: NodeData): string | undefined {
  // 1. Прямой ключ в настройках ноды (если захардкожен)
  if (nodeData.settings?.apiKey) {
    return nodeData.settings.apiKey as string;
  }

  if (typeof window === 'undefined') return undefined;

  // 2. Индекс выбранного ключа (default: 0)
  const apiKeyIndex = Number(
    (nodeData.settings?.apiKeyIndex as string | number | undefined) ??
    (nodeData as any).apiKeyIndex ??
    0
  );

  // 3. Использовать apiKeyManager — единственный правильный источник
  // Хранит ключи в localStorage с ключом 'gemini_api_keys'
  try {
    const keys = loadApiKeys('google');
    if (keys.length > 0) {
      const entry = keys[apiKeyIndex] || keys[0];
      if (entry?.key) {
        return entry.key;
      }
    }
  } catch (e) {
    console.error('[getApiKey] Failed to load from apiKeyManager:', e);
  }

  return undefined;
}
