'use client';

import type { ArenaAgent } from '@/lib/arena-types';

interface AgentMessageHeaderProps {
  agent?: ArenaAgent;
}

export default function AgentMessageHeader({ agent }: AgentMessageHeaderProps) {
  if (!agent) return null;

  return (
    <div className="flex items-center gap-2.5 mb-2 mt-4 first:mt-0">
      {/* Agent avatar */}
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg text-sm border flex-shrink-0"
        style={{
          borderColor: agent.color + '40',
          background: agent.color + '15',
        }}
      >
        {agent.emoji}
      </div>
      {/* Name + model line */}
      <div className="flex items-baseline gap-2 min-w-0">
        <span
          className="text-[13px] font-semibold tracking-tight"
          style={{ color: agent.color }}
        >
          {agent.name}
        </span>
        <span className="text-[10px] text-[var(--text-dim)] font-mono truncate">
          {agent.model ? agent.model.replace('models/', '') : '—'}
        </span>
      </div>
    </div>
  );
}
