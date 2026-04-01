'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Message, Part, AttachedFile, ApiKeyEntry, SavedChat, Provider, UniversalModel } from '@/types';
import type { ArenaAgent, ArenaSession } from './arena-types';
import { createDefaultAgent, AGENT_COLORS } from './arena-types';
import {
  loadArenaSessions,
  saveArenaSession,
  deleteArenaSession as deleteArenaSessionStorage,
  getActiveArenaSessionId,
  setActiveArenaSessionId,
} from './arena-storage';
import { streamArenaAgent } from './arena-stream';
import { getVisibleMessageText } from './gemini';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useArena(globalApiKeys: Record<string, ApiKeyEntry[]>, providers: Provider[], activeModel: import('@/types').ActiveModel | null, allModels: import('@/types').UniversalModel[] = []) {
  const globalModel = activeModel?.modelId || '';
  const globalProviderId = activeModel?.providerId || 'google';
  const [sessions, setSessions] = useState<ArenaSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);

  // Streaming
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingAgentId, setStreamingAgentId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Derived
  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  // Load on mount
  useEffect(() => {
    const loaded = loadArenaSessions();
    setSessions(loaded);
    const activeId = getActiveArenaSessionId();
    if (activeId && loaded.find(s => s.id === activeId)) {
      setActiveSessionIdState(activeId);
    }
  }, []);

  // Persist session on change
  const updateSession = useCallback((updater: (session: ArenaSession) => ArenaSession) => {
    setSessions(prev => {
      const updated = prev.map(s => {
        if (s.id !== activeSessionId) return s;
        const next = updater(s);
        // Save async
        saveArenaSession(next);
        return next;
      });
      return updated;
    });
  }, [activeSessionId]);

  // ═══════ Session CRUD ═══════

  const createSession = useCallback(() => {
    const session: ArenaSession = {
      id: generateId(),
      title: 'Новая арена',
      agents: [
        { ...createDefaultAgent(0), model: globalModel, providerId: globalProviderId },
        { ...createDefaultAgent(1), model: globalModel, providerId: globalProviderId },
      ],
      messages: [],
      responseMode: 'auto',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveArenaSession(session);
    setSessions(prev => [...prev, session]);
    setActiveSessionIdState(session.id);
    setActiveArenaSessionId(session.id);
    return session;
  }, [globalModel, globalProviderId]);

  const loadSession = useCallback((id: string) => {
    setActiveSessionIdState(id);
    setActiveArenaSessionId(id);
  }, []);

  const branchSession = useCallback((messageId: string) => {
    if (!activeSession) return null;
    const msgIdx = activeSession.messages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return null;
    
    // Копируем сообщения до указанного (включительно)
    const branchMessages = activeSession.messages.slice(0, msgIdx + 1).map(m => ({ ...m }));
    
    const session: ArenaSession = {
      ...activeSession,
      id: generateId(),
      title: `${activeSession.title} (Ветка)`,
      messages: branchMessages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    saveArenaSession(session);
    setSessions(prev => [...prev, session]);
    setActiveSessionIdState(session.id);
    setActiveArenaSessionId(session.id);
    return session;
  }, [activeSession]);

  const deleteSession = useCallback((id: string) => {
    deleteArenaSessionStorage(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionIdState(null);
      setActiveArenaSessionId(null);
    }
  }, [activeSessionId]);

  // ═══════ Import Chat → Arena ═══════

  const importChatAsSession = useCallback((chat: SavedChat) => {
    // Ищем провайдера для модели чата
    const chatModelDetails = allModels.find(m => m.id === chat.model);
    const chatProviderId = chatModelDetails?.providerId || 'google';

    const geminiAgent: ArenaAgent = {
      id: generateId(),
      name: 'Gemini',
      emoji: '✨',
      color: AGENT_COLORS[2], // blue
      model: globalModel,
      providerId: chatProviderId,
      apiKey: '',
      systemPrompt: '',
      temperature: 0.8,
      maxOutputTokens: 8192,
      isActive: true,
      skillIds: [],
      tools: [],
    };

    // Маркируем model-сообщения из чата как сообщения агента "Gemini"
    const migratedMessages: Message[] = chat.messages.map(m => {
      if (m.role === 'model') {
        return { ...m, arenaAgentId: geminiAgent.id };
      }
      return { ...m };
    });

    const session: ArenaSession = {
      id: generateId(),
      title: `🔄 ${chat.title}`,
      agents: [geminiAgent],
      messages: migratedMessages,
      responseMode: 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveArenaSession(session);
    setSessions(prev => [...prev, session]);
    setActiveSessionIdState(session.id);
    setActiveArenaSessionId(session.id);
    return session;
  }, [globalModel, allModels]);

  // ═══════ Agent CRUD ═══════

  const addAgent = useCallback(() => {
    updateSession(s => ({
      ...s,
      agents: [...s.agents, { ...createDefaultAgent(s.agents.length), model: globalModel, providerId: globalProviderId }],
      updatedAt: Date.now(),
    }));
  }, [updateSession, globalModel, globalProviderId]);

  const updateAgent = useCallback((agent: ArenaAgent) => {
    updateSession(s => ({
      ...s,
      agents: s.agents.map(a => a.id === agent.id ? agent : a),
      updatedAt: Date.now(),
    }));
  }, [updateSession]);

  const removeAgent = useCallback((agentId: string) => {
    updateSession(s => ({
      ...s,
      agents: s.agents.filter(a => a.id !== agentId),
      updatedAt: Date.now(),
    }));
  }, [updateSession]);

  const updateSessionSystemPrompt = useCallback((prompt: string) => {
    updateSession(s => ({
      ...s,
      systemPrompt: prompt,
      updatedAt: Date.now(),
    }));
  }, [updateSession]);

  // ═══════ Message Edit / Delete (Sandbox) ═══════

  const editMessage = useCallback((messageId: string, newParts: Part[]) => {
    updateSession(s => ({
      ...s,
      messages: s.messages.map(m =>
        m.id === messageId ? { ...m, parts: newParts } : m
      ),
      updatedAt: Date.now(),
    }));
  }, [updateSession]);

  const deleteMessage = useCallback((messageId: string) => {
    updateSession(s => ({
      ...s,
      messages: s.messages.filter(m => m.id !== messageId),
      updatedAt: Date.now(),
    }));
  }, [updateSession]);

  // ═══════ Response Mode ═══════

  const toggleResponseMode = useCallback(() => {
    updateSession(s => ({
      ...s,
      responseMode: s.responseMode === 'auto' ? 'manual' : 'auto',
      updatedAt: Date.now(),
    }));
  }, [updateSession]);

  // ═══════ Streaming ═══════

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingAgentId(null);
  }, []);

  const continueAgentStream = useCallback(async (messageId: string) => {
    if (!activeSession || isStreaming) return;

    const msgIdx = activeSession.messages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;
    const msg = activeSession.messages[msgIdx];
    const agent = activeSession.agents.find(a => a.id === msg.arenaAgentId);
    if (!agent) return;

    let currentMessages = [...activeSession.messages];
    
    const updateUI = (s: ArenaSession) => {
      setSessions(prev => prev.map(existing => existing.id === s.id ? s : existing));
    };

    const abort = new AbortController();
    abortRef.current = abort;
    setIsStreaming(true);
    setStreamingAgentId(agent.id);

    try {
      await streamArenaAgent({
        agent,
        session: activeSession,
        messages: currentMessages, // Передаем все сообщения, Gemini API продолжит последнее
        globalApiKeys,
        providers,
        targetMessageId: messageId,
        onChunk: (text) => {
          currentMessages = currentMessages.map(m => {
            if (m.id !== messageId) return m;
            const existing = m.parts.find(p => 'text' in p) as { text: string } | undefined;
            if (existing) {
              return {
                ...m,
                parts: m.parts.map(p => 'text' in p ? { text: existing.text + text } : p),
              };
            }
            return { ...m, parts: [...m.parts, { text }] };
          });
          const updatedSession = { ...activeSession, messages: currentMessages, updatedAt: Date.now() };
          updateUI(updatedSession);
        },
        onDone: (parts) => {
          // Просто снимаем флаг стриминга, текст уже добавлен
          currentMessages = currentMessages.map(m =>
            m.id === messageId ? { ...m, isStreaming: false } : m
          );
          const finalSession = { ...activeSession, messages: currentMessages, updatedAt: Date.now() };
          updateUI(finalSession);
          saveArenaSession(finalSession);
        },
        onError: (error) => {
          currentMessages = currentMessages.map(m =>
            m.id === messageId ? { ...m, error, isStreaming: false } : m
          );
          updateUI({ ...activeSession, messages: currentMessages, updatedAt: Date.now() });
        },
        signal: abort.signal,
      });
    } finally {
      setIsStreaming(false);
      setStreamingAgentId(null);
      abortRef.current = null;
    }
  }, [activeSession, isStreaming, globalApiKeys, providers]);

  const runAgentStream = useCallback(async (
    session: ArenaSession,
    agent: ArenaAgent,
    messagesSnapshot: Message[],
    onUpdate: (session: ArenaSession) => void,
  ) => {
    const targetMessageId = generateId();
    const placeholderMsg: Message = {
      id: targetMessageId,
      role: 'model',
      parts: [{ text: '' }],
      isStreaming: true,
      arenaAgentId: agent.id,
      modelName: agent.model,
    };

    let currentMessages = [...messagesSnapshot, placeholderMsg];
    
    // Обновляем UI
    const updatedSession = {
      ...session,
      messages: currentMessages,
      updatedAt: Date.now(),
    };
    onUpdate(updatedSession);

    const abort = new AbortController();
    abortRef.current = abort;
    setIsStreaming(true);
    setStreamingAgentId(agent.id);

    try {
      await streamArenaAgent({
        agent,
        session: session,
        messages: messagesSnapshot,
        globalApiKeys,
        providers,
        targetMessageId,
        onChunk: (text) => {
          currentMessages = currentMessages.map(m => {
            if (m.id !== targetMessageId) return m;
            const existing = m.parts.find(p => 'text' in p) as { text: string } | undefined;
            if (existing) {
              return {
                ...m,
                parts: m.parts.map(p => 'text' in p ? { text: existing.text + text } : p),
              };
            }
            return { ...m, parts: [{ text }] };
          });
          onUpdate({ ...updatedSession, messages: currentMessages });
        },
        onDone: (parts) => {
          currentMessages = currentMessages.map(m =>
            m.id === targetMessageId ? { ...m, parts: parts.length > 0 ? parts : m.parts, isStreaming: false } : m
          );
          const finalSession = { ...updatedSession, messages: currentMessages };
          onUpdate(finalSession);
          saveArenaSession(finalSession);
        },
        onError: (error) => {
          currentMessages = currentMessages.map(m =>
            m.id === targetMessageId ? { ...m, error, isStreaming: false } : m
          );
          onUpdate({ ...updatedSession, messages: currentMessages });
        },
        signal: abort.signal,
      });
    } finally {
      setIsStreaming(false);
      setStreamingAgentId(null);
      abortRef.current = null;
    }

    return currentMessages;
  }, [globalApiKeys, providers]);

  // Send user message → (auto: trigger all agents sequentially)
  const sendUserMessage = useCallback(async (text: string, files?: AttachedFile[]) => {
    if (!activeSession || isStreaming) return;

    const userParts: Part[] = [];
    if (text) userParts.push({ text });
    files?.forEach(f => {
      userParts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    });

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      parts: userParts,
      files: files && files.length > 0 ? files : undefined,
    };

    // Обновляем title при первом сообщении
    let session = { ...activeSession };
    if (session.messages.length === 0 && text) {
      session.title = text.slice(0, 50).trim() + (text.length > 50 ? '…' : '');
    }
    session.messages = [...session.messages, userMsg];
    session.updatedAt = Date.now();
    
    // Сохраняем и обновляем UI
    const updateUI = (s: ArenaSession) => {
      setSessions(prev => prev.map(existing => existing.id === s.id ? s : existing));
    };
    updateUI(session);
    saveArenaSession(session);

    // В auto-режиме запускаем всех активных агентов последовательно
    if (session.responseMode === 'auto') {
      const activeAgents = session.agents.filter(a => a.isActive);
      let msgs = session.messages;
      for (const agent of activeAgents) {
        msgs = await runAgentStream(
          { ...session, messages: msgs },
          agent,
          msgs,
          (s) => {
            session = s;
            updateUI(s);
          },
        );
      }
    }
  }, [activeSession, isStreaming, runAgentStream]);

  // Trigger specific agent manually
  const triggerAgent = useCallback(async (agentId: string) => {
    if (!activeSession || isStreaming) return;

    const agent = activeSession.agents.find(a => a.id === agentId);
    if (!agent) return;

    const updateUI = (s: ArenaSession) => {
      setSessions(prev => prev.map(existing => existing.id === s.id ? s : existing));
    };

    await runAgentStream(
      activeSession,
      agent,
      activeSession.messages,
      updateUI,
    );
  }, [activeSession, isStreaming, runAgentStream]);

  return {
    sessions,
    activeSession,
    activeSessionId,
    isStreaming,
    streamingAgentId,
    
    // Session actions
    createSession,
    loadSession,
    branchSession,
    deleteSession,
    importChatAsSession,
    updateSessionSystemPrompt,
    
    // Agent actions
    addAgent,
    updateAgent,
    removeAgent,
    
    // Message editing (sandbox)
    editMessage,
    deleteMessage,
    
    // Messaging
    sendUserMessage,
    triggerAgent,
    continueAgentStream,
    stopStreaming,
    toggleResponseMode,
  };
}
