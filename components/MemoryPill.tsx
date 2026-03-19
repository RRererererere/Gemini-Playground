'use client';

import { useState, useRef, useEffect } from 'react';
import { Brain } from 'lucide-react';

export type MemoryOperation = 'save' | 'update' | 'forget';

export interface MemoryPillProps {
  operation: MemoryOperation;
  scope: 'local' | 'global';
  fact?: string;
  oldFact?: string;
  category?: string;
  confidence?: number;
  reason?: string;
}

export default function MemoryPill({
  operation,
  scope,
  fact,
  oldFact,
  category,
  confidence,
  reason,
}: MemoryPillProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const scopeLabel = scope === 'global' ? 'Глобальная' : 'Локальная';
  
  let mainText = '';
  if (operation === 'save') mainText = `${scopeLabel} память сохранена`;
  if (operation === 'update') mainText = `${scopeLabel} память обновлена`;
  if (operation === 'forget') mainText = 'Память удалена';

  useEffect(() => {
    if (showTooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [showTooltip]);

  const renderTooltipContent = () => {
    if (operation === 'save' && fact) {
      return (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Сохранено</p>
          <p className="text-xs text-white/90">+ {fact}</p>
          {category && (
            <p className="text-[10px] text-white/60">
              Категория: <span className="text-white/80">{category}</span>
            </p>
          )}
          {confidence !== undefined && (
            <p className="text-[10px] text-white/60">
              Уверенность: <span className="text-white/80">{Math.round(confidence * 100)}%</span>
            </p>
          )}
        </div>
      );
    }

    if (operation === 'update' && oldFact && fact) {
      return (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Обновлено</p>
          <p className="text-xs text-white/50 line-through">{oldFact}</p>
          <p className="text-xs text-white/90">→ {fact}</p>
          {confidence !== undefined && (
            <p className="text-[10px] text-white/60">
              Уверенность: <span className="text-white/80">{Math.round(confidence * 100)}%</span>
            </p>
          )}
        </div>
      );
    }

    if (operation === 'forget' && fact) {
      return (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Удалено</p>
          <p className="text-xs text-white/90">{fact}</p>
          {reason && (
            <p className="text-[10px] text-white/60">
              Причина: <span className="text-white/80">{reason}</span>
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex justify-start my-3 animate-fade-in">
      <div className="relative">
        <button
          ref={buttonRef}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(prev => !prev)}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-all shadow-sm"
        >
          <Brain size={12} className="text-[var(--text-dim)]" />
          <span className="text-xs text-[var(--text-muted)]">{mainText}</span>
        </button>

        {showTooltip && (
          <div 
            className="fixed z-[100] min-w-[240px] max-w-[360px] rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl px-4 py-3 shadow-2xl animate-fade-in pointer-events-none"
            style={{
              top: `${tooltipPos.top}px`,
              left: `${tooltipPos.left}px`,
            }}
          >
            {renderTooltipContent()}
          </div>
        )}
      </div>
    </div>
  );
}
