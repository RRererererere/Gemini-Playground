'use client';

import { Zap, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { DeepThinkState } from '@/lib/useDeepThink';

interface DeepThinkToggleProps {
  state: DeepThinkState;
  onToggle: () => void;
}

export default function DeepThinkToggle({ state, onToggle }: DeepThinkToggleProps) {
  const { enabled, isAnalyzing, error, errorType, retryCount } = state;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onToggle}
        disabled={isAnalyzing}
        title={enabled ? 'Отключить DeepThink' : 'Включить DeepThink — анализ перед ответом'}
        className={`
          relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
          transition-all duration-200 border select-none
          ${enabled && !error
            ? 'bg-purple-500/15 border-purple-500/40 text-purple-400 hover:bg-purple-500/25'
            : error
            ? 'bg-red-500/10 border-red-500/30 text-red-400/80 hover:bg-red-500/15'
            : 'bg-transparent border-[var(--border)] text-white/40 hover:border-[var(--border-strong)] hover:text-white/60'
          }
          ${isAnalyzing ? 'ring-1 ring-purple-500/30 cursor-wait' : ''}
        `}
      >
        {isAnalyzing ? (
          <Loader2 size={13} className="animate-spin" />
        ) : error ? (
          <AlertTriangle size={13} />
        ) : (
          <Zap size={13} className={enabled ? 'fill-purple-400' : ''} />
        )}
        <span className="hidden sm:inline">DeepThink</span>

        {/* Retry badge */}
        {retryCount > 0 && isAnalyzing && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 items-center justify-center rounded-full bg-purple-500 text-[7px] font-bold text-white">
              {retryCount}
            </span>
          </span>
        )}
      </button>

      {/* Error display */}
      {error && !isAnalyzing && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/8 border border-red-500/20 text-[10px] text-red-400/70 max-w-[200px] sm:max-w-xs">
          <AlertTriangle size={9} className="flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}

      {isAnalyzing && (
        <span className="animate-pulse text-[10px] text-purple-400/60 hidden sm:inline">
          {retryCount > 0 ? `Переподключение... (${retryCount})` : 'Анализ...'}
        </span>
      )}
    </div>
  );
}
