'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import AnnotationOverlay from './AnnotationOverlay';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  imageId?: string;
  fileName?: string;
  metadata?: {
    width?: number;
    height?: number;
    size?: number;
    type?: string;
  };
  annotations?: import('@/types').AnnotationItem[];
  onClose: () => void;
  onAnnotationClick?: (annotation: import('@/types').AnnotationItem) => void;
}

export default function ImageLightbox({
  src,
  alt = '',
  imageId,
  fileName,
  metadata,
  annotations,
  onClose,
  onAnnotationClick
}: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Зум колесом мыши
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.5, Math.min(5, prev * delta)));
  }, []);

  // Двойной клик — сброс зума
  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Pan при зуме
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Скачивание
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName || 'image.png';
    link.click();
  }, [src, fileName]);

  // Копирование ID
  const handleCopyId = useCallback(() => {
    if (imageId) {
      navigator.clipboard.writeText(imageId);
    }
  }, [imageId]);

  // Обработка загрузки изображения для размеров
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgDimensions({ width: img.clientWidth, height: img.clientHeight });
  }, []);

  // Форматирование размера файла
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(20px) saturate(180%)'
      }}
      onClick={onClose}
    >
      {/* Контейнер модала */}
      <div
        className="relative flex flex-col max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Топбар */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/40 backdrop-blur-sm rounded-t-lg border-b border-white/10">
          <div className="flex items-center gap-3">
            {imageId && (
              <button
                onClick={handleCopyId}
                className="px-2 py-1 text-xs font-mono text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
                title="Копировать ID"
              >
                {imageId}
              </button>
            )}
            {fileName && (
              <span className="text-sm text-white/80">{fileName}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Скачать"
            >
              <Download size={18} />
            </button>
            <button
              onClick={() => setScale(prev => Math.max(0.5, prev - 0.2))}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Уменьшить"
            >
              <ZoomOut size={18} />
            </button>
            <span className="text-xs text-white/60 font-mono min-w-[3rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(prev => Math.min(5, prev + 0.2))}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Увеличить"
            >
              <ZoomIn size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Изображение */}
        <div
          className="relative flex items-center justify-center overflow-hidden bg-black/20"
          style={{ minHeight: '400px', minWidth: '400px' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={src}
            alt={alt}
            onDoubleClick={handleDoubleClick}
            onLoad={handleImageLoad}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
              maxWidth: '80vw',
              maxHeight: '70vh',
              objectFit: 'contain',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              boxShadow: `
                0 0 0 1px rgba(0, 0, 0, 0.8),
                0 0 60px rgba(0, 0, 0, 0.6),
                inset 0 0 0 1px rgba(255, 255, 255, 0.08)
              `
            }}
          />
          
          {/* Annotations overlay в lightbox */}
          {annotations && annotations.length > 0 && imgDimensions.width > 0 && (
            <div 
              className="absolute top-1/2 left-1/2 pointer-events-none"
              style={{
                width: `${imgDimensions.width}px`,
                height: `${imgDimensions.height}px`,
                transform: `translate(-50%, -50%) scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                transition: isDragging ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <AnnotationOverlay
                annotations={annotations}
                imageWidth={imgDimensions.width}
                imageHeight={imgDimensions.height}
                onAnnotationClick={(ann) => {
                  onClose();
                  onAnnotationClick?.(ann);
                }}
              />
            </div>
          )}
        </div>

        {/* Инфобар */}
        {metadata && (
          <div className="flex items-center justify-center gap-4 px-4 py-2 bg-black/40 backdrop-blur-sm rounded-b-lg border-t border-white/10">
            <span className="text-xs text-white/60">
              {metadata.width && metadata.height && `${metadata.width}×${metadata.height}`}
            </span>
            {metadata.size && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-xs text-white/60">{formatSize(metadata.size)}</span>
              </>
            )}
            {metadata.type && (
              <>
                <span className="text-white/30">·</span>
                <span className="text-xs text-white/60 uppercase">{metadata.type.split('/')[1]}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
