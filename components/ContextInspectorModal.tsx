'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Edit2,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  MessageSquare,
} from 'lucide-react';
import type { Message } from '@/types';
import { buildSystemPromptLayers, type ContextLayerPreview } from '@/lib/context-layers';
import { buildChatRequestMessages } from '@/lib/gemini';
import {
  type ContextLayersConfig,
  type ContextLayerId,
  CONTEXT_LAYER_META,
  loadContextLayersConfig,
  saveContextLayersConfig,
  resetContextLayersConfig,
  saveMemoryInstructionsOverride,
  loadMemoryInstructionsOverride,
} from '@/lib/context-layers-storage';
import { getDefaultMemoryInstructions as getMemInstr } from '@/lib/memory-prompt';

interface ContextInspectorModalProps {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  systemPrompt: string;
  chatId?: string | null;
  memoryEnabled: boolean;
  onMemoryEnabledChange: (v: boolean) => void;
  onSystemPromptChange: (v: string) => void;
  handleSkillEvent: (event: unknown) => void;
  deepThinkEnhancedPrompt?: string | null;
  onOpenMemory?: () => void;
  onOpenSkills?: () => void;
  onOpenRPG?: () => void;
  onOpenDeepThink?: () => void;
  onOpenSystem?: () => void;
}

type TabId = 'layers' | 'preview' | 'messages';

