'use client';

import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Maximize2 } from 'lucide-react';
import ImageLightbox from './ImageLightbox';

export interface ImageMemoryPillProps {
  scope: 'local' | 'global';
  description: string;
  tags: string[];
  entities: string[];
  thumbnailBase64?: string;
  fullImageBase64?: string;
  memoryId?: string;
}

export default function ImageMemoryPill({
  scope,
  description,
  tags,
  entities,
  thumbnailBase64,
  fullImageBase64,
  memoryId,
}: ImageMemoryPillProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  const scopeLabel = scope === 'global' ? 'Глобальная' : 'Локальная';

  useEffect(() => {
    if (showTooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [showTooltip]);

  const imageSrc = fullImageBase64 || thumbnailBase64 || '';

  return (
    <>
      <div className="flex justify-start my-3 animate-fade-in">
        <div className="relative">
          <button
            ref={buttonRef}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(prev => !prev)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-all shadow-sm"
          >
            <ImageIcon size={12} className="text-[var(--text-dim)]" />
            <span className="text-xs text-[var(--text-muted)]">
              {scopeLabel} память: изображение сохранено
            </span>
            {thumbnailBase64 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLightbox(true);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 text-[10px] hover:bg-blue-500/25 transition-colors"
                title="Открыть полноразмерное изображение"
              >
                <Maximize2 size={9} />
                Открыть
              </button>
            )}
          </button>

          {showTooltip && (
            <div
              className="fixed z-[100] min-w-[280px] max-w-[400px] rounded-xl border border-white/10 bg-black/95 backdrop-blur-xl px-4 py-3 shadow-2xl animate-fade-in pointer-events-none"
              style={{
                top: `${tooltipPos.top}px`,
                left: `${tooltipPos.left}px`,
              }}
            >
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                  Изображение сохранено
                </p>

                {thumbnailBase64 && (
                  <div
                    className="w-20 h-20 rounded-lg overflow-hidden border border-white/10 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setShowLightbox(true)}
                  >
                    <img
                      src={thumbnailBase64}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <p className="text-xs text-white/90 line-clamp-3">
                  {description}
                </p>

                {entities.length > 0 && (
                  <div>
                    <p className="text-[10px] text-white/60 mb-1">Сущности:</p>
                    <div className="flex flex-wrap gap-1">
                      {entities.map((entity, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/80"
                        >
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {tags.length > 0 && (
                  <div>
                    <p className="text-[10px] text-white/60 mb-1">Теги:</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 5).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/60"
                        >
                          {tag}
                        </span>
                      ))}
                      {tags.length > 5 && (
                        <span className="text-[10px] text-white/40">
                          +{tags.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLightbox && imageSrc && (
        <ImageLightbox
          src={imageSrc}
          alt={description || 'Image memory'}
          imageId={memoryId || ''}
          fileName={description || 'Image memory'}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  );
}
