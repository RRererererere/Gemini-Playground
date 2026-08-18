'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, X, Sparkles, RefreshCw } from 'lucide-react';
import type { Message } from '@/types';

interface MessageFeedbackProps {
  message: Message;
  isLast: boolean;
  onFeedback: (
    messageId: string,
    rating: 'like' | 'dislike',
    comment?: string
  ) => void;
  onRegenerateWithFeedback: (
    messageId: string,
    dislikeComment: string
  ) => void;
  /** Запомнить текущий текст как «эталон стиля» (после правок) */
  onRememberStyle?: (messageId: string) => void;
  /** Перегенерировать короче */
  onShorter?: (messageId: string) => void;
  /** Продолжить с конца текущего текста */
  onContinueFromCursor?: (messageId: string) => void;
}

export default function MessageFeedback({
  message,
  isLast,
  onFeedback,
  onRegenerateWithFeedback,
  onRememberStyle,
  onShorter,
  onContinueFromCursor,
}: MessageFeedbackProps) {
  const [showPopup, setShowPopup] = useState<'like' | 'dislike' | null>(null);
  const [commentText, setCommentText] = useState('');
  const [remembered, setRemembered] = useState(false);

  const currentRating = message.feedback?.rating;

  useEffect(() => {
    if (!showPopup) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPopup(null);
        setCommentText('');
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPopup]);

  useEffect(() => {
    if (showPopup) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showPopup]);

  // One-click like (no modal). Long-press / shift+click → comment.
  const handleLikeClick = (e: React.MouseEvent) => {
    if (currentRating === 'like') {
      onFeedback(message.id, 'like');
      return;
    }
    if (e.shiftKey) {
      setShowPopup('like');
      setCommentText('');
      return;
    }
    onFeedback(message.id, 'like');
  };

  const handleDislikeClick = (e: React.MouseEvent) => {
    if (currentRating === 'dislike') {
      onFeedback(message.id, 'dislike');
      return;
    }
    // Dislike: open popup only if shift; else one-click + optional regen on last
    if (e.shiftKey) {
      setShowPopup('dislike');
      setCommentText('');
      return;
    }
    onFeedback(message.id, 'dislike');
  };

  const handleClose = () => {
    setShowPopup(null);
    setCommentText('');
  };

  const handleLikeSave = () => {
    onFeedback(message.id, 'like', commentText.trim() || undefined);
    handleClose();
  };

  const handleDislikeMark = () => {
    onFeedback(message.id, 'dislike', commentText.trim() || undefined);
    handleClose();
  };

  const handleDislikeRegenerate = () => {
    const comment = commentText.trim();
    onFeedback(message.id, 'dislike', comment || undefined);
    onRegenerateWithFeedback(message.id, comment);
    handleClose();
  };

  const handleRemember = () => {
    onRememberStyle?.(message.id);
    setRemembered(true);
    setTimeout(() => setRemembered(false), 2000);
  };

  return (
    <>
      <div className="flex items-center gap-0.5 flex-wrap">
        <button
          onClick={handleLikeClick}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-all ${
            currentRating === 'like'
              ? 'text-[var(--gem-teal)]'
              : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)]'
          }`}
          title="Нравится (Shift+клик — с комментарием)"
        >
          <ThumbsUp size={10} />
        </button>

        <button
          onClick={handleDislikeClick}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-all ${
            currentRating === 'dislike'
              ? 'text-[var(--gem-red)]'
              : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)]'
          }`}
          title="Не нравится (Shift+клик — комментарий / regen)"
        >
          <ThumbsDown size={10} />
        </button>

        {onRememberStyle && (
          <button
            onClick={handleRemember}
            className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-all ${
              remembered
                ? 'text-purple-400'
                : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-purple-300'
            }`}
            title="F-Love: запомнить этот стиль ответа"
          >
            <Sparkles size={10} />
            <span className="hidden sm:inline">{remembered ? 'Ок' : 'Стиль'}</span>
          </button>
        )}

        {onShorter && isLast && (
          <button
            onClick={() => onShorter(message.id)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-amber-300 transition-all"
            title="Перегенерировать короче"
          >
            <RefreshCw size={10} />
            <span className="hidden sm:inline">Короче</span>
          </button>
        )}

        {onContinueFromCursor && isLast && (
          <button
            onClick={() => onContinueFromCursor(message.id)}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--gem-blue)] transition-all"
            title="Продолжить с конца текущего текста"
          >
            <span className="text-[10px]">↪</span>
            <span className="hidden sm:inline">Далее</span>
          </button>
        )}
      </div>

      {showPopup && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={handleClose}
          />
          <div className="fixed inset-x-0 bottom-0 md:inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
            <div
              className="bg-[var(--surface-1)] border-t md:border border-[var(--border)] rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-lg max-h-[85vh] md:max-h-[70vh] overflow-hidden pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  {showPopup === 'like' ? (
                    <>
                      <ThumbsUp size={18} className="text-[var(--gem-teal)]" />
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        Что понравилось?
                      </h3>
                    </>
                  ) : (
                    <>
                      <ThumbsDown size={18} className="text-[var(--gem-red)]" />
                      <h3 className="text-base font-semibold text-[var(--text-primary)]">
                        Что не так?
                      </h3>
                    </>
                  )}
                </div>
                <button
                  onClick={handleClose}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={
                    showPopup === 'like'
                      ? 'Опционально: что именно зашло'
                      : 'Что исправить в следующем ответе'
                  }
                  className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 resize-none text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gem-teal)] min-h-[100px]"
                  autoFocus
                />

                <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-3 md:justify-end">
                  {showPopup === 'like' ? (
                    <>
                      <button
                        onClick={() => {
                          onFeedback(message.id, 'like');
                          handleClose();
                        }}
                        className="w-full md:w-auto px-5 py-2.5 text-sm text-[var(--text-dim)] hover:bg-[var(--surface-3)] rounded-xl"
                      >
                        Без комментария
                      </button>
                      <button
                        onClick={handleLikeSave}
                        className="w-full md:w-auto px-5 py-2.5 bg-[var(--gem-teal)] text-black text-sm rounded-xl font-semibold"
                      >
                        Сохранить
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleDislikeMark}
                        className="w-full md:w-auto px-5 py-2.5 text-sm text-[var(--text-dim)] hover:bg-[var(--surface-3)] rounded-xl"
                      >
                        Только отметить
                      </button>
                      {isLast && (
                        <button
                          onClick={handleDislikeRegenerate}
                          className="w-full md:w-auto px-5 py-2.5 bg-[var(--gem-red)] text-white text-sm rounded-xl font-semibold"
                        >
                          Перегенерировать
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
