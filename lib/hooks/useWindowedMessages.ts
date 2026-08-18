import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Message } from '@/types';

interface UseWindowedMessagesOptions {
  messages: Message[];
  initialWindowSize?: number;
  loadMoreCount?: number;
}

interface UseWindowedMessagesReturn {
  renderedMessages: Message[];
  hasMoreAbove: boolean;
  loadMoreAbove: () => void;
  resetWindow: () => void;
  topSentinelRef: React.RefObject<HTMLDivElement | null>;
  isAutoLoading: boolean;
}

const DEFAULT_INITIAL_WINDOW = 50;
const DEFAULT_LOAD_MORE = 30;

export function useWindowedMessages({
  messages,
  initialWindowSize = DEFAULT_INITIAL_WINDOW,
  loadMoreCount = DEFAULT_LOAD_MORE,
}: UseWindowedMessagesOptions): UseWindowedMessagesReturn {
  const [windowStart, setWindowStart] = useState(() =>
    Math.max(0, messages.length - initialWindowSize)
  );
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const prevMessagesLenRef = useRef(messages.length);

  // Reset window when messages change (chat switch) — only if it's a completely new chat
  useEffect(() => {
    const prevLen = prevMessagesLenRef.current;
    const newLen = messages.length;
    prevMessagesLenRef.current = newLen;

    // If messages shrunk significantly or changed entirely, reset to bottom
    if (newLen < prevLen || (prevLen === 0 && newLen > 0)) {
      setWindowStart(Math.max(0, newLen - initialWindowSize));
    }
    // If new messages appended (streaming), extend window if user was at bottom
    // This is handled by the parent via resetWindow if needed
  }, [messages.length, initialWindowSize]);

  const hasMoreAbove = windowStart > 0;

  const renderedMessages = useMemo(() => {
    return messages.slice(windowStart);
  }, [messages, windowStart]);

  const loadMoreAbove = useCallback(() => {
    setWindowStart(prev => {
      const newStart = Math.max(0, prev - loadMoreCount);
      return newStart;
    });
  }, [loadMoreCount]);

  const resetWindow = useCallback(() => {
    setWindowStart(Math.max(0, messages.length - initialWindowSize));
  }, [messages.length, initialWindowSize]);

  // IntersectionObserver for auto-loading when sentinel is visible
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel || !hasMoreAbove) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMoreAbove) {
          setIsAutoLoading(true);
          // Small delay to prevent rapid-fire loading
          setTimeout(() => {
            loadMoreAbove();
            setIsAutoLoading(false);
          }, 50);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreAbove, loadMoreAbove]);

  return {
    renderedMessages,
    hasMoreAbove,
    loadMoreAbove,
    resetWindow,
    topSentinelRef,
    isAutoLoading,
  };
}
