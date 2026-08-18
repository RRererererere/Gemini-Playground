import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Zap } from 'lucide-react';
import { AgentRun, NodeRunResult } from '@/lib/agent-engine/types';

interface AgentExecutionCardProps {
  run: AgentRun;
  isRunning?: boolean;
  currentNodeId?: string;
}

export const AgentExecutionCard: React.FC<AgentExecutionCardProps> = ({
  run,
  isRunning = false,
  currentNodeId,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={12} className="text-emerald-400" />;
      case 'error':
        return <XCircle size={12} className="text-red-400" />;
      case 'skipped':
        return <AlertCircle size={12} className="text-amber-400" />;
      default:
        return <Loader2 size={12} className="text-indigo-400 animate-spin" />;
    }
  };

  const successCount = run.nodeResults.filter(n => n.status === 'success').length;
  const errorCount = run.nodeResults.filter(n => n.status === 'error').length;
  const totalDuration = run.duration || 0;

  // Auto-collapse after completion
  React.useEffect(() => {
    if (!isRunning && run.status !== 'running') {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isRunning, run.status]);

  return (
    <div className="my-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--surface-2)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
            {isRunning ? (
              <Loader2 size={16} className="text-indigo-400 animate-spin" />
            ) : run.status === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : run.status === 'error' ? (
              <XCircle size={16} className="text-red-400" />
            ) : (
              <Zap size={16} className="text-indigo-400" />
            )}
          </div>

          <div className="text-left">
            <div className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              {run.graphName}
              {isRunning && (
                <span className="text-xs text-indigo-400 font-normal">Running...</span>
              )}
            </div>
            {!isRunning && (
              <div className="flex items-center gap-3 text-xs text-[var(--text-dim)] mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {formatDuration(totalDuration)}
                </span>
                {successCount > 0 && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 size={10} />
                    {successCount}
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <XCircle size={10} />
                    {errorCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              run.status === 'success' 
                ? 'bg-emerald-500/10 text-emerald-400'
                : run.status === 'error'
                ? 'bg-red-500/10 text-red-400'
                : 'bg-amber-500/10 text-amber-400'
            }`}>
              {run.status}
            </span>
          )}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-[var(--border)] p-3 space-y-2 bg-[var(--surface-2)]">
          {run.nodeResults.length === 0 && isRunning && (
            <div className="flex items-center justify-center py-4 text-sm text-[var(--text-dim)]">
              <Loader2 size={16} className="animate-spin mr-2" />
              Initializing...
            </div>
          )}

          {run.nodeResults.map((result, index) => {
            const isCurrent = currentNodeId === result.nodeId;

            return (
              <div
                key={`${result.nodeId}-${index}`}
                className={`flex items-center justify-between p-2 rounded ${
                  isCurrent
                    ? 'bg-indigo-500/10 border border-indigo-500/30'
                    : 'bg-[var(--surface-3)]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {getStatusIcon(result.status)}
                  <span className="text-sm text-[var(--text-primary)]">
                    {result.nodeName}
                  </span>
                  {result.error && (
                    <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                      Error
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--text-dim)]">
                  {formatDuration(result.duration)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
