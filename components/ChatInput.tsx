'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Send, Square, Paperclip, X, FileText, Image as ImageIcon,
  Volume2, Braces, Plus, ArrowRight, Video
} from 'lucide-react';
import type { AttachedFile, CanvasElement, AnnotationReference } from '@/types';
import { generateImageId } from '@/lib/imageId';

interface ChatInputProps {
  onSend: (text: string, files: AttachedFile[], annotationRefs?: AnnotationReference[]) => void;
  onStop: () => void;
  onAddUserMessage: () => void;
  isStreaming: boolean;
  disabled: boolean;
  canContinue: boolean;
  onContinue: () => void;
  canRun: boolean;
  onRun: () => void;
  pendingCanvasElement?: CanvasElement | null;
  onCanvasElementConsumed?: () => void;
  onAnnotationClick?: (text: string) => void;
}

const ACCEPTED_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg'],
  'audio/mp4': ['.m4a'],
  'audio/webm': ['.weba'],
  'video/mp4': ['.mp4'],
  'video/mpeg': ['.mpeg', '.mpg'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/x-flv': ['.flv'],
  'video/x-matroska': ['.mkv'],
  'video/webm': ['.webm'],
  'video/3gpp': ['.3gp'],
  'video/3gpp2': ['.3g2'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
};

// Максимальный размер файла в байтах (3.5MB для безопасности, учитывая лимит Vercel 4.5MB)
const MAX_FILE_SIZE = 3.5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Сжатие изображения если оно слишком большое
async function compressImage(file: File, maxSizeMB: number = 3.5): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Уменьшаем размер если изображение слишком большое
        const maxDimension = 2048;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Пробуем разные уровни качества
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Compression failed'));
                return;
              }
              
              // Если размер все еще большой и качество можно снизить
              if (blob.size > maxSizeMB * 1024 * 1024 && quality > 0.3) {
                quality -= 0.1;
                tryCompress();
                return;
              }
              
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        
        tryCompress();
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// Сжатие видео (уменьшение разрешения и битрейта)
async function compressVideo(file: File, maxSizeMB: number = 3.5): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.onloadedmetadata = async () => {
      try {
        // Уменьшаем разрешение
        const scale = Math.min(1, Math.sqrt((maxSizeMB * 1024 * 1024) / file.size));
        canvas.width = Math.floor(video.videoWidth * scale);
        canvas.height = Math.floor(video.videoHeight * scale);
        
        // Если файл уже достаточно маленький, возвращаем как есть
        if (file.size <= maxSizeMB * 1024 * 1024) {
          resolve(file);
          return;
        }
        
        // Для больших видео предупреждаем пользователя
        alert(`Видео слишком большое (${(file.size / 1024 / 1024).toFixed(1)}MB). Максимальный размер: ${maxSizeMB}MB. Попробуйте сжать видео перед загрузкой или используйте более короткий клип.`);
        reject(new Error('Video too large'));
      } catch (err) {
        reject(err);
      }
    };
    
    video.onerror = () => reject(new Error('Video load failed'));
    video.src = URL.createObjectURL(file);
  });
}

