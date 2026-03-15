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
        title={enabled ? 'Disable DeepThink' : 'Enable DeepThink — analyzes conversation before responding'}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
          transition-all duration-200 border
          ${enabled
            ? 'bg-purple-500/15 border-purple-500/40 text-purple-400 hover:bg-purple-500/25'
            : 'bg-transparent border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'
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

      {/* Show analysis badge when last analysis is available */}
      {enabled && lastAnalysis && !isAnalyzing && (
        <span
          title={`Mood: ${lastAnalysis.mood} · Style: ${lastAnalysis.userStyle}\nIntent: ${lastAnalysis.realIntent}`}
          className="text-xs text-white/30 cursor-help"
        >
          {moodEmoji(lastAnalysis.mood)} {lastAnalysis.userStyle}
        </span>
      )}

      {isAnalyzing && (
        <span className="text-xs text-purple-400/70 animate-pulse font-medium">
          Analyzing conversation...
        </span>
      )}
    </div>
  );
}

function moodEmoji(mood: string): string {
  const map: Record<string, string> = {
    curious: '🤔',
    frustrated: '😤',
    excited: '⚡',
    confused: '😵',
    satisfied: '✓',
    neutral: '◦',
  };
  return map[mood] ?? '◦';
}
