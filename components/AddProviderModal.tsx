'use client';

import { useState } from 'react';
import { X, Plus, Edit2 } from 'lucide-react';
import type { Provider } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Generic ProviderModal — works for both Add and Edit
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderModalProps {
  /** If provided, the modal starts in edit-mode with prefilled values */
  existingProvider?: Provider;
  onClose: () => void;
  onSave: (provider: Provider) => void;
}

export function ProviderModal({ existingProvider, onClose, onSave }: ProviderModalProps) {
  const isEdit = !!existingProvider;

  const [name, setName] = useState(existingProvider?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(existingProvider?.baseUrl ?? '');
  const [error, setError] = useState('');

  const handleSave = () => {
    setError('');

    if (!name.trim()) {
      setError('Введите название провайдера');
      return;
    }

    if (!baseUrl.trim()) {
      setError('Введите Base URL');
      return;
    }

    try {
      const url = new URL(baseUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        setError('URL должен начинаться с http:// или https://');
        return;
      }
    } catch {
      setError('Неверный формат URL');
      return;
    }

    const provider: Provider = {
      id: existingProvider?.id ?? crypto.randomUUID(),
      name: name.trim(),
      type: 'openai',
      baseUrl: baseUrl.trim().replace(/\/+$/, ''), // remove trailing slashes
      isBuiltin: false,
      createdAt: existingProvider?.createdAt ?? Date.now(),
    };

    onSave(provider);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface-1)] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
        >
          <X size={16} />
        </button>

        <h2 className="mb-1 text-xl font-semibold text-[var(--text-primary)]">
          {isEdit ? 'Редактировать провайдер' : 'Новый провайдер'}
        </h2>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          {isEdit
            ? 'Измените название или Base URL провайдера.'
            : <>Добавьте OpenAI-совместимый эндпоинт (OpenRouter, Ollama, etc.).<br /></>
          }
          {!isEdit && (
            <span className="text-[12px] text-emerald-400">
              Подсказка: после добавления перейдите во вкладку провайдера и укажите API-ключ для загрузки моделей.
            </span>
          )}
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--text-dim)]">Название</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="OpenRouter"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--text-dim)]">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="https://openrouter.ai/api"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 font-mono text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              С /v1 или без — мы нормализуем автоматически
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-[var(--gem-red)]">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !baseUrl.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-opacity disabled:opacity-40"
            >
              {isEdit ? <Edit2 size={15} /> : <Plus size={16} />}
              {isEdit ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Legacy named export so existing imports `AddProviderModal` still compile
export const AddProviderModal = ProviderModal;
