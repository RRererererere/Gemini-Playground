'use client';

import { useState, useCallback } from 'react';
import type { SceneState, SceneStateEntry, SceneStateCategory } from '@/types';
import { DEFAULT_SCENE_CATEGORIES } from '@/types';
import { getSceneStateCategories, loadSceneStateConfig, saveSceneStateConfig } from '@/lib/scene-state-storage';

interface SceneStatePanelProps {
  sceneState: SceneState | null;
  onSettingsOpen: () => void;
  onTogglePin: () => void;
  isPinned: boolean;
  onRequestCategory?: (request: { id: string; content: string }) => void;
}

export function SceneStatePanel({ sceneState, onSettingsOpen, onTogglePin, isPinned, onRequestCategory }: SceneStatePanelProps) {
  const [collapsed, setCollapsed] = useState(!isPinned);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const config = loadSceneStateConfig();
  const categories = getSceneStateCategories(config);

  // Build category lookup
  const categoryMap = new Map<string, SceneStateCategory>();
  categories.forEach(c => categoryMap.set(c.id, c));

  // Merge sceneState entries with category metadata
  const displayEntries: (SceneStateEntry & { label: string; icon: string; priority: string })[] = [];

  if (sceneState?.entries) {
    // Check for __request__ entries
    const requests = sceneState.entries.filter(e => e.id === '__request__');
    if (requests.length > 0 && onRequestCategory) {
      requests.forEach(r => onRequestCategory(r));
    }

    // Filter and map entries
    for (const entry of sceneState.entries) {
      if (entry.id === '__request__') continue;
      const cat = categoryMap.get(entry.id);
      if (!cat || !cat.enabled) continue;

      displayEntries.push({
        ...entry,
        label: cat?.label || entry.id,
        icon: cat?.icon || '📋',
        priority: cat?.priority || 'medium',
      });
    }

    // Sort by category order
    const orderMap = new Map<string, number>();
    config.categoryOrder.forEach((id, idx) => orderMap.set(id, idx));
    displayEntries.sort((a, b) => {
      const aOrder = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
      const bOrder = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
      return aOrder - bOrder;
    });
  }

  const toggleEntry = useCallback((id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!sceneState || displayEntries.length === 0) return null;

  return (
    <div className="my-2 rounded-lg border border-purple-500/20 bg-[#1a1a2e] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-purple-500/5 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-300">🗺️</span>
          <span className="text-purple-100 font-mono text-xs uppercase tracking-widest">
            Состояние сцены
          </span>
          <span className="text-purple-400/50 text-xs">[turn {sceneState.turnIndex}]</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className={`p-1 rounded hover:bg-purple-500/10 transition-colors ${isPinned ? 'text-yellow-400' : 'text-purple-400/50'}`}
            title={isPinned ? 'Открепить' : 'Закрепить'}
          >
            {isPinned ? '📌' : '📋'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSettingsOpen(); }}
            className="p-1 rounded hover:bg-purple-500/10 text-purple-400/50 transition-colors"
            title="Настройки"
          >
            ⚙️
          </button>
          <button className="p-1 rounded hover:bg-purple-500/10 text-purple-400/50 transition-colors">
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {displayEntries.map(entry => {
            const isExpanded = expandedEntries.has(entry.id);
            const isLong = entry.content.length > 120;

            return (
              <div key={entry.id} className="space-y-1">
                <div
                  className="flex items-start gap-2 cursor-pointer hover:bg-purple-500/5 rounded px-1 -mx-1 py-0.5"
                  onClick={() => isLong && toggleEntry(entry.id)}
                >
                  <span className="text-sm">{entry.icon}</span>
                  <span className="text-purple-300 font-mono text-[10px] uppercase tracking-wider flex-shrink-0 pt-0.5">
                    {entry.label}
                  </span>
                  {isLong && (
                    <span className="text-purple-400/30 text-[10px] ml-auto">
                      {isExpanded ? 'свернуть' : 'развернуть'}
                    </span>
                  )}
                </div>
                <div className={`text-purple-100/80 text-sm leading-relaxed pl-6 ${isLong && !isExpanded ? 'line-clamp-2' : ''}`}>
                  {entry.content}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
