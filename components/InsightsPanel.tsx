'use client';

import { useState, useMemo } from 'react';
import { X, BarChart2 } from 'lucide-react';
import type { Message } from '@/types';
import { getMemories } from '@/lib/memory-store';
import type { Memory, MemoryScope } from '@/lib/memory-store';
import MemoryGraph from './MemoryGraph';

interface InsightsPanelProps {
  messages: Message[];
  chatId: string;
  onClose: () => void;
}

type TabType = 'memory' | 'deepthink' | 'session';

const CATEGORY_COLORS: Record<string, string> = {
  identity: '#a855f7',
  tech: '#3b82f6',
  style: '#f59e0b',
  project: '#10b981',
  preference: '#ec4899',
  belief: '#8b5cf6',
  episode: '#6366f1',
};

export default function InsightsPanel({ messages, chatId, onClose }: InsightsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('memory');
  const [memoryScope, setMemoryScope] = useState<MemoryScope>('global');

  // Загружаем воспоминания
  const memories = useMemo(() => {
    return getMemories(memoryScope, memoryScope === 'local' ? chatId : undefined);
  }, [memoryScope, chatId]);

  // Статистика памяти
  const memoryStats = useMemo(() => {
    const totalFacts = memories.length;
    const avgConfidence = memories.length > 0
      ? memories.reduce((sum, m) => sum + m.confidence, 0) / memories.length
      : 0;

    // Топ категория
    const categoryCounts: Record<string, number> = {};
    memories.forEach(m => {
      categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
    });
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalFacts,
      avgConfidence,
      topCategory: topCategory ? { name: topCategory[0], count: topCategory[1] } : null,
      scope: memoryScope,
    };
  }, [memories, memoryScope]);

  // Статистика по категориям
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; avgConfidence: number }> = {};
    
    memories.forEach(m => {
      if (!stats[m.category]) {
        stats[m.category] = { count: 0, avgConfidence: 0 };
      }
      stats[m.category].count++;
      stats[m.category].avgConfidence += m.confidence;
    });

    // Вычисляем средние
    Object.keys(stats).forEach(cat => {
      stats[cat].avgConfidence = stats[cat].avgConfidence / stats[cat].count;
    });

    // Сортируем по count DESC
    return Object.entries(stats)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [memories]);

  const maxCount = categoryStats.length > 0 ? categoryStats[0].count : 1;

  // DeepThink анализы
  const deepThinkAnalyses = useMemo(() => {
    return messages
      .filter(m => m.role === 'model' && (m.deepThinking || m.deepThinkEnhancedPrompt))
      .map((m, idx) => ({
        messageId: m.id,
        messageIndex: messages.indexOf(m),
        deepThinking: m.deepThinking,
        enhancedPrompt: m.deepThinkEnhancedPrompt,
        analysis: m.deepThinkAnalysis,
        timestamp: Date.now(), // TODO: добавить реальный timestamp в Message
      }))
      .slice(-5); // последние 5
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <BarChart2 size={16} className="text-[var(--gem-teal)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">Insights</span>
        
        {/* Tabs */}
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setActiveTab('memory')}
            className={`text-[11px] px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'memory'
                ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            Memory
          </button>
          <button
            onClick={() => setActiveTab('deepthink')}
            className={`text-[11px] px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'deepthink'
                ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            DeepThink
          </button>
          <button
            onClick={() => setActiveTab('session')}
            className={`text-[11px] px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'session'
                ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
            }`}
          >
            Session
          </button>
        </div>

        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors ml-2"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'memory' && (
          <MemoryTab
            memories={memories}
            stats={memoryStats}
            categoryStats={categoryStats}
            maxCount={maxCount}
            scope={memoryScope}
            onScopeChange={setMemoryScope}
          />
        )}

        {activeTab === 'deepthink' && (
          <DeepThinkTab analyses={deepThinkAnalyses} />
        )}

        {activeTab === 'session' && (
          <SessionTab messages={messages} />
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Memory Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface MemoryTabProps {
  memories: Memory[];
  stats: {
    totalFacts: number;
    avgConfidence: number;
    topCategory: { name: string; count: number } | null;
    scope: MemoryScope;
  };
  categoryStats: Array<{ category: string; count: number; avgConfidence: number }>;
  maxCount: number;
  scope: MemoryScope;
  onScopeChange: (scope: MemoryScope) => void;
}

function MemoryTab({ memories, stats, categoryStats, maxCount, scope, onScopeChange }: MemoryTabProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-4">
        <div className="flex-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5 flex flex-col gap-0.5">
          <div className="text-lg font-semibold text-[var(--text-primary)]">{stats.totalFacts}</div>
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">фактов</div>
        </div>

        <div className="flex-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5 flex flex-col gap-0.5">
          <div className="text-lg font-semibold text-[var(--text-primary)]">
            {Math.round(stats.avgConfidence * 100)}%
          </div>
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">ср.увер.</div>
        </div>

        <div className="flex-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            {stats.topCategory && (
              <>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[stats.topCategory.name] }}
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {stats.topCategory.name}
                </span>
              </>
            )}
            {!stats.topCategory && (
              <span className="text-sm text-[var(--text-dim)]">—</span>
            )}
          </div>
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">top-кат</div>
        </div>

        <div className="flex-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5 flex flex-col gap-0.5">
          <div className="text-sm font-medium text-[var(--text-primary)]">{stats.scope}</div>
          <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">scope</div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="px-4 pb-4 space-y-1">
        {categoryStats.map(({ category, count, avgConfidence }) => (
          <div key={category} className="flex items-center gap-2 py-1">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
            />
            <div className="text-[11px] text-[var(--text-dim)] w-20 flex-shrink-0">
              {category}
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: CATEGORY_COLORS[category],
                  opacity: 0.8,
                  width: `${(count / maxCount) * 100}%`,
                }}
              />
            </div>
            <div className="text-[10px] text-[var(--text-dim)] w-14 text-right">
              {count} {count === 1 ? 'факт' : 'фактов'}
            </div>
            <div
              className="hidden sm:block text-[10px] font-mono w-8 text-right"
              style={{ color: CATEGORY_COLORS[category] }}
            >
              {Math.round(avgConfidence * 100)}%
            </div>
          </div>
        ))}
      </div>

      {/* Scope Toggle */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => onScopeChange('global')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            scope === 'global'
              ? 'bg-[var(--gem-teal)]/15 text-[var(--gem-teal)] border border-[var(--gem-teal)]/40'
              : 'bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--border)] hover:text-[var(--text-primary)]'
          }`}
        >
          Global
        </button>
        <button
          onClick={() => onScopeChange('local')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            scope === 'local'
              ? 'bg-[var(--gem-teal)]/15 text-[var(--gem-teal)] border border-[var(--gem-teal)]/40'
              : 'bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--border)] hover:text-[var(--text-primary)]'
          }`}
        >
          Chat
        </button>
      </div>

      {/* Memory Graph */}
      <div className="flex-1 min-h-0">
        <MemoryGraph
          memories={memories}
          onSelectMemory={(id) => {
            // TODO: открыть MemoryModal для редактирования
            console.log('Select memory:', id);
          }}
          onDeleteMemory={(id) => {
            // TODO: удалить память
            console.log('Delete memory:', id);
          }}
        />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DeepThink Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DeepThinkTabProps {
  analyses: Array<{
    messageId: string;
    messageIndex: number;
    deepThinking?: string;
    enhancedPrompt?: string;
    analysis?: any;
    timestamp: number;
  }>;
}

