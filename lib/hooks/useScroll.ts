import { useState, useRef, useCallback } from 'react';

/**
 * Хук для управления прокруткой чата.
 * Отслеживает положение пользователя относительно дна контейнера
 * и предоставляет функции для прокрутки.
 */
export function useScroll() {
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isAtBottomRef = useRef(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceToBottom <= 40;
    isAtBottomRef.current = atBottom;

    if (distanceToBottom > 150) {
      setShowScrollBottom(true);
    } else {
      setShowScrollBottom(false);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return {
    showScrollBottom,
    isAtBottomRef,
    chatEndRef,
    handleScroll,
    scrollToBottom,
    setShowScrollBottom,
  };
}