export function ContextInspectorModal({
  open,
  onClose,
  messages,
  systemPrompt,
  chatId,
  memoryEnabled,
  onMemoryEnabledChange,
  onSystemPromptChange,
  handleSkillEvent,
  deepThinkEnhancedPrompt,
  onOpenMemory,
  onOpenSkills,
  onOpenRPG,
  onOpenDeepThink,
  onOpenSystem,
}: ContextInspectorModalProps) {
  const [config, setConfig] = useState<ContextLayersConfig>(loadContextLayersConfig);
  const [tab, setTab] = useState<TabId>('layers');
  const [expandedId, setExpandedId] = useState<ContextLayerId | null>(null);
  const [editingId, setEditingId] = useState<ContextLayerId | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [rpgOverride, setRpgOverride] = useState<string | null>(null);
  const [imageOverride, setImageOverride] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setConfig(loadContextLayersConfig());
      setTab('layers');
      setEditingId(null);
      setRpgOverride(null);
      setImageOverride(null);
    }
  }, [open]);

  const built = useMemo(
    () =>
      buildSystemPromptLayers({
        messages,
        systemPrompt,
        chatId,
        memoryEnabled,
        config,
        handleSkillEvent,
        deepThinkEnhancedPrompt,
        rpgStyleOverride: rpgOverride,
        imageContextOverride: imageOverride,
      }),
    [messages, systemPrompt, chatId, memoryEnabled, config, handleSkillEvent, deepThinkEnhancedPrompt, rpgOverride, imageOverride]
  );

  const apiMessages = useMemo(
    () => buildChatRequestMessages(messages, config.messageFilters),
    [messages, config.messageFilters]
  );

  const persist = useCallback((next: ContextLayersConfig) => {
    setConfig(next);
    saveContextLayersConfig(next);
  }, []);

  const toggleLayer = (id: ContextLayerId) => {
    persist({
      ...config,
      layers: {
        ...config.layers,
        [id]: { ...config.layers[id], enabled: !config.layers[id].enabled },
      },
    });
  };

  const startEdit = (layer: ContextLayerPreview) => {
    if (!layer.editable) return;
    setEditingId(layer.id);
    if (layer.id === 'memory_instructions') {
      setEditDraft(loadMemoryInstructionsOverride() || getMemInstr());
    } else if (layer.id === 'user_system') {
      setEditDraft(systemPrompt);
    } else if (layer.id === 'rpg_style') {
      setEditDraft(layer.content || '');
      setRpgOverride(layer.content || '');
    } else if (layer.id === 'image_context') {
      setEditDraft(layer.content || '');
      setImageOverride(layer.content || '');
    } else {
      setEditDraft(layer.content);
    }
    setExpandedId(layer.id);
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (editingId === 'memory_instructions') {
      saveMemoryInstructionsOverride(editDraft);
    } else if (editingId === 'user_system') {
      onSystemPromptChange(editDraft);
    } else if (editingId === 'rpg_style') {
      persist({
        ...config,
        layers: {
          ...config.layers,
          rpg_style: { ...config.layers.rpg_style, customText: editDraft },
        },
      });
      setRpgOverride(null);
    } else if (editingId === 'image_context') {
      persist({
        ...config,
        layers: {
          ...config.layers,
          image_context: { ...config.layers.image_context, customText: editDraft },
        },
      });
      setImageOverride(null);
    }
    setEditingId(null);
  };

  const resetLayerText = (id: ContextLayerId) => {
    if (id === 'memory_instructions') {
      saveMemoryInstructionsOverride(null);
      setEditDraft(getMemInstr());
    } else if (id === 'rpg_style') {
      persist({
        ...config,
        layers: { ...config.layers, rpg_style: { ...config.layers.rpg_style, customText: null } },
      });
      setRpgOverride(null);
      setEditDraft('');
    } else if (id === 'image_context') {
      persist({
        ...config,
        layers: { ...config.layers, image_context: { ...config.layers.image_context, customText: null } },
      });
      setImageOverride(null);
      setEditDraft('');
    }
  };

  const openLinked = (link?: string) => {
    onClose();
    if (link === 'memory') onOpenMemory?.();
    else if (link === 'skills') onOpenSkills?.();
    else if (link === 'rpg') onOpenRPG?.();
    else if (link === 'deepthink') onOpenDeepThink?.();
    else if (link === 'system') onOpenSystem?.();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(built.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[95dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--gem-teal)]/15 text-[var(--gem-teal)]">
                <Layers size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Контекст запроса</h2>
                <p className="text-xs text-[var(--text-dim)] truncate">
                  Всё, что уходит в нейросеть · {built.text.length.toLocaleString()} симв.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] hover:bg-[var(--surface-3)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {([
              ['layers', 'Слои'],
              ['preview', 'Итоговый промпт'],
              ['messages', `История (${apiMessages.length})`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  tab === id
                    ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === 'layers' && (
            <div className="p-4 space-y-3">
              {/* Global toggles */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Память (глобально)</p>
                    <p className="text-[10px] text-[var(--text-dim)]">Включает memory tools и слои памяти</p>
                  </div>
                  <Toggle checked={memoryEnabled} onChange={onMemoryEnabledChange} />
                </div>
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Инструкции памяти всегда</p>
                    <p className="text-[10px] text-[var(--text-dim)]">Даже без релевантных фактов</p>
                  </div>
                  <Toggle
                    checked={config.alwaysIncludeMemoryInstructions}
                    onChange={v =>
                      persist({ ...config, alwaysIncludeMemoryInstructions: v })
                    }
                  />
                </div>
              </div>

              {/* Layers list */}
              {built.layers.map(layer => (
                <LayerCard
                  key={layer.id}
                  layer={layer}
                  expanded={expandedId === layer.id}
                  editing={editingId === layer.id}
                  editDraft={editDraft}
                  onToggleExpand={() =>
                    setExpandedId(expandedId === layer.id ? null : layer.id)
                  }
                  onToggleEnabled={() => toggleLayer(layer.id)}
                  onEdit={() => startEdit(layer)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onDraftChange={setEditDraft}
                  onReset={() => resetLayerText(layer.id)}
                  onOpenLink={() => openLinked(layer.link)}
                />
              ))}

              {/* Message filters */}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={14} className="text-[var(--text-dim)]" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">Фильтры истории</p>
                </div>
                <p className="text-[10px] text-[var(--text-dim)] mb-3">
                  Сообщения, которые не попадут в API (но могут быть видны в чате)
                </p>
                <div className="space-y-2">
                  <FilterRow
                    label="Скрытые feedback-хинты (bridge_data)"
                    checked={config.messageFilters.excludeBridgeData}
                    onChange={v =>
                      persist({
                        ...config,
                        messageFilters: { ...config.messageFilters, excludeBridgeData: v },
                      })
                    }
                  />
                  <FilterRow
                    label="Скрытые старые ответы (regenerated_hidden)"
                    checked={config.messageFilters.excludeRegeneratedHidden}
                    onChange={v =>
                      persist({
                        ...config,
                        messageFilters: { ...config.messageFilters, excludeRegeneratedHidden: v },
                      })
                    }
                  />
                  <FilterRow
                    label="Отдельные tool_response"
                    checked={config.messageFilters.excludeToolResponse}
                    onChange={v =>
                      persist({
                        ...config,
                        messageFilters: { ...config.messageFilters, excludeToolResponse: v },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'preview' && (
            <div className="p-4 space-y-3">
              {built.layers.find(l => l.id === 'deepthink_enhanced')?.content && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-xs text-purple-200">
                  DeepThink активен: итоговый промпт заменяет базовые слои (память, скиллы, RPG).
                  Базовый стек ({built.baseBeforeDeepThink.length} симв.) передаётся только анализатору.
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-dim)]">
                  {built.text.length.toLocaleString()} символов
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] px-2 py-1 rounded-lg hover:bg-[var(--surface-3)]"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Скопировано' : 'Копировать'}
                </button>
              </div>
              <pre className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-xs text-[var(--text-primary)] whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[50vh] overflow-y-auto">
                {built.text || '(пусто)'}
              </pre>
              {built.baseBeforeDeepThink && built.baseBeforeDeepThink !== built.text && (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)] mt-4">
                    Базовый стек (до DeepThink)
                  </p>
                  <pre className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-4 text-[10px] text-[var(--text-dim)] whitespace-pre-wrap break-words font-mono leading-relaxed max-h-[30vh] overflow-y-auto">
                    {built.baseBeforeDeepThink}
                  </pre>
                </>
              )}
            </div>
          )}

          {tab === 'messages' && (
            <div className="p-4 space-y-2">
              <p className="text-xs text-[var(--text-dim)] mb-3">
                {messages.length} в чате → {apiMessages.length} уйдёт в API
                {messages.length !== apiMessages.length && (
                  <span className="text-amber-400/80"> · {messages.length - apiMessages.length} отфильтровано</span>
                )}
              </p>
              {apiMessages.map((msg, idx) => {
                const text = msg.parts
                  .filter((p: { text?: string; thought?: boolean }) => 'text' in p && !p.thought)
                  .map((p: { text: string }) => p.text)
                  .join('');
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono uppercase ${
                        msg.role === 'user' ? 'text-blue-400' : 'text-emerald-400'
                      }`}>
                        {msg.role}
                      </span>
                      {msg.parts?.some((p: { inlineData?: unknown }) => 'inlineData' in p) && (
                        <span className="text-[9px] text-[var(--text-dim)]">+ media</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-primary)] line-clamp-3 whitespace-pre-wrap">
                      {text || '(tool calls / media)'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              const reset = resetContextLayersConfig();
              setConfig(reset);
              setRpgOverride(null);
              setImageOverride(null);
            }}
            className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] px-3 py-2 rounded-xl hover:bg-[var(--surface-3)]"
          >
            <RotateCcw size={12} />
            Сбросить слои
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:opacity-90"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-9 h-5 bg-[var(--surface-4)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
    </label>
  );
}

function FilterRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </label>
  );
}

function LayerCard({
  layer,
  expanded,
  editing,
  editDraft,
  onToggleExpand,
  onToggleEnabled,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDraftChange,
  onReset,
  onOpenLink,
}: {
  layer: ContextLayerPreview;
  expanded: boolean;
  editing: boolean;
  editDraft: string;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (v: string) => void;
  onReset: () => void;
  onOpenLink: () => void;
}) {
  const meta = CONTEXT_LAYER_META[layer.id];

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        layer.enabled
          ? 'border-[var(--border)] bg-[var(--surface-2)]'
          : 'border-[var(--border)]/50 bg-[var(--surface-2)]/40 opacity-70'
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={onToggleEnabled}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            layer.enabled
              ? 'text-emerald-400 hover:bg-emerald-500/10'
              : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)]'
          }`}
          title={layer.enabled ? 'Отключить слой' : 'Включить слой'}
        >
          {layer.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        <button onClick={onToggleExpand} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">{layer.label}</span>
            {layer.isEmpty && (
              <span className="text-[9px] text-[var(--text-dim)] bg-[var(--surface-3)] px-1.5 py-0.5 rounded">пусто</span>
            )}
            {!layer.isEmpty && (
              <span className="text-[9px] font-mono text-[var(--text-dim)]">
                {layer.charCount.toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--text-dim)] truncate">{meta.description}</p>
        </button>

        <div className="flex items-center gap-1">
          {layer.link && (
            <button
              onClick={onOpenLink}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
              title="Открыть настройки"
            >
              <ExternalLink size={12} />
            </button>
          )}
          {layer.editable && (
            <button
              onClick={onEdit}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
              title="Редактировать"
            >
              <Edit2 size={12} />
            </button>
          )}
          <button onClick={onToggleExpand} className="flex h-7 w-7 items-center justify-center text-[var(--text-dim)]">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editDraft}
                onChange={e => onDraftChange(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--text-primary)] font-mono leading-relaxed resize-y min-h-[120px] focus:outline-none focus:ring-1 focus:ring-white/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={onSaveEdit}
                  className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium"
                >
                  Сохранить
                </button>
                <button
                  onClick={onCancelEdit}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-dim)]"
                >
                  Отмена
                </button>
                <button
                  onClick={onReset}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] ml-auto flex items-center gap-1"
                >
                  <RotateCcw size={10} />
                  По умолчанию
                </button>
              </div>
            </div>
          ) : (
            <pre className="text-[11px] text-[var(--text-muted)] whitespace-pre-wrap break-words font-mono leading-relaxed max-h-48 overflow-y-auto">
              {layer.content || '(нет содержимого)'}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
