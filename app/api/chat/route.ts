import { NextRequest } from 'next/server';
import type { ChatTool } from '@/types';
import { toolToDeclaration } from '@/lib/gemini';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Проверить — это ли rate-limit ошибка
function isRateLimitError(status: number, message: string): boolean {
  return (
    status === 429 ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('resource exhausted')
  );
}

function classifyGeminiError(status: number, message: string): { errorType: string; isRateLimit: boolean; isQuota: boolean; isInvalidKey: boolean; isPermission: boolean } {
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
  if (isQuota) errorType = 'quota';
  else if (isRateLimit) errorType = 'rate_limit';
  else if (isInvalidKey) errorType = 'invalid_key';
  else if (isPermission) errorType = 'permission';
  else if (status === 400) errorType = 'bad_request';
  else if (status === 408) errorType = 'timeout';
  else if (status >= 500) errorType = 'internal';
  return { errorType, isRateLimit, isQuota, isInvalidKey, isPermission };
}

function extractRetryAfterSeconds(message: string): number | null {
  const m = (message || '').match(/retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Санитизация данных для Gemini API - конвертирует все значения в допустимые типы
function sanitizeForGemini(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj === 'string') {
    return obj;
  }
  
  if (typeof obj === 'number') {
    // Числа допустимы в объектах
    return obj;
  }
  
  if (typeof obj === 'boolean') {
    // Булевы значения допустимы
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForGemini(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeForGemini(obj[key]);
      }
    }
    return sanitized;
  }
  
  return String(obj);
}

