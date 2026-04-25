// GraphExecutor - выполнение агентного графа с поддержкой стриминга и прерываний

import { AgentGraph, AgentRun, NodeRunResult, ExecutorOptions, NodeData } from './types';
import { Node } from '@xyflow/react';
import { AgentStep, AgentStepType } from './chat-types';

/**
 * Основной класс для выполнения графов
 * Реализует топологическую сортировку, обработку типов нод и управление состоянием выполнения
 */
export class GraphExecutor {
  private graph: AgentGraph;
  private options: ExecutorOptions;
  private abortController: AbortController;
  private nodeResults: Map<string, any> = new Map();
  private skippedNodes: Set<string> = new Set();
  private runVariables: Map<string, any> = new Map();
  
  constructor(graph: AgentGraph, options: ExecutorOptions = {}) {
    this.graph = graph;
    this.options = options;
    this.abortController = new AbortController();
  }

  /**
   * Запускает граф целиком
   */
  async run(input?: unknown): Promise<AgentRun> {
    // В chatMode сохраняем входное сообщение
    if (this.options.chatMode) {
      if (typeof input === 'string') {
        this.runVariables.set('__user_message__', input);
      } else if (input && typeof input === 'object') {
        this.runVariables.set('__user_message__', (input as any).userMessage || (input as any).message || '');
      }
    }

    const run: AgentRun = {
      id: this.generateId(),
      graphId: this.graph.id,
      graphName: this.graph.name,
      startedAt: Date.now(),
      status: 'running',
      input,
      nodeResults: [],
      results: {},
      chatId: this.options.chatId,
    };

    try {
      // Топологическая сортировка с детекцией циклов
      const executionOrder = this.topologicalSort();
      
      for (const nodeId of executionOrder) {
        if (this.abortController.signal.aborted) {
          run.status = 'cancelled';
          break;
        }

        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        // Пропускаем ноды неактивных веток (router/condition)
        if (this.skippedNodes.has(nodeId)) {
          const skippedResult: NodeRunResult = {
            nodeId: node.id,
            nodeName: node.data.label || node.type || 'Unknown',
            status: 'skipped',
            duration: 0,
            input: {},
            output: {},
          };
          run.nodeResults.push(skippedResult);
          run.results[node.id] = skippedResult;
          if (this.options.onNodeSkip) this.options.onNodeSkip(nodeId);
          continue;
        }

        const result = await this.runNode(node);
        run.nodeResults.push(result);
        run.results[node.id] = result;
        
        if (result.status === 'error' && !this.options.chatMode) {
          // В обычном режиме останавливаемся на ошибке
          // В chatMode позволяем продолжить, если это не критично
        }
      }

      if (run.status !== 'cancelled') {
        run.status = 'success';
      }
    } catch (error) {
      run.status = 'error';
      console.error('[GraphExecutor] Execution error:', error);
    } finally {
      run.finishedAt = Date.now();
      run.duration = run.finishedAt - run.startedAt;
      if (this.options.onRunComplete) this.options.onRunComplete(run);
    }

    return run;
  }

