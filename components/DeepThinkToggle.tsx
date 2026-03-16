'use client';

import { Zap, Loader2 } from 'lucide-react';
import type { DeepThinkState } from '@/lib/useDeepThink';

interface DeepThinkToggleProps {
  state: DeepThinkState;
  onToggle: () => void;
}

export default function DeepThinkToggle({ state, onToggle }: DeepThinkToggleProps) {
  const { enabled, isAnalyzing, lastAnalysis } = state;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        title={enabled ? 'Disable DeepThink' : 'Enable DeepThink - analyzes conversation before responding'}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
          transition-all duration-200 border
          ${enabled
            ? 'bg-purple-500/15 border-purple-500/40 text-purple-400 hover:bg-purple-500/25'
            : 'bg-transparent border-[var(--border)] text-white/40 hover:border-[var(--border-strong)] hover:text-white/60'
          }
          ${isAnalyzing ? 'ring-2 ring-purple-500/50 animate-pulse' : ''}
        `}
      >
        {isAnalyzing ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Zap size={13} className={enabled ? 'fill-purple-400' : ''} />
        )}
        DeepThink
      </button>

      {enabled && lastAnalysis && !isAnalyzing && (
        <span
          title={`Mood: ${lastAnalysis.mood || 'unknown'} | Style: ${lastAnalysis.userStyle || 'unknown'}\nIntent: ${lastAnalysis.realIntent || 'unknown'}`}
          className="cursor-help text-xs text-white/30"
        >
          {moodEmoji(lastAnalysis.mood)} {lastAnalysis.userStyle || 'DeepThink'}
        </span>
      )}

      {isAnalyzing && (
        <span className="animate-pulse text-xs font-medium text-purple-400/70">
          Analyzing conversation...
        </span>
      )}
    </div>
  );
}

function moodEmoji(mood?: string): string {
  const map: Record<string, string> = {
    curious: '[?]',
    frustrated: '[!]',
    excited: '[+]',
    confused: '[~]',
    satisfied: '[ok]',
    neutral: '[.]',
  };
  return map[mood || ''] ?? '[.]';
}
