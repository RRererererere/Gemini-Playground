import { useState, useEffect, useRef, useCallback } from 'react';
import type { Message, Provider, ApiKeyEntry, UniversalModel, ActiveModel, ChatTool, SavedSystemPrompt, SavedChat, OpenFile, FileDiffOp, WebsiteType } from '@/types';
import { useDeepThink } from '@/lib/useDeepThink';
import { useArena } from '@/lib/useArena';
import { useSkillsUI } from '@/lib/useSkillsUI';
import { useScroll, useTokenCounter, useMemory, useFileEditor, useRPGProfile } from '@/lib/hooks';
import { useSettings } from '@/lib/hooks/useSettings';
import { useChat } from '@/lib/hooks/useChat';
import {
  loadApiKeys, saveApiKeys, migrateOldApiKeys,
} from '@/lib/apiKeyManager';
import {
  loadProviders, loadModelsCache, getActiveProviderId, getActiveModel, migrateOldModelSelection, GOOGLE_PROVIDER,
  sanitizeApiKeys, setActiveProviderId, setActiveModel, saveModelsCache, saveCustomProvider,
} from '@/lib/providerStorage';
import {
  loadSavedChats, getActiveChatId, loadDeepThinkSystemPrompt, loadSystemPrompts,
  loadGhostNudgeEnabled, saveGhostNudgeEnabled,
  loadGhostNudgeMaxRetries, saveGhostNudgeMaxRetries,
  saveChatToStorage,
} from '@/lib/storage';
import { DEFAULT_DEEPTHINK_SYSTEM_PROMPT } from '@/lib/gemini';
import type { UseChatReturn } from '@/lib/hooks/useChat';

type MessagesSetter = React.Dispatch<React.SetStateAction<import('@/types').Message[]>>;

export interface UseAppStateReturn {
  // Settings
  providers: Provider[];
  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>;
  activeProviderId: string;
  setActiveProviderId: React.Dispatch<React.SetStateAction<string>>;
  apiKeys: Record<string, ApiKeyEntry[]>;
  setApiKeys: React.Dispatch<React.SetStateAction<Record<string, ApiKeyEntry[]>>>;
  activeKeyIndex: Record<string, number>;
  setActiveKeyIndex: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  activeModel: ActiveModel | null;
  setActiveModel: React.Dispatch<React.SetStateAction<ActiveModel | null>>;
  allModels: UniversalModel[];
  setAllModels: React.Dispatch<React.SetStateAction<UniversalModel[]>>;
  model: string;
  models: UniversalModel[];
  effectiveProviderId: string;
  currentProviderKeys: ApiKeyEntry[];
  currentKeyIndex: number;
  selectedApiKeyEntry: ApiKeyEntry | null;
  selectedApiKey: string;
  selectedApiKeySuffix: string;
  activeProvider: Provider | undefined;
  systemPrompt: string;
  setSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  tools: ChatTool[];
  setTools: React.Dispatch<React.SetStateAction<ChatTool[]>>;
  deepThinkSystemPrompt: string;
  setDeepThinkSystemPrompt: React.Dispatch<React.SetStateAction<string>>;
  temperature: number;
  setTemperature: React.Dispatch<React.SetStateAction<number>>;
  thinkingBudget: number;
  setThinkingBudget: React.Dispatch<React.SetStateAction<number>>;
  maxOutputTokens: number;
  setMaxOutputTokens: React.Dispatch<React.SetStateAction<number>>;
  memoryEnabled: boolean;
  setMemoryEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  maxToolRounds: number;
  setMaxToolRounds: React.Dispatch<React.SetStateAction<number>>;
  maxMemoryCalls: number;
  setMaxMemoryCalls: React.Dispatch<React.SetStateAction<number>>;
  ghostNudgeEnabled: boolean;
  setGhostNudgeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  ghostNudgeMaxRetries: number;
  setGhostNudgeMaxRetries: React.Dispatch<React.SetStateAction<number>>;
  savedPrompts: SavedSystemPrompt[];
  setSavedPrompts: React.Dispatch<React.SetStateAction<SavedSystemPrompt[]>>;

