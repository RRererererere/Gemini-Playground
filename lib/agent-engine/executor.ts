// GraphExecutor - выполняет агентный граф

import { AgentGraph, AgentRun, NodeRunResult, ExecutorOptions, NodeData } from './types';
import { Node, Edge } from '@xyflow/react';

export class GraphExecutor {
  private graph: AgentGraph;
  private options: ExecutorOptions;
  private abortController: AbortController;
  private nodeResults: Map<string, any> = new Map();
  
  constructor(graph: AgentGraph, options: ExecutorOptions = {}) {
    this.graph = graph;
    this.options = options;
    this.abortController = new AbortController();
  }

  /**
   * Запускает граф целиком
   */
  async run(input?: unknown): Promise<AgentRun> {
    const run: AgentRun = {
      id: this.generateId(),
      graphId: this.graph.id,
      graphName: this.graph.name,
      startedAt: Date.now(),
      status: 'running',
      input,
      nodeResults: [],
      chatId: this.options.chatId,
    };

    try {
      // Топологическая сортировка
      const executionOrder = this.topologicalSort();
      
      // Выполняем узлы по порядку
      for (const nodeId of executionOrder) {
        if (this.abortController.signal.aborted) {
          run.status = 'cancelled';
          break;
        }

        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        const result = await this.runNode(node);
        run.nodeResults.push(result);
      }

      if (run.status !== 'cancelled') {
        run.status = 'success';
      }
    } catch (error) {
      run.status = 'error';
      console.error('Graph execution error:', error);
    } finally {
      run.finishedAt = Date.now();
      run.duration = run.finishedAt - run.startedAt;
      
      if (this.options.onRunComplete) {
        this.options.onRunComplete(run);
      }
    }

    return run;
  }

  /**
   * Запускает один узел изолированно (для тестирования)
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
        this.options.onNodeStart(node.id);
      }

      // Собираем входные данные из предыдущих узлов
      const inputData = this.collectInputData(node);
      result.input = inputData;

      // Выполняем узел в зависимости от типа
      const output = await this.executeNodeByType(node, inputData);
      result.output = output;

      // Сохраняем результат для следующих узлов
      this.nodeResults.set(node.id, output);

      if (this.options.onNodeComplete) {
        this.options.onNodeComplete(node.id, output);
      }
    } catch (error) {
      result.status = 'error';
      result.error = error instanceof Error ? error.message : String(error);
      
      if (this.options.onNodeError) {
        this.options.onNodeError(node.id, error as Error);
      }
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Выполняет узел в зависимости от его типа
   */
  private async executeNodeByType(node: Node<NodeData>, inputData: Record<string, any>): Promise<any> {
    const { type, data } = node;

    switch (type) {
      case 'input':
      case 'agent_input':
        return this.executeInputNode(data, inputData);
      
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
        return this.executeConditionNode(data, inputData);
      
      case 'transform':
        return this.executeTransformNode(data, inputData);
      
      case 'merge':
        return this.executeMergeNode(data, inputData);
      
      case 'split':
        return this.executeSplitNode(data, inputData);
      
      case 'router':
        return this.executeRouterNode(data, inputData);
      
      case 'loop':
        return this.executeLoopNode(data, inputData);
      
      case 'chat_input':
        return this.executeChatInputNode(data, inputData);
      
      case 'chat_output':
        return this.executeChatOutputNode(data, inputData);
      
      case 'chat_history':
        return this.executeChatHistoryNode(data, inputData);
      
      case 'code':
        return this.executeCodeNode(data, inputData);
      
      case 'http_request':
        return this.executeHTTPRequestNode(data, inputData);
      
      case 'debug':
        return this.executeDebugNode(data, inputData);
      
      case 'text':
        return this.executeTextNode(data, inputData);
      
      case 'output':
      case 'agent_output':
        return this.executeOutputNode(data, inputData);
      
      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }

  // === Node Executors ===

  private async executeInputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    // Input node возвращает начальные данные через output порт
    const initialValue = data.initialValue || data.defaultValue || inputData.value || null;
    
    // Пытаемся распарсить JSON если это строка
    let value = initialValue;
    if (typeof initialValue === 'string') {
      try {
        value = JSON.parse(initialValue);
      } catch {
        value = initialValue;
      }
    }
    
    return { output: value };
  }

