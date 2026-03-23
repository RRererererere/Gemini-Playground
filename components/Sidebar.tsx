'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertCircle,
  BookOpen,
  Brain,
  ChevronDown,
  Clock,
  Copy,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FileStack,
  FolderOpen,
  Hash,
  Key,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Star,
  Thermometer,
  Trash2,
  Unlock,
  Upload,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ChatTool, GeminiModel, ApiKeyEntry, SavedChat, SavedSystemPrompt } from '@/types';
import { addApiKey, removeApiKey, getKeyStatus, timeUntilUnblock, unblockKey } from '@/lib/apiKeyManager';
import {
  exportAllSettings,
  exportChats,
  exportSingleChat,
  importAllSettings,
  importChatsFromFile,
  importFromGoogleStudio,
  loadDeepThinkSystemPrompt,
  loadSystemPrompts,
  saveDeepThinkSystemPrompt,
  saveSystemPrompts,
  createSystemPrompt,
  cloneSystemPrompt,
} from '@/lib/storage';
import { DEFAULT_DEEPTHINK_SYSTEM_PROMPT, formatToolPayload } from '@/lib/gemini';
import { ToolBuilderModal } from '@/components/ToolBuilder';
import { getInstalledSkills, setSkillEnabled, getSkillById } from '@/lib/skills';

// Skills Section Component
function SkillsSection({ onSkillsChanged }: { onSkillsChanged?: () => void }) {
  const [installedRecords, setInstalledRecords] = useState<ReturnType<typeof getInstalledSkills>>([]);
  
  useEffect(() => {
    setInstalledRecords(getInstalledSkills());
  }, []);
  
  const handleToggle = (skillId: string) => {
    const record = installedRecords.find(r => r.id === skillId);
    if (record) {
      setSkillEnabled(skillId, !record.enabled);
      setInstalledRecords(getInstalledSkills());
      onSkillsChanged?.();
    }
  };

  if (installedRecords.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Встроенные</span>
        <span className="text-[10px] text-[var(--text-muted)]">{installedRecords.filter(r => r.enabled).length}/{installedRecords.length}</span>
      </div>
      {installedRecords.map(record => {
        const skill = getSkillById(record.id);
        if (!skill) return null;
        
        return (
          <div
            key={record.id}
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">{skill.name}</p>
              <p className="mt-0.5 text-xs text-[var(--text-dim)]">{skill.description}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3">
              <input
                type="checkbox"
                checked={record.enabled}
                onChange={() => handleToggle(record.id)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--surface-4)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        );
      })}
    </div>
  );
}

export interface SidebarSharedProps {
  apiKeys: ApiKeyEntry[];
  onApiKeysChange: (keys: ApiKeyEntry[]) => void;
  activeKeyIndex: number;
  onActiveKeyIndexChange: (idx: number) => void;
  model: string;
  onModelChange: (model: string) => void;
  models: GeminiModel[];
  onModelsLoad: (models: GeminiModel[]) => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  tools: ChatTool[];
  onToolsChange: (tools: ChatTool[]) => void;
  onOpenToolBuilder?: (tool?: ChatTool) => void;
  onOpenSavePromptDialog?: () => void;
  onOpenDeepThinkDialog?: () => void;
  onOpenMemoryModal?: () => void;
  onOpenSkillsMarket?: () => void;
  onOpenHFSpaces?: () => void;
  deepThinkSystemPrompt: string;
  onDeepThinkSystemPromptChange: (prompt: string) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  thinkingBudget: number;
  onThinkingBudgetChange: (v: number) => void;
  tokenCount: number;
  isCountingTokens: boolean;
  isStreaming: boolean;
  savedChats: SavedChat[];
  onSavedChatsChange: (chats: SavedChat[]) => void;
  currentChatId: string | null;
  onLoadChat: (chat: SavedChat) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  memoryEnabled: boolean;
  onMemoryEnabledChange: (enabled: boolean) => void;
  onSkillsChanged?: () => void;
  onClose?: () => void;
}

type SettingsSectionId = 'keys' | 'model' | 'system' | 'tools' | 'manage';

function AppBadge() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[20px] border border-[var(--border)] bg-[linear-gradient(135deg,#ffffff,#cfcfcf)] shadow-[0_16px_36px_rgba(255,255,255,0.12)]">
        <Sparkles size={18} className="text-black" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">Gemini Studio</p>
        <p className="text-[10px] uppercase tracking-[0.28em] text-[var(--text-dim)]">Workspace</p>
      </div>
    </div>
  );
}

