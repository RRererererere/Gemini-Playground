// Agent Templates - предустановленные шаблоны агентов

import { AgentGraph } from './types';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'advanced' | 'specialized';
  icon: string;
  graph: Omit<AgentGraph, 'id' | 'createdAt' | 'updatedAt'>;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'empty',
    name: 'Пустой агент',
    description: 'Начать с чистого листа',
    category: 'basic',
    icon: '📄',
    graph: {
      name: 'Новый агент',
      description: '',
      nodes: [
        {
          id: 'input_1',
          type: 'input',
          position: { x: 100, y: 200 },
          data: { label: 'Вход', type: 'input', inputs: {}, outputs: {}, settings: {} },
        },
        {
          id: 'output_1',
          type: 'output',
          position: { x: 600, y: 200 },
          data: { label: 'Выход', type: 'output', inputs: {}, outputs: {}, settings: {} },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: {
        version: '1.0.0',
        tags: [],
        runCount: 0,
      },
    },
  },
  {
    id: 'simple_chat',
    name: 'Простой чат-ассистент',
    description: 'Базовый чат-агент с LLM',
    category: 'basic',
    icon: '💬',
    graph: {
      name: 'Чат-ассистент',
      description: 'Простой разговорный агент',
      nodes: [
        {
          id: 'input_1',
          type: 'input',
          position: { x: 100, y: 200 },
          data: { 
            label: 'Ввод пользователя', 
            type: 'input', 
            inputs: {}, 
            outputs: {}, 
            settings: {} 
          },
        },
        {
          id: 'llm_1',
          type: 'llm',
          position: { x: 350, y: 200 },
          data: { 
            label: 'LLM', 
            type: 'llm', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              model: 'gemini-2.0-flash-exp',
              systemPrompt: 'Ты полезный ассистент. Будь кратким и дружелюбным.',
              temperature: 1.0,
            } 
          },
        },
        {
          id: 'output_1',
          type: 'output',
          position: { x: 600, y: 200 },
          data: { 
            label: 'Ответ', 
            type: 'output', 
            inputs: {}, 
            outputs: {}, 
            settings: {} 
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'input_1', target: 'llm_1', sourceHandle: null, targetHandle: null },
        { id: 'e2', source: 'llm_1', target: 'output_1', sourceHandle: null, targetHandle: null },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      metadata: {
        version: '1.0.0',
        tags: ['chat', 'basic'],
        runCount: 0,
      },
    },
  },
  {
    id: 'chat_with_memory',
    name: 'Чат с историей',
    description: 'LLM с сохранением и подачей истории диалога',
    category: 'basic',
    icon: '💬',
    graph: {
      name: 'Чат с памятью',
      description: 'Агент с сохранением истории диалога',
      nodes: [
        {
          id: 'input_1',
          type: 'input',
          position: { x: 100, y: 200 },
          data: { label: 'Вопрос', type: 'input', inputs: {}, outputs: {}, settings: {} },
        },
        {
          id: 'history_1',
          type: 'chat_history',
          position: { x: 300, y: 200 },
          data: { 
            label: 'История (read+append)', 
            type: 'chat_history', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              storeId: 'dialog',
              operation: 'read_and_append',
              writeRole: 'user',
            } 
          },
        },
        {
          id: 'llm_1',
          type: 'llm',
          position: { x: 550, y: 200 },
          data: { 
            label: 'LLM', 
            type: 'llm', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              model: 'gemini-2.0-flash-exp',
              systemPrompt: 'Ты дружелюбный ассистент. Используй контекст истории.',
              temperature: 0.8,
            } 
          },
        },
        {
          id: 'history_2',
          type: 'chat_history',
          position: { x: 800, y: 200 },
          data: { 
            label: 'Сохранить ответ', 
            type: 'chat_history', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              storeId: 'dialog',
              operation: 'append',
              writeRole: 'assistant',
            } 
          },
        },
        {
          id: 'output_1',
          type: 'output',
          position: { x: 1050, y: 200 },
          data: { label: 'Ответ', type: 'output', inputs: {}, outputs: {}, settings: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 'input_1', target: 'history_1', sourceHandle: 'output', targetHandle: 'message' },
        { id: 'e2', source: 'history_1', target: 'llm_1', sourceHandle: 'text', targetHandle: 'input' },
        { id: 'e3', source: 'llm_1', target: 'history_2', sourceHandle: 'output', targetHandle: 'message' },
        { id: 'e4', source: 'llm_1', target: 'output_1', sourceHandle: 'output', targetHandle: 'input' },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
      metadata: {
        version: '1.0.0',
        tags: ['chat', 'history', 'memory'],
        runCount: 0,
      },
    },
  },
  {
    id: 'rag_pipeline',
    name: 'RAG Pipeline',
    description: 'Retrieval-Augmented Generation with memory',
    category: 'advanced',
    icon: '🔍',
    graph: {
      name: 'RAG Agent',
      description: 'Search memory and generate response',
      nodes: [
        {
          id: 'input_1',
          type: 'agent_input',
          position: { x: 100, y: 200 },
          data: { label: 'Query', type: 'agent_input', inputs: {}, outputs: {}, settings: {} },
        },
        {
          id: 'memory_1',
          type: 'memory_read',
          position: { x: 300, y: 150 },
          data: { 
            label: 'Search Memory', 
            type: 'memory_read', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              operation: 'search',
              limit: 5,
            } 
          },
        },
        {
          id: 'merge_1',
          type: 'merge',
          position: { x: 500, y: 200 },
          data: { 
            label: 'Merge Context', 
            type: 'merge', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              mergeMode: 'concat_text',
              separator: '\n\n',
            } 
          },
        },
        {
          id: 'llm_1',
          type: 'llm',
          position: { x: 700, y: 200 },
          data: { 
            label: 'Generate Answer', 
            type: 'llm', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              model: 'gemini-2.0-flash-exp',
              systemPrompt: 'Answer based on the provided context. If context is not relevant, say so.',
              temperature: 0.7,
            } 
          },
        },
        {
          id: 'output_1',
          type: 'agent_output',
          position: { x: 950, y: 200 },
          data: { label: 'Answer', type: 'agent_output', inputs: {}, outputs: {}, settings: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 'input_1', target: 'memory_1', sourceHandle: null, targetHandle: null },
        { id: 'e2', source: 'input_1', target: 'merge_1', sourceHandle: null, targetHandle: null },
        { id: 'e3', source: 'memory_1', target: 'merge_1', sourceHandle: null, targetHandle: null },
        { id: 'e4', source: 'merge_1', target: 'llm_1', sourceHandle: null, targetHandle: null },
        { id: 'e5', source: 'llm_1', target: 'output_1', sourceHandle: null, targetHandle: null },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
      metadata: {
        version: '1.0.0',
        tags: ['rag', 'memory', 'advanced'],
        runCount: 0,
      },
    },
  },
  {
    id: 'research_agent',
    name: 'Research Agent',
    description: 'Multi-step research with memory storage',
    category: 'specialized',
    icon: '🔬',
    graph: {
      name: 'Research Agent',
      description: 'Research topic and save findings',
      nodes: [
        {
          id: 'input_1',
          type: 'agent_input',
          position: { x: 100, y: 250 },
          data: { label: 'Research Topic', type: 'agent_input', inputs: {}, outputs: {}, settings: {} },
        },
        {
          id: 'llm_1',
          type: 'llm',
          position: { x: 300, y: 150 },
          data: { 
            label: 'Generate Questions', 
            type: 'llm', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              model: 'gemini-2.0-flash-exp',
              systemPrompt: 'Generate 3 research questions about the topic.',
              temperature: 0.8,
            } 
          },
        },
        {
          id: 'llm_2',
          type: 'llm',
          position: { x: 300, y: 350 },
          data: { 
            label: 'Research Answers', 
            type: 'llm', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              model: 'gemini-2.0-flash-exp',
              systemPrompt: 'Provide detailed answers to the research questions.',
              temperature: 0.7,
            } 
          },
        },
        {
          id: 'memory_1',
          type: 'memory_write',
          position: { x: 550, y: 250 },
          data: { 
            label: 'Save Findings', 
            type: 'memory_write', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              operation: 'save',
              category: 'technical',
            } 
          },
        },
        {
          id: 'output_1',
          type: 'agent_output',
          position: { x: 750, y: 250 },
          data: { label: 'Research Report', type: 'agent_output', inputs: {}, outputs: {}, settings: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 'input_1', target: 'llm_1', sourceHandle: null, targetHandle: null },
        { id: 'e2', source: 'llm_1', target: 'llm_2', sourceHandle: null, targetHandle: null },
        { id: 'e3', source: 'llm_2', target: 'memory_1', sourceHandle: null, targetHandle: null },
        { id: 'e4', source: 'memory_1', target: 'output_1', sourceHandle: null, targetHandle: null },
      ],
      viewport: { x: 0, y: 0, zoom: 0.9 },
      metadata: {
        version: '1.0.0',
        tags: ['research', 'memory', 'multi-step'],
        runCount: 0,
      },
    },
  },
  {
    id: 'code_review',
    name: 'Code Review Bot',
    description: 'Analyze code and provide feedback',
    category: 'specialized',
    icon: '👨‍💻',
    graph: {
      name: 'Code Reviewer',
      description: 'Review code and suggest improvements',
      nodes: [
        {
          id: 'input_1',
          type: 'agent_input',
          position: { x: 100, y: 200 },
          data: { label: 'Code Input', type: 'agent_input', inputs: {}, outputs: {}, settings: {} },
        },
        {
          id: 'llm_1',
          type: 'llm',
          position: { x: 350, y: 100 },
          data: { 
            label: 'Analyze Code', 
            type: 'llm', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              model: 'gemini-2.0-flash-exp',
              systemPrompt: 'You are an expert code reviewer. Analyze the code for bugs, performance issues, and best practices.',
              temperature: 0.3,
            } 
          },
        },
        {
          id: 'llm_2',
          type: 'llm',
          position: { x: 350, y: 300 },
          data: { 
            label: 'Suggest Improvements', 
            type: 'llm', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              model: 'gemini-2.0-flash-exp',
              systemPrompt: 'Suggest specific improvements and refactoring opportunities.',
              temperature: 0.5,
            } 
          },
        },
        {
          id: 'merge_1',
          type: 'merge',
          position: { x: 600, y: 200 },
          data: { 
            label: 'Combine Feedback', 
            type: 'merge', 
            inputs: {}, 
            outputs: {}, 
            settings: {
              mergeMode: 'concat_text',
            } 
          },
        },
        {
          id: 'output_1',
          type: 'agent_output',
          position: { x: 800, y: 200 },
          data: { label: 'Review Report', type: 'agent_output', inputs: {}, outputs: {}, settings: {} },
        },
      ],
      edges: [
        { id: 'e1', source: 'input_1', target: 'llm_1', sourceHandle: null, targetHandle: null },
        { id: 'e2', source: 'input_1', target: 'llm_2', sourceHandle: null, targetHandle: null },
        { id: 'e3', source: 'llm_1', target: 'merge_1', sourceHandle: null, targetHandle: null },
        { id: 'e4', source: 'llm_2', target: 'merge_1', sourceHandle: null, targetHandle: null },
        { id: 'e5', source: 'merge_1', target: 'output_1', sourceHandle: null, targetHandle: null },
      ],
      viewport: { x: 0, y: 0, zoom: 0.85 },
      metadata: {
        version: '1.0.0',
        tags: ['code', 'review', 'specialized'],
        runCount: 0,
      },
    },
  },
];

/**
 * Создать граф из шаблона
 */
export function createGraphFromTemplate(templateId: string, customName?: string): AgentGraph {
  const template = AGENT_TEMPLATES.find(t => t.id === templateId);
  
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const now = Date.now();
  
  return {
    ...template.graph,
    id: `graph_${now}_${Math.random().toString(36).substr(2, 9)}`,
    name: customName || template.graph.name,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Получить шаблоны по категории
 */
export function getTemplatesByCategory(category: AgentTemplate['category']): AgentTemplate[] {
  return AGENT_TEMPLATES.filter(t => t.category === category);
}
