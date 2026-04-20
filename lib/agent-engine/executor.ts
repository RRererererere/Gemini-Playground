// GraphExecutor - выполняет агентный граф

import { AgentGraph, AgentRun, NodeRunResult, ExecutorOptions, NodeData } from './types';
import { Node, Edge } from '@xyflow/react';

export class GraphExecutor {
  private graph: AgentGraph;
  private options: ExecutorOptions;
  private abortController: AbortController;
  private nodeResults: Map<string, any> = new Map();
  // BUG-09: Ноды, которые нужно пропустить (неактивные ветки condition/router)
  private skippedNodes: Set<string> = new Set();
  // FEAT-02: Хранилище переменных на время запуска
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
      // BUG-08: Топологическая сортировка с детекцией циклов
      const executionOrder = this.topologicalSort();
      
      // Выполняем узлы по порядку
      for (const nodeId of executionOrder) {
        if (this.abortController.signal.aborted) {
          run.status = 'cancelled';
          break;
        }

        const node = this.graph.nodes.find(n => n.id === nodeId);
        if (!node) continue;

        // BUG-09: Пропускаем ноды неактивных веток
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
          if (this.options.onNodeSkip) {
            this.options.onNodeSkip(nodeId);
          }
          continue;
        }

        const result = await this.runNode(node);
        run.nodeResults.push(result);
        run.results[node.id] = result;
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
        this.options.onNodeStart(node.id, node.data.label || node.type || 'unknown');
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
        return this.executeChatInputNode(data, inputData);
      
      case 'chat_output':
        return this.executeChatOutputNode(data, inputData);
      
      case 'database_hub':
        return { output: 'DB Active' };
      
      case 'global_db':
        return { output: 'Global DB Active' };

      case 'feedback':
        return this.executeFeedbackNode(data, inputData);
      
      case 'code':
        return this.executeCodeNode(data, inputData);
      
      case 'http_request':
        return this.executeHTTPRequestNode(data, inputData);
      
      case 'debug':
        return this.executeDebugNode(data, inputData);
      
      case 'text':
        return this.executeTextNode(data, inputData);
      
      // BUG-09 + new nodes
      case 'template':
        return this.executeTemplateNode(data, inputData);
      
      case 'variable':
        return this.executeVariableNode(data, inputData);
      
      case 'json_extract':
        return this.executeJsonExtractNode(data, inputData);
      
      case 'delay':
        return this.executeDelayNode(data, inputData);
      
      case 'subagent':
        return this.executeSubAgentNode(data, inputData);
      
      case 'output':
      case 'agent_output':
        return this.executeOutputNode(data, inputData);
      
