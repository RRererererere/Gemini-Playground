'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { ArrowLeft, MessageSquare, Loader2 } from 'lucide-react';
import { AgentChatConfig, AgentChatThread, AgentChatMessage, AgentStep } from '@/lib/agent-engine/chat-types';
import {
  getAgentConfig,
  getThread,
  saveThread,
  appendMessage,
  updateMessage,
  createThread,
} from '@/lib/agent-engine/agent-chat-store';
import { getGraphById } from '@/lib/agent-engine/graph-storage';
import { GraphExecutor } from '@/lib/agent-engine/executor';
import { AgentChatMessageComponent } from './AgentChatMessage';
import { AgentChatInput } from './AgentChatInput';
import { AgentThreadsSidebar } from './AgentThreadsSidebar';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const executorRef = useRef<GraphExecutor | null>(null);
  const pendingUserInputRef = useRef<{ resolve: (val: any) => void; reject: (err: any) => void } | null>(null);

  // Load config and thread
  useEffect(() => {
    const loadedConfig = getAgentConfig(agentConfigId);
    setConfig(loadedConfig);

    if (initialThreadId) {
      const loadedThread = getThread(initialThreadId);
      setThread(loadedThread);
    } else if (loadedConfig) {
      // Create new thread
      const newThread = createThread(agentConfigId, loadedConfig.graphId);
      setThread(newThread);
    }
  }, [agentConfigId, initialThreadId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages]);

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
    setThread(prev => prev ? { ...prev, messages: [...prev.messages, userMessage] } : null);

    // Start agent execution
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
    setThread(prev => prev ? { ...prev, messages: [...prev.messages, agentMessage] } : null);

    try {
      const graph = getGraphById(config.graphId);
      if (!graph) {
        throw new Error('Graph not found');
      }

      const executor = new GraphExecutor(graph, {
        chatMode: true,
        threadId: thread.id,
        onAgentStep: (step: AgentStep) => {
          setCurrentSteps(prev => [...prev, step]);
          agentMessage.steps.push(step);
        },
        onNodeStream: (nodeId: string, chunk: string, accumulated: string) => {
          agentMessage.content = accumulated;
          updateMessage(thread.id, agentMessage.id, { content: accumulated });
          setThread(prev => {
            if (!prev) return null;
            const updated = { ...prev };
            const msgIndex = updated.messages.findIndex(m => m.id === agentMessage.id);
            if (msgIndex >= 0) {
              updated.messages[msgIndex] = { ...agentMessage };
            }
            return updated;
          });
        },
        onChatInputRequest: async (source: string, options?: Record<string, any>) => {
          if (source === 'user_message') {
            return text;
          }
          if (source === 'inline_feedback') {
            // Show inline feedback widget
            return new Promise((resolve, reject) => {
              pendingUserInputRef.current = { resolve, reject };
              // TODO: Show feedback modal
            });
          }
          return null;
        },
        onRunComplete: (run) => {
          console.log('[AgentChatPage] Run complete:', run);
        },
      });

      executorRef.current = executor;
      const run = await executor.run({ userMessage: text });

      // Extract final output
      const finalOutput = run.nodeResults
        .reverse()
        .find(r => r.output && typeof r.output === 'object' && 'output' in (r.output as any));

      agentMessage.content = (finalOutput?.output as any)?.output || agentMessage.content || 'No response';
      agentMessage.status = 'done';

      updateMessage(thread.id, agentMessage.id, {
        content: agentMessage.content,
        status: 'done',
        steps: agentMessage.steps,
      });

      setThread(prev => {
        if (!prev) return null;
        const updated = { ...prev };
        const msgIndex = updated.messages.findIndex(m => m.id === agentMessage.id);
        if (msgIndex >= 0) {
          updated.messages[msgIndex] = { ...agentMessage };
        }
        return updated;
      });
    } catch (error) {
      console.error('[AgentChatPage] Execution error:', error);
      agentMessage.status = 'error';
      agentMessage.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
      updateMessage(thread.id, agentMessage.id, { status: 'error', content: agentMessage.content });
    } finally {
      setIsRunning(false);
      setCurrentSteps([]);
      executorRef.current = null;
    }
  }, [thread, config, isRunning]);

  const handleStop = useCallback(() => {
    if (executorRef.current) {
      // TODO: Implement abort
      setIsRunning(false);
    }
  }, []);

  if (!config || !thread) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--surface-0)]">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--surface-0)]">
      {/* Sidebar */}
      {sidebarOpen && (
        <AgentThreadsSidebar
          agentConfigId={agentConfigId}
          currentThreadId={thread.id}
          onThreadSelect={(threadId) => {
            const newThread = getThread(threadId);
            setThread(newThread);
          }}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-1)]">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[var(--surface-3)] rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-[var(--text-dim)]" />
          </button>

          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: config.avatarColor }}
            >
              {config.avatarEmoji}
            </div>
            <div>
              <div className="font-medium text-[var(--text-primary)]">{config.name}</div>
              {config.description && (
                <div className="text-xs text-[var(--text-dim)]">{config.description}</div>
              )}
            </div>
          </div>

          <div className="ml-auto">
            <button
              onClick={() => {
                const graph = getGraphById(config.graphId);
                if (graph) {
                  // TODO: Navigate to graph editor
                  console.log('Open graph:', graph.id);
                }
              }}
              className="px-3 py-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-colors"
            >
              Открыть граф
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {thread.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-5xl mb-4"
                style={{ backgroundColor: config.avatarColor + '20' }}
              >
                {config.avatarEmoji}
              </div>
              <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                {config.name}
              </h2>
              <p className="text-[var(--text-dim)] max-w-md">
                {config.description || 'Начните разговор с агентом'}
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {thread.messages.map((message) => (
                <AgentChatMessageComponent
                  key={message.id}
                  message={message}
                  agentConfig={config}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[var(--border)] bg-[var(--surface-1)]">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <AgentChatInput
              onSend={handleSendMessage}
              onStop={handleStop}
              disabled={isRunning}
              isRunning={isRunning}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