function SidebarShell({
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  onClose,
  borderClassName,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  borderClassName: string;
}) {
  return (
    <aside className={`flex h-full w-full min-w-0 flex-col bg-[linear-gradient(180deg,rgba(16,16,16,0.98),rgba(7,7,7,0.98))] backdrop-blur-xl ${borderClassName}`}>
      <div className="border-b border-[var(--border-subtle)] px-5 py-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <AppBadge />
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] transition-all hover:text-[var(--text-primary)] md:hidden"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="px-1 py-2">
          <div className="mb-1.5 flex items-center gap-2 text-[var(--text-primary)]">
            <Icon size={16} className="text-white/85" />
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">{subtitle}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1">{children}</div>
      {footer && <div className="border-t border-[var(--border-subtle)]">{footer}</div>}
    </aside>
  );
}

function SettingsSectionHeader({
  id,
  label,
  icon: Icon,
  openSections,
  onToggle,
}: {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  openSections: Set<SettingsSectionId>;
  onToggle: (id: SettingsSectionId) => void;
}) {
  const isOpen = openSections.has(id);

  return (
    <button onClick={() => onToggle(id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
          <Icon size={14} className="text-[var(--text-muted)]" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">{label}</span>
      </div>
      <ChevronDown size={14} className={`text-[var(--text-dim)] transition-transform duration-300 ${isOpen ? '' : '-rotate-90'}`} />
    </button>
  );
}

export function ChatSidebar({
  savedChats,
  currentChatId,
  onLoadChat,
  onNewChat,
  onDeleteChat,
  onClose,
}: Pick<SidebarSharedProps, 'savedChats' | 'currentChatId' | 'onLoadChat' | 'onNewChat' | 'onDeleteChat' | 'onClose'>) {
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <SidebarShell
      title="Чаты"
      subtitle="История диалогов и быстрый переход между ветками разговора."
      icon={MessageSquare}
      onClose={onClose}
      borderClassName="border-r border-[var(--border)]"
      footer={
        <div className="px-5 py-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)]">Локально</span>
              <span className="text-xs font-mono text-[var(--text-primary)]">{savedChats.length}</span>
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              Все сохранённые диалоги остаются под рукой и не смешиваются с настройками.
            </p>
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-5 pt-5">
          <button
            onClick={() => {
              onNewChat();
              onClose?.();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-[0.99]"
          >
            <Plus size={16} />
            Новый чат
          </button>
        </div>

        <div className="px-5 pb-3 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">История</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {savedChats.length > 0 ? `${savedChats.length} сохранённых диалогов` : 'Пока пусто'}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {savedChats.length === 0 ? (
            <div className="mx-2 rounded-[24px] border border-dashed border-[var(--border)] bg-[var(--surface-1)] px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--text-muted)]">
                <MessageSquare size={18} />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Нет сохранённых чатов</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                Начните новый диалог, и он появится здесь отдельной карточкой.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedChats.map(chat => {
                const isActive = chat.id === currentChatId;

                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      onLoadChat(chat);
                      onClose?.();
                    }}
                    className={`group flex w-full items-start gap-3 rounded-[22px] border px-4 py-3 cursor-pointer transition-all ${
                      isActive
                        ? 'border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] shadow-[0_18px_40px_rgba(0,0,0,0.26)]'
                        : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <div className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${isActive ? 'bg-white shadow-[0_0_14px_rgba(255,255,255,0.45)]' : 'bg-[var(--surface-4)]'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{chat.title}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-dim)]">
                        {chat.messages.length} сообщ. • {formatDate(chat.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={event => {
                          event.stopPropagation();
                          onDeleteChat(chat.id);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:bg-red-500/10 hover:text-[var(--gem-red)]"
                        title="Удалить чат"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SidebarShell>
  );
}

export function SettingsSidebar({
  apiKeys,
  onApiKeysChange,
  activeKeyIndex,
  onActiveKeyIndexChange,
  model,
  onModelChange,
  models,
  onModelsLoad,
  systemPrompt,
  onSystemPromptChange,
  tools,
  onToolsChange,
  onOpenToolBuilder,
  onOpenSavePromptDialog,
  onOpenDeepThinkDialog,
  onOpenMemoryModal,
  onOpenSkillsMarket,
  onOpenHFSpaces,
  deepThinkSystemPrompt,
  onDeepThinkSystemPromptChange,
  temperature,
  onTemperatureChange,
  thinkingBudget,
  onThinkingBudgetChange,
  tokenCount,
  isCountingTokens,
  isStreaming,
  savedChats,
  onSavedChatsChange,
  onLoadChat,
  memoryEnabled,
  onMemoryEnabledChange,
  onSkillsChanged,
  onClose,
}: SidebarSharedProps) {
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<SettingsSectionId>>(new Set<SettingsSectionId>(['keys', 'model', 'system', 'tools', 'manage']));

  const [newKeyInput, setNewKeyInput] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});

  const [savedPrompts, setSavedPrompts] = useState<SavedSystemPrompt[]>([]);
  const [promptDropdownOpen, setPromptDropdownOpen] = useState(false);
  const activeKeyEntry = apiKeys[activeKeyIndex];
  const activeKeySuffix = activeKeyEntry?.key ? activeKeyEntry.key.slice(-4) : '';

  const importRef = useRef<HTMLInputElement>(null);
  const importGsRef = useRef<HTMLInputElement>(null);
  const importBackupRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');

  const loadModels = useCallback(async (key: string) => {
    if (!key.trim()) return;

    setLoadingModels(true);
    setModelError('');

    try {
      const res = await fetch(`/api/models?apiKey=${encodeURIComponent(key)}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setModelError(data.error || 'Не удалось загрузить модели');
        onModelsLoad([]);
        return;
      }

      onModelsLoad(data.models || []);

      if (!model && data.models?.length > 0) {
        const preferred =
          data.models.find((item: GeminiModel) => item.name.includes('gemini-2.5-flash') && !item.name.includes('lite') && !item.name.includes('audio')) ||
          data.models.find((item: GeminiModel) => item.name.includes('gemini-2.0-flash') && !item.name.includes('lite')) ||
          data.models[0];

        if (preferred) onModelChange(preferred.name);
      }
    } catch {
      setModelError('Ошибка сети');
    } finally {
      setLoadingModels(false);
    }
  }, [model, onModelChange, onModelsLoad]);

  useEffect(() => {
    setSavedPrompts(loadSystemPrompts());
  }, []);

  useEffect(() => {
    if (!activeKeyEntry?.key) return;

    const timer = setTimeout(() => {
      loadModels(activeKeyEntry.key);
    }, 250);

    return () => clearTimeout(timer);
  }, [activeKeyEntry?.key, loadModels]);

  const savePrompts = (prompts: SavedSystemPrompt[]) => {
    setSavedPrompts(prompts);
    saveSystemPrompts(prompts);
  };

  const deleteTool = (toolId: string) => {
    onToolsChange(tools.filter(tool => tool.id !== toolId));
  };

  const toggleSection = (sectionId: SettingsSectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const addKey = () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) return;

    const updated = addApiKey(apiKeys, trimmed);
    onApiKeysChange(updated);
    onActiveKeyIndexChange(updated.length - 1);
    setNewKeyInput('');
    setShowNewKey(false);
  };

  const deleteKey = (key: string) => {
    const updated = removeApiKey(apiKeys, key);
    onApiKeysChange(updated);
    if (activeKeyIndex >= updated.length) onActiveKeyIndexChange(Math.max(updated.length - 1, 0));
  };

  const selectKey = (idx: number) => {
    onActiveKeyIndexChange(idx);
    if (apiKeys[idx]?.key) {
      loadModels(apiKeys[idx].key);
    }
  };

  const formatTokenCount = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const selectedModel = models.find(item => item.name === model);
  const modelDisplayName = selectedModel?.displayName || model || 'Выбрать модель';
  const tempLabel = temperature < 0.4 ? 'Точно' : temperature < 0.8 ? 'Баланс' : temperature < 1.4 ? 'Творчески' : 'Хаос';
  const tempColor = temperature < 0.4 ? '#2dd4bf' : temperature < 0.8 ? '#4ade80' : temperature < 1.4 ? '#f59e0b' : '#ef4444';
  const thinkingLabel = thinkingBudget === 0 ? 'Выкл' : thinkingBudget === -1 ? 'Авто' : `${thinkingBudget} токенов`;

  const handleImportChats = async (file: File) => {
    setImportError('');

    try {
      const imported = await importChatsFromFile(file);
      const merged = [...savedChats];
      for (const chat of imported) {
        if (!merged.find(item => item.id === chat.id)) merged.unshift(chat);
      }
      onSavedChatsChange(merged);
    } catch (error: any) {
      setImportError(error.message);
    }
  };

  const handleImportGoogleStudio = async (file: File) => {
    setImportError('');

    try {
      const result = await importFromGoogleStudio(file);
      const chat: SavedChat = {
        id: result.id!,
        title: result.title!,
        messages: result.messages!,
        model: result.model || model,
        systemPrompt: result.systemPrompt || '',
        tools: [],
        temperature: result.temperature ?? temperature,
        createdAt: result.createdAt!,
        updatedAt: result.updatedAt!,
      };

      const merged = [chat, ...savedChats];
      onSavedChatsChange(merged);
      onLoadChat(chat);
      onClose?.();
    } catch (error: any) {
      setImportError(error.message);
    }
  };

  return (
    <SidebarShell
      title="Настройки"
      subtitle="Ключи, модели, системный промпт и резервные копии вынесены в отдельную правую зону."
      icon={SlidersHorizontal}
      onClose={onClose}
      borderClassName="border-l border-[var(--border)]"
      footer={
        <div className="px-5 py-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-0)] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-dim)]">
                <Hash size={11} />
                <span className="text-[10px] uppercase tracking-[0.16em]">Контекст</span>
              </div>
              <div className="flex items-center gap-2">
                {isStreaming && <span className="h-1.5 w-1.5 rounded-full bg-[var(--gem-green)] animate-pulse" />}
                {isCountingTokens && <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-dim)] animate-pulse" />}
                <span className={`text-sm font-mono font-medium ${tokenCount > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-dim)]'}`}>
                  {formatTokenCount(tokenCount)}
                </span>
              </div>
            </div>

            {selectedModel?.inputTokenLimit && tokenCount > 0 && (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((tokenCount / selectedModel.inputTokenLimit) * 100, 100)}%`,
                      background:
                        tokenCount / selectedModel.inputTokenLimit > 0.8
                          ? '#ef4444'
                          : tokenCount / selectedModel.inputTokenLimit > 0.5
                            ? '#f59e0b'
                            : '#ffffff',
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-dim)]">
                  {((tokenCount / selectedModel.inputTokenLimit) * 100).toFixed(1)}% из {formatTokenCount(selectedModel.inputTokenLimit)}
                </p>
              </div>
            )}
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-3">
            <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-1)]">
              <SettingsSectionHeader id="keys" label="API Ключи" icon={Key} openSections={openSections} onToggle={toggleSection} />
              {openSections.has('keys') && (
                <div className="space-y-3 px-4 pb-4">
                  {apiKeys.map((entry, idx) => {
                    const status = getKeyStatus(entry, model);
                    const isActive = idx === activeKeyIndex;

                    return (
                      <button
                        key={`${entry.key}-${idx}`}
                        onClick={() => selectKey(idx)}
                        className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                          isActive
                            ? 'border-emerald-400/25 bg-emerald-400/10'
                            : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                          isActive ? 'bg-emerald-300' : 'bg-[var(--surface-4)]'
                        }`} />

                        <div className="min-w-0 flex-1">
                          {entry.label && <p className="mb-0.5 text-[10px] text-[var(--text-muted)]">{entry.label}</p>}
                          <p className="truncate font-mono text-xs text-[var(--text-dim)]">
                            {showKeys[idx] ? entry.key : `${entry.key.slice(0, 8)}••••••••${entry.key.slice(-4)}`}
                          </p>
                          {status !== 'active' && (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--gem-red)]">
                              <Clock size={8} />
                              Разблокируется через {timeUntilUnblock(entry, model)}
                            </p>
                          )}
                          <p className={`mt-1 text-[10px] ${isActive ? 'text-emerald-200/85' : 'text-[var(--text-muted)]'}`}>
                            {isActive ? 'Используется сейчас' : `Нажмите, чтобы использовать ••••${entry.key.slice(-4)}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {status !== 'active' && (
                            <button
                              onClick={event => {
                                event.stopPropagation();
                                const updated = unblockKey(apiKeys, idx, model);
                                onApiKeysChange(updated);
                              }}
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
                              title="Разблокировать ключ"
                            >
                              <Unlock size={12} />
                            </button>
                          )}
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              setShowKeys(prev => ({ ...prev, [idx]: !prev[idx] }));
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
                            title="Показать ключ"
                          >
                            {showKeys[idx] ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              deleteKey(entry.key);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:text-[var(--gem-red)]"
                            title="Удалить ключ"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </button>
                    );
                  })}

                  {showNewKey ? (
                    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                      <input
                        type="text"
                        value={newKeyInput}
                        onChange={event => setNewKeyInput(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Enter') addKey();
                          if (event.key === 'Escape') {
                            setShowNewKey(false);
                            setNewKeyInput('');
                          }
                        }}
                        placeholder="AIza..."
                        autoFocus
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
                      />
                      <div className="flex gap-2">
                        <button onClick={addKey} disabled={!newKeyInput.trim()} className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition-opacity disabled:opacity-40">
                          Добавить
                        </button>
                        <button
                          onClick={() => {
                            setShowNewKey(false);
                            setNewKeyInput('');
                          }}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewKey(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--text-muted)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                    >
                      <Plus size={13} />
                      Добавить API ключ
                    </button>
                  )}

                  {apiKeys.length === 0 && (
                    <p className="text-xs leading-relaxed text-[var(--text-dim)]">
                      Ключи можно получить на{' '}
                      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--gem-blue)] hover:underline">
                        Google AI Studio
                      </a>
                      .
                    </p>
                  )}

                  {apiKeys.length > 0 && activeKeySuffix && (
                    <p className="text-[11px] text-[var(--text-dim)]">
                      Активный ключ: <span className="font-mono text-emerald-200/90">••••{activeKeySuffix}</span>
                    </p>
                  )}

                  {modelError && (
                    <p className="flex items-center gap-2 text-xs text-[var(--gem-red)]">
                      <AlertCircle size={12} />
                      {modelError}
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-1)]">
              <SettingsSectionHeader id="model" label="Модель" icon={Cpu} openSections={openSections} onToggle={toggleSection} />
              {openSections.has('model') && (
                <div className="space-y-4 px-4 pb-4">
                  <div className="relative">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Выбранная модель</span>
                      {apiKeys.length > 0 && (
                        <button
                          onClick={() => {
                            if (activeKeyEntry?.key) loadModels(activeKeyEntry.key);
                          }}
                          disabled={loadingModels}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
                          title="Обновить модели"
                        >
                          <RefreshCw size={12} className={loadingModels ? 'animate-spin' : ''} />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setModelDropdownOpen(prev => !prev)}
                      disabled={models.length === 0}
                      className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left transition-colors hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={`${model ? 'text-[var(--text-primary)]' : 'text-[var(--text-dim)]'} truncate text-sm`}>
                        {loadingModels ? 'Загрузка...' : modelDisplayName.replace('Gemini ', '').replace(' (Preview)', '').trim()}
                      </span>
                      <ChevronDown size={14} className={`ml-2 flex-shrink-0 text-[var(--text-dim)] transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {modelDropdownOpen && models.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-2 shadow-2xl">
                        {models.map(item => {
                          const isSelected = item.name === model;
                          const isNew = item.name.includes('3') || item.name.includes('2.5');
                          const modelId = item.name.split('/')[1];

                          return (
                            <button
                              key={item.name}
                              onClick={() => {
                                onModelChange(item.name);
                                setModelDropdownOpen(false);
                              }}
                              className={`mb-1 flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors last:mb-0 ${
                                isSelected ? 'bg-white/10 text-white' : 'text-[var(--text-primary)] hover:bg-white/[0.06]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[13px] font-medium">{item.displayName || modelId}</span>
                                {isNew && <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-black">New</span>}
                              </div>
                              <span className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-dim)]">{modelId}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedModel && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-dim)]">
                      {selectedModel.inputTokenLimit && <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1">In: {formatTokenCount(selectedModel.inputTokenLimit)}</span>}
                      {selectedModel.outputTokenLimit && <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1">Out: {formatTokenCount(selectedModel.outputTokenLimit)}</span>}
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[var(--text-dim)]">
                        <Thermometer size={12} />
                        <span className="text-[10px] uppercase tracking-[0.16em]">Температура</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono" style={{ color: tempColor }}>{tempLabel}</span>
                        <span className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs font-mono text-[var(--text-primary)]">{temperature.toFixed(1)}</span>
                      </div>
                    </div>
                    <input type="range" min="0" max="2" step="0.05" value={temperature} onChange={event => onTemperatureChange(parseFloat(event.target.value))} />
                    <div className="mt-1 flex justify-between text-[9px] text-[var(--text-dim)]">
                      <span>0 — Точно</span>
                      <span>2 — Хаос</span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[var(--text-dim)]">
                        <Brain size={12} />
                        <span className="text-[10px] uppercase tracking-[0.16em]">Размышления</span>
                      </div>
                      <span className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-primary)]">{thinkingLabel}</span>
                    </div>

                    <div className="mb-2 grid grid-cols-4 gap-1.5">
                      {[
                        { label: 'Выкл', value: 0 },
                        { label: 'Авто', value: -1 },
                        { label: 'Мало', value: 512 },
                        { label: 'Много', value: 8192 },
                      ].map(option => (
                        <button
                          key={option.label}
                          onClick={() => onThinkingBudgetChange(option.value)}
                          className={`rounded-xl border px-2 py-2 text-[10px] transition-all ${
                            thinkingBudget === option.value ? 'border-white bg-white text-black' : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {thinkingBudget > 0 && (
                      <input type="range" min="128" max="32768" step="128" value={thinkingBudget} onChange={event => onThinkingBudgetChange(parseInt(event.target.value, 10))} />
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-1)]">
              <SettingsSectionHeader id="tools" label="Инструменты" icon={Wrench} openSections={openSections} onToggle={toggleSection} />
              {openSections.has('tools') && (
                <div className="space-y-3 px-4 pb-4">
                  {/* Память */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Brain size={13} className="text-[var(--text-muted)]" />
                        <span className="text-xs font-medium text-[var(--text-primary)]">Память</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memoryEnabled}
                          onChange={e => onMemoryEnabledChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-[var(--surface-4)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                      </label>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mb-2">
                      Модель запоминает факты о вас и использует их в будущих разговорах
                    </p>
                    {memoryEnabled && (
                      <button
                        onClick={() => onOpenMemoryModal?.()}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-all"
                      >
                        <Brain size={12} />
                        Управление памятью
                      </button>
                    )}
                  </div>

                  {/* Skills - встроенные инструменты */}
                  <SkillsSection onSkillsChanged={onSkillsChanged} />

                  <div className="flex gap-2">
                    <button
                      onClick={() => onOpenSkillsMarket?.()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--text-muted)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                    >
                      <Plus size={13} />
                      Скиллы
                    </button>
                    <button
                      onClick={() => onOpenHFSpaces?.()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--text-muted)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                    >
                      🤗 HF Spaces
                    </button>
                  </div>

                  {tools.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-5 py-6 text-center">
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-3)] text-[var(--text-muted)]">
                        <Wrench size={16} />
                      </div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">Нет пользовательских инструментов</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                        Создайте функции, которые модель сможет вызывать
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tools.map(tool => (
                        <div
                          key={tool.id}
                          className="group flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 transition-all hover:border-[var(--border-strong)]"
                        >
                          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-3)]">
                            <Wrench size={12} className="text-[var(--text-muted)]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{tool.name || 'Без имени'}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-dim)]">
                              {tool.description || 'Нет описания'}
                            </p>
                            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                              {tool.parameters.length} параметр{tool.parameters.length === 1 ? '' : tool.parameters.length < 5 ? 'а' : 'ов'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => onOpenToolBuilder?.(tool)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
                              title="Редактировать"
                            >
                              <SlidersHorizontal size={11} />
                            </button>
                            <button
                              onClick={() => deleteTool(tool.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:text-[var(--gem-red)]"
                              title="Удалить"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => onOpenToolBuilder?.()}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--text-muted)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  >
                    <Plus size={13} />
                    Создать инструмент
                  </button>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-1)]">
              <SettingsSectionHeader id="system" label="Система" icon={BookOpen} openSections={openSections} onToggle={toggleSection} />
              {openSections.has('system') && (
                <div className="space-y-3 px-4 pb-4">
                  <div className="relative">
                    <button
                      onClick={() => setPromptDropdownOpen(prev => !prev)}
                      className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                    >
                      <span className="flex items-center gap-2">
                        <Star size={11} />
                        {savedPrompts.length > 0 ? `Сохранённые (${savedPrompts.length})` : 'Нет сохранённых'}
                      </span>
                      <ChevronDown size={12} className={`transition-transform ${promptDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {promptDropdownOpen && (
                      <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] shadow-2xl">
                        {savedPrompts.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-[var(--text-dim)]">Нет сохранённых промптов</p>
                        ) : (
                          <div className="max-h-56 overflow-y-auto p-2">
                            {savedPrompts.map(prompt => (
                              <div key={prompt.id} className="group mb-1 flex items-center rounded-xl last:mb-0 hover:bg-white/[0.05]">
                                <button
                                  onClick={() => {
                                    onSystemPromptChange(prompt.content);
                                    setPromptDropdownOpen(false);
                                  }}
                                  className="flex-1 truncate px-3 py-2.5 text-left text-[13px] text-[var(--text-primary)]"
                                >
                                  {prompt.name}
                                </button>
                                <div className="flex items-center gap-0.5 px-2 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    onClick={() => {
                                      const cloned = cloneSystemPrompt(prompt);
                                      savePrompts([...savedPrompts, cloned]);
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
                                    title="Клонировать"
                                  >
                                    <Copy size={11} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      savePrompts(savedPrompts.filter(item => item.id !== prompt.id));
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:text-[var(--gem-red)]"
                                    title="Удалить"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <textarea
                    value={systemPrompt}
                    onChange={event => onSystemPromptChange(event.target.value)}
                    placeholder="Вы — полезный ассистент..."
                    rows={5}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
                    style={{ minHeight: '140px', maxHeight: '260px', resize: 'vertical' }}
                  />

                  {systemPrompt.trim() && (
                    <button
                      onClick={() => onOpenSavePromptDialog?.()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--text-dim)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                    >
                      <Save size={12} />
                      Сохранить промпт
                    </button>
                  )}

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">DeepThink промпт</span>
                      <button
                        onClick={() => onOpenDeepThinkDialog?.()}
                        className="flex h-7 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[10px] text-[var(--text-dim)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                      >
                        <SlidersHorizontal size={10} />
                        Редактировать
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                      Системный промпт для анализа DeepThink
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-1)]">
              <SettingsSectionHeader id="manage" label="Данные" icon={FileStack} openSections={openSections} onToggle={toggleSection} />
              {openSections.has('manage') && (
                <div className="space-y-3 px-4 pb-4">
                  {importError && (
                    <p className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-[var(--gem-red)]">
                      <AlertCircle size={12} />
                      {importError}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={exportAllSettings} className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                      <Download size={12} />
                      Бэкап
                    </button>
                    <button onClick={() => importBackupRef.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                      <Upload size={12} />
                      Восстановить
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {savedChats.length > 0 && (
                      <button onClick={() => exportChats(savedChats)} className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                        <Download size={12} />
                        Экспорт чатов
                      </button>
                    )}

                    <button onClick={() => importRef.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]">
                      <Upload size={12} />
                      Импорт JSON
                    </button>

                    <button onClick={() => importGsRef.current?.click()} className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--gem-blue)] transition-colors hover:bg-white/[0.04]">
                      <FolderOpen size={12} />
                      Импорт AI Studio
                    </button>

                    {savedChats.length > 0 && (
                      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Быстрый экспорт</p>
                          <span className="text-[10px] text-[var(--text-muted)]">{savedChats.length} чатов</span>
                        </div>
                        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                          {savedChats.slice(0, 6).map(chat => (
                            <button
                              key={chat.id}
                              onClick={() => exportSingleChat(chat)}
                              className="flex w-full items-center justify-between rounded-xl bg-[var(--surface-3)] px-3 py-2 text-left text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                            >
                              <span className="truncate">{chat.title}</span>
                              <Download size={11} className="flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    ref={importRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={event => {
                      if (event.target.files?.[0]) {
                        handleImportChats(event.target.files[0]);
                        event.target.value = '';
                      }
                    }}
                  />
                  <input
                    ref={importGsRef}
                    type="file"
                    accept=".json,*"
                    className="hidden"
                    onChange={event => {
                      if (event.target.files?.[0]) {
                        handleImportGoogleStudio(event.target.files[0]);
                        event.target.value = '';
                      }
                    }}
                  />
                  <input
                    ref={importBackupRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={event => {
                      if (event.target.files?.[0]) {
                        const approved = confirm('Внимание! Импорт перезапишет текущие настройки, API-ключи, системные промпты и чаты. Продолжить?');
                        if (approved) {
                          importAllSettings(event.target.files[0]).catch(err => alert(err.message));
                        }
                        event.target.value = '';
                      }
                    }}
                  />
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

    </SidebarShell>
  );
}
