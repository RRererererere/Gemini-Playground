import { useState, useCallback } from 'react';
import type { Message, DeepThinkAnalysis } from '@/types';

export interface DeepThinkState {
  enabled: boolean;
  isAnalyzing: boolean;
  lastAnalysis: DeepThinkAnalysis | null;
  error: string | null;
}

export function useDeepThink() {
  const [state, setState] = useState<DeepThinkState>({
    enabled: false,
    isAnalyzing: false,
    lastAnalysis: null,
    error: null,
  });

  const toggle = useCallback(() => {
    setState(prev => ({ ...prev, enabled: !prev.enabled, lastAnalysis: null }));
  }, []);

  const analyze = useCallback(async (
    messages: Message[],
    systemInstruction: string,
    apiKey: string,
    model: string,
    onThinkingUpdate?: (thinking: string) => void,
  ): Promise<{ enhancedPrompt: string; analysis: DeepThinkAnalysis | null; error: string | null }> => {
    setState(prev => ({ ...prev, isAnalyzing: true, error: null }));

    try {
      const response = await fetch('/api/deepthink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, systemInstruction, apiKey, model }),
      });
      if (!response.ok) {
        const data = await response.json();
        setState(prev => ({ ...prev, isAnalyzing: false, error: data.error }));
        return { enhancedPrompt: systemInstruction, analysis: null, error: data.error };
      }

      const reader = response.body!.getReader();
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
              setState(prev => ({ ...prev, isAnalyzing: false, error: parsed.error }));
              return { enhancedPrompt: systemInstruction, analysis: null, error: parsed.error };
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
          } catch {}
        }
      }

      if (!enhancedPrompt) {
        setState(prev => ({ ...prev, isAnalyzing: false, error: 'No prompt received' }));
        return { enhancedPrompt: systemInstruction, analysis: null, error: 'No prompt received' };
      }

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        lastAnalysis: null,
      }));

      return { enhancedPrompt, analysis: null, error: null };

    } catch (err: any) {
      setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
      return { enhancedPrompt: systemInstruction, analysis: null, error: err.message };
    }
  }, []);

  return { state, toggle, analyze };
}
