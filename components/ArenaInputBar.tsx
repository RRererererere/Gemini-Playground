'use client';

import type { ArenaAgent } from '@/lib/arena-types';
import { Zap } from 'lucide-react';

interface ArenaInputBarProps {
  agents: ArenaAgent[];
  isStreaming: boolean;
  streamingAgentId: string | null;
  responseMode: 'auto' | 'manual';
  onTriggerAgent: (agentId: string) => void;
  onToggleMode: () => void;
}

export default function ArenaInputBar({
  agents,
  isStreaming,
  streamingAgentId,
  responseMode,
  onTriggerAgent,
  onToggleMode,
}: ArenaInputBarProps) {
  const activeAgents = agents.filter(a => a.isActive);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-[var(--border-subtle)] bg-[rgba(10,10,10,0.6)] backdrop-blur-sm">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)] flex-shrink-0 hidden sm:block">
        Отправить:
      </span>

      {/* Auto mode: just the ⚡ indicator */}
      {responseMode === 'auto' && (
        <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 flex-shrink-0">
          <Zap size={10} className="text-amber-400" />
          Авто — все агенты отвечают по очереди
        </span>
      )}

      {/* Manual mode: agent trigger buttons */}
      {responseMode === 'manual' && (
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1">
          {activeAgents.map(agent => {
            const isBusy = isStreaming && streamingAgentId === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => onTriggerAgent(agent.id)}
                disabled={isStreaming}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{
                  borderColor: agent.color + '50',
                  background: agent.color + '18',
                  color: agent.color,
                }}
                title={`Генерировать ответ ${agent.name}`}
              >
                <span className="text-sm">{agent.emoji}</span>
                <span className="hidden sm:inline">{agent.name}</span>
                {isBusy && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Mode toggle */}
      <button
        onClick={onToggleMode}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all flex-shrink-0 border ${
          responseMode === 'auto'
            ? 'border-amber-400/30 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
            : 'border-[var(--border)] bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)]'
        }`}
        title={responseMode === 'auto' ? 'Переключить на ручной режим' : 'Переключить на авто режим'}
      >
        <Zap size={10} />
        {responseMode === 'auto' ? 'Авто' : 'Ручной'}
      </button>
    </div>
  );
}