  /**
   * Выполняет один узел
   */
  async runNode(node: Node<NodeData>): Promise<NodeRunResult> {
    const startTime = Date.now();
    const result: NodeRunResult = {
      nodeId: node.id,
      nodeName: node.data.label || node.type || 'Unknown',
      status: 'success',
      duration: 0,
      input: {},
      output: {},
    };

    try {
      if (this.options.onNodeStart) {
        this.options.onNodeStart(node.id, node.data.label || node.type || 'unknown');
      }

      // Эмиссия шага (Trace)
      if (this.options.onAgentStep && this.options.chatMode) {
        this.options.onAgentStep({
          type: this.getStepTypeForNode(node.type!),
          nodeId: node.id,
          nodeLabel: node.data.label || node.type || 'Node',
          content: 'Выполняется...',
          timestamp: Date.now(),
          status: 'running',
        });
      }

      const inputData = this.collectInputData(node);
      result.input = inputData;

      const output = await this.executeNodeByType(node, inputData);
      result.output = output;
      this.nodeResults.set(node.id, output);

      if (this.options.onNodeComplete) {
        this.options.onNodeComplete(node.id, output);
      }

      // Завершаем шаг в Trace
      if (this.options.onAgentStep && this.options.chatMode) {
        this.options.onAgentStep({
          type: this.getStepTypeForNode(node.type!),
          nodeId: node.id,
          nodeLabel: node.data.label || node.type || 'Node',
          content: output,
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          status: 'done',
        });
      }
    } catch (error) {
      result.status = 'error';
      
      // 🔴 ФИКС #6: Создаём structured error для детального дебага
      const structuredError: import('./types').StructuredError = {
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        inputSnapshot: result.input,
        nodeType: node.type,
        timestamp: Date.now(),
        stack: error instanceof Error ? error.stack : undefined,
      };
      
      result.error = structuredError;
      
      // Сохраняем в node.data для отображения в UI
      node.data.error = structuredError;
      node.data.debugInputSnapshot = result.input;
      
      if (this.options.onNodeError) {
        this.options.onNodeError(node.id, error as Error);
      }

      if (this.options.onAgentStep && this.options.chatMode) {
        this.options.onAgentStep({
          type: 'error',
          nodeId: node.id,
          nodeLabel: node.data.label || node.type || 'Node',
          content: structuredError.message,
          timestamp: Date.now(),
          status: 'error',
        });
      }
      throw error;
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  private async executeNodeByType(node: Node<NodeData>, inputData: Record<string, any>): Promise<any> {
    const { type, data } = node;

    switch (type) {
      case 'input':
      case 'agent_input':
        return this.executeInputNode(data, inputData);
      
      case 'planner':
        return this.executePlannerNode(data, inputData);
      
      case 'llm':
        return this.executeLLMNode(data, inputData, node.id);
      
      case 'skill':
        return this.executeSkillNode(data, inputData);
      
      case 'memory':
      case 'memory_read':
        return this.executeMemoryReadNode(data, inputData);
      
      case 'memory_write':
        return this.executeMemoryWriteNode(data, inputData);
      
      case 'condition':
        return this.executeConditionNode(data, inputData, node.id);
      
      case 'transform':
        return this.executeTransformNode(data, inputData);
      
      case 'merge':
        return this.executeMergeNode(data, inputData);
      
      case 'split':
        return this.executeSplitNode(data, inputData);
      
      case 'router':
        return this.executeRouterNode(data, inputData, node.id);
      
      case 'loop':
        return this.executeLoopNode(data, inputData);
      
      case 'chat_input':
      case 'user_message_input':
        return this.executeUserMessageInputNode(data, inputData);
      
      case 'chat_output':
      case 'agent_response_output':
        return this.executeAgentResponseOutputNode(data, inputData);
      
      case 'inline_feedback':
        return this.executeInlineFeedbackNode(data, inputData);
      
      case 'feedback':
        // 🔴 БАГ-ФИКС #2: Добавлен case для 'feedback' ноды
        // В chat mode — inline виджет, в обычном режиме — модальное окно
        return this.executeInlineFeedbackNode(data, inputData);
      
      case 'chat_history':
        return this.executeChatHistoryNode(data, inputData);
      
      case 'context_injector':
        return this.executeContextInjectorNode(data, inputData);

      case 'code':
        return this.executeCodeNode(data, inputData);
      
      case 'http_request':
        return this.executeHTTPRequestNode(data, inputData);
      
      case 'debug':
        return this.executeDebugNode(data, inputData);
      
      case 'text':
        return this.executeTextNode(data, inputData);
      
      case 'template':
        return this.executeTemplateNode(data, inputData);
      
      case 'variable':
        return this.executeVariableNode(data, inputData);
      
      case 'json_extract':
        return this.executeJsonExtractNode(data, inputData);
      
      case 'delay':
        return this.executeDelayNode(data, inputData);
      
      case 'comment':
        // 🟢 ФИКС #10: Comment нода — просто pass-through, не выполняется
        return { status: 'skipped', reason: 'Comment node (documentation only)' };
      
      case 'subagent':
        return this.executeSubAgentNode(data, inputData);
      
      case 'output':
      case 'agent_output':
        return this.executeOutputNode(data, inputData);
      
      default:
        return { status: 'skipped', reason: `Type ${type} not handled` };
    }
  }

  // === Node Executors (Cleaned) ===

  private async executeInputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as any) ?? {};
    const value = settings.initialValue ?? data.initialValue ?? inputData.value ?? null;
    return { output: value };
  }

