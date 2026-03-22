// Утилиты для обработки ошибок Gemini API

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
    m.includes('permission denied') && m.includes('key');
  const isPermission =
    status === 403 && !isInvalidKey ||
    m.includes('permission denied') ||
    m.includes('not authorized');

  let errorType = 'unknown';
  let userMessage: string | undefined;
  
  if (isQuota) {
    errorType = 'quota';
    // Проверяем, связана ли ошибка с токенами (контекстом)
    if (m.includes('input_token') || m.includes('input token') || m.includes('context')) {
      userMessage = 'Контекст слишком большой. Попробуйте сократить сообщение или начать новый чат.';
    } else if (m.includes('output_token') || m.includes('output token')) {
      userMessage = 'Превышен лимит токенов ответа. Попробуйте позже или используйте другую модель.';
    } else {
      userMessage = 'Превышена квота API. Попробуйте позже или проверьте лимиты вашего аккаунта.';
    }
  }
  else if (isRateLimit) {
    errorType = 'rate_limit';
    userMessage = 'Слишком много запросов. Подождите немного и попробуйте снова.';
  }
  else if (isInvalidKey) {
    errorType = 'invalid_key';
    userMessage = 'Неверный API ключ. Проверьте настройки.';
  }
  else if (isPermission) {
    errorType = 'permission';
    userMessage = 'Нет доступа к этой функции. Проверьте права вашего API ключа.';
  }
  else if (status === 400) {
    errorType = 'bad_request';
    // Для 400 ошибок проверяем, не связано ли с размером
    if (m.includes('token') || m.includes('length') || m.includes('too large') || m.includes('too long')) {
      userMessage = 'Запрос слишком большой. Попробуйте сократить сообщение или историю чата.';
    }
  }
  else if (status === 408) {
    errorType = 'timeout';
    userMessage = 'Превышено время ожидания. Попробуйте снова.';
  }
  else if (status >= 500) {
    errorType = 'internal';
    userMessage = 'Ошибка сервера Gemini. Попробуйте позже.';
  }
  
  return { errorType, isRateLimit, isQuota, isInvalidKey, isPermission, userMessage };
}

export function extractRetryAfterSeconds(message: string): number | null {
  const m = (message || '').match(/retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
