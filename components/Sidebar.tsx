'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  AlertCircle,
  BookOpen,
  Brain,
  ChevronDown,
  Clock,
  Copy,
  Cpu,
  Download,
  Edit2,
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
  Volume2,
  Wrench,
  X,
  Zap,
  type LucideIcon,
  } from 'lucide-react';
  import type { ChatTool, GeminiModel, ApiKeyEntry, SavedChat, SavedSystemPrompt, Provider, UniversalModel, ActiveModel } from '@/types';
  import { AgentGraph } from '@/lib/agent-engine/types';
  import { getGraphs, GRAPHS_UPDATED_EVENT } from '@/lib/agent-engine/graph-storage';
import { addApiKey, removeApiKey, getKeyStatus, timeUntilUnblock, unblockKey } from '@/lib/apiKeyManager';
import { loadProviders, saveCustomProvider, removeProvider, loadModelsCache, saveModelsCache, clearModelsCache } from '@/lib/providerStorage';
import { ProviderModal } from './AddProviderModal';
import { getAgents, deleteAgent, AGENTS_UPDATED_EVENT } from '@/lib/agents/agent-store';
import type { Agent } from '@/lib/agents/types';
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
  // Multi-provider support
  providers: Provider[];
  onProvidersChange: (providers: Provider[]) => void;
  activeProviderId: string;
  onActiveProviderChange: (id: string) => void;
  
  // API Keys (per provider)
  apiKeys: Record<string, ApiKeyEntry[]>;
  onApiKeysChange: (providerId: string, keys: ApiKeyEntry[]) => void;
  activeKeyIndex: Record<string, number>;
  onActiveKeyIndexChange: (providerId: string, idx: number) => void;
  
  // Models (unified)
  activeModel: ActiveModel | null;
  onActiveModelChange: (model: ActiveModel) => void;
  allModels: UniversalModel[];
  onModelsLoad: (providerId: string, models: UniversalModel[]) => void;
  onRefreshModels: (providerId: string) => void;
  
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
  // Advanced limits
  maxToolRounds: number;
  onMaxToolRoundsChange: (v: number) => void;
  maxMemoryCalls: number;
  onMaxMemoryCallsChange: (v: number) => void;
  // Ghost Nudge Protocol
  ghostNudgeEnabled: boolean;
  onGhostNudgeEnabledChange: (enabled: boolean) => void;
  ghostNudgeMaxRetries: number;
  onGhostNudgeMaxRetriesChange: (v: number) => void;
  onSkillsChanged?: () => void;
  onClose?: () => void;
  // Agents
  onOpenAgent?: (agentId: string, parentChatId?: string) => void;
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
  badge,
}: {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  openSections: Set<SettingsSectionId>;
  onToggle: (id: SettingsSectionId) => void;
  badge?: string;
}) {
  const isOpen = openSections.has(id);

  return (
    <button onClick={() => onToggle(id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
          <Icon size={14} className="text-[var(--text-muted)]" />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-dim)]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="mr-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-mono text-[var(--text-muted)] max-w-[80px] truncate">
            {badge}
          </span>
        )}
        <ChevronDown size={14} className={`text-[var(--text-dim)] transition-transform duration-300 ${isOpen ? '' : '-rotate-90'}`} />
      </div>
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
  onOpenAgent,
  // Arena props
  appMode,
  onAppModeChange,
  arenaSessions,
  activeArenaSessionId,
  onLoadArenaSession,
  onNewArenaSession,
  onDeleteArenaSession,
  // Agent props
  activeAgentId,
  onSelectAgent,
}: Pick<SidebarSharedProps, 'savedChats' | 'currentChatId' | 'onLoadChat' | 'onNewChat' | 'onDeleteChat' | 'onClose' | 'onOpenAgent'> & {
  appMode?: 'chat' | 'arena' | 'agents';
  onAppModeChange?: (mode: 'chat' | 'arena' | 'agents') => void;
  arenaSessions?: Array<{ id: string; title: string; agents: any[]; messages: any[]; createdAt: number; updatedAt: number }>;
  activeArenaSessionId?: string | null;
  onLoadArenaSession?: (id: string) => void;
  onNewArenaSession?: () => void;
  onDeleteArenaSession?: (id: string) => void;
  activeAgentId?: string | null;
  onSelectAgent?: (id: string | null) => void;
}) {
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const isArena = appMode === 'arena';
  const isAgentsMode = appMode === 'agents';
  
  // Agents state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentGraphs, setAgentGraphs] = useState<AgentGraph[]>([]);
  const [collapsedChats, setCollapsedChats] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    setAgents(getAgents());
    const { getGraphs } = require('@/lib/agent-engine/graph-storage');
    setAgentGraphs(getGraphs().filter((g: AgentGraph) => g.metadata.published));
    
    const handleAgentsUpdate = () => {
      setAgents(getAgents());
    };
    const handleGraphsUpdate = () => {
      const { getGraphs } = require('@/lib/agent-engine/graph-storage');
      setAgentGraphs(getGraphs().filter((g: AgentGraph) => g.metadata.published));
    };
    
    window.addEventListener(AGENTS_UPDATED_EVENT, handleAgentsUpdate);
    const { GRAPHS_UPDATED_EVENT } = require('@/lib/agent-engine/graph-storage');
    window.addEventListener(GRAPHS_UPDATED_EVENT, handleGraphsUpdate);
    return () => {
      window.removeEventListener(AGENTS_UPDATED_EVENT, handleAgentsUpdate);
      window.removeEventListener(GRAPHS_UPDATED_EVENT, handleGraphsUpdate);
    };
  }, []);
  
  // Группировка чатов по родителям и фильтрация для агентов
  const { parentChats, subChatsByParent, standaloneChats } = useMemo(() => {
    const parents: SavedChat[] = [];
    const subChats: Record<string, SavedChat[]> = {};
    const standalone: SavedChat[] = [];
    
    const filteredChats = isAgentsMode 
      ? savedChats.filter(chat => chat.agentId === activeAgentId)
      : savedChats;

    // Сначала собираем все подчаты
    filteredChats.forEach(chat => {
      if (chat.isSubChat && chat.parentChatId) {
        if (!subChats[chat.parentChatId]) {
          subChats[chat.parentChatId] = [];
        }
        subChats[chat.parentChatId].push(chat);
      }
    });
    
    // Теперь группируем родительские и standalone чаты
    filteredChats.forEach(chat => {
      if (chat.isSubChat) {
        // Уже обработан выше
        return;
      }
      
      if (subChats[chat.id] && subChats[chat.id].length > 0) {
        // Это родительский чат с подчатами
        parents.push(chat);
      } else {
        // Это standalone чат
        standalone.push(chat);
      }
    });
    
    // Сортируем подчаты по дате создания
    Object.keys(subChats).forEach(parentId => {
      subChats[parentId].sort((a, b) => a.createdAt - b.createdAt);
    });
    
    return { parentChats: parents, subChatsByParent: subChats, standaloneChats: standalone };
  }, [savedChats, isAgentsMode, activeAgentId]);
  
  // Автоматически раскрываем чат с активным подчатом
  useEffect(() => {
    const currentChat = savedChats.find(c => c.id === currentChatId);
    if (currentChat?.parentChatId) {
      setCollapsedChats(prev => {
        const next = new Set(prev);
        next.delete(currentChat.parentChatId!);
        return next;
      });
    }
  }, [currentChatId, savedChats]);
  
  const toggleCollapse = (chatId: string) => {
    setCollapsedChats(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  };
  
  const starredAgents = agents.filter(a => a.starred);

  return (
    <SidebarShell
      title={isArena ? 'Arena' : 'Чаты'}
      subtitle={isArena
        ? 'Multi-AI сессии — несколько агентов обсуждают одну тему.'
        : 'История диалогов и быстрый переход между ветками разговора.'
      }
      icon={MessageSquare}
      onClose={onClose}
      borderClassName="border-r border-[var(--border)]"
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Pill switcher — Chat / Arena */}
        {onAppModeChange && (
          <div className="px-5 pt-4 pb-1">
            <div className="flex bg-[var(--surface-3)] p-0.5 rounded-lg">
              <button
                onClick={() => onAppModeChange('chat')}
                className={`flex-1 text-center py-1.5 text-xs font-medium rounded-md transition-all ${
                  appMode === 'chat'
                    ? 'bg-[var(--surface-4)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                }`}
              >
                💬 Чат
              </button>
              <button
                onClick={() => onAppModeChange('arena')}
                className={`flex-1 text-center py-1.5 text-xs font-medium rounded-md transition-all ${
                  appMode === 'arena'
                    ? 'bg-amber-400/15 text-amber-400 shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                }`}
              >
                ⚡ Arena
              </button>
              <button
                onClick={() => onAppModeChange('agents')}
                className={`flex-1 text-center py-1.5 text-xs font-medium rounded-md transition-all ${
                  isAgentsMode
                    ? 'bg-indigo-500/15 text-indigo-400 shadow-sm'
                    : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                }`}
              >
                🤖 Agents
              </button>
            </div>
          </div>
        )}

        {/* Published Agents List — only in Agents Mode */}
        {isAgentsMode && agentGraphs.length > 0 && (
          <div className="px-5 pt-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-400 mb-3">
              Агенты
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {agentGraphs.map(graph => (
                <button
                  key={graph.id}
                  onClick={() => onSelectAgent?.(graph.id)}
                  className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 rounded-2xl border transition-all ${
                    activeAgentId === graph.id
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                      : 'border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl mb-2 flex items-center justify-center ${
                    activeAgentId === graph.id ? 'bg-indigo-500/20' : 'bg-[var(--surface-3)]'
                  }`}>
                    <Zap size={20} className={activeAgentId === graph.id ? 'text-indigo-400' : 'text-[var(--text-dim)]'} />
                  </div>
                  <span className={`text-[10px] font-bold truncate w-full px-2 text-center ${
                    activeAgentId === graph.id ? 'text-indigo-400' : 'text-[var(--text-muted)]'
                  }`}>
                    {graph.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* New button */}
        <div className="px-5 pt-4">
          <button
            onClick={() => {
              if (isArena) {
                onNewArenaSession?.();
              } else {
                onNewChat();
              }
              onClose?.();
            }}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.99] ${
              isArena
                ? 'bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-black'
                : 'bg-white text-black'
            }`}
          >
            <Plus size={16} />
            {isArena ? 'Новая арена' : 'Новый чат'}
          </button>
        </div>

        {/* Starred agents section - только в режиме чата */}
        {!isArena && starredAgents.length > 0 && (
          <>
            <div className="px-5 pb-2 pt-5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                ★ Избранные
              </p>
              <button
                className="text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => {
                  // TODO: открыть модалку со всеми агентами
                }}
              >
                Все агенты →
              </button>
            </div>

            <div className="px-3 pb-3">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {starredAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onOpenAgent?.(agent.id, currentChatId || undefined);
                      onClose?.();
                    }}
                    className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-all"
                  >
                    <span className="text-2xl mb-1">{agent.avatarEmoji}</span>
                    <span className="text-[10px] text-[var(--text-muted)] truncate w-full px-1 text-center">
                      {agent.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Section header */}
        <div className="px-5 pb-3 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            {isArena ? 'Сессии' : 'История'}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {isArena
              ? (arenaSessions && arenaSessions.length > 0 ? `${arenaSessions.length} сессий` : 'Пока пусто')
              : (savedChats.length > 0 ? `${savedChats.length} сохранённых диалогов` : 'Пока пусто')
            }
          </p>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {isArena ? (
            /* Arena sessions list */
            (!arenaSessions || arenaSessions.length === 0) ? (
              <div className="mx-2 rounded-[24px] border border-dashed border-amber-400/20 bg-[var(--surface-1)] px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
                  <span className="text-xl">⚡</span>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Нет Arena-сессий</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
                  Создайте новую сессию, чтобы запустить мультиагентное обсуждение.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {[...arenaSessions].reverse().map(session => {
                  const isActive = session.id === activeArenaSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        onLoadArenaSession?.(session.id);
                        onClose?.();
                      }}
                      className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                        isActive
                          ? 'bg-amber-400/[0.08] text-amber-200'
                          : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className={`flex-shrink-0 text-sm ${isActive ? 'text-amber-400' : 'text-[var(--text-dim)]'}`}>⚡</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{session.title}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--text-dim)]">
                          {session.agents?.length ?? 0} агентов • {session.messages?.length ?? 0} сообщ. • {formatDate(session.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={event => {
                          event.stopPropagation();
                          onDeleteArenaSession?.(session.id);
                        }}
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-dim)] opacity-0 transition-all hover:bg-red-500/10 hover:text-[var(--gem-red)] group-hover:opacity-100"
                        title="Удалить сессию"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Hierarchical chat list */
            savedChats.length === 0 ? (
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
              <div className="space-y-1.5">
                {/* Parent chats with subchats */}
                {[...parentChats].reverse().map(parentChat => {
                  const subChats = subChatsByParent[parentChat.id] || [];
                  const isCollapsed = collapsedChats.has(parentChat.id);
                  const hasActiveSubChat = subChats.some(sc => sc.id === currentChatId);
                  const isParentActive = parentChat.id === currentChatId;

                  return (
                    <div key={parentChat.id} className="space-y-0.5">
                      {/* Parent chat */}
                      <div
                        className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                          isParentActive
                            ? 'bg-white/[0.08] text-white'
                            : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {/* Collapse toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapse(parentChat.id);
                          }}
                          className="flex-shrink-0 flex items-center justify-center w-4 h-4 text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all"
                        >
                          <ChevronDown size={12} className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        {/* Chat info */}
                        <div
                          onClick={() => {
                            onLoadChat(parentChat);
                            onClose?.();
                          }}
                          className="flex items-center gap-2.5 min-w-0 flex-1"
                        >
                          <MessageSquare size={14} className={`flex-shrink-0 ${isParentActive ? 'text-white' : 'text-[var(--text-dim)]'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">{parentChat.title}</p>
                            <p className="mt-0.5 text-[10px] text-[var(--text-dim)]">
                              {parentChat.messages.length} • {formatDate(parentChat.updatedAt)}
                            </p>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            const subChatsCount = subChats.length;
                            if (subChatsCount > 0) {
                              if (confirm(`Удалить чат и ${subChatsCount} подчат${subChatsCount === 1 ? '' : subChatsCount < 5 ? 'а' : 'ов'}?`)) {
                                // Delete parent and all subchats
                                onDeleteChat(parentChat.id);
                                subChats.forEach(sc => onDeleteChat(sc.id));
                              }
                            } else {
                              onDeleteChat(parentChat.id);
                            }
                          }}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-dim)] opacity-0 transition-all hover:bg-red-500/10 hover:text-[var(--gem-red)] group-hover:opacity-100"
                          title="Удалить чат"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Subchats */}
                      {!isCollapsed && subChats.length > 0 && (
                        <div className="ml-3 border-l border-[var(--border)] pl-2 space-y-0.5">
                          {subChats.map((subChat, idx) => {
                            const isActive = subChat.id === currentChatId;
                            const isLast = idx === subChats.length - 1;
                            const agent = subChat.agentId ? agents.find(a => a.id === subChat.agentId) : null;

                            return (
                              <div
                                key={subChat.id}
                                onClick={() => {
                                  onLoadChat(subChat);
                                  onClose?.();
                                }}
                                className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-all relative ${
                                  isActive
                                    ? 'bg-white/[0.08] text-white'
                                    : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {/* Tree line */}
                                <span className="absolute -left-2 top-1/2 w-2 h-px bg-[var(--border)]" />
                                
                                {/* Icon */}
                                {agent ? (
                                  <span className="flex-shrink-0 text-sm">{agent.avatarEmoji}</span>
                                ) : (
                                  <MessageSquare size={12} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[var(--text-dim)]'}`} />
                                )}

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-medium">{subChat.title}</p>
                                  <p className="mt-0.5 text-[10px] text-[var(--text-dim)]">
                                    {subChat.messages.length} • {formatDate(subChat.updatedAt)}
                                  </p>
                                </div>

                                {/* Delete button */}
                                <button
                                  onClick={event => {
                                    event.stopPropagation();
                                    onDeleteChat(subChat.id);
                                  }}
                                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-dim)] opacity-0 transition-all hover:bg-red-500/10 hover:text-[var(--gem-red)] group-hover:opacity-100"
                                  title="Удалить подчат"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Standalone chats (no subchats) */}
                {[...standaloneChats].reverse().map(chat => {
                  const isActive = chat.id === currentChatId;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => {
                        onLoadChat(chat);
                        onClose?.();
                      }}
                      className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer transition-all ${
                        isActive
                          ? 'bg-white/[0.08] text-white'
                          : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <MessageSquare size={14} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[var(--text-dim)]'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{chat.title}</p>
                        <p className="mt-0.5 text-[10px] text-[var(--text-dim)]">
                          {chat.messages.length} • {formatDate(chat.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={event => {
                          event.stopPropagation();
                          onDeleteChat(chat.id);
                        }}
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-dim)] opacity-0 transition-all hover:bg-red-500/10 hover:text-[var(--gem-red)] group-hover:opacity-100"
                        title="Удалить чат"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </SidebarShell>
  );
}


export function SettingsSidebar({
  providers,
  onProvidersChange,
  activeProviderId,
  onActiveProviderChange,
  apiKeys,
  onApiKeysChange,
  activeKeyIndex,
  onActiveKeyIndexChange,
  activeModel,
  onActiveModelChange,
  allModels,
  onModelsLoad,
  onRefreshModels,
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
  maxToolRounds,
  onMaxToolRoundsChange,
  maxMemoryCalls,
  onMaxMemoryCallsChange,
  ghostNudgeEnabled,
  onGhostNudgeEnabledChange,
  ghostNudgeMaxRetries,
  onGhostNudgeMaxRetriesChange,
  onSkillsChanged,
  onClose,
}: SidebarSharedProps) {
  const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});
  const [modelError, setModelError] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<SettingsSectionId>>(new Set<SettingsSectionId>(['keys']));

  const [newKeyInput, setNewKeyInput] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [showAddProviderModal, setShowAddProviderModal] = useState(false);
  const [activeProviderTab, setActiveProviderTab] = useState(activeProviderId);

  const [savedPrompts, setSavedPrompts] = useState<SavedSystemPrompt[]>([]);
  const [promptDropdownOpen, setPromptDropdownOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  
  const currentProviderKeys = apiKeys[activeProviderTab] || [];
  const currentKeyIndex = activeKeyIndex[activeProviderTab] || 0;
  const activeKeyEntry = currentProviderKeys[currentKeyIndex];
  const activeKeySuffix = activeKeyEntry?.key ? activeKeyEntry.key.slice(-4) : '';
  const activeProvider = providers.find(p => p.id === activeProviderId);
  const currentTabProvider = providers.find(p => p.id === activeProviderTab);

  const importRef = useRef<HTMLInputElement>(null);
  const importGsRef = useRef<HTMLInputElement>(null);
  const importBackupRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');

  const loadModels = useCallback(async (providerId: string, key: string) => {
    if (!key.trim()) return;

    setLoadingModels(prev => ({ ...prev, [providerId]: true }));
    setModelError('');

    const provider = providers.find(p => p.id === providerId);
    if (!provider) {
      setLoadingModels(prev => ({ ...prev, [providerId]: false }));
      return;
    }

    try {
      let res: Response;
      let data: any;

      if (provider.type === 'gemini') {
        res = await fetch(`/api/models?apiKey=${encodeURIComponent(key)}`);
        data = await res.json();

        if (!res.ok || data.error) {
          setModelError(data.error || 'Не удалось загрузить модели');
          onModelsLoad(providerId, []);
          return;
        }

        const geminiModels: UniversalModel[] = (data.models || []).map((m: GeminiModel) => ({
          id: m.name,
          displayName: m.displayName,
          providerId,
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
          supportedGenerationMethods: m.supportedGenerationMethods,
        }));

        onModelsLoad(providerId, geminiModels);

        // Auto-select preferred model if none selected
        if (!activeModel && geminiModels.length > 0) {
          const preferred =
            geminiModels.find(m => m.id.includes('gemini-2.5-flash') && !m.id.includes('lite') && !m.id.includes('audio')) ||
            geminiModels.find(m => m.id.includes('gemini-2.0-flash') && !m.id.includes('lite')) ||
            geminiModels[0];

          if (preferred) onActiveModelChange({ providerId, modelId: preferred.id });
        }
      } else {
        // OpenAI-compatible
        res = await fetch(`/api/openai-models?apiKey=${encodeURIComponent(key)}&baseUrl=${encodeURIComponent(provider.baseUrl)}`);
        data = await res.json();

        if (!res.ok || data.error) {
          setModelError(data.error || 'Не удалось загрузить модели');
          onModelsLoad(providerId, []);
          return;
        }

        const openaiModels: UniversalModel[] = (data.models || []).map((m: any) => ({
          id: m.id,
          displayName: m.displayName,
          providerId,
          inputTokenLimit: m.inputTokenLimit,
        }));

        onModelsLoad(providerId, openaiModels);

        // Auto-select first model if none selected
        if (!activeModel && openaiModels.length > 0) {
          onActiveModelChange({ providerId, modelId: openaiModels[0].id });
        }
      }
    } catch {
      setModelError('Ошибка сети');
    } finally {
      setLoadingModels(prev => ({ ...prev, [providerId]: false }));
    }
  }, [providers, activeModel, onActiveModelChange, onModelsLoad]);

  useEffect(() => {
    setSavedPrompts(loadSystemPrompts());
  }, []);

  const loadModelsRef = useRef(loadModels);
  useEffect(() => {
    loadModelsRef.current = loadModels;
  }, [loadModels]);

  useEffect(() => {
    if (!activeKeyEntry?.key) return;

    const timer = setTimeout(() => {
      loadModelsRef.current(activeProviderTab, activeKeyEntry.key);
    }, 250);

    return () => clearTimeout(timer);
  }, [activeKeyEntry?.key, activeProviderTab]);

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

    const updated = addApiKey(activeProviderTab, currentProviderKeys, trimmed);
    onApiKeysChange(activeProviderTab, updated);
    onActiveKeyIndexChange(activeProviderTab, updated.length - 1);
    setNewKeyInput('');
    setShowNewKey(false);
  };

  const deleteKey = (key: string) => {
    const updated = removeApiKey(currentProviderKeys, key);
    onApiKeysChange(activeProviderTab, updated);
    if (currentKeyIndex >= updated.length) {
      onActiveKeyIndexChange(activeProviderTab, Math.max(updated.length - 1, 0));
    }
  };

  const selectKey = (idx: number) => {
    onActiveKeyIndexChange(activeProviderTab, idx);
    if (currentProviderKeys[idx]?.key) {
      loadModels(activeProviderTab, currentProviderKeys[idx].key);
    }
  };

  const formatTokenCount = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const selectedModel = activeModel ? allModels.find(m => m.id === activeModel.modelId && m.providerId === activeModel.providerId) : null;
  const modelDisplayName = selectedModel?.displayName || activeModel?.modelId || 'Выбрать модель';
  const tempLabel = temperature < 0.4 ? 'Точно' : temperature < 0.8 ? 'Баланс' : temperature < 1.4 ? 'Творчески' : 'Хаос';
  const tempColor = temperature < 0.4 ? '#2dd4bf' : temperature < 0.8 ? '#4ade80' : temperature < 1.4 ? '#f59e0b' : '#ef4444';
  const thinkingLabel = thinkingBudget === 0 ? 'Выкл' : thinkingBudget === -1 ? 'Авто' : `${thinkingBudget} токенов`;
  
  // Group models by provider
  const modelsByProvider = allModels.reduce((acc, model) => {
    if (!acc[model.providerId]) acc[model.providerId] = [];
    acc[model.providerId].push(model);
    return acc;
  }, {} as Record<string, UniversalModel[]>);

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
        model: result.model || activeModel?.modelId || '',
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
    <>
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
                  {/* Provider tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {providers.map(provider => {
                      const isActive = provider.id === activeProviderTab;
                      const providerKeys = apiKeys[provider.id] || [];
                      
                      return (
                        <div key={provider.id} className={`group relative flex-shrink-0 flex items-center rounded-xl transition-all ${
                          isActive ? 'bg-white/10' : ''
                        }`}>
                          <button
                            onClick={() => setActiveProviderTab(provider.id)}
                            className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                              isActive
                                ? 'text-white'
                                : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                            }`}
                          >
                            {provider.name}
                            {providerKeys.length > 0 && (
                              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${
                                isActive ? 'bg-white/20' : 'bg-[var(--surface-3)]'
                              }`}>
                                {providerKeys.length}
                              </span>
                            )}
                          </button>
                          {/* Edit / Delete — только для кастомных провайдеров */}
                          {!provider.isBuiltin && isActive && (
                            <div className="flex items-center gap-0.5 pr-1">
                              <button
                                onClick={e => { e.stopPropagation(); setEditingProvider(provider); }}
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors"
                                title="Редактировать провайдер"
                              >
                                <Edit2 size={10} />
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  if (!confirm(`Удалить провайдер «${provider.name}»? Все его ключи тоже будут удалены.`)) return;
                                  // Switch tab before delete
                                  setActiveProviderTab('google');
                                  onActiveProviderChange('google');
                                  onProvidersChange(providers.filter(p => p.id !== provider.id));
                                }}
                                className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Удалить провайдер"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={() => setShowAddProviderModal(true)}
                      className="flex-shrink-0 rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-dim)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                      title="Добавить провайдер"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Keys for active provider */}
                  {currentProviderKeys.map((entry, idx) => {
                    const status = getKeyStatus(entry, activeModel?.modelId);
                    const isActive = idx === currentKeyIndex;
                    const keyId = `${entry.key}-${idx}`;

                    return (
                      <button
                        key={keyId}
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
                            {showKeys[keyId] ? entry.key : `${entry.key.slice(0, 8)}••••••••${entry.key.slice(-4)}`}
                          </p>
                          {status !== 'active' && (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--gem-red)]">
                              <Clock size={8} />
                              Разблокируется через {timeUntilUnblock(entry, activeModel?.modelId)}
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
                                const updated = unblockKey(currentProviderKeys, idx, activeModel?.modelId);
                                onApiKeysChange(activeProviderTab, updated);
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
                              setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
                            title="Показать ключ"
                          >
                            {showKeys[keyId] ? <EyeOff size={12} /> : <Eye size={12} />}
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
                        placeholder={currentTabProvider?.type === 'gemini' ? 'AIza...' : 'sk-...'}
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

                  {currentProviderKeys.length === 0 && currentTabProvider?.type === 'gemini' && (
                    <p className="text-xs leading-relaxed text-[var(--text-dim)]">
                      Ключи можно получить на{' '}
                      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--gem-blue)] hover:underline">
                        Google AI Studio
                      </a>
                      .
                    </p>
                  )}

                  {currentProviderKeys.length > 0 && activeKeySuffix && (
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
              <SettingsSectionHeader 
                id="model" 
                label="Модель" 
                icon={Cpu} 
                openSections={openSections} 
                onToggle={toggleSection}
                badge={activeModel?.modelId?.split('/').pop()?.replace('gemini-', 'g-') || undefined}
              />
              {openSections.has('model') && (
                <div className="space-y-4 px-4 pb-4">
                  <div className="relative">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Выбранная модель</span>
                      {currentProviderKeys.length > 0 && (
                        <button
                          onClick={() => onRefreshModels(activeProviderId)}
                          disabled={loadingModels[activeProviderId]}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
                          title="Обновить модели"
                        >
                          <RefreshCw size={12} className={loadingModels[activeProviderId] ? 'animate-spin' : ''} />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => setModelDropdownOpen(prev => !prev)}
                      disabled={allModels.length === 0}
                      className="flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left transition-colors hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={`${activeModel ? 'text-[var(--text-primary)]' : 'text-[var(--text-dim)]'} truncate text-sm`}>
                        {loadingModels[activeProviderId] ? 'Загрузка...' : modelDisplayName.replace('Gemini ', '').replace(' (Preview)', '').trim()}
                      </span>
                      <ChevronDown size={14} className={`ml-2 flex-shrink-0 text-[var(--text-dim)] transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {modelDropdownOpen && allModels.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-2)] p-2 shadow-2xl">
                        {providers.map(provider => {
                          const providerModels = modelsByProvider[provider.id] || [];
                          if (providerModels.length === 0) return null;

                          return (
                            <div key={provider.id} className="mb-2 last:mb-0">
                              <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
                                {provider.name}
                              </div>
                              {providerModels.map(item => {
                                const isSelected = activeModel?.modelId === item.id && activeModel?.providerId === item.providerId;
                                const isNew = item.id.includes('3') || item.id.includes('2.5');
                                const modelId = item.id.split('/').pop() || item.id;

                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => {
                                      onActiveModelChange({ providerId: item.providerId, modelId: item.id });
                                      onActiveProviderChange(item.providerId);
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

                  {activeProvider?.type === 'gemini' && (
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
                  )}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface-1)]">
              <SettingsSectionHeader 
                id="tools" 
                label="Инструменты" 
                icon={Wrench} 
                openSections={openSections} 
                onToggle={toggleSection}
                badge={(tools.length + (memoryEnabled ? 1 : 0)) > 0 ? String(tools.length + (memoryEnabled ? 1 : 0)) : undefined}
              />
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

                  {/* Advanced Limits */}
                  <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] group">
                    <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs font-medium text-[var(--text-muted)] select-none hover:text-[var(--text-primary)] transition-colors list-none">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal size={13} />
                        <span>Лимиты циклов</span>
                      </div>
                      <ChevronDown size={12} className="transition-transform group-open:rotate-180 text-[var(--text-dim)]" />
                    </summary>
                    <div className="px-4 pb-4 space-y-4">
                      <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
                        Максимальное количество раундов вызова инструментов за один запрос. Защита от бесконечных циклов.
                      </p>

                      {/* Max Tool Rounds */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] text-[var(--text-muted)]">Макс. раундов инструментов</label>
                          <span className="rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-2 py-0.5 text-xs font-mono text-[var(--text-primary)] min-w-[3rem] text-center">
                            {maxToolRounds}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="50"
                          step="1"
                          value={maxToolRounds}
                          onChange={e => onMaxToolRoundsChange(parseInt(e.target.value, 10))}
                        />
                        <div className="mt-1 flex justify-between text-[9px] text-[var(--text-dim)]">
                          <span>1</span>
                          <span>50</span>
                        </div>
                      </div>

                      {/* Max Memory Calls */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] text-[var(--text-muted)]">Макс. вызовов памяти за turn</label>
                          <span className="rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-2 py-0.5 text-xs font-mono text-[var(--text-primary)] min-w-[3rem] text-center">
                            {maxMemoryCalls}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="200"
                          step="5"
                          value={maxMemoryCalls}
                          onChange={e => onMaxMemoryCallsChange(parseInt(e.target.value, 10))}
                        />
                        <div className="mt-1 flex justify-between text-[9px] text-[var(--text-dim)]">
                          <span>1</span>
                          <span>200</span>
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* Ghost Nudge Protocol */}
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px]">👻</span>
                        <span className="text-xs font-medium text-[var(--text-primary)]">Ghost Nudge Protocol</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ghostNudgeEnabled}
                          onChange={e => onGhostNudgeEnabledChange(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-[var(--surface-4)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                      </label>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mb-2">
                      Gemini иногда присылает пустой ответ. GNP автоматически повторяет запрос
                    </p>
                    {ghostNudgeEnabled && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-[var(--text-muted)]">Попыток:</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(n => (
                              <button
                                key={n}
                                onClick={() => onGhostNudgeMaxRetriesChange(n)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                                  ghostNudgeMaxRetries === n
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-[var(--surface-3)] text-[var(--text-muted)] border border-transparent hover:bg-[var(--surface-4)]'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
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
              <SettingsSectionHeader 
                id="system" 
                label="Система" 
                icon={BookOpen} 
                openSections={openSections} 
                onToggle={toggleSection}
                badge={systemPrompt.trim() ? `${systemPrompt.trim().slice(0,12)}…` : undefined}
              />
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
              <SettingsSectionHeader 
                id="manage" 
                label="Данные" 
                icon={FileStack} 
                openSections={openSections} 
                onToggle={toggleSection}
                badge={savedChats.length > 0 ? `${savedChats.length}` : undefined}
              />
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
    {showAddProviderModal && (
      <ProviderModal
        onClose={() => setShowAddProviderModal(false)}
        onSave={(provider) => {
          onProvidersChange([...providers, provider]);
          setActiveProviderTab(provider.id);
          setShowAddProviderModal(false);
        }}
      />
    )}
    {editingProvider && (
      <ProviderModal
        existingProvider={editingProvider}
        onClose={() => setEditingProvider(null)}
        onSave={(updated) => {
          onProvidersChange(providers.map(p => p.id === updated.id ? updated : p));
          setEditingProvider(null);
        }}
      />
    )}
    </>
  );
}
