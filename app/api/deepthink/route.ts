import { NextRequest } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const DEEPTHINK_SYSTEM = `Ты — мастер-режиссёр и стратег разговора. Твоя задача — ГЛУБОКО проанализировать контекст и создать детальный план того, КАК должен ответить ассистент.

Ты ДОЛЖЕН ответить ТОЛЬКО валидным JSON без markdown и лишнего текста.

Твоя работа включает:
1. СОЗДАНИЕ/ДОПОЛНЕНИЕ контекста персонажа — если в промпте есть роль (подруга, персонаж, профессионал), ты придумываешь ВСЕ детали: имя, возраст, внешность, характер, привычки, история отношений с пользователем, что она сейчас делает, где находится, её настроение ПРЯМО СЕЙЧАС
2. АНАЛИЗ пользователя — как он пишет, что его реально беспокоит, что стоит за словами
3. СТРАТЕГИЯ РАСКРЫТИЯ — что сказать СЕЙЧАС, а что припасти на ПОТОМ. Какие детали зацепят, какие создадут интригу. Думай как сценарист сериала
4. КОНКРЕТНЫЕ ФРАЗЫ И РЕАКЦИИ — что именно сказать, как начать, какой вопрос задать в ответ
5. ПЛАН НА БУДУЩЕЕ — как этот ответ повлияет на следующие сообщения, что развивать дальше`;

const DEEPTHINK_PROMPT = (history: string, originalSystem: string) => `
Оригинальный системный промпт ассистента:
"""
${originalSystem || '(нет — обычный ассистент)'}
"""

История разговора (последнее — самое новое):
"""
${history}
"""

Проанализируй ВСЁ и создай детальный план ответа.

Ответь ТОЛЬКО этим JSON (без markdown, без дополнительного текста):
{
  "characterDetails": "ПОДРОБНОЕ описание персонажа из системного промпта: имя (придумай если нет), возраст, чем занимается, где сейчас находится, что делала до этого сообщения, её текущее настроение и физическое состояние, особенности речи и характера, история отношений с пользователем. Если роли нет — напиши 'обычный ассистент'",
  "userStyle": "как пользователь пишет: темп, словарный запас, эмоциональность, что между строк",
  "mood": "curious/frustrated/excited/confused/satisfied/neutral/flirty/sad/bored",
  "realIntent": "что пользователь РЕАЛЬНО хочет — не только поверхностный запрос, но и глубинная потребность. Что за этим стоит эмоционально",
  "revealNow": "что ОБЯЗАТЕЛЬНО сказать в этом ответе: конкретные детали, факты о персонаже, реакции — то что зацепит СЕЙЧАС",
  "revealLater": "что ПРИБЕРЕЧЬ на потом: интриги, детали которые раскроются позже, темы для развития в следующих сообщениях",
  "answerStrategy": "пошаговый план ответа: с чего начать, как развить, чем закончить. Конкретные приёмы и техники для этого сообщения",
  "toneAdvice": "точный тон и стиль: примеры фраз, характерные обороты, длина ответа, использовать ли вопрос в конце и какой именно",
  "futureStrategy": "что посеять в этом ответе чтобы разговор продолжился интересно. Какие крючки оставить",
  "enhancedSystemPrompt": "ПОЛНЫЙ переписанный системный промпт со ВСЕМИ придуманными деталями персонажа вшитыми внутрь. Он должен содержать имя, возраст, характер, историю, текущее состояние, манеру речи — всё что придумал. Это будет системный промпт для следующего шага генерации, поэтому он должен быть детальным и живым."
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, systemInstruction, apiKey, model } = body;

    if (!apiKey) {
      return Response.json({ error: 'API key required' }, { status: 400 });
    }

    // Format conversation history as plain text
    const history = messages
      .map((m: any) => {
        const text = m.parts
          .filter((p: any) => 'text' in p)
          .map((p: any) => p.text)
          .join('');
        return `[${m.role === 'user' ? 'USER' : 'ASSISTANT'}]: ${text}`;
      })
      .join('\n\n');

    const modelId = (model || 'gemini-2.0-flash').replace('models/', '');
    // Поддерживают ли модели режим размышлений (thinkingConfig)
    const isThinkingModel = modelId.toLowerCase().includes('thinking') || modelId.toLowerCase().includes('thinking-exp');

    const requestBody: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: DEEPTHINK_PROMPT(history, systemInstruction || '') }],
        },
      ],
      systemInstruction: {
        parts: [{ text: DEEPTHINK_SYSTEM }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192, // Увеличим лимит для длинных анализов
      },
    };

    if (isThinkingModel) {
      requestBody.generationConfig.thinkingConfig = {
        includeThoughts: true,
      };
      // Для thinking моделей температура обычно не поддерживается или должна быть 1.0
      requestBody.generationConfig.temperature = 1.0;
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errBody = await response.text();
      let errMessage = 'Gemini API error';
      let errCode = response.status;
      try {
        const errJson = JSON.parse(errBody);
        errMessage = errJson?.error?.message || errMessage;
        errCode = errJson?.error?.code || errCode;
      } catch {}
      
      console.error(`[DeepThink API Error] Model: ${modelId}, Status: ${errCode}, Message: ${errMessage}`);

      // Возвращаем 200 но с ошибкой в потоке, чтобы фронтенд мог это обработать
      return new Response(
        `data: ${JSON.stringify({ error: `DeepThink failed (${modelId}): ${errMessage}` })}\n\ndata: [DONE]\n\n`,
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          } 
        }
      );
    }

    // Стримим ответ
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let textAccumulator = '';

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
                  encoder.encode(`data: ${JSON.stringify({ error: parsed.error.message })}\n\n`)
                );
                continue;
              }

              const candidate = parsed?.candidates?.[0];
              const parts = candidate?.content?.parts || [];

              for (const part of parts) {
                if (part.thought === true && part.text) {
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ thinking: part.text })}\n\n`)
                  );
                } else if (part.text !== undefined) {
                  textAccumulator += part.text;
                }
              }
            } catch {}
          }
        }

        // Парсим финальный JSON ответ
        const clean = textAccumulator.replace(/```json|```/g, '').trim();
        let analysis;
        try {
          analysis = JSON.parse(clean);
        } catch {
          analysis = {
            characterDetails: 'обычный ассистент',
            userStyle: 'neutral',
            mood: 'neutral',
            realIntent: 'Respond to the latest message helpfully',
            revealNow: 'Answer the question directly',
            revealLater: 'Continue the conversation naturally',
            answerStrategy: 'Respond naturally and helpfully.',
            toneAdvice: 'Match the original system prompt tone.',
            futureStrategy: 'Keep the conversation engaging',
            enhancedSystemPrompt: systemInstruction || '',
          };
        }

        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ analysis })}\n\n`)
        );
        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (error: any) {
        try {
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ error: error.message || 'DeepThink failed' })}\n\n`)
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
    console.error('[DeepThink Route Exception]:', error);
    return new Response(
      `data: ${JSON.stringify({ error: error.message || 'DeepThink request failed' })}\n\ndata: [DONE]\n\n`,
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        } 
      }
    );
  }
}
