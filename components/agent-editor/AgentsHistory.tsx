import { FC, useState, useEffect } from 'react';
import { AgentRun } from '@/lib/agent-engine/types';
import { getAllRuns, getGraphById } from '@/lib/agent-engine/graph-storage';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export const AgentsHistory: FC = () => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = () => {
    const allRuns = getAllRuns();
    setRuns(allRuns);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-400" />;
      case 'error':
        return <XCircle size={16} className="text-red-400" />;
      case 'cancelled':
        return <AlertCircle size={16} className="text-amber-400" />;
      default:
        return <Clock size={16} className="text-indigo-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'error':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'cancelled':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
    }
  };

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
          <Clock size={32} className="text-[var(--text-dim)]" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          No execution history
        </h3>
        <p className="text-sm text-[var(--text-dim)] max-w-md">
          Run an agent to see its execution history here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-1)] px-6 py-4">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Execution History</h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          {runs.length} total runs
        </p>
      </div>

      {/* Runs List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {runs.map((run) => {
          const isExpanded = expandedRun === run.id;
          const successCount = run.nodeResults.filter(n => n.status === 'success').length;
          const errorCount = run.nodeResults.filter(n => n.status === 'error').length;

          return (
            <div
              key={run.id}
              className="bg-[var(--surface-1)] border border-[var(--border)] rounded-lg overflow-hidden hover:border-indigo-500/30 transition-colors"
            >
              {/* Run Header */}
              <button
                onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(run.status)}
                  <div className="text-left">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {run.graphName}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--text-dim)] mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(run.startedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {run.duration ? formatDuration(run.duration) : 'Running...'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(run.status)}`}>
                    {run.status}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs">
                    {successCount > 0 && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={12} />
                        {successCount}
                      </span>
                    )}
                    {errorCount > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle size={12} />
                        {errorCount}
                      </span>
                    )}
                  </div>

                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Run Details */}
              {isExpanded && (
                <div className="border-t border-[var(--border)] p-4 bg-[var(--surface-2)] space-y-3">
                  {run.nodeResults.map((result, index) => (
                    <div
                      key={`${result.nodeId}-${index}`}
                      className="p-3 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {result.status === 'success' && <CheckCircle2 size={14} className="text-emerald-400" />}
                          {result.status === 'error' && <XCircle size={14} className="text-red-400" />}
                          {result.status === 'skipped' && <AlertCircle size={14} className="text-amber-400" />}
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {result.nodeName}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--text-dim)]">
                          {formatDuration(result.duration)}
                        </span>
                      </div>

                      {result.error && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                          {typeof result.error === 'string' ? result.error : result.error.message}
                        </div>
                      )}

                      {result.output && Object.keys(result.output).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-[var(--text-dim)] cursor-pointer hover:text-[var(--text-primary)]">
                            View output
                          </summary>
                          <pre className="mt-2 p-2 bg-[var(--surface-1)] rounded text-xs overflow-x-auto">
                            {JSON.stringify(result.output, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
