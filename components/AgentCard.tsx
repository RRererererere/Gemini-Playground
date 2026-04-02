'use client';

import { useState } from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { getAgentById, starAgent, unstarAgent } from '@/lib/agents/agent-store';

interface AgentCardProps {
  agentId: string;
  name: string;
  description: string;
  avatarEmoji: string;
  model: string;
  enabledSkillIds: string[];
  onOpenChat: (agentId: string) => void;
}

export default function AgentCard({
  agentId,
  name,
  description,
  avatarEmoji,
  model,
  enabledSkillIds,
  onOpenChat,
}: AgentCardProps) {
  const [isStarred, setIsStarred] = useState(() => {
    const agent = getAgentById(agentId);
    return agent?.starred ?? false;
  });

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isStarred) {
      unstarAgent(agentId);
      setIsStarred(false);
      // TODO: toast "Удалено из избранного"
    } else {
      starAgent(agentId);
      setIsStarred(true);
      // TODO: toast "Добавлено в избранное"
    }
  };

  const modelDisplayName = model.split('/').pop()?.replace('gemini-', '') || model;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-2xl">
            {avatarEmoji}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{name}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Star button */}
          <button
            onClick={handleStarClick}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
              isStarred
                ? 'text-amber-400 hover:text-amber-500'
                : 'text-[var(--text-dim)] hover:text-amber-400'
            }`}
            title={isStarred ? 'Удалить из избранного' : 'Добавить в избранное'}
          >
            <Star size={16} fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          
          {/* Edit button (placeholder for Phase 2) */}
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
            title="Редактировать (скоро)"
            disabled
          >
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 text-sm leading-relaxed text-[var(--text-muted)]">
        {description}
      </p>

      {/* Meta info */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5">
          {modelDisplayName}
        </span>
        {enabledSkillIds.length > 0 && (
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5">
            {enabledSkillIds.length} скилл{enabledSkillIds.length === 1 ? '' : enabledSkillIds.length < 5 ? 'а' : 'ов'}
          </span>
        )}
      </div>

      {/* Open chat button */}
      <button
        onClick={() => onOpenChat(agentId)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#ffffff,#e5e5e5)] px-4 py-3 text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99]"
      >
        <span>✦</span>
        Открыть чат с {name}
      </button>
    </div>
  );
}
