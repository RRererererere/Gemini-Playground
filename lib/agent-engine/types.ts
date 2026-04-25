import { Node, Edge, Viewport } from '@xyflow/react';

// === Agent Graph Types ===

export interface AgentGraph {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  nodes: Node<NodeData>[]; // React Flow nodes with our custom data
  edges: Edge<EdgeData>[]; // React Flow edges with our custom data
  viewport: Viewport;      // last camera position
  chatId?: string;         // если задан — агент "принадлежит" этому чату
  metadata: {
    version: string;
    tags: string[];
    runCount: number;
    lastRunAt?: number;
    published?: boolean;
  };
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  type: string;
  description?: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  settings: Record<string, any>;
  status?: 'idle' | 'running' | 'success' | 'warning' | 'error' | 'disabled' | 'waiting';
  // 🔴 ФИКС #6: error может быть строкой или structured
  error?: string | StructuredError;
  // 🔴 ФИКС #6: debug snapshot для отображения в ноде
  debugInputSnapshot?: Record<string, unknown>;
}

export interface EdgeData extends Record<string, unknown> {
  type: string;
  sourceType: string;
  targetType: string;
}

// === Execution Types ===

export interface AgentRun {
  id: string;
  graphId: string;
  graphName: string;
  startedAt: number;
  finishedAt?: number;
  status: 'running' | 'success' | 'error' | 'cancelled';
  duration?: number;
  input?: unknown;
  output?: unknown;
  nodeResults: NodeRunResult[];
  results: Record<string, NodeRunResult>; // Для удобного доступа по ID
  chatId?: string; // If launched from chat
}

export interface NodeRunResult {
  nodeId: string;
  nodeName: string;
  status: 'success' | 'error' | 'skipped';
  duration: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  // 🔴 ФИКС #6: Structured Error
  error?: string | StructuredError;
}

// 🔴 ФИКС #6: Structured Error для детального дебага
export interface StructuredError {
  message: string;
  type: string;              // TypeError, NetworkError, ValidationError
  inputSnapshot?: Record<string, unknown>;  // что было на входных портах
  nodeType?: string;         // тип ноды где произошла ошибка
  timestamp: number;
  stack?: string;            // stack trace
}

// Options for the GraphExecutor
export interface ExecutorOptions {
  chatId?: string;
  // Chat mode (NEW)
  chatMode?: boolean;            // включить агентный режим
  threadId?: string;             // ID текущего AgentChatThread
  onAgentStep?: (step: import('./chat-types').AgentStep) => void;  // callback для шагов
  onFeedbackRequest?: (req: import('./chat-types').FeedbackRequest) => Promise<import('./chat-types').FeedbackResponse>;
  // Existing callbacks
  onNodeStart?: (nodeId: string, nodeName: string) => void;
  onNodeComplete?: (nodeId: string, result: unknown) => void;
  onNodeError?: (nodeId: string, error: Error) => void;
  onNodeSkip?: (nodeId: string) => void;   // BUG-09: callback для пропущенных нод
  onRunComplete?: (run: AgentRun) => void;
  // Стриминг LLM-ответов в реальном времени
  onNodeStream?: (nodeId: string, chunk: string, accumulated: string) => void;
  // BUG-02: callback для получения сообщения из чата / feedback
  onChatInputRequest?: (source: string, options?: Record<string, any>) => Promise<any>;
  // BUG-03: callback для отправки сообщения в чат
  onChatOutput?: (message: string, target: string) => Promise<void>;
}
