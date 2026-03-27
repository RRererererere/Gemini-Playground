/**
 * Детальный просмотр image memory с полной информацией и связями
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Tag, Calendar, Eye, Link as LinkIcon, Image as ImageIcon, Trash2, Edit2, Check } from 'lucide-react';
import type { ImageMemoryMeta } from '@/lib/image-memory-store';
import { loadImageMemoryData, updateImageMemory, forgetImageMemory, getImageMemoryIndex } from '@/lib/image-memory-store';
import { getMemories, type Memory } from '@/lib/memory-store';

interface ImageMemoryDetailModalProps {
  memoryId: string;
  onClose: () => void;
  onDelete?: () => void;
}

export default function ImageMemoryDetailModal({
  memoryId,
  onClose,
  onDelete,
}: ImageMemoryDetailModalProps) {
  const [memory, setMemory] = useState<ImageMemoryMeta | null>(null);
  const [fullImageData, setFullImageData] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [editedEntities, setEditedEntities] = useState<string[]>([]);
  const [relatedImages, setRelatedImages] = useState<ImageMemoryMeta[]>([]);
  const [relatedTextMemories, setRelatedTextMemories] = useState<Memory[]>([]);
  
  useEffect(() => {
    loadMemoryData();
  }, [memoryId]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditing]);
  
  const loadMemoryData = async () => {
    const allMemories = getImageMemoryIndex();
    const mem = allMemories.find(m => m.id === memoryId);
    
    if (!mem) {
      onClose();
      return;
    }
    
    setMemory(mem);
    setEditedDescription(mem.description);
    setEditedTags([...mem.tags]);
    setEditedEntities([...mem.entities]);
    
    // Загружаем полное изображение
    const fullData = await loadImageMemoryData(memoryId);
    if (fullData) {
      setFullImageData(fullData);
    }
    
    // Загружаем связанные изображения
    if (mem.relatedImageIds && mem.relatedImageIds.length > 0) {
      const related = allMemories.filter(m => mem.relatedImageIds!.includes(m.id));
      setRelatedImages(related);
    }
    
    // Загружаем связанные текстовые воспоминания
    if (mem.relatedMemoryIds && mem.relatedMemoryIds.length > 0) {
      const allTextMems = getMemories(mem.scope, mem.savedFromChatId);
      const related = allTextMems.filter(m => mem.relatedMemoryIds!.includes(m.id));
      setRelatedTextMemories(related);
    }
  };
  
  const handleSave = async () => {
    if (!memory) return;
    
    await updateImageMemory(memoryId, {
      description: editedDescription,
      tags: editedTags,
      entities: editedEntities,
    });
    
    setIsEditing(false);
    loadMemoryData();
  };
  
  const handleDelete = async () => {
    if (!confirm('Удалить это изображение из памяти?')) return;
    
    await forgetImageMemory(memoryId);
    onDelete?.();
    onClose();
  };
  
  const addTag = (tag: string) => {
    if (tag && !editedTags.includes(tag)) {
      setEditedTags([...editedTags, tag]);
    }
  };
  
  const removeTag = (tag: string) => {
    setEditedTags(editedTags.filter(t => t !== tag));
  };
  
  const addEntity = (entity: string) => {
    if (entity && !editedEntities.includes(entity)) {
      setEditedEntities([...editedEntities, entity]);
    }
  };
  
  const removeEntity = (entity: string) => {
    setEditedEntities(editedEntities.filter(e => e !== entity));
  };
  
  if (!memory) {
    return null;
  }
  
  const displayImage = fullImageData || memory.thumbnailBase64;
  
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Визуальная память
            </h2>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] hover:bg-red-500/10 hover:text-[var(--gem-red)] transition-colors"
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Image */}
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]">
                <img
                  src={displayImage}
                  alt={memory.description}
                  className="w-full h-auto"
                />
              </div>
              
              {/* Metadata */}
              <div className="space-y-2 text-xs text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <Calendar size={12} />
                  <span>Сохранено: {new Date(memory.created_at).toLocaleString('ru-RU')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye size={12} />
                  <span>Использовано: {memory.mentions} раз</span>
                </div>
                <div className="flex items-center gap-2">
                  <ImageIcon size={12} />
                  <span>ID: {memory.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                    memory.scope === 'global' 
                      ? 'bg-purple-500/20 text-purple-300' 
                      : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {memory.scope === 'global' ? 'Глобальная' : 'Локальная'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Right: Details */}
            <div className="space-y-4">
              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                  Описание
                </label>
                {isEditing ? (
                  <textarea
                    value={editedDescription}
                    onChange={e => setEditedDescription(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none resize-none"
                    rows={4}
                  />
                ) : (
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {memory.description}
                  </p>
                )}
              </div>
              
              {/* Entities */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                  Сущности
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {(isEditing ? editedEntities : memory.entities).map((entity, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center gap-1"
                    >
                      {entity}
                      {isEditing && (
                        <button
                          onClick={() => removeEntity(entity)}
                          className="hover:text-purple-100"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {isEditing && (
                    <input
                      type="text"
                      placeholder="Добавить..."
                      className="px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          addEntity(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  )}
                </div>
              </div>
              
              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">
                  Теги
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {(isEditing ? editedTags : memory.tags).map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded bg-[var(--surface-3)] text-[var(--text-muted)] text-xs flex items-center gap-1"
                    >
                      <Tag size={10} />
                      {tag}
                      {isEditing && (
                        <button
                          onClick={() => removeTag(tag)}
                          className="hover:text-[var(--text-primary)]"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {isEditing && (
                    <input
                      type="text"
                      placeholder="Добавить тег..."
                      className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          addTag(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  )}
                </div>
              </div>
              
              {/* Related Images */}
              {relatedImages.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                    <LinkIcon size={12} />
                    Связанные изображения ({relatedImages.length})
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {relatedImages.map(img => (
                      <div
                        key={img.id}
                        className="aspect-square rounded-lg overflow-hidden border border-[var(--border)] cursor-pointer hover:border-[var(--border-strong)] transition-colors"
                        title={img.description}
                      >
                        <img
                          src={img.thumbnailBase64}
                          alt={img.description}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Related Text Memories */}
              {relatedTextMemories.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-2 flex items-center gap-1">
                    <LinkIcon size={12} />
                    Связанные воспоминания ({relatedTextMemories.length})
                  </label>
                  <div className="space-y-2">
                    {relatedTextMemories.map(mem => (
                      <div
                        key={mem.id}
                        className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
                      >
                        <p className="text-xs text-[var(--text-primary)] line-clamp-2">
                          {mem.fact}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Edit Actions */}
              {isEditing && (
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:opacity-80 transition-opacity"
                  >
                    <Check size={14} />
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedDescription(memory.description);
                      setEditedTags([...memory.tags]);
                      setEditedEntities([...memory.entities]);
                    }}
                    className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