  // Chat
  messages: import('@/types').Message[];
  setMessages: MessagesSetter;
  messagesRef: React.MutableRefObject<import('@/types').Message[]>;
  savedChats: SavedChat[];
  setSavedChats: React.Dispatch<React.SetStateAction<SavedChat[]>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  chatTitle: string;
  setChatTitle: React.Dispatch<React.SetStateAction<string>>;
  unsaved: boolean;
  setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
  saveChat: (...args: any[]) => Promise<any>;
  deleteChat: (id: string, currentChatId: string | null) => Promise<boolean>;
  clearChat: () => void;
  loadChats: () => Promise<any>;
  updateSavedChats: (chats: SavedChat[]) => Promise<void>;

  // Streaming / UI
  isStreaming: boolean;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  streamingId: string | null;
  setStreamingId: React.Dispatch<React.SetStateAction<string | null>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  showLiveCanvas: boolean;
  setShowLiveCanvas: React.Dispatch<React.SetStateAction<boolean>>;
  liveCode: string;
  setLiveCode: React.Dispatch<React.SetStateAction<string>>;
  websiteType: WebsiteType;
  setWebsiteType: React.Dispatch<React.SetStateAction<WebsiteType>>;
  showInsights: boolean;
  setShowInsights: React.Dispatch<React.SetStateAction<boolean>>;
  livePreviewRef: React.MutableRefObject<any>;

  // File Editor
  openFiles: OpenFile[];
  setOpenFiles: React.Dispatch<React.SetStateAction<OpenFile[]>>;
  activeFileId: string | null;
  setActiveFileId: React.Dispatch<React.SetStateAction<string | null>>;
  showFileEditor: boolean;
  setShowFileEditor: React.Dispatch<React.SetStateAction<boolean>>;
  pendingEdits: Map<string, FileDiffOp[]>;
  setPendingEdits: React.Dispatch<React.SetStateAction<Map<string, FileDiffOp[]>>>;
  checkFilesForEditor: (files: any[]) => void;

  // Mobile Canvas
  mobileCanvasState: 'hidden' | 'sheet' | 'fullscreen';
  setMobileCanvasState: React.Dispatch<React.SetStateAction<'hidden' | 'sheet' | 'fullscreen'>>;
  pendingCanvasElement: any;
  setPendingCanvasElement: React.Dispatch<React.SetStateAction<any>>;

  // Arena
  appMode: 'chat' | 'arena' | 'agents' | 'agents_history';
  setAppMode: React.Dispatch<React.SetStateAction<'chat' | 'arena' | 'agents' | 'agents_history'>>;
  arena: ReturnType<typeof useArena>;

  // UI State
  showToolBuilder: boolean;
  setShowToolBuilder: React.Dispatch<React.SetStateAction<boolean>>;
  editingTool: ChatTool | null;
  setEditingTool: React.Dispatch<React.SetStateAction<ChatTool | null>>;
  showSavePromptDialog: boolean;
  setShowSavePromptDialog: React.Dispatch<React.SetStateAction<boolean>>;
  newPromptName: string;
  setNewPromptName: React.Dispatch<React.SetStateAction<string>>;
  showDeepThinkDialog: boolean;
  setShowDeepThinkDialog: React.Dispatch<React.SetStateAction<boolean>>;
  deepThinkDraft: string;
  setDeepThinkDraft: React.Dispatch<React.SetStateAction<string>>;
  chatSidebarOpen: boolean;
  setChatSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  settingsSidebarOpen: boolean;
  setSettingsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  setIsMobile: React.Dispatch<React.SetStateAction<boolean>>;
  showSkillsMarket: boolean;
  setShowSkillsMarket: React.Dispatch<React.SetStateAction<boolean>>;
  showHFSpaces: boolean;
  setShowHFSpaces: React.Dispatch<React.SetStateAction<boolean>>;
  skillsRevision: number;
  setSkillsRevision: React.Dispatch<React.SetStateAction<number>>;
  handleSkillEvent: (e: any) => void;

  // Scroll
  showScrollBottom: boolean;
  isAtBottomRef: React.MutableRefObject<boolean>;
  chatEndRef: React.MutableRefObject<HTMLDivElement | null>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollToBottom: () => void;

  // Token Counter
  tokenCount: number;
  setTokenCount: React.Dispatch<React.SetStateAction<number>>;
  isCountingTokens: boolean;
  countTokens: (...args: any[]) => Promise<void>;
  scheduleTokenCount: (...args: any[]) => void;

