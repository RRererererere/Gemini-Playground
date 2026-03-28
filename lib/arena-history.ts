import type { Message, Part } from '@/types';
import type { ArenaAgent } from './arena-types';
import { getVisibleMessageText } from './gemini';

/**
 * Для агента agentId строим историю в формате Gemini API.
 *
 * - Сообщения ОТ agentId → role: 'model'
 * - ВСЕ остальные (user + другие агенты) → role: 'user'
 *   (подряд идущие склеиваются в одно user-сообщение с префиксами имён)
 */
export function buildAgentHistory(
  messages: Message[],
  agentId: string,
  agents: ArenaAgent[]
): Message[] {
  if (messages.length === 0) return [];

  const agentMap = new Map(agents.map(a => [a.id, a]));
  const result: Message[] = [];
  
  // Буфер для склейки consecutive user/other-agent messages
  let pendingUserParts: Part[] = [];

  const flushPending = () => {
    if (pendingUserParts.length > 0) {
      result.push({
        id: `synth-${result.length}`,
        role: 'user',
        parts: [...pendingUserParts],
      });
      pendingUserParts = [];
    }
  };

  for (const msg of messages) {
    if (msg.role === 'model' && msg.arenaAgentId === agentId) {
      // Это сообщение ОТ нашего агента — role: 'model'
      flushPending();
      result.push({
        id: msg.id,
        role: 'model',
        parts: msg.parts,
      });
    } else if (msg.role === 'user') {
      // Обычное user-сообщение
      const text = getVisibleMessageText(msg.parts);
      if (text) {
        pendingUserParts.push({ text: `[Пользователь]: ${text}` });
      }
      // Добавляем файлы/инлайн-данные если есть
      for (const part of msg.parts) {
        if ('inlineData' in part) {
          pendingUserParts.push(part);
        }
      }
    } else if (msg.role === 'model' && msg.arenaAgentId && msg.arenaAgentId !== agentId) {
      // Сообщение другого агента — склеиваем как user
      const otherAgent = agentMap.get(msg.arenaAgentId);
      const prefix = otherAgent ? `[${otherAgent.name}]` : '[Другой участник]';
      const text = getVisibleMessageText(msg.parts);
      if (text) {
        pendingUserParts.push({ text: `${prefix}: ${text}` });
      }
    }
  }
  
  flushPending();

  // Gemini API требует чередования user/model.  
  // Если два подряд user — склеиваем их parts.
  const merged: Message[] = [];
  for (const m of result) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      // Склеиваем
      last.parts = [...last.parts, ...m.parts];
    } else {
      merged.push({ ...m });
    }
  }

  return merged;
}
