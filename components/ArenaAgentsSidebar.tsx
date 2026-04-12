'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronDown, Download, Plus, Trash2, X, Zap, Brain } from 'lucide-react';
import type { ArenaAgent, ArenaSession } from '@/lib/arena-types';
import { AGENT_EMOJIS, AGENT_COLORS } from '@/lib/arena-types';
import type { UniversalModel, ApiKeyEntry, SavedChat, Provider } from '@/types';

function getApiKeySuffix(key?: string) {
  if (!key) return '—';
  return '…' + key.slice(-4);
}

interface ArenaAgentsSidebarProps {
  session: ArenaSession | null;
  models: UniversalModel[];
  providers: Provider[];
  globalApiKeys: Record<string, ApiKeyEntry[]>;
  savedChats: SavedChat[];
  onUpdateAgent: (agent: ArenaAgent) => void;
  onAddAgent: () => void;
  onRemoveAgent: (agentId: string) => void;
  responseMode: 'auto' | 'manual';
  onToggleMode: () => void;
  onImportChat: (chat: SavedChat) => void;
  onUpdateSessionPrompt: (prompt: string) => void;
  onOpenSettings?: () => void;
  onClose?: () => void;
}

function AgentCard({
  agent,
  models,
  providers,
  globalApiKeys,
  onUpdate,
  onRemove,
}: {
  agent: ArenaAgent;
  models: UniversalModel[];
  providers: Provider[];
  globalApiKeys: Record<string, ApiKeyEntry[]>;
  onUpdate: (a: ArenaAgent) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [draft, setDraft] = useState<ArenaAgent>(agent);

  const handleExpand = () => {
    if (!expanded) {
      setDraft({ ...agent });
    }
    setExpanded(!expanded);
    setShowEmojiPicker(false);
  };

  const handleSave = () => {
    onUpdate(draft);
    setExpanded(false);
  };

  const handleCancel = () => {
    setDraft({ ...agent });
    setExpanded(false);
    setShowEmojiPicker(false);
  };

  const providerPool = globalApiKeys[agent.providerId || 'google'] || [];

  // Resolve which key is used for display
  const resolvedKeyLabel = agent.apiKey
    ? `Свой ${getApiKeySuffix(agent.apiKey)}`
    : (providerPool.length > 0 ? `Пул ${getApiKeySuffix(providerPool[0]?.key)}` : 'Нет ключа');

  if (!expanded) {
    return (
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left transition-all hover:border-[var(--border-strong)] group"
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg border"
          style={{
            borderColor: agent.color + '40',
            background: agent.color + '15',
          }}
        >
          {agent.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{agent.name}</p>
          <p className="text-[10px] text-[var(--text-dim)] font-mono truncate">
            {agent.model ? agent.model.replace('models/', '') : 'модель не выбрана'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full transition-colors ${agent.isActive ? 'bg-emerald-400' : 'bg-[var(--surface-4)]'}`}
            title={agent.isActive ? 'Активен' : 'Неактивен'}
          />
        </div>
      </button>
    );
  }

  // Expanded editor
  return (
    <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <button onClick={handleCancel} className="flex items-center gap-1 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
          <ChevronLeft size={12} />
          {draft.name}
        </button>
        <button onClick={handleCancel} className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors">
          <X size={12} />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Name */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5 block">Имя</label>
          <input
            type="text"
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none"
          />
        </div>

        {/* Emoji + Color row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5 block">Эмодзи</label>
            <div className="relative">
              <button
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-lg hover:border-[var(--border-strong)] transition-colors w-full"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {draft.emoji}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-1 z-20 p-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] shadow-2xl grid grid-cols-8 gap-1">
                  {AGENT_EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => { setDraft({ ...draft, emoji: e }); setShowEmojiPicker(false); }}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-white/10 transition-colors ${draft.emoji === e ? 'bg-white/15 ring-1 ring-white/20' : ''}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5 block">Цвет</label>
            <div className="flex flex-wrap gap-1.5">
              {AGENT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${draft.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Provider */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5 block">Провайдер</label>
          <select
            value={draft.providerId || 'google'}
            onChange={e => setDraft({ ...draft, providerId: e.target.value, model: '', apiKey: '' })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
          >
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Model */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5 block">Модель</label>
          <select
            value={draft.model}
            onChange={e => setDraft({ ...draft, model: e.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
          >
            <option value="">— Выберите модель —</option>
            {models.filter(m => m.providerId === (draft.providerId || 'google')).map(m => (
              <option key={m.id} value={m.id}>
                {m.displayName || m.id.replace('models/', '')}
              </option>
            ))}
          </select>
        </div>

        {/* API Key — dropdown from global pool + custom */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5 block">API ключ</label>
          <select
            value={draft.apiKey}
            onChange={e => setDraft({ ...draft, apiKey: e.target.value })}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
          >
            <option value="">
              {(globalApiKeys[draft.providerId || 'google'] || []).find(k => k.key) ? 'Из пула провайдера' : 'Нет ключей для провайдера'}
            </option>
            {/* Global pool keys for this provider */}
            {(globalApiKeys[draft.providerId || 'google'] || []).filter(k => k.key).map((k, i) => (
              <option key={`global-${i}`} value={k.key}>
                🔑 Ключ {i + 1} — {getApiKeySuffix(k.key)}{k.label ? ` (${k.label})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[9px] text-[var(--text-dim)]">
            По умолчанию используется ключ из пула провайдера
          </p>
        </div>

        {/* System Prompt */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5 block">Системный промпт</label>
          <textarea
            value={draft.systemPrompt}
            onChange={e => setDraft({ ...draft, systemPrompt: e.target.value })}
            placeholder="Опишите роль и поведение агента..."
            rows={4}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none resize-y"
            style={{ minHeight: '80px', maxHeight: '200px' }}
          />
        </div>

        {/* Temperature */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Temperature</label>
            <span className="text-xs font-mono text-[var(--text-primary)]">{draft.temperature.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={draft.temperature}
            onChange={e => setDraft({ ...draft, temperature: parseFloat(e.target.value) })}
            className="w-full h-1 rounded-full appearance-none bg-[var(--surface-4)] accent-white cursor-pointer"
          />
        </div>

        {/* Max Tokens */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Max Tokens</label>
            <span className="text-xs font-mono text-[var(--text-primary)]">{draft.maxOutputTokens}</span>
          </div>
          <input
            type="range"
            min="256"
            max="16384"
            step="256"
            value={draft.maxOutputTokens}
            onChange={e => setDraft({ ...draft, maxOutputTokens: parseInt(e.target.value) })}
            className="w-full h-1 rounded-full appearance-none bg-[var(--surface-4)] accent-white cursor-pointer"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">Активен</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={e => setDraft({ ...draft, isActive: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[var(--surface-4)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>

        {/* DeepThink toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={13} className="text-purple-400/70" />
            <span className="text-xs text-[var(--text-muted)]">DeepThink</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={draft.deepThinkEnabled}
              onChange={e => setDraft({ ...draft, deepThinkEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[var(--surface-4)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          <button
            onClick={onRemove}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/15"
          >
            <Trash2 size={11} />
            Удалить
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ArenaAgentsSidebar({
  session,
  models,
  providers,
  globalApiKeys,
  savedChats,
  onUpdateAgent,
  onAddAgent,
  onRemoveAgent,
  responseMode,
  onToggleMode,
  onImportChat,
  onUpdateSessionPrompt,
  onOpenSettings,
  onClose,
}: ArenaAgentsSidebarProps) {
  const [showImportDropdown, setShowImportDropdown] = useState(false);

  return (
    <aside className="flex h-full w-full min-w-0 flex-col bg-[linear-gradient(180deg,rgba(16,16,16,0.98),rgba(7,7,7,0.98))] backdrop-blur-xl border-l border-[var(--border)]">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] px-5 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[20px] border border-amber-400/30 bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] shadow-[0_16px_36px_rgba(245,158,11,0.15)]">
              <Zap size={18} className="text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Arena</p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-400/70">Multi-Agent</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] transition-all hover:text-[var(--text-primary)] md:hidden"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {session && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-[var(--text-muted)]">
              {session.agents.filter(a => a.isActive).length} акт. из {session.agents.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onAddAgent}
                className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-white transition-colors"
              >
                <Plus size={12} />
                Агент
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!session ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-1)] px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-amber-400">
                <Zap size={18} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Нет активной сессии</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                Создайте новую Arena-сессию в левой панели.
              </p>
            </div>

            {/* Import from chats — always visible */}
            {savedChats.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowImportDropdown(!showImportDropdown)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-1)] px-4 py-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
                >
                  <Download size={13} />
                  Импорт из чата
                  <ChevronDown size={11} className={`transition-transform ${showImportDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showImportDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] shadow-2xl max-h-48 overflow-y-auto">
                    {savedChats.filter(c => c.messages.length > 0).map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => {
                          onImportChat(chat);
                          setShowImportDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-colors truncate"
                      >
                        💬 {chat.title} <span className="text-[var(--text-dim)]">({chat.messages.length} сообщ.)</span>
                      </button>
                    ))}
                 </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {session.agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                models={models}
                providers={providers}
                globalApiKeys={globalApiKeys}
                onUpdate={onUpdateAgent}
                onRemove={() => onRemoveAgent(agent.id)}
              />
            ))}

            {/* Import from chats — inside session */}
            {savedChats.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowImportDropdown(!showImportDropdown)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-1)] px-3 py-2.5 text-[10px] text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:border-[var(--border-strong)] transition-all"
                >
                  <Download size={11} />
                  Импорт чата в эту арену
                  <ChevronDown size={10} className={`transition-transform ${showImportDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showImportDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] shadow-2xl max-h-48 overflow-y-auto">
                    {savedChats.filter(c => c.messages.length > 0).map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => {
                          onImportChat(chat);
                          setShowImportDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)] transition-colors truncate"
                      >
                        💬 {chat.title} <span className="text-[var(--text-dim)]">({chat.messages.length})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {session && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-4 space-y-4">
          {/* Global System Prompt */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)] mb-1.5 block">Правила Арены (System Prompt)</label>
            <textarea
              value={session.systemPrompt || ''}
              onChange={e => onUpdateSessionPrompt(e.target.value)}
              placeholder="Общие правила для всех участников (напр. без воды, только код)..."
              rows={2}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none resize-y transition-colors"
              style={{ minHeight: '60px', maxHeight: '200px' }}
            />
          </div>

          {/* Response mode */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Режим ответа</span>
            <div className="flex bg-[var(--surface-3)] p-0.5 rounded-lg">
              <button
                onClick={() => { if (responseMode !== 'auto') onToggleMode(); }}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  responseMode === 'auto'
                    ? 'bg-amber-400/15 text-amber-400'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                }`}
              >
                Авто
              </button>
              <button
                onClick={() => { if (responseMode !== 'manual') onToggleMode(); }}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                  responseMode === 'manual'
                    ? 'bg-[var(--surface-4)] text-[var(--text-primary)]'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                }`}
              >
                Ручной
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
