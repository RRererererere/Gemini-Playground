'use client';

import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Brain, ChevronDown, Key, Cpu, Globe, Info } from 'lucide-react';
import type { Provider, ApiKeyEntry, UniversalModel } from '@/types';
import { loadApiKeys } from '@/lib/apiKeyManager';
import { DEFAULT_DEEPTHINK_SYSTEM_PROMPT } from '@/lib/gemini';
import { saveDeepThinkSystemPrompt } from '@/lib/storage';

interface DeepThinkSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  deepThinkDraft: string;
  setDeepThinkDraft: (v: string) => void;
  deepThinkSystemPrompt: string;
  setDeepThinkSystemPrompt: (v: string) => void;
  deepThinkProviderId: string;
  setDeepThinkProviderId: (v: string) => void;
  deepThinkModelId: string;
  setDeepThinkModelId: (v: string) => void;
  deepThinkApiKeyIndex: number;
  setDeepThinkApiKeyIndex: (v: number) => void;
  providers: Provider[];
  apiKeys: Record<string, ApiKeyEntry[]>;
  allModels: UniversalModel[];
  currentProviderId: string;
  currentModel: string;
  currentApiKey: string;
}

const selectClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-white/20 transition-all appearance-none cursor-pointer';

const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
      {label}
      {hint && (
        <span className="text-[10px] font-normal normal-case tracking-normal text-[var(--text-dim)] bg-white/5 px-1.5 py-0.5 rounded-md">
          {hint}
        </span>
      )}
    </label>
    {children}
  </div>
);

export function DeepThinkSettingsDialog({
  open,
  onClose,
  deepThinkDraft,
  setDeepThinkDraft,
  deepThinkSystemPrompt,
  setDeepThinkSystemPrompt,
  deepThinkProviderId,
  setDeepThinkProviderId,
  deepThinkModelId,
  setDeepThinkModelId,
  deepThinkApiKeyIndex,
  setDeepThinkApiKeyIndex,
  providers,
  apiKeys,
  allModels,
  currentProviderId,
  currentModel,
}: DeepThinkSettingsDialogProps) {
  // Активный провайдер для DeepThink (пустая строка = использовать текущий)
  const effectiveDTProvider = deepThinkProviderId || '';
  const selectedProvider = providers.find(p => p.id === effectiveDTProvider) || null;

  // Ключи для выбранного провайдера
  const dtProviderKeys = effectiveDTProvider
    ? (apiKeys[effectiveDTProvider] || loadApiKeys(effectiveDTProvider))
    : [];

  // Модели выбранного провайдера
  const dtModels = effectiveDTProvider
    ? allModels.filter(m => m.providerId === effectiveDTProvider)
    : [];

  // --- Effective labels for "current" display ---
  const currentProviderLabel = providers.find(p => p.id === currentProviderId)?.name || 'Текущий';

  const handleSave = () => {
    const nextPrompt = deepThinkDraft.trim() || DEFAULT_DEEPTHINK_SYSTEM_PROMPT;
    setDeepThinkSystemPrompt(nextPrompt);
    saveDeepThinkSystemPrompt(nextPrompt);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-2xl max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--border)] px-5 py-4 bg-[var(--surface-1)] rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/20">
                <Brain size={15} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">DeepThink</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Настройки режима глубокого анализа</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-5 flex-1">

          {/* Info banner */}
          <div className="flex gap-2.5 rounded-xl border border-purple-500/15 bg-purple-500/5 px-3.5 py-3">
            <Info size={13} className="text-purple-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-purple-300 leading-relaxed">
              DeepThink анализирует контекст диалога и генерирует улучшенный системный промпт перед каждым ответом.
              Выбери отдельную модель для анализа — она может отличаться от основной.
            </p>
          </div>

          {/* Provider */}
          <Row label="Провайдер" hint="пусто = текущий">
            <div className="relative">
              <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
              <select
                value={effectiveDTProvider}
                onChange={e => {
                  setDeepThinkProviderId(e.target.value);
                  setDeepThinkModelId(''); // сбрасываем модель при смене провайдера
                  setDeepThinkApiKeyIndex(0);
                }}
                className={`${selectClass} pl-8`}
              >
                <option value="">
                  ↳ Текущий ({currentProviderLabel})
                </option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
            </div>
          </Row>

          {/* API Key — только если выбран провайдер */}
          {effectiveDTProvider && (
            <Row label="API Ключ" hint={`провайдер: ${selectedProvider?.name}`}>
              <div className="relative">
                <Key size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
                {dtProviderKeys.length > 0 ? (
                  <>
                    <select
                      value={deepThinkApiKeyIndex}
                      onChange={e => setDeepThinkApiKeyIndex(Number(e.target.value))}
                      className={`${selectClass} pl-8`}
                    >
                      {dtProviderKeys.map((entry, idx) => (
                        <option key={idx} value={idx}>
                          {entry.label || `Ключ ${idx + 1}`} (…{entry.key?.slice(-4)})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
                  </>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                    <Key size={11} />
                    Нет ключей для этого провайдера — добавьте в Настройках
                  </div>
                )}
              </div>
            </Row>
          )}

          {/* Model */}
          <Row label="Модель" hint="пусто = текущая">
            <div className="relative">
              <Cpu size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
              {effectiveDTProvider ? (
                dtModels.length > 0 ? (
                  <>
                    <select
                      value={deepThinkModelId}
                      onChange={e => setDeepThinkModelId(e.target.value)}
                      className={`${selectClass} pl-8`}
                    >
                      <option value="">↳ Текущая ({currentModel})</option>
                      {dtModels.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.displayName || m.id}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
                  </>
                ) : (
                  <input
                    type="text"
                    placeholder={`Введите ID модели (текущая: ${currentModel})`}
                    value={deepThinkModelId}
                    onChange={e => setDeepThinkModelId(e.target.value)}
                    className={`${selectClass} pl-8`}
                  />
                )
              ) : (
                <input
                  type="text"
                  placeholder={`Введите ID модели (текущая: ${currentModel})`}
                  value={deepThinkModelId}
                  onChange={e => setDeepThinkModelId(e.target.value)}
                  className={`${selectClass} pl-8`}
                />
              )}
            </div>
            <p className="text-[10px] text-[var(--text-dim)]">
              Например: gemini-2.0-flash-thinking-exp — рекомендуется thinking-модель для лучшего анализа
            </p>
          </Row>

          {/* System Prompt */}
          <Row label="Системный промпт DeepThink">
            <textarea
              value={deepThinkDraft}
              onChange={e => setDeepThinkDraft(e.target.value)}
              placeholder="Введите системный промпт для DeepThink..."
              className="w-full min-h-[200px] max-h-[380px] resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-4 py-3 text-xs leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-mono"
            />
          </Row>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-1)] px-5 py-4">
          <button
            onClick={() => setDeepThinkDraft(DEFAULT_DEEPTHINK_SYSTEM_PROMPT)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          >
            <RefreshCw size={11} />
            Сбросить промпт
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="rounded-xl bg-white px-5 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
