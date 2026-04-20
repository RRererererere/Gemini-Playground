'use client';

import React from 'react';
import { AgentStep } from '@/lib/agent-engine/chat-types';
import {
  Brain,
  Zap,
  Database,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface AgentStepsListProps {
  steps: AgentStep[];
  expanded: boolean;
  onToggle: () => void;
  isStreaming: boolean;
}

export function AgentStepsList({ steps, expanded, onToggle, isStreaming }: AgentStepsListProps) {
  const totalDuration = steps.reduce((sum, step) => sum + (step.duration || 0), 0);
  const completedSteps = steps.filter(s => s.status === 'done').length;

  const getStepIcon = (type: AgentStep['type'], status: AgentStep['status']) => {
    if (status === 'running') return <Loader2 size={14} className="animate-spin text-indigo-400" />;
    if (status === 'error') return <AlertCircle size={14} className="text-red-400" />;

    switch (type) {
      case 'thinking':
        return <Brain size={14} className="text-purple-400" />;
      case 'llm_call':
        return <Zap size={14} className="text-indigo-400" />;
      case 'memory_read':
      case 'memory_write':
        return <Database size={14} className="text-emerald-400" />;
      case 'feedback_request':
        return <MessageSquare size={14} className="text-amber-400" />;
      case 'final_answer':
        return <CheckCircle2 size={14} className="text-emerald-400" />;
      default:
        return <Zap size={14} className="text-slate-400" />;
    }
  };

  const getStepLabel = (step: AgentStep): string => {
    switch (step.type) {
      case 'thinking':
        return 'Размышления';
      case 'llm_call':
        return 'Генерация ответа';
      case 'memory_read':
        return 'Чтение памяти';
      case 'memory_write':
        return 'Запись в память';
      case 'tool_use':
        return 'Использование инструмента';
      case 'subagent_call':
        return 'Вызов саб-агента';
      case 'feedback_request':
        return 'Запрос обратной связи';
      case 'final_answer':
        return 'Финальный ответ';
      case 'error':
        return 'Ошибка';
      default:
        return step.nodeLabel || 'Шаг';
    }
  };

  return (
    <div className="bg-[var(--surface-2)] rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[var(--surface-3)] transition-colors"
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Выполнение
        </span>
        <span className="text-xs text-[var(--text-dim)]">
          {isStreaming ? (
            <>
              {completedSteps} / {steps.length} шагов
            </>
          ) : (
            <>
              {steps.length} {steps.length === 1 ? 'шаг' : 'шагов'} · {(totalDuration / 1000).toFixed(1)}с
            </>
          )}
        </span>
      </button>

      {/* Steps */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-2 text-sm">
              <div className="mt-0.5">{getStepIcon(step.type, step.status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-primary)]">{getStepLabel(step)}</span>
                  {step.duration && step.status === 'done' && (
                    <span className="text-xs text-[var(--text-dim)]">
                      {(step.duration / 1000).toFixed(2)}с
                    </span>
                  )}
                </div>

                {/* Thinking content */}
                {step.type === 'thinking' && typeof step.content === 'string' && (
                  <div className="mt-1 text-xs text-[var(--text-dim)] italic pl-3 border-l-2 border-purple-500/30">
                    {step.content}
                  </div>
                )}

                {/* Memory read result */}
                {step.type === 'memory_read' && typeof step.content === 'object' && (
                  <div className="mt-1 text-xs text-[var(--text-dim)]">
                    Найдено: {(step.content as any).count || 0} записей
                  </div>
                )}

                {/* Error */}
                {step.status === 'error' && (
                  <div className="mt-1 text-xs text-red-400">
                    {typeof step.content === 'string' ? step.content : 'Ошибка выполнения'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
