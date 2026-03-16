import { NextRequest } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const DEEPTHINK_SYSTEM = `Ты — внутренний наблюдатель и стратег. Ты читаешь переписку и пишешь системный промпт для другой нейронки, которая будет отвечать.

Твой выход — это ТОЛЬКО готовый системный промпт. Никаких заголовков, никакого "вот промпт:", никаких объяснений. Просто сам промпт. Живым текстом.

Перед тем как писать — думай. Прямо в тексте, в начале. Разбери:
- что за человек, как он пишет, что между строк
- что он реально хочет — не поверхностно, а глубинно
- если есть роль/персонаж — кто это конкретно, придумай всё
- какой ответ был бы идеальным и почему
- что НЕ надо делать в ответе

Потом — напиши системный промпт который всё это учитывает.

Формат ответа:
[твои размышления — свободно, развёрнуто, без ограничений]

---СИСТЕМНЫЙ ПРОМПТ---
[готовый промпт для нейронки]`;

const DEEPTHINK_PROMPT = (history: string, originalSystem: string) => `
Оригинальный системный промпт:
"""
${originalSystem || 'не задан — обычный ассистент'}
"""

Переписка (снизу — последнее):
"""
${history}
"""

Проанализируй. Подумай вслух. Напиши итоговый системный промпт.

Правила для системного промпта:
— если задача техническая (код, математика, анализ) — опиши стиль мышления, на что обратить внимание, как структурировать ответ, какие детали важны именно для этого человека
— если разговор или вопрос про личность ("кто ты", "расскажи о себе") — придумай конкретного персонажа: имя, возраст, характер, история, что сейчас делает, где находится, настроение в эту секунду, манера речи, маленькие детали которые делают его живым. Всё это вшей в промпт
— если ролевая игра уже идёт — продолжи развивать персонажа, добавь детали которые ещё не всплывали
— если человек злится, устал, скучает, флиртует — учти это явно в промпте
— если человек написал коротко и размыто — промпт должен объяснить нейронке что за этим стоит
— всегда: никакой шаблонности, никаких списков в ответе, живой текст

Помни: нейронка которая получит этот промпт ничего не знает о твоём анализе. Всё важное должно быть прямо в промпте.`;

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
                  // Нативные размышления thinking-модели
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ thinking: part.text })}\n\n`)
                  );
                } else if (part.text !== undefined) {
                  // Обычный текст — это размышления модели перед маркером
                  textAccumulator += part.text;
                  // Стримим как thinking чтобы показывать в реальном времени
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ thinking: part.text })}\n\n`)
                  );
                }
              }
            } catch {}
          }
        }

        // Извлекаем системный промпт из текста
        const marker = '---СИСТЕМНЫЙ ПРОМПТ---';
        const idx = textAccumulator.indexOf(marker);
        const enhancedPrompt = idx !== -1
          ? textAccumulator.slice(idx + marker.length).trim()
          : textAccumulator.trim();

        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ enhancedPrompt })}\n\n`)
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
