'use client';

import { useState } from 'react';
import type { AnnotationReference } from '@/types';
import ImageLightbox from './ImageLightbox';
import { getFile } from '@/lib/fileStorage';

interface AnnotationRefDisplayProps {
  annotationRefs: AnnotationReference[];
}

export default function AnnotationRefDisplay({ annotationRefs }: AnnotationRefDisplayProps) {
  const [lightboxData, setLightboxData] = useState<{
    src: string;
    imageId: string;
    imageName: string;
    annotation: AnnotationReference['annotation'];
  } | null>(null);

  const handleClick = async (ref: AnnotationReference) => {
    try {
      // Загружаем изображение из IndexedDB
      const file = await getFile(ref.imageId);
      
      if (!file) {
        console.error('Image not found:', ref.imageId);
        return;
      }

      const src = `data:${file.mimeType};base64,${file.data}`;
      
      setLightboxData({
        src,
        imageId: ref.imageId,
        imageName: ref.imageName,
        annotation: ref.annotation,
      });
    } catch (err) {
      console.error('Failed to load image:', err);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 my-2">
        {annotationRefs.map(ref => (
          <button
            key={ref.id}
            onClick={() => handleClick(ref)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all hover:scale-105 cursor-pointer group"
            style={{
              backgroundColor: `${ref.color}15`,
              borderColor: ref.color,
              boxShadow: `0 0 8px ${ref.color}40`
            }}
          >
            <div
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{
                borderColor: ref.color,
                color: ref.color
              }}
            >
              @
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate max-w-[200px]" style={{ color: ref.color }}>
                {ref.annotation.label}
              </span>
              <span className="text-[10px] opacity-70 truncate max-w-[200px]" style={{ color: ref.color }}>
                {ref.imageName}
              </span>
            </div>
            <div 
              className="ml-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: ref.color }}
            >
              👁️
            </div>
          </button>
        ))}
      </div>

      {lightboxData && (
        <ImageLightbox
          src={lightboxData.src}
          alt={lightboxData.imageName}
          imageId={lightboxData.imageId}
          fileName={lightboxData.imageName}
          annotations={[lightboxData.annotation]}
          onClose={() => setLightboxData(null)}
        />
      )}
    </>
  );
}