function FileChip({ file, onRemove }: { file: AttachedFile; onRemove: () => void }) {
  const isImage = file.mimeType.startsWith('image/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isVideo = file.mimeType.startsWith('video/');
  const isPdf = file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isJson = file.mimeType === 'application/json' || file.name.endsWith('.json');
  const Icon = isImage ? ImageIcon : isVideo ? Video : isAudio ? Volume2 : isJson ? Braces : FileText;
  const color = isImage ? '#4ade80' : isVideo ? '#a78bfa' : isAudio ? '#f59e0b' : isPdf ? '#f87171' : isJson ? '#60a5fa' : '#94a3b8';

  if (isPdf && file.previewUrl) {
    return (
      <div className="flex items-stretch gap-2 bg-[var(--surface-3)] border border-[var(--border)] rounded-xl p-2 w-[190px] group">
        <div className="relative w-12 h-14 rounded-lg overflow-hidden border border-[var(--border)] bg-white flex-shrink-0">
          <iframe
            src={`${file.previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            title={file.name}
            className="w-full h-full pointer-events-none"
          />
          <div className="absolute inset-x-0 bottom-0 bg-red-500 text-white text-[9px] font-semibold tracking-[0.2em] text-center py-0.5">
            PDF
          </div>
        </div>

        <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
          <div>
            <p className="text-[12px] text-[var(--text-primary)] font-500 truncate leading-tight">{file.name}</p>
            <p className="text-[10px] text-[var(--text-dim)] mt-1">PDF preview ready</p>
          </div>
          <button
            onClick={onRemove}
            className="self-end text-[var(--text-dim)] hover:text-red-400 transition-colors flex-shrink-0 p-0.5 rounded"
            title="Remove file"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg pl-2 pr-1.5 py-1.5 max-w-[160px] group">
      {isImage && file.previewUrl ? (
        <img src={file.previewUrl} alt={file.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
      ) : (
        <Icon size={13} style={{ color, flexShrink: 0 }} />
      )}
      <span className="text-[12px] text-[var(--text-primary)] truncate font-500">{file.name}</span>
      <button
        onClick={onRemove}
        className="text-[var(--text-dim)] hover:text-red-400 transition-colors flex-shrink-0 p-0.5 rounded"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// Цвета для типов аннотаций
const annotationColors: Record<string, string> = {
  highlight: '#FBBF24',
  pointer: '#60A5FA',
  warning: '#F87171',
  success: '#4ADE80',
  info: '#A78BFA'
};

export default function ChatInput({
  onSend, onStop, isStreaming, disabled,
  canContinue, onContinue, canRun, onRun, onAddUserMessage,
  pendingCanvasElement, onCanvasElementConsumed, onAnnotationClick
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [annotationRefs, setAnnotationRefs] = useState<AnnotationReference[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [canvasPreview, setCanvasPreview] = useState<CanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose addAnnotationRef to parent via callback
  useEffect(() => {
    if (onAnnotationClick) {
      // Store addAnnotationRef in a way parent can access it
      (window as any).__chatInputAddAnnotation = (annotationRef: AnnotationReference) => {
        setAnnotationRefs(prev => [...prev, annotationRef]);
        textareaRef.current?.focus();
      };
    }
    return () => {
      delete (window as any).__chatInputAddAnnotation;
    };
  }, [onAnnotationClick]);

  useEffect(() => {
    if (pendingCanvasElement) {
      setCanvasPreview(pendingCanvasElement);
      onCanvasElementConsumed?.();
      // Фокус на textarea
      textareaRef.current?.focus();
    }
  }, [pendingCanvasElement, onCanvasElementConsumed]);

  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      setIsDragging(true);
    };
    window.addEventListener('dragover', handleWindowDragOver);
    return () => window.removeEventListener('dragover', handleWindowDragOver);
  }, []);

  const processFile = useCallback(async (file: File): Promise<AttachedFile | null> => {
    const lowerName = file.name.toLowerCase();
    const mimeType = file.type || 'text/plain';
    const accepted = Object.keys(ACCEPTED_TYPES);

    if (!accepted.includes(mimeType) && !lowerName.endsWith('.txt') && !lowerName.endsWith('.json') && !lowerName.endsWith('.pdf')) {
      return null;
    }

    // Fix MIME type for common cases
    let finalMimeType = mimeType;
    if (lowerName.endsWith('.txt')) finalMimeType = 'text/plain';
    if (lowerName.endsWith('.json')) finalMimeType = 'application/json';
    if (lowerName.endsWith('.pdf')) finalMimeType = 'application/pdf';
    if (lowerName.endsWith('.m4a')) finalMimeType = 'audio/mp4';
    if (lowerName.endsWith('.mp4') && !mimeType.startsWith('video/')) finalMimeType = 'video/mp4';
    if (lowerName.endsWith('.mov')) finalMimeType = 'video/quicktime';
    if (lowerName.endsWith('.avi')) finalMimeType = 'video/x-msvideo';
    if (lowerName.endsWith('.mkv')) finalMimeType = 'video/x-matroska';
    if (lowerName.endsWith('.webm') && !mimeType.startsWith('video/')) finalMimeType = 'video/webm';
    if (lowerName.endsWith('.3gp')) finalMimeType = 'video/3gpp';
    if (lowerName.endsWith('.3g2')) finalMimeType = 'video/3gpp2';

    try {
      let processedFile = file;
      
      // Проверяем размер файла
      if (file.size > MAX_FILE_SIZE) {
        // Для изображений пробуем сжать
        if (finalMimeType.startsWith('image/')) {
          try {
            processedFile = await compressImage(file);
            console.log(`Изображение сжато: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(processedFile.size / 1024 / 1024).toFixed(2)}MB`);
          } catch (err) {
            alert(`Не удалось сжать изображение. Максимальный размер: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
            return null;
          }
        }
        // Для видео показываем предупреждение
        else if (finalMimeType.startsWith('video/')) {
          try {
            await compressVideo(file);
            return null; // compressVideo выбросит ошибку для больших файлов
          } catch {
            return null;
          }
        }
        // Для остальных файлов просто отклоняем
        else {
          alert(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)}MB). Максимальный размер: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
          return null;
        }
      }
      
      // Финальная проверка размера после сжатия
      if (processedFile.size > MAX_FILE_SIZE) {
        alert(`Файл все еще слишком большой после сжатия. Максимальный размер: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
        return null;
      }

      const data = await fileToBase64(processedFile);
      const previewUrl = finalMimeType.startsWith('image/') || finalMimeType === 'application/pdf'
        ? URL.createObjectURL(processedFile)
        : undefined;

      return {
        id: finalMimeType.startsWith('image/') ? generateImageId() : Math.random().toString(36).slice(2),
        name: file.name,
        mimeType: finalMimeType,
        size: processedFile.size,
        data,
        previewUrl,
      };
    } catch (err) {
      console.error('File processing error:', err);
      return null;
    }
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const results = await Promise.all(arr.map(processFile));
    const valid = results.filter(Boolean) as AttachedFile[];
    setFiles(prev => [...prev, ...valid].slice(0, 10)); // max 10 files
  }, [processFile]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length === 0) return; // обычный текст — не перехватываем
    
    e.preventDefault(); // предотвращаем вставку base64 текста в textarea
    
    const files = imageItems
      .map(item => item.getAsFile())
      .filter(Boolean) as File[];
    
    if (files.length > 0) {
      await handleFiles(files);
    }
  }, [handleFiles]);

  useEffect(() => {
    const handleMobileDrop = (e: any) => {
      const payload = e.detail;
      if (payload && payload.type === 'text') {
        const quoteContent = `[Элемент из Canvas] <${payload.tagName?.toLowerCase()}>:\n"${payload.content}"\n`;
        setText(prev => prev + (prev ? '\n\n' : '') + quoteContent);
      } else if (payload && payload.type === 'image' && payload.dataURL) {
        fetch(payload.dataURL).then(r => r.blob()).then(blob => {
          const file = new File([blob], `canvas-image-${Date.now()}.png`, { type: 'image/png' });
          handleFiles([file]);
        });
        setText(prev => prev + (prev ? '\n\n' : '') + `[Перетащил изображение из Canvas] ${payload.alt ? `(alt: ${payload.alt})` : ''}\n`);
      }
    };
    document.addEventListener('canvas-mobile-drop', handleMobileDrop);
    return () => document.removeEventListener('canvas-mobile-drop', handleMobileDrop);
  }, [handleFiles]);

  const handleSend = () => {
    if (isStreaming) return;
    if (!text.trim() && files.length === 0 && !canvasPreview && annotationRefs.length === 0) return;
    if (disabled) return;

    let finalText = text;
    let additionalFiles = [...files];

    if (canvasPreview) {
      if (canvasPreview.type === 'drag-image' && canvasPreview.dataURL) {
        const base64Data = canvasPreview.dataURL.split(',')[1];
        additionalFiles.push({
          id: generateImageId(),
          type: 'image',
          mimeType: 'image/png',
          data: base64Data,
          size: Math.round((base64Data.length * 3) / 4),
          name: canvasPreview.alt || 'canvas-element.png',
        } as any);
      } else {
        finalText = `[Элемент с сайта: <${canvasPreview.tagName?.toLowerCase()}> "${canvasPreview.innerText?.slice(0, 100)}"]\n\n${text}`;
      }
      setCanvasPreview(null);
    }

    onSend(finalText.trim(), additionalFiles, annotationRefs.length > 0 ? annotationRefs : undefined);
    setText('');
    setFiles([]);
    setAnnotationRefs([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    try {
      const jsonStr = e.dataTransfer.getData('application/json');
      if (jsonStr) {
        const payload = JSON.parse(jsonStr);
        if (payload && payload.source === 'live-canvas-drag') {
          if (payload.type === 'text') {
            const quoteContent = `[Элемент из Canvas] <${payload.tagName.toLowerCase()}>:\n"${payload.content}"\n`;
            setText(prev => prev + (prev ? '\n\n' : '') + quoteContent);
          } else if (payload.type === 'image' && payload.dataURL) {
            fetch(payload.dataURL)
              .then(res => res.blob())
              .then(blob => {
                const file = new File([blob], `canvas-image-${Date.now()}.png`, { type: 'image/png' });
                handleFiles([file]);
              });
            setText(prev => prev + (prev ? '\n\n' : '') + `[Перетащил изображение из Canvas] ${payload.alt ? `(alt: ${payload.alt})` : ''}\n`);
          }
          return;
        }
      }
    } catch (err) {
      // Ignore parsing errors, fallback to files
    }

    handleFiles(e.dataTransfer.files);
  };

  const hasContent = text.trim().length > 0 || files.length > 0 || canvasPreview !== null || annotationRefs.length > 0;

  return (
    <div className="px-4 pb-4 pt-2">
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--surface-2)] border-2 border-dashed border-[var(--accent)] rounded-2xl p-12 text-center">
            <Paperclip size={32} className="text-[var(--accent)] mx-auto mb-3" />
            <p className="text-lg font-500 text-white">Drop files here</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Images, video, PDF, audio, text, JSON</p>
          </div>
        </div>
      )}

      <div
        className={`relative bg-[var(--surface-2)] border rounded-2xl transition-all ${
          isDragging
            ? 'border-[var(--accent)] shadow-glow-md'
            : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus-within:border-[var(--accent)] focus-within:shadow-glow-sm'
        }`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {/* Annotation reference markers */}
        {annotationRefs.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {annotationRefs.map(ref => (
              <div
                key={ref.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all group hover:scale-105"
                style={{
                  backgroundColor: `${ref.color}15`,
                  borderColor: ref.color,
                  boxShadow: `0 0 8px ${ref.color}40`
                }}
              >
                <div
                  className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold"
                  style={{
                    borderColor: ref.color,
                    color: ref.color
                  }}
                >
                  @
                </div>
                <span className="text-xs font-medium" style={{ color: ref.color }}>
                  {ref.annotation.label}
                </span>
                <span className="text-[10px] opacity-60" style={{ color: ref.color }}>
                  · {ref.imageName}
                </span>
                <button
                  onClick={() => setAnnotationRefs(prev => prev.filter(r => r.id !== ref.id))}
                  className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: ref.color }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* File chips */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {files.map(f => (
              <FileChip
                key={f.id}
                file={f}
                onRemove={() => setFiles(prev => prev.filter(x => x.id !== f.id))}
              />
            ))}
          </div>
        )}

        {/* Canvas preview */}
        {canvasPreview && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg mx-3 mt-3 mb-1 text-xs">
            <span className="text-[var(--accent)]">📌 Из Canvas:</span>
            {canvasPreview.type === 'drag-image' && canvasPreview.dataURL ? (
              <img src={canvasPreview.dataURL} className="h-8 w-8 object-cover rounded" alt={canvasPreview.alt} />
            ) : (
              <span className="text-[var(--text-muted)] truncate max-w-[200px]">
                &lt;{canvasPreview.tagName?.toLowerCase()}&gt; {canvasPreview.innerText?.slice(0, 60)}
              </span>
            )}
            <button onClick={() => setCanvasPreview(null)} className="ml-auto text-[var(--text-dim)] hover:text-red-400">✕</button>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={disabled ? 'Добавьте API ключ для начала…' : 'Сообщение Gemini… (Enter — отправить, Shift+Enter — новая строка)'}
          disabled={disabled || isStreaming}
          rows={1}
          className="w-full bg-transparent px-4 py-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none leading-relaxed disabled:opacity-50"
          style={{ minHeight: '52px', maxHeight: '260px', resize: 'none', overflowY: 'auto', fontSize: '16px' }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            {/* Attach file */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isStreaming}
              className="flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Attach file (image, video, PDF, audio, txt, json)"
            >
              <Paperclip size={18} className="sm:w-[15px] sm:h-[15px]" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.mp3,.wav,.ogg,.m4a,.weba,.mp4,.mpeg,.mpg,.mov,.avi,.flv,.mkv,.webm,.3gp,.3g2,.txt,.json"
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />

            {/* Add user message turn */}
            <button
              onClick={onAddUserMessage}
              disabled={disabled || isStreaming}
              className="flex items-center gap-1 px-3 sm:px-2 h-10 sm:h-8 text-sm sm:text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Добавить пустой ответ пользователя"
            >
              <Plus size={16} className="sm:w-[13px] sm:h-[13px]" />
              <span className="hidden sm:block">Ход</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Main Action Button (Smart) */}
            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 px-5 sm:px-4 h-10 sm:h-9 text-base sm:text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-all"
              >
                <Square size={16} fill="currentColor" className="sm:w-[13px] sm:h-[13px]" />
                <span className="hidden sm:block">Остановить</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  if (hasContent) handleSend();
                  else if (canContinue) onContinue();
                  else if (canRun) onRun();
                }}
                disabled={( !hasContent && !canContinue && !canRun ) || disabled}
                className={`flex items-center gap-1.5 px-5 sm:px-4 h-10 sm:h-9 text-base sm:text-sm font-medium rounded-xl transition-all ${
                  (hasContent || canContinue || canRun) && !disabled
                    ? 'bg-white hover:opacity-80 text-black'
                    : 'bg-[var(--surface-3)] text-[var(--text-dim)] cursor-not-allowed opacity-50'
                }`}
              >
                {hasContent ? (
                  <>
                    <Send size={18} className="sm:w-[14px] sm:h-[14px]" />
                    <span className="hidden sm:block">Отправить</span>
                  </>
                ) : canContinue ? (
                  <>
                    <ArrowRight size={18} className="sm:w-[14px] sm:h-[14px]" />
                    <span className="hidden sm:block">Продолжить</span>
                  </>
                ) : canRun ? (
                  <>
                    <RefreshCwIcon />
                    <span className="hidden sm:block">Сгенерировать</span>
                  </>
                ) : (
                  <>
                    <Send size={18} className="sm:w-[14px] sm:h-[14px]" />
                    <span className="hidden sm:block">Отправить</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-[var(--text-dim)] mt-2 input-hint">
        Shift+Enter — новая строка · Перетащите или вставьте (Ctrl+V) изображения
      </p>
    </div>
  );
}

function RefreshCwIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  );
}
