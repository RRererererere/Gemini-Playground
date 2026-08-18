import { describe, expect, it } from 'vitest';
import { classifyGeminiError } from './gemini-errors';

describe('classifyGeminiError', () => {
  it('classifies input quota errors', () => {
    const error = classifyGeminiError(429, 'Quota exceeded for metric: input_token_count');
    expect(error.errorType).toBe('quota');
    expect(error.isQuota).toBe(true);
    expect(error.isRateLimit).toBe(true);
  });

  it('classifies output quota errors', () => {
    const error = classifyGeminiError(429, 'Quota exceeded for metric: output_token_count');
    expect(error.errorType).toBe('quota');
    expect(error.userMessage).toBeTruthy();
  });

  it('classifies rate limits', () => {
    const error = classifyGeminiError(429, 'Rate limit exceeded');
    expect(error.errorType).toBe('rate_limit');
    expect(error.isRateLimit).toBe(true);
  });

  it('classifies invalid API keys', () => {
    const error = classifyGeminiError(401, 'API key not valid');
    expect(error.errorType).toBe('invalid_key');
    expect(error.isInvalidKey).toBe(true);
  });
});
