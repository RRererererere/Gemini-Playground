'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, List, Network, Trash2, Edit2, Check } from 'lucide-react';
import type { Memory, MemoryScope, MemoryCategory } from '@/lib/memory-store';
import { getMemories, updateMemory, forgetMemory } from '@/lib/memory-store';
import MemoryGraph from './MemoryGraph';

interface MemoryModalProps {
  open: boolean;
  onClose: () => void;
  chatId?: string;
}

type ViewMode = 'list' | 'graph';
type SortMode = 'date' | 'confidence';

const CATEGORY_LABELS: Record<MemoryCategory, string> = {
  identity: 'Личность',
  tech: 'Технологии',
  style: 'Стиль',
  project: 'Проект',
  preference: 'Предпочтения',
  belief: 'Убеждения',
  episode: 'Эпизод',
};

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  identity: '#a855f7',
  tech: '#3b82f6',
  style: '#f59e0b',
  project: '#10b981',
  preference: '#ec4899',
  belief: '#8b5cf6',
  episode: '#6366f1',
};

export default function MemoryModal({ open, onClose, chatId }: MemoryModalProps) {
  const [activeTab, setActiveTab] = useState<MemoryScope>('global');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [memories, setMemories] = useState<Memory[]>([]);

  const loadMemories = () => {
    const mems = getMemories(activeTab, activeTab === 'local' ? chatId : undefined);
    setMemories(mems);
  };

  useEffect(() => {
    if (open) {
      loadMemories();
    }
  }, [open, activeTab, chatId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const filteredMemories = useMemo(() => {
    let result = memories;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        m =>
          m.fact.toLowerCase().includes(q) ||
          m.keywords.some(kw => kw.toLowerCase().includes(q))
      );
    }

    if (categoryFilter) {
      result = result.filter(m => m.category === categoryFilter);
    }

    result = [...result].sort((a, b) => {
      if (sortMode === 'date') return b.updated_at - a.updated_at;
      return b.confidence - a.confidence;
    });

    return result;
  }, [memories, searchQuery, categoryFilter, sortMode]);

  const handleDelete = (id: string) => {
    forgetMemory(id, activeTab, activeTab === 'local' ? chatId : undefined);
    loadMemories();
  };

  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) return;
    updateMemory(
      id,
      activeTab,
      { fact: editText },
      activeTab === 'local' ? chatId : undefined
    );
    setEditingId(null);
    setEditText('');
    loadMemories();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[90vh] flex flex-col rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Память</h2>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('global')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'global'
                    ? 'bg-white text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                }`}
              >
                Глобальная
              </button>
              <button
                onClick={() => setActiveTab('local')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'local'
                    ? 'bg-white text-black'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
                }`}
              >
                Локальная
              </button>
            </div>

            {/* View Mode */}
            <div className="flex gap-1 ml-auto">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all ${
                  viewMode === 'list'
                    ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                <List size={14} />
                Список
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all ${
                  viewMode === 'graph'
                    ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Network size={14} />
                Граф
              </button>
            </div>
          </div>
        </div>
        {/* Filters (только для списка) */}
        {viewMode === 'list' && (
          <div className="flex-shrink-0 border-b border-[var(--border)] px-6 py-3 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по тексту..."
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none"
              />
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-dim)]">Категория:</span>
              <button
                onClick={() => setCategoryFilter(null)}
                className={`px-3 py-1 rounded-full text-xs transition-all ${
                  categoryFilter === null
                    ? 'bg-white text-black'
                    : 'bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Все
              </button>
              {(Object.keys(CATEGORY_LABELS) as MemoryCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    categoryFilter === cat
                      ? 'text-white'
                      : 'bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  style={
                    categoryFilter === cat
                      ? { backgroundColor: CATEGORY_COLORS[cat] }
                      : undefined
                  }
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-dim)]">Сортировка:</span>
              <button
                onClick={() => setSortMode('date')}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${
                  sortMode === 'date'
                    ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                По дате
              </button>
              <button
                onClick={() => setSortMode('confidence')}
                className={`px-3 py-1 rounded-lg text-xs transition-all ${
                  sortMode === 'confidence'
                    ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                По уверенности
              </button>
            </div>
          </div>
        )}
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {viewMode === 'list' ? (
            filteredMemories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--surface-3)] flex items-center justify-center mb-4">
                  <Search size={24} className="text-[var(--text-dim)]" />
                </div>
                <p className="text-sm text-[var(--text-primary)] font-medium">
                  {searchQuery || categoryFilter ? 'Ничего не найдено' : 'Нет воспоминаний'}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {searchQuery || categoryFilter
                    ? 'Попробуйте изменить фильтры'
                    : 'Модель начнёт сохранять факты о вас автоматически'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMemories.map(memory => (
                  <div
                    key={memory.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 hover:border-[var(--border-strong)] transition-all"
                  >
                    {editingId === memory.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(memory.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:opacity-80 transition-opacity"
                          >
                            <Check size={12} />
                            Сохранить
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditText('');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-sm text-[var(--text-primary)] leading-relaxed flex-1">
                            {memory.fact}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingId(memory.id);
                                setEditText(memory.fact);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(memory.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-red-500/10 hover:text-[var(--gem-red)] transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                            style={{ backgroundColor: CATEGORY_COLORS[memory.category] }}
                          >
                            {CATEGORY_LABELS[memory.category]}
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="h-1 w-16 rounded-full bg-[var(--surface-4)] overflow-hidden">
                              <div
                                className="h-full bg-white"
                                style={{ width: `${memory.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[var(--text-dim)] font-mono">
                              {Math.round(memory.confidence * 100)}%
                            </span>
                          </div>
                          <span className="text-[10px] text-[var(--text-dim)]">
                            {new Date(memory.updated_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <MemoryGraph
              memories={memories}
              onSelectMemory={id => {
                const memory = memories.find(m => m.id === id);
                if (memory) {
                  setEditingId(id);
                  setEditText(memory.fact);
                  setViewMode('list');
                }
              }}
              onDeleteMemory={handleDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
