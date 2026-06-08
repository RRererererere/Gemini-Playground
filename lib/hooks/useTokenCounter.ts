import { useState, useRef, useCallback } from 'react';
import type { Message } from '@/types';
import { buildChatRequestMessages } from '@/lib/gemini';
import { buildSystemPromptLayers } from '@/lib/context-layers';
import { loadContextLayersConfig } from '@/lib/context-layers-storage';

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
    handleSkillEvent: (event: unknown) => void
  ) => {
    if (!apiKey || !mod || msgs.length === 0) {
      setTokenCount(0);
      return;
    }

    if (tokenCountAbortRef.current) {
      tokenCountAbortRef.current.abort();
    }

    const requestId = ++tokenCountRequestIdRef.current;
    const abortController = new AbortController();
    tokenCountAbortRef.current = abortController;

    setIsCountingTokens(true);

    const contextConfig = loadContextLayersConfig();
    const lastModelMsg = [...msgs].reverse().find(m => m.role === 'model');
    const built = buildSystemPromptLayers({
      messages: msgs,
      systemPrompt: sys,
      chatId: currentChatId,
      memoryEnabled,
      config: contextConfig,
      handleSkillEvent,
      deepThinkEnhancedPrompt: lastModelMsg?.deepThinkEnhancedPrompt || null,
    });

    const apiMessages = buildChatRequestMessages(msgs, contextConfig.messageFilters);

    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: [
            { role: 'system', parts: [{ text: built.text }] },
            ...apiMessages.map(m => ({ role: m.role, parts: m.parts })),
          ],
          model: mod,
          systemInstruction: built.text,
          apiKey,
        }),
      });
      const data = await res.json();

      if (requestId === tokenCountRequestIdRef.current) {
        setTokenCount(data.totalTokens || 0);
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.error('[Token Count Error]:', e);
      }
    }

    if (requestId === tokenCountRequestIdRef.current) {
      setIsCountingTokens(false);
      tokenCountAbortRef.current = null;
    }
  }, []);

  const scheduleTokenCount = useCallback((
    msgs: Message[],
    sys: string,
    mod: string,
    apiKey: string,
    currentChatId: string | null,
    memoryEnabled: boolean,
    handleSkillEvent: (event: unknown) => void,
    isStreaming: boolean,
    _skillsRevision: number
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
