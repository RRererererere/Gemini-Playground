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

  const handleSelectionChange = useCallback(() => {
    const selection = document.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setVisible(false);
      return;
    }

    // Только внутри .prose-gem (сообщения модели)
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const proseEl = (container as Element).closest?.('.prose-gem') ||
      (container.parentElement?.closest('.prose-gem'));
    if (!proseEl) {
      setVisible(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 5) { setVisible(false); return; }

    setSelectedText(text);

    const rect = range.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    // На мобиле не показываем toolbar
    if (window.innerWidth < 768) return;
    
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    setVisible(false);
    document.getSelection()?.removeAllRanges();
  };

  const handleQuote = () => {
    onQuote(selectedText);
    setVisible(false);
    document.getSelection()?.removeAllRanges();
  };

  const handleAsk = () => {
    onAsk(`О чём это: «${selectedText.slice(0, 200)}»?`);
    setVisible(false);
    document.getSelection()?.removeAllRanges();
  };

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[150] -translate-x-1/2 -translate-y-full pointer-events-auto"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border-strong)] bg-[rgba(20,20,20,0.98)] p-1 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-fade-in">
        <button
          onMouseDown={e => { e.preventDefault(); handleCopy(); }}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] transition-colors"
        >
          <Copy size={11} />
          Копировать
        </button>
        <div className="w-px h-3 bg-[var(--border)]" />
        <button
          onMouseDown={e => { e.preventDefault(); handleQuote(); }}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-primary)] transition-colors"
        >
          <Quote size={11} />
          Цитировать
        </button>
        <div className="w-px h-3 bg-[var(--border)]" />
        <button
          onMouseDown={e => { e.preventDefault(); handleAsk(); }}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--gem-blue)] hover:bg-[rgba(74,158,255,0.08)] transition-colors"
        >
          <MessageCircle size={11} />
          Спросить
        </button>
      </div>
    </div>
  );
}
