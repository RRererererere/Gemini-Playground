'use client';

import type { SkillArtifact, AnnotationItem } from '@/types';
import { useState, useEffect } from 'react';
import { Download, X, ZoomIn, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import ImageLightbox from './ImageLightbox';
import AnnotationOverlay from './AnnotationOverlay';
import { VideoFrameIndicator } from './VideoFrameIndicator';

interface Props {
  artifact: SkillArtifact;
  onAnnotationClick?: (annotation: AnnotationItem) => void;
}

interface GroupProps {
  artifacts: SkillArtifact[];
  onAnnotationClick?: (annotation: AnnotationItem) => void;
}

// Группировка артефактов по типу для красивого отображения
export function SkillArtifactsGroup({ artifacts, onAnnotationClick }: GroupProps) {
  // Группируем изображения вместе
  const images = artifacts.filter(a => a.type === 'image');
  const others = artifacts.filter(a => a.type !== 'image');

  return (
    <>
      {images.length > 0 && (
        images.length === 1 ? (
          <SkillArtifactRenderer artifact={images[0]} onAnnotationClick={onAnnotationClick} />
        ) : (
          <ImageGallery artifacts={images} onAnnotationClick={onAnnotationClick} />
        )
      )}
      {others.map(artifact => (
        <SkillArtifactRenderer key={artifact.id} artifact={artifact} onAnnotationClick={onAnnotationClick} />
      ))}
    </>
  );
}

export function SkillArtifactRenderer({ artifact, onAnnotationClick }: Props) {
  switch (artifact.type) {
    case 'image':
      return <ArtifactImage artifact={artifact} onAnnotationClick={onAnnotationClick} />;
    case 'annotated_image':
      return <ArtifactAnnotatedImage artifact={artifact} onAnnotationClick={onAnnotationClick} />;
    case 'video':
      return <ArtifactVideo artifact={artifact} />;
    case 'audio':
      return <ArtifactAudio artifact={artifact} />;
    case 'code':
      return <ArtifactCode artifact={artifact} />;
    case 'text':
      return <ArtifactText artifact={artifact} />;
    case 'table':
      return <ArtifactTable artifact={artifact} />;
    case 'document':
      return <ArtifactDocument artifact={artifact} />;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Gallery - для множественных изображений
// ─────────────────────────────────────────────────────────────────────────────

function ImageGallery({ artifacts, onAnnotationClick }: GroupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const currentArtifact = artifacts[selectedIndex];
  const src = currentArtifact.data.kind === 'base64'
    ? `data:${currentArtifact.data.mimeType};base64,${currentArtifact.data.base64}`
    : currentArtifact.data.kind === 'url'
    ? currentArtifact.data.url
    : '';

  const goNext = () => setSelectedIndex((selectedIndex + 1) % artifacts.length);
  const goPrev = () => setSelectedIndex((selectedIndex - 1 + artifacts.length) % artifacts.length);

  const metadata = currentArtifact.data.kind === 'base64' ? {
    type: currentArtifact.data.mimeType,
    size: currentArtifact.data.base64 ? Math.round((currentArtifact.data.base64.length * 3) / 4) : undefined
  } : undefined;

  return (
    <div className="my-3">
      {currentArtifact.label && (
        <div className="text-xs text-zinc-400 mb-2">{currentArtifact.label}</div>
      )}
      
      {/* Main image */}
      <div className="relative inline-block max-w-full group">
        <img
          src={src}
          alt={currentArtifact.label || 'Artifact'}
          className="max-w-full max-h-[200px] h-auto rounded-xl cursor-zoom-in transition-all duration-200"
          style={{
            border: '1.5px solid rgba(255, 255, 255, 0.08)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.08),
              0 0 0 2px rgba(255,255,255,0.04),
              inset 0 0 0 1px rgba(255,255,255,0.06)
            `
          }}
          onClick={() => setIsZoomed(true)}
        />
        
        {/* Navigation arrows */}
        {artifacts.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-full transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className="bg-black/70 hover:bg-black/90 text-white p-2 rounded-full transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Download button */}
        {currentArtifact.downloadable !== false && (
          <button
            onClick={(e) => { e.stopPropagation(); downloadArtifact(currentArtifact); }}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Скачать"
          >
            <Download size={14} />
          </button>
        )}

        {/* Counter */}
        {artifacts.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-xs">
            {selectedIndex + 1} / {artifacts.length}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {artifacts.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
          {artifacts.map((artifact, idx) => {
            const thumbSrc = artifact.data.kind === 'base64'
              ? `data:${artifact.data.mimeType};base64,${artifact.data.base64}`
              : artifact.data.kind === 'url'
              ? artifact.data.url
              : '';
            
            return (
              <button
                key={artifact.id}
                onClick={() => setSelectedIndex(idx)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === selectedIndex 
                    ? 'border-blue-500 ring-2 ring-blue-500/30' 
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
      )}

      {/* Zoom with ImageLightbox */}
      {isZoomed && (
        <ImageLightbox
          src={src}
          alt={currentArtifact.label || 'Artifact'}
          fileName={currentArtifact.filename}
          metadata={metadata}
          onClose={() => setIsZoomed(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Image
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactImage({ artifact, onAnnotationClick }: Props) {
  const [isZoomed, setIsZoomed] = useState(false);
  
  const src = artifact.data.kind === 'base64'
    ? `data:${artifact.data.mimeType};base64,${artifact.data.base64}`
    : artifact.data.kind === 'url'
    ? artifact.data.url
    : '';

  if (!src) return null;

  // Извлекаем метаданные если есть
  const metadata = artifact.data.kind === 'base64' ? {
    type: artifact.data.mimeType,
    size: artifact.data.base64 ? Math.round((artifact.data.base64.length * 3) / 4) : undefined
  } : undefined;

  // Проверяем, является ли это кадром из видео (по label)
  const isVideoFrame = artifact.label?.includes('Frame from') || artifact.label?.includes('Кадр из');
  const videoFrameMatch = artifact.label?.match(/Frame from (.+?) at ([\d.]+)s/);
  const videoSource = videoFrameMatch?.[1];
  const timestampSeconds = videoFrameMatch?.[2] ? parseFloat(videoFrameMatch[2]) : undefined;

  return (
    <div className="my-3">
      {artifact.label && !isVideoFrame && (
        <div className="text-xs text-zinc-400 mb-2">{artifact.label}</div>
      )}
      {isVideoFrame && videoSource && timestampSeconds !== undefined && (
        <div className="mb-2">
          <VideoFrameIndicator 
            videoSource={videoSource}
            timestampSeconds={timestampSeconds}
          />
        </div>
      )}
      <div className="relative inline-block group">
        <img
          src={src}
          alt={artifact.label || 'Artifact'}
          className="max-w-full max-h-[200px] h-auto rounded-xl cursor-zoom-in transition-all duration-200"
          style={{
            border: '1.5px solid rgba(255, 255, 255, 0.08)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.08),
              0 0 0 2px rgba(255,255,255,0.04),
              inset 0 0 0 1px rgba(255,255,255,0.06)
            `
          }}
          onClick={() => setIsZoomed(true)}
        />
        
        {/* Hover overlay with zoom icon */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5">
            <ZoomIn size={14} />
            <span>Увеличить</span>
          </div>
        </div>

        {/* Download button */}
        {artifact.downloadable !== false && (
          <button
            onClick={(e) => { e.stopPropagation(); downloadArtifact(artifact); }}
            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Скачать"
          >
            <Download size={14} />
          </button>
        )}
      </div>

      {isZoomed && (
        <ImageLightbox
          src={src}
          alt={artifact.label || 'Artifact'}
          fileName={artifact.filename}
          metadata={metadata}
          onClose={() => setIsZoomed(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Annotated Image
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactAnnotatedImage({ artifact, onAnnotationClick }: Props) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0 });
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const imgRef = useState<HTMLImageElement | null>(null)[0];
  
  if (artifact.data.kind !== 'annotations') return null;

  const { sourceImageId, annotations } = artifact.data;

  useEffect(() => {
    async function loadSourceImage() {
      try {
        // Импортируем loadFileData динамически
        const { loadFileData } = await import('@/lib/fileStorage');
        
        // Загружаем из IndexedDB
        const base64Data = await loadFileData(sourceImageId);
        
        if (base64Data) {
          // Определяем MIME type (по умолчанию image/png)
          const mimeType = base64Data.startsWith('/9j/') ? 'image/jpeg' 
                         : base64Data.startsWith('iVBOR') ? 'image/png'
                         : base64Data.startsWith('R0lGOD') ? 'image/gif'
                         : base64Data.startsWith('UklGR') ? 'image/webp'
                         : 'image/png';
          
          setSourceImage(`data:${mimeType};base64,${base64Data}`);
        } else {
          console.warn('Source image not found in IndexedDB:', sourceImageId);
        }
      } catch (err) {
        console.error('Failed to load source image:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSourceImage();
  }, [sourceImageId]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Используем clientWidth/clientHeight — реальный размер в DOM
    setImgDimensions({ width: img.clientWidth, height: img.clientHeight });
  };

  if (loading) {
    return (
      <div className="my-3 p-4 bg-zinc-800/50 rounded-lg text-zinc-400 text-sm flex items-center gap-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-400"></div>
        Загрузка изображения...
      </div>
    );
  }

  if (!sourceImage) {
    return (
      <div className="my-3 p-4 bg-zinc-800/50 rounded-lg text-zinc-400 text-sm">
        Исходное изображение не найдено (ID: {sourceImageId})
      </div>
    );
  }

  return (
    <div className="my-3">
      {artifact.label && (
        <div className="text-xs text-zinc-400 mb-2">{artifact.label}</div>
      )}
      <div className="relative inline-block group">
        <img
          src={sourceImage}
          alt={artifact.label || 'Annotated image'}
          className="max-w-full max-h-[400px] h-auto rounded-xl cursor-zoom-in block"
          style={{
            border: '1.5px solid rgba(255, 255, 255, 0.08)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.08),
              0 0 0 2px rgba(255,255,255,0.04),
              inset 0 0 0 1px rgba(255,255,255,0.06)
            `
          }}
          onLoad={handleImageLoad}
          onClick={() => setIsZoomed(true)}
        />
        
        {/* Annotations overlay — positioned absolutely over the image */}
        {imgDimensions.width > 0 && (
          <div 
            className="absolute top-0 left-0 pointer-events-none"
            style={{
              width: `${imgDimensions.width}px`,
              height: `${imgDimensions.height}px`
            }}
          >
            <AnnotationOverlay
              annotations={annotations}
              imageWidth={imgDimensions.width}
              imageHeight={imgDimensions.height}
              onAnnotationClick={(ann) => {
                if (onAnnotationClick) {
                  // Создаем полный контекст аннотации
                  const annotationColors: Record<string, string> = {
                    highlight: '#FBBF24',
                    pointer: '#60A5FA',
                    warning: '#F87171',
                    success: '#4ADE80',
                    info: '#A78BFA'
                  };
                  
                  const annotationRef: import('@/types').AnnotationReference = {
                    id: Math.random().toString(36).slice(2),
                    imageId: sourceImageId,
                    imageName: artifact.filename || artifact.label || 'analyzed-image.png',
                    annotation: ann,
                    color: annotationColors[ann.type] || '#60A5FA'
                  };
                  
                  if ((window as any).__chatInputAddAnnotation) {
                    (window as any).__chatInputAddAnnotation(annotationRef);
                  }
                }
              }}
            />
          </div>
        )}

        {/* Hover hint */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5">
            <ZoomIn size={14} />
            <span>Увеличить</span>
          </div>
        </div>
      </div>

      {isZoomed && (
        <ImageLightbox
          src={sourceImage}
          alt={artifact.label || 'Annotated image'}
          imageId={sourceImageId}
          fileName={artifact.filename || artifact.label || 'analyzed-image.png'}
          annotations={annotations}
          onAnnotationClick={(ann) => {
            setIsZoomed(false);
            if (onAnnotationClick) {
              // Создаем полный контекст аннотации
              const annotationColors: Record<string, string> = {
                highlight: '#FBBF24',
                pointer: '#60A5FA',
                warning: '#F87171',
                success: '#4ADE80',
                info: '#A78BFA'
              };
              
              const annotationRef: import('@/types').AnnotationReference = {
                id: Math.random().toString(36).slice(2),
                imageId: sourceImageId,
                imageName: artifact.filename || artifact.label || 'analyzed-image.png',
                annotation: ann,
                color: annotationColors[ann.type] || '#60A5FA'
              };
              
              if ((window as any).__chatInputAddAnnotation) {
                (window as any).__chatInputAddAnnotation(annotationRef);
              }
            }
          }}
          onClose={() => setIsZoomed(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactVideo({ artifact }: Props) {
  const src = artifact.data.kind === 'base64'
    ? `data:${artifact.data.mimeType};base64,${artifact.data.base64}`
    : artifact.data.kind === 'url'
    ? artifact.data.url
    : '';

  if (!src) return null;

  return (
    <div className="my-3">
      <div className="flex items-center justify-between mb-2">
        {artifact.label && (
          <div className="text-xs text-zinc-400">{artifact.label}</div>
        )}
        {artifact.downloadable !== false && (
          <button
            onClick={() => downloadArtifact(artifact)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
          >
            <Download size={14} />
            Скачать
          </button>
        )}
      </div>
      <video controls className="max-w-full rounded-lg bg-black">
        <source src={src} type={artifact.data.kind === 'base64' ? artifact.data.mimeType : undefined} />
      </video>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactAudio({ artifact }: Props) {
  const src = artifact.data.kind === 'base64'
    ? `data:${artifact.data.mimeType};base64,${artifact.data.base64}`
    : artifact.data.kind === 'url'
    ? artifact.data.url
    : '';

  if (!src) return null;

  return (
    <div className="my-3">
      <div className="flex items-center justify-between mb-2">
        {artifact.label && (
          <div className="text-xs text-zinc-400">{artifact.label}</div>
        )}
        {artifact.downloadable !== false && (
          <button
            onClick={() => downloadArtifact(artifact)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
          >
            <Download size={14} />
            Скачать
          </button>
        )}
      </div>
      <audio controls className="w-full max-w-md">
        <source src={src} type={artifact.data.kind === 'base64' ? artifact.data.mimeType : undefined} />
      </audio>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Code
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactCode({ artifact }: Props) {
  if (artifact.data.kind !== 'text') return null;

  return (
    <div className="my-3">
      <div className="flex items-center justify-between mb-2">
        {artifact.label && (
          <div className="text-xs text-zinc-400">{artifact.label}</div>
        )}
        {artifact.downloadable !== false && (
          <button
            onClick={() => downloadArtifact(artifact)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
          >
            <Download size={14} />
            Скачать
          </button>
        )}
      </div>
      <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg overflow-x-auto text-sm border border-zinc-800">
        <code>{artifact.data.content}</code>
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactText({ artifact }: Props) {
  if (artifact.data.kind !== 'text') return null;

  return (
    <div className="my-3">
      {artifact.label && (
        <div className="text-xs text-zinc-400 mb-2">{artifact.label}</div>
      )}
      <div className="bg-zinc-800/50 p-3 rounded-lg text-sm whitespace-pre-wrap border border-zinc-700/50">
        {artifact.data.content}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactTable({ artifact }: Props) {
  if (artifact.data.kind !== 'json') return null;

  const data = artifact.data.value as { headers?: string[]; rows?: string[][] };
  if (!data.headers || !data.rows) return null;

  const downloadCSV = () => {
    const csv = [
      data.headers!.join(','),
      ...data.rows!.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = artifact.filename || 'table.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-3">
      <div className="flex items-center justify-between mb-2">
        {artifact.label && (
          <div className="text-xs text-zinc-400">{artifact.label}</div>
        )}
        {artifact.downloadable !== false && (
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
          >
            <Download size={14} />
            CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-700">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-800">
            <tr>
              {data.headers.map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left font-medium border-b border-zinc-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-zinc-900/30">
            {data.rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document (Office files: DOCX, XLSX, PPTX)
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactDocument({ artifact }: Props) {
  // Определяем тип документа по MIME type
  const getDocumentInfo = () => {
    const mime = artifact.data.kind === 'base64' ? artifact.data.mimeType : '';
    if (mime.includes('wordprocessingml') || mime.includes('msword')) {
      return { icon: '📄', type: 'Word', color: 'bg-blue-500/10 border-blue-500/30' };
    }
    if (mime.includes('spreadsheetml') || mime.includes('excel')) {
      return { icon: '📊', type: 'Excel', color: 'bg-green-500/10 border-green-500/30' };
    }
    if (mime.includes('presentationml') || mime.includes('powerpoint')) {
      return { icon: '📽️', type: 'PowerPoint', color: 'bg-orange-500/10 border-orange-500/30' };
    }
    return { icon: '📁', type: 'Документ', color: 'bg-zinc-500/10 border-zinc-500/30' };
  };

  const docInfo = getDocumentInfo();
  const filename = artifact.filename || 'document';
  
  // Размер файла в KB/MB
  const getFileSize = () => {
    if (artifact.data.kind !== 'base64') return '';
    try {
      const bytes = atob(artifact.data.base64).length;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } catch {
      return '';
    }
  };

  return (
    <div className="my-3">
      {artifact.label && (
        <div className="text-xs text-zinc-400 mb-2">{artifact.label}</div>
      )}
      
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${docInfo.color} transition-colors`}>
        {/* Icon */}
        <div className="text-3xl flex-shrink-0">
          {docInfo.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-zinc-200 truncate">
            {filename}
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            {docInfo.type} • {getFileSize()}
          </div>
        </div>

        {/* Download button */}
        {artifact.downloadable !== false && (
          <button
            onClick={() => downloadArtifact(artifact)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm rounded-lg transition-colors flex-shrink-0"
          >
            <Download size={16} />
            Скачать
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Download helper
// ─────────────────────────────────────────────────────────────────────────────

function downloadArtifact(artifact: SkillArtifact) {
  let blob: Blob | null = null;
  let filename = artifact.filename || `artifact_${artifact.id}`;

  if (artifact.data.kind === 'base64') {
    const bytes = atob(artifact.data.base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    blob = new Blob([arr], { type: artifact.data.mimeType });
  } else if (artifact.data.kind === 'text') {
    blob = new Blob([artifact.data.content], { type: 'text/plain' });
    if (!artifact.filename) filename += '.txt';
  } else if (artifact.data.kind === 'json') {
    blob = new Blob([JSON.stringify(artifact.data.value, null, 2)], { type: 'application/json' });
    if (!artifact.filename) filename += '.json';
  }

  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
