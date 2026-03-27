/**
 * Компонент для отображения recall image memory операции
 */

'use client';

import { Image as ImageIcon, Eye } from 'lucide-react';

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
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 animate-fade-in mb-2">
      <Eye size={12} className="text-blue-400 flex-shrink-0" />
      <span className="text-xs text-blue-300">
        Вспомнено изображение
      </span>
      {thumbnailBase64 && (
        <div className="w-6 h-6 rounded overflow-hidden border border-blue-500/30">
          <img
            src={thumbnailBase64}
            alt={description || 'Memory'}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      {description && (
        <span className="text-[10px] text-blue-300/70 max-w-[200px] truncate">
          {description}
        </span>
      )}
    </div>
  );
}
