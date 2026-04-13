import { useState, useCallback, useRef } from 'react';
import type { Message, DeepThinkAnalysis } from '@/types';

export interface DeepThinkState {
  enabled: boolean;
  isAnalyzing: boolean;
  lastAnalysis: DeepThinkAnalysis | null;
  error: string | null;
  errorType: 'network' | 'timeout' | 'api' | 'unknown' | null;
  retryCount: number;
}

const MAX_RETRIES = 2;

export function useDeepThink() {
  const [state, setState] = useState<DeepThinkState>({
    enabled: false,
    isAnalyzing: false,
    lastAnalysis: null,
    error: null,
    errorType: null,
    retryCount: 0,
  });

  // AbortController для отмены DeepThink запроса
  const abortControllerRef = useRef<AbortController | null>(null);

  const toggle = useCallback(() => {
    setState(prev => ({ ...prev, enabled: !prev.enabled, lastAnalysis: null, error: null, errorType: null, retryCount: 0 }));
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState(prev => ({ ...prev, isAnalyzing: false, error: 'Cancelled by user', errorType: null }));
    }
  }, []);

  const classifyError = (err: any): 'network' | 'timeout' | 'api' | 'unknown' => {
    if (err.name === 'AbortError') return 'network';
    if (err.name === 'TimeoutError' || (err.message && err.message.toLowerCase().includes('timeout'))) return 'timeout';
    if (err.message && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch'))) return 'network';
    if (err.message && (err.message.includes('API') || err.message.includes('401') || err.message.includes('403') || err.message.includes('500'))) return 'api';
    return 'unknown';
  };

  const analyze = useCallback(async (
    messages: Message[],
    systemInstruction: string,
    apiKey: string,
    model: string,
    deepThinkSystemPrompt: string,
    onThinkingUpdate?: (thinking: string) => void,
    retryAttempt: number = 0,
  ): Promise<{ enhancedPrompt: string; analysis: DeepThinkAnalysis | null; error: string | null }> => {
    setState(prev => ({ ...prev, isAnalyzing: true, error: null, errorType: null }));

    // Создаём новый AbortController для этого запроса
    abortControllerRef.current = new AbortController();

    // Timeout: 60 секунд
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }, 60000);

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    try {
      const response = await fetch('/api/deepthink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, systemInstruction, apiKey, model, deepThinkSystemPrompt }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = response.status >= 500 ? 'Сервер временно недоступен' :
                          response.status === 401 ? 'Неверный API ключ' :
                          response.status === 429 ? 'Превышен лимит запросов' :
                          `Ошибка API (${response.status})`;

        const data = await response.json().catch(() => ({}));
        const errorMessage = data.error || errorText;

        throw new Error(errorMessage);
      }

      reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let thinkingAccumulator = '';
      let enhancedPrompt = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.error) {
              throw new Error(parsed.error);
            }

            if (parsed.thinking) {
              thinkingAccumulator += parsed.thinking;
              if (onThinkingUpdate) {
                onThinkingUpdate(thinkingAccumulator);
              }
            }

            if (parsed.enhancedPrompt) {
              enhancedPrompt = parsed.enhancedPrompt;
            }
          } catch (parseErr) {
            // Игнорируем ошибки парсинга отдельных SSE сообщений
            console.debug('[DeepThink] SSE parse skip:', parseErr);
          }
        }
      }

      if (!enhancedPrompt) {
        // GNP: retry при пустом ответе (отдельно от network/timeout retry)
        if (retryAttempt < MAX_RETRIES) {
          const delay = Math.pow(2, retryAttempt) * 1000;
          console.log(`👻 [GNP/DeepThink] Empty analysis — retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`);

          setState(prev => ({
            ...prev,
            error: `Переподключение... (${retryAttempt + 1}/${MAX_RETRIES})`,
            retryCount: retryAttempt + 1,
          }));

          await new Promise(resolve => setTimeout(resolve, delay));
          return analyze(messages, systemInstruction, apiKey, model, deepThinkSystemPrompt, onThinkingUpdate, retryAttempt + 1);
        }

        // Все попытки исчерпаны — возвращаем пустой, не крашим
        console.warn(`👻 [GNP/DeepThink] All retries exhausted, proceeding with empty analysis`);
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          lastAnalysis: null,
          error: null,
          errorType: null,
          retryCount: 0,
        }));
        return { enhancedPrompt: messages[messages.length - 1]?.parts.find(p => 'text' in p)?.text || '', analysis: null, error: null };
      }

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        lastAnalysis: null,
        error: null,
        errorType: null,
        retryCount: 0,
      }));

      return { enhancedPrompt, analysis: null, error: null };

    } catch (err: any) {
      // Проверяем, была ли отмена пользователем
      if (err.name === 'AbortError') {
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          error: 'Отменено пользователем',
          errorType: null,
        }));
        return { enhancedPrompt: systemInstruction, analysis: null, error: 'Cancelled' };
      }

      clearTimeout(timeoutId);

      const errorType = classifyError(err);
      const errorMessage = err.message || 'Неизвестная ошибка';

      // RETRY LOGIC: пробуем ещё раз при network/timeout ошибках
      if (retryAttempt < MAX_RETRIES && (errorType === 'network' || errorType === 'timeout')) {
        const delay = Math.pow(2, retryAttempt) * 1000; // exponential backoff: 1s, 2s
        console.warn(`[DeepThink] ${errorType} error, retrying in ${delay}ms (attempt ${retryAttempt + 1}/${MAX_RETRIES})`);

        setState(prev => ({
          ...prev,
          error: `Переподключение... (${retryAttempt + 1}/${MAX_RETRIES})`,
          retryCount: retryAttempt + 1,
        }));

        await new Promise(resolve => setTimeout(resolve, delay));

        return analyze(messages, systemInstruction, apiKey, model, deepThinkSystemPrompt, onThinkingUpdate, retryAttempt + 1);
      }

      // Финальная ошибка — не фатальная, DeepThink optional
      const friendlyMessage = errorType === 'network' ? 'Ошибка сети. Проверьте подключение.' :
                              errorType === 'timeout' ? 'Превышено время ожидания (60с).' :
                              errorType === 'api' ? `Ошибка API: ${errorMessage}` :
                              errorMessage;

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: friendlyMessage,
        errorType,
        retryCount: 0,
      }));

      return { enhancedPrompt: systemInstruction, analysis: null, error: friendlyMessage };

    } finally {
      clearTimeout(timeoutId);
      // Cleanup reader
      if (reader) {
        try { reader.releaseLock(); } catch {}
      }
      abortControllerRef.current = null;
    }
  }, []);

  return { state, toggle, analyze, abort };
}
