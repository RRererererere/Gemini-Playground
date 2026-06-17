// ─────────────────────────────────────────────────────────────────────────────
// Нормализация base URL для кастомных провайдеров (OpenAI-совместимые и др.)
// ─────────────────────────────────────────────────────────────────────────────
//
// Проблема, которую решает этот модуль: ранее нормализация всегда добавляла
// "/v1", если его не было в конце URL. Это ломало провайдеров, чей эндпоинт
// уже содержит другую версию пути — например "/v4": получалось "/v4/v1".
//
// Текущее поведение: мы НЕ добавляем "/v1", если URL уже заканчивается
// сегментом версии вида /v<число> (например /v1, /v2, /v4, /v10).
// Иначе — добавляем "/v1" (поведение по умолчанию для OpenAI-совместимых API).

const VERSION_SEGMENT_RE = /\/v\d+$/;

/**
 * Убирает trailing слэши и возвращает "чистый" base URL без суффикса версии.
 * Например:
 *   'https://x/api/v1/' -> 'https://x/api'
 *   'https://x/api/v4'  -> 'https://x/api'
 *   'https://x/api/'    -> 'https://x/api'
 */
export function stripTrailingVersion(baseUrl: string): string {
  return (baseUrl || '').replace(/\/+$/, '').replace(VERSION_SEGMENT_RE, '');
}

/**
 * Нормализует base URL, гарантируя наличие версии в конце пути.
 *
 * - Если URL уже заканчивается на /v<число> — возвращаем как есть (только
 *   подрезаем trailing слэши). Так '/v4' НЕ превращается в '/v4/v1'.
 * - Иначе добавляем '/v1' (дефолт для OpenAI-совместимых эндпоинтов).
 *
 * Примеры:
 *   'https://openrouter.ai/api'      -> 'https://openrouter.ai/api/v1'
 *   'https://openrouter.ai/api/v1'   -> 'https://openrouter.ai/api/v1'
 *   'https://openrouter.ai/api/v1/'  -> 'https://openrouter.ai/api/v1'
 *   'https://example.com/api/v4'     -> 'https://example.com/api/v4'
 *   'https://example.com/api/v4/'    -> 'https://example.com/api/v4'
 *   'https://api.anthropic.com'      -> 'https://api.anthropic.com/v1'
 */
export function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = (baseUrl || '').replace(/\/+$/, '');

  // Уже заканчивается версией (включая не-v1) — не трогаем.
  if (VERSION_SEGMENT_RE.test(trimmed)) {
    return trimmed;
  }

  return trimmed + '/v1';
}
