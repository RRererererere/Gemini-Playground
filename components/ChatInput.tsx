'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Send, Square, Paperclip, X, FileText, Image as ImageIcon,
  Volume2, Braces, Plus, ArrowRight
} from 'lucide-react';
import type { AttachedFile } from '@/types';

interface ChatInputProps {
  onSend: (text: string, files: AttachedFile[]) => void;
  onStop: () => void;
  onAddUserMessage: () => void;
  isStreaming: boolean;
  disabled: boolean;
  canContinue: boolean;
  onContinue: () => void;
  canRun: boolean;
  onRun: () => void;
}

const ACCEPTED_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/ogg': ['.ogg'],
  'audio/mp4': ['.m4a'],
  'audio/webm': ['.weba'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
};

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

function FileChip({ file, onRemove }: { file: AttachedFile; onRemove: () => void }) {
  const isImage = file.mimeType.startsWith('image/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isJson = file.mimeType === 'application/json' || file.name.endsWith('.json');
  const Icon = isImage ? ImageIcon : isAudio ? Volume2 : isJson ? Braces : FileText;
  const color = isImage ? '#4ade80' : isAudio ? '#f59e0b' : isJson ? '#60a5fa' : '#94a3b8';

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

export default function ChatInput({
  onSend, onStop, isStreaming, disabled,
  canContinue, onContinue, canRun, onRun, onAddUserMessage
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const processFile = useCallback(async (file: File): Promise<AttachedFile | null> => {
    const mimeType = file.type || 'text/plain';
    const accepted = Object.keys(ACCEPTED_TYPES);

    if (!accepted.includes(mimeType) && !file.name.endsWith('.txt') && !file.name.endsWith('.json')) {
      return null;
    }

    // Fix MIME type for common cases
    let finalMimeType = mimeType;
    if (file.name.endsWith('.txt')) finalMimeType = 'text/plain';
    if (file.name.endsWith('.json')) finalMimeType = 'application/json';
    if (file.name.endsWith('.m4a')) finalMimeType = 'audio/mp4';

    try {
      const data = await fileToBase64(file);
      const previewUrl = finalMimeType.startsWith('image/') ? URL.createObjectURL(file) : undefined;

      return {
        id: Math.random().toString(36).slice(2),
        name: file.name,
        mimeType: finalMimeType,
        size: file.size,
        data,
        previewUrl,
      };
    } catch {
      return null;
    }
  }, []);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const results = await Promise.all(arr.map(processFile));
    const valid = results.filter(Boolean) as AttachedFile[];
    setFiles(prev => [...prev, ...valid].slice(0, 10)); // max 10 files
  }, [processFile]);

  const handleSend = () => {
    if (isStreaming) return;
    if (!text.trim() && files.length === 0) return;
    if (disabled) return;
    onSend(text.trim(), files);
    setText('');
    setFiles([]);
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
    handleFiles(e.dataTransfer.files);
  };

  const hasContent = text.trim().length > 0 || files.length > 0;

  return (
    <div className="px-4 pb-4 pt-2">
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-[var(--surface-2)] border-2 border-dashed border-[var(--accent)] rounded-2xl p-12 text-center">
            <Paperclip size={32} className="text-[var(--accent)] mx-auto mb-3" />
            <p className="text-lg font-500 text-white">Drop files here</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">Images, audio, text, JSON</p>
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

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
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
              title="Attach file (image, audio, txt, json)"
            >
              <Paperclip size={18} className="sm:w-[15px] sm:h-[15px]" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.weba,.txt,.json"
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
        Shift+Enter — новая строка · Перетащите файлы для прикрепления
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