function DeepThinkTab({ analyses }: DeepThinkTabProps) {
  // Начинаем с последнего анализа, но безопасно
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, analyses.length - 1));

  if (analyses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-4xl mb-4">🧠</div>
        <div className="text-sm text-[var(--text-primary)] mb-2">DeepThink не запускался</div>
        <div className="text-xs text-[var(--text-dim)]">
          Включи DeepThink в тулбаре чата
        </div>
      </div>
    );
  }

  // Безопасный индекс
  const safeIndex = Math.min(Math.max(0, selectedIndex), analyses.length - 1);
  const selected = analyses[safeIndex];

  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-4xl mb-4">🧠</div>
        <div className="text-sm text-[var(--text-primary)] mb-2">DeepThink не запускался</div>
        <div className="text-xs text-[var(--text-dim)]">
          Включи DeepThink в тулбаре чата
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-3">
      {/* Pipeline Card */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--surface-3)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-purple-400">⚡ DeepThink #{safeIndex + 1}</span>
            <span className="text-[10px] text-[var(--text-dim)]">
              · сообщение #{selected.messageIndex}
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-dim)]">
            {/* TODO: реальный timestamp */}
            только что
          </span>
        </div>

        {/* Pipeline */}
        <div className="p-4 space-y-3">
          {/* Размышления */}
          {selected.deepThinking && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
                  РАЗМЫШЛЕНИЯ
                </div>
                <div className="text-[12px] text-[var(--text-primary)] leading-relaxed line-clamp-5">
                  {selected.deepThinking}
                </div>
              </div>

              <div className="flex items-center justify-center py-1.5">
                <div className="w-px h-4 bg-[var(--border)]" />
              </div>
            </>
          )}

          {/* Enhanced Prompt */}
          {selected.enhancedPrompt && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1.5">
                ENHANCED PROMPT
              </div>
              <div className="text-[12px] text-[var(--text-primary)] leading-relaxed line-clamp-3">
                {selected.enhancedPrompt.slice(0, 200)}...
              </div>
            </div>
          )}
        </div>

        {/* Diff Stats */}
        {selected.enhancedPrompt && (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--surface-3)]">
            <span className="text-[10px] font-mono text-[var(--gem-teal)]">
              +{selected.enhancedPrompt.length} символов
            </span>
          </div>
        )}
      </div>

      {/* Timeline */}
      {analyses.length > 1 && (
        <div className="flex items-center gap-0 mt-2">
          {analyses.map((analysis, idx) => (
            <div key={analysis.messageId} className="flex items-center">
              <button
                onClick={() => setSelectedIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                  idx === safeIndex
                    ? 'bg-purple-400 border-purple-400'
                    : 'bg-transparent border-[var(--border-strong)] hover:border-purple-400/50'
                }`}
              />
              {idx < analyses.length - 1 && (
                <div className="flex-1 h-px bg-[var(--border)] min-w-[20px]" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Session Tab
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SessionTabProps {
  messages: Message[];
}

function SessionTab({ messages }: SessionTabProps) {
  // Пока заглушка — зависит от реализации feedback системы
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-sm text-[var(--text-primary)] mb-2">
        Нет данных о взаимодействиях в этом чате
      </div>
      <div className="text-xs text-[var(--text-dim)]">
        Ставь лайки и дизлайки на ответы — они появятся здесь
      </div>
    </div>
  );
}
