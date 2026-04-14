'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SceneStateConfig, SceneStateEntry, SceneStateCategory } from '@/types';
import { DEFAULT_SCENE_CATEGORIES } from '@/types';
import {
  loadSceneStateConfig,
  saveSceneStateConfig,
  getSceneStateCategories,
} from '@/lib/scene-state-storage';

interface SceneStateSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SceneStateSettingsModal({ isOpen, onClose }: SceneStateSettingsModalProps) {
  const [config, setConfig] = useState<SceneStateConfig>(loadSceneStateConfig);
  const [activeTab, setActiveTab] = useState<'categories' | 'instructions'>('categories');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState<{ id: string; label: string; icon: string; priority: 'high' | 'medium' | 'low' }>({ id: '', label: '', icon: '📋', priority: 'medium' });

  // Reset to latest config on open
  useEffect(() => {
    if (isOpen) setConfig(loadSceneStateConfig());
  }, [isOpen]);

  const save = useCallback((next: SceneStateConfig) => {
    setConfig(next);
    saveSceneStateConfig(next);
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setConfig(prev => {
      const enabled = prev.enabledCategories.includes(id)
        ? prev.enabledCategories.filter(e => e !== id)
        : [...prev.enabledCategories, id];
      const next = { ...prev, enabledCategories: enabled };
      save(next);
      return next;
    });
  }, [save]);

  const addCategory = useCallback(() => {
    if (!newCategory.id || !newCategory.label) return;
    setConfig(prev => {
      const customEntry: SceneStateEntry = {
        id: newCategory.id,
        content: '',
        label: newCategory.label,
        icon: newCategory.icon,
        priority: newCategory.priority,
        enabled: true,
      };
      const next = {
        ...prev,
        customCategories: [...prev.customCategories, customEntry],
        enabledCategories: [...prev.enabledCategories, newCategory.id],
        categoryOrder: [...prev.categoryOrder, newCategory.id],
      };
      save(next);
      return next;
    });
    setNewCategory({ id: '', label: '', icon: '📋', priority: 'medium' });
    setShowAddCategory(false);
  }, [newCategory, save]);

  const removeCategory = useCallback((id: string) => {
    setConfig(prev => {
      const next = {
        ...prev,
        customCategories: prev.customCategories.filter(c => c.id !== id),
        enabledCategories: prev.enabledCategories.filter(e => e !== id),
      };
      save(next);
      return next;
    });
  }, [save]);

  const moveCategory = useCallback((id: string, direction: 'up' | 'down') => {
    setConfig(prev => {
      const order = [...prev.categoryOrder];
      const idx = order.indexOf(id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= order.length) return prev;
      [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
      const next = { ...prev, categoryOrder: order };
      save(next);
      return next;
    });
  }, [save]);

  if (!isOpen) return null;

  const categories = getSceneStateCategories(config);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-purple-500/20 bg-[#1a1a2e] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20">
          <h2 className="text-purple-100 font-semibold">⚙️ Настройки состояния сцены</h2>
          <button onClick={onClose} className="text-purple-400/50 hover:text-purple-200 transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-purple-500/20">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'categories' ? 'text-purple-200 border-b-2 border-purple-400' : 'text-purple-400/60 hover:text-purple-200'}`}
          >
            Категории
          </button>
          <button
            onClick={() => setActiveTab('instructions')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'instructions' ? 'text-purple-200 border-b-2 border-purple-400' : 'text-purple-400/60 hover:text-purple-200'}`}
          >
            Инструкции ИИ
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'categories' ? (
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div key={cat.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-purple-500/5">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center text-xs transition-colors ${cat.enabled ? 'bg-purple-500 text-white' : 'bg-purple-500/20 text-purple-400/30'}`}
                  >
                    {cat.enabled ? '✓' : ''}
                  </button>

                  {/* Icon + Label */}
                  <span className="text-base">{cat.icon}</span>
                  <span className="text-purple-100/80 text-sm flex-1">{cat.label}</span>

                  {/* Priority badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    cat.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                    cat.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    {cat.priority}
                  </span>

                  {/* Move buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveCategory(cat.id, 'up')}
                      disabled={idx === 0}
                      className="text-purple-400/40 hover:text-purple-200 disabled:opacity-20 text-[10px]"
                    >▲</button>
                    <button
                      onClick={() => moveCategory(cat.id, 'down')}
                      disabled={idx === categories.length - 1}
                      className="text-purple-400/40 hover:text-purple-200 disabled:opacity-20 text-[10px]"
                    >▼</button>
                  </div>

                  {/* Remove (custom only) */}
                  {cat.custom && (
                    <button
                      onClick={() => removeCategory(cat.id)}
                      className="text-red-400/60 hover:text-red-300 ml-1"
                    >✕</button>
                  )}
                </div>
              ))}

              {/* Add category */}
              {showAddCategory ? (
                <div className="space-y-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <input
                    type="text"
                    placeholder="ID (например: emotions)"
                    value={newCategory.id}
                    onChange={e => setNewCategory(p => ({ ...p, id: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') }))}
                    className="w-full px-2 py-1.5 rounded bg-[#1a1a2e] border border-purple-500/30 text-purple-100 text-sm placeholder-purple-400/40"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Название"
                      value={newCategory.label}
                      onChange={e => setNewCategory(p => ({ ...p, label: e.target.value }))}
                      className="flex-1 px-2 py-1.5 rounded bg-[#1a1a2e] border border-purple-500/30 text-purple-100 text-sm placeholder-purple-400/40"
                    />
                    <input
                      type="text"
                      placeholder="📋"
                      value={newCategory.icon}
                      onChange={e => setNewCategory(p => ({ ...p, icon: e.target.value }))}
                      className="w-12 px-2 py-1.5 rounded bg-[#1a1a2e] border border-purple-500/30 text-purple-100 text-sm text-center"
                    />
                    <select
                      value={newCategory.priority}
                      onChange={e => setNewCategory(p => ({ ...p, priority: e.target.value as 'high' | 'medium' | 'low' }))}
                      className="px-2 py-1.5 rounded bg-[#1a1a2e] border border-purple-500/30 text-purple-100 text-sm"
                    >
                      <option value="high">Высокий</option>
                      <option value="medium">Средний</option>
                      <option value="low">Низкий</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addCategory} className="px-3 py-1 rounded bg-purple-500 text-white text-sm hover:bg-purple-400">Добавить</button>
                    <button onClick={() => setShowAddCategory(false)} className="px-3 py-1 rounded bg-purple-500/20 text-purple-300 text-sm hover:bg-purple-500/30">Отмена</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="w-full px-3 py-2 rounded-lg border border-dashed border-purple-500/30 text-purple-400/60 text-sm hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
                >
                  + Добавить свою категорию
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={config.aiInstructions}
                onChange={e => save({ ...config, aiInstructions: e.target.value })}
                placeholder="Дополнительные инструкции для ИИ при заполнении состояния сцены..."
                className="w-full h-40 px-3 py-2 rounded-lg bg-[#1a1a2e] border border-purple-500/30 text-purple-100 text-sm placeholder-purple-400/40 resize-none focus:outline-none focus:border-purple-400/50"
              />
              <p className="text-purple-400/40 text-xs">
                Эти инструкции будут добавлены в промпт DeepThink. Например: «Всегда указывай точное положение каждого персонажа в комнате. Не забывай про освещение.»
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
