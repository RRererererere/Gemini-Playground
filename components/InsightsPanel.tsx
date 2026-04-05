'use client';

import { useState, useMemo } from 'react';
import { X, BarChart2, ThumbsUp, ThumbsDown, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
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

// Вспомогательная функция для извлечения текста из parts
function getTextFromParts(parts: any[]): string {
  return parts
    .filter((p: any) => 'text' in p && typeof p.text === 'string' && !p.thought)
    .map((p: any) => p.text)
    .join('');
}

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
      .map((m) => ({
        messageId: m.id,
        messageIndex: messages.indexOf(m) + 1, // 1-based
        messageExcerpt: getTextFromParts(m.parts).slice(0, 60),
        deepThinking: m.deepThinking,
        originalPrompt: m.deepThinkOriginalPrompt,
        enhancedPrompt: m.deepThinkEnhancedPrompt,
        analysis: m.deepThinkAnalysis,
        hasError: !!m.deepThinkError,
        errorText: m.deepThinkError,
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
    messageExcerpt?: string;
    deepThinking?: string;
    originalPrompt?: string;
    enhancedPrompt?: string;
    analysis?: any;
    hasError?: boolean;
    errorText?: string;
    timestamp: number;
  }>;
}

function DeepThinkTab({ analyses }: DeepThinkTabProps) {
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, analyses.length - 1));
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [originalExpanded, setOriginalExpanded] = useState(false);
  const [enhancedExpanded, setEnhancedExpanded] = useState(false);

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

  const diffChars = selected.enhancedPrompt && selected.originalPrompt
    ? selected.enhancedPrompt.length - selected.originalPrompt.length
    : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-3">
      {/* Контекст сообщения */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
        <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">
          Сообщение #{selected.messageIndex}
        </span>
        {selected.messageExcerpt && (
          <span className="text-[11px] text-[var(--text-primary)] truncate flex-1">
            "{selected.messageExcerpt}..."
          </span>
        )}
        {selected.hasError && (
          <span className="text-[10px] text-red-400 flex-shrink-0">⚠ ошибка</span>
        )}
      </div>

      {/* Pipeline карточка */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
        {/* ИСХОДНЫЙ ПРОМПТ */}
        {selected.originalPrompt ? (
          <PipelineSection
            label="ИСХОДНЫЙ ПРОМПТ"
            content={selected.originalPrompt}
            expanded={originalExpanded}
            onToggle={() => setOriginalExpanded(v => !v)}
            color="var(--text-dim)"
          />
        ) : (
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">
              ИСХОДНЫЙ ПРОМПТ
            </div>
            <div className="text-[11px] text-[var(--text-dim)] italic">
              нет данных (сохраняется с новых чатов)
            </div>
          </div>
        )}

        <PipelineArrow />

        {/* РАЗМЫШЛЕНИЯ */}
        {selected.deepThinking && (
          <PipelineSection
            label="РАЗМЫШЛЕНИЯ"
            content={selected.deepThinking}
            expanded={thinkingExpanded}
            onToggle={() => setThinkingExpanded(v => !v)}
            color="#a855f7"
            accent
          />
        )}

        <PipelineArrow />

        {/* ENHANCED PROMPT */}
        {selected.enhancedPrompt ? (
          <PipelineSection
            label="ENHANCED PROMPT"
            content={selected.enhancedPrompt}
            expanded={enhancedExpanded}
            onToggle={() => setEnhancedExpanded(v => !v)}
            color="var(--gem-teal)"
          />
        ) : (
          <div className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mb-1">
              ENHANCED PROMPT
            </div>
            <div className="text-[11px] text-[var(--text-dim)] italic">
              {selected.hasError ? `Не создан — ${selected.errorText}` : 'нет данных'}
            </div>
          </div>
        )}

        {/* Diff stats */}
        {diffChars !== null && (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--surface-3)]">
            <span className={`text-[10px] font-mono ${diffChars >= 0 ? 'text-[var(--gem-teal)]' : 'text-red-400'}`}>
              {diffChars >= 0 ? '+' : ''}{diffChars} символов
            </span>
            <span className="text-[10px] text-[var(--text-dim)]">
              {selected.originalPrompt?.length} → {selected.enhancedPrompt?.length}
            </span>
          </div>
        )}
      </div>

      {/* Timeline */}
      {analyses.length > 1 && (
        <div className="flex items-end gap-0 mt-1 px-1">
          {analyses.map((a, idx) => (
            <div key={a.messageId} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => { setSelectedIndex(idx); setThinkingExpanded(false); }}
                  className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                    idx === safeIndex
                      ? 'bg-purple-400 border-purple-400 scale-125'
                      : a.hasError
                        ? 'bg-transparent border-red-400/50 hover:border-red-400'
                        : 'bg-transparent border-[var(--border-strong)] hover:border-purple-400/50'
                  }`}
                />
                <span className="text-[9px] text-[var(--text-dim)]">#{a.messageIndex}</span>
              </div>
              {idx < analyses.length - 1 && (
                <div className="flex-1 h-px bg-[var(--border)] mx-1 mb-4" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Переиспользуемый компонент секции
function PipelineSection({ label, content, expanded, onToggle, color, accent }: {
  label: string;
  content: string;
  expanded: boolean;
  onToggle: () => void;
  color: string;
  accent?: boolean;
}) {
  const MAX_COLLAPSED = 120;
  const isLong = content.length > MAX_COLLAPSED;

  return (
    <div className="border-b border-[var(--border-subtle)] last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[var(--surface-3)] transition-colors"
      >
        <span className="text-[10px] uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        {isLong && (
          expanded
            ? <ChevronUp size={10} className="text-[var(--text-dim)] flex-shrink-0" />
            : <ChevronDown size={10} className="text-[var(--text-dim)] flex-shrink-0" />
        )}
      </button>
      <div className="px-4 pb-3">
        <p className={`text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
          accent ? 'text-purple-300/90' : 'text-[var(--text-primary)]'
        } ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
          {content}
        </p>
        {isLong && !expanded && (
          <button
            onClick={onToggle}
            className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] mt-1"
          >
            показать всё ({content.length} символов)
          </button>
        )}
      </div>
    </div>
  );
}

