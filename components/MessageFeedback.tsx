'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';
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
}

export default function MessageFeedback({
  message,
  isLast,
  onFeedback,
  onRegenerateWithFeedback,
}: MessageFeedbackProps) {
  const [showPopup, setShowPopup] = useState<'like' | 'dislike' | null>(null);
  const [commentText, setCommentText] = useState('');

  const currentRating = message.feedback?.rating;

  // Закрыть попап при Escape
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

  // Блокировка скролла body когда попап открыт
  useEffect(() => {
    if (showPopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showPopup]);

  const handleLikeClick = () => {
    // Toggle off если уже стоит лайк
    if (currentRating === 'like') {
      onFeedback(message.id, 'like'); // toggle
      return;
    }
    
    // Показать попап для комментария
    setShowPopup('like');
    setCommentText('');
  };

  const handleDislikeClick = () => {
    // Toggle off если уже стоит дизлайк
    if (currentRating === 'dislike') {
      onFeedback(message.id, 'dislike'); // toggle
      return;
    }
    
    // Показать попап для комментария
    setShowPopup('dislike');
    setCommentText('');
  };

  const handleClose = () => {
    setShowPopup(null);
    setCommentText('');
  };

  const handleLikeSkip = () => {
    onFeedback(message.id, 'like');
    handleClose();
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

  return (
    <>
      {/* Кнопки лайк/дизлайк */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={handleLikeClick}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-all ${
            currentRating === 'like'
              ? 'text-[var(--gem-teal)]'
              : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)]'
          }`}
          title="Понравилось"
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
          title="Не понравилось"
        >
          <ThumbsDown size={10} />
        </button>
      </div>

      {/* Модальный попап */}
      {showPopup && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={handleClose}
          />

          {/* Modal content - Desktop: центр экрана, Mobile: bottom sheet */}
          <div className="fixed inset-x-0 bottom-0 md:inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
            <div
              className="bg-[var(--surface-1)] border-t md:border border-[var(--border)] rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-lg max-h-[85vh] md:max-h-[70vh] overflow-hidden pointer-events-auto animate-in slide-in-from-bottom md:slide-in-from-bottom-4 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
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

              {/* Content */}
              <div className="p-5 space-y-4">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    showPopup === 'like'
                      ? 'Опишите что вам понравилось в этом ответе (необязательно)'
                      : 'Опишите что не так — это поможет улучшить следующий ответ'
                  }
                  className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 resize-none text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--gem-teal)] focus:ring-2 focus:ring-[var(--gem-teal)]/20 min-h-[120px] md:min-h-[100px]"
                  autoFocus
                />

                {/* Buttons */}
                <div className="flex flex-col-reverse md:flex-row gap-2 md:gap-3 md:justify-end">
                  {showPopup === 'like' ? (
                    <>
                      <button
                        onClick={handleLikeSkip}
                        className="w-full md:w-auto px-5 py-3 md:py-2.5 text-sm text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-xl transition-all font-medium"
                      >
                        Пропустить
                      </button>
                      <button
                        onClick={handleLikeSave}
                        className="w-full md:w-auto px-5 py-3 md:py-2.5 bg-[var(--gem-teal)] text-black text-sm rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-[var(--gem-teal)]/20"
                      >
                        Сохранить
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleDislikeMark}
                        className="w-full md:w-auto px-5 py-3 md:py-2.5 text-sm text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-xl transition-all font-medium"
                      >
                        Только отметить
                      </button>
                      {isLast && (
                        <button
                          onClick={handleDislikeRegenerate}
                          className="w-full md:w-auto px-5 py-3 md:py-2.5 bg-[var(--gem-red)] text-white text-sm rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg shadow-[var(--gem-red)]/20"
                        >
                          Регенерировать ↺
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
