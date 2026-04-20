'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Square } from 'lucide-react';

interface AgentChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled?: boolean;
  isRunning?: boolean;
  placeholder?: string;
}

export function AgentChatInput({
  onSend,
  onStop,
  disabled = false,
  isRunning = false,
  placeholder = 'Введите сообщение...',
}: AgentChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-[var(--text-primary)] placeholder:text-[var(--text-dim)] disabled:opacity-50"
          style={{ maxHeight: '200px' }}
        />
      </div>

      {isRunning ? (
        <button
          onClick={onStop}
          className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex-shrink-0"
          title="Остановить"
        >
          <Square size={20} fill="currentColor" />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || disabled}
          className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[var(--surface-3)] disabled:text-[var(--text-dim)] text-white rounded-xl transition-colors flex-shrink-0"
          title="Отправить"
        >
          <Send size={20} />
        </button>
      )}
    </div>
  );
}
