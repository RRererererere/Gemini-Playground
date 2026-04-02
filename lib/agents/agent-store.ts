// Agent Storage - CRUD operations for agents in localStorage

import type { Agent } from './types';

const AGENTS_KEY = 'gemini_agents_index';

// Custom event для обновления UI
export const AGENTS_UPDATED_EVENT = 'agents_updated';

function dispatchAgentsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AGENTS_UPDATED_EVENT));
  }
}

export function getAgents(): Agent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AGENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Agent[];
  } catch {
    return [];
  }
}

export function getAgentById(id: string): Agent | null {
  const agents = getAgents();
  return agents.find(a => a.id === id) || null;
}

export function saveAgent(agent: Agent): void {
  if (typeof window === 'undefined') return;
  
  const agents = getAgents();
  const idx = agents.findIndex(a => a.id === agent.id);
  
  if (idx >= 0) {
    agents[idx] = { ...agent, updatedAt: Date.now() };
  } else {
    agents.push(agent);
  }
  
  localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
  dispatchAgentsUpdated();
}

export function deleteAgent(id: string): void {
  if (typeof window === 'undefined') return;
  
  const agents = getAgents();
  const filtered = agents.filter(a => a.id !== id);
  
  localStorage.setItem(AGENTS_KEY, JSON.stringify(filtered));
  dispatchAgentsUpdated();
}

export function updateAgent(id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt'>>): void {
  const agent = getAgentById(id);
  if (!agent) return;
  
  saveAgent({ ...agent, ...updates, updatedAt: Date.now() });
}

export function starAgent(id: string): void {
  updateAgent(id, { starred: true });
}

export function unstarAgent(id: string): void {
  updateAgent(id, { starred: false });
}
