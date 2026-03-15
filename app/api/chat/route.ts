import { NextRequest } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Проверить — это ли rate-limit ошибка
function isRateLimitError(status: number, message: string): boolean {
  return (
    status === 429 ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('resource exhausted')
  );
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
      thinkingBudget, // -1 = авто, 0 = выкл, N = конкретное
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
      .map((m: any) => ({
        role: m.role,
        parts: m.parts
          .filter((p: any) => {
            if ('text' in p) return true;
            if ('inlineData' in p) return p.inlineData?.data;
            return false;
          })
          .map((p: any) => {
            if ('text' in p) return { text: p.text || '' };
            return p;
          }),
      }))
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

    // Режим размышлений (Gemini 2.5 / 2.0)
    // -1 = авто (будет без явного ограничения), 0 = выключить, >0 = явное ограничение в токенах
    if (thinkingBudget !== undefined) {
      if (thinkingBudget === 0) {
        requestBody.generationConfig.thinkingConfig = {
          thinkingBudget: 0,
        };
      } else if (thinkingBudget > 0) {
        requestBody.generationConfig.thinkingConfig = {
          thinkingBudget: thinkingBudget,
        };
      }
      
      // Независимо от бюджета (разве что кроме 0), мы всегда просим возвращать размышления
      if (thinkingBudget !== 0) {
        if (!requestBody.generationConfig.thinkingConfig) {
          requestBody.generationConfig.thinkingConfig = {};
        }
        // В разных версиях API используется camelCase или snake_case, но стандарт для JSON обычно camelCase
        requestBody.generationConfig.thinkingConfig.includeThoughts = true;
      }
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;

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
      try {
        const errJson = JSON.parse(errBody);
        errMessage = errJson?.error?.message || errMessage;
        isRateLimit = isRateLimitError(geminiResponse.status, errMessage);
      } catch {}

      return new Response(
        `data: ${JSON.stringify({ error: errMessage, isRateLimit })}\n\ndata: [DONE]\n\n`,
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
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ error: parsed.error.message, isRateLimit: isRateLimitError(parsed.error.code || 0, parsed.error.message || '') })}\n\n`)
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