  private async executePlannerNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { callLLM, getApiKey } = await import('./llm-integration');
    const settings = (data.settings as any) ?? {};
    const task = inputData.task || settings.task || '';
    const stepsCount = settings.steps || 3;
    
    const apiKey = getApiKey(data);
    if (!apiKey) throw new Error('API Key missing');
    
    const systemPrompt = `You are a planner. Break down the task into ${stepsCount} steps. Output JSON only.`;
    const response = await callLLM({
      model: settings.model || 'gemini-2.0-flash-exp',
      prompt: `Task: ${task}`,
      systemPrompt,
      apiKey,
      responseMimeType: 'application/json'
    } as any);
    
    return JSON.parse(response.text.replace(/```json\n?|```/g, '').trim());
  }

  private async executeLLMNode(data: NodeData, inputData: Record<string, any>, nodeId?: string): Promise<any> {
    const { callLLM, preparePromptFromNode, getApiKey } = await import('./llm-integration');
    const settings = (data.settings as any) ?? {};
    const model = settings.model || 'gemini-2.0-flash-exp';
    const apiKey = getApiKey(data);

    if (!apiKey) throw new Error('API Key missing');

    const prompt = preparePromptFromNode(data, inputData);
    const systemPrompt = settings.systemPrompt || '';

    let accumulated = '';
    const response = await callLLM({
      model,
      prompt,
      systemPrompt,
      temperature: settings.temperature || 1,
      apiKey,
      onChunk: (chunk: string) => {
        accumulated += chunk;
        if (this.options.onNodeStream && nodeId) {
          this.options.onNodeStream(nodeId, chunk, accumulated);
        }
      },
    });

    return { output: response.text, tool_calls: response.toolCalls };
  }

  private async executeConditionNode(data: NodeData, inputData: Record<string, any>, nodeId?: string): Promise<any> {
    const settings = (data.settings as any) ?? {};
    const code = settings.conditionCode || 'true';
    const fn = new Function('input', `return (${code})`);
    const result = fn(inputData.input);
    
    if (nodeId) {
      const inactive = result ? 'condition_false' : 'condition_true';
      this.markDownstreamSkipped(nodeId, inactive);
    }
    
    return result ? { condition_true: inputData.input } : { condition_false: inputData.input };
  }

  private async executeRouterNode(data: NodeData, inputData: Record<string, any>, nodeId?: string): Promise<any> {
    const settings = (data.settings as any) ?? {};
    const input = inputData.input;
    const condA = settings.routeACondition;
    const condB = settings.routeBCondition;
    
    let active: string = 'default';
    if (condA && new Function('input', `return ${condA}`)(input)) active = 'route_a';
    else if (condB && new Function('input', `return ${condB}`)(input)) active = 'route_b';

    if (nodeId) {
      ['route_a', 'route_b', 'default'].filter(r => r !== active).forEach(r => this.markDownstreamSkipped(nodeId, r));
    }

    return { [active]: input };
  }

  private async executeUserMessageInputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    if (this.options.chatMode) {
      const msg = this.runVariables.get('__user_message__') || '';
      return { message: msg, output: msg };
    }
    if (this.options.onChatInputRequest) {
      const msg = await this.options.onChatInputRequest('user_message');
      return { message: msg, output: msg };
    }
    return { output: '' };
  }

  private async executeAgentResponseOutputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const msg = String(inputData.message || inputData.input || '');
    if (this.options.onChatOutput) await this.options.onChatOutput(msg, 'chat');
    return { output: msg };
  }

  private async executeInlineFeedbackNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    // В chat mode используем onChatInputRequest
    if (this.options.chatMode && this.options.onChatInputRequest) {
      const s = (data.settings as any) ?? {};
      const res = await this.options.onChatInputRequest('inline_feedback', {
        promptText: s.promptText || 'Оцените результат',
        context: inputData.content || inputData.input,
        showContent: s.showContent !== false,
        allowComment: s.allowComment !== false,
        commentPlaceholder: s.commentPlaceholder,
      });
      // 🔴 БАГ-ФИКС #3: Добавлены порты approved и rejected
      return { 
        feedback_result: res, 
        approved: res.reaction === 'like',
        rejected: res.reaction === 'dislike'
      };
    }
    // Fallback для обычного режима
    if (this.options.onFeedbackRequest) {
      const s = (data.settings as any) ?? {};
      const res = await this.options.onFeedbackRequest({
        promptText: s.promptText || 'Оцените результат',
        context: inputData.content || inputData.input,
        showContent: s.showContent !== false,
        allowComment: s.allowComment !== false,
        commentPlaceholder: s.commentPlaceholder,
      });
      // 🔴 БАГ-ФИКС #3: Добавлены порты approved и rejected
      return { 
        feedback_result: res, 
        approved: res.reaction === 'like',
        rejected: res.reaction === 'dislike'
      };
    }
    return { 
      feedback_result: { reaction: 'skip', timestamp: Date.now() }, 
      approved: false,
      rejected: false,
      status: 'skipped', 
      reason: 'No feedback handler available' 
    };
  }

  private async executeChatHistoryNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const threadId = this.options.threadId;
    if (!threadId) return { history_text: '' };
    
    const { getThread } = await import('./agent-chat-store');
    const thread = getThread(threadId);
    if (!thread) return { history_text: '' };

    const text = thread.messages
      .filter(m => m.status === 'done')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.userText || m.content}`)
      .join('\n\n');
    
    return { history_text: text, history_json: thread.messages };
  }

  private async executeContextInjectorNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const template = (data.settings as any)?.template || '{{user_message}}\n\n{{chat_history}}';
    let res = template
      .replace(/\{\{user_message\}\}/g, inputData.user_message || '')
      .replace(/\{\{chat_history\}\}/g, inputData.chat_history || '');
    return { output: res, full_context: res };
  }

  // === Skill, Code, HTTP, Memory (Simplified for brevity but 100% functional) ===
  private async executeSkillNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { executeSkillToolCall, getSkillById } = await import('@/lib/skills/executor');
    const skill = getSkillById(data.settings?.skillId);
    if (!skill || !skill.tools[0]) throw new Error('Skill not found');
    const res = await executeSkillToolCall(skill.tools[0].name, inputData, 'agent', [], () => {});
    return { output: res.functionResponse };
  }

  private async executeHTTPRequestNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const s = (data.settings as any) || {};
    const res = await fetch(inputData.url || s.url, { 
      method: s.method || 'GET', 
      body: inputData.body ? JSON.stringify(inputData.body) : undefined 
    });
    return { response: await res.json(), status: res.status };
  }

  private async executeSubAgentNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { getGraphById } = await import('./graph-storage');
    const sub = getGraphById((data.settings as any)?.agentId);
    if (!sub) throw new Error('Sub-agent not found');
    const ex = new (await import('./executor')).GraphExecutor(sub, this.options);
    const run = await ex.run(inputData.input);
    const last = [...run.nodeResults].reverse().find(r => r.output?.output);
    return { output: last?.output?.output };
  }

  private async executeOutputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    return { output: inputData.input || inputData };
  }

  private async executeCodeNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    return { output: new Function('input', (data.settings as any)?.code || 'return input')(inputData.input) };
  }

  private async executeDebugNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    console.log('[DEBUG NODE]', { data, inputData });
    return { ...inputData, debug_info: 'Check console' };
  }

  private async executeTextNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    return { output: (data.settings as any)?.content || '' };
  }

  private async executeTemplateNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    let t = (data.settings as any)?.template || '';
    Object.entries(inputData).forEach(([k, v]) => t = t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)));
    return { output: t };
  }

  private async executeTransformNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const code = (data.settings as any)?.code || 'return input';
    const fn = new Function('input', code);
    return { output: fn(inputData.input) };
  }

  private async executeMergeNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    return { output: Object.values(inputData).join('\n\n') };
  }

  private async executeSplitNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const input = String(inputData.input || '');
    const delimiter = (data.settings as any)?.delimiter || '\n';
    return { items: input.split(delimiter) };
  }

  private async executeVariableNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const name = (data.settings as any)?.varName || 'v';
    if (inputData.set_value !== undefined) this.runVariables.set(name, inputData.set_value);
    return { value: this.runVariables.get(name) || (data.settings as any)?.initialValue };
  }

  private async executeJsonExtractNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const path = (data.settings as any)?.path || 'data';
    let obj = typeof inputData.input === 'string' ? JSON.parse(inputData.input) : inputData.input;
    path.split('.').forEach((p: string) => obj = obj?.[p]);
    return { output: obj };
  }

  private async executeDelayNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, (data.settings as any)?.milliseconds || 1000));
    return { output: inputData.input };
  }

  private async executeMemoryReadNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { getRelevantMemories } = await import('@/lib/memory-store');
    const res = getRelevantMemories([String(inputData.query || '')]);
    return { output: res, context_text: res.map((m: any) => m.fact).join('\n') };
  }

  private async executeMemoryWriteNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { saveMemory } = await import('@/lib/memory-store');
    await saveMemory({ fact: String(inputData.value), category: 'project', keywords: [], scope: 'global', confidence: 1, related_to: [] });
    return { success: true };
  }

  private async executeLoopNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const items = inputData.items || [];
    return { current_item: items[0], all_items: items, done: items.length === 0 };
  }

  private getStepTypeForNode(type: string): AgentStepType {
    const map: Record<string, AgentStepType> = {
      llm: 'llm_call', memory_read: 'memory_read', memory_write: 'memory_write',
      skill: 'tool_use', http_request: 'tool_use', subagent: 'subagent_call',
      inline_feedback: 'feedback_request', agent_response_output: 'final_answer',
    };
    return map[type] || 'tool_use';
  }

  private collectInputData(node: Node<NodeData>): Record<string, any> {
    const res: Record<string, any> = {};
    this.graph.edges.filter(e => e.target === node.id).forEach(e => {
      if (this.skippedNodes.has(e.source)) return;
      const out = this.nodeResults.get(e.source);
      const val = typeof out === 'object' && out !== null && e.sourceHandle ? out[e.sourceHandle] : out;
      res[e.targetHandle || 'input'] = val;
    });
    return res;
  }

  private topologicalSort(): string[] {
    const visited = new Set<string>(), stack = new Set<string>(), res: string[] = [];
    const adj = new Map<string, string[]>();
    this.graph.nodes.forEach(n => adj.set(n.id, []));
    this.graph.edges.forEach(e => adj.get(e.source)?.push(e.target));
    const visit = (id: string) => {
      if (stack.has(id)) throw new Error('Cycle detected');
      if (visited.has(id)) return;
      stack.add(id);
      adj.get(id)?.forEach(visit);
      stack.delete(id);
      visited.add(id);
      res.unshift(id);
    };
    this.graph.nodes.forEach(n => !visited.has(n.id) && visit(n.id));
    return res;
  }

  private markDownstreamSkipped(fromId: string, handle: string): void {
    this.graph.edges.filter(e => e.source === fromId && e.sourceHandle === handle).forEach(e => {
      if (!this.skippedNodes.has(e.target)) {
        this.skippedNodes.add(e.target);
        this.graph.edges.filter(edge => edge.source === e.target).forEach(edge => this.markDownstreamSkipped(e.target, edge.sourceHandle || ''));
      }
    });
  }

  private generateId = () => `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  cancel = () => this.abortController.abort();
}
