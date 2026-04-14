import { NextRequest } from 'next/server';
import { DEEPTHINK_MEMORY_MARKER } from '@/lib/gemini';
import { classifyGeminiError, extractRetryAfterSeconds } from '@/lib/gemini-errors';
import { getEnabledCategoryIdsForPrompt } from '@/lib/scene-state-storage';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const DEFAULT_DEEPTHINK_SYSTEM = `Ты — внутренний наблюдатель и стратег. Ты читаешь переписку и пишешь системный промпт для другой нейронки, которая будет отвечать.

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

const DEEPTHINK_PROMPT = (history: string, originalSystem: string, enabledCategoryIds?: string[], aiInstructions?: string) => {
  const sceneStateBlock = enabledCategoryIds && enabledCategoryIds.length > 0 ? `

--- SCENE STATE INSTRUCTIONS ---
После размышлений — заполни блок состояния сцены для текущего момента истории.

---SCENE_STATE---
Верни ТОЛЬКО валидный JSON массив (без markdown-обёрток) следующего вида:
[
  { "id": "spatial", "content": "Таверна «Золотой Петух», второй этаж, комната 7. Окно выходит на восток." },
  { "id": "characters", "content": "Арвен (ГГ): сидит на кровати, устала. Страж Морн: стоит у двери снаружи." },
  { "id": "narrative", "content": "Арвен только что узнала что Морн — двойной агент. Ещё не решила что делать." }
]

Заполняй ТОЛЬКО категории из списка: ${enabledCategoryIds.join(', ')}.
Будь конкретен, не абстрактен. Пиши как ремарки режиссёра, не как описание.
${aiInstructions ? `Дополнительные инструкции от пользователя: ${aiInstructions}` : ''}

Если тебе не хватает какой-то категории — запроси её добавление в конце массива:
{ "id": "__request__", "content": "Мне нужна категория 'Эмоциональное состояние' — я постоянно теряю трек того кто что чувствует" }

---END_SCENE_STATE---

` : '';

  return `
Оригинальный системный промпт:
"""
${originalSystem || 'не задан — обычный ассистент'}
"""

Переписка (снизу — последнее):
"""
${history}
"""

Проанализируй. Подумай вслух. Напиши итоговый системный промпт.${sceneStateBlock}
Правила для системного промпта:
— если задача техническая (код, математика, анализ) — опиши стиль мышления, на что обратить внимание, как структурировать ответ, какие детали важны именно для этого человека
— если разговор или вопрос про личность ("кто ты", "расскажи о себе") — придумай конкретного персонажа: имя, возраст, характер, история, что сейчас делает, где находится, настроение в эту секунду, манера речи, маленькие детали которые делают его живым. Всё это вшей в промпт
— если ролевая игра уже идёт — продолжи развивать персонажа, добавь детали которые ещё не всплывали
— если человек злится, устал, скучает, флиртует — учти это явно в промпте
— если человек написал коротко и размыто — промпт должен объяснить нейронке что за этим стоит
— всегда: никакой шаблонности, никаких списков в ответе, живой текст

Помни: нейронка которая получит этот промпт ничего не знает о твоём анализе. Всё важное должно быть прямо в промпте.`;
};

const DEEPTHINK_PROMPT_WITH_MULTIMODAL_CONTEXT = (originalSystem: string) => `
Original system prompt for the main chat:
"""
${originalSystem || 'not set - default assistant behavior'}
"""

Analyze the full conversation history above.

Important:
- Treat inlineData parts as first-class context.
- Some previous assistant turns may contain a text part that starts with "${DEEPTHINK_MEMORY_MARKER}". These are your own previous DeepThink notes from earlier turns.
- Use those notes as memory so you do not repeat the same reasoning every turn.
- Build on them, refine them, and only restate what is still useful for the current turn.
- Keep your visible reasoning rich and readable for the sandbox UI.

