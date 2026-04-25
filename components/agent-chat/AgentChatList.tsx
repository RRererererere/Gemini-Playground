'use client';

import React, { useState, useEffect } from 'react';
import { getAgentConfigs, getThreads } from '@/lib/agent-engine/agent-chat-store';
import { AgentChatConfig } from '@/lib/agent-engine/chat-types';
import { MessageSquare, Play, Settings, Bot } from 'lucide-react';

interface AgentChatListProps {
  onSelectAgent: (configId: string) => void;
}

export function AgentChatList({ onSelectAgent }: AgentChatListProps) {
  const [configs, setConfigs] = useState<AgentChatConfig[]>([]);

  useEffect(() => {
    const loadConfigs = () => {
      const allConfigs = getAgentConfigs(); // Show all configs to debug if they exist
      setConfigs(allConfigs);
    };

    loadConfigs();

    // Refresh every 2 seconds to catch new publications
    const interval = setInterval(loadConfigs, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenGraph = (graphId?: string) => {
    window.location.href = graphId ? `/agents?id=${graphId}` : '/agents';
  };

  if (configs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-[var(--surface-0)]">
        <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 animate-pulse">
          <Bot size={40} className="text-[var(--text-muted)]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
          Нет опубликованных агентов
        </h2>
        <p className="text-[var(--text-dim)] max-w-md mb-8 text-lg">
          Создайте свой первый интеллект в редакторе графов и опубликуйте его, чтобы начать диалог.
        </p>
        <button
          onClick={() => handleOpenGraph()}
          className="px-6 py-3 bg-[var(--surface-4)] hover:bg-[var(--surface-5)] text-white rounded-xl font-medium transition-all shadow-lg hover:scale-105 active:scale-95"
        >
          Создать агента в редакторе
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[var(--surface-0)] h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">Мои агенты</h1>
            <p className="text-[var(--text-dim)] mt-1">Выберите агента для начала чата</p>
          </div>
          <button
            onClick={() => handleOpenGraph()}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg transition-colors"
          >
            <Settings size={18} />
            Управление графами
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {configs.map((config) => {
            const threads = getThreads(config.id);
            const lastThread = [...threads].sort((a, b) => b.updatedAt - a.updatedAt)[0];

            return (
              <div
                key={config.id}
                className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-strong)] transition-all group hover:shadow-xl cursor-pointer flex flex-col"
                onClick={() => onSelectAgent(config.id)}
              >
                {/* Avatar & Name */}
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-sm border border-white/5 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: config.avatarColor }}
                  >
                    {config.avatarEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-[var(--text-primary)] truncate group-hover:text-white transition-colors">
                      {config.name}
                    </h3>
                    {config.description ? (
                      <p className="text-sm text-[var(--text-dim)] line-clamp-2 mt-1 leading-relaxed">
                        {config.description}
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--text-muted)] italic mt-1">Нет описания</p>
                    )}
                  </div>
                </div>

                <div className="mt-auto">
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] mb-5 bg-black/20 rounded-lg p-2 border border-white/5">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-[var(--text-muted)]" />
                      <span className="font-medium text-[var(--text-secondary)]">{threads.length}</span>
                      <span>{threads.length === 1 ? 'чат' : (threads.length > 1 && threads.length < 5 ? 'чата' : 'чатов')}</span>
                    </div>
                    {lastThread && (
                      <div className="ml-auto">
                        {new Date(lastThread.updatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--surface-4)] hover:bg-[var(--surface-5)] text-white rounded-xl transition-all font-medium shadow-md"
                    >
                      <Play size={16} fill="currentColor" />
                      <span>Открыть чат</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenGraph(config.graphId);
                      }}
                      className="p-2.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] rounded-xl transition-colors border border-[var(--border)]"
                      title="Редактировать граф"
                    >
                      <Settings size={20} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
