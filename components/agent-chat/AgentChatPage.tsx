'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { Loader2 } from 'lucide-react';
import { AgentChatConfig, AgentChatThread, AgentChatMessage, AgentStep, FeedbackRequest, FeedbackResponse } from '@/lib/agent-engine/chat-types';
import {
  getAgentConfig,
  getThread,
  getThreads,
  saveThread,
  appendMessage,
  updateMessage,
  createThread,
} from '@/lib/agent-engine/agent-chat-store';
import { getGraphById } from '@/lib/agent-engine/graph-storage';
import { GraphExecutor } from '@/lib/agent-engine/executor';
import { AgentChatMessageComponent } from './AgentChatMessage';
import { InlineFeedbackWidget } from './InlineFeedbackWidget';

interface AgentChatPageProps {
  agentConfigId: string;
  threadId?: string;
  onBack: () => void;
}

export function AgentChatPage({ agentConfigId, threadId: initialThreadId, onBack }: AgentChatPageProps) {
  const [config, setConfig] = useState<AgentChatConfig | null>(null);
  const [thread, setThread] = useState<AgentChatThread | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
  
  const [feedbackRequest, setFeedbackRequest] = useState<{
    request: FeedbackRequest;
    resolve: (val: FeedbackResponse) => void;
  } | null>(null);
  
  const executorRef = useRef<GraphExecutor | null>(null);
  // 🔴 ФИКС #4: RAF ref для throttle стриминга
  const streamingRafRef = useRef<number | undefined>(undefined);

  // Load config and thread
  useEffect(() => {
    const loadedConfig = getAgentConfig(agentConfigId);
    setConfig(loadedConfig);

    if (initialThreadId) {
      const loadedThread = getThread(initialThreadId);
      setThread(loadedThread);
    } else if (loadedConfig) {
      // Создаём новый тред только если нет initialThreadId
      const newThread = createThread(agentConfigId, loadedConfig.graphId);
      setThread(newThread);
    }
  }, [agentConfigId, initialThreadId]);

  // Sync status back to main UI
  useEffect(() => {
    if (thread) {
      window.dispatchEvent(new CustomEvent('agent-chat-status', { 
        detail: { running: isRunning, title: thread.title } 
      }));
    }
  }, [isRunning, thread?.title]);

  // Listen for global events
  useEffect(() => {
    const onSend = (e: Event) => handleSendMessage((e as CustomEvent).detail);
    const onStop = () => handleStop();
    const onNewChat = () => handleNewChat();
    const onLoadThread = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      let threadId: string;
      
      if (typeof detail === 'object' && detail.threadId) {
        threadId = detail.threadId;
      } else {
        threadId = detail;
      }
      
      const loadedThread = getThread(threadId);
      if (loadedThread) {
        setThread(loadedThread);
        setFeedbackRequest(null);
        setCurrentSteps([]);
      }
    };

    window.addEventListener('agent-chat-send', onSend);
    window.addEventListener('agent-chat-stop', onStop);
    window.addEventListener('agent-chat-new-thread', onNewChat);
    window.addEventListener('agent-chat-load-thread', onLoadThread);

    return () => {
      window.removeEventListener('agent-chat-send', onSend);
      window.removeEventListener('agent-chat-stop', onStop);
      window.removeEventListener('agent-chat-new-thread', onNewChat);
      window.removeEventListener('agent-chat-load-thread', onLoadThread);
    };
  }, [thread, config, isRunning]);

  const handleStop = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.cancel();
      setIsRunning(false);
      
      if (thread) {
        const lastMsg = thread.messages[thread.messages.length - 1];
        if (lastMsg?.status === 'streaming') {
          updateMessage(thread.id, lastMsg.id, { 
            status: 'done', 
            content: lastMsg.content || '*(Остановлено пользователем)*' 
          });
          const updatedThread = getThread(thread.id);
          if (updatedThread) setThread(updatedThread);
        }
      }
    }
  }, [thread]);

  const handleNewChat = useCallback(() => {
    if (!config) return;
    const newThread = createThread(agentConfigId, config.graphId);
    setThread(newThread);
    setCurrentSteps([]);
    setFeedbackRequest(null);
    setIsRunning(false);
  }, [agentConfigId, config]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!thread || !config || isRunning) return;

    // Add user message
    const userMessage: AgentChatMessage = {
      id: nanoid(),
      role: 'user',
      userText: text,
      content: '',
      steps: [],
      timestamp: Date.now(),
      status: 'done',
    };

    appendMessage(thread.id, userMessage);
    const updatedThreadAfterUser = getThread(thread.id);
    if (updatedThreadAfterUser) setThread(updatedThreadAfterUser);

    setIsRunning(true);
    setCurrentSteps([]);

    const agentMessage: AgentChatMessage = {
      id: nanoid(),
      role: 'agent',
      content: '',
      steps: [],
      timestamp: Date.now(),
      status: 'streaming',
    };

    appendMessage(thread.id, agentMessage);
    const updatedThreadAfterAgent = getThread(thread.id);
    if (updatedThreadAfterAgent) setThread(updatedThreadAfterAgent);

    try {
      const graph = getGraphById(config.graphId);
      if (!graph) throw new Error('Graph not found');

      const executor = new GraphExecutor(graph, {
        chatMode: true,
        threadId: thread.id,
        onAgentStep: (step: AgentStep) => {
          setCurrentSteps(prev => {
            const idx = prev.findIndex(s => s.nodeId === step.nodeId && s.status === 'running');
            if (idx >= 0 && step.status !== 'running') {
              return prev.map((s, i) => i === idx ? step : s);
            }
            return [...prev, step];
          });
          
          const existingStepIdx = agentMessage.steps.findIndex(s => s.nodeId === step.nodeId && s.status === 'running');
          if (existingStepIdx >= 0 && step.status !== 'running') {
            agentMessage.steps[existingStepIdx] = step;
          } else {
            agentMessage.steps.push(step);
          }
        },
        onNodeStream: (nodeId: string, chunk: string, accumulated: string) => {
          // 🔴 ФИКС #4: Throttle стриминга через RAF для плавного отображения
          // Прямое обновление объекта без лишних setThread вызовов
          agentMessage.content = accumulated;
          
          // Throttle: обновляем React не чаще 60fps
          if (!streamingRafRef.current) {
            streamingRafRef.current = requestAnimationFrame(() => {
              updateMessage(thread.id, agentMessage.id, { content: accumulated });
              setThread(prev => {
                if (!prev) return null;
                const updated = { ...prev };
                const msgIndex = updated.messages.findIndex(m => m.id === agentMessage.id);
                if (msgIndex >= 0) updated.messages[msgIndex] = { ...agentMessage };
                return updated;
              });
              streamingRafRef.current = undefined;
            });
          }
        },
        onChatOutput: async (message: string) => {
          agentMessage.content = message;
          updateMessage(thread.id, agentMessage.id, { content: message });
          setThread(prev => {
            if (!prev) return null;
            const updated = { ...prev };
            const msgIndex = updated.messages.findIndex(m => m.id === agentMessage.id);
            if (msgIndex >= 0) updated.messages[msgIndex] = { ...agentMessage };
            return updated;
          });
        },
        onChatInputRequest: async (source: string, options?: Record<string, any>) => {
          if (source === 'user_message') return text;
          if (source === 'inline_feedback') {
            return new Promise((resolve) => {
              setFeedbackRequest({
                request: options as FeedbackRequest,
                resolve: (response) => {
                  setFeedbackRequest(null);
                  resolve(response);
                }
              });
            });
          }
          return null;
        },
      });

      executorRef.current = executor;
      const run = await executor.run(text);

      if (!agentMessage.content) {
        const finalResult = [...run.nodeResults].reverse().find(r => 
          r.output && typeof r.output === 'object' && ('output' in (r.output as any) || 'message' in (r.output as any))
        );
        agentMessage.content = (finalResult?.output as any)?.output || (finalResult?.output as any)?.message || 'Агент завершил работу';
      }

      agentMessage.status = 'done';
      updateMessage(thread.id, agentMessage.id, {
        content: agentMessage.content,
        status: 'done',
        steps: agentMessage.steps,
      });

      const finalThread = getThread(thread.id);
      if (finalThread) setThread(finalThread);
    } catch (error) {
      agentMessage.status = 'error';
      agentMessage.content = `Ошибка выполнения: ${error instanceof Error ? error.message : String(error)}`;
      updateMessage(thread.id, agentMessage.id, { status: 'error', content: agentMessage.content });
      const errorThread = getThread(thread.id);
      if (errorThread) setThread(errorThread);
    } finally {
      setIsRunning(false);
      setCurrentSteps([]);
      executorRef.current = null;
    }
  }, [thread, config, isRunning]);

  if (!config || !thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--text-dim)]" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      {thread.messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg border border-white/5"
            style={{ backgroundColor: config.avatarColor }}
          >
            {config.avatarEmoji}
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">
            {config.name}
          </h2>
          <p className="text-[var(--text-muted)] max-w-sm leading-relaxed text-sm">
            {config.description || 'Агент готов к работе.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {thread.messages.map((message) => (
            <AgentChatMessageComponent
              key={message.id}
              message={message}
              agentConfig={config}
            />
          ))}
          
          {/* Текущие шаги выполнения (Trace) */}
          {/* 🔴 ФИКС #5: Показываем ВСЕ шаги, не только running/error */}
          {isRunning && currentSteps.length > 0 && (
            <div className="my-8 font-mono text-[13px] ml-12 border-l border-white/5 pl-4 py-2 space-y-2">
              {currentSteps.map((step, idx) => (
                <div 
                  key={step.nodeId + idx} 
                  className={`flex items-center gap-3 transition-opacity ${
                    step.status === 'done' ? 'opacity-40 text-slate-400' :
                    step.status === 'running' ? 'text-white animate-pulse' :
                    step.status === 'error' ? 'text-red-400' :
                    'text-slate-500'
                  }`}
                >
                  {step.status === 'running' ? (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20 animate-pulse" />
                  ) : step.status === 'error' ? (
                    <span className="text-red-500 font-bold">×</span>
                  ) : step.status === 'done' ? (
                    <span className="text-emerald-500 text-xs">✓</span>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-600" />
                  )}
                  <span className="text-xs">
                    {String(idx + 1).padStart(2, '0')} → {step.nodeLabel}
                  </span>
                  {step.duration && (
                    <span className="text-[10px] text-slate-600 ml-auto">
                      {(step.duration / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Виджет фидбека */}
          {feedbackRequest && (
            <div className="my-6">
              <InlineFeedbackWidget
                request={feedbackRequest.request}
                onResponse={feedbackRequest.resolve}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
