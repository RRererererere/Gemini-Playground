import type { Message, Part, ApiKeyEntry, Provider } from '@/types';
import type { ArenaAgent, ArenaSession } from './arena-types';
import { buildAgentHistory } from './arena-history';
import { buildChatRequestMessages } from './gemini';

function buildArenaSystemPrompt(agent: ArenaAgent, session: ArenaSession): string {
  const otherAgents = session.agents
    .filter(a => a.id !== agent.id && a.isActive);
  
  const otherDescriptions = otherAgents
    .map(a => `• ${a.name}`)
    .join('\n');

  const header = `[ARENA — ГРУППОВОЕ ОБСУЖДЕНИЕ]
Ты — ${agent.name}. Это мультиагентная дискуссия.

${otherAgents.length > 0 ? `Другие участники:\n${otherDescriptions}\n` : ''}Правила:
- Отвечай от своего лица как ${agent.name}.
- Ты ВИДИШЬ сообщения других участников — они помечены как [${otherAgents.map(a => a.name).join('], [')}].
- Реагируй на то, что сказали другие. Соглашайся, спорь или дополняй.
- Не повторяй уже сказанное. Будь кратким и конструктивным.
- Обращайся к другим участникам по имени.
[/ARENA]

`;

  const customPrompt = session.systemPrompt 
    ? `[ОБЩИЕ ПРАВИЛА АРЕНЫ]\n${session.systemPrompt}\n[/ОБЩИЕ ПРАВИЛА АРЕНЫ]\n\n`
    : '';

  return header + customPrompt + (agent.systemPrompt || '');
}

export async function streamArenaAgent(params: {
  agent: ArenaAgent;
  session: ArenaSession;
  messages: Message[];
  globalApiKeys: Record<string, ApiKeyEntry[]>;
  providers: Provider[];
  targetMessageId: string;
  onChunk: (text: string) => void;
  onDone: (parts: Part[], thinking?: string) => void;
  onError: (error: string, type?: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { agent, session, messages, globalApiKeys, providers, targetMessageId, onChunk, onDone, onError, signal } = params;

  // Провайдер агента
  const providerId = agent.providerId || 'google';
  const provider = providers.find(p => p.id === providerId);
  if (!provider) {
    onError('Провайдер не найден');
    return;
  }

  // Определяем API ключ
  let apiKey = agent.apiKey;
  if (!apiKey) {
    // Используем первый доступный из глобального пула для этого провайдера
    const pool = globalApiKeys[providerId] || [];
    const available = pool.find(k => k.key);
    if (!available) {
      onError(`Нет доступного ключа для ${provider.name}. Добавьте в настройках.`, 'invalid_key');
      return;
    }
    apiKey = available.key;
  }

  // Определяем модель
  const modelName = agent.model || '';
  if (!modelName) {
    onError('Модель не выбрана. Укажите модель у агента или в глобальных настройках.');
    return;
  }

  // Строим историю для этого агента
  const agentHistory = buildAgentHistory(messages, agent.id, session.agents);
  const systemPrompt = buildArenaSystemPrompt(agent, session);

  // Строим contents для API
  const contentsForRequest = buildChatRequestMessages(agentHistory);

  try {
    const endpoint = provider.type === 'openai' ? '/api/openai-chat' : '/api/chat';
    const requestBody: any = {
      messages: contentsForRequest,
      model: modelName,
      systemInstruction: systemPrompt,
      tools: [],
      memoryTools: [],
      temperature: agent.temperature,
      apiKey,
      maxOutputTokens: agent.maxOutputTokens,
      includeThoughts: agent.deepThinkEnabled,
    };
    if (provider.type === 'openai') {
      requestBody.baseUrl = provider.baseUrl;
    } else {
      requestBody.thinkingBudget = agent.deepThinkEnabled ? -1 : 0; // -1 = auto
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      onError(`API error: ${response.status}`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    let accumulatedThinking = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);

          if (parsed.error) {
            onError(String(parsed.error), parsed.errorType);
            return;
          }

          if (parsed.isBlocked) {
            onError(`Ответ заблокирован: ${parsed.finishReason || 'safety'}`, 'bad_request');
            return;
          }

          if (parsed.thinking) {
            accumulatedThinking += parsed.thinking;
          }

          if (parsed.text) {
            accumulatedText += parsed.text;
            onChunk(parsed.text);
          }
        } catch {}
      }
    }

    const parts: Part[] = accumulatedText ? [{ text: accumulatedText }] : [];
    onDone(parts, accumulatedThinking || undefined);
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      onError(e.message || 'Ошибка стриминга');
    }
  }
}
