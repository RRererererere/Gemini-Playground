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
      let finalAnalysis: DeepThinkAnalysis | null = null;

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

            if (parsed.analysis) {
              finalAnalysis = parsed.analysis;
            }
          } catch {}
        }
      }

      if (!finalAnalysis) {
        setState(prev => ({ ...prev, isAnalyzing: false, error: 'No analysis received' }));
        return { enhancedPrompt: systemInstruction, analysis: null, error: 'No analysis received' };
      }

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        lastAnalysis: finalAnalysis,
      }));

      const enhanced = buildEnhancedPrompt(finalAnalysis);
      return { enhancedPrompt: enhanced, analysis: finalAnalysis, error: null };

    } catch (err: any) {
      setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
      return { enhancedPrompt: systemInstruction, analysis: null, error: err.message };
    }
  }, []);

  return { state, toggle, analyze };
}

function buildEnhancedPrompt(analysis: DeepThinkAnalysis): string {
  return `${analysis.enhancedSystemPrompt}

---
[DeepThink — Внутренний план для идеального ответа]

${analysis.characterDetails ? `Персонаж: ${analysis.characterDetails}\n` : ''}
Стиль пользователя: ${analysis.userStyle}
Настроение: ${analysis.mood}
Реальное намерение: ${analysis.realIntent}

Что сказать СЕЙЧАС: ${analysis.revealNow || analysis.answerStrategy}
Что приберечь ПОТОМ: ${analysis.revealLater || 'продолжать развивать разговор'}

Стратегия ответа: ${analysis.answerStrategy}
Тон и стиль: ${analysis.toneAdvice}
${analysis.futureStrategy ? `\nПлан на будущее: ${analysis.futureStrategy}` : ''}

ВАЖНО: Используй этот план для ответа. Не упоминай анализ явно — просто воплоти его.
---`;
}
