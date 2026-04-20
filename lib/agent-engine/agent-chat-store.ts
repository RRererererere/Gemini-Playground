/**
 * Хранилище для агентного чата
 * localStorage-based CRUD операции
 */

import { nanoid } from 'nanoid';
import {
  AgentChatConfig,
  AgentChatThread,
  AgentChatMessage,
} from './chat-types';

const STORAGE_KEY_CONFIGS = 'agent_chat_configs';
const STORAGE_KEY_THREADS = 'agent_chat_threads';
const STORAGE_KEY_ACTIVE_THREAD = 'agent_chat_active_thread';

// ============================================================================
// AGENT CHAT CONFIG
// ============================================================================

export function getAgentConfigs(): AgentChatConfig[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_CONFIGS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load agent configs:', e);
    return [];
  }
}

export function getAgentConfig(id: string): AgentChatConfig | null {
  const configs = getAgentConfigs();
  return configs.find(c => c.id === id) || null;
}

export function getAgentConfigByGraphId(graphId: string): AgentChatConfig | null {
  const configs = getAgentConfigs();
  return configs.find(c => c.graphId === graphId) || null;
}

export function saveAgentConfig(config: AgentChatConfig): void {
  const configs = getAgentConfigs();
  const index = configs.findIndex(c => c.id === config.id);
  
  if (index >= 0) {
    configs[index] = { ...config, updatedAt: Date.now() };
  } else {
    configs.push(config);
  }
  
  localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs));
}

export function deleteAgentConfig(id: string): void {
  const configs = getAgentConfigs();
  const filtered = configs.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(filtered));
  
  // Удаляем все треды этого агента
  const threads = getThreads(id);
  threads.forEach(t => deleteThread(t.id));
}

export function createAgentConfig(
  graphId: string,
  name: string,
  description: string = ''
): AgentChatConfig {
  const config: AgentChatConfig = {
    id: nanoid(8),
    graphId,
    name,
    description,
    avatarEmoji: '🤖',
    avatarColor: '#6366f1',
    isPublished: true,
    threadIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  saveAgentConfig(config);
  return config;
}

// ============================================================================
// AGENT CHAT THREAD
// ============================================================================

export function getThreads(agentConfigId?: string): AgentChatThread[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_THREADS);
    const threads: AgentChatThread[] = data ? JSON.parse(data) : [];
    
    if (agentConfigId) {
      return threads.filter(t => t.agentConfigId === agentConfigId);
    }
    
    return threads;
  } catch (e) {
    console.error('Failed to load threads:', e);
    return [];
  }
}

export function getThread(threadId: string): AgentChatThread | null {
  const threads = getThreads();
  return threads.find(t => t.id === threadId) || null;
}

export function createThread(agentConfigId: string, graphId: string): AgentChatThread {
  const thread: AgentChatThread = {
    id: nanoid(8),
    agentConfigId,
    graphId,
    title: 'Новый чат',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'idle',
  };
  
  saveThread(thread);
  
  // Добавляем ID треда в конфиг
  const config = getAgentConfig(agentConfigId);
  if (config) {
    config.threadIds.push(thread.id);
    saveAgentConfig(config);
  }
  
  return thread;
}

export function saveThread(thread: AgentChatThread): void {
  const threads = getThreads();
  const index = threads.findIndex(t => t.id === thread.id);
  
  thread.updatedAt = Date.now();
  
  if (index >= 0) {
    threads[index] = thread;
  } else {
    threads.push(thread);
  }
  
  localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(threads));
}

export function deleteThread(threadId: string): void {
  const threads = getThreads();
  const thread = threads.find(t => t.id === threadId);
  
  if (thread) {
    // Удаляем из конфига
    const config = getAgentConfig(thread.agentConfigId);
    if (config) {
      config.threadIds = config.threadIds.filter(id => id !== threadId);
      saveAgentConfig(config);
    }
  }
  
  const filtered = threads.filter(t => t.id !== threadId);
  localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(filtered));
}

// ============================================================================
// MESSAGES
// ============================================================================

export function appendMessage(threadId: string, message: AgentChatMessage): void {
  const thread = getThread(threadId);
  if (!thread) return;
  
  thread.messages.push(message);
  
  // Авто-генерация заголовка из первого сообщения
  if (thread.messages.length === 1 && message.role === 'user' && message.userText) {
    thread.title = message.userText.slice(0, 50) + (message.userText.length > 50 ? '...' : '');
  }
  
  saveThread(thread);
}

export function updateMessage(
  threadId: string,
  messageId: string,
  updates: Partial<AgentChatMessage>
): void {
  const thread = getThread(threadId);
  if (!thread) return;
  
  const index = thread.messages.findIndex(m => m.id === messageId);
  if (index >= 0) {
    thread.messages[index] = { ...thread.messages[index], ...updates };
    saveThread(thread);
  }
}

export function getLastMessage(threadId: string): AgentChatMessage | null {
  const thread = getThread(threadId);
  if (!thread || thread.messages.length === 0) return null;
  return thread.messages[thread.messages.length - 1];
}

// ============================================================================
// ACTIVE THREAD
// ============================================================================

export function getActiveThreadId(): string | null {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_THREAD);
}

export function setActiveThreadId(threadId: string | null): void {
  if (threadId) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, threadId);
  } else {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_THREAD);
  }
}
