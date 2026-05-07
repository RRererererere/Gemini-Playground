'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Quote, Copy, MessageCircle } from 'lucide-react';

interface SelectionToolbarProps {
  onQuote: (text: string) => void;
  onAsk: (text: string) => void;
}

export function SelectionToolbar({ onQuote, onAsk }: SelectionToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const scheduleHide = useCallback((ms = 150) => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setVisible(false), ms);
  }, []);

  // Вычислить позицию тулбара с учётом краёв экрана
  const computePosition = (rect: DOMRect) => {
    const toolbarH = 40;
    const toolbarW = 220;
    const margin = 8;

    let x = rect.left + rect.width / 2;
    let y = rect.top - margin;

    // Не выходим за правый край
    if (x + toolbarW / 2 > window.innerWidth - margin) {
      x = window.innerWidth - margin - toolbarW / 2;
    }
    // Не выходим за левый край
    if (x - toolbarW / 2 < margin) {
      x = margin + toolbarW / 2;
    }
    // Если нет места сверху — показываем снизу
    if (y - toolbarH < margin) {
      y = rect.bottom + margin + toolbarH;
    }

    return { x, y };
  };

  // Проверка — выделение внутри .prose-gem
  const getProseSelection = (): { text: string; rect: DOMRect } | null => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return null;

    const text = selection.toString().trim();
    if (text.length < 3) return null;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const el = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as Element);
    const proseEl = el?.closest('.prose-gem');
    if (!proseEl) return null;

    return { text, rect: range.getBoundingClientRect() };
  };

  // ── Desktop: selectionchange ──────────────────────────────────────────
  const handleSelectionChange = useCallback(() => {
    const result = getProseSelection();
    if (!result) {
      scheduleHide();
      return;
    }
    clearHideTimer();
    setSelectedText(result.text);
    setPosition(computePosition(result.rect));
    setVisible(true);
  }, [scheduleHide]);

  // ── Mobile: touchend ──────────────────────────────────────────────────
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Небольшая задержка — дать браузеру время зафиксировать selection
    setTimeout(() => {
      const result = getProseSelection();
      if (!result) {
        setVisible(false);
        return;
      }

      // На мобиле берём позицию касания как якорь
      const touch = e.changedTouches[0];
      const touchY = touch?.clientY ?? result.rect.top;
      const touchX = touch?.clientX ?? result.rect.left + result.rect.width / 2;

      setSelectedText(result.text);
      setPosition(computePosition({
        ...result.rect,
        left: result.rect.left,
        right: result.rect.right,
        top: Math.min(touchY, result.rect.top),
        bottom: result.rect.bottom,
        width: result.rect.width,
        height: result.rect.height,
        x: result.rect.x,
        y: result.rect.y,
        toJSON: result.rect.toJSON,
      }));
      setVisible(true);
    }, 80);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('touchend', handleTouchEnd);
      clearHideTimer();
    };
  }, [handleSelectionChange, handleTouchEnd]);

  // Скрывать при скролле
  useEffect(() => {
    const onScroll = () => setVisible(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dismiss = () => {
    setVisible(false);
    document.getSelection()?.removeAllRanges();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText).catch(() => {
      // fallback для мобильных браузеров без clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = selectedText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
    dismiss();
  };

  const handleQuote = () => {
    onQuote(selectedText);
    dismiss();
  };

  const handleAsk = () => {
    onAsk(`О чём это: «${selectedText.slice(0, 200)}»?`);
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[200] pointer-events-auto"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
      // Предотвращаем снятие выделения при клике на тулбар
      onMouseDown={e => e.preventDefault()}
      onTouchStart={e => e.preventDefault()}
    >
      {/* Arrow pointer */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full w-0 h-0"
        style={{
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid rgba(15,15,20,0.98)',
        }}
      />

      <div
        className="flex items-center gap-0.5 rounded-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl p-1"
        style={{ background: 'rgba(14,14,20,0.98)' }}
      >
        <button
          onMouseDown={e => { e.preventDefault(); handleCopy(); }}
          onTouchEnd={e => { e.preventDefault(); handleCopy(); }}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-medium text-[var(--text-muted)] hover:bg-white/[0.07] hover:text-white active:scale-95 transition-all"
        >
          <Copy size={12} />
          Копировать
        </button>

        <div className="w-px h-4 bg-white/10 mx-0.5" />

        <button
          onMouseDown={e => { e.preventDefault(); handleQuote(); }}
          onTouchEnd={e => { e.preventDefault(); handleQuote(); }}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-medium text-[var(--text-muted)] hover:bg-white/[0.07] hover:text-white active:scale-95 transition-all"
        >
          <Quote size={12} />
          Цитата
        </button>

        <div className="w-px h-4 bg-white/10 mx-0.5" />

        <button
          onMouseDown={e => { e.preventDefault(); handleAsk(); }}
          onTouchEnd={e => { e.preventDefault(); handleAsk(); }}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-medium text-[#6eb8ff] hover:bg-[rgba(74,158,255,0.08)] hover:text-[#90caff] active:scale-95 transition-all"
        >
          <MessageCircle size={12} />
          Спросить
        </button>
      </div>
    </div>
  );
}
