import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Хук для управления прокруткой чата.
 * Отслеживает положение пользователя относительно дна контейнера
 * и предоставляет функции для прокрутки.
 */
export function useScroll() {
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isAtBottomRef = useRef(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const scrollToBottomImmediate = useCallback(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, []);

  // Maintain scroll position after prepending elements (loading older messages)
  const maintainScrollPosition = useCallback((prevScrollHeight: number) => {
    const container = containerRef.current;
    if (!container) return;
    const newScrollHeight = container.scrollHeight;
    const diff = newScrollHeight - prevScrollHeight;
    if (diff > 0) {
      container.scrollTop += diff;
    }
  }, []);

  const getScrollContainer = useCallback(() => containerRef.current, []);

  const setScrollContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  return {
    showScrollBottom,
    isAtBottomRef,
    chatEndRef,
    handleScroll,
    scrollToBottom,
    scrollToBottomImmediate,
    maintainScrollPosition,
    getScrollContainer,
    setScrollContainer,
    setShowScrollBottom,
  };
}
