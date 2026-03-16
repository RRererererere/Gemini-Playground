'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import {
  User, Sparkles, Copy, Check, Edit2, Trash2, RefreshCw,
  ChevronDown, ChevronUp, FileText, Image as ImageIcon, Volume2, Braces,
  Brain, ShieldAlert, AlertOctagon, Loader2, AlertCircle
} from 'lucide-react';
import type { Message, AttachedFile, Part, DeepThinkAnalysis } from '@/types';

interface ChatMessageProps {
  message: Message;
  index: number;
  isLast: boolean;
  isStreaming: boolean;
  canRegenerate: boolean;
  onEdit: (id: string, newParts: Part[]) => void;
  onDelete: (id: string) => void;
  onRegenerate: () => void;
  onContinue: () => void;
  onEditPreviousUserMessage?: (modelMessageId: string) => void;
  onClearForceEdit?: (userMessageId: string) => void;
  onEditDeepThinkAnalysis?: (id: string, analysis: DeepThinkAnalysis) => void;
}

function FilePreview({ file }: { file: AttachedFile }) {
  const isImage = file.mimeType.startsWith('image/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isJson = file.mimeType === 'application/json' || file.name.endsWith('.json');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (isImage && file.previewUrl) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-[var(--border)] max-w-xs">
        <img src={file.previewUrl} alt={file.name} className="max-h-48 w-auto object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-black/70 w-full">
            <p className="text-white text-xs truncate">{file.name}</p>
          </div>
        </div>
      </div>
    );
  }

  const Icon = isAudio ? Volume2 : isJson ? Braces : FileText;
  const color = isAudio ? '#f59e0b' : isJson ? '#60a5fa' : '#888';

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

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = language || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative group my-3 rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-3)] border-b border-[var(--border)]">
        <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-widest">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
        >
          {copied ? <Check size={11} className="text-[var(--gem-green)]" /> : <Copy size={11} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
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
}: { 
  text: string; 
  isStreaming: boolean;
  isLast: boolean;
  animateKey: number;
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
        remarkPlugins={[remarkGfm]}
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
          remarkPlugins={[remarkGfm]}
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
                remarkPlugins={[remarkGfm]}
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
function DeepThinkingBlock({ thinking, isStreaming }: { thinking: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(true); // По умолчанию открыт
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
    <div className="mb-3 rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-purple-500/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Brain size={13} className="text-purple-400 flex-shrink-0" />
        <span className="text-xs text-purple-400 font-medium flex-1 text-left">
          {isStreaming ? '🧠 DeepThink анализирует контекст...' : '🧠 DeepThink Analysis'}
        </span>
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
          {isTranslating ? (
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
                remarkPlugins={[remarkGfm]}
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
    <span className="relative inline-flex flex-col">
      <button
        onClick={() => setExpanded(v => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 border rounded text-[10px] font-medium cursor-pointer"
        style={badgeStyle}
        title="Нажми для деталей"
      >
        <AlertCircle size={10} className="flex-shrink-0" />
        ! {label}
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

export default function ChatMessage({
  message, index, isLast, isStreaming,
  canRegenerate, onEdit, onDelete, onRegenerate, onContinue, onEditDeepThinkAnalysis, onEditPreviousUserMessage, onClearForceEdit
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

  // Авто-открытие редактора для пустых сообщений
  useEffect(() => {
    if (messageText === '' && isUser && !isEditing) {
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
        {isBlocked && !isUser && (
          <BlockedIndicator reason={message.blockReason || message.finishReason} />
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
      <div className={`relative w-full chat-bubble ${isUser ? 'max-w-[85%] self-end' : 'max-w-[90%] self-start'}`}>

        {/* Файлы */}
        {message.files && message.files.length > 0 && (
          <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.files.map(f => <FilePreview key={f.id} file={f} />)}
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
              className="w-full bg-[var(--surface-2)] border border-white/20 rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none resize-none leading-relaxed"
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

            {/* DeepThink Error block */}
            {!isUser && deepThinkError && (
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
      {!isEditing && !isStreaming && (
        <div className={`flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {messageText && (
            <button
              onClick={copyText}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-all"
            >
              {copied ? <Check size={10} className="text-[var(--gem-green)]" /> : <Copy size={10} />}
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          )}

          {/* Нельзя редактировать thinking-only ответы */}
          {!(message.thinking && !messageText && !isBlocked) && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-all"
            >
              <Edit2 size={10} />
              Изменить
            </button>
          )}

          {!isUser && canRegenerate && isLast && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-all"
            >
              <RefreshCw size={10} />
              Повтор
            </button>
          )}

          {!isUser && isLast && messageText && (
            <button
              onClick={onContinue}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--gem-teal)] hover:bg-[rgba(45,212,191,0.08)] rounded-md transition-all"
            >
              <span className="text-[9px]">▶</span>
              Продолжить
            </button>
          )}

          <button
            onClick={() => onDelete(message.id)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-[var(--gem-red)] hover:bg-[rgba(239,68,68,0.08)] rounded-md transition-all"
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}
