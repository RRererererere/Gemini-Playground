// Helpers for classifying Gemini API errors.

export function isRateLimitError(status: number, message: string): boolean {
  return (
    status === 429 ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('resource exhausted')
  );
}

export interface GeminiErrorClassification {
  errorType: string;
  isRateLimit: boolean;
  isQuota: boolean;
  isInvalidKey: boolean;
  isPermission: boolean;
  userMessage?: string;
}

export function classifyGeminiError(status: number, message: string): GeminiErrorClassification {
  const m = (message || '').toLowerCase();
  const isRateLimit = isRateLimitError(status, message);
  const isQuota =
    m.includes('exceeded your current quota') ||
    m.includes('quota') ||
    m.includes('billing') ||
    m.includes('insufficient_quota');
  const isInvalidKey =
    status === 401 ||
    (status === 403 && (m.includes('api key') || m.includes('api-key') || m.includes('key'))) ||
    m.includes('api key not valid') ||
    m.includes('api_key_invalid') ||
    m.includes('invalid api key') ||
    (m.includes('permission denied') && m.includes('key'));
  const isPermission =
    (status === 403 && !isInvalidKey) ||
    m.includes('permission denied') ||
    m.includes('not authorized');

  let errorType = 'unknown';
  let userMessage: string | undefined;

  if (isQuota) {
    errorType = 'quota';
    if (m.includes('input_token') || m.includes('input token') || m.includes('context')) {
      userMessage = 'Input context is too large. Shorten the message or start a new chat.';
    } else if (m.includes('output_token') || m.includes('output token')) {
      userMessage = 'The response token limit was exceeded. Try again later or use another model.';
    } else {
      userMessage = 'The API quota was exceeded. Check your API limits or billing settings.';
    }
  } else if (isRateLimit) {
    errorType = 'rate_limit';
    userMessage = 'Too many requests. Wait a moment and try again.';
  } else if (isInvalidKey) {
    errorType = 'invalid_key';
    userMessage = 'The API key is invalid. Check the provider settings.';
  } else if (isPermission) {
    errorType = 'permission';
    userMessage = 'This operation is not permitted. Check the API key permissions.';
  } else if (status === 400) {
    errorType = 'bad_request';
    if (m.includes('token') || m.includes('length') || m.includes('too large') || m.includes('too long')) {
      userMessage = 'The request is too large. Shorten the message or start a new chat.';
    }
  } else if (status === 408) {
    errorType = 'timeout';
    userMessage = 'The request timed out. Try again.';
  } else if (status >= 500) {
    errorType = 'internal';
    userMessage = 'The Gemini service returned an error. Try again later.';
  }

  return { errorType, isRateLimit, isQuota, isInvalidKey, isPermission, userMessage };
}

export function extractRetryAfterSeconds(message: string): number | null {
  const m = (message || '').match(/retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
