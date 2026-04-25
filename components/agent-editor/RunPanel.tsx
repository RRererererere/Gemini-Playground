import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle,
  AlertCircle, Loader2, Square, Maximize2, Minimize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AgentRun } from '@/lib/agent-engine/types';

interface RunPanelProps {
  run: AgentRun | null;
  isRunning: boolean;
  onStop?: () => void;
  currentNodeId?: string;
  streamingContent?: Record<string, string>; // nodeId → accumulated text
  hasSidebar?: boolean;
}

export const RunPanel: React.FC<RunPanelProps> = ({
  run,
  isRunning,
  onStop,
  currentNodeId,
  streamingContent = {},
  hasSidebar = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  if (!run && !isRunning) return null;

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />;
      case 'error':
        return <XCircle size={14} className="text-red-400 flex-shrink-0" />;
      case 'skipped':
        return <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />;
      default:
        return <Loader2 size={14} className="text-indigo-400 animate-spin flex-shrink-0" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const nodeResults = run?.nodeResults || [];
  const totalDuration = run?.duration || 0;
  const successCount = nodeResults.filter(n => n.status === 'success').length;
  const errorCount = nodeResults.filter(n => n.status === 'error').length;

  // Найти финальный output (из output-ноды)
  const finalOutputResult = [...nodeResults].reverse().find(r =>
    r.output && typeof r.output === 'object' && 'output' in (r.output as any)
  );
  const finalOutput = (finalOutputResult?.output as any)?.output;

  return (
    <div
      className={`absolute bottom-0 left-0 bg-[var(--surface-1)] border-t border-[var(--border)] shadow-[0_-4px_20px_rgba(0,0,0,0.3)] transition-all duration-300 z-30 ${
        isMaximized ? 'top-0 right-0' : isExpanded ? 'h-80' : 'h-12'
      }`}
      style={{ right: isMaximized ? 0 : hasSidebar ? 320 : 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md hover:bg-[var(--surface-3)] transition-colors"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          <div className="flex items-center gap-2">
            {isRunning ? (
              <Loader2 size={16} className="text-indigo-400 animate-spin" />
            ) : run?.status === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : run?.status === 'error' ? (
              <XCircle size={16} className="text-red-400" />
            ) : (
              <AlertCircle size={16} className="text-amber-400" />
            )}

            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {isRunning ? 'Running...' : run?.status === 'success' ? 'Completed' : run?.status === 'error' ? 'Failed' : 'Cancelled'}
            </span>

            {run && (
              <span className="text-xs text-[var(--text-dim)]">
                {run.graphName}
              </span>
            )}
          </div>

          {run && !isRunning && (
            <div className="flex items-center gap-3 ml-4 text-xs">
              <div className="flex items-center gap-1">
                <Clock size={12} className="text-[var(--text-dim)]" />
                <span className="text-[var(--text-dim)]">{formatDuration(totalDuration)}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-400" />
                <span className="text-emerald-400">{successCount}</span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-1">
                  <XCircle size={12} className="text-red-400" />
                  <span className="text-red-400">{errorCount}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRunning && onStop && (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
            >
              <Square size={12} />
              Stop
            </button>
          )}

          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded-md hover:bg-[var(--surface-3)] transition-colors"
          >
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="h-[calc(100%-3rem)] overflow-y-auto p-4 space-y-2">
          {nodeResults.length === 0 && isRunning && (
            <div className="flex items-center justify-center h-full text-[var(--text-dim)] text-sm">
              <Loader2 size={20} className="animate-spin mr-2" />
              Initializing execution...
            </div>
          )}

          {nodeResults.map((result, index) => {
            const isNodeExpanded = expandedNodes.has(result.nodeId);
            const isCurrent = currentNodeId === result.nodeId;
            const nodeStreaming = streamingContent[result.nodeId];

            return (
              <div
                key={`${result.nodeId}-${index}`}
                className={`bg-[var(--surface-2)] border rounded-lg overflow-hidden transition-all ${
                  isCurrent
                    ? 'border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : result.status === 'error'
                    ? 'border-red-500/30'
                    : 'border-[var(--border)]'
                }`}
              >
                {/* Node Header */}
                <button
                  onClick={() => toggleNodeExpand(result.nodeId)}
                  className="w-full flex items-center justify-between p-3 hover:bg-[var(--surface-3)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {result.nodeName}
                    </span>
                    {isCurrent && isRunning && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded animate-pulse">
                        Running
                      </span>
                    )}
                    {result.status === 'error' && (
                      <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                        Error
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[var(--text-dim)]">
                      {formatDuration(result.duration)}
                    </span>
                    {isNodeExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {/* Live Streaming Output */}
                {isCurrent && nodeStreaming && (
                  <div className="px-3 pb-3 border-t border-[var(--border)]">
                    <div className="text-[10px] font-semibold text-indigo-400 uppercase mb-1.5 mt-2 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                      Live Output
                    </div>
                    <div className="bg-[var(--surface-3)] rounded-lg p-2.5 text-xs text-[var(--text-primary)] font-mono max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {nodeStreaming}
                      <span className="inline-block w-1.5 h-3 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
                    </div>
                  </div>
                )}

                {/* Node Details */}
                {isNodeExpanded && (
                  <div className="border-t border-[var(--border)] p-3 space-y-3">
                    {/* Input */}
                    {result.input && Object.keys(result.input).length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-dim)] uppercase mb-1">Input</div>
                        <div className="bg-[var(--surface-3)] rounded p-2 text-xs font-mono text-[var(--text-primary)] overflow-x-auto max-h-24 overflow-y-auto">
                          <pre>{JSON.stringify(result.input, null, 2)}</pre>
                        </div>
                      </div>
                    )}

                    {/* Output */}
                    {result.output && Object.keys(result.output as object).length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-dim)] uppercase mb-1">Output</div>
                        <div className="bg-[var(--surface-3)] rounded p-2 text-xs font-mono text-[var(--text-primary)] overflow-x-auto max-h-24 overflow-y-auto">
                          <pre>{JSON.stringify(result.output, null, 2)}</pre>
                        </div>
                      </div>
                    )}

                    {/* Error */}
                    {result.error && (
                      <div>
                        <div className="text-xs font-semibold text-red-400 uppercase mb-1">Error</div>
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-xs text-red-400">
                          {typeof result.error === 'string' ? result.error : result.error.message}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Final Output Section */}
          {run?.status === 'success' && finalOutput !== undefined && finalOutput !== null && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="text-xs font-semibold text-emerald-400 uppercase mb-2 flex items-center gap-2">
                <CheckCircle2 size={12} />
                Final Output
              </div>
              <div className="text-sm text-[var(--text-primary)] bg-[var(--surface-3)] rounded-lg p-4 max-h-96 overflow-y-auto leading-relaxed prose prose-invert prose-sm max-w-none">
                {typeof finalOutput === 'string' ? (
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalOutput}</ReactMarkdown>
                ) : (
                   <pre className="font-mono">{JSON.stringify(finalOutput, null, 2)}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
