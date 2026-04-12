/**
 * Компонент для отображения recall image memory операции
 * Улучшено: увеличенная миниатюра + клик для полноразмерного просмотра
 */

'use client';

import { useState } from 'react';
import { Image as ImageIcon, Eye } from 'lucide-react';
import ImageLightbox from './ImageLightbox';

interface ImageMemoryRecallPillProps {
  memoryId: string;
  description?: string;
  thumbnailBase64?: string;
}

export default function ImageMemoryRecallPill({
  memoryId,
  description,
  thumbnailBase64,
}: ImageMemoryRecallPillProps) {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 animate-fade-in mb-2 max-w-full sm:max-w-none">
        <Eye size={12} className="text-blue-400 flex-shrink-0" />
        <span className="text-xs text-blue-300 hidden sm:inline">
          Вспомнено изображение
        </span>
        <span className="text-xs text-blue-300 sm:hidden">
          🖼
        </span>
        {thumbnailBase64 && (
          <div
            className="w-14 h-14 rounded-lg overflow-hidden border-2 border-blue-500/40 cursor-pointer hover:border-blue-400/60 transition-all hover:scale-105 flex-shrink-0 shadow-lg active:scale-95 sm:hover:scale-105"
            onClick={() => setShowLightbox(true)}
          >
            <img
              src={thumbnailBase64}
              alt={description || 'Memory'}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {description && (
          <span className="text-[11px] text-blue-300/70 max-w-[120px] sm:max-w-[240px] line-clamp-2">
            {description}
          </span>
        )}
        {!thumbnailBase64 && description && (
          <button
            onClick={() => setShowLightbox(true)}
            className="text-[10px] text-blue-400/60 hover:text-blue-300 transition-colors underline px-1.5 py-0.5"
          >
            Просмотр
          </button>
        )}
      </div>

      {showLightbox && thumbnailBase64 && (
        <ImageLightbox
          src={thumbnailBase64}
          alt={description || 'Recalled image'}
          imageId={memoryId}
          fileName={description || 'Recalled image'}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  );
}