  // Memory
  showMemoryModal: boolean;
  setShowMemoryModal: React.Dispatch<React.SetStateAction<boolean>>;

  // DeepThink
  deepThink: ReturnType<typeof useDeepThink>;

  // Sidebar props
  settingsSidebarProps: any;
  chatSidebarArenaProps: any;
}

export function useAppState(): UseAppStateReturn {
  // ═══════════════════════════════════════════
  // SETTINGS (providers, keys, models, options)
  // ═══════════════════════════════════════════
  const settings = useSettings();
  const {
    providers, setProviders, activeProviderId, setActiveProviderId,
    apiKeys, setApiKeys, activeKeyIndex, setActiveKeyIndex,
    activeModel, setActiveModel, allModels, setAllModels,
    model, models,
    systemPrompt, setSystemPrompt, tools, setTools,
    deepThinkSystemPrompt, setDeepThinkSystemPrompt,
    temperature, setTemperature, thinkingBudget, setThinkingBudget,
    maxOutputTokens, setMaxOutputTokens,
    memoryEnabled, setMemoryEnabled, maxToolRounds, setMaxToolRounds,
    maxMemoryCalls, setMaxMemoryCalls,
    ghostNudgeEnabled, setGhostNudgeEnabled, ghostNudgeMaxRetries, setGhostNudgeMaxRetries,
    savedPrompts, setSavedPrompts,
    onModelsLoad, onRefreshModels,
  } = settings;

  // Derived values (compute locally from settings state)
  const effectiveProviderId = activeModel?.providerId || activeProviderId;
  const currentProviderKeys = apiKeys[effectiveProviderId] || [];
  const currentKeyIndex = activeKeyIndex[effectiveProviderId] || 0;
  const selectedApiKeyEntry = currentProviderKeys[currentKeyIndex] || null;
  const selectedApiKey = selectedApiKeyEntry?.key || '';
  const selectedApiKeySuffix = selectedApiKeyEntry?.key ? selectedApiKeyEntry.key.slice(-4) : '';
  const activeProvider = providers.find(p => p.id === (activeModel?.providerId || activeProviderId));

  // ═══════════════════════════════════════════
  // CHAT (messages, saved chats)
  // ═══════════════════════════════════════════
  const chatHook = useChat();
  const {
    messages, setMessages, messagesRef,
    savedChats, setSavedChats,
    currentChatId, setCurrentChatId, chatTitle, setChatTitle, unsaved, setUnsaved,
    loadChats, saveChat, deleteChat, clearChat, updateSavedChats,
  } = chatHook;

  // ═══════════════════════════════════════════
  // STREAMING / UI
  // ═══════════════════════════════════════════
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [showLiveCanvas, setShowLiveCanvas] = useState(false);
  const [liveCode, setLiveCode] = useState('');
  const [websiteType, setWebsiteType] = useState<WebsiteType>(null);
  const [showInsights, setShowInsights] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const livePreviewRef = useRef<any>(null);

  // ═══════════════════════════════════════════
  // FILE EDITOR
  // ═══════════════════════════════════════════
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [showFileEditor, setShowFileEditor] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Map<string, FileDiffOp[]>>(new Map());

  // ═══════════════════════════════════════════
  // MOBILE CANVAS
  // ═══════════════════════════════════════════
  type MobileCanvasState = 'hidden' | 'sheet' | 'fullscreen';
  const [mobileCanvasState, setMobileCanvasState] = useState<MobileCanvasState>('hidden');
  const [pendingCanvasElement, setPendingCanvasElement] = useState<any>(null);

  // ═══════════════════════════════════════════
  // ARENA MODE
  // ═══════════════════════════════════════════
  const [appMode, setAppMode] = useState<'chat' | 'arena' | 'agents' | 'agents_history'>('chat');

  // ═══════════════════════════════════════════
  // UI STATE (dialogs, modals, sidebar)
  // ═══════════════════════════════════════════
  const [showToolBuilder, setShowToolBuilder] = useState(false);
  const [editingTool, setEditingTool] = useState<ChatTool | null>(null);
  const [showSavePromptDialog, setShowSavePromptDialog] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [showDeepThinkDialog, setShowDeepThinkDialog] = useState(false);
  const [deepThinkDraft, setDeepThinkDraft] = useState('');
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Skills state
  const [showSkillsMarket, setShowSkillsMarket] = useState(false);
  const [showHFSpaces, setShowHFSpaces] = useState(false);
  const [skillsRevision, setSkillsRevision] = useState(0);
  const { handleSkillEvent } = useSkillsUI();

  // ═══════════════════════════════════════════
  // HOOKS
  // ═══════════════════════════════════════════
  const { showScrollBottom, isAtBottomRef, chatEndRef, handleScroll, scrollToBottom } = useScroll();
  const { tokenCount, setTokenCount, isCountingTokens, countTokens, scheduleTokenCount } = useTokenCounter();
  const { showMemoryModal, setShowMemoryModal } = useMemory();
  const {
    openFiles: feOpenFiles, setOpenFiles: feSetOpenFiles,
    activeFileId: feActiveFileId, setActiveFileId: feSetActiveFileId,
    showFileEditor: feShowFileEditor, setShowFileEditor: feSetShowFileEditor,
    pendingEdits: fePendingEdits, setPendingEdits: feSetPendingEdits,
    checkFilesForEditor,
  } = useFileEditor(currentChatId);

  // Sync file editor state from hook
  useEffect(() => {
    if (feOpenFiles.length !== openFiles.length || JSON.stringify(feOpenFiles) !== JSON.stringify(openFiles)) {
      setOpenFiles(feOpenFiles);
    }
    if (feActiveFileId !== activeFileId) setActiveFileId(feActiveFileId);
    if (feShowFileEditor !== showFileEditor) setShowFileEditor(feShowFileEditor);
  }, [feOpenFiles, feActiveFileId, feShowFileEditor]);

  const rpgProfile = useRPGProfile(model, selectedApiKey);

  const deepThink = useDeepThink();
  const arena = useArena(apiKeys, providers, activeModel, allModels, { enabled: ghostNudgeEnabled, maxRetries: ghostNudgeMaxRetries });

  // ═══════════════════════════════════════════
  // INIT: Delegate to child hooks + load chat
  // ═══════════════════════════════════════════
  // useSettings и useChat уже загрузили данные из localStorage.
  // Осталось только применить настройки загруженного чата.
  useEffect(() => {
    const applyLoadedChat = async () => {
      const loadedChat = await loadChats();
      if (loadedChat) {
        // Применить настройки чата к settings
        if (loadedChat.systemPrompt) setSystemPrompt(loadedChat.systemPrompt);
        if (loadedChat.deepThinkSystemPrompt) setDeepThinkSystemPrompt(loadedChat.deepThinkSystemPrompt);
        if (loadedChat.tools) setTools(loadedChat.tools);
        if (loadedChat.temperature != null) setTemperature(loadedChat.temperature);
        if (loadedChat.model) {
          setActiveModel({ providerId: getActiveProviderId(), modelId: loadedChat.model });
        }
      }
    };
    applyLoadedChat();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved prompts
  useEffect(() => { setSavedPrompts(loadSystemPrompts()); }, []);

  // Update deepThinkDraft when dialog opens
  useEffect(() => {
    if (!showDeepThinkDialog) return;
    setDeepThinkDraft(deepThinkSystemPrompt || loadDeepThinkSystemPrompt() || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
  }, [showDeepThinkDialog, deepThinkSystemPrompt]);

  // Restore & persist appMode
  useEffect(() => {
    const saved = localStorage.getItem('gemini_app_mode') as 'chat' | 'arena' | 'agents' | 'agents_history' | null;
    if (saved === 'arena') setAppMode('arena');
    else if (saved === 'agents') setAppMode('agents');
    else if (saved === 'agents_history') setAppMode('agents_history');
  }, []);
  useEffect(() => { localStorage.setItem('gemini_app_mode', appMode); }, [appMode]);

  // Persist settings — delegated to useSettings hook (already handles this)
  // Sidebar state persistence
  useEffect(() => { localStorage.setItem('gemini_chats_sidebar', chatSidebarOpen.toString()); }, [chatSidebarOpen]);
  useEffect(() => { localStorage.setItem('gemini_settings_sidebar', settingsSidebarOpen.toString()); }, [settingsSidebarOpen]);

  // Detect mobile
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const applyViewportMode = (mobile: boolean) => {
      setIsMobile(prev => {
        if (prev !== mobile && mobile) {
          setChatSidebarOpen(false);
          setSettingsSidebarOpen(false);
        }
        return mobile;
      });
    };
    applyViewportMode(query.matches);
    const onMediaChange = (event: MediaQueryListEvent) => applyViewportMode(event.matches);
    query.addEventListener('change', onMediaChange);
    return () => query.removeEventListener('change', onMediaChange);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (messages.length === 0 || !isAtBottomRef.current) return;
    chatEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages, isStreaming]);

  // Mark unsaved
  useEffect(() => {
    if (messages.length > 0) setUnsaved(true);
  }, [messages]);

  // ═══════════════════════════════════════════
  // SIDEBAR PROPS BUILDER
  // ═══════════════════════════════════════════
  const settingsSidebarProps = {
    providers,
    onProvidersChange: (newProviders: Provider[]) => {
      setProviders(newProviders);
      newProviders.filter(p => !p.isBuiltin).forEach(p => saveCustomProvider(p));
    },
    activeProviderId,
    onActiveProviderChange: (id: string) => {
      setActiveProviderId(id);
    },
    apiKeys,
    onApiKeysChange: (providerId: string, keys: ApiKeyEntry[]) => {
      setApiKeys(prev => ({ ...prev, [providerId]: keys }));
      saveApiKeys(providerId, keys);
    },
    activeKeyIndex,
    onActiveKeyIndexChange: (providerId: string, idx: number) => {
      setActiveKeyIndex(prev => ({ ...prev, [providerId]: idx }));
    },
    activeModel,
    onActiveModelChange: (m: ActiveModel) => {
      setActiveModel(m);
    },
    allModels,
    onModelsLoad: (providerId: string, loadedModels: UniversalModel[]) => {
      setAllModels(prev => [...prev.filter(m => m.providerId !== providerId), ...loadedModels]);
      saveModelsCache({ providerId, models: loadedModels, fetchedAt: Date.now() });
    },
    onRefreshModels: async (providerId: string) => {
      const provider = providers.find(p => p.id === providerId);
      const providerKeys = apiKeys[providerId] || [];
      const keyIdx = activeKeyIndex[providerId] || 0;
      const key = providerKeys[keyIdx]?.key;
      if (!key || !provider) return;
      try {
        if (provider.type === 'gemini') {
          const res = await fetch(`/api/models?apiKey=${encodeURIComponent(key)}`);
          const data = await res.json();
          if (res.ok && data.models) {
            const geminiModels: UniversalModel[] = data.models.map((m: any) => ({
              id: m.name, displayName: m.displayName, providerId,
              inputTokenLimit: m.inputTokenLimit, outputTokenLimit: m.outputTokenLimit,
              supportedGenerationMethods: m.supportedGenerationMethods,
            }));
            settingsSidebarProps.onModelsLoad(providerId, geminiModels);
          }
        } else {
          const res = await fetch(`/api/openai-models?apiKey=${encodeURIComponent(key)}&baseUrl=${encodeURIComponent(provider.baseUrl)}`);
          const data = await res.json();
          if (res.ok && data.models) {
            const openaiModels: UniversalModel[] = data.models.map((m: any) => ({
              id: m.id, displayName: m.displayName, providerId, inputTokenLimit: m.inputTokenLimit,
            }));
            settingsSidebarProps.onModelsLoad(providerId, openaiModels);
          }
        }
      } catch (error) { console.error('Failed to refresh models:', error); }
    },
    systemPrompt,
    onSystemPromptChange: setSystemPrompt,
    tools,
    onToolsChange: setTools,
    onOpenToolBuilder: (tool?: ChatTool) => { setEditingTool(tool || null); setShowToolBuilder(true); },
    onOpenSavePromptDialog: () => { setNewPromptName(''); setShowSavePromptDialog(true); },
    onOpenDeepThinkDialog: () => setShowDeepThinkDialog(true),
    onOpenMemoryModal: () => setShowMemoryModal(true),
    onOpenSkillsMarket: () => setShowSkillsMarket(true),
    onOpenHFSpaces: () => setShowHFSpaces(true),
    deepThinkSystemPrompt,
    onDeepThinkSystemPromptChange: setDeepThinkSystemPrompt,
    temperature,
    onTemperatureChange: setTemperature,
    thinkingBudget,
    onThinkingBudgetChange: setThinkingBudget,
    tokenCount,
    isCountingTokens,
    isStreaming,
    savedChats,
    onSavedChatsChange: (chats: SavedChat[]) => {
      updateSavedChats(chats);
    },
    currentChatId,
    onLoadChat: null as any, // будет установлен из page.tsx
    onNewChat: null as any,
    onDeleteChat: null as any,
    memoryEnabled,
    onMemoryEnabledChange: setMemoryEnabled,
    maxToolRounds,
    onMaxToolRoundsChange: setMaxToolRounds,
    maxMemoryCalls,
    onMaxMemoryCallsChange: setMaxMemoryCalls,
    ghostNudgeEnabled,
    onGhostNudgeEnabledChange: setGhostNudgeEnabled,
    ghostNudgeMaxRetries,
    onGhostNudgeMaxRetriesChange: setGhostNudgeMaxRetries,
    onSkillsChanged: () => setSkillsRevision(r => r + 1),
  };

  const chatSidebarArenaProps = {
    appMode,
    onAppModeChange: setAppMode,
    arenaSessions: arena.sessions,
    activeArenaSessionId: arena.activeSessionId,
    onLoadArenaSession: arena.loadSession,
    onNewArenaSession: arena.createSession,
    onDeleteArenaSession: arena.deleteSession,
  };

  // ═══════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════
  return {
    // Settings
    providers, setProviders, activeProviderId, setActiveProviderId,
    apiKeys, setApiKeys, activeKeyIndex, setActiveKeyIndex,
    activeModel, setActiveModel, allModels, setAllModels,
    model, models, effectiveProviderId, currentProviderKeys, currentKeyIndex,
    selectedApiKeyEntry, selectedApiKey, selectedApiKeySuffix, activeProvider,
    systemPrompt, setSystemPrompt, tools, setTools,
    deepThinkSystemPrompt, setDeepThinkSystemPrompt,
    temperature, setTemperature, thinkingBudget, setThinkingBudget,
    maxOutputTokens, setMaxOutputTokens,
    memoryEnabled, setMemoryEnabled, maxToolRounds, setMaxToolRounds,
    maxMemoryCalls, setMaxMemoryCalls,
    ghostNudgeEnabled, setGhostNudgeEnabled, ghostNudgeMaxRetries, setGhostNudgeMaxRetries,
    savedPrompts, setSavedPrompts,

    // Chat — delegated to useChat hook
    messages, setMessages, messagesRef,
    savedChats, setSavedChats,
    currentChatId, setCurrentChatId, chatTitle, setChatTitle, unsaved, setUnsaved,
    saveChat, deleteChat, clearChat, loadChats, updateSavedChats,

    // Streaming / UI
    isStreaming, setIsStreaming, streamingId, setStreamingId,
    error, setError, abortControllerRef,
    showLiveCanvas, setShowLiveCanvas, liveCode, setLiveCode,
    websiteType, setWebsiteType, showInsights, setShowInsights,
    livePreviewRef,

    // File Editor
    openFiles, setOpenFiles, activeFileId, setActiveFileId,
    showFileEditor, setShowFileEditor, pendingEdits, setPendingEdits,
    checkFilesForEditor,

    // Mobile Canvas
    mobileCanvasState, setMobileCanvasState, pendingCanvasElement, setPendingCanvasElement,

    // Arena
    appMode, setAppMode, arena,

    // UI State
    showToolBuilder, setShowToolBuilder, editingTool, setEditingTool,
    showSavePromptDialog, setShowSavePromptDialog, newPromptName, setNewPromptName,
    showDeepThinkDialog, setShowDeepThinkDialog, deepThinkDraft, setDeepThinkDraft,
    chatSidebarOpen, setChatSidebarOpen,
    settingsSidebarOpen, setSettingsSidebarOpen,
    isMobile, setIsMobile,
    showSkillsMarket, setShowSkillsMarket, showHFSpaces, setShowHFSpaces,
    skillsRevision, setSkillsRevision,
    handleSkillEvent,

    // Scroll
    showScrollBottom, isAtBottomRef, chatEndRef, handleScroll, scrollToBottom,

    // Token Counter
    tokenCount, setTokenCount, isCountingTokens, countTokens, scheduleTokenCount,

    // Memory
    showMemoryModal, setShowMemoryModal,

    // DeepThink
    deepThink,

    // Sidebar props
    settingsSidebarProps,
    chatSidebarArenaProps,
  };
}
