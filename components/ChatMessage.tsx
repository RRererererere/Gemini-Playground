'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import {
  User, Sparkles, Copy, Check, Edit2, Trash2, RefreshCw,
  ChevronDown, ChevronUp, FileText, Image as ImageIcon, Volume2, Braces,
  Brain, ShieldAlert, AlertOctagon, Loader2, AlertCircle, Square, Wrench, Video, MonitorPlay,
  Send, Calculator, ClipboardList, MessageSquare, Globe, GitBranch, Ghost
} from 'lucide-react';
import type { Message, AttachedFile, Part, DeepThinkAnalysis, BridgePayload } from '@/types';
import MemoryPill from './MemoryPill';
import ImageMemoryPill from './ImageMemoryPill';
import ImageMemoryRecallPill from './ImageMemoryRecallPill';
import ImageMemorySearchPill from './ImageMemorySearchPill';
import { SkillArtifactsGroup } from './SkillArtifactRenderer';
import AnnotationRefDisplay from './AnnotationRefDisplay';
import ImageLightbox from './ImageLightbox';
import MessageFeedback from './MessageFeedback';
import { SceneStatePanel } from './SceneStatePanel';

interface ChatMessageProps {
  message: Message;
  index: number;
  isLast: boolean;
  isStreaming: boolean;
  canRegenerate: boolean;
  onEdit: (id: string, newParts: Part[]) => void;
  onDelete: (id: string) => void;
  onRegenerate: () => void;
  onContinue?: (chunk?: import('@/types').InterruptedChunk) => void;
  onBranch?: () => void;
  onSubmitToolResults?: (messageId: string, responses: Array<{ toolCallId: string; rawResponse: string }>) => void;
  onEditPreviousUserMessage?: (modelMessageId: string) => void;
  onClearForceEdit?: (userMessageId: string) => void;
  onEditDeepThinkAnalysis?: (id: string, analysis: DeepThinkAnalysis) => void;
  onPlayHTML?: (html: string) => void;
  onAnnotationClick?: (annotation: import('@/types').AnnotationItem) => void;
  onOpenAgentChat?: (agentId: string) => void;
  onFeedback?: (messageId: string, rating: 'like' | 'dislike', comment?: string) => void;
  onRegenerateWithFeedback?: (messageId: string, comment: string) => void;
  onRegenerateTextOnly?: (messageId: string) => void;
  onDismissBlocked?: (messageId: string) => void;
  onEditDeepThinking?: (messageId: string, newThinking: string) => void;
  onContinueDeepThink?: (messageId: string) => void;
  onSkipDeepThink?: (messageId: string) => void;
  onSceneStateSettingsOpen?: () => void;
  isSceneStatePinned?: boolean;
  onToggleSceneStatePin?: () => void;
  onRequestSceneCategory?: (request: { id: string; content: string }) => void;
  hideActions?: boolean;
}

