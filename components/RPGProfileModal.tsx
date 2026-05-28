/**
 * RPG Profile Manager Modal
 * Полноценный UI для управления RPG профилем пользователя
 */

'use client';

import { useState, useEffect } from 'react';
import { X, ThumbsUp, ThumbsDown, Trash2, Edit2, MessageSquare, Calendar, Hash } from 'lucide-react';
import { loadRPGProfile, saveRPGProfile, type RPGStyleProfile, type FeedbackEntry } from '@/lib/rpg-style-profile';

interface RPGProfileModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateToChat?: (chatId: string) => void;
}

export function RPGProfileModal({ open, onClose, onNavigateToChat }: RPGProfileModalProps) {
  const [profile, setProfile] = useState<RPGStyleProfile | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FeedbackEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<FeedbackEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      const loaded = loadRPGProfile();
      setProfile(loaded);
    }
  }, [open]);

  if (!open || !profile) return null;

  const filteredEntries = profile.entries.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.excerpt.toLowerCase().includes(query) ||
      entry.comment.toLowerCase().includes(query)
    );
  });

  const handleDelete = (index: number) => {
    if (!confirm('Удалить эту запись?')) return;
    
    const newEntries = profile.entries.filter((_, i) => i !== index);
    const newProfile = {
      ...profile,
      entries: newEntries,
    };
    
    saveRPGProfile(newProfile);
    setProfile(newProfile);
    setSelectedEntry(null);
  };

  const handleEdit = (entry: FeedbackEntry, index: number) => {
    setEditingEntry({ ...entry, index } as any);
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;
    
    const index = (editingEntry as any).index;
    const newEntries = [...profile.entries];
    newEntries[index] = {
      rating: editingEntry.rating,
      comment: editingEntry.comment,
      excerpt: editingEntry.excerpt,
      timestamp: editingEntry.timestamp,
    };
    
    const newProfile = {
      ...profile,
      entries: newEntries,
    };
    
    saveRPGProfile(newProfile);
    setProfile(newProfile);
    setEditingEntry(null);
  };

  const handleNavigateToChat = (chatId?: string) => {
    if (!chatId || !onNavigateToChat) return;
    onNavigateToChat(chatId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[var(--surface-1)] rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">🎭 RPG Profile Manager</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              {profile.entries.length} записей • {profile.entries.filter(e => e.rating === 'like').length} 👍 • {profile.entries.filter(e => e.rating === 'dislike').length} 👎
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--surface-3)] transition-colors"
          >
            <X size={20} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[var(--border)]">
          <input
            type="text"
            placeholder="Поиск по контексту или chat ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Entries List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-muted)]">
                {searchQuery ? 'Ничего не найдено' : 'Нет записей в профиле'}
              </div>
            ) : (
              filteredEntries.map((entry, index) => {
                const actualIndex = profile.entries.indexOf(entry);
                const isSelected = selectedEntry === entry;
                
                return (
                  <div
                    key={actualIndex}
                    onClick={() => setSelectedEntry(entry)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-3)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        entry.rating === 'like' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {entry.rating === 'like' ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] line-clamp-2">
                          {entry.excerpt}
                        </p>
                        {entry.comment && (
                          <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">
                            {entry.comment}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(entry.timestamp).toLocaleString('ru-RU')}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(entry, actualIndex);
                          }}
                          className="p-1.5 rounded-md hover:bg-[var(--surface-4)] transition-colors"
                          title="Редактировать"
                        >
                          <Edit2 size={14} className="text-[var(--text-muted)]" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(actualIndex);
                          }}
                          className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail Panel */}
          {selectedEntry && (
            <div className="w-96 border-l border-[var(--border)] p-4 overflow-y-auto bg-[var(--surface-2)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Детали записи</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Оценка</label>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                    selectedEntry.rating === 'like' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {selectedEntry.rating === 'like' ? <ThumbsUp size={16} /> : <ThumbsDown size={16} />}
                    <span className="text-sm font-medium">
                      {selectedEntry.rating === 'like' ? 'Понравилось' : 'Не понравилось'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Отрывок ответа</label>
                  <div className="p-3 bg-[var(--surface-3)] rounded-lg text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                    {selectedEntry.excerpt}
                  </div>
                </div>

                {selectedEntry.comment && (
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Комментарий</label>
                    <div className="p-3 bg-[var(--surface-3)] rounded-lg text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                      {selectedEntry.comment}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">Дата</label>
                  <div className="text-sm text-[var(--text-primary)]">
                    {new Date(selectedEntry.timestamp).toLocaleString('ru-RU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editingEntry && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--border)] p-6 w-full max-w-2xl">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Редактировать запись</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-2 block">Оценка</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingEntry({ ...editingEntry, rating: 'like' })}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                        editingEntry.rating === 'like'
                          ? 'bg-green-500/20 border-green-500/30 text-green-400'
                          : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]'
                      }`}
                    >
                      <ThumbsUp size={16} />
                      Понравилось
                    </button>
                    <button
                      onClick={() => setEditingEntry({ ...editingEntry, rating: 'dislike' })}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                        editingEntry.rating === 'dislike'
                          ? 'bg-red-500/20 border-red-500/30 text-red-400'
                          : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]'
                      }`}
                    >
                      <ThumbsDown size={16} />
                      Не понравилось
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-2 block">Отрывок ответа</label>
                  <textarea
                    value={editingEntry.excerpt}
                    onChange={e => setEditingEntry({ ...editingEntry, excerpt: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  />
                </div>

                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-2 block">Комментарий (опционально)</label>
                  <textarea
                    value={editingEntry.comment}
                    onChange={e => setEditingEntry({ ...editingEntry, comment: e.target.value })}
                    rows={3}
                    placeholder="Добавьте комментарий..."
                    className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingEntry(null)}
                  className="flex-1 px-4 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 bg-purple-500 rounded-lg text-sm font-medium text-white hover:bg-purple-600 transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
