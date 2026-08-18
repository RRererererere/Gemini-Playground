'use client';

import React from 'react';
import { getThreads, deleteThread, createThread, getAgentConfig } from '@/lib/agent-engine/agent-chat-store';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';

interface AgentThreadsSidebarProps {
  agentConfigId: string;
  currentThreadId: string;
  onThreadSelect: (threadId: string) => void;
  onClose: () => void;
}

export function AgentThreadsSidebar({
  agentConfigId,
  currentThreadId,
  onThreadSelect,
  onClose,
}: AgentThreadsSidebarProps) {
  const threads = getThreads(agentConfigId);
  const config = getAgentConfig(agentConfigId);

  const handleNewThread = () => {
    if (!config) return;
    const newThread = createThread(agentConfigId, config.graphId);
    onThreadSelect(newThread.id);
  };

  const handleDeleteThread = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Удалить этот чат?')) {
      deleteThread(threadId);
      if (threadId === currentThreadId && threads.length > 1) {
        const remaining = threads.filter(t => t.id !== threadId);
        if (remaining.length > 0) {
          onThreadSelect(remaining[0].id);
        }
      }
    }
  };

  return (
    <div className="w-64 bg-[var(--surface-1)] border-r border-[var(--border)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h3 className="font-medium text-[var(--text-primary)]">Чаты</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--surface-3)] rounded transition-colors"
        >
          <X size={16} className="text-[var(--text-dim)]" />
        </button>
      </div>

      {/* New Thread Button */}
      <div className="p-3 border-b border-[var(--border)]">
        <button
          onClick={handleNewThread}
          className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          <span className="text-sm font-medium">Новый чат</span>
        </button>
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="p-4 text-center text-sm text-[var(--text-dim)]">
            Нет чатов
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {threads
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => onThreadSelect(thread.id)}
                  className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg transition-colors group ${
                    thread.id === currentThreadId
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : 'hover:bg-[var(--surface-3)] text-[var(--text-primary)]'
                  }`}
                >
                  <MessageSquare size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium truncate">{thread.title}</div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {thread.messages.length} сообщений
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteThread(thread.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