  private async executeLLMNode(data: NodeData, inputData: Record<string, any>, nodeId?: string): Promise<any> {
    const { callLLM, preparePromptFromNode, getApiKey } = await import('./llm-integration');
    
    const model = data.settings?.model || data.model || 'gemini-2.0-flash-exp';
    const systemPrompt = inputData.prompt || data.settings?.systemPrompt || '';
    const temperature = data.settings?.temperature || 1.0;
    const maxTokens = data.settings?.maxTokens || 8192;
    
    console.log('[executeLLMNode] data.settings:', data.settings);
    console.log('[executeLLMNode] apiKeyIndex:', data.settings?.apiKeyIndex);
    
    const apiKey = getApiKey(data);
    console.log('[executeLLMNode] resolved apiKey:', apiKey ? apiKey.substring(0, 8) + '...' : 'undefined');

    if (!apiKey) {
      return {
        output: null,
        error: 'API key not configured. Please add an API key in settings.'
      };
    }

    try {
      // Подготовка промпта с подстановкой переменных
      const userMessage = inputData.input || inputData.value || '';
      const contextData = inputData.context || {};
      const prompt = preparePromptFromNode(data, { ...inputData, user_message: userMessage, ...contextData });

      // Поддержка изображений из image_input ноды
      const imageData = inputData.image_data || inputData.image;
      let parts: any[] | undefined;
      if (imageData || (prompt || userMessage)) {
        parts = [];
        if (prompt || userMessage) parts.push({ text: prompt || userMessage });
        if (imageData && typeof imageData === 'string') {
          if (imageData.startsWith('data:')) {
            const [mimeAndEncoding, b64data] = imageData.split(',');
            const mimeType = mimeAndEncoding.replace('data:', '').replace(';base64', '');
            parts.push({ inlineData: { mimeType, data: b64data } });
          }
        }
      }

      // Стриминг — обновляем UI чанками
      let streamedText = '';

      // Вызов LLM
      const response = await callLLM({
        model,
        prompt: prompt || userMessage,
        systemPrompt,
        temperature,
        maxTokens,
        apiKey,
        parts,
        onChunk: (chunk: string) => {
          streamedText += chunk;
          if (this.options.onNodeStream && nodeId) {
            this.options.onNodeStream(nodeId, chunk, streamedText);
          }
        },
      });

      if (response.error) {
        return {
          output: null,
          error: response.error
        };
      }

      return {
        output: response.text,
        error: null
      };
    } catch (error) {
      return {
        output: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async executeSkillNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { executeSkillToolCall, getSkillById } = await import('@/lib/skills/executor');
    
    const skillId = data.settings?.skillId || data.skillId;
    
    if (!skillId) {
      return {
        output: null,
        error: 'No skill selected'
      };
    }

    const skill = getSkillById(skillId);
    if (!skill) {
      return {
        output: null,
        error: `Skill not found: ${skillId}`
      };
    }

    // Берём первый tool скилла
    const tool = skill.tools[0];
    if (!tool) {
      return {
        output: null,
        error: `Skill ${skillId} has no tools`
      };
    }

    try {
      // Подготовка аргументов из входных данных
      const args: Record<string, unknown> = {};
      
      // Маппинг входных портов на параметры tool
      for (const [key, value] of Object.entries(inputData)) {
        args[key] = value;
      }

      // UI events collector
      const uiEvents: any[] = [];
      const onUIEvent = (event: any) => {
        uiEvents.push(event);
      };

      // Выполнение скилла
      const result = await executeSkillToolCall(
        tool.name,
        args,
        'agent_execution', // chatId для агентов
        [], // messages - пустой массив для агентов
        onUIEvent
      );

      return {
        output: result.functionResponse,
        error: null
      };
    } catch (error) {
      return {
        output: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async executeMemoryNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { saveMemory, getMemories, getRelevantMemories } = await import('@/lib/memory-store');
    
    const operation = data.settings?.operation || data.operation || 'save';
    
    if (operation === 'save') {
      const content = inputData.value || inputData.content || inputData.input || '';
      const category = (data.settings?.category || 'context') as any;
      const keywords = data.settings?.tags || [];
      
      try {
        const entry = await saveMemory({
          fact: String(content),
          category: category,
          keywords: Array.isArray(keywords) ? keywords : [],
          scope: 'global',
          confidence: 0.8,
          related_to: [],
        });
        
        return {
          success: true,
          output: entry
        };
      } catch (error) {
        return {
          success: false,
          output: null
        };
      }
    }
    
    if (operation === 'search') {
      const query = inputData.query || inputData.value || inputData.input || '';
      
      const results = getRelevantMemories([String(query)]);
      
      return {
        output: results,
        found: results.length > 0
      };
    }
    
    // Default: return all memories
    const memories = getMemories('global');
    return {
      output: memories,
      found: memories.length > 0
    };
  }

  private async executeConditionNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    // conditionCode: сначала из settings, потом из inputData.condition, потом из корня даты
    const conditionCode = String(
      inputData.condition ||
      (data.settings as any)?.conditionCode ||
      data.conditionCode ||
      'true'
    );
    
    try {
      // Безопасное выполнение условия
      const fn = new Function('context', 'input', `"use strict"; return (${conditionCode});`);
      const condResult = fn(inputData, inputData.input);
      
      // Ключи ДОЛЖНЫ совпадать с portId в NodeDef:
      // outputs: [ {id: 'condition_true'}, {id: 'condition_false'} ]
      return condResult
        ? { condition_true: inputData.input, condition_false: null }
        : { condition_true: null, condition_false: inputData.input };
    } catch (error) {
      return {
        condition_true: null,
        condition_false: null,
        error: `Condition evaluation failed: ${error}`
      };
    }
  }

  private async executeTransformNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    // Правильный путь — из settings, не из корня data
    const settings = (data.settings as Record<string, any>) || {};
    const transformType = settings.transformType || (data as any).transformType || 'js_expression';
    const expression = String(settings.expression || (data as any).expression || 'return input;');
    
    try {
      const fn = new Function('input', expression);
      const result = fn(inputData.input);
      return {
        output: result,
        error: null
      };
    } catch (error) {
      return {
        output: null,
        error: `Transform failed: ${error}`
      };
    }
  }

  private async executeMergeNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const mode = settings.mergeMode ?? 'merge_objects';
    
    // Собираем все входы (input_a, input_b, input_c)
    const inputs = [
      inputData.input_a,
      inputData.input_b,
      inputData.input_c
    ].filter(v => v !== undefined && v !== null);
    
    switch (mode) {
      case 'concat_text':
        const sep = String(settings.separator ?? '\n');
        const values = inputs.map(v => String(v));
        return { output: values.join(sep) };
      
      case 'merge_objects':
        return { output: Object.assign({}, ...inputs) };
      
      case 'array_collect':
        return { output: inputs };
      
      case 'first_non_null':
        return { output: inputs[0] || null };
      
      default:
        return { output: inputs };
    }
  }

  private async executeSplitNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const mode = settings.splitMode ?? 'by_newline';
    const input = inputData.input || '';
    
    try {
      let items: any[] = [];
      
      switch (mode) {
        case 'by_newline':
          items = String(input).split('\n');
          break;
        
        case 'by_comma':
          items = String(input).split(',');
          break;
        
        case 'by_separator':
          const separator = String(settings.separator ?? ',');
          items = String(input).split(separator);
          break;
        
        case 'by_regex':
          const delimiter = String(settings.delimiter ?? ',');
          items = String(input).split(new RegExp(delimiter));
          break;
        
        case 'json_array':
          items = JSON.parse(String(input));
          break;
        
        default:
          items = [input];
      }
      
      return { output: items };
    } catch (error) {
      return { output: [input] };
    }
  }

