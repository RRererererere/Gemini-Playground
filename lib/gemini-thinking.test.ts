import { describe, expect, it } from 'vitest';
import { buildGeminiThinkingConfig } from './gemini-thinking';

describe('Gemini thinking configuration', () => {
  it('requests summaries from Flash-Lite without sending a legacy budget in Auto', () => {
    expect(buildGeminiThinkingConfig('models/gemini-3.5-flash-lite', -1, true)).toEqual({ includeThoughts: true });
  });

  it.each([[0, 'MINIMAL'], [512, 'LOW'], [4096, 'MEDIUM'], [8192, 'HIGH']])(
    'maps a stored Flash-Lite setting of %i to %s',
    (budget, thinkingLevel) => {
      expect(buildGeminiThinkingConfig('gemini-3.5-flash-lite', budget, true)).toEqual({
        includeThoughts: true,
        thinkingLevel,
      });
    },
  );

  it('uses a supported low level for Pro and respects a caller that hides summaries', () => {
    expect(buildGeminiThinkingConfig('gemini-3.1-pro-preview', 0, false)).toEqual({
      includeThoughts: false,
      thinkingLevel: 'LOW',
    });
  });

  it('keeps a valid token budget for Gemini 2.5 and requests summaries', () => {
    expect(buildGeminiThinkingConfig('gemini-2.5-flash', 32768, true)).toEqual({
      includeThoughts: true,
      thinkingBudget: 24576,
    });
  });

  it('omits thinking config for a model without thinking support', () => {
    expect(buildGeminiThinkingConfig('gemini-2.0-flash', 8192, true)).toBeUndefined();
  });
});