function PipelineArrow() {
  return (
    <div className="flex items-center justify-center py-1 bg-[var(--surface-3)]">
      <div className="w-px h-3 bg-[var(--border)]" />
      <span className="text-[9px] text-[var(--text-dim)] mx-2 absolute">↓</span>
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
  // Собираем model-сообщения с событиями
  const modelMessages = messages
    .filter(m => m.role === 'model' && !m.isStreaming)
    .map((m) => ({
      id: m.id,
      index: messages.indexOf(m) + 1,
      excerpt: getTextFromParts(m.parts).slice(0, 70),
      feedback: m.feedback,
      regenerationCount: 0, // TODO: добавить interactionMeta в Message
      regenerationReasons: [],
    }));

  const hasAnyEvents = modelMessages.some(
    m => m.feedback || m.regenerationCount > 0
  );

  // Summary stats
  const totalLikes = modelMessages.filter(m => m.feedback?.rating === 'like').length;
  const totalDislikes = modelMessages.filter(m => m.feedback?.rating === 'dislike').length;
  const totalRegens = modelMessages.reduce((s, m) => s + m.regenerationCount, 0);
  const mostRegenMsg = [...modelMessages].sort((a, b) => b.regenerationCount - a.regenerationCount)[0];

  if (!hasAnyEvents) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-3">
        <div className="text-3xl">💬</div>
        <div className="text-sm text-[var(--text-primary)]">Нет данных</div>
        <div className="text-xs text-[var(--text-dim)] max-w-[200px]">
          Ставь лайки и дизлайки на ответы — они появятся здесь
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Summary */}
      <div className="px-4 pt-4 pb-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <div className="flex items-center gap-4 flex-wrap text-[11px]">
            {totalLikes > 0 && (
              <span className="flex items-center gap-1 text-[var(--gem-teal)]">
                <ThumbsUp size={10} /> {totalLikes}
              </span>
            )}
            {totalDislikes > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <ThumbsDown size={10} /> {totalDislikes}
              </span>
            )}
            {totalRegens > 0 && (
              <span className="flex items-center gap-1 text-purple-400">
                <RefreshCw size={10} /> {totalRegens} рег.
              </span>
            )}
          </div>
          {mostRegenMsg && mostRegenMsg.regenerationCount > 1 && (
            <p className="text-[10px] text-[var(--text-dim)] mt-2">
              Проблемный: сообщение #{mostRegenMsg.index} ({mostRegenMsg.regenerationCount} регенерации)
            </p>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 pb-4 space-y-2">
        {modelMessages.map(msg => {
          const hasEvents = msg.feedback || msg.regenerationCount > 0;
          if (!hasEvents) return null;

          return (
            <div key={msg.id} className="space-y-1.5">
              {/* Сообщение */}
              <div className="rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2">
                <div className="text-[10px] text-[var(--text-dim)] mb-1">
                  #{msg.index}
                </div>
                {msg.excerpt && (
                  <p className="text-[11px] text-[var(--text-dim)] leading-relaxed line-clamp-2">
                    {msg.excerpt}...
                  </p>
                )}
              </div>

              {/* Events */}
              <div className="flex items-center gap-1.5 flex-wrap pl-1">
                {msg.feedback?.rating === 'like' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--gem-teal)]/10 text-[var(--gem-teal)] border border-[var(--gem-teal)]/20">
                    <ThumbsUp size={8} />
                    {msg.feedback.comment ? `"${msg.feedback.comment.slice(0, 30)}"` : 'лайк'}
                  </span>
                )}
                {msg.feedback?.rating === 'dislike' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">
                    <ThumbsDown size={8} />
                    {msg.feedback.comment ? `"${msg.feedback.comment.slice(0, 30)}"` : 'дизлайк'}
                  </span>
                )}
                {msg.regenerationCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <RefreshCw size={8} />
                    ×{msg.regenerationCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