      default:
        throw new Error(`Unknown node type: ${type}`);
    }
  }

  // === Node Executors ===

  private async executeInputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const inputType = settings.inputType || 'static';
    
    // BUG-11: режим chat_message — через callback
    if (inputType === 'chat_message' && this.options.onChatInputRequest) {
      try {
        const message = await this.options.onChatInputRequest('last_message');
        return { output: message };
      } catch (e) {
        // fallback
      }
    }
    
    const initialValue = settings.initialValue ?? data.initialValue ?? data.defaultValue ?? inputData.value ?? null;
    let value = initialValue;
    if (typeof initialValue === 'string' && initialValue.trim()) {
      try {
        value = JSON.parse(initialValue);
      } catch {
        value = initialValue;
      }
    }

    if (settings.saveToHistory && value) {
       const storeId = String(settings.historyStoreId || 'main');
       const chatId = this.options.chatId || 'default';
       const { appendMessage } = await import('./chat-history-store');
       appendMessage(chatId, storeId, { role: 'user', content: String(value) });
    }

    return { output: value };
  }

  private async executeFeedbackNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const promptText = settings.promptText || 'Оцените ответ ИИ';

    if (this.options.onChatInputRequest) {
      try {
        const feedback = await this.options.onChatInputRequest('feedback', { promptText, context: inputData.input });
        return { feedback_result: feedback };
      } catch (e) {
        return { feedback_result: { reaction: 'none', message: 'Cancelled', error: String(e) }};
      }
    }
    
    // Fallback if not interactive
    return { feedback_result: { reaction: 'like', message: 'Auto-approved fallback' }};
  }

  private async executePlannerNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const { callLLM, getApiKey } = await import('./llm-integration');
    const settings = (data.settings as Record<string, any>) ?? {};
    const task = inputData.task || settings.task || '';
    const stepsCount = settings.steps || 3;
    
    const schemaProps: Record<string, any> = {};
    for (let i = 1; i <= stepsCount; i++) {
      schemaProps[`step${i}`] = { type: 'string', description: `Task for step ${i}` };
    }
    
    const systemInstruction = `You are a planner. Break down the given task into exactly ${stepsCount} steps. Output STRICTLY as JSON without markdown formatting. The JSON must match this structure exactly: ${JSON.stringify(schemaProps)}`;
    
    const apiKey = await getApiKey(data);
    if (!apiKey) throw new Error('API Key missing for Planner node');
    
    const messages = [{ role: 'user', parts: [{ text: `Task: ${task}` }] }];
    
    const response = await callLLM({
      model: data.settings?.model || 'gemini-2.0-flash-exp',
      prompt: `Task: ${task}`,
      systemPrompt: systemInstruction,
      temperature: 0.2,
      apiKey,
      responseMimeType: 'application/json'
    } as any);
    
    let resultJson: Record<string, any> = {};
    try {
       const cleanText = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
       resultJson = JSON.parse(cleanText);
    } catch (e) {
       console.error('Failed to parse planner output:', response.text);
       throw new Error('Planner output was not valid JSON');
    }
    
    return resultJson;
  }

  private async executeLLMNode(data: NodeData, inputData: Record<string, any>, nodeId?: string): Promise<any> {
    const { callLLM, preparePromptFromNode, getApiKey } = await import('./llm-integration');
    
    const model = data.settings?.model || data.model || 'gemini-2.0-flash-exp';
    let history = inputData.history || [];
    
    // Global State override for history
    if (data.settings?.useHistoryStore) {
      const storeId = String(data.settings.historyStoreId || 'main');
      const chatId = this.options.chatId || 'default';
      const { getMessages, toGeminiMessages } = await import('./chat-history-store');
      history = toGeminiMessages(getMessages(chatId, storeId));
    }

    // Системный промпт: вход prompt > settings.systemPrompt
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

      let streamedText = '';

      // BUG-01: передаём history в callLLM
      const response = await callLLM({
        model,
        prompt: prompt || userMessage,
        systemPrompt,
        temperature,
        maxTokens,
        apiKey,
        parts,
        tools: Array.isArray(inputData.tools) ? inputData.tools : undefined,
        history: Array.isArray(history) && history.length > 0 ? history : undefined,
        onChunk: (chunk: string) => {
          streamedText += chunk;
          if (this.options.onNodeStream && nodeId) {
            this.options.onNodeStream(nodeId, chunk, streamedText);
          }
        },
      });

      if (response.error) {
        return { output: null, error: response.error };
      }

      if (data.settings?.useHistoryStore && data.settings?.saveResponseToHistory !== false) {
        const storeId = String(data.settings.historyStoreId || 'main');
        const chatId = this.options.chatId || 'default';
        const { appendMessage } = await import('./chat-history-store');
        appendMessage(chatId, storeId, { role: 'assistant', content: response.text });
      }

      return { 
        output: response.text, 
        tool_calls: response.toolCalls || [],
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

  private async executeConditionNode(data: NodeData, inputData: Record<string, any>, nodeId?: string): Promise<any> {
    const conditionCode = String(
      inputData.condition ||
      (data.settings as any)?.conditionCode ||
      data.conditionCode ||
      'true'
    );
    
    try {
      const fn = new Function('context', 'input', `"use strict"; return (${conditionCode});`);
      const condResult = fn(inputData, inputData.input);
      
      // BUG-09: маркируем даунстрим-ноды неактивной ветки как skipped
      if (nodeId) {
        const inactiveHandle = condResult ? 'condition_false' : 'condition_true';
        this.markDownstreamSkipped(nodeId, inactiveHandle);
      }
      
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
    const input = inputData.input;
    
    try {
      if (transformType === 'js_expression') {
        const expression = String(settings.expression || (data as any).expression || 'return input;');
        const fn = new Function('input', expression);
        return { output: fn(input), error: null };
      }
      if (transformType === 'extract_field') {
        const field = String(settings.field || '');
        if (!field) return { output: input, error: null };
        const parts = field.split('.');
        let current = input;
        for (const p of parts) {
          if (current == null) break;
          current = current[p];
        }
        return { output: current, error: null };
      }
      if (transformType === 'format_string') {
        const template = String(settings.template || '');
        let res = template;
        if (typeof input === 'object' && input !== null) {
          for (const key of Object.keys(input)) {
            res = res.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(input[key] ?? ''));
          }
        }
        return { output: res, error: null };
      }
      if (transformType === 'json_parse') {
        return { output: typeof input === 'string' ? JSON.parse(input) : input, error: null };
      }
      if (transformType === 'json_stringify') {
        return { output: JSON.stringify(input, null, 2), error: null };
      }
      return { output: input, error: null };
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

  private async executeRouterNode(data: NodeData, inputData: Record<string, any>, nodeId?: string): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const mode = settings.routerMode ?? 'if_else';
    const input = inputData.input;
    
    const result: Record<string, any> = {
      route_a: null,
      route_b: null,
      route_c: null,
      default: null
    };
    
    let activeRoute: string | null = null;
    
    try {
      if (mode === 'if_else' || mode === 'js_expression') {
        const condA = settings.routeACondition ?? '';
        const condB = settings.routeBCondition ?? '';
        const condC = settings.routeCCondition ?? '';
        const evalFn = mode === 'js_expression'
          ? (cond: string) => { const fn = new Function('input', cond); return fn(input); }
          : (cond: string) => { const fn = new Function('input', `return ${cond}`); return fn(input); };
        
        if (condA) { try { if (evalFn(condA)) { result.route_a = input; activeRoute = 'route_a'; } } catch {} }
        if (!activeRoute && condB) { try { if (evalFn(condB)) { result.route_b = input; activeRoute = 'route_b'; } } catch {} }
        if (!activeRoute && condC) { try { if (evalFn(condC)) { result.route_c = input; activeRoute = 'route_c'; } } catch {} }
        if (!activeRoute) { result.default = input; activeRoute = 'default'; }
      }
      
      if (mode === 'regex_match') {
        const inputStr = String(input);
        const condA = settings.routeACondition ?? '';
        const condB = settings.routeBCondition ?? '';
        const condC = settings.routeCCondition ?? '';
        
        if (condA && new RegExp(condA).test(inputStr)) { result.route_a = input; activeRoute = 'route_a'; }
        else if (condB && new RegExp(condB).test(inputStr)) { result.route_b = input; activeRoute = 'route_b'; }
        else if (condC && new RegExp(condC).test(inputStr)) { result.route_c = input; activeRoute = 'route_c'; }
        else { result.default = input; activeRoute = 'default'; }
      }
      
      if (mode === 'llm_classify') {
        // FEAT-09: Классификация через LLM
        const { callLLM, getApiKey } = await import('./llm-integration');
        const apiKey = getApiKey(data);
        const model = data.settings?.model || 'gemini-2.0-flash-exp';
        const condA = settings.routeACondition || 'Category A';
        const condB = settings.routeBCondition || 'Category B';
        const condC = settings.routeCCondition || 'Category C';
        
        if (apiKey) {
          const classifyPrompt = `Classify the following text into one of these categories:\nA: ${condA}\nB: ${condB}\nC: ${condC}\nDEFAULT: None of the above\n\nText: "${String(input)}"\n\nReply with ONLY one word: A, B, C, or DEFAULT.`;
          const response = await callLLM({ model, prompt: classifyPrompt, apiKey, temperature: 0 });
          const cls = response.text.trim().toUpperCase();
          if (cls.includes('A')) { result.route_a = input; activeRoute = 'route_a'; }
          else if (cls.includes('B')) { result.route_b = input; activeRoute = 'route_b'; }
          else if (cls.includes('C')) { result.route_c = input; activeRoute = 'route_c'; }
          else { result.default = input; activeRoute = 'default'; }
        } else {
          result.default = input; activeRoute = 'default';
        }
      }
      
      if (!activeRoute) { result.default = input; activeRoute = 'default'; }
      
      // BUG-09: маркируем неактивные ветки как skipped
      if (nodeId) {
        const allRoutes = ['route_a', 'route_b', 'route_c', 'default'];
        for (const route of allRoutes) {
          if (route !== activeRoute) {
            this.markDownstreamSkipped(nodeId, route);
          }
        }
      }
      
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
    const agentId = settings.agentId;
    
    // Batch-режим: обрабатываем все элементы
    const limitedItems = Array.isArray(items) ? items.slice(0, Math.min(items.length, maxIterations)) : [items].slice(0, 1);
    
    // Если указан саб-агент, выполняем его для каждого элемента
    if (agentId) {
      try {
        const { getGraphById } = await import('./graph-storage');
        const subGraph = getGraphById(agentId);
        
        if (subGraph) {
          const { GraphExecutor } = await import('./executor');
          const results = [];
          for (let i = 0; i < limitedItems.length; i++) {
            const item = limitedItems[i];
            const subExecutor = new GraphExecutor(subGraph, {
              chatId: this.options.chatId,
              onChatInputRequest: this.options.onChatInputRequest,
              onChatOutput: this.options.onChatOutput,
            });
            const subRun = await subExecutor.run(item);
            
            const finalResult = [...subRun.nodeResults].reverse().find(r =>
              r.output && typeof r.output === 'object' && 'output' in (r.output as any)
            );
            results.push((finalResult?.output as any)?.output ?? item);
          }
          
          return {
            current_item: null,
            index: limitedItems.length,
            all_items: results,
            done: true,
            loop_done: results,
          };
        }
      } catch (e) {
        console.error('Loop sub-agent failed:', e);
      }
    }
    
    // Ключи совпадают с portId в NodeDef
    return {
      current_item: limitedItems[0] || null,  // порт 'current_item' - первый элемент
      index: 0,                                // порт 'index'
      all_items: limitedItems,                 // порт 'all_items' - все элементы
      done: limitedItems.length === 0,         // порт 'done'
      loop_done: limitedItems,                 // legacy совместимость
    };
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
    // BUG-04: читаем из settings, не из корня data
    const content = (data.settings as any)?.content ?? (data as any).content ?? '';
    return { output: content };
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
    
    // BUG-02: используем callback если есть
    if (this.options.onChatInputRequest) {
      try {
        const message = await this.options.onChatInputRequest(source);
        return {
          output: message,
          metadata: { source, timestamp: Date.now() }
        };
      } catch (e) {
        console.error('[ChatInput] callback failed:', e);
      }
    }
    
    // Fallback: если callback не настроен — пустая строка (не хардкод)
    return {
      output: '',
      metadata: { source, timestamp: Date.now(), warning: 'onChatInputRequest not configured' }
    };
  }

  private async executeChatOutputNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as Record<string, any>) ?? {};
    const target = settings.target ?? 'active_chat';
    const message = inputData.input || '';
    
    // BUG-03: используем callback если есть
    if (this.options.onChatOutput) {
      try {
        await this.options.onChatOutput(String(message), target);
        return { success: true };
      } catch (e) {
        console.error('[ChatOutput] callback failed:', e);
        return { success: false, error: String(e) };
      }
    }
    
    // Fallback: просто логируем
    console.log('[Chat Output]', message);
    return { success: true };
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
    // BUG-06: читаем из settings, не из корня data
    const settings = (data.settings as Record<string, any>) ?? {};
    const method = (settings.method || 'GET') as string;
    const authType = settings.authType || 'none';
    const authToken = settings.authToken || '';
    const url = inputData.url || settings.url || '';
    const body = inputData.body;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(inputData.headers || {}) };
    
    // Добавляем авторизацию
    if (authType === 'bearer' && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    } else if (authType === 'api_key' && authToken) {
      headers['X-API-Key'] = authToken;
    }
    
    try {
      const options: RequestInit = { method, headers };
      if (body && method !== 'GET') {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      let responseData: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      return { response: responseData, status: response.status, error: null };
    } catch (error) {
      return { response: null, status: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async executeDebugNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    // BUG-05: читаем из settings, не из корня data
    const settings = (data.settings as any) ?? {};
    const debugLabel = settings.debugLabel ?? 'Debug';
    const logLevel = settings.logLevel ?? 'log';
    const showInRunPanel = settings.showInRunPanel ?? true;
    
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
    
    return { output: inputData.input };
  }

  // FEAT-01: Template нода
  private async executeTemplateNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as any) ?? {};
    let template = String(settings.template ?? 'Hello, {{var1}}!');
    
    // Подстановка переменных {{var1}}, {{var2}}, {{var3}}
    template = template.replace(/\{\{var1\}\}/g, String(inputData.var1 ?? ''));
    template = template.replace(/\{\{var2\}\}/g, String(inputData.var2 ?? ''));
    template = template.replace(/\{\{var3\}\}/g, String(inputData.var3 ?? ''));
    // Дополнительные переменные из inputData
    for (const [key, value] of Object.entries(inputData)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      template = template.replace(regex, String(value ?? ''));
    }
    
    return { output: template };
  }

  // FEAT-02: Variable нода
  private async executeVariableNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as any) ?? {};
    const varName = String(settings.varName ?? 'myVar');
    
    // Если есть входное значение — обновляем переменную
    if (inputData.set_value !== undefined && inputData.set_value !== null) {
      this.runVariables.set(varName, inputData.set_value);
    } else if (!this.runVariables.has(varName)) {
      // Устанавливаем начальное значение
      const initVal = settings.initialValue ?? '';
      let parsed = initVal;
      if (typeof initVal === 'string' && initVal.trim()) {
        try { parsed = JSON.parse(initVal); } catch { parsed = initVal; }
      }
      this.runVariables.set(varName, parsed);
    }
    
    return { value: this.runVariables.get(varName) };
  }

  // FEAT-03: JSON Extract нода
  private async executeJsonExtractNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as any) ?? {};
    const path = String(settings.path ?? 'data.result');
    const parseFirst = settings.parseFirst !== false;
    
    try {
      let obj = inputData.input;
      if (parseFirst && typeof obj === 'string') {
        obj = JSON.parse(obj);
      }
      
      // Поддержка dot-notation и [index]
      const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) {
          return { output: null, error: `Path "${path}" not found at "${part}"` };
        }
        current = current[part];
      }
      
      return { output: current, error: null };
    } catch (error) {
      return { output: null, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // FEAT-04: Delay нода
  private async executeDelayNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as any) ?? {};
    const ms = Math.min(Number(settings.milliseconds ?? 1000), 30000); // макс 30 сек
    await new Promise(resolve => setTimeout(resolve, ms));
    return { output: inputData.input };
  }

  // FEAT-05: SubAgent нода
  private async executeSubAgentNode(data: NodeData, inputData: Record<string, any>): Promise<any> {
    const settings = (data.settings as any) ?? {};
    const agentId = settings.agentId || '';
    
    if (!agentId) {
      return { output: null, error: 'No agent selected' };
    }
    
    try {
      const { getGraphById } = await import('./graph-storage');
      const subGraph = getGraphById(agentId);
      
      if (!subGraph) {
        return { output: null, error: `Agent not found: ${agentId}` };
      }
      
      const { GraphExecutor } = await import('./executor');
      const subExecutor = new GraphExecutor(subGraph, {
        chatId: this.options.chatId,
        onChatInputRequest: this.options.onChatInputRequest,
        onChatOutput: this.options.onChatOutput,
      });
      
      const subRun = await subExecutor.run(inputData.input);
      
      // Найти финальный output
      const finalResult = [...subRun.nodeResults].reverse().find(r =>
        r.output && typeof r.output === 'object' && 'output' in (r.output as any)
      );
      const finalOutput = (finalResult?.output as any)?.output;
      
      return {
        output: finalOutput ?? null,
        error: subRun.status === 'error' ? 'Sub-agent failed' : null
      };
    } catch (error) {
      return { output: null, error: error instanceof Error ? error.message : String(error) };
    }
  }

  // === Helper Methods ===

  /**
   * Собирает входные данные из предыдущих узлов с поддержкой именованных портов
   */
  private collectInputData(node: Node<NodeData>): Record<string, any> {
    const { NODE_DEFINITIONS } = require('./node-definitions');
    const result: Record<string, any> = {};
    
    const incomingEdges = this.graph.edges.filter(e => e.target === node.id);
    
    for (const edge of incomingEdges) {
      const sourceNode = this.graph.nodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;
      
      // BUG-09: если источник в skippedNodes — значение null
      if (this.skippedNodes.has(edge.source)) {
        const targetPortId = edge.targetHandle || 'input';
        result[targetPortId] = null;
        continue;
      }
      
      const sourceOutput = this.nodeResults.get(edge.source);
      if (!sourceOutput) continue;
      
      const sourcePortId = edge.sourceHandle || 'output';
      const targetPortId = edge.targetHandle || 'input';
      
      const value = typeof sourceOutput === 'object' && sourceOutput !== null && sourcePortId in sourceOutput
        ? sourceOutput[sourcePortId]
        : sourceOutput;
      
      result[targetPortId] = value;
    }
    
    const nodeDef = NODE_DEFINITIONS[node.type!];
    if (nodeDef) {
      for (const inputDef of nodeDef.inputs) {
        if (!(inputDef.id in result)) {
          result[inputDef.id] = node.data.inputs?.[inputDef.id] ?? inputDef.defaultValue;
        }
      }
    }
    
    return result;
  }

  /**
   * BUG-08: Топологическая сортировка С детекцией циклов
   */
  private topologicalSort(): string[] {
    const visited = new Set<string>();
    const inStack = new Set<string>(); // BUG-08: для детекции циклов
    const result: string[] = [];
    const adjacencyList = this.buildAdjacencyList();

    const visit = (nodeId: string) => {
      if (inStack.has(nodeId)) {
        throw new Error(`Circular dependency detected at node: ${nodeId}`);
      }
      if (visited.has(nodeId)) return;
      
      inStack.add(nodeId);
      
      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        visit(neighbor);
      }
      
      inStack.delete(nodeId);
      visited.add(nodeId);
      result.unshift(nodeId);
    };

    for (const node of this.graph.nodes) {
      if (!visited.has(node.id)) {
        visit(node.id);
      }
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
   * BUG-09: Маркирует все даунстрим-ноды неактивного порта как skipped
   */
  private markDownstreamSkipped(fromNodeId: string, fromHandle: string): void {
    const edgesFromInactiveHandle = this.graph.edges.filter(
      e => e.source === fromNodeId && e.sourceHandle === fromHandle
    );
    
    for (const edge of edgesFromInactiveHandle) {
      if (!this.skippedNodes.has(edge.target)) {
        this.skippedNodes.add(edge.target);
        // Рекурсивно маркируем всих потомков
        const adjacency = this.buildAdjacencyList();
        const downstream = adjacency.get(edge.target) || [];
        for (const childId of downstream) {
          this.markDownstreamSkipped(edge.target, '');
        }
      }
    }
  }

  /**
   * Останавливает выполнение
   */
  cancel(): void {
    this.abortController.abort();
  }

  private generateId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