  private async executeRouterNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const mode = settings.routerMode ?? 'if_else';
    const input = inputData.input;
    
    // Результат по умолчанию - все порты null
    const result: Record<string, any> = {
      route_a: null,
      route_b: null,
      route_c: null,
      default: null
    };
    
    try {
      if (mode === 'if_else') {
        // Проверяем условия по порядку
        const condA = settings.routeACondition ?? '';
        const condB = settings.routeBCondition ?? '';
        const condC = settings.routeCCondition ?? '';
        
        if (condA) {
          const fnA = new Function('input', `return ${condA}`);
          if (fnA(input)) {
            result.route_a = input;
            return result;
          }
        }
        
        if (condB) {
          const fnB = new Function('input', `return ${condB}`);
          if (fnB(input)) {
            result.route_b = input;
            return result;
          }
        }
        
        if (condC) {
          const fnC = new Function('input', `return ${condC}`);
          if (fnC(input)) {
            result.route_c = input;
            return result;
          }
        }
        
        // Если ничего не подошло - default
        result.default = input;
        return result;
      }
      
      if (mode === 'regex_match') {
        const inputStr = String(input);
        const condA = settings.routeACondition ?? '';
        const condB = settings.routeBCondition ?? '';
        const condC = settings.routeCCondition ?? '';
        
        if (condA && new RegExp(condA).test(inputStr)) {
          result.route_a = input;
          return result;
        }
        
        if (condB && new RegExp(condB).test(inputStr)) {
          result.route_b = input;
          return result;
        }
        
        if (condC && new RegExp(condC).test(inputStr)) {
          result.route_c = input;
          return result;
        }
        
        result.default = input;
        return result;
      }
      
      if (mode === 'js_expression') {
        const condA = settings.routeACondition ?? '';
        const condB = settings.routeBCondition ?? '';
        const condC = settings.routeCCondition ?? '';
        
        if (condA) {
          const fnA = new Function('input', condA);
          if (fnA(input)) {
            result.route_a = input;
            return result;
          }
        }
        
        if (condB) {
          const fnB = new Function('input', condB);
          if (fnB(input)) {
            result.route_b = input;
            return result;
          }
        }
        
        if (condC) {
          const fnC = new Function('input', condC);
          if (fnC(input)) {
            result.route_c = input;
            return result;
          }
        }
        
        result.default = input;
        return result;
      }
      
      if (mode === 'llm_classify') {
        throw new Error('LLM classify не реализован');
      }
      
      // Для других режимов - пока default
      result.default = input;
      return result;
    } catch (error) {
      result.default = input;
      return result;
    }
  }

  private async executeLoopNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const items = inputData.items || [];
    const maxIterations = Number(settings.maxIterations) || 100;
    
    // Batch-режим: обрабатываем все элементы
    const limitedItems = items.slice(0, Math.min(items.length, maxIterations));
    
    // Ключи совпадают с portId в NodeDef
    return {
      current_item: limitedItems[0] || null,  // порт 'current_item' - первый элемент
      index: 0,                                // порт 'index'
      all_items: limitedItems,                 // порт 'all_items' - все элементы
      done: limitedItems.length === 0,         // порт 'done'
      loop_done: limitedItems,                 // legacy совместимость
    };
  }

  private async executeChatHistoryNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const {
      getChatHistoryStore, appendMessage, getMessages,
      toPlainText, toGeminiMessages, clearStore, seedStore
    } = await import('./chat-history-store');

    const settings = (data.settings as Record<string, any>) ?? {};
    const storeId = String(settings.storeId || 'main');
    const operation = String(settings.operation || 'read');
    const chatId = this.options.chatId || 'default';
    const limit = Number(settings.limit) || 0;
    const filterRole = settings.filterRole === 'all' ? undefined : settings.filterRole;
    const textFormat = String(settings.textFormat || 'with_roles');

    // Вспомогалка: читать сообщения с учётом настроек
    const readMessages = () => getMessages(chatId, storeId, {
      role: filterRole as any,
      limit: limit > 0 ? limit : undefined,
    });

    const buildTextOutput = (msgs: any[]) => {
      if (textFormat === 'xml') {
        return msgs.map(m => `<${m.role}>${m.content}</${m.role}>`).join('\n');
      }
      return toPlainText(msgs, {
        includeRoles: textFormat === 'with_roles'
      });
    };

    switch (operation) {
      case 'read': {
        const msgs = readMessages();
        return {
          messages: msgs,
          text: buildTextOutput(msgs),
          gemini_format: toGeminiMessages(msgs),
          count: msgs.length,
        };
      }

      case 'append': {
        const content = String(inputData.message || '');
        const role = String(settings.writeRole || 'user') as 'user' | 'assistant' | 'system';
        if (content) appendMessage(chatId, storeId, { role, content });
        const msgs = readMessages();
        return {
          messages: msgs,
          text: buildTextOutput(msgs),
          gemini_format: toGeminiMessages(msgs),
          count: msgs.length,
        };
      }

      case 'read_and_append': {
        // Сначала читаем СТАРУЮ историю, потом добавляем новое сообщение
        const before = readMessages();
        const content = String(inputData.message || '');
        const role = String(settings.writeRole || 'user') as any;
        if (content) appendMessage(chatId, storeId, { role, content });
        // Возвращаем историю ДО нового сообщения (полезно для LLM: подаём context без нового запроса)
        return {
          messages: before,
          text: buildTextOutput(before),
          gemini_format: toGeminiMessages(before),
          count: before.length,
        };
      }

      case 'seed': {
        const rawSeeds = inputData.seed_messages || settings.seedMessages || [];
        if (Array.isArray(rawSeeds) && rawSeeds.length > 0) {
          seedStore(chatId, storeId, rawSeeds);
        }
        const msgs = readMessages();
        return {
          messages: msgs,
          text: buildTextOutput(msgs),
          gemini_format: toGeminiMessages(msgs),
          count: msgs.length,
        };
      }

      case 'clear': {
        clearStore(chatId, storeId);
        return { messages: [], text: '', gemini_format: [], count: 0 };
      }

      default:
        return { messages: [], text: '', gemini_format: [], count: 0 };
    }
  }

  private async executeOutputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    // Output node возвращает финальный результат из input порта
    const value = inputData.input ?? inputData.value ?? inputData;
    const outputType = (data.settings as any)?.outputType || 'display';

    // Сохраняем финальный output для отображения в RunPanel
    return {
      output: value,
      type: outputType,
      label: (data.settings as any)?.outputLabel || (data as any).label || 'Result',
    };
  }

  private async executeTextNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    // Text node просто возвращает статический текст
    const content = data.content || '';
    return {
      output: content
    };
  }

  private async executeMemoryReadNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { getMemories, getRelevantMemories } = await import('@/lib/memory-store');
    
    const readMode = (data.settings as any)?.readMode || (data as any).readMode || 'semantic_search';
    const scope = (data.settings as any)?.scope || (data as any).scope || 'local';
    const limit = Number((data.settings as any)?.limit || (data as any).limit) || 5;
    const query = inputData.query || '';
    
    try {
      if (readMode === 'semantic_search') {
        const results = getRelevantMemories([String(query)]).slice(0, limit);
        return {
          results: results,                                              // порт 'results'
          context_text: results.map((r: any) => r.fact).join('\n\n'), // порт 'context_text'
          count: results.length,                                        // порт 'count'
          output: results,                                              // legacy
          found: results.length > 0,
        };
      }
      
      if (readMode === 'list_all') {
        const memories = getMemories(scope as any);
        const limited = memories.slice(0, limit);
        return {
          results: limited,
          context_text: limited.map((r: any) => r.fact).join('\n\n'),
          count: limited.length,
          output: limited,
          found: limited.length > 0,
        };
      }
      
      // Default
      return {
        results: [],
        context_text: '',
        count: 0,
        output: [],
        found: false
      };
    } catch (error) {
      return {
        results: [],
        context_text: '',
        count: 0,
        output: [],
        found: false
      };
    }
  }

  private async executeMemoryWriteNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { saveMemory } = await import('@/lib/memory-store');
    
    const settings = (data.settings as Record<string, any>) ?? {};
    const writeMode = settings.writeMode ?? 'direct_save';
    const scope = settings.scope ?? 'local';
    const ttl = Number(settings.ttl) || 0;
    const key = inputData.key || '';
    const value = inputData.value;
    
    try {
      const entry = await saveMemory({
        fact: String(value),
        category: 'episode',
        keywords: [key],
        scope: scope as any,
        confidence: 0.8,
        related_to: [],
      });
      
      return {
        success: true,
        output: entry
      };
    } catch (error) {
      return {
        success: false,
        output: null
      };
    }
  }

  private async executeChatInputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const source = settings.source ?? 'active_chat';
    
    // TODO: интеграция с реальным чатом
    // Пока возвращаем mock данные
    return {
      output: 'User message from chat',
      metadata: {
        source,
        timestamp: Date.now()
      }
    };
  }

  private async executeChatOutputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const target = settings.target ?? 'active_chat';
    const streamOutput = settings.streamOutput ?? false;
    const message = inputData.input || '';
    
    // TODO: интеграция с реальным чатом
    // Пока просто возвращаем success
    console.log('[Chat Output]', message);
    
    return {
      success: true
    };
  }

  private async executeCodeNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const code = String(settings.code ?? 'return input;');
    
    try {
      const fn = new Function('input', code);
      const result = fn(inputData.input);
      return {
        output: result,
        error: null
      };
    } catch (error) {
      return {
        output: null,
        error: `Code execution failed: ${error}`
      };
    }
  }

  private async executeHTTPRequestNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const method = (data.method || 'GET') as string;
    const url = inputData.url || '';
    const body = inputData.body;
    const headers = inputData.headers || {};
    
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };
      
      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      const data = await response.json();
      
      return {
        response: data,
        status: response.status,
        error: null
      };
    } catch (error) {
      return {
        response: null,
        status: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async executeDebugNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const debugLabel = data.debugLabel || 'Debug';
    const logLevel = data.logLevel || 'log';
    const showInRunPanel = data.showInRunPanel !== false;
    
    const logMessage = `[${debugLabel}]`;
    
    switch (logLevel) {
      case 'warn':
        console.warn(logMessage, inputData.input);
        break;
      case 'error':
        console.error(logMessage, inputData.input);
        break;
      default:
        console.log(logMessage, inputData.input);
    }
    
    // Pass-through
    return {
      output: inputData.input
    };
  }

  // === Helper Methods ===

  /**
   * Собирает входные данные из предыдущих узлов с поддержкой именованных портов
   */
  private collectInputData(node: Node<NodeData>): Record<string, any> {
    const { NODE_DEFINITIONS } = require('./node-definitions');
    const result: Record<string, any> = {};
    
    // Находим все входящие edges для этой ноды
    const incomingEdges = this.graph.edges.filter(e => e.target === node.id);
    
    for (const edge of incomingEdges) {
      const sourceNode = this.graph.nodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;
      
      const sourceOutput = this.nodeResults.get(edge.source);
      if (!sourceOutput) continue;
      
      // Берём конкретный output по sourceHandle
      const sourcePortId = edge.sourceHandle || 'output';
      const targetPortId = edge.targetHandle || 'input';
      
      // Если результат - объект с портами, берём конкретный порт
      const value = typeof sourceOutput === 'object' && sourceOutput !== null && sourcePortId in sourceOutput
        ? sourceOutput[sourcePortId]
        : sourceOutput;
      
      result[targetPortId] = value;
    }
    
    // Дополняем вручную введёнными значениями (если порт не подключён)
    const nodeDef = NODE_DEFINITIONS[node.type!];
    if (nodeDef) {
      for (const inputDef of nodeDef.inputs) {
        if (!(inputDef.id in result)) {
          // Берём из node.data.inputs или defaultValue
          result[inputDef.id] = node.data.inputs?.[inputDef.id] ?? inputDef.defaultValue;
        }
      }
    }
    
    return result;
  }

  /**
   * Топологическая сортировка узлов
   */
  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const adjacencyList = this.buildAdjacencyList();

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }

      result.unshift(nodeId);
    };

    for (const node of this.graph.nodes) {
      visit(node.id);
    }

    return result;
  }

  /**
   * Строит список смежности для графа
   */
  private buildAdjacencyList(): Map<string, string[]> {
    const adjacencyList = new Map<string, string[]>();

    for (const node of this.graph.nodes) {
      adjacencyList.set(node.id, []);
    }

    for (const edge of this.graph.edges) {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    }

    return adjacencyList;
  }

  /**
   * Останавливает выполнение
   */
  cancel(): void {
    this.abortController.abort();
  }

  /**
   * Генерирует уникальный ID
   */
  private generateId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