Then write the final system prompt for the answering model.
Put all important guidance inside that final prompt, because the answering model will not see your current reasoning block directly.
`;

function buildDeepThinkContents(messages: any[]) {
  return messages
    .map(message => {
      const parts = (message.parts || []).filter((part: any) => {
        if ('text' in part) return true;
        if ('inlineData' in part) return Boolean(part.inlineData?.data);
        return false;
      });

      if (message.role === 'model' && typeof message.deepThinking === 'string' && message.deepThinking.trim()) {
        parts.push({
          text: `${DEEPTHINK_MEMORY_MARKER}\n${message.deepThinking.trim()}`,
        });
      }

      return {
        role: message.role === 'model' ? 'model' : 'user',
        parts,
      };
    })
    .filter(message => message.parts.length > 0);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, systemInstruction, apiKey, model, deepThinkSystemPrompt, sceneStateConfig } = body;

    if (!apiKey) {
      return Response.json({ error: 'API key required' }, { status: 400 });
    }
    if (!Array.isArray(messages)) {
      return Response.json({ error: 'Messages must be an array' }, { status: 400 });
    }

    const historyContents = buildDeepThinkContents(Array.isArray(messages) ? messages : []);
    const enabledIds = sceneStateConfig?.enabledCategories || [];
    const aiInstructions = sceneStateConfig?.aiInstructions || '';

    // Считаем turnIndex по количеству user сообщений
    const turnIndex = historyContents.filter(m => m.role === 'user').length;

    const modelId = (model || 'gemini-2.0-flash').replace('models/', '');
    // Поддерживают ли модели режим размышлений (thinkingConfig)
    const isThinkingModel = modelId.toLowerCase().includes('thinking') || modelId.toLowerCase().includes('thinking-exp');

    // Ограничиваем историю чтобы не упереться в лимит контекста
    const MAX_HISTORY_MESSAGES = 20;
    const limitedHistory = historyContents.slice(-MAX_HISTORY_MESSAGES);

    // Используем DEEPTHINK_PROMPT который включает SCENE_STATE блок
    const historyText = limitedHistory.map(m => {
      const role = m.role === 'model' ? 'Assistant' : 'User';
      const texts = (m.parts || []).filter((p: any) => p.text).map((p: any) => p.text).join(' ');
      return `${role}: ${texts}`;
    }).join('\n\n');

    const requestBody: any = {
      contents: [
        ...limitedHistory,
        {
          role: 'user',
          parts: [{ text: DEEPTHINK_PROMPT(historyText, systemInstruction || '', enabledIds.length > 0 ? enabledIds : undefined, aiInstructions) }],
        },
      ],
      systemInstruction: {
        parts: [{ text: deepThinkSystemPrompt || DEFAULT_DEEPTHINK_SYSTEM }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 16384, // Увеличим лимит для длинных анализов
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
      let errStatus: string | undefined = undefined;
      
      try {
        const errJson = JSON.parse(errBody);
        errMessage = errJson?.error?.message || errMessage;
        errCode = errJson?.error?.code || errCode;
        errStatus = errJson?.error?.status || errStatus;
      } catch {}
      
      console.error(`[DeepThink API Error] Model: ${modelId}, Status: ${errCode}, Message: ${errMessage}`);

      // Классифицируем ошибку и получаем понятное сообщение
      const classified = classifyGeminiError(errCode, errMessage);
      const retryAfterSeconds = extractRetryAfterSeconds(errMessage);
      const displayMessage = classified.userMessage || errMessage;

      // Возвращаем 200 но с ошибкой в потоке, чтобы фронтенд мог это обработать
      return new Response(
        `data: ${JSON.stringify({ 
          error: `DeepThink: ${displayMessage}`,
          originalError: errMessage,
          errorType: classified.errorType,
          errorCode: errCode,
          errorStatus: errStatus,
          retryAfterSeconds
        })}\n\ndata: [DONE]\n\n`,
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
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      try {
        reader = response.body!.getReader();
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
                const msg = parsed.error.message || 'Gemini API error';
                const code = parsed.error.code || 0;
                const classified = classifyGeminiError(code, msg);
                const displayMessage = classified.userMessage || msg;
                
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ 
                    error: displayMessage,
                    originalError: msg,
                    errorType: classified.errorType
                  })}\n\n`)
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

        // Извлекаем SCENE_STATE и системный промпт из текста
        const marker = '---СИСТЕМНЫЙ ПРОМПТ---';
        const idx = textAccumulator.indexOf(marker);
        const enhancedPrompt = idx !== -1
          ? textAccumulator.slice(idx + marker.length).trim()
          : textAccumulator.trim();

        // Парсим SCENE_STATE
        let sceneState: any = null;
        const sceneStateMatch = textAccumulator.match(/---SCENE_STATE---\n([\s\S]*?)---END_SCENE_STATE---/);
        if (sceneStateMatch) {
          try {
            // Попробуем распарсить JSON (иногда он может быть в markdown-блоке)
            let jsonStr = sceneStateMatch[1].trim();
            // Уберём markdown обёртки если есть
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            const entries = JSON.parse(jsonStr);
            if (Array.isArray(entries)) {
              sceneState = {
                entries,
                generatedAt: Date.now(),
                turnIndex,
              };
            }
          } catch (e) {
            console.warn('[DeepThink] Failed to parse SCENE_STATE:', e);
          }
        }

        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ enhancedPrompt, sceneState })}\n\n`)
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
        // Cleanup reader
        if (reader) {
          try { reader.releaseLock(); } catch {}
        }
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

