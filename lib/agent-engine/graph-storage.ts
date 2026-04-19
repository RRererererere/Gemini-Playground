// Graph Storage - сохранение и загрузка агентных графов

import { AgentGraph, AgentRun } from './types';

const GRAPHS_KEY = 'agent_graphs_index';
const RUNS_KEY_PREFIX = 'agent_run_';

// Custom event для обновления UI
export const GRAPHS_UPDATED_EVENT = 'graphs_updated';

function dispatchGraphsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(GRAPHS_UPDATED_EVENT));
  }
}

/**
 * Получить все графы
 */
export function getGraphs(): AgentGraph[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GRAPHS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AgentGraph[];
  } catch {
    return [];
  }
}

/**
 * Получить граф по ID
 */
export function getGraphById(id: string): AgentGraph | null {
  const graphs = getGraphs();
  return graphs.find(g => g.id === id) || null;
}

/**
 * Сохранить граф
 */
export function saveGraph(graph: AgentGraph): void {
  if (typeof window === 'undefined') return;
  
  const graphs = getGraphs();
  const idx = graphs.findIndex(g => g.id === graph.id);
  
  const now = Date.now();
  if (idx >= 0) {
    graphs[idx] = { ...graph, updatedAt: now };
  } else {
    graphs.push({ ...graph, createdAt: now, updatedAt: now });
  }
  
  localStorage.setItem(GRAPHS_KEY, JSON.stringify(graphs));
  dispatchGraphsUpdated();
}

/**
 * Удалить граф
 */
export function deleteGraph(id: string): void {
  if (typeof window === 'undefined') return;
  
  const graphs = getGraphs();
  const filtered = graphs.filter(g => g.id !== id);
  
  localStorage.setItem(GRAPHS_KEY, JSON.stringify(filtered));
  dispatchGraphsUpdated();
}

/**
 * Обновить граф
 */
export function updateGraph(id: string, updates: Partial<Omit<AgentGraph, 'id' | 'createdAt'>>): void {
  const graph = getGraphById(id);
  if (!graph) return;
  
  saveGraph({ ...graph, ...updates, updatedAt: Date.now() });
}

/**
 * Экспортировать граф в JSON
 */
export function exportGraph(graph: AgentGraph): string {
  return JSON.stringify(graph, null, 2);
}

/**
 * Импортировать граф из JSON
 */
export function importGraph(jsonString: string): AgentGraph {
  const graph = JSON.parse(jsonString) as AgentGraph;
  
  // Генерируем новый ID при импорте
  const newGraph: AgentGraph = {
    ...graph,
    id: `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  saveGraph(newGraph);
  return newGraph;
}

/**
 * Дублировать граф
 */
export function duplicateGraph(id: string): AgentGraph | null {
  const graph = getGraphById(id);
  if (!graph) return null;
  
  const duplicate: AgentGraph = {
    ...graph,
    id: `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${graph.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {
      ...graph.metadata,
      runCount: 0,
      lastRunAt: undefined,
    },
  };
  
  saveGraph(duplicate);
  return duplicate;
}

// === Agent Runs Storage ===

/**
 * Сохранить результат запуска
 */
export function saveRun(run: AgentRun): void {
  if (typeof window === 'undefined') return;
  
  const key = `${RUNS_KEY_PREFIX}${run.graphId}`;
  const runs = getRuns(run.graphId);
  
  runs.unshift(run);
  
  // Храним только последние 50 запусков
  const trimmed = runs.slice(0, 50);
  
  localStorage.setItem(key, JSON.stringify(trimmed));
  
  // Обновляем метаданные графа
  const graph = getGraphById(run.graphId);
  if (graph) {
    updateGraph(run.graphId, {
      metadata: {
        ...graph.metadata,
        runCount: graph.metadata.runCount + 1,
        lastRunAt: run.startedAt,
      },
    });
  }
}

/**
 * Получить все запуски графа
 */
export function getRuns(graphId: string): AgentRun[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const key = `${RUNS_KEY_PREFIX}${graphId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as AgentRun[];
  } catch {
    return [];
  }
}

/**
 * Получить все запуски всех графов
 */
export function getAllRuns(): AgentRun[] {
  if (typeof window === 'undefined') return [];
  
  const graphs = getGraphs();
  const allRuns: AgentRun[] = [];
  
  for (const graph of graphs) {
    const runs = getRuns(graph.id);
    allRuns.push(...runs);
  }
  
  // Сортируем по времени
  return allRuns.sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Получить запуск по ID
 */
export function getRunById(runId: string): AgentRun | null {
  const allRuns = getAllRuns();
  return allRuns.find(r => r.id === runId) || null;
}

/**
 * Удалить запуск
 */
export function deleteRun(graphId: string, runId: string): void {
  if (typeof window === 'undefined') return;
  
  const runs = getRuns(graphId);
  const filtered = runs.filter(r => r.id !== runId);
  
  const key = `${RUNS_KEY_PREFIX}${graphId}`;
  localStorage.setItem(key, JSON.stringify(filtered));
}

/**
 * Очистить все запуски графа
 */
export function clearRuns(graphId: string): void {
  if (typeof window === 'undefined') return;
  
  const key = `${RUNS_KEY_PREFIX}${graphId}`;
  localStorage.removeItem(key);
}

/**
 * Получить агенты конкретного чата
 */
export function getGraphsByChatId(chatId: string): AgentGraph[] {
  const graphs = getGraphs();
  return graphs.filter(g => g.chatId === chatId);
}

/**
 * Получить "глобальные" агенты (без chatId) — библиотека шаблонов
 */
export function getGlobalGraphs(): AgentGraph[] {
  const graphs = getGraphs();
  return graphs.filter(g => !g.chatId);
}

/**
 * Создать пустой граф
 */
export function createEmptyGraph(name: string = 'Новый агент', chatId?: string): AgentGraph {
  const graph: AgentGraph = {
    id: `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chatId,
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
  };
  
  saveGraph(graph);
  return graph;
}
