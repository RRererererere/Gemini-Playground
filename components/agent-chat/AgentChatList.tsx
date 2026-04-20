'use client';

import React, { useState, useEffect } from 'react';
import { getAgentConfigs, getThreads } from '@/lib/agent-engine/agent-chat-store';
import { AgentChatConfig } from '@/lib/agent-engine/chat-types';
import { MessageSquare, Play, Settings } from 'lucide-react';

interface AgentChatListProps {
  onOpenAgent: (configId: string, threadId?: string) => void;
  onOpenGraph: (graphId: string) => void;
}

export function AgentChatList({ onOpenAgent, onOpenGraph }: AgentChatListProps) {
  const [configs, setConfigs] = useState<AgentChatConfig[]>([]);

  useEffect(() => {
    const loadConfigs = () => {
      const allConfigs = getAgentConfigs().filter(c => c.isPublished);
      setConfigs(allConfigs);
    };

    loadConfigs();

    // Refresh every second to catch new publications
    const interval = setInterval(loadConfigs, 1000);
    return () => clearInterval(interval);
  }, []);

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
          <MessageSquare size={32} className="text-[var(--text-dim)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          Нет опубликованных агентов
        </h2>
        <p className="text-[var(--text-dim)] max-w-md mb-6">
          Создайте агента в редакторе графов и опубликуйте его, чтобы начать чат
        </p>
        <button
          onClick={() => onOpenGraph('')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Создать агента
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Мои агенты</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((config) => {
            const threads = getThreads(config.id);
            const lastThread = threads.sort((a, b) => b.updatedAt - a.updatedAt)[0];

            return (
              <div
                key={config.id}
                className="bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 hover:border-indigo-500/50 transition-all group"
              >
                {/* Avatar & Name */}
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: config.avatarColor }}
                  >
                    {config.avatarEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--text-primary)] truncate">
                      {config.name}
                    </h3>
                    {config.description && (
                      <p className="text-sm text-[var(--text-dim)] line-clamp-2 mt-1">
                        {config.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] mb-4">
                  <div className="flex items-center gap-1">
                    <MessageSquare size={14} />
                    <span>{threads.length} {threads.length === 1 ? 'чат' : 'чатов'}</span>
                  </div>
                  {lastThread && (
                    <div>
                      Последний: {new Date(lastThread.updatedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onOpenAgent(config.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    <Play size={16} />
                    <span className="text-sm font-medium">Новый чат</span>
                  </button>
                  <button
                    onClick={() => onOpenGraph(config.graphId)}
                    className="p-2 hover:bg-[var(--surface-3)] rounded-lg transition-colors"
                    title="Открыть граф"
                  >
                    <Settings size={18} className="text-[var(--text-dim)]" />
                  </button>
                </div>

                {/* Onboarding */}
                {threads.length === 0 && (
                  <div className="mt-3 text-xs text-center text-[var(--text-dim)] italic">
                    Начните разговор →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
