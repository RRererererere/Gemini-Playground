'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Loader2, Trash2, Power, ExternalLink, AlertCircle } from 'lucide-react';
import {
  parseHFSpace,
  loadStoredHFSpaces,
  saveHFSpace,
  deleteHFSpace,
  toggleHFSpace,
} from '@/lib/skills/hf-space';
import type { ParsedHFSpace, StoredHFSpace } from '@/lib/skills/hf-space';

interface Props {
  open: boolean;
  onClose: () => void;
  onSpacesChanged: () => void;
}

type Tab = 'add' | 'manage';

export function HFSpaceManager({ open, onClose, onSpacesChanged }: Props) {
  const [tab, setTab] = useState<Tab>('add');
  const [spaces, setSpaces] = useState<StoredHFSpace[]>([]);

  useEffect(() => {
    if (open) {
      setSpaces(loadStoredHFSpaces());
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
              🤗 HuggingFace Spaces
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Подключай AI модели из HuggingFace как скиллы
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--surface-3)] rounded-lg transition-colors"
          >
            <X size={20} className="text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-[var(--border)]">
          <button
            onClick={() => setTab('add')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === 'add'
                ? 'bg-[var(--surface-2)] text-[var(--text-primary)] border-b-2 border-blue-500'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            <Plus size={14} className="inline mr-1.5" />
            Добавить
          </button>
          <button
            onClick={() => setTab('manage')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === 'manage'
                ? 'bg-[var(--surface-2)] text-[var(--text-primary)] border-b-2 border-blue-500'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]'
            }`}
          >
            Управление ({spaces.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'add' ? (
            <AddSpaceTab
              onAdded={() => {
                setSpaces(loadStoredHFSpaces());
                onSpacesChanged();
                setTab('manage');
              }}
            />
          ) : (
            <ManageSpacesTab
              spaces={spaces}
              onToggle={(spaceId, enabled) => {
                toggleHFSpace(spaceId, enabled);
                setSpaces(loadStoredHFSpaces());
                onSpacesChanged();
              }}
              onDelete={(spaceId) => {
                deleteHFSpace(spaceId);
                setSpaces(loadStoredHFSpaces());
                onSpacesChanged();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Space Tab
// ─────────────────────────────────────────────────────────────────────────────

function AddSpaceTab({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<ParsedHFSpace | null>(null);

  const handleParse = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setParsed(null);

    try {
      const space = await parseHFSpace(url, token || undefined);
      setParsed(space);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!parsed) return;

    const stored: StoredHFSpace = {
      spaceId: parsed.spaceId,
      title: parsed.title,
      apiUrl: parsed.apiUrl,
      enabled: true,
      addedAt: Date.now(),
      token: token || undefined,
      parsed,
    };

    saveHFSpace(stored);
    onAdded();
    
    // Reset
    setUrl('');
    setToken('');
    setParsed(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
          URL Space
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="huggingface.co/spaces/owner/space или owner/space"
          className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && handleParse()}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
          HF Token (опционально)
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="hf_..."
          className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Нужен только для приватных Spaces
        </p>
      </div>

      <button
        onClick={handleParse}
        disabled={loading || !url.trim()}
        className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Загрузка...
          </>
        ) : (
          'Загрузить Space'
        )}
      </button>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3 mb-2">
            <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300 font-medium">Ошибка загрузки Space</div>
          </div>
          <div className="text-sm text-red-300/80 ml-8">{error}</div>
          <div className="text-xs text-red-300/60 ml-8 mt-2">
            Проверь:
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Space существует и доступен</li>
              <li>URL введён правильно</li>
              <li>Space не находится в режиме сна (открой его в браузере)</li>
              <li>Для приватных Spaces добавь HF Token</li>
            </ul>
          </div>
        </div>
      )}

      {parsed && (
        <div className="p-4 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">{parsed.title}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{parsed.spaceId}</p>
            </div>
            <a
              href={`https://huggingface.co/spaces/${parsed.spaceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              <ExternalLink size={16} />
            </a>
          </div>

          <div className="text-sm text-[var(--text-muted)]">
            Найдено эндпоинтов: {parsed.endpoints.length}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {parsed.endpoints.map((ep) => (
              <div
                key={ep.id}
                className="p-3 bg-[var(--surface-3)] rounded-lg text-sm"
              >
                <div className="font-medium text-[var(--text-primary)]">{ep.name}</div>
                {ep.description && (
                  <div className="text-xs text-[var(--text-muted)] mt-1">{ep.description}</div>
                )}
                <div className="text-xs text-[var(--text-dim)] mt-1">
                  {ep.parameters.length} параметров → {ep.returns.length} выходов
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAdd}
            className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
          >
            Добавить Space
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Manage Spaces Tab
// ─────────────────────────────────────────────────────────────────────────────

function ManageSpacesTab({
  spaces,
  onToggle,
  onDelete,
}: {
  spaces: StoredHFSpace[];
  onToggle: (spaceId: string, enabled: boolean) => void;
  onDelete: (spaceId: string) => void;
}) {
  if (spaces.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        <div className="text-4xl mb-4">🤗</div>
        <p>Нет подключённых Spaces</p>
        <p className="text-sm mt-2">Добавь первый через вкладку "Добавить"</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {spaces.map((space) => (
        <div
          key={space.spaceId}
          className="p-4 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[var(--text-primary)]">{space.title}</h3>
                {space.enabled ? (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                    Активен
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 text-xs rounded">
                    Выключен
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">{space.spaceId}</p>
              <p className="text-xs text-[var(--text-dim)] mt-2">
                {space.parsed.endpoints.length} эндпоинтов • Добавлен{' '}
                {new Date(space.addedAt).toLocaleDateString()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggle(space.spaceId, !space.enabled)}
                className={`p-2 rounded-lg transition-colors ${
                  space.enabled
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
                title={space.enabled ? 'Выключить' : 'Включить'}
              >
                <Power size={16} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Удалить ${space.title}?`)) {
                    onDelete(space.spaceId);
                  }
                }}
                className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                title="Удалить"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