function normalizeIncomingPart(part: any) {
  if (!part || typeof part !== 'object') return null;

  if ('functionCall' in part && part.functionCall?.name) {
    return {
      functionCall: {
        ...(part.functionCall.id ? { id: part.functionCall.id } : {}),
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      },
      ...(part.thought === true ? { thought: true } : {}),
      ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
    };
  }

  if ('functionResponse' in part && part.functionResponse?.name) {
    return {
      functionResponse: {
        ...(part.functionResponse.id ? { id: part.functionResponse.id } : {}),
        name: part.functionResponse.name,
        response: part.functionResponse.response,
        ...(Array.isArray(part.functionResponse.parts) ? { parts: part.functionResponse.parts } : {}),
      },
    };
  }

  if ('text' in part) {
    if (!part.text && part.thought !== true) return null;
    return {
      text: part.text || '',
      ...(part.thought === true ? { thought: true } : {}),
      ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
    };
  }

  if ('inlineData' in part && part.inlineData?.data) {
    return {
      inlineData: {
        mimeType: part.inlineData.mimeType,
        data: part.inlineData.data,
        ...(part.inlineData.displayName ? { displayName: part.inlineData.displayName } : {}),
      },
    };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      model,
      systemInstruction,
      temperature,
      apiKey,
      tools,
      memoryTools, // Инструменты памяти (уже в формате Gemini API)
      thinkingBudget, // -1 = авто, 0 = выкл, N = конкретное
      includeThoughts, // request model thoughts (Gemini 2.x/3.x)
    } = body;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key required' }), { status: 400 });
    }
    if (!model) {
      return new Response(JSON.stringify({ error: 'Model required' }), { status: 400 });
    }

    const modelId = model.startsWith('models/') ? model.slice(7) : model;

    // Построить contents
    const contents = messages
      .map((m: any) => {
        const parts: any[] = [];

        if (m.parts && Array.isArray(m.parts)) {
          m.parts
            .map((part: any) => normalizeIncomingPart(part))
            .filter(Boolean)
            .forEach((part: any) => parts.push(part));
        }

        if (m.toolCalls && Array.isArray(m.toolCalls)) {
          m.toolCalls.forEach((call: any) => {
            if (!call?.name) return;
            parts.push({
              functionCall: {
                ...(call.id ? { id: call.id } : {}),
                name: call.name,
                args: call.args || {},
              },
              ...(call.thought === true ? { thought: true } : {}),
              ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
            });
          });
        }

        if (m.toolResponses && Array.isArray(m.toolResponses)) {
          m.toolResponses.forEach((response: any) => {
            if (!response?.name) return;
            
            // Нормализуем response - Gemini ожидает объект с правильными типами
            let normalizedResponse = response.response;
            
            if (typeof normalizedResponse === 'string') {
              try {
                // Пытаемся распарсить JSON
                const parsed = JSON.parse(normalizedResponse);
                // Если это примитив (число, булево), оборачиваем в объект со строкой
                if (typeof parsed === 'number' || typeof parsed === 'boolean') {
                  normalizedResponse = { result: String(parsed) };
                } else if (parsed === null) {
                  normalizedResponse = { result: 'null' };
                } else {
                  normalizedResponse = sanitizeForGemini(parsed);
                }
              } catch {
                // Если не JSON, оборачиваем в объект
                normalizedResponse = { result: normalizedResponse };
              }
            } else if (typeof normalizedResponse === 'number' || typeof normalizedResponse === 'boolean') {
              // Числа и булевы значения оборачиваем в объект со строкой
              normalizedResponse = { result: String(normalizedResponse) };
            } else if (normalizedResponse === null || normalizedResponse === undefined) {
              normalizedResponse = { result: 'null' };
            } else if (typeof normalizedResponse !== 'object') {
              normalizedResponse = { result: String(normalizedResponse) };
            } else {
              // Если уже объект, санитизируем его
              normalizedResponse = sanitizeForGemini(normalizedResponse);
            }
            
            parts.push({
              functionResponse: {
                name: response.name,
                response: normalizedResponse,
              },
            });
          });
        }

        return {
          role: m.role,
          parts,
        };
      })
      .filter((m: any) => m.parts.length > 0);

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: typeof temperature === 'number' ? temperature : 1.0,
        maxOutputTokens: 8192,
      },
    };

    // Системный промпт
    if (systemInstruction && systemInstruction.trim()) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = [
        {
          functionDeclarations: tools
            .map((tool: ChatTool) => toolToDeclaration(tool))
            .filter((tool: { name: string; description: string }) => tool.name && tool.description),
        },
      ];
    }

    // Добавляем инструменты памяти (они уже в правильном формате)
    if (Array.isArray(memoryTools) && memoryTools.length > 0) {
      if (!requestBody.tools) {
        requestBody.tools = [{ functionDeclarations: [] }];
      }
      // Добавляем инструменты памяти к существующим
      requestBody.tools[0].functionDeclarations.push(...memoryTools);
    }

    // Режим размышлений (актуально в основном для Gemini 2.x/3.x).
    // По умолчанию мысли НЕ запрашиваем — это сильно ускоряет стрим и разгружает UI.
    const wantsThoughts = includeThoughts === true;
    if (wantsThoughts && thinkingBudget !== undefined) {
      if (thinkingBudget === 0) {
        requestBody.generationConfig.thinkingConfig = { thinkingBudget: 0 };
      } else if (thinkingBudget > 0) {
        requestBody.generationConfig.thinkingConfig = { thinkingBudget };
      } else {
        requestBody.generationConfig.thinkingConfig = {};
      }
      requestBody.generationConfig.thinkingConfig.includeThoughts = true;
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;

    // Логирование для отладки (только в dev режиме)
    if (process.env.NODE_ENV === 'development') {
      console.log('=== Gemini API Request ===');
      console.log('Model:', modelId);
      console.log('Contents:', JSON.stringify(contents, null, 2));
      console.log('Tools:', requestBody.tools ? JSON.stringify(requestBody.tools, null, 2) : 'None');
    }

    let geminiResponse: Response;
    try {
      geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (fetchErr: any) {
      return new Response(
        `data: ${JSON.stringify({ error: fetchErr.message || 'Network error' })}\n\ndata: [DONE]\n\n`,
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      let errMessage = 'Gemini API error';
      let isRateLimit = false;
      let errorType = 'unknown';
      let errorCode = geminiResponse.status;
      let errorStatus: string | undefined = undefined;
      try {
        const errJson = JSON.parse(errBody);
        errMessage = errJson?.error?.message || errMessage;
        errorCode = errJson?.error?.code || errorCode;
        errorStatus = errJson?.error?.status || errorStatus;
        const classified = classifyGeminiError(geminiResponse.status, errMessage);
        isRateLimit = classified.isRateLimit;
        errorType = classified.errorType;
      } catch {}
      if (errorType === 'unknown') {
        const classified = classifyGeminiError(geminiResponse.status, errMessage);
        isRateLimit = classified.isRateLimit;
        errorType = classified.errorType;
      }
      const retryAfterSeconds = extractRetryAfterSeconds(errMessage);

      return new Response(
        `data: ${JSON.stringify({ error: errMessage, isRateLimit, errorType, errorCode, errorStatus, retryAfterSeconds })}\n\ndata: [DONE]\n\n`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        }
      );
    }

    // Пробросить SSE-поток, разбирая thinking parts
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = geminiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

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
                const msg = parsed.error.message || 'Gemini API error';
                const code = parsed.error.code || 0;
                const statusText = parsed.error.status;
                const classified = classifyGeminiError(code, msg);
                const retryAfterSeconds = extractRetryAfterSeconds(msg);
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({
                    error: msg,
                    isRateLimit: classified.isRateLimit,
                    errorType: classified.errorType,
                    errorCode: code,
                    errorStatus: statusText,
                    retryAfterSeconds,
                  })}\n\n`)
                );
                continue;
              }

              const candidate = parsed?.candidates?.[0];
              const finishReason = candidate?.finishReason;

              // Заблокировано системами безопасности
              if (
                finishReason === 'SAFETY' ||
                finishReason === 'RECITATION' ||
                finishReason === 'BLOCKLIST' ||
                finishReason === 'PROHIBITED_CONTENT' ||
                candidate?.content === undefined && finishReason
              ) {
                const safetyRatings = candidate?.safetyRatings;
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ isBlocked: true, finishReason, safetyRatings })}\n\n`)
                );
                continue;
              }

              // Обработать parts — могут быть thinking parts и text parts
              const parts = candidate?.content?.parts || [];
              for (const part of parts) {
                if (part.thought === true && part.text) {
                  // Это размышления модели
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ thinking: part.text, finishReason })}\n\n`)
                  );
                } else if (part.functionCall) {
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({
                      functionCall: part.functionCall,
                      thoughtSignature: part.thoughtSignature,
                      thought: part.thought === true,
                      finishReason,
                    })}\n\n`)
                  );
                } else if (part.text !== undefined) {
                  // Обычный текст
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ text: part.text, finishReason })}\n\n`)
                  );
                }
              }

              // Если нет parts, но есть finishReason
              if (parts.length === 0 && finishReason) {
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ finishReason })}\n\n`)
                );
              }
            } catch {}
          }
        }

        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (e: any) {
        try {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ error: e.message || 'Stream error' })}\n\n`)
          );
          await writer.write(encoder.encode('data: [DONE]\n\n'));
        } catch {}
      } finally {
        try { await writer.close(); } catch {}
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    return new Response(
      `data: ${JSON.stringify({ error: error.message || 'Request failed' })}\n\ndata: [DONE]\n\n`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  }
}


