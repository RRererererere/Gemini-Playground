// Graph Validator — проверка графа перед запуском
// 🟢 ФИКС #12: Валидация графа

import { Node, Edge } from '@xyflow/react';
import { NodeData, AgentGraph } from './types';
import { getNodeDef } from './node-definitions';

export interface ValidationError {
  nodeId: string;
  nodeName: string;
  type: 'missing_input' | 'missing_setting' | 'invalid_connection' | 'no_start_node' | 'no_end_node' | 'disconnected_node' | 'cycle_detected';
  message: string;
  severity: 'error' | 'warning';
  portId?: string;
  settingId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Валидация графа перед запуском
 */
export function validateGraph(graph: AgentGraph): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Проверка наличия стартовой ноды
  const hasStartNode = graph.nodes.some(n => 
    n.type === 'agent_input' || 
    n.type === 'input' || 
    n.type === 'user_message_input' ||
    n.type === 'chat_input'
  );

  if (!hasStartNode) {
    errors.push({
      nodeId: '',
      nodeName: 'Graph',
      type: 'no_start_node',
      message: 'Граф должен иметь хотя бы одну входную ноду (Input, User Message Input)',
      severity: 'error',
    });
  }

  // 2. Проверка наличия выходной ноды
  const hasEndNode = graph.nodes.some(n => 
    n.type === 'agent_output' || 
    n.type === 'output' || 
    n.type === 'agent_response_output' ||
    n.type === 'chat_output'
  );

  if (!hasEndNode) {
    warnings.push({
      nodeId: '',
      nodeName: 'Graph',
      type: 'no_end_node',
      message: 'Граф не имеет выходной ноды. Результат может быть не виден.',
      severity: 'warning',
    });
  }

  // 3. Проверка каждой ноды
  for (const node of graph.nodes) {
    const nodeDef = getNodeDef(node.type!);
    if (!nodeDef) {
      errors.push({
        nodeId: node.id,
        nodeName: node.data.label || node.type || 'Unknown',
        type: 'invalid_connection',
        message: `Неизвестный тип ноды: ${node.type}`,
        severity: 'error',
      });
      continue;
    }

    // Пропускаем Comment ноды
    if (node.type === 'comment') continue;

    // 3.1. Проверка обязательных входных портов
    for (const input of nodeDef.inputs.filter(i => i.required)) {
      const hasConnection = graph.edges.some(
        e => e.target === node.id && e.targetHandle === input.id
      );

      // Проверяем также наличие значения в settings или inputs
      const hasValue = 
        node.data.settings?.[input.id] !== undefined && 
        node.data.settings?.[input.id] !== null &&
        node.data.settings?.[input.id] !== '';

      if (!hasConnection && !hasValue) {
        errors.push({
          nodeId: node.id,
          nodeName: node.data.label || nodeDef.label,
          type: 'missing_input',
          message: `Обязательный порт "${input.label}" не подключён и не имеет значения`,
          severity: 'error',
          portId: input.id,
        });
      }
    }

    // 3.2. Проверка обязательных настроек
    for (const setting of nodeDef.settings) {
      // Проверяем только если есть явное required (пока не добавлено в схему, но можно расширить)
      const value = node.data.settings?.[setting.id];
      
      // Специальные проверки для критичных настроек
      if (node.type === 'llm' && setting.id === 'apiKeyIndex') {
        if (value === undefined || value === null) {
          errors.push({
            nodeId: node.id,
            nodeName: node.data.label || nodeDef.label,
            type: 'missing_setting',
            message: `Не выбран API ключ`,
            severity: 'error',
            settingId: setting.id,
          });
        }
      }

      if (node.type === 'skill' && setting.id === 'skillId') {
        if (!value) {
          errors.push({
            nodeId: node.id,
            nodeName: node.data.label || nodeDef.label,
            type: 'missing_setting',
            message: `Не выбран навык (Skill)`,
            severity: 'error',
            settingId: setting.id,
          });
        }
      }

      if (node.type === 'subagent' && setting.id === 'agentId') {
        if (!value) {
          errors.push({
            nodeId: node.id,
            nodeName: node.data.label || nodeDef.label,
            type: 'missing_setting',
            message: `Не выбран саб-агент`,
            severity: 'error',
            settingId: setting.id,
          });
        }
      }
    }

    // 3.3. Проверка отключенных нод (disconnected)
    const hasIncoming = graph.edges.some(e => e.target === node.id);
    const hasOutgoing = graph.edges.some(e => e.source === node.id);
    const isStartNode = node.type === 'agent_input' || node.type === 'input' || node.type === 'user_message_input' || node.type === 'chat_input';
    const isEndNode = node.type === 'agent_output' || node.type === 'output' || node.type === 'agent_response_output' || node.type === 'chat_output';

    if (!hasIncoming && !isStartNode && !hasOutgoing) {
      warnings.push({
        nodeId: node.id,
        nodeName: node.data.label || nodeDef.label,
        type: 'disconnected_node',
        message: 'Нода не подключена к графу',
        severity: 'warning',
      });
    }
  }

  // 4. Проверка циклов (упрощённая)
  const cycles = detectCycles(graph.nodes, graph.edges);
  if (cycles.length > 0) {
    for (const cycle of cycles) {
      warnings.push({
        nodeId: cycle[0],
        nodeName: graph.nodes.find(n => n.id === cycle[0])?.data.label || 'Node',
        type: 'cycle_detected',
        message: `Обнаружен цикл: ${cycle.map(id => graph.nodes.find(n => n.id === id)?.data.label || id).join(' → ')}`,
        severity: 'warning',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Детекция циклов в графе (DFS)
 */
function detectCycles(nodes: Node<NodeData>[], edges: Edge[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  const adjacency = new Map<string, string[]>();
  nodes.forEach(n => adjacency.set(n.id, []));
  edges.forEach(e => adjacency.get(e.source)?.push(e.target));

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        // Цикл найден
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
        return true;
      }
    }

    recStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return cycles;
}

/**
 * Получить человекочитаемое описание ошибки
 */
export function getErrorDescription(error: ValidationError): string {
  switch (error.type) {
    case 'missing_input':
      return `В ноде "${error.nodeName}" не подключён обязательный порт`;
    case 'missing_setting':
      return `В ноде "${error.nodeName}" не заполнена обязательная настройка`;
    case 'invalid_connection':
      return `Нода "${error.nodeName}" имеет неверный тип`;
    case 'no_start_node':
      return 'Граф должен иметь входную ноду';
    case 'no_end_node':
      return 'Граф не имеет выходной ноды';
    case 'disconnected_node':
      return `Нода "${error.nodeName}" не подключена к графу`;
    case 'cycle_detected':
      return `Обнаружен цикл в графе`;
    default:
      return error.message;
  }
}
