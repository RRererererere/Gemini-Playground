/**
 * Типы данных для агентного чата
 * Версия 1.0 — Апрель 2025
 */

// ============================================================================
// AGENT CHAT CONFIG
// ============================================================================

export interface AgentChatConfig {
  id: string;                    // nanoid(8) — уникальный ID конфига
  graphId: string;               // ID графа (AgentGraph.id)
  name: string;                  // Отображаемое имя
  description: string;           // Краткое описание для карточки
  avatarEmoji: string;           // Аватар в чате (по умолчанию 🤖)
  avatarColor: string;           // Цвет аватара (hex)
  isPublished: boolean;          // Флаг видимости в разделе Агенты
  threadIds: string[];           // Список ID AgentChatThread
  createdAt: number;             // Timestamp создания
  updatedAt: number;             // Timestamp обновления
}

// ============================================================================
// AGENT CHAT THREAD
// ============================================================================

export interface AgentChatThread {
  id: string;                    // nanoid(8)
  agentConfigId: string;         // Ссылка на AgentChatConfig
  graphId: string;               // Копия graphId (для быстрого доступа)
  title: string;                 // Авто-генерируется из первого сообщения
  messages: AgentChatMessage[];  // История сообщений
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
  status: 'idle' | 'running' | 'error'; // Текущий статус выполнения
}

// ============================================================================
// AGENT CHAT MESSAGE
// ============================================================================

export interface AgentChatMessage {
  id: string;                    // Уникальный ID
  role: 'user' | 'agent';        // Отправитель
  content: string;               // Финальный текст ответа (только для role=agent)
  userText?: string;             // Текст пользователя (role=user)
  steps: AgentStep[];            // Все шаги выполнения (для role=agent)
  timestamp: number;             // Время отправки
  status: 'pending' | 'streaming' | 'done' | 'error'; // Статус генерации
  feedbackRequest?: FeedbackRequest; // Данные для inline-запроса обратной связи
}

// ============================================================================
// AGENT STEP
// ============================================================================

export type AgentStepType =
  | 'thinking'           // размышления LLM
  | 'llm_call'          // вызов LLM
  | 'tool_use'          // вызов внешнего инструмента/HTTP
  | 'memory_read'       // чтение из памяти
  | 'memory_write'      // запись в память
  | 'subagent_call'     // запуск саб-агента
  | 'feedback_request'  // запрос обратной связи от пользователя
  | 'final_answer'      // финальный ответ агента
  | 'error';            // ошибка в ноде

export interface AgentStep {
  type: AgentStepType;           // Тип шага
  nodeId: string;                // ID ноды-источника
  nodeLabel: string;             // Человекочитаемое имя ноды
  content: string | object;      // Данные шага
  timestamp: number;             // Время
  duration?: number;             // Длительность в ms
  status: 'running' | 'done' | 'error'; // Статус шага
}

// ============================================================================
// FEEDBACK REQUEST
// ============================================================================

export interface FeedbackRequest {
  promptText: string;            // Вопрос для пользователя
  context: any;                  // Данные для оценки
  showContent: boolean;          // Показывать ли content
  allowComment: boolean;         // Показывать ли текстовое поле
  commentPlaceholder?: string;   // Placeholder для комментария
}

export interface FeedbackResponse {
  reaction: 'like' | 'dislike' | 'skip'; // Реакция пользователя
  comment?: string;              // Комментарий (опционально)
  timestamp: number;             // Время ответа
}
