'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, MessageSquare, Plus, SlidersHorizontal, Brain, MonitorPlay } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string;
}

interface CommandPaletteProps {
  savedChats: Array<{ id: string; title: string }>;
  onNewChat: () => void;
  onLoadChat: (id: string) => void;
  onOpenSettings: () => void;
  onOpenMemory: () => void;
  onToggleCanvas: () => void;
}

export function CommandPalette({ savedChats, onNewChat, onLoadChat, onOpenSettings, onOpenMemory, onToggleCanvas }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const baseCommands: Command[] = [
    { id: 'new-chat', label: 'Новый чат', icon: <Plus size={14} />, action: () => { onNewChat(); setOpen(false); }, keywords: 'new chat создать' },
    { id: 'settings', label: 'Настройки', icon: <SlidersHorizontal size={14} />, action: () => { onOpenSettings(); setOpen(false); }, keywords: 'settings настройки' },
    { id: 'memory', label: 'Управление памятью', icon: <Brain size={14} />, action: () => { onOpenMemory(); setOpen(false); }, keywords: 'memory память' },
    { id: 'canvas', label: 'Открыть Canvas', icon: <MonitorPlay size={14} />, action: () => { onToggleCanvas(); setOpen(false); }, keywords: 'canvas preview' },
  ];

  const chatCommands: Command[] = savedChats.slice(0, 20).map(chat => ({
    id: `chat-${chat.id}`,
    label: chat.title,
    sublabel: 'Открыть чат',
    icon: <MessageSquare size={14} />,
    action: () => { onLoadChat(chat.id); setOpen(false); },
    keywords: chat.title.toLowerCase(),
  }));

  const allCommands = [...baseCommands, ...chatCommands];

  const filtered = useMemo(() => {
    if (!query.trim()) return baseCommands;
    const q = query.toLowerCase();
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) || c.keywords.includes(q) || (c.sublabel?.toLowerCase().includes(q))
    );
  }, [query, allCommands]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-[var(--border-strong)] bg-[rgba(10,10,10,0.96)] shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <Search size={15} className="text-[var(--text-dim)] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск команд и чатов..."
            className="flex-1 bg-transparent text-[var(--text-primary)] text-sm placeholder:text-[var(--text-dim)] focus:outline-none"
            onKeyDown={e => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && filtered.length > 0) filtered[0].action();
            }}
          />
          <kbd className="text-[10px] text-[var(--text-dim)] border border-[var(--border)] rounded px-1.5 py-0.5 font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[var(--text-dim)]">Ничего не найдено</p>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              onClick={cmd.action}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                i === 0 && query ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-3)] text-[var(--text-muted)] flex-shrink-0">
                {cmd.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate">{cmd.label}</p>
                {cmd.sublabel && <p className="text-[11px] text-[var(--text-dim)]">{cmd.sublabel}</p>}
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center gap-3 text-[10px] text-[var(--text-dim)]">
          <span><kbd className="font-mono border border-[var(--border)] rounded px-1">↑↓</kbd> навигация</span>
          <span><kbd className="font-mono border border-[var(--border)] rounded px-1">↵</kbd> выбрать</span>
          <span><kbd className="font-mono border border-[var(--border)] rounded px-1">⌘K</kbd> закрыть</span>
        </div>
      </div>
    </div>
  );
}