function FilePreview({ file }: { file: AttachedFile }) {
  const [showModal, setShowModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isImage = file.mimeType.startsWith('image/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isVideo = file.mimeType.startsWith('video/');
  const isPdf = file.mimeType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isJson = file.mimeType === 'application/json' || file.name.endsWith('.json');
  const previewSource = file.previewUrl || (file.data ? `data:${file.mimeType};base64,${file.data}` : '');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (isImage && file.previewUrl) {
    return (
      <>
        <div
          className="relative rounded-lg overflow-hidden border border-[var(--border)] max-w-xs cursor-pointer group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setShowModal(true)}
        >
          <img src={file.previewUrl} alt={file.name} className="max-h-48 w-auto object-cover" />
          
          {/* ID Badge */}
          <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white/70 text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {file.id}
          </div>
          
          <div className={`absolute inset-0 transition-colors flex items-end ${isHovered ? 'bg-black/30' : 'bg-black/0'}`}>
            <div className={`transition-opacity px-2 py-1 bg-black/70 w-full ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              <p className="text-white text-xs truncate">{file.name}</p>
            </div>
          </div>
        </div>
        {showModal && <ImageModal file={file} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  if (isVideo) {
    return <VideoPlayer file={file} />;
  }

  if (isAudio) {
    return <AudioPlayer file={file} />;
  }

  if (isPdf && previewSource) {
    return (
      <>
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-3)] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{file.name}</p>
              <p className="text-[11px] text-[var(--text-dim)]">{formatSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--surface-4)]"
            >
              Preview
            </button>
          </div>

          <div
            className="cursor-pointer bg-white"
            onClick={() => setShowModal(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowModal(true);
              }
            }}
          >
            <iframe
              src={`${previewSource}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title={file.name}
              className="h-[260px] w-full pointer-events-none"
            />
          </div>
        </div>
        {showModal && <PdfModal file={file} src={previewSource} onClose={() => setShowModal(false)} />}
      </>
    );
  }

  const Icon = isJson ? Braces : FileText;
  const color = isJson ? '#60a5fa' : isPdf ? '#f87171' : '#888';

  return (
    <div className="flex items-center gap-2 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-3 py-2 max-w-xs">
      <Icon size={15} style={{ color, flexShrink: 0 }} />
      <div className="min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate font-medium">{file.name}</p>
        <p className="text-[11px] text-[var(--text-dim)]">{formatSize(file.size)}</p>
      </div>
    </div>
  );
}

function PdfModal({ file, src, onClose }: { file: AttachedFile; src: string; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="relative flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface-2)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{file.name}</p>
            <p className="text-[11px] text-white/50">PDF preview</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              Open separately
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        <iframe
          src={src}
          title={file.name}
          className="min-h-0 flex-1 bg-white"
        />
      </div>
    </div>
  );
}

// Image modal with zoom
function ImageModal({ file, onClose }: { file: AttachedFile; onClose: () => void }) {
  const metadata = {
    width: undefined,
    height: undefined,
    type: file.mimeType,
    size: file.size
  };

  return (
    <ImageLightbox
      src={file.previewUrl || ''}
      alt={file.name}
      imageId={file.id}
      fileName={file.name}
      metadata={metadata}
      onClose={onClose}
    />
  );
}

// Audio player with waveform
function AudioPlayer({ file }: { file: AttachedFile }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    // Generate waveform
    generateWaveform(file);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [file]);

  const generateWaveform = async (f: AttachedFile) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(`data:${f.mimeType};base64,${f.data}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const samples = 60;
      const blockSize = Math.floor(rawData.length / samples);
      const bars: number[] = [];
      
      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        bars.push(sum / blockSize);
      }
      
      const max = Math.max(...bars);
      setWaveform(bars.map(b => b / max));
    } catch (err) {
      // Fallback to random waveform
      setWaveform(Array.from({ length: 60 }, () => Math.random() * 0.5 + 0.3));
    }
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audio.currentTime = percent * duration;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-3 py-2.5 min-w-[280px] max-w-sm">
      <audio ref={audioRef} src={file.previewUrl || `data:${file.mimeType};base64,${file.data}`} />
      
      <button
        onClick={togglePlay}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--gem-yellow)] hover:opacity-80 transition-opacity flex items-center justify-center"
      >
        {isPlaying ? (
          <Square size={12} fill="black" stroke="black" />
        ) : (
          <span className="text-black text-sm ml-0.5">▶</span>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-0.5 h-8 cursor-pointer"
          onClick={handleSeek}
        >
          {waveform.map((height, i) => {
            const progress = duration > 0 ? currentTime / duration : 0;
            const isPast = i / waveform.length < progress;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors"
                style={{
                  height: `${height * 100}%`,
                  backgroundColor: isPast ? '#f59e0b' : 'rgba(255,255,255,0.2)',
                  minWidth: '2px',
                }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-[var(--text-dim)] font-mono">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[120px]">
            {file.name}
          </span>
          <span className="text-[10px] text-[var(--text-dim)] font-mono">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Video player
function VideoPlayer({ file }: { file: AttachedFile }) {
  const videoSource = file.previewUrl || `data:${file.mimeType};base64,${file.data}`;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-3)] shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Video size={14} className="text-purple-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{file.name}</p>
            <p className="text-[11px] text-[var(--text-dim)]">{formatSize(file.size)}</p>
          </div>
        </div>
      </div>
      <video
        controls
        className="w-full bg-black"
        style={{ maxHeight: '400px' }}
        preload="metadata"
      >
        <source src={videoSource} type={file.mimeType} />
        Ваш браузер не поддерживает воспроизведение видео.
      </video>
    </div>
  );
}

function CodeBlock({ code, language, onPlayHTML }: { code: string; language?: string; onPlayHTML?: (html: string) => void }) {
  const [copied, setCopied] = useState(false);
  const lang = language || '';
  const isHTML = lang.toLowerCase() === 'html';

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handlePlay = () => {
    if (isHTML && onPlayHTML) {
      onPlayHTML(code);
    }
  };

  return (
    <div className="relative group my-3 rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-3)] border-b border-[var(--border)]">
        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-widest">{lang || 'code'}</span>
        <div className="flex items-center gap-2">
          {isHTML && onPlayHTML && (
            <button
              onClick={handlePlay}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1a1a1a] text-white text-[11px] font-medium hover:bg-[#2a2a2a] transition-colors"
              title="Открыть в Live Preview"
            >
              <MonitorPlay size={12} />
              <span className="hidden sm:inline">Play</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
          >
            {copied ? <Check size={11} className="text-[var(--gem-green)]" /> : <Copy size={11} />}
            <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={lang || undefined}
          style={vscDarkPlus as any}
          showLineNumbers={false}
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            padding: '14px 16px',
            background: '#080808',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: 1.65,
          }}
          codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// Компонент для рендеринга текста с анимацией только новых чанков
function StreamingText({ 
  text, 
  isStreaming, 
  isLast,
  animateKey,
  onPlayHTML,
}: { 
  text: string; 
  isStreaming: boolean;
  isLast: boolean;
  animateKey: number;
  onPlayHTML?: (html: string) => void;
}) {
  const prevTextRef = useRef<string>('');
  const [oldText, setOldText] = useState('');
  const [newText, setNewText] = useState('');

  useEffect(() => {
    if (isStreaming && isLast) {
      const prev = prevTextRef.current;
      if (text.startsWith(prev)) {
        setOldText(prev);
        setNewText(text.slice(prev.length));
      } else {
        setOldText('');
        setNewText(text);
      }
      prevTextRef.current = text;
    } else {
      setOldText(text);
      setNewText('');
      prevTextRef.current = text;
    }
  }, [text, isStreaming, isLast, animateKey]);

  if (!isStreaming || !isLast) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, className, children, ...props }: any) {
            const isInline = !className;
            if (isInline) {
              return <code className={className} {...props}>{children}</code>;
            }
            const lang = typeof className === 'string' ? className.replace('language-', '') : '';
            return (
              <CodeBlock
                language={lang}
                code={String(children).replace(/\n$/, '')}
                onPlayHTML={onPlayHTML}
              />
            );
          },
          pre({ children }: any) {
            return <>{children}</>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    );
  }

  return (
    <>
      {oldText && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code({ node, className, children, ...props }: any) {
              const isInline = !className;
              if (isInline) {
                return <code className={className} {...props}>{children}</code>;
              }
              const lang = typeof className === 'string' ? className.replace('language-', '') : '';
              return (
                <CodeBlock
                  language={lang}
                  code={String(children).replace(/\n$/, '')}
                  onPlayHTML={onPlayHTML}
                />
              );
            },
            pre({ children }: any) {
              return <>{children}</>;
            },
          }}
        >
          {oldText}
        </ReactMarkdown>
      )}
      {newText && (
        <span key={animateKey} className="animate-text-appear inline">
          {newText}
        </span>
      )}
    </>
  );
}

// Блок с размышлениями
function ThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (translatedText) {
      // Если уже переведено, показываем оригинал
      setTranslatedText(null);
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: thinking, to: 'ru' }),
      });

      const data = await response.json();
      if (data.error) {
        console.error('Translation error:', data.error);
      } else {
        setTranslatedText(data.translatedText);
      }
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const displayText = translatedText || thinking;

  return (
    <div className="thinking-block mb-3">
      <button
        className="thinking-header w-full"
        onClick={() => setExpanded(!expanded)}
      >
        <Brain size={12} className="text-[var(--text-dim)] flex-shrink-0" />
        <span className="text-[11px] text-[var(--text-dim)] font-medium flex-1 text-left">
          {isStreaming ? 'Размышление...' : `Размышления модели`}
        </span>
        {!isStreaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTranslate();
            }}
            disabled={isTranslating}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-4)] rounded transition-all mr-1"
            title={translatedText ? 'Показать оригинал' : 'Перевести на русский'}
          >
            {isTranslating ? (
              <Loader2 size={9} className="animate-spin" />
            ) : (
              <>
                <span className="text-[8px]">{translatedText ? '🔄' : '🌐'}</span>
                {translatedText ? 'Ориг' : 'RU'}
              </>
            )}
          </button>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gem-yellow)] animate-pulse-soft flex-shrink-0" />
        )}
        {!isStreaming && (
          expanded
            ? <ChevronUp size={11} className="text-[var(--text-dim)]" />
            : <ChevronDown size={11} className="text-[var(--text-dim)]" />
        )}
      </button>
      {(expanded || isStreaming) && (
        <div className="thinking-content">
          {isTranslating ? (
            // Скелетон во время перевода
            <div className="space-y-2">
              <div className="skeleton-text w-full"></div>
              <div className="skeleton-text w-[95%]"></div>
              <div className="skeleton-text w-[90%]"></div>
              <div className="skeleton-text w-[85%]"></div>
            </div>
          ) : (
            <div className={translatedText ? 'animate-text-appear' : ''}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code({ node, className, children, ...props }: any) {
                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {displayText}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Блок с размышлениями DeepThink (фиолетовый)
function DeepThinkingBlock({ 
  thinking, 
  isStreaming,
  isInterrupted,
  errorMessage,
  onEdit,
  onContinue,
  onSkip,
}: { 
  thinking: string; 
  isStreaming?: boolean;
  isInterrupted?: boolean;
  errorMessage?: string;
  onEdit?: (newThinking: string) => void;
  onContinue?: () => void;
  onSkip?: () => void;
}) {
  const [expanded, setExpanded] = useState(true); // По умолчанию открыт
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(thinking);

  const handleTranslate = async () => {
    if (translatedText) {
      // Если уже переведено, показываем оригинал
      setTranslatedText(null);
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: thinking, to: 'ru' }),
      });

      const data = await response.json();
      if (data.error) {
        console.error('Translation error:', data.error);
      } else {
        setTranslatedText(data.translatedText);
      }
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSave = () => {
    if (onEdit) {
      onEdit(editText);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(thinking);
    setIsEditing(false);
  };

  const displayText = translatedText || thinking;

  return (
    <div className="mb-3 rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-purple-500/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Brain size={13} className="text-purple-400 flex-shrink-0" />
        <span className="text-xs text-purple-400 font-medium flex-1 text-left">
          {isStreaming ? '🧠 DeepThink анализирует контекст...' : '🧠 DeepThink Analysis'}
        </span>
        {!isStreaming && onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setExpanded(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[9px] text-purple-300/70 hover:text-purple-300 hover:bg-purple-500/20 rounded transition-all"
            title="Редактировать размышления"
          >
            <Edit2 size={9} />
            Правка
          </button>
        )}
        {!isStreaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTranslate();
            }}
            disabled={isTranslating}
            className="flex items-center gap-1 px-2 py-1 text-[9px] text-purple-300/70 hover:text-purple-300 hover:bg-purple-500/20 rounded transition-all"
            title={translatedText ? 'Показать оригинал' : 'Перевести на русский'}
          >
            {isTranslating ? (
              <Loader2 size={9} className="animate-spin" />
            ) : (
              <>
                <span className="text-[8px]">{translatedText ? '🔄' : '🌐'}</span>
                {translatedText ? 'Ориг' : 'RU'}
              </>
            )}
          </button>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
        )}
        {!isStreaming && (
          expanded
            ? <ChevronUp size={12} className="text-purple-400/70" />
            : <ChevronDown size={12} className="text-purple-400/70" />
        )}
      </button>
      {(expanded || isStreaming) && (
        <div className="px-4 py-3 border-t border-purple-500/20 bg-purple-500/5">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full text-xs text-purple-200/90 leading-relaxed bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-purple-400/60 placeholder:text-purple-400/40 max-h-[200px] sm:max-h-[400px]"
                style={{ minHeight: '120px', resize: 'vertical' }}
                placeholder="Размышления DeepThink..."
                autoFocus
              />
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[10px] text-purple-400/50 flex-1">
                  После сохранения — нажми «Регенерировать текст»
                </span>
                <button
                  onClick={handleCancel}
                  className="px-2.5 py-1 text-[11px] rounded-lg text-purple-300/60 hover:text-purple-300 hover:bg-purple-500/20 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-purple-500/25 text-purple-300 hover:bg-purple-500/35 border border-purple-500/30 transition-colors"
                >
                  Сохранить
                </button>
              </div>
            </div>
          ) : isTranslating ? (
            // Скелетон во время перевода
            <div className="space-y-2">
              <div className="skeleton-text w-full" style={{ background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(168, 85, 247, 0.1) 100%)', backgroundSize: '200% 100%' }}></div>
              <div className="skeleton-text w-[95%]" style={{ background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(168, 85, 247, 0.1) 100%)', backgroundSize: '200% 100%' }}></div>
              <div className="skeleton-text w-[90%]" style={{ background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(168, 85, 247, 0.1) 100%)', backgroundSize: '200% 100%' }}></div>
              <div className="skeleton-text w-[85%]" style={{ background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.1) 0%, rgba(168, 85, 247, 0.2) 50%, rgba(168, 85, 247, 0.1) 100%)', backgroundSize: '200% 100%' }}></div>
            </div>
          ) : (
            <div className={`text-xs text-purple-300/90 leading-relaxed ${translatedText ? 'animate-text-appear' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code({ node, className, children, ...props }: any) {
                    return <code className={className} {...props}>{children}</code>;
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0">{children}</p>;
                  },
                }}
              >
                {displayText}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
      
      {/* Кнопки при прерывании DeepThink */}
      {isInterrupted && onContinue && onSkip && (
        <div className="px-4 py-3 border-t border-purple-500/20 bg-purple-500/5 flex flex-col gap-2">
          {errorMessage && (
            <p className="text-[11px] text-red-300/80 leading-relaxed">
              ⚠ {errorMessage}
            </p>
          )}
          <p className="text-[11px] text-purple-300/60">
            DeepThink прерван. Продолжить генерацию или оставить только анализ?
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onSkip}
              className="px-3 py-1.5 text-[11px] rounded-lg bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors"
            >
              Оставить анализ
            </button>
            <button
              onClick={onContinue}
              className="px-3 py-1.5 text-[11px] rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={10} />
              Повторить генерацию
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Блок с результатом анализа DeepThink (редактируемый)
function DeepThinkAnalysisBlock({ 
  analysis, 
  onEdit,
  messageId,
}: { 
  analysis: DeepThinkAnalysis; 
  onEdit: (id: string, analysis: DeepThinkAnalysis) => void;
  messageId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnalysis, setEditedAnalysis] = useState(analysis);

  const handleSave = () => {
    onEdit(messageId, editedAnalysis);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedAnalysis(analysis);
    setIsEditing(false);
  };

  return (
    <div className="mb-3 rounded-xl border border-purple-500/40 bg-purple-500/8 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-purple-500/15 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Sparkles size={13} className="text-purple-300 flex-shrink-0" />
        <span className="text-xs text-purple-300 font-semibold flex-1 text-left">
          📊 DeepThink Strategy
        </span>
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
              setExpanded(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] text-purple-300/70 hover:text-purple-300 hover:bg-purple-500/20 rounded transition-all"
          >
            <Edit2 size={10} />
            Редактировать
          </button>
        )}
        {expanded
          ? <ChevronUp size={12} className="text-purple-300/70" />
          : <ChevronDown size={12} className="text-purple-300/70" />
        }
      </button>
      
      {expanded && (
        <div className="px-4 py-3 border-t border-purple-500/30 bg-purple-500/5">
          {isEditing ? (
            <div className="space-y-3">
              {editedAnalysis.characterDetails && editedAnalysis.characterDetails !== 'обычный ассистент' && (
                <div>
                  <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                    Персонаж
                  </label>
                  <textarea
                    value={editedAnalysis.characterDetails}
                    onChange={(e) => setEditedAnalysis({ ...editedAnalysis, characterDetails: e.target.value })}
                    className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 resize-none"
                    rows={3}
                  />
                </div>
              )}
              
              <div>
                <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                  Стиль пользователя
                </label>
                <input
                  type="text"
                  value={editedAnalysis.userStyle}
                  onChange={(e) => setEditedAnalysis({ ...editedAnalysis, userStyle: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                  Настроение
                </label>
                <input
                  type="text"
                  value={editedAnalysis.mood}
                  onChange={(e) => setEditedAnalysis({ ...editedAnalysis, mood: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400"
                />
              </div>
              
              <div>
                <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                  Реальное намерение
                </label>
                <textarea
                  value={editedAnalysis.realIntent}
                  onChange={(e) => setEditedAnalysis({ ...editedAnalysis, realIntent: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                  ЧТО СКАЗАТЬ СЕЙЧАС
                </label>
                <textarea
                  value={editedAnalysis.revealNow || ''}
                  onChange={(e) => setEditedAnalysis({ ...editedAnalysis, revealNow: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                  ПРИБЕРЕЧЬ НА ПОТОМ
                </label>
                <textarea
                  value={editedAnalysis.revealLater || ''}
                  onChange={(e) => setEditedAnalysis({ ...editedAnalysis, revealLater: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 resize-none"
                  rows={2}
                />
              </div>
              
              <div>
                <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                  Стратегия ответа
                </label>
                <textarea
                  value={editedAnalysis.answerStrategy}
                  onChange={(e) => setEditedAnalysis({ ...editedAnalysis, answerStrategy: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 resize-none"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                  Тон и стиль
                </label>
                <textarea
                  value={editedAnalysis.toneAdvice}
                  onChange={(e) => setEditedAnalysis({ ...editedAnalysis, toneAdvice: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-[10px] text-purple-300/70 font-medium uppercase tracking-wider mb-1 block">
                  План на будущее
                </label>
                <textarea
                  value={editedAnalysis.futureStrategy || ''}
                  onChange={(e) => setEditedAnalysis({ ...editedAnalysis, futureStrategy: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-1.5 text-xs text-purple-200 focus:outline-none focus:border-purple-400 resize-none"
                  rows={2}
                />
              </div>
              
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 bg-purple-500 text-white text-xs font-medium rounded-lg transition-opacity hover:opacity-80"
                >
                  Применить и перегенерировать
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 bg-purple-500/20 text-purple-300 hover:text-purple-200 text-xs rounded-lg border border-purple-500/30 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-purple-200/90">
              {analysis.characterDetails && analysis.characterDetails !== 'обычный ассистент' && (
                <div>
                  <span className="text-purple-300/70 font-medium">Персонаж:</span>{' '}
                  <span className="text-purple-200">{analysis.characterDetails}</span>
                </div>
              )}
              <div>
                <span className="text-purple-300/70 font-medium">Стиль:</span>{' '}
                <span className="text-purple-200">{analysis.userStyle}</span>
              </div>
              <div>
                <span className="text-purple-300/70 font-medium">Настроение:</span>{' '}
                <span className="text-purple-200">{analysis.mood}</span>
              </div>
              <div>
                <span className="text-purple-300/70 font-medium">Намерение:</span>{' '}
                <span className="text-purple-200">{analysis.realIntent}</span>
              </div>
              {analysis.revealNow && (
                <div className="border-t border-purple-500/20 pt-2 mt-2">
                  <span className="text-purple-300/70 font-medium">Сказать СЕЙЧАС:</span>{' '}
                  <span className="text-purple-200">{analysis.revealNow}</span>
                </div>
              )}
              {analysis.revealLater && (
                <div>
                  <span className="text-purple-300/70 font-medium">Приберечь НА ПОТОМ:</span>{' '}
                  <span className="text-purple-200/70 italic">{analysis.revealLater}</span>
                </div>
              )}
              <div className="border-t border-purple-500/20 pt-2 mt-2">
                <span className="text-purple-300/70 font-medium">Стратегия:</span>{' '}
                <span className="text-purple-200">{analysis.answerStrategy}</span>
              </div>
              <div>
                <span className="text-purple-300/70 font-medium">Тон:</span>{' '}
                <span className="text-purple-200">{analysis.toneAdvice}</span>
              </div>
              {analysis.futureStrategy && (
                <div className="border-t border-purple-500/20 pt-2 mt-2">
                  <span className="text-purple-300/70 font-medium">План на будущее:</span>{' '}
                  <span className="text-purple-200/80">{analysis.futureStrategy}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Компактный индикатор заблокированного контента
// Блок с ошибкой DeepThink
function DeepThinkErrorBlock({ error }: { error: string }) {
  return (
    <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-2.5 flex items-center gap-2 animate-fade-in shadow-sm">
      <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-red-400/70 font-medium uppercase tracking-wider mb-0.5">Ошибка анализа</p>
        <p className="text-xs text-red-300/90 leading-relaxed truncate" title={error}>{error}</p>
      </div>
    </div>
  );
}

// Gemini errors are displayed as a top notice (playground UX),
// not as a large block inside each message bubble.

// Inline error indicator shown in message header
function MessageErrorIndicator({ errorType, errorRetryAfterMs, errorMessage, errorCode, errorStatus }: {
  errorType?: Message['errorType'];
  errorRetryAfterMs?: number;
  errorMessage?: string;
  errorCode?: number;
  errorStatus?: string;
}) {
  const [remaining, setRemaining] = useState<number>(0);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!errorRetryAfterMs) return;
    const tick = () => {
      const r = Math.max(0, Math.ceil((errorRetryAfterMs - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [errorRetryAfterMs]);

  useEffect(() => {
    if (!expanded) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      setExpanded(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [expanded]);

  const isQuota = errorType === 'quota';
  const isRateLimit = errorType === 'rate_limit';

  let label = 'Ошибка';
  if (isQuota) label = 'Квота исчерпана';
  else if (isRateLimit) label = 'Лимит запросов';
  else if (errorType === 'invalid_key') label = 'Неверный API ключ';
  else if (errorType === 'permission') label = 'Нет доступа';
  else if (errorType === 'bad_request') label = 'Неверный запрос';
  else if (errorType === 'timeout') label = 'Таймаут';
  else if (errorType === 'internal') label = 'Ошибка сервера';
  else if (errorType === 'network') label = 'Ошибка сети';

  const isWarn = isQuota || isRateLimit;
  const badgeStyle = isWarn
    ? { color: '#f59e0b', background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }
    : { color: '#f87171', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' };
  const expandedStyle = isWarn
    ? { borderColor: 'rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.06)' }
    : { borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)' };

  return (
    <span ref={rootRef} className="relative inline-flex flex-col">
      <button
        onClick={() => setExpanded(v => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 border rounded text-[10px] font-medium cursor-pointer"
        style={badgeStyle}
        title="Нажми для деталей"
      >
        <AlertCircle size={10} className="flex-shrink-0" />
        {label}
        {remaining > 0 && <span className="font-mono ml-0.5">{remaining}s</span>}
      </button>

      {expanded && (
        <span
          className="absolute top-full left-0 mt-1 z-50 flex flex-col gap-1 p-3 rounded-xl border text-[11px] min-w-[260px] max-w-[420px] shadow-lg animate-fade-in"
          style={expandedStyle}
        >
          <span className="flex items-center gap-1.5 font-semibold" style={{ color: isWarn ? '#f59e0b' : '#f87171' }}>
            <AlertCircle size={11} />
            {label}
            {errorType && <span className="font-mono opacity-60 font-normal">({errorType})</span>}
          </span>
          {(errorCode || errorStatus) && (
            <span className="font-mono text-[10px] opacity-60">
              {errorCode && `code ${errorCode}`}{errorCode && errorStatus && ' · '}{errorStatus}
            </span>
          )}
          {errorMessage && (
            <span className="text-[var(--text-primary)] opacity-80 leading-relaxed break-words whitespace-pre-wrap">
              {errorMessage}
            </span>
          )}
          {remaining > 0 && (
            <span className="opacity-60 mt-0.5">
              Повторить через <span className="font-mono" style={{ color: isWarn ? '#f59e0b' : '#f87171' }}>{remaining}s</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function BlockedIndicator({ reason }: { reason?: string }) {
  const reasonLabels: Record<string, string> = {
    SAFETY: 'Фильтр безопасности',
    RECITATION: 'Авторские права',
    BLOCKLIST: 'Заблокировано',
    PROHIBITED_CONTENT: 'Запрещённый контент',
    OTHER: 'Заблокировано',
  };

  const label = (reason && reasonLabels[reason]) || 'Заблокировано';

  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400 font-medium"
      title={`Контент заблокирован: ${label}`}
    >
      <AlertOctagon size={10} className="flex-shrink-0" />
      {label}
    </span>
  );
}

// Блок с действиями когда контент заблокирован после DeepThink
function BlockedWithDeepThinkActions({
  reason,
  messageId,
  isLast,
  onDismiss,
  onRetry,
}: {
  reason?: string;
  messageId: string;
  isLast: boolean;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const reasonLabels: Record<string, string> = {
    SAFETY: 'SAFETY',
    RECITATION: 'RECITATION',
    BLOCKLIST: 'BLOCKLIST',
    PROHIBITED_CONTENT: 'PROHIBITED_CONTENT',
    OTHER: 'OTHER',
  };

  const reasonCode = (reason && reasonLabels[reason]) || 'BLOCKED';

  return (
    <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertOctagon size={13} className="text-red-400 flex-shrink-0" />
        <span className="text-[11px] text-red-400 font-medium">
          Контент заблокирован
        </span>
        <span className="text-[10px] text-red-400/60 font-mono ml-1">
          [{reasonCode}]
        </span>
      </div>
      
      <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
        DeepThink-анализ сохранён. Попробовать снова с другим подходом или оставить анализ без ответа?
      </p>
      
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onDismiss}
          className="px-3 py-1.5 text-[11px] rounded-lg bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors"
        >
          Оставить анализ
        </button>
        {isLast && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-[11px] rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={10} />
            Попробовать снова
          </button>
        )}
      </div>
    </div>
  );
}

function ToolCallsBlock({
  toolCalls,
  messageId,
  onSubmitToolResults,
}: {
  toolCalls: import('@/types').ToolCall[];
  messageId: string;
  onSubmitToolResults?: (messageId: string, responses: Array<{ toolCallId: string; rawResponse: string }>) => void;
}) {
  // Фильтруем memory tool calls - они не показываются в UI
  const visibleToolCalls = toolCalls.filter(call => !(call as any).isMemoryTool);
  
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // По умолчанию все развернуты если pending
    const initial: Record<string, boolean> = {};
    visibleToolCalls.forEach(call => {
      initial[call.id] = call.status === 'pending';
    });
    return initial;
  });

  const allSubmitted = visibleToolCalls.every(call => call.status === 'submitted');
  const canSubmit = visibleToolCalls.every(call => responses[call.id]?.trim());

  const handleSubmit = () => {
    if (!onSubmitToolResults || !canSubmit) return;
    const results = visibleToolCalls.map(call => ({
      toolCallId: call.id,
      rawResponse: responses[call.id] || '',
    }));
    onSubmitToolResults(messageId, results);
  };

  // Если все tool calls скрыты, не рендерим блок
  if (visibleToolCalls.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3">
      {visibleToolCalls.map(call => {
        const isExpanded = expanded[call.id] ?? false;
        const argsStr = JSON.stringify(call.args, null, 2);
        const resultStr = call.result ? JSON.stringify(call.result, null, 2) : '';
        const isPending = call.status === 'pending';

        return (
          <div
            key={call.id}
            className={`rounded-2xl border overflow-hidden transition-all ${
              isPending 
                ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-orange-500/5 shadow-lg shadow-amber-500/10' 
                : 'border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5'
            }`}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/20">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  isPending ? 'bg-amber-500/20' : 'bg-green-500/20'
                }`}>
                  <Wrench size={16} className={isPending ? 'text-amber-400' : 'text-green-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{call.name}</p>
                  <p className="text-xs flex items-center gap-1.5 mt-0.5">
                    {isPending ? (
                      <>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-amber-400 font-medium">Ожидает ответа</span>
                      </>
                    ) : (
                      <>
                        <Check size={11} className="text-green-400" />
                        <span className="text-green-400 font-medium">Результат получен</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [call.id]: !prev[call.id] }))}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  isPending 
                    ? 'text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-400' 
                    : 'text-green-400/70 hover:bg-green-500/10 hover:text-green-400'
                }`}
              >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {isExpanded && (
              <div className="px-4 py-4 space-y-3 border-t border-white/5">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] flex items-center gap-1.5">
                    <Braces size={11} />
                    Аргументы
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-black/40 border border-white/5 p-3 text-xs text-[var(--text-muted)] font-mono leading-relaxed">
                    {argsStr}
                  </pre>
                </div>

                {call.status === 'submitted' && resultStr ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-400/80 flex items-center gap-1.5">
                      <Check size={11} />
                      Результат
                    </p>
                    <pre className="overflow-x-auto rounded-xl bg-black/40 border border-green-500/20 p-3 text-xs text-green-300/80 font-mono leading-relaxed">
                      {resultStr}
                    </pre>
                  </div>
                ) : isPending ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400/80 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Ваш ответ
                    </p>
                    <textarea
                      value={responses[call.id] || ''}
                      onChange={e => setResponses(prev => ({ ...prev, [call.id]: e.target.value }))}
                      placeholder="Введите результат выполнения функции (JSON или текст)..."
                      rows={5}
                      className="w-full rounded-xl border border-amber-500/30 bg-black/40 px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono leading-relaxed resize-none"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}

      {!allSubmitted && onSubmitToolResults && (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:shadow-xl hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <Check size={16} />
          Отправить результаты
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Tool Call Pill - сворачиваемая плашка для вызовов skill tools
// ─────────────────────────────────────────────────────────────────────────────

function SkillToolCallPill({
  name,
  args,
  result,
}: {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const resultStr = typeof result === 'string' 
    ? result 
    : JSON.stringify(result, null, 2);
  
  const hasArgs = Object.keys(args).length > 0;
  
  // Короткий превью результата (первые 50 символов)
  const resultPreview = resultStr.length > 50 
    ? resultStr.slice(0, 50) + '...' 
    : resultStr;

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]"
      >
        <Wrench size={12} className="flex-shrink-0 text-[var(--text-muted)]" />
        <span className="flex-1 truncate font-mono text-xs text-[var(--text-primary)]">
          {name}
        </span>
        {!expanded && (
          <span className="truncate text-xs text-[var(--text-dim)]">
            → {resultPreview}
          </span>
        )}
        <ChevronDown 
          size={14} 
          className={`flex-shrink-0 text-[var(--text-dim)] transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      
      {expanded && (
        <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-3 text-xs">
          {hasArgs && (
            <div className="mb-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                Аргументы
              </p>
              <div className="space-y-1">
                {Object.entries(args).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-mono text-[var(--text-muted)]">{key}:</span>
                    <span className="font-mono text-[var(--text-primary)]">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
              Результат
            </p>
            <pre className="overflow-x-auto rounded-lg bg-[var(--surface-2)] p-2 font-mono text-xs leading-relaxed text-[var(--text-primary)]">
              {resultStr}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function BridgeDataBlock({ bridgeData }: { bridgeData: BridgePayload }) {
  const [expanded, setExpanded] = useState(true);
  
  // Определяем иконку и цвет в зависимости от типа события
  const getEventStyle = (eventType: string) => {
    const type = eventType.toLowerCase();
    if (type.includes('form') || type.includes('submit')) {
      return { icon: Send, color: 'blue', label: 'Отправка формы' };
    }
    if (type.includes('calculate') || type.includes('calc')) {
      return { icon: Calculator, color: 'green', label: 'Расчет' };
    }
    if (type.includes('survey') || type.includes('poll')) {
      return { icon: ClipboardList, color: 'purple', label: 'Опрос' };
    }
    if (type.includes('feedback')) {
      return { icon: MessageSquare, color: 'orange', label: 'Обратная связь' };
    }
    return { icon: Globe, color: 'cyan', label: 'Данные с сайта' };
  };
  
  const style = getEventStyle(bridgeData.eventType);
  const Icon = style.icon;
  
  // Цветовые классы для разных типов
  const colorClasses = {
    blue: {
      border: 'border-blue-500/30',
      bg: 'from-blue-500/5 to-blue-600/5',
      iconBg: 'bg-blue-500/20',
      iconText: 'text-blue-400',
      labelText: 'text-blue-400',
      headerText: 'text-blue-400/80',
      codeBorder: 'border-blue-500/20',
      codeText: 'text-blue-300/80',
    },
    green: {
      border: 'border-green-500/30',
      bg: 'from-green-500/5 to-green-600/5',
      iconBg: 'bg-green-500/20',
      iconText: 'text-green-400',
      labelText: 'text-green-400',
      headerText: 'text-green-400/80',
      codeBorder: 'border-green-500/20',
      codeText: 'text-green-300/80',
    },
    purple: {
      border: 'border-purple-500/30',
      bg: 'from-purple-500/5 to-purple-600/5',
      iconBg: 'bg-purple-500/20',
      iconText: 'text-purple-400',
      labelText: 'text-purple-400',
      headerText: 'text-purple-400/80',
      codeBorder: 'border-purple-500/20',
      codeText: 'text-purple-300/80',
    },
    orange: {
      border: 'border-orange-500/30',
      bg: 'from-orange-500/5 to-orange-600/5',
      iconBg: 'bg-orange-500/20',
      iconText: 'text-orange-400',
      labelText: 'text-orange-400',
      headerText: 'text-orange-400/80',
      codeBorder: 'border-orange-500/20',
      codeText: 'text-orange-300/80',
    },
    cyan: {
      border: 'border-cyan-500/30',
      bg: 'from-cyan-500/5 to-cyan-600/5',
      iconBg: 'bg-cyan-500/20',
      iconText: 'text-cyan-400',
      labelText: 'text-cyan-400',
      headerText: 'text-cyan-400/80',
      codeBorder: 'border-cyan-500/20',
      codeText: 'text-cyan-300/80',
    },
  };
  
  const colors = colorClasses[style.color as keyof typeof colorClasses];
  
  return (
    <div className={`mb-3 rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-black/20 hover:bg-black/30 transition-colors"
      >
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.iconBg}`}>
          <Icon size={16} className={colors.iconText} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{style.label}</p>
          <p className={`text-xs ${colors.labelText} font-medium`}>{bridgeData.eventType}</p>
        </div>
        <ChevronDown
          size={16}
          className={`text-[var(--text-dim)] transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-4 py-4 border-t border-white/5">
          <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${colors.headerText} flex items-center gap-1.5`}>
            <Braces size={11} />
            Данные
          </p>
          <div className={`overflow-x-auto rounded-xl bg-black/40 border ${colors.codeBorder} p-3`}>
            <pre className={`text-xs ${colors.codeText} font-mono leading-relaxed max-h-96 overflow-y-auto`}>
              {JSON.stringify(bridgeData.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatMessage({
  message, index, isLast, isStreaming,
  canRegenerate, onEdit, onDelete, onRegenerate, onContinue, onSubmitToolResults, onEditDeepThinkAnalysis, onEditPreviousUserMessage, onClearForceEdit, onPlayHTML, onAnnotationClick, onBranch, onOpenAgentChat, onFeedback, onRegenerateWithFeedback, onRegenerateTextOnly, onDismissBlocked, onEditDeepThinking, onContinueDeepThink, onSkipDeepThink,
  onSceneStateSettingsOpen, isSceneStatePinned, onToggleSceneStatePin, onRequestSceneCategory, hideActions = false
}: ChatMessageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const prevTextRef = useRef<string>('');
  const [animateKey, setAnimateKey] = useState(0);

  const isUser = message.role === 'user';
  const textPart = message.parts.find(p => 'text' in p) as { text: string } | undefined;
  const messageText = textPart?.text || '';
  const isLong = messageText.length > 3000;
  const isBlocked = message.isBlocked;
  const thinking = message.thinking;
  const deepThinking = message.deepThinking;
  const deepThinkAnalysis = message.deepThinkAnalysis;
  const deepThinkError = message.deepThinkError;
  const geminiError = message.error;
  const geminiErrorType = message.errorType;
  const geminiErrorCode = message.errorCode;
  const geminiErrorStatus = message.errorStatus;
  const modelName = message.modelName;
  const apiKeySuffix = message.apiKeySuffix;

  // Форматируем название модели для отображения
  const displayModelName = modelName 
    ? modelName.replace('models/', '').replace('gemini-', '')
    : 'Gemini';

  // Отслеживаем изменения текста для анимации только новых чанков
  useEffect(() => {
    if (isStreaming && isLast && messageText !== prevTextRef.current) {
      prevTextRef.current = messageText;
      setAnimateKey(prev => prev + 1);
    }
  }, [messageText, isStreaming, isLast]);

  // Авто-открытие редактора для пустых сообщений (но не для tool responses)
  useEffect(() => {
    if (messageText === '' && isUser && !isEditing && !message.toolResponses?.length) {
      setEditText('');
      setIsEditing(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force-open editor (used by "Edit prompt" from error blocks)
  useEffect(() => {
    if (isUser && message.forceEdit) {
      setEditText(messageText);
      setIsEditing(true);
      // Clear the flag so it doesn't re-trigger (without triggering regeneration).
      onClearForceEdit?.(message.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.forceEdit]);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length);
    }
  }, [isEditing]);

  const startEdit = () => {
    setEditText(messageText);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!editText.trim() && !message.files?.length) {
      onDelete(message.id);
      return;
    }
    const newParts: Part[] = message.parts
      .filter(p => !('text' in p))
      .concat(editText ? [{ text: editText }] : []);
    if (newParts.length === 0) {
      onEdit(message.id, [{ text: editText }]);
    } else {
      onEdit(message.id, newParts);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    if (messageText === '' && isUser) {
      onDelete(message.id);
      return;
    }
    setIsEditing(false);
    setEditText('');
  };

  const copyText = () => {
    navigator.clipboard.writeText(messageText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const displayedText = !expanded && isLong ? messageText.slice(0, 2000) + '…' : messageText;

  // Найти предыдущее пользовательское сообщение для функции "Edit запрос"
  const handleEditPreviousMessage = () => {
    // Это вызов edit для того же blocked message — он пустой,
    // но это сигнал что нужно редактировать блок
    onEdit(message.id, [{ text: '' }]);
  };

  return (
    <div className={`group relative animate-fade-in ${isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 mb-1.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-[var(--surface-4)] border border-[var(--border-strong)]'
            : 'bg-[var(--surface-3)] border border-[var(--border-strong)]'
        }`}>
          {isUser
            ? <User size={10} className="text-[var(--text-muted)]" />
            : <Sparkles size={10} className="text-[var(--text-muted)]" />
          }
        </div>
        <span className="text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-widest">
          {isUser ? 'Вы' : displayModelName}
        </span>
        {!isUser && apiKeySuffix && (
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            ••••{apiKeySuffix}
          </span>
        )}
        {isBlocked && !isUser && (
          deepThinking
            ? <BlockedWithDeepThinkActions
                reason={message.blockReason || message.finishReason}
                messageId={message.id}
                isLast={isLast}
                onDismiss={() => onDismissBlocked?.(message.id)}
                onRetry={() => onRegenerateTextOnly?.(message.id)}
              />
            : <BlockedIndicator reason={message.blockReason || message.finishReason} />
        )}
        {geminiError && !isUser && (
          <MessageErrorIndicator
            errorType={geminiErrorType}
            errorRetryAfterMs={message.errorRetryAfterMs}
            errorMessage={geminiError}
            errorCode={geminiErrorCode}
            errorStatus={geminiErrorStatus}
          />
        )}
        {isStreaming && isLast && !isUser && (
          <span className="text-[10px] text-[var(--gem-green)] flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-[var(--gem-green)] animate-pulse" />
            Генерация
          </span>
        )}
      </div>

      {/* Message Bubble */}
      <div className={`relative w-full chat-bubble ${isUser ? 'max-w-[90%] md:max-w-[75%] self-end' : 'max-w-[90%] self-start'}`}>

        {/* Файлы */}
        {message.files && message.files.length > 0 && (
          <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.files.map(f => <FilePreview key={f.id} file={f} />)}
          </div>
        )}

        {/* Ghost Nudge Protocol: индикатор перегенерации */}
        {message.ghostRetrying && (
          <div className="flex items-center gap-2 py-2 px-3 mb-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400/80 animate-in fade-in duration-300">
            <RefreshCw size={14} className="animate-spin shrink-0" />
            <span>
              Gemini вернул пустой ответ · Перегенерация
              <span className="text-amber-400/50 ml-1">
                ({message.ghostRetryAttempt}/{message.ghostRetryMax})
              </span>
            </span>
          </div>
        )}

        {/* Ghost Nudge Protocol: все попытки исчерпаны */}
        {message.ghostRetryFailed && !message.ghostRetrying && (
          <div className="flex flex-col gap-2 py-2 px-3 mb-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-sm text-red-400/70">
              <Ghost size={14} className="shrink-0" />
              <span>
                Gemini не смог ответить после {message.ghostRetryMax} попыток
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onRegenerate()}
                className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-red-300/80"
              >
                ↺ Попробовать ещё раз
              </button>
              <button
                onClick={() => onDelete(message.id)}
                className="text-xs px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-red-400/70"
              >
                ✕ Убрать
              </button>
            </div>
          </div>
        )}

        {/* Annotation References */}
        {message.annotationRefs && message.annotationRefs.length > 0 && (
          <div className={`mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <AnnotationRefDisplay annotationRefs={message.annotationRefs} />
          </div>
        )}

        {/* Skill Artifacts */}
        {message.skillArtifacts && message.skillArtifacts.length > 0 && (
          <div className={`mb-2 ${isUser ? 'text-right' : 'text-left'}`}>
            <SkillArtifactsGroup artifacts={message.skillArtifacts} onAnnotationClick={onAnnotationClick} onOpenAgentChat={onOpenAgentChat} />
          </div>
        )}

        {/* Editing */}
        {isEditing ? (
          <div className="w-full">
            <textarea
              ref={editRef}
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              className="w-full bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none resize-none leading-relaxed"
              style={{ minHeight: '80px', maxHeight: '400px', resize: 'vertical' }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={saveEdit}
                className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-lg transition-opacity hover:opacity-80"
              >
                Сохранить · ⌘↵
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs rounded-lg border border-[var(--border)] transition-colors"
              >
                Отмена · Esc
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-xl text-sm leading-relaxed ${
              isUser
                ? 'bg-[var(--surface-2)] border border-[var(--border-subtle)] px-4 py-3 text-[var(--text-primary)]'
                : 'text-[var(--text-primary)]'
            }`}
            style={!isUser ? { padding: 0 } : undefined}
          >
            {/* DeepThink block (фиолетовый) */}
            {!isUser && deepThinking && (
              <DeepThinkingBlock
                thinking={deepThinking}
                isStreaming={isStreaming && isLast && !deepThinkAnalysis && !thinking && !messageText}
                isInterrupted={message.deepThinkInterrupted}
                errorMessage={message.deepThinkError}
                onEdit={onEditDeepThinking ? (newText) => onEditDeepThinking(message.id, newText) : undefined}
                onContinue={onContinueDeepThink ? () => onContinueDeepThink(message.id) : undefined}
                onSkip={onSkipDeepThink ? () => onSkipDeepThink(message.id) : undefined}
              />
            )}

            {/* DeepThink Analysis block (редактируемый) */}
            {!isUser && deepThinkAnalysis && onEditDeepThinkAnalysis && (
              <DeepThinkAnalysisBlock
                analysis={deepThinkAnalysis}
                onEdit={onEditDeepThinkAnalysis}
                messageId={message.id}
              />
            )}

            {/* Scene State Panel */}
            {!isUser && message.sceneState && (
              <SceneStatePanel 
                sceneState={message.sceneState}
                onSettingsOpen={onSceneStateSettingsOpen || (() => {})}
                onTogglePin={onToggleSceneStatePin || (() => {})}
                isPinned={isSceneStatePinned || false}
                onRequestCategory={onRequestSceneCategory}
              />
            )}

            {/* DeepThink Error block - только если не interrupted (в interrupted случае UI уже в DeepThinkingBlock) */}
            {!isUser && deepThinkError && !message.deepThinkInterrupted && (
              <DeepThinkErrorBlock error={deepThinkError} />
            )}

            {/* Gemini errors are shown via a top banner; keep bubble clean */}

            {/* Thinking block (обычный) */}
            {!isUser && thinking && (
              <ThinkingBlock
                thinking={thinking}
                isStreaming={isStreaming && isLast && !messageText}
              />
            )}

            {/* Tool Calls */}
            {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
              <ToolCallsBlock
                toolCalls={message.toolCalls}
                messageId={message.id}
                onSubmitToolResults={onSubmitToolResults}
              />
            )}

            {/* Memory Operations */}
            {!isUser && message.memoryOperations && message.memoryOperations.length > 0 && (
              <>
                {message.memoryOperations.map((op, idx) => {
                  if (op.type === 'save_image') {
                    return (
                      <ImageMemoryPill
                        key={`${message.id}-mem-${idx}`}
                        scope={op.scope || 'local'}
                        description={op.description || ''}
                        tags={op.tags || []}
                        entities={op.entities || []}
                        thumbnailBase64={op.thumbnailBase64}
                      />
                    );
                  }
                  if (op.type === 'search_image' && op.results) {
                    return (
                      <ImageMemorySearchPill
                        key={`${message.id}-mem-${idx}`}
                        memories={op.results}
                        entities={op.results.flatMap(r => r.tags)}
                        confidence={0.8}
                      />
                    );
                  }
                  if (op.type === 'recall_image') {
                    return (
                      <ImageMemoryRecallPill
                        key={`${message.id}-mem-${idx}`}
                        memoryId={op.memoryId || ''}
                        description={op.description}
                        thumbnailBase64={op.thumbnailBase64}
                      />
                    );
                  }
                  return (
                    <MemoryPill
                      key={`${message.id}-mem-${idx}`}
                      operation={op.type}
                      scope={op.scope || 'local'}
                      fact={op.fact}
                      oldFact={op.oldFact}
                      category={op.category}
                      confidence={op.confidence}
                      reason={op.reason}
                    />
                  );
                })}
              </>
            )}

            {/* Skill Tool Calls */}
            {!isUser && message.skillToolCalls && message.skillToolCalls.length > 0 && (
              <>
                {message.skillToolCalls.map((call, idx) => (
                  <SkillToolCallPill
                    key={`${message.id}-skill-${idx}`}
                    name={call.name}
                    args={call.args}
                    result={call.result}
                  />
                ))}
              </>
            )}

            {/* Bridge Data (данные от сайта) */}
            {isUser && message.bridgeData && (
              <BridgeDataBlock bridgeData={message.bridgeData} />
            )}

            {/* Tool Responses (в user сообщениях) */}
            {isUser && message.toolResponses && message.toolResponses.length > 0 && (
              <div className="mb-4 space-y-3">
                {message.toolResponses.map(response => {
                  const resultStr = typeof response.response === 'string' 
                    ? response.response 
                    : JSON.stringify(response.response, null, 2);
                  
                  return (
                    <div
                      key={response.id}
                      className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/5 to-emerald-500/5 overflow-hidden"
                    >
                      <div className="flex items-center gap-3 px-4 py-3 bg-black/20">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-500/20">
                          <Check size={16} className="text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{response.name}</p>
                          <p className="text-xs text-green-400 font-medium flex items-center gap-1.5 mt-0.5">
                            <Check size={11} />
                            Результат отправлен модели
                          </p>
                        </div>
                      </div>
                      <div className="px-4 py-4 border-t border-white/5">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-400/80 flex items-center gap-1.5">
                          <Braces size={11} />
                          Результат
                        </p>
                        <pre className="overflow-x-auto rounded-xl bg-black/40 border border-green-500/20 p-3 text-xs text-green-300/80 font-mono leading-relaxed max-h-48">
                          {resultStr}
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Обычный контент */}
            <>
              {!isUser ? (
                <div className={`prose-gem ${isStreaming && isLast ? 'streaming-cursor' : ''} ${isBlocked ? 'text-red-400/60' : ''}`}>
                  {displayedText ? (
                    <StreamingText
                      text={displayedText}
                      isStreaming={isStreaming}
                      isLast={isLast}
                      animateKey={animateKey}
                      onPlayHTML={onPlayHTML}
                    />
                    ) : isStreaming && isLast ? (
                      thinking
                        ? null  // если есть thinking — курсор уже в thinking блоке
                        : <span className="text-[var(--text-dim)]"> </span>
                    ) : null}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{displayedText}</p>
                )}

                {isLong && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 mt-2 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {expanded
                      ? <><ChevronUp size={11} /> Свернуть</>
                      : <><ChevronDown size={11} /> Развернуть</>
                    }
                  </button>
                )}
              </>
          </div>
        )}
      </div>

      {/* Actions */}
      {!hideActions && !isEditing && !isStreaming && (() => {
        const hasFeedback = !isUser && !!message.feedback?.rating;
        return (
          <div className={`flex items-center gap-0.5 mt-1.5 transition-opacity ${
            hasFeedback
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
          } ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {messageText && (
              <button
                onClick={copyText}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-all"
                title={copied ? 'Скопировано' : 'Копировать'}
              >
                {copied ? <Check size={10} className="text-[var(--gem-green)]" /> : <Copy size={10} />}
                <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
              </button>
            )}

          {/* Нельзя редактировать thinking-only ответы */}
          {!(message.thinking && !messageText && !isBlocked) && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-all"
              title="Изменить"
            >
              <Edit2 size={10} />
              <span className="hidden sm:inline">Изменить</span>
            </button>
          )}

          {!isUser && canRegenerate && isLast && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-all"
              title="Повтор"
            >
              <RefreshCw size={10} />
              <span className="hidden sm:inline">Повтор</span>
            </button>
          )}

          {/* Регенерировать только текст (без DeepThink) */}
          {(() => {
            const hasDeepThink = !!message.deepThinking && !!message.deepThinkEnhancedPrompt;
            const hasError = !!message.error;
            const isEmpty = !messageText && !message.isStreaming;
            const showTextOnlyRegen = !isUser && isLast && hasDeepThink && (hasError || isEmpty || message.isBlocked);
            
            return showTextOnlyRegen && onRegenerateTextOnly && (
              <button
                onClick={() => onRegenerateTextOnly(message.id)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-purple-400/80 hover:text-purple-400 hover:bg-purple-500/10 rounded-md transition-all"
                title="Регенерировать текст"
              >
                <RefreshCw size={10} />
                <span className="hidden sm:inline">Регенерировать текст</span>
              </button>
            );
          })()}

          {/* Continue button UI */}
          {!isUser && isLast && message.isPartial && message.interruptedChunk && onContinue && (
            <div className="flex flex-col gap-1.5 mt-2 mb-1 w-full border-t border-[var(--border-subtle)] pt-2">
              <span className="text-[10px] text-[var(--text-dim)] flex items-center gap-1.5">
                <AlertCircle size={10} className="text-amber-500/70" />
                ✂️ Генерация прервана · {message.interruptedChunk.reason}
              </span>
              <button
                onClick={() => onContinue(message.interruptedChunk)}
                className="flex items-center self-start gap-1.5 px-3 py-1.5 text-[11px] text-[var(--gem-teal)] hover:bg-[rgba(45,212,191,0.08)] bg-[rgba(45,212,191,0.04)] border border-[rgba(45,212,191,0.2)] rounded-lg transition-all font-medium"
                title="Продолжить"
              >
                <span className="text-[10px]">▶</span>
                <span className="inline">Продолжить генерацию</span>
              </button>
            </div>
          )}

          {/* Feedback кнопки - только для model сообщений */}
          {!isUser && onFeedback && onRegenerateWithFeedback && (
            <MessageFeedback
              message={message}
              isLast={isLast}
              onFeedback={onFeedback}
              onRegenerateWithFeedback={onRegenerateWithFeedback}
            />
          )}

          <button
            onClick={() => onDelete(message.id)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--gem-red)] hover:bg-[rgba(239,68,68,0.08)] rounded-md transition-all"
            title="Удалить"
          >
            <Trash2 size={10} />
          </button>
          
          {onBranch && (
            <button
              onClick={onBranch}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-all"
              title="Создать новую ветку от этого сообщения"
            >
              <GitBranch size={10} />
              <span className="hidden md:inline">Ветка</span>
            </button>
          )}
          </div>
        );
      })()}
    </div>
  );
}
