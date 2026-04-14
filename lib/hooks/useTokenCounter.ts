import { useState, useRef, useCallback } from 'react';
import type { Message } from '@/types';
import { getVisibleMessageText } from '@/lib/gemini';
import { buildMemoryPrompt } from '@/lib/memory-prompt';
import { buildSkillsSystemPrompt } from '@/lib/skills';
import { buildImageContext } from '@/lib/image-context';

/**
 * Хук для подсчёта токенов.
 * Отправляет запросы к /api/tokens с debounce и отменой предыдущих запросов.
 */
export function useTokenCounter() {
  const [tokenCount, setTokenCount] = useState(0);
  const [isCountingTokens, setIsCountingTokens] = useState(false);
  const tokenDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const tokenCountRequestIdRef = useRef(0);
  const tokenCountAbortRef = useRef<AbortController | null>(null);

  const countTokens = useCallback(async (
    msgs: Message[],
    sys: string,
    mod: string,
    apiKey: string,
    currentChatId: string | null,
    memoryEnabled: boolean,
    handleSkillEvent: (event: any) => void
  ) => {
    if (!apiKey || !mod || msgs.length === 0) {
      setTokenCount(0);
      return;
    }

    // Cancel previous request
    if (tokenCountAbortRef.current) {
      tokenCountAbortRef.current.abort();
    }

    // Increment request ID to track latest request
    const requestId = ++tokenCountRequestIdRef.current;
    const abortController = new AbortController();
    tokenCountAbortRef.current = abortController;

    setIsCountingTokens(true);

    // Строим полный системный промпт с memory + skills
    const userMessages = msgs
      .filter(m => m.role === 'user')
      .map(m => getVisibleMessageText(m.parts));

    const { prompt: memoryPrompt } = buildMemoryPrompt(
      userMessages,
      currentChatId || undefined,
      memoryEnabled
    );

    const skillsPromptInjection = buildSkillsSystemPrompt(
      currentChatId || '',
      msgs,
      handleSkillEvent
    );

    // Добавляем контекст изображений
    const imageContext = buildImageContext(msgs, currentChatId || undefined);

    let effectiveSystemPrompt = sys;
    if (memoryPrompt) {
      effectiveSystemPrompt = memoryPrompt + '\n\n' + sys;
    }
    if (skillsPromptInjection) {
      effectiveSystemPrompt = effectiveSystemPrompt + skillsPromptInjection;
    }
    if (imageContext) {
      effectiveSystemPrompt = effectiveSystemPrompt + imageContext;
    }

    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: [
            { role: 'system', parts: [{ text: effectiveSystemPrompt }] },
            ...msgs.map(m => ({ role: m.role, parts: m.parts })),
          ],
          model: mod,
          systemInstruction: effectiveSystemPrompt,
          apiKey,
        }),
      });
      const data = await res.json();

      // Only update if this is still the latest request
      if (requestId === tokenCountRequestIdRef.current) {
        setTokenCount(data.totalTokens || 0);
      }
    } catch (e: any) {
      // Ignore abort errors
      if (e.name !== 'AbortError') {
        console.error('[Token Count Error]:', e);
      }
    }

    // Only clear loading state if this is still the latest request
    if (requestId === tokenCountRequestIdRef.current) {
      setIsCountingTokens(false);
      tokenCountAbortRef.current = null;
    }
  }, []);

  // Debounced auto-count
  const scheduleTokenCount = useCallback((
    msgs: Message[],
    sys: string,
    mod: string,
    apiKey: string,
    currentChatId: string | null,
    memoryEnabled: boolean,
    handleSkillEvent: (event: any) => void,
    isStreaming: boolean,
    skillsRevision: number
  ) => {
    if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current);
    if (isStreaming) return;
    tokenDebounceRef.current = setTimeout(() => {
      countTokens(msgs, sys, mod, apiKey, currentChatId, memoryEnabled, handleSkillEvent);
    }, 400);
    return () => {
      if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current);
      if (tokenCountAbortRef.current) {
        tokenCountAbortRef.current.abort();
        tokenCountAbortRef.current = null;
      }
    };
  }, [countTokens]);

  return {
    tokenCount,
    setTokenCount,
    isCountingTokens,
    countTokens,
    scheduleTokenCount,
    tokenDebounceRef,
  };
}
