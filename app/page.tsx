'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChatSidebar, SettingsSidebar } from '@/components/Sidebar';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import { ToolBuilderModal } from '@/components/ToolBuilder';
import MemoryModal from '@/components/MemoryModal';
import MemoryPill from '@/components/MemoryPill';
import ImageMemoryPill from '@/components/ImageMemoryPill';
import ImageMemoryRecallPill from '@/components/ImageMemoryRecallPill';
import {
  PanelLeft, MessageSquarePlus, Sparkles, Trash2, AlertCircle,
  SlidersHorizontal,
  Save, X, ArrowDown, RefreshCw, MonitorPlay
} from 'lucide-react';
// @ts-ignore
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import LivePreviewPanel from '@/components/LivePreviewPanel';
import FileEditorCanvas from '@/components/FileEditorCanvas';
import { useDeepThink } from '@/lib/useDeepThink';
import DeepThinkToggle from '@/components/DeepThinkToggle';
import type { ChatTool, Message, GeminiModel, AttachedFile, Part, ApiKeyEntry, SavedChat, DeepThinkAnalysis, ToolResponse, SavedSystemPrompt, SkillArtifact, CanvasElement, WebsiteType, OpenFile, FileDiffOp } from '@/types';
import {
  loadApiKeys, saveApiKeys, isRateLimitError,
} from '@/lib/apiKeyManager';
import {
  loadSavedChats, saveChatToStorage, deleteChatFromStorage,
  getActiveChatId, setActiveChatId,
  loadDeepThinkSystemPrompt,
  saveDeepThinkSystemPrompt,
  loadSystemPrompts,
  saveSystemPrompts,
  createSystemPrompt,
  revokePreviewUrls,
} from '@/lib/storage';
import {
  DEFAULT_DEEPTHINK_SYSTEM_PROMPT,
  DEEPTHINK_MEMORY_MARKER,
  buildChatRequestMessages,
  getVisibleMessageText,
  isThoughtPart,
  normalizeToolResponseInput,
} from '@/lib/gemini';
import { buildMemoryPrompt, markMemoriesUsed } from '@/lib/memory-prompt';
import { MEMORY_TOOLS, IMAGE_MEMORY_TOOLS } from '@/lib/memory-tools';
import { saveMemory, updateMemory, forgetMemory, getMemories } from '@/lib/memory-store';
import { 
  saveImageMemory, 
  searchImageMemories, 
  getImageMemory, 
  loadImageMemoryData,
  incrementImageMemoryMentions 
} from '@/lib/image-memory-store';
import { getImageDimensions } from '@/lib/image-utils';
import { buildImageContext } from '@/lib/image-context';
import { collectImages } from '@/lib/image-context';
import { cropAndScale } from '@/lib/skills/built-in/image-analyser/cropper';
// Skills system
import {
  collectSkillTools,
  buildSkillsSystemPrompt,
  executeSkillToolCall,
  notifySkillsMessageComplete,
  isSkillToolCall,
  reloadHFSpaceSkills,
} from '@/lib/skills';
import { useSkillsUI } from '@/lib/useSkillsUI';
import { SkillsMarket } from '@/components/SkillsMarket';
import { HFSpaceManager } from '@/components/HFSpaceManager';

function generateId() {
  // Используем crypto.randomUUID для гарантированной уникальности
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback для старых браузеров
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const ACTIVE_API_KEY_INDEX_STORAGE_KEY = 'gemini_active_key_index';

function generateToolCallId(name: string, args: unknown) {
  return `${name}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function getApiKeySuffix(key?: string | null): string {
  return key ? key.slice(-4) : '';
}

function sanitizeApiKeys(keys: ApiKeyEntry[]): ApiKeyEntry[] {
  return keys.map(({ blockedUntil: _blockedUntil, blockedByModel: _blockedByModel, ...entry }) => ({
    ...entry,
    blockedUntil: undefined,
    blockedByModel: undefined,
  }));
}

function generateChatTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'Новый чат';
  const text = getVisibleMessageText(firstUser.parts);
  if (!text) return 'Новый чат';
  return text.slice(0, 50).trim() + (text.length > 50 ? '…' : '');
}

// Построить улучшенный промпт из анализа
function buildEnhancedPromptFromAnalysis(analysis: DeepThinkAnalysis): string {
  return `${analysis.enhancedSystemPrompt}

---
[DeepThink — Внутренний план для идеального ответа]

${analysis.characterDetails ? `Персонаж: ${analysis.characterDetails}\n` : ''}Стиль пользователя: ${analysis.userStyle}
Настроение: ${analysis.mood}
Реальное намерение: ${analysis.realIntent}

ЧТО СКАЗАТЬ СЕЙЧАС: ${analysis.revealNow || analysis.answerStrategy}
ЧТО ПРИБЕРЕЧЬ НА ПОТОМ: ${analysis.revealLater || 'продолжать естественно'}

Стратегия ответа: ${analysis.answerStrategy}
Тон и стиль: ${analysis.toneAdvice}
${analysis.futureStrategy ? `План на будущее: ${analysis.futureStrategy}` : ''}

ВАЖНО: Используй этот план для ответа. Не упоминай анализ явно — просто воплоти его.
---`;
}

export default function Home() {
  // API Keys (multiple)
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [activeKeyIndex, setActiveKeyIndex] = useState(0);

  // Model
  const [model, setModel] = useState<string>('');
  const [models, setModels] = useState<GeminiModel[]>([]);

  // Settings
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [tools, setTools] = useState<ChatTool[]>([]);
  const [showToolBuilder, setShowToolBuilder] = useState(false);
  const [editingTool, setEditingTool] = useState<ChatTool | null>(null);
  const [showSavePromptDialog, setShowSavePromptDialog] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [savedPrompts, setSavedPrompts] = useState<SavedSystemPrompt[]>([]);
  const [showDeepThinkDialog, setShowDeepThinkDialog] = useState(false);
  const [deepThinkDraft, setDeepThinkDraft] = useState('');
  const [deepThinkSystemPrompt, setDeepThinkSystemPrompt] = useState<string>(DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState<number>(1.0);
  const [thinkingBudget, setThinkingBudget] = useState<number>(-1); // -1=авто
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(8192);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [showMemoryModal, setShowMemoryModal] = useState(false);

  // Skills state
  const [showSkillsMarket, setShowSkillsMarket] = useState(false);
  const [showHFSpaces, setShowHFSpaces] = useState(false);
  const [skillsRevision, setSkillsRevision] = useState(0); // триггер пересборки tools
  const { handleSkillEvent } = useSkillsUI();

  // UI state
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [isCountingTokens, setIsCountingTokens] = useState(false);
  const [error, setError] = useState<string>('');
  const [showLiveCanvas, setShowLiveCanvas] = useState(false);
  const [liveCode, setLiveCode] = useState('');
  const [websiteType, setWebsiteType] = useState<WebsiteType>(null);
  
  // File Editor state
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [showFileEditor, setShowFileEditor] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Map<string, FileDiffOp[]>>(new Map());
  
  // Mobile canvas state: 'hidden' | 'sheet' (55%) | 'fullscreen'
  type MobileCanvasState = 'hidden' | 'sheet' | 'fullscreen';
  const [mobileCanvasState, setMobileCanvasState] = useState<MobileCanvasState>('hidden');
  
  const [pendingCanvasElement, setPendingCanvasElement] = useState<CanvasElement | null>(null);

  // Saved chats
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState('');
  const [unsaved, setUnsaved] = useState(false);

  // Scroll state
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isAtBottomRef = useRef(true);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceToBottom <= 40;
    isAtBottomRef.current = atBottom;

    if (distanceToBottom > 150) {
      setShowScrollBottom(true);
    } else {
      setShowScrollBottom(false);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const tokenDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const livePreviewRef = useRef<any>(null);
  const messagesRef = useRef<Message[]>([]); // Keep latest messages to avoid stale closure

  const { state: deepThinkState, toggle: toggleDeepThink, analyze: deepThinkAnalyze, abort: abortDeepThink } = useDeepThink();
  const selectedApiKeyEntry = apiKeys[activeKeyIndex] || null;
  const selectedApiKey = selectedApiKeyEntry?.key || '';
  const selectedApiKeySuffix = getApiKeySuffix(selectedApiKeyEntry?.key);

  // Keep messagesRef in sync with messages state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Detect mobile only when crossing breakpoint.
  // Keyboard open/close on mobile fires resize, so we avoid closing panels on every resize event.
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

    const onMediaChange = (event: MediaQueryListEvent) => {
      applyViewportMode(event.matches);
    };

    query.addEventListener('change', onMediaChange);
    return () => query.removeEventListener('change', onMediaChange);
  }, []);

  // Load from localStorage
  useEffect(() => {
    const loadData = async () => {
      const keys = sanitizeApiKeys(loadApiKeys());
      setApiKeys(keys);
      saveApiKeys(keys);
      const savedActiveKeyIndex = parseInt(localStorage.getItem(ACTIVE_API_KEY_INDEX_STORAGE_KEY) || '0', 10);
      if (keys.length > 0 && Number.isFinite(savedActiveKeyIndex)) {
        setActiveKeyIndex(Math.min(Math.max(savedActiveKeyIndex, 0), keys.length - 1));
      }

      const savedModel = localStorage.getItem('gemini_model');
      const savedSysPrompt = localStorage.getItem('gemini_sys_prompt');
      const savedTemp = localStorage.getItem('gemini_temperature');
      const savedLegacySidebar = localStorage.getItem('gemini_sidebar');
      const savedChatSidebar = localStorage.getItem('gemini_chats_sidebar');
      const savedSettingsSidebar = localStorage.getItem('gemini_settings_sidebar');
      const savedThinking = localStorage.getItem('gemini_thinking_budget');
      const savedMemoryEnabled = localStorage.getItem('gemini_memory_enabled');
      const savedDeepThinkPrompt = loadDeepThinkSystemPrompt();
      const mobileViewport = window.matchMedia('(max-width: 767px)').matches;

      if (savedModel) setModel(savedModel);
      if (savedSysPrompt) setSystemPrompt(savedSysPrompt);
      if (savedTemp) setTemperature(parseFloat(savedTemp));
      setDeepThinkSystemPrompt(savedDeepThinkPrompt || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
      if (!mobileViewport) {
        if (savedChatSidebar !== null) setChatSidebarOpen(savedChatSidebar === 'true');
        else if (savedLegacySidebar !== null) setChatSidebarOpen(savedLegacySidebar === 'true');
        if (savedSettingsSidebar !== null) setSettingsSidebarOpen(savedSettingsSidebar === 'true');
      }
      if (savedThinking !== null) setThinkingBudget(parseInt(savedThinking));
      if (savedMemoryEnabled !== null) setMemoryEnabled(savedMemoryEnabled === 'true');

      const chats = await loadSavedChats();
      setSavedChats(chats);

      const activeChatId = getActiveChatId();
      if (activeChatId) {
        const chat = chats.find(c => c.id === activeChatId);
        if (chat) {
          setMessages(chat.messages);
          setCurrentChatId(chat.id);
          setChatTitle(chat.title);
          setModel(chat.model || savedModel || '');
          setSystemPrompt(chat.systemPrompt || savedSysPrompt || '');
          setDeepThinkSystemPrompt(chat.deepThinkSystemPrompt || savedDeepThinkPrompt || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
          setTools(chat.tools || []);
          setTemperature(chat.temperature ?? parseFloat(savedTemp || '1'));
        }
      }
    };
    loadData();
  }, []);

  // Load saved prompts
  useEffect(() => {
    setSavedPrompts(loadSystemPrompts());
  }, []);

  // Update deepThinkDraft when dialog opens
  useEffect(() => {
    if (!showDeepThinkDialog) return;
    setDeepThinkDraft(deepThinkSystemPrompt || loadDeepThinkSystemPrompt() || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
  }, [showDeepThinkDialog, deepThinkSystemPrompt]);

  // Persist simple settings
  useEffect(() => { if (model) localStorage.setItem('gemini_model', model); }, [model]);
  useEffect(() => { localStorage.setItem('gemini_sys_prompt', systemPrompt); }, [systemPrompt]);
  useEffect(() => { localStorage.setItem('gemini_temperature', temperature.toString()); }, [temperature]);
  useEffect(() => { localStorage.setItem(ACTIVE_API_KEY_INDEX_STORAGE_KEY, activeKeyIndex.toString()); }, [activeKeyIndex]);
  useEffect(() => { localStorage.setItem('gemini_chats_sidebar', chatSidebarOpen.toString()); }, [chatSidebarOpen]);
  useEffect(() => { localStorage.setItem('gemini_settings_sidebar', settingsSidebarOpen.toString()); }, [settingsSidebarOpen]);
  useEffect(() => { localStorage.setItem('gemini_thinking_budget', thinkingBudget.toString()); }, [thinkingBudget]);
  useEffect(() => { localStorage.setItem('gemini_memory_enabled', memoryEnabled.toString()); }, [memoryEnabled]);

  useEffect(() => {
    if (apiKeys.length === 0) {
      if (activeKeyIndex !== 0) setActiveKeyIndex(0);
      return;
    }

    if (activeKeyIndex >= apiKeys.length) {
      setActiveKeyIndex(apiKeys.length - 1);
    }
  }, [apiKeys.length, activeKeyIndex]);

  // Auto-scroll (only when user is near bottom; avoid smooth on every streamed chunk)
  useEffect(() => {
    if (messages.length === 0) return;
    if (!isAtBottomRef.current) return;
    chatEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages, isStreaming]);

  // Mark unsaved when messages change
  useEffect(() => {
    if (messages.length > 0) setUnsaved(true);
  }, [messages]);

  // Token counting
  const tokenCountRequestIdRef = useRef(0);
  const tokenCountAbortRef = useRef<AbortController | null>(null);
  
  const countTokens = useCallback(async (msgs: Message[], sys: string, mod: string, apiKey: string) => {
    if (!apiKey || !mod || msgs.length === 0) { setTokenCount(0); return; }
    
    // Cancel previous request
    if (tokenCountAbortRef.current) {
      tokenCountAbortRef.current.abort();
    }
    
    // Increment request ID to track latest request
    const requestId = ++tokenCountRequestIdRef.current;
    const abortController = new AbortController();
    tokenCountAbortRef.current = abortController;
    
    setIsCountingTokens(true);
    
    // Строим полный системный промпт с memory + skills
    const userMessages = msgs
      .filter(m => m.role === 'user')
      .map(m => getVisibleMessageText(m.parts));
    
    const { prompt: memoryPrompt, usedMemoryIds: _usedMemoryIds, usedImageMemoryIds: _usedImageMemoryIds } = buildMemoryPrompt(
      userMessages,
      currentChatId || undefined,
      memoryEnabled
    );
    
    const skillsPromptInjection = buildSkillsSystemPrompt(
      currentChatId || '',
      msgs,
      handleSkillEvent
    );
    
    // Добавляем контекст изображений
    const imageContext = buildImageContext(msgs);
    
    let effectiveSystemPrompt = sys;
    if (memoryPrompt) {
      effectiveSystemPrompt = memoryPrompt + '\n\n' + sys;
    }
    if (skillsPromptInjection) {
      effectiveSystemPrompt = effectiveSystemPrompt + skillsPromptInjection;
    }
    if (imageContext) {
      effectiveSystemPrompt = effectiveSystemPrompt + imageContext;
    }
    
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: buildChatRequestMessages(msgs),
          model: mod,
          systemInstruction: effectiveSystemPrompt, // Используем полный промпт
          apiKey,
        }),
      });
      const data = await res.json();
      
      // Only update if this is still the latest request
      if (requestId === tokenCountRequestIdRef.current) {
        setTokenCount(data.totalTokens || 0);
      }
    } catch (e: any) {
      // Ignore abort errors
      if (e.name !== 'AbortError') {
        console.error('[Token Count Error]:', e);
      }
    }
    
    // Only clear loading state if this is still the latest request
    if (requestId === tokenCountRequestIdRef.current) {
      setIsCountingTokens(false);
      tokenCountAbortRef.current = null;
    }
  }, [currentChatId, memoryEnabled, handleSkillEvent]);

  useEffect(() => {
    if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current);
    if (isStreaming) return;
    tokenDebounceRef.current = setTimeout(() => {
      countTokens(messages, systemPrompt, model, selectedApiKey);
    }, 400);
    return () => { 
      if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current);
      // Cleanup abort controller on unmount
      if (tokenCountAbortRef.current) {
        tokenCountAbortRef.current.abort();
        tokenCountAbortRef.current = null;
      }
    };
  }, [messages, systemPrompt, model, selectedApiKey, countTokens, isStreaming, skillsRevision]);

  // ============ FILE EDITOR SYNC ============
  // Синхронизация openFiles с file-editor skill storage
  useEffect(() => {
    if (!currentChatId) return;
    
    // Ключ с привязкой к чату: skill_data_{skillId}_{chatId}_{key}
    const storageKey = `skill_data_file-editor_${currentChatId}_file_editor_open_files`;
    
    const syncFiles = () => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const files = JSON.parse(stored) as OpenFile[];
          console.log('[FILE EDITOR SYNC] Found files in storage:', files.length, files.map(f => f.name));
          setOpenFiles(prev => {
            // Проверяем, изменились ли файлы
            if (JSON.stringify(prev) !== JSON.stringify(files)) {
              console.log('[FILE EDITOR SYNC] Files changed, updating state');
              if (files.length > 0) {
                setShowFileEditor(true);
                console.log('[FILE EDITOR SYNC] Opening FileEditor');
                if (!activeFileId && files.length > 0) {
                  setActiveFileId(files[0].id);
                  console.log('[FILE EDITOR SYNC] Setting active file:', files[0].id);
                }
              } else {
                // Если файлов нет, закрываем редактор
                setShowFileEditor(false);
                setActiveFileId(null);
              }
              return files;
            }
            return prev;
          });
        } catch (e) {
          console.error('[FILE EDITOR SYNC] Failed to load open files:', e);
        }
      } else {
        // Если нет файлов в storage, очищаем state
        if (openFiles.length > 0) {
          console.log('[FILE EDITOR SYNC] No files in storage, clearing state');
          setOpenFiles([]);
          setShowFileEditor(false);
          setActiveFileId(null);
        }
      }
    };
    
    // Синхронизируем сразу
    syncFiles();
    
    // И каждые 500ms проверяем изменения
    const interval = setInterval(syncFiles, 500);
    
    return () => clearInterval(interval);
  }, [currentChatId, activeFileId, openFiles.length]);

  // Автоматически открываем FileEditor когда прикрепляется code-файл или текстовый файл
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user' && lastMessage.files) {
      const editableFiles = lastMessage.files.filter(f => 
        (f.mimeType.startsWith('text/') || f.mimeType === 'application/json') &&
        !openFiles.some(of => of.id === f.id)
      );
      
      if (editableFiles.length > 0) {
        setShowFileEditor(true);
      }
    }
  }, [messages, openFiles]);

  // ============ SAVE CHAT ============
  const saveCurrentChat = useCallback(async (msgs: Message[], title?: string, updateCurrentId: boolean = true) => {
    if (msgs.length === 0) return;
    const chatId = currentChatId || generateId();
    const chatObj: SavedChat = {
      id: chatId,
      title: title || chatTitle || generateChatTitle(msgs),
      messages: msgs,
      model,
      systemPrompt,
      deepThinkSystemPrompt,
      tools,
      temperature,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Если чат уже существует, сохраняем createdAt
    const existing = savedChats.find(c => c.id === chatId);
    if (existing) chatObj.createdAt = existing.createdAt;

    await saveChatToStorage(chatObj);
    
    // Оптимизация: обновляем savedChats локально вместо перезагрузки всех чатов
    setSavedChats(prev => {
      const idx = prev.findIndex(c => c.id === chatId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = chatObj;
        return updated;
      }
      return [...prev, chatObj];
    });
    
    // Обновляем currentChatId только если это не создание нового чата
    if (updateCurrentId) {
      setCurrentChatId(chatId);
      setActiveChatId(chatId);
      setChatTitle(chatObj.title);
    }
    
    setUnsaved(false);
    return chatObj;
  }, [currentChatId, chatTitle, model, systemPrompt, deepThinkSystemPrompt, tools, temperature, savedChats]);

  // ============ STREAMING ============
  const streamGeneration = useCallback(async (
    history: Message[],
    targetMessageId: string,
    isAppending: boolean,
    customAnalysis?: DeepThinkAnalysis, // Кастомный анализ после редактирования
  ) => {
    // Получить следующий доступный ключ
    const key = selectedApiKeyEntry?.key;
    const keySuffix = getApiKeySuffix(key);
    if (!key) {
      setError('Выберите API ключ в настройках.');
      setIsStreaming(false);
      setStreamingId(null);
      return;
    }


    // Отметить ключ как используемый

    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    setStreamingId(targetMessageId);
    setError('');
    setMessages(prev => prev.map(m =>
      m.id !== targetMessageId ? m : { ...m, apiKeySuffix: keySuffix || undefined, modelName: model }
    ));

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Память — добавляем в системный промпт
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const userMessages = history
      .filter(m => m.role === 'user')
      .map(m => getVisibleMessageText(m.parts));
    
    const { prompt: memoryPrompt, usedMemoryIds, usedImageMemoryIds } = buildMemoryPrompt(
      userMessages,
      currentChatId || undefined,
      memoryEnabled
    );

    // Отмечаем использованные воспоминания
    if (usedMemoryIds.length > 0 || usedImageMemoryIds.length > 0) {
      markMemoriesUsed(usedMemoryIds, usedImageMemoryIds, currentChatId || undefined);
    }

    // Skills System Prompt injection
    const skillsPromptInjection = buildSkillsSystemPrompt(
      currentChatId || '',
      messages,
      handleSkillEvent
    );

    // DeepThink Pass 1 — если включён, анализируем сначала
    let effectiveSystemPrompt = systemPrompt;
    if (memoryPrompt) {
      effectiveSystemPrompt = memoryPrompt + '\n\n' + systemPrompt;
    }
    if (skillsPromptInjection) {
      effectiveSystemPrompt = effectiveSystemPrompt + skillsPromptInjection;
    }
    
    // ВАЖНО: imageContext добавляется ВНУТРИ tool loop, так как он должен обновляться
    // после каждого zoom_region вызова (новые изображения добавляются в историю)
    let finalAnalysis: DeepThinkAnalysis | null = null;
    
    if (deepThinkState.enabled && !customAnalysis) {
      // Показываем визуально, что идет анализ - создаем пустое сообщение с deepThinking
      setMessages(prev => prev.map(m =>
        m.id !== targetMessageId ? m : {
          ...m,
          parts: [{ text: '' }],
          deepThinking: '',
          isStreaming: true,
        }
      ));

      const dtResult = await deepThinkAnalyze(
        history,
        effectiveSystemPrompt, // Передаём с памятью!
        key,
        model,
        deepThinkSystemPrompt,
        (thinking: string) => {
          setMessages(prev => prev.map(m =>
            m.id !== targetMessageId ? m : {
              ...m,
              deepThinking: thinking,
              isStreaming: true,
            }
          ));
        }
      );

      effectiveSystemPrompt = dtResult.enhancedPrompt;
      finalAnalysis = dtResult.analysis;
      
      if (dtResult.error) {
        // Записываем ошибку прямо в сообщение
        setMessages(prev => prev.map(m =>
          m.id !== targetMessageId ? m : {
            ...m,
            deepThinkError: dtResult.error || 'DeepThink failed',
          }
        ));
        setError(`DeepThink Error: ${dtResult.error}`);
      }

      if (finalAnalysis) {
        setMessages(prev => prev.map(m =>
          m.id !== targetMessageId ? m : {
            ...m,
            deepThinkAnalysis: finalAnalysis || undefined,
            isStreaming: true,
          }
        ));
      }
    } else if (customAnalysis) {
      // Используем кастомный анализ после редактирования
      finalAnalysis = customAnalysis;
      effectiveSystemPrompt = buildEnhancedPromptFromAnalysis(customAnalysis);
      
      // Обновляем анализ в сообщении
      setMessages(prev => prev.map(m =>
        m.id !== targetMessageId ? m : {
          ...m,
          deepThinkAnalysis: customAnalysis,
          parts: [{ text: '' }], // Очищаем старый ответ
          thinking: undefined, // Очищаем старые размышления
          isStreaming: true,
        }
      ));
    }

    // Cleanup tracker для таймеров
    const cleanupTimers: ReturnType<typeof setTimeout>[] = [];
    
    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Tool loop — поддерживает несколько раундов memory tool calls
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      // Накапливаем toolCalls/toolResponses между раундами
      let accumulatedToolCalls: any[] = [];
      let accumulatedToolResponses: any[] = [];
      let memoryCallsThisTurn = 0;
      const MAX_MEMORY_CALLS = 100; // Увеличен лимит до 100
      let shouldContinueLoop = true;
      
      while (shouldContinueLoop) {
        shouldContinueLoop = false; // по умолчанию — выходим после одного прохода
        
        // Строим историю с накопленными tool calls/responses от предыдущих раундов
        const messagesForRequest = buildChatRequestMessages(history);
        
        // Если есть накопленные tool responses — добавляем их как отдельный turn
        // (assistant turn с functionCall + user turn с functionResponse)
        let contentsForRequest = messagesForRequest;
        if (accumulatedToolCalls.length > 0 && accumulatedToolResponses.length > 0) {
          // Добавляем assistant turn с functionCalls (включая thoughtSignature из оригинального вызова)
          contentsForRequest = [
            ...messagesForRequest,
            {
              role: 'model',
              parts: accumulatedToolCalls.map(tc => ({
                functionCall: { id: tc.id, name: tc.name, args: tc.args },
                ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
              })),
            },
            {
              role: 'user',
              parts: accumulatedToolResponses.flatMap(tr => {
                const parts: any[] = [{
                  functionResponse: {
                    id: tr.toolCallId,
                    name: tr.name,
                    response: tr.response,
                  },
                }];
                // Добавляем sibling parts для Gemini 2.x (например, изображения)
                if (tr.extraParts) {
                  parts.push(...tr.extraParts);
                }
                return parts;
              }),
            },
          ];
        }
        
        // Собираем skill tools
        const skillTools = collectSkillTools();
        
        // Добавляем контекст изображений ВНУТРИ цикла (обновляется после каждого zoom)
        const imageContext = buildImageContext(history);
        let effectiveSystemPromptWithImages = effectiveSystemPrompt;
        if (imageContext) {
          effectiveSystemPromptWithImages = effectiveSystemPrompt + imageContext;
        }
        
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current!.signal,
          body: JSON.stringify({
            messages: contentsForRequest,
            model,
            systemInstruction: effectiveSystemPromptWithImages, // Используем с imageContext
            tools: tools,
            // После MAX_MEMORY_CALLS — отключаем memory tools чтобы не зациклиться
            memoryTools: [
              ...(memoryEnabled && memoryCallsThisTurn < MAX_MEMORY_CALLS ? MEMORY_TOOLS : []),
              ...(memoryEnabled && memoryCallsThisTurn < MAX_MEMORY_CALLS ? IMAGE_MEMORY_TOOLS : []),
              ...skillTools,
            ],
            temperature,
            apiKey: key,
            thinkingBudget,
            maxOutputTokens, // Добавляем настройку
            includeThoughts: deepThinkState.enabled === true,
          }),
        });
        
        // Debug: проверяем что IMAGE_MEMORY_TOOLS отправляются
        if (memoryEnabled && memoryCallsThisTurn < MAX_MEMORY_CALLS) {
          console.log('[DEBUG] Sending IMAGE_MEMORY_TOOLS:', IMAGE_MEMORY_TOOLS.map(t => t.name));
        }

        if (!response.ok) {
          setError(`API error: ${response.status}`);
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let thinkingAccumulator = isAppending ? (history.find(m => m.id === targetMessageId)?.thinking || '') : '';
        let pendingText = '';
        let pendingThinking = '';
        let flushScheduled = false;

        // Создаём imageAliases map для image memory tools
        const imageInfos = collectImages(history);
        const imageAliases = new Map<string, string>();
        imageInfos.forEach(info => {
          imageAliases.set(info.alias, info.id);
        });
        
        // attachedFiles для доступа к файлам
        // ВАЖНО: history уже включает текущее user-сообщение с файлами
        const attachedFiles = history
          .filter(m => m.role === 'user' && m.files && m.files.length > 0)
          .flatMap(m => m.files!)
          .map(f => ({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size,
            getData: async () => {
              // ФИКС: Сначала проверяем f.data (может быть в памяти)
              if (f.data) return f.data;
              // Загрузить из IndexedDB если нет в памяти
              const { loadFileData } = await import('@/lib/fileStorage');
              const loaded = await loadFileData(f.id);
              if (!loaded) {
                console.error(`[attachedFiles] Failed to load file data for ${f.id}`);
              }
              return loaded || '';
            }
          }));

        // streaming HTML в canvas
        let htmlAccumulator = '';
        let isInsideHtmlBlock = false;
        
        // tool calls собранные в этом раунде
        const roundToolCalls: any[] = [];

        const flush = () => {
          flushScheduled = false;
          if (!pendingText && !pendingThinking) return;

          const textChunk = pendingText;
          const thinkingChunk = pendingThinking;
          pendingText = '';
          pendingThinking = '';

          if (thinkingChunk) {
            thinkingAccumulator += thinkingChunk;
            setMessages(prev => prev.map(m =>
              m.id !== targetMessageId ? m : { ...m, thinking: thinkingAccumulator, isStreaming: true }
            ));
          }

          if (textChunk) {
            const chunk = textChunk;
            
            // 🔥 LIVE HTML STREAMING PARSER
            // Детектируем ```html блоки и обновляем preview в реальном времени
            const fullText = (htmlAccumulator + chunk);
            
            // Начало HTML блока
            if (!isInsideHtmlBlock && fullText.includes('```html')) {
              isInsideHtmlBlock = true;
              setShowLiveCanvas(true); // Автооткрытие canvas
            }
            
            if (isInsideHtmlBlock) {
              htmlAccumulator += chunk;
              
              // Конец блока
              const endMarkers = ['```\n', '```\r', '```\r\n', '``` ', '```<'];
              if (endMarkers.some(marker => htmlAccumulator.includes(marker))) {
                isInsideHtmlBlock = false;
              }
              
              // Извлекаем HTML (всё между ```html и ```)
              const htmlMatch = htmlAccumulator.match(/```(?:html)[\s\n]+([\s\S]*?)(?:```|$)/i);
              if (htmlMatch && htmlMatch[1]) {
                const partialHTML = htmlMatch[1];
                
                // Throttle: обновляем не чаще 80ms (оптимально для плавности)
                const timer = setTimeout(() => {
                  // Only update when we have meaningful HTML (at least has <body> tag or 200+ chars)
                  if (partialHTML.length > 200 || partialHTML.includes('<body')) {
                    setLiveCode(partialHTML);
                  }
                }, 80);
                cleanupTimers.push(timer);
              }
            }

            setMessages(prev => prev.map(m => {
              if (m.id !== targetMessageId) return m;
              const hasTextPart = m.parts.some(p => 'text' in p);
              if (hasTextPart) {
                return {
                  ...m,
                  parts: m.parts.map(p =>
                    'text' in p ? { text: (p as { text: string }).text + textChunk } : p
                  ),
                  isStreaming: true,
                };
              }
              return { ...m, parts: [...m.parts, { text: textChunk }], isStreaming: true };
            }));
          }
        };

        const scheduleFlush = () => {
          if (flushScheduled) return;
          flushScheduled = true;
          // Batch frequent stream chunks into a single React update per frame.
          requestAnimationFrame(flush);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);

            // Ошибка (Gemini / сеть / quota / invalid key ...)
            if (parsed.error) {
              const errMsg = String(parsed.error || 'Gemini API error');
              const isRl = Boolean(parsed.isRateLimit) || isRateLimitError(errMsg);
              const errType = (parsed.errorType as Message['errorType']) || (isRl ? 'rate_limit' : 'unknown');
              const errCode = typeof parsed.errorCode === 'number' ? parsed.errorCode : undefined;
              const errStatus = typeof parsed.errorStatus === 'string' ? parsed.errorStatus : undefined;

              // Playground UX: do NOT auto-block keys. Just inform the user.

              // Attach error to the message bubble.
              const retrySec = (errType === 'rate_limit' || errType === 'quota')
                ? (typeof parsed.retryAfterSeconds === 'number' && parsed.retryAfterSeconds > 0
                    ? parsed.retryAfterSeconds
                    : (() => {
                        const m = errMsg.match(/retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s/i);
                        const n = m ? Number(m[1]) : NaN;
                        return Number.isFinite(n) && n > 0 ? n : null;
                      })())
                : null;

              setMessages(prev => prev.map(m =>
                m.id !== targetMessageId ? m : {
                  ...m,
                  error: errMsg,
                  errorType: errType,
                  errorCode: errCode,
                  errorStatus: errStatus,
                  errorRetryAfterMs: retrySec ? Date.now() + Math.ceil(retrySec * 1000) : undefined,
                  isStreaming: false,
                }
              ));
              return;
            }

            // Контент заблокирован
            if (parsed.isBlocked) {
              setMessages(prev => prev.map(m =>
                m.id !== targetMessageId ? m : {
                  ...m,
                  isBlocked: true,
                  blockReason: parsed.finishReason,
                  finishReason: parsed.finishReason,
                  isStreaming: false,
                }
              ));
              continue;
            }

            // Размышления
            if (parsed.thinking) {
              pendingThinking += parsed.thinking;
              scheduleFlush();
            }

            // Вызов функции
            if (parsed.functionCall) {
              const { name, args } = parsed.functionCall;
              const callId = parsed.functionCall.id || generateToolCallId(name, args);
              
              // ── SKILL TOOL CALL ──────────────────────────────────────────
              if (isSkillToolCall(name)) {
                const skillResult = await executeSkillToolCall(
                  name,
                  args as Record<string, unknown>,
                  currentChatId || '',
                  history, // Используем history вместо messages — актуальный массив с текущим user сообщением
                  handleSkillEvent
                );
                
                // Добавляем артефакты в сообщение
                if (skillResult.artifacts.length > 0) {
                  setMessages(prev => prev.map(m => {
                    if (m.id !== targetMessageId) return m;
                    return {
                      ...m,
                      skillArtifacts: [...(m.skillArtifacts || []), ...skillResult.artifacts] as SkillArtifact[],
                    };
                  }));
                }
                
                if (skillResult.functionResponse !== null) {
                  // mode: 'respond' — добавляем toolResponse для следующего раунда
                  roundToolCalls.push({
                    id: callId,
                    name,
                    args,
                    thoughtSignature: parsed.thoughtSignature,
                  });
                  accumulatedToolResponses.push({
                    toolCallId: callId,
                    name,
                    response: skillResult.functionResponse,
                    extraParts: skillResult.responseParts, // sibling parts для Gemini 2.x
                    hidden: true, // не показываем в UI как обычный tool call
                  });
                  
                  // 🌐 Извлекаем website_type из set_website_meta
                  if (name === 'set_website_meta' && typeof skillResult.functionResponse === 'object' && skillResult.functionResponse !== null) {
                    const response = skillResult.functionResponse as any;
                    if (response.website_type) {
                      setWebsiteType(response.website_type as WebsiteType);
                    }
                  }
                  
                  // Добавляем в skillToolCalls для отображения в UI
                  setMessages(prev => prev.map(m => {
                    if (m.id !== targetMessageId) return m;
                    return {
                      ...m,
                      skillToolCalls: [...(m.skillToolCalls || []), {
                        name,
                        args: args as Record<string, unknown>,
                        result: skillResult.functionResponse,
                      }],
                    };
                  }));
                  
                  // После стрима сделаем ещё один раунд
                  shouldContinueLoop = true;
                } else {
                  // mode: 'fire_and_forget' — отправляем пустой ответ чтобы Gemini продолжил
                  roundToolCalls.push({
                    id: callId,
                    name,
                    args,
                    thoughtSignature: parsed.thoughtSignature,
                  });
                  accumulatedToolResponses.push({
                    toolCallId: callId,
                    name,
                    response: { status: 'acknowledged' },
                    hidden: true,
                  });
                  
                  // БАГ #3 FIX: Добавляем в skillToolCalls для отображения в UI
                  setMessages(prev => prev.map(m => {
                    if (m.id !== targetMessageId) return m;
                    return {
                      ...m,
                      skillToolCalls: [...(m.skillToolCalls || []), {
                        name,
                        args: args as Record<string, unknown>,
                        result: { status: 'acknowledged' },
                      }],
                    };
                  }));
                  
                  shouldContinueLoop = true;
                }
                continue; // не обрабатываем как обычный tool
              }
              // ─────────────────────────────────────────────────────────────
              
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // Обработка инструментов памяти - выполняем молча, добавляем скрытый functionResponse
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              const isMemoryTool = memoryEnabled && (name === 'save_memory' || name === 'update_memory' || name === 'forget_memory');
              
              if (isMemoryTool) {
                // Лимит вызовов за turn
                if (memoryCallsThisTurn >= MAX_MEMORY_CALLS) continue;
                memoryCallsThisTurn++;
                
                let memoryResult: { success: boolean; id?: string; error?: string } = { success: false };
                
                if (name === 'save_memory') {
                  try {
                    const memory = saveMemory(
                      {
                        fact: args.fact,
                        scope: args.scope,
                        category: args.category,
                        keywords: args.keywords || [],
                        confidence: args.confidence,
                        related_to: args.related_to || [],
                      },
                      args.scope === 'local' ? (currentChatId || undefined) : undefined
                    );
                    
                    memoryResult = { success: true, id: memory.id };
                    
                    setMessages(prev => prev.map(m => {
                      if (m.id !== targetMessageId) return m;
                      return {
                        ...m,
                        memoryOperations: [...(m.memoryOperations || []), {
                          type: 'save' as const,
                          scope: args.scope,
                          fact: args.fact,
                          category: args.category,
                          confidence: args.confidence,
                          memoryId: memory.id,
                        }],
                      };
                    }));
                  } catch (e) {
                    memoryResult = { success: false, error: String(e) };
                  }
                } else if (name === 'update_memory') {
                  try {
                    const allMems = [
                      ...getMemories('global'),
                      ...(currentChatId ? getMemories('local', currentChatId) : []),
                    ];
                    const oldMemory = allMems.find(m => m.id === args.id);
                    updateMemory(
                      args.id,
                      oldMemory?.scope || 'global',
                      { fact: args.fact, confidence: args.confidence },
                      oldMemory?.scope === 'local' ? (currentChatId || undefined) : undefined
                    );
                    memoryResult = { success: true, id: args.id };
                    setMessages(prev => prev.map(m => {
                      if (m.id !== targetMessageId) return m;
                      return {
                        ...m,
                        memoryOperations: [...(m.memoryOperations || []), {
                          type: 'update' as const,
                          scope: oldMemory?.scope || 'global',
                          fact: args.fact,
                          oldFact: oldMemory?.fact,
                          confidence: args.confidence,
                          memoryId: args.id,
                        }],
                      };
                    }));
                  } catch (e) {
                    memoryResult = { success: false, error: String(e) };
                  }
                } else if (name === 'forget_memory') {
                  try {
                    const allMems = [
                      ...getMemories('global'),
                      ...(currentChatId ? getMemories('local', currentChatId) : []),
                    ];
                    const memory = allMems.find(m => m.id === args.id);
                    if (memory) {
                      forgetMemory(
                        args.id,
                        memory.scope,
                        memory.scope === 'local' ? (currentChatId || undefined) : undefined
                      );
                      memoryResult = { success: true, id: args.id };
                      setMessages(prev => prev.map(m => {
                        if (m.id !== targetMessageId) return m;
                        return {
                          ...m,
                          memoryOperations: [...(m.memoryOperations || []), {
                            type: 'forget' as const,
                            scope: memory.scope,
                            fact: memory.fact,
                            reason: args.reason,
                            memoryId: args.id,
                          }],
                        };
                      }));
                    } else {
                      memoryResult = { success: false, error: 'Memory not found' };
                    }
                  } catch (e) {
                    memoryResult = { success: false, error: String(e) };
                  }
                }
                
                // Накапливаем для следующего раунда (сохраняем thoughtSignature!)
                roundToolCalls.push({ 
                  id: callId, 
                  name, 
                  args,
                  thoughtSignature: parsed.thoughtSignature, // Сохраняем для отправки обратно
                });
                accumulatedToolResponses.push({
                  toolCallId: callId,
                  name,
                  response: { success: memoryResult.success, id: memoryResult.id },
                });
                
                // После стрима сделаем ещё один раунд
                shouldContinueLoop = true;
                
              }
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              // Обработка инструментов визуальной памяти
              // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              else if (memoryEnabled && (name === 'save_image_memory' || name === 'search_image_memories' || name === 'recall_image_memory')) {
                console.log('[IMAGE MEMORY] Tool called:', name, 'args:', args);
                // Лимит вызовов за turn
                if (memoryCallsThisTurn >= MAX_MEMORY_CALLS) continue;
                memoryCallsThisTurn++;
                
                let imageMemoryResult: any = { success: false };
                
                if (name === 'save_image_memory') {
                  try {
                    // Найти изображение по image_id
                    const imageId = args.image_id;
                    const fileId = imageAliases.get(imageId) || imageId;
                    
                    console.log('[save_image_memory] Looking for image:', { imageId, fileId, availableFiles: attachedFiles.map(f => f.id) });
                    
                    // Получить файл из attachedFiles
                    const file = attachedFiles.find(f => f.id === fileId);
                    if (!file) {
                      console.error('[save_image_memory] Image not found:', { imageId, fileId, availableFiles: attachedFiles.map(f => f.id) });
                      imageMemoryResult = { success: false, error: `Image not found: ${imageId}. Available: ${attachedFiles.map(f => f.id).join(', ')}` };
                    } else {
                      const base64 = await file.getData();
                      
                      // Получить размеры изображения
                      const { width, height } = await getImageDimensions(base64, file.mimeType);
                      
                      // Получить контекст из последних сообщений
                      const messageContext = history
                        .slice(-3)
                        .map(m => getVisibleMessageText(m.parts))
                        .join(' ')
                        .slice(-200);
                      
                      // Сохранить в память
                      const memory = await saveImageMemory({
                        base64,
                        mimeType: file.mimeType,
                        width,
                        height,
                        description: args.description,
                        tags: args.tags || [],
                        entities: args.entities || [],
                        scope: args.scope,
                        chatId: currentChatId || '',
                        messageContext,
                        // TODO: получить текущие аннотации из состояния если args.save_annotations === true
                        annotations: args.save_annotations ? [] : undefined,
                        relatedMemoryIds: args.related_memory_ids || []
                      });
                      
                      // Если нужно сохранить кропы
                      if (args.save_crops && Array.isArray(args.save_crops) && args.save_crops.length > 0) {
                        for (const crop of args.save_crops) {
                          if (crop.separate_memory) {
                            // Создать кроп через cropAndScale
                            const cropResult = await cropAndScale(
                              base64,
                              file.mimeType,
                              crop.region,
                              1 // без масштабирования
                            );
                            
                            // Сохранить как отдельное image memory
                            await saveImageMemory({
                              base64: cropResult.base64,
                              mimeType: cropResult.mimeType,
                              width: cropResult.cropSize.width,
                              height: cropResult.cropSize.height,
                              description: `${crop.label} (кроп из: ${args.description})`,
                              tags: [...(args.tags || []), 'crop'],
                              entities: args.entities || [],
                              scope: args.scope,
                              chatId: currentChatId || '',
                              messageContext,
                              sourceImageMemoryId: memory.id,
                              cropRegion: crop.region
                            });
                          }
                        }
                      }
                      
                      imageMemoryResult = { success: true, id: memory.id };
                      console.log('[image-memory] Saved:', memory.id);
                      
                      // Добавляем memory operation для отображения в чате
                      const memoryOp: import('@/types').MemoryOperation = {
                        type: 'save_image',
                        scope: memory.scope,
                        description: memory.description,
                        tags: memory.tags,
                        entities: memory.entities,
                        thumbnailBase64: memory.thumbnailBase64,
                        memoryId: memory.id,
                      };
                      
                      // Добавляем к текущему сообщению модели
                      setMessages(prev => prev.map(m => 
                        m.id === targetMessageId
                          ? { ...m, memoryOperations: [...(m.memoryOperations || []), memoryOp] }
                          : m
                      ));
                      
                      // Диспатчим событие для обновления UI
                      window.dispatchEvent(new CustomEvent('imageMemorySaved', { 
                        detail: { id: memory.id, scope: memory.scope } 
                      }));
                    }
                  } catch (e) {
                    console.error('[image-memory] Save error:', e);
                    imageMemoryResult = { success: false, error: String(e) };
                  }
                } else if (name === 'search_image_memories') {
                  try {
                    const results = searchImageMemories(
                      args.query,
                      args.scope,
                      args.limit || 10
                    );
                    
                    imageMemoryResult = {
                      success: true,
                      found: results.length,
                      results: results.map(r => ({
                        id: r.id,
                        description: r.description,
                        tags: r.tags,
                        entities: r.entities,
                        mentions: r.mentions,
                        created_at: new Date(r.created_at).toLocaleDateString('ru-RU')
                      }))
                    };
                  } catch (e) {
                    console.error('[image-memory] Search error:', e);
                    imageMemoryResult = { success: false, error: String(e) };
                  }
                } else if (name === 'recall_image_memory') {
                  try {
                    const memory = await getImageMemory(args.image_memory_id);
                    
                    if (memory) {
                      const base64 = await loadImageMemoryData(memory.id);
                      
                      // Инкрементим mentions
                      incrementImageMemoryMentions([memory.id]);
                      
                      imageMemoryResult = {
                        success: true,
                        id: memory.id,
                        description: memory.description,
                        tags: memory.tags,
                        entities: memory.entities,
                        size: `${memory.originalWidth}×${memory.originalHeight}`,
                        recalled: true
                      };
                      
                      // Добавляем изображение в responseParts для Gemini
                      if (base64) {
                        accumulatedToolResponses.push({
                          toolCallId: callId,
                          name,
                          response: imageMemoryResult,
                          extraParts: [{
                            inlineData: {
                              mimeType: memory.mimeType,
                              data: base64
                            }
                          }],
                          hidden: true,
                        });
                        
                        roundToolCalls.push({ 
                          id: callId, 
                          name, 
                          args,
                          thoughtSignature: parsed.thoughtSignature,
                        });
                        
                        shouldContinueLoop = true;
                        continue; // Пропускаем обычную обработку ниже
                      }
                    } else {
                      imageMemoryResult = { success: false, error: 'Image memory not found' };
                    }
                  } catch (e) {
                    console.error('[image-memory] Recall error:', e);
                    imageMemoryResult = { success: false, error: String(e) };
                  }
                }
                
                // Накапливаем для следующего раунда
                roundToolCalls.push({ 
                  id: callId, 
                  name, 
                  args,
                  thoughtSignature: parsed.thoughtSignature,
                });
                accumulatedToolResponses.push({
                  toolCallId: callId,
                  name,
                  response: imageMemoryResult,
                  hidden: true,
                });
                
                shouldContinueLoop = true;
                
              } else {
                // Обычные tool calls
                setMessages(prev => prev.map(m => {
                  if (m.id !== targetMessageId) return m;
                  const existingCalls = m.toolCalls || [];
                  const existingIndex = existingCalls.findIndex(c => c.id === callId);
                  if (existingIndex >= 0) {
                    const nextCalls = [...existingCalls];
                    nextCalls[existingIndex] = {
                      ...nextCalls[existingIndex],
                      name,
                      args,
                      thought: parsed.thought === true,
                      thoughtSignature: parsed.thoughtSignature || nextCalls[existingIndex].thoughtSignature,
                    };
                    return { ...m, toolCalls: nextCalls };
                  }
                  return {
                    ...m,
                    toolCalls: [
                      ...existingCalls,
                      {
                        id: callId,
                        name,
                        args,
                        thought: parsed.thought === true,
                        thoughtSignature: parsed.thoughtSignature,
                        status: 'pending' as const,
                      },
                    ],
                  };
                }));
              }
            }

            // Текст ответа
            if (parsed.text) {
              pendingText += parsed.text;
              scheduleFlush();
            }
          } catch {}
        }

        }

        // Flush any buffered chunks before finishing.
        flush();

        // Если были memory tool calls в этом раунде — накапливаем их для следующего
        if (roundToolCalls.length > 0) {
          accumulatedToolCalls = [...accumulatedToolCalls, ...roundToolCalls];
          // НЕ сбрасываем текст если он уже есть — сохраняем накопленный контент
          setMessages(prev => prev.map(m => {
            if (m.id !== targetMessageId) return m;
            const textPart = m.parts.find(p => 'text' in p && !('thought' in p));
            const currentText = textPart && 'text' in textPart ? textPart.text : '';
            // Сбрасываем только если текста ещё нет
            if (!currentText) {
              return { ...m, parts: [{ text: '' }], isStreaming: true };
            }
            return { ...m, isStreaming: true };
          }));
        }
      }

    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Ошибка стриминга');
      }
    } finally {
      // Cleanup всех таймеров
      cleanupTimers.forEach(timer => clearTimeout(timer));
      
      setIsStreaming(false);
      setStreamingId(null);
      abortControllerRef.current = null;
      
      // Помечаем сообщение завершённым
      setMessages(prev => prev.map(m =>
        m.id === targetMessageId ? { ...m, isStreaming: false } : m
      ));
      
      // Небольшая задержка чтобы дать React время обновить messagesRef
      // после последнего flush() перед вызовом onMessageComplete
      setTimeout(() => {
        // Используем messagesRef для гарантированного доступа к актуальному состоянию
        // (избегаем проблемы с React batching где finalMessageSnapshot может быть null)
        const finalMessage = messagesRef.current.find(m => m.id === targetMessageId);
        
        if (finalMessage) {
          notifySkillsMessageComplete(
            finalMessage,
            currentChatId || '',
            messagesRef.current,
            handleSkillEvent
          ).then(newArtifacts => {
            if (newArtifacts.length > 0) {
              setMessages(prev => prev.map(m =>
                m.id === targetMessageId
                  ? { ...m, skillArtifacts: [...(m.skillArtifacts ?? []), ...newArtifacts] }
                  : m
              ));
            }
          }).catch(console.error);
        }
      }, 100); // 100ms достаточно для React batching
    }
  }, [selectedApiKeyEntry, model, systemPrompt, tools, temperature, thinkingBudget, deepThinkState, deepThinkAnalyze, deepThinkSystemPrompt, currentChatId, memoryEnabled]);

  // Auto-open sheet for ai_interactive sites when streaming ends
  useEffect(() => {
    if (!isStreaming && isMobile && showLiveCanvas && websiteType === 'ai_interactive' && mobileCanvasState === 'hidden') {
      setMobileCanvasState('sheet');
    }
  }, [isStreaming, isMobile, showLiveCanvas, websiteType, mobileCanvasState]);

  // ============ HANDLERS ============
  const handleSend = useCallback(async (text: string, files: AttachedFile[], annotationRefs?: import('@/types').AnnotationReference[]) => {
    if (!selectedApiKey || !model || isStreaming) return;

    setError('');
    
    // Текст остается как есть, аннотации сохраняем отдельно
    const userParts: Part[] = [];
    if (text) userParts.push({ text });
    
    // Добавляем файлы (они уже в base64 после обработки в ChatInput)
    files.forEach(f => {
      userParts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
    });

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      parts: userParts,
      files: files.length > 0 ? files : undefined,
      annotationRefs: annotationRefs && annotationRefs.length > 0 ? annotationRefs : undefined,
    };

    const assistantMsgId = generateId();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'model',
      parts: [{ text: '' }],
      isStreaming: true,
      modelName: model,
      apiKeySuffix: selectedApiKeySuffix || undefined,
    };

    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);

    const historyToSend = [...messages, userMsg];
    await streamGeneration(historyToSend, assistantMsgId, false);
  }, [selectedApiKey, model, isStreaming, messages, streamGeneration, selectedApiKeySuffix]);

  const handleRegenerate = useCallback(async () => {
    if (isStreaming || messages.length === 0) return;
    
    const lastMsg = messages[messages.length - 1];

    // Если последнее сообщение от пользователя — генерируем ответ на него
    if (lastMsg.role === 'user') {
      const newMsgId = generateId();
      const assistantMsg: Message = {
        id: newMsgId,
        role: 'model',
        parts: [{ text: '' }],
        isStreaming: true,
        modelName: model,
        apiKeySuffix: selectedApiKeySuffix || undefined,
      };
      setMessages([...messages, assistantMsg]);
      await streamGeneration(messages, newMsgId, false);
      return;
    }

    // Иначе это сообщение от модели — находим его, удаляем и пересоздаём (регенерация)
    const lastModelIdx = [...messages].reverse().findIndex(m => m.role === 'model');
    if (lastModelIdx === -1) return;
    const actualIdx = messages.length - 1 - lastModelIdx;
    const newMsgId = generateId();
    const newMessages = [
      ...messages.slice(0, actualIdx),
      { id: newMsgId, role: 'model' as const, parts: [{ text: '' }], isStreaming: true, modelName: model, apiKeySuffix: selectedApiKeySuffix || undefined },
    ];
    setMessages(newMessages);
    await streamGeneration(messages.slice(0, actualIdx), newMsgId, false);
  }, [isStreaming, messages, streamGeneration, model, selectedApiKeySuffix]);

  const handleContinue = useCallback(async () => {
    if (isStreaming) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'model') return;

    const lastText = (lastMsg.parts.find(p => 'text' in p) as any)?.text || '';

    // Если последнее сообщение модели — это DeepThink без финального текста,
    // создаём новое сообщение модели (обычная генерация)
    if (!lastText && lastMsg.deepThinkAnalysis) {
      const newMsgId = generateId();
      const assistantMsg: Message = {
        id: newMsgId,
        role: 'model',
        parts: [{ text: '' }],
        isStreaming: true,
        modelName: model,
        apiKeySuffix: selectedApiKeySuffix || undefined,
      };
      // История: всё до DeepThink-сообщения включительно, кроме него
      const historyUpTo = messages.slice(0, messages.length - 1);
      setMessages([...messages, assistantMsg]);
      await streamGeneration(historyUpTo, newMsgId, false);
      return;
    }

    await streamGeneration(messages, lastMsg.id, true);
  }, [isStreaming, messages, streamGeneration, model, selectedApiKeySuffix]);

  const handleSubmitToolResults = useCallback(async (
    modelMessageId: string,
    responses: Array<{ toolCallId: string; rawResponse: string }>
  ) => {
    if (isStreaming || responses.length === 0) return;

    const modelMessage = messages.find(message => message.id === modelMessageId);
    if (!modelMessage) return;

    const toolResponses: ToolResponse[] = responses.map(item => {
      const toolCall = modelMessage.toolCalls?.find(call => call.id === item.toolCallId);
      return {
        id: generateId(),
        toolCallId: item.toolCallId,
        name: toolCall?.name || 'tool',
        response: normalizeToolResponseInput(item.rawResponse),
      };
    });

    const updatedMessages = messages.map(message => {
      if (message.id !== modelMessageId) return message;

      return {
        ...message,
        toolCalls: (message.toolCalls || []).map(call => {
          const response = toolResponses.find(item => item.toolCallId === call.id);
          if (!response) return call;
          return {
            ...call,
            status: 'submitted' as const,
            result: response.response,
          };
        }),
      };
    });

    const userToolMessage: Message = {
      id: generateId(),
      role: 'user',
      kind: 'tool_response',
      parts: [],
      toolResponses,
    };

    const assistantMsgId = generateId();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'model',
      parts: [{ text: '' }],
      isStreaming: true,
      modelName: model,
      apiKeySuffix: selectedApiKeySuffix || undefined,
    };

    const nextMessages = [...updatedMessages, userToolMessage, assistantMsg];
    setMessages(nextMessages);
    await streamGeneration([...updatedMessages, userToolMessage], assistantMsgId, false);
  }, [isStreaming, messages, model, selectedApiKeySuffix, streamGeneration]);

  const handleEdit = useCallback((id: string, newParts: Part[]) => {
    const msgIdx = messages.findIndex(m => m.id === id);
    if (msgIdx === -1) return;
    const msg = messages[msgIdx];
    if (msg.role === 'user') {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, parts: newParts, forceEdit: false } : m
      ));
    } else {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, parts: newParts, isBlocked: false, error: undefined, errorType: undefined, errorCode: undefined, errorStatus: undefined } : m
      ));
    }
  }, [messages]);

  const forceEditPreviousUserMessage = useCallback((modelMessageId: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === modelMessageId);
      if (idx <= 0) return prev;
      // find previous user message
      for (let i = idx - 1; i >= 0; i--) {
        if (prev[i].role === 'user') {
          const next = [...prev];
          next[i] = { ...next[i], forceEdit: true };
          return next;
        }
      }
      return prev;
    });
  }, []);

  const clearForceEdit = useCallback((userMessageId: string) => {
    setMessages(prev => prev.map(m => m.id === userMessageId ? { ...m, forceEdit: false } : m));
  }, []);

  // Удаляет строго одно сообщение по ID — никакого каскада
  const handleDelete = useCallback((id: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }, []);

  // ============ FILE EDITOR HANDLERS ============
  const handleAcceptEdits = useCallback((fileId: string) => {
    setOpenFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      // Принимаем изменения - очищаем isDirty если контент совпадает с оригиналом
      return {
        ...f,
        isDirty: f.content !== f.originalContent
      };
    }));
    setPendingEdits(prev => {
      const next = new Map(prev);
      next.delete(fileId);
      return next;
    });
  }, []);

  const handleRejectEdits = useCallback((fileId: string) => {
    setOpenFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      // Отменяем изменения - возвращаем к последнему сохранённому состоянию
      const lastHistory = f.history[f.history.length - 1];
      return {
        ...f,
        content: lastHistory ? lastHistory.content : f.originalContent,
        isDirty: lastHistory ? true : false
      };
    }));
    setPendingEdits(prev => {
      const next = new Map(prev);
      next.delete(fileId);
      return next;
    });
  }, []);

  const handleManualEdit = useCallback((fileId: string, newContent: string) => {
    setOpenFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return {
        ...f,
        content: newContent,
        isDirty: newContent !== f.originalContent
      };
    }));
  }, []);

  const handleDownloadFile = useCallback((fileId: string) => {
    const file = openFiles.find(f => f.id === fileId);
    if (!file) return;
    
    const blob = new Blob([file.content], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [openFiles]);

  const handleRevertFile = useCallback((fileId: string) => {
    setOpenFiles(prev => prev.map(f => {
      if (f.id !== fileId) return f;
      return {
        ...f,
        content: f.originalContent,
        isDirty: false
      };
    }));
  }, []);

  const handleCloseFile = useCallback((fileId: string) => {
    if (!currentChatId) return;
    
    // Удаляем файл из state
    setOpenFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      
      // Обновляем localStorage
      const storageKey = `skill_data_file-editor_${currentChatId}_file_editor_open_files`;
      if (updated.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } else {
        localStorage.removeItem(storageKey);
      }
      
      return updated;
    });
    
    // Если закрыли активный файл, переключаемся на другой
    if (activeFileId === fileId) {
      const remaining = openFiles.filter(f => f.id !== fileId);
      if (remaining.length > 0) {
        setActiveFileId(remaining[0].id);
      } else {
        setActiveFileId(null);
        setShowFileEditor(false);
      }
    }
  }, [currentChatId, activeFileId, openFiles]);

  const handleEditDeepThinkAnalysis = useCallback((id: string, analysis: DeepThinkAnalysis) => {
    // Найти сообщение и перегенерировать с новым анализом
    const msgIdx = messages.findIndex(m => m.id === id);
    if (msgIdx === -1) return;
    
    // Получить историю до этого сообщения
    const historyUpTo = messages.slice(0, msgIdx);
    
    // Перегенерировать с кастомным анализом
    streamGeneration(historyUpTo, id, false, analysis);
  }, [messages, streamGeneration]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortDeepThink(); // Отменяем DeepThink если он работает
  }, [abortDeepThink]);

  const handleAddUserMessage = useCallback(() => {
    const msg: Message = { id: generateId(), role: 'user', parts: [{ text: '' }] };
    setMessages(prev => [...prev, msg]);
  }, []);

  const clearChatState = useCallback(() => {
    setMessages([]);
    setTokenCount(0);
    setError('');
    setCurrentChatId(null);
    setChatTitle('');
    setUnsaved(false);
    setActiveChatId(null);
  }, []);

  const handleClearChat = useCallback(() => {
    if (isStreaming) return;
    
    // Подтверждение перед очисткой
    if (messages.length > 0 && !confirm('Очистить текущий чат? Несохранённые изменения будут потеряны.')) {
      return;
    }
    
    clearChatState();
  }, [isStreaming, messages.length, clearChatState]);

  const handleNewChat = useCallback(() => {
    if (isStreaming) return;
    // Автосохранение текущего чата (без обновления currentChatId)
    if (messages.length > 0) {
      saveCurrentChat(messages, undefined, false).catch(console.error);
    }
    // Сразу очищаем чат БЕЗ подтверждения (это новый чат, не удаление)
    clearChatState();
    setSystemPrompt('');
    setDeepThinkSystemPrompt(loadDeepThinkSystemPrompt() || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
    setTools([]);
    // 🔥 Сбрасываем canvas
    setLiveCode('');
    setWebsiteType(null);
    setShowLiveCanvas(false);
  }, [isStreaming, messages, saveCurrentChat, clearChatState]);

  const handleLoadChat = useCallback((chat: SavedChat) => {
    if (isStreaming) return;
    if (messages.length > 0 && unsaved) {
      saveCurrentChat(messages).catch(err => {
        console.error('Failed to save current chat before loading:', err);
        // TODO: показать toast пользователю
      });
    }
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setChatTitle(chat.title);
    setModel(chat.model);
    setSystemPrompt(chat.systemPrompt || '');
    setDeepThinkSystemPrompt(chat.deepThinkSystemPrompt || loadDeepThinkSystemPrompt() || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
    setTools(chat.tools || []);
    setTemperature(chat.temperature ?? 1.0);
    setActiveChatId(chat.id);
    setUnsaved(false);
    setError('');
  }, [isStreaming, messages, unsaved, saveCurrentChat]);

  const handleDeleteSavedChat = useCallback(async (id: string) => {
    // Получаем чат перед удалением для очистки URL
    const chat = savedChats.find(c => c.id === id);
    if (chat) {
      // Собираем все id файлов из сообщений
      const fileIds: string[] = [];
      chat.messages.forEach(msg => {
        if (msg.files) {
          msg.files.forEach(file => {
            fileIds.push(file.id);
          });
        }
      });
      // Очищаем Object URLs
      if (fileIds.length > 0) {
        revokePreviewUrls(fileIds);
      }
    }
    
    await deleteChatFromStorage(id);
    
    // Оптимизация: удаляем из state локально вместо перезагрузки
    setSavedChats(prev => prev.filter(c => c.id !== id));
    
    if (currentChatId === id) {
      handleClearChat();
    }
  }, [currentChatId, handleClearChat, savedChats]);

  const handleSavedChatsChange = useCallback(async (chats: SavedChat[]) => {
    // Оптимизация: сохраняем только изменённые чаты
    // Предполагаем что chats — это новый порядок, сохраняем всё
    setSavedChats(chats);
    
    // Сохраняем параллельно вместо последовательно
    await Promise.all(chats.map(c => saveChatToStorage(c)));
  }, []);

  const handleApiKeysChange = useCallback((keys: ApiKeyEntry[]) => {
    const sanitized = sanitizeApiKeys(keys);
    setApiKeys(sanitized);
    saveApiKeys(sanitized);
  }, []);

  // Auto-save when streaming stops
  useEffect(() => {
    if (!isStreaming && messages.length > 0 && unsaved) {
      const lastMsg = messages[messages.length - 1];
      // Сохраняем только если получили реальный ответ
      const lastText = getVisibleMessageText(lastMsg.parts);
      if (lastMsg.role === 'model' && (lastText || lastMsg.isBlocked || (lastMsg.toolCalls?.length || 0) > 0)) {
        saveCurrentChat(messages).catch(err => {
          console.error('Auto-save failed:', err);
          // TODO: показать toast пользователю
        });
      }
    }
  }, [isStreaming, messages, unsaved, saveCurrentChat]);

  const hasKeys = !!selectedApiKeyEntry;
  const hasApiAndModel = hasKeys && !!model;
  const lastMessage = messages[messages.length - 1];
  const lastIsModel = lastMessage?.role === 'model';
  const visibleMessages = useMemo(
    () => messages.filter(message => {
      if (message.kind === 'tool_response') return false;
      if (
        message.role === 'user' &&
        (message.toolResponses?.length || 0) > 0 &&
        getVisibleMessageText(message.parts).length === 0 &&
        (message.files?.length || 0) === 0
      ) {
        return false;
      }
      return true;
    }),
    [messages]
  );
  const canContinue = lastIsModel && !isStreaming && (
    getVisibleMessageText(lastMessage?.parts || []).length > 0 ||
    !!lastMessage?.deepThinkAnalysis
  );

  const toggleChatSidebar = useCallback(() => {
    if (isMobile) {
      setSettingsSidebarOpen(false);
      setChatSidebarOpen(prev => !prev);
      return;
    }
    setChatSidebarOpen(prev => !prev);
  }, [isMobile]);

  const toggleSettingsSidebar = useCallback(() => {
    if (isMobile) {
      setChatSidebarOpen(false);
      setSettingsSidebarOpen(prev => !prev);
      return;
    }
    setSettingsSidebarOpen(prev => !prev);
  }, [isMobile]);

  const chatSidebarStyle = useMemo<React.CSSProperties>(() => {
    const width = 320;
    return {
      width: chatSidebarOpen ? width : 0,
      opacity: chatSidebarOpen ? 1 : 0,
    };
  }, [chatSidebarOpen]);

  const settingsSidebarStyle = useMemo<React.CSSProperties>(() => {
    const width = 360;
    return {
      width: settingsSidebarOpen ? width : 0,
      opacity: settingsSidebarOpen ? 1 : 0,
    };
  }, [settingsSidebarOpen]);

  const scrollBottomButtonStyle = useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return { right: '1.5rem' };
    }

    return {
      right: settingsSidebarOpen ? 'calc(360px + 1.5rem)' : '1.5rem',
    };
  }, [isMobile, settingsSidebarOpen]);

  const settingsSidebarProps = {
    apiKeys,
    onApiKeysChange: handleApiKeysChange,
    activeKeyIndex,
    onActiveKeyIndexChange: setActiveKeyIndex,
    model,
    onModelChange: setModel,
    models,
    onModelsLoad: setModels,
    systemPrompt,
    onSystemPromptChange: setSystemPrompt,
    tools,
    onToolsChange: setTools,
    onOpenToolBuilder: (tool?: ChatTool) => {
      setEditingTool(tool || null);
      setShowToolBuilder(true);
    },
    onOpenSavePromptDialog: () => {
      setNewPromptName('');
      setShowSavePromptDialog(true);
    },
    onOpenDeepThinkDialog: () => {
      setShowDeepThinkDialog(true);
    },
    onOpenMemoryModal: () => {
      setShowMemoryModal(true);
    },
    onOpenSkillsMarket: () => {
      setShowSkillsMarket(true);
    },
    onOpenHFSpaces: () => {
      setShowHFSpaces(true);
    },
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
    onSavedChatsChange: handleSavedChatsChange,
    currentChatId,
    onLoadChat: handleLoadChat,
    onNewChat: handleNewChat,
    onDeleteChat: handleDeleteSavedChat,
    memoryEnabled,
    onMemoryEnabledChange: setMemoryEnabled,
    onSkillsChanged: () => setSkillsRevision(r => r + 1),
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_24%),var(--surface-0)]">

      {isMobile && chatSidebarOpen && (
        <div className="sidebar-mobile-overlay" onClick={(e) => { if (e.target === e.currentTarget) setChatSidebarOpen(false); }}>
          <div className="sidebar-backdrop" />
          <div className="sidebar-panel">
            <ChatSidebar
              savedChats={savedChats}
              currentChatId={currentChatId}
              onLoadChat={handleLoadChat}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteSavedChat}
              onClose={() => setChatSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {isMobile && settingsSidebarOpen && (
        <div className="sidebar-mobile-overlay sidebar-mobile-overlay-right" onClick={(e) => { if (e.target === e.currentTarget) setSettingsSidebarOpen(false); }}>
          <div className="sidebar-backdrop" />
          <div className="sidebar-panel">
            <SettingsSidebar
              {...settingsSidebarProps}
              onClose={() => setSettingsSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="flex-shrink-0 overflow-hidden border-r border-[var(--border-subtle)] transition-[width,opacity] duration-300 ease-out" style={chatSidebarStyle}>
          <div className="h-full w-[320px]">
            <ChatSidebar
              savedChats={savedChats}
              currentChatId={currentChatId}
              onLoadChat={handleLoadChat}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteSavedChat}
            />
          </div>
        </div>
      )}

      {/* Mobile: Bottom Sheet для ai_interactive или Tab Switcher для static */}
      {isMobile && showLiveCanvas && websiteType === 'static' && (
        <div className="flex-shrink-0 flex bg-[var(--surface-1)] border-b border-[var(--border-subtle)] px-4 py-2">
          <div className="flex bg-[var(--surface-3)] p-1 rounded-lg w-full">
            <button 
              onClick={() => setMobileCanvasState('hidden')} 
              className={`flex-1 text-center py-1.5 text-[13px] font-semibold rounded-md transition-colors ${
                mobileCanvasState === 'hidden' ? 'bg-[var(--surface-4)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
              }`}
            >
              Чат
            </button>
            <button 
              onClick={() => setMobileCanvasState('fullscreen')} 
              className={`flex-1 text-center py-1.5 text-[13px] font-semibold rounded-md transition-colors ${
                mobileCanvasState === 'fullscreen' ? 'bg-[var(--surface-4)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
              }`}
            >
              Live Preview
            </button>
          </div>
        </div>
      )}

      {/* Main Area with optional Live Canvas */}
      <PanelGroup direction={isMobile ? "vertical" : "horizontal"} className="flex-1 min-w-0 overflow-hidden">
        
        {/* Chat Panel */}
        <Panel 
           defaultSize={showLiveCanvas && !isMobile ? 50 : 100} 
           minSize={30} 
           className={`flex flex-col min-w-0 overflow-hidden relative ${
             isMobile && showLiveCanvas && (
               (websiteType === 'static' && mobileCanvasState === 'fullscreen') ||
               (websiteType === 'ai_interactive' && mobileCanvasState === 'fullscreen')
             ) ? '!hidden' : ''
           }`}
        >

        {/* Top bar */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[rgba(10,10,10,0.86)] px-3 py-2.5 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleChatSidebar}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                chatSidebarOpen
                  ? 'bg-[var(--surface-3)] text-[var(--text-primary)]'
                  : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
              }`}
            >
              <PanelLeft size={15} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              {chatTitle ? (
                <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px] md:max-w-xs">
                  {chatTitle}
                </span>
              ) : (
                <span className="text-sm text-[var(--text-dim)]">Новый чат</span>
              )}
              {model && (
                <span className="hidden md:block text-[11px] text-[var(--text-dim)] bg-[var(--surface-3)] border border-[var(--border)] px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                  {model.replace('models/', '')}
                  {selectedApiKeySuffix ? ` • ••••${selectedApiKeySuffix}` : ''}
                </span>
              )}
              {unsaved && messages.length > 0 && (
                <button
                  onClick={() => saveCurrentChat(messages)}
                  className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-all"
                  title="Сохранить чат"
                >
                  <Save size={10} />
                  <span className="hidden md:block">Сохранить</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleSettingsSidebar}
              className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-all ${
                settingsSidebarOpen
                  ? 'border-[var(--border-strong)] bg-[var(--surface-3)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-dim)] hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
              }`}
              title="Настройки"
            >
              <SlidersHorizontal size={13} />
              <span className="hidden md:block">Настройки</span>
            </button>
            <div className="w-[1px] h-4 bg-[var(--border)] mx-1 hidden sm:block" />
            
            {/* Restore Preview Button - shows when code exists but canvas is closed */}
            {liveCode && !showLiveCanvas && (
              <button
                onClick={() => setShowLiveCanvas(true)}
                className="flex items-center justify-center w-8 h-8 text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-colors"
                title="Открыть превью сайта"
              >
                <MonitorPlay size={16} />
              </button>
            )}
            
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                disabled={isStreaming}
                className="flex items-center gap-1.5 px-2.5 h-7 text-xs text-[var(--text-dim)] hover:text-red-400 hover:bg-[rgba(239,68,68,0.08)] border border-transparent hover:border-[rgba(239,68,68,0.15)] rounded-lg transition-all disabled:opacity-50"
              >
                <Trash2 size={11} />
                <span className="hidden md:block">Очистить</span>
              </button>
            )}
            <button
              onClick={() => setShowLiveCanvas(prev => !prev)}
              className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-all ${
                showLiveCanvas
                  ? 'border-[var(--border-strong)] bg-[var(--surface-3)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-dim)] hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
              }`}
              title="Live Canvas"
            >
              <MonitorPlay size={13} />
              <span className="hidden md:block">Canvas</span>
            </button>
            {openFiles.length > 0 && (
              <button
                onClick={() => setShowFileEditor(prev => !prev)}
                className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-all ${
                  showFileEditor
                    ? 'border-[var(--border-strong)] bg-[var(--surface-3)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-dim)] hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                }`}
                title="File Editor"
              >
                <span className="text-sm">📝</span>
                <span className="hidden md:block">Editor</span>
                {openFiles.some(f => f.isDirty) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            )}
            <div className="w-[1px] h-4 bg-[var(--border)] mx-1 hidden sm:block" />
            
            <button
              onClick={handleNewChat}
              disabled={isStreaming}
              className="flex items-center gap-1.5 px-2.5 h-7 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] border border-transparent hover:border-[var(--border)] rounded-lg transition-all disabled:opacity-50"
            >
              <MessageSquarePlus size={13} />
              <span className="hidden md:block">Новый</span>
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-red-500/8 border border-red-500/15 text-red-400 text-sm px-4 py-2.5 rounded-xl animate-fade-in">
            <AlertCircle size={13} className="flex-shrink-0" />
            <span className="text-xs">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-300/60 hover:text-red-300">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Messages */}
        <div 
          className="flex-1 overflow-y-auto chat-messages-area px-4 py-6 relative"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <EmptyState 
              hasApiKey={hasKeys} 
              hasModel={!!model} 
              apiKeysCount={apiKeys.length} 
              onSuggestionClick={(text) => handleSend(text, [])}
            />
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {visibleMessages.map((message, idx) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  index={idx}
                  isLast={idx === visibleMessages.length - 1}
                  isStreaming={isStreaming && message.id === streamingId}
                  canRegenerate={hasApiAndModel && !isStreaming}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRegenerate={handleRegenerate}
                  onContinue={handleContinue}
                  onSubmitToolResults={handleSubmitToolResults}
                  onEditPreviousUserMessage={forceEditPreviousUserMessage}
                  onClearForceEdit={clearForceEdit}
                  onEditDeepThinkAnalysis={handleEditDeepThinkAnalysis}
                  onPlayHTML={(html) => {
                    setLiveCode(html);
                    setShowLiveCanvas(true);
                  }}
                  onAnnotationClick={(annotation) => {
                    // Находим изображение для этой аннотации
                    const imageFile = message.files?.find(f => f.mimeType.startsWith('image/'));
                    if (!imageFile) return;
                    
                    // Получаем цвет для типа аннотации
                    const annotationColors: Record<string, string> = {
                      highlight: '#FBBF24',
                      pointer: '#60A5FA',
                      warning: '#F87171',
                      success: '#4ADE80',
                      info: '#A78BFA'
                    };
                    
                    const annotationRef: import('@/types').AnnotationReference = {
                      id: Math.random().toString(36).slice(2),
                      imageId: imageFile.id,
                      imageName: imageFile.name,
                      annotation: annotation,
                      color: annotationColors[annotation.type] || '#60A5FA'
                    };
                    
                    if ((window as any).__chatInputAddAnnotation) {
                      (window as any).__chatInputAddAnnotation(annotationRef);
                    }
                  }}
                />
              ))}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Плавающая кнопка скролла вниз */}
          {showScrollBottom && messages.length > 0 && (
            <button
              onClick={scrollToBottom}
              className="fixed bottom-24 p-2.5 bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)] rounded-full shadow-glow-sm hover:bg-[var(--surface-4)] transition-all animate-fade-in z-20"
              style={scrollBottomButtonStyle}
              title="Вниз"
            >
              <ArrowDown size={18} />
            </button>
          )}

          {/* Floating button для открытия preview на мобилках */}
          {isMobile && showLiveCanvas && mobileCanvasState === 'hidden' && (
            <button
              onClick={() => setMobileCanvasState(websiteType === 'ai_interactive' ? 'sheet' : 'fullscreen')}
              className="fixed bottom-24 right-4 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all z-20"
              title="Открыть превью"
            >
              <MonitorPlay size={20} />
            </button>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 max-w-3xl mx-auto w-full chat-input-wrapper">
          <div className="px-4 mb-2 flex items-center justify-end">
            <DeepThinkToggle
              state={deepThinkState}
              onToggle={toggleDeepThink}
            />
          </div>
          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            onAddUserMessage={handleAddUserMessage}
            isStreaming={isStreaming}
            disabled={!hasApiAndModel}
            canContinue={canContinue}
            onContinue={handleContinue}
            canRun={messages.length > 0 && !isStreaming && hasApiAndModel}
            onRun={handleRegenerate}
            pendingCanvasElement={pendingCanvasElement}
            onCanvasElementConsumed={() => setPendingCanvasElement(null)}
            onAnnotationClick={() => {}}
          />
        </div>
        </Panel>

        {!isMobile && showLiveCanvas && (
           <PanelResizeHandle className="w-1 bg-[var(--border-subtle)] hover:bg-[var(--border-strong)] transition-colors cursor-col-resize z-10" />
        )}

        {/* Desktop: обычная панель */}
        {!isMobile && (showLiveCanvas || showFileEditor) && (
          <Panel 
             defaultSize={50} 
             minSize={30} 
             className="flex flex-col min-w-0 border-l border-[var(--border)] overflow-hidden bg-[var(--surface-1)]"
          >
            {/* Вертикальный split для LivePreview и FileEditor */}
            <PanelGroup direction="vertical" className="h-full">
              {showLiveCanvas && (
                <>
                  <Panel defaultSize={showFileEditor ? 50 : 100} minSize={30}>
                    <LivePreviewPanel 
                      ref={livePreviewRef}
                      code={liveCode}
                      websiteType={websiteType}
                      isStreaming={isStreaming}
                      onClose={() => setShowLiveCanvas(false)} 
                      onElementSelected={(element) => {
                        setPendingCanvasElement(element);
                      }}
                      onAIDataReceived={async (bridgeData) => {
                        // 🔥 GEMINI BRIDGE — данные от сайта → AI
                        
                        // Создаем красивое сообщение с bridgeData
                        const newUserMsg: Message = {
                          id: generateId(),
                          role: 'user',
                          kind: 'bridge_data',
                          parts: [{ text: `Данные от сайта (${bridgeData.eventType})` }],
                          bridgeData: bridgeData,
                        };
                        
                        setMessages(prev => [...prev, newUserMsg]);
                        
                        // Отправляем в AI
                        const assistantMsg: Message = {
                          id: generateId(),
                          role: 'model',
                          parts: [],
                          isStreaming: true,
                        };
                        
                        setMessages(prev => [...prev, assistantMsg]);
                        
                        // Вызываем streamGeneration с актуальной историей из ref (избегаем stale closure)
                        await streamGeneration([...messagesRef.current, newUserMsg], assistantMsg.id, false);
                      }}
                    />
                  </Panel>
                  {showFileEditor && (
                    <PanelResizeHandle className="h-1 bg-[var(--border-subtle)] hover:bg-[var(--border-strong)] transition-colors cursor-row-resize" />
                  )}
                </>
              )}
              
              {showFileEditor && (
                <Panel defaultSize={showLiveCanvas ? 50 : 100} minSize={30}>
                  <FileEditorCanvas
                    openFiles={openFiles}
                    activeFileId={activeFileId}
                    pendingEdits={pendingEdits}
                    onAccept={handleAcceptEdits}
                    onReject={handleRejectEdits}
                    onManualEdit={handleManualEdit}
                    onFileSelect={setActiveFileId}
                    onDownload={handleDownloadFile}
                    onRevert={handleRevertFile}
                    onClose={handleCloseFile}
                  />
                </Panel>
              )}
            </PanelGroup>
          </Panel>
        )}

        {/* Mobile: Bottom Sheet для ai_interactive или fullscreen для static */}
        {isMobile && showLiveCanvas && mobileCanvasState !== 'hidden' && (
          <div 
            className={`fixed inset-x-0 bg-[var(--surface-1)] border-t border-[var(--border)] z-50 transition-all duration-300 ease-out ${
              mobileCanvasState === 'sheet' 
                ? 'bottom-0 top-[45%] rounded-t-2xl shadow-2xl' 
                : 'bottom-0 top-0'
            }`}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              const startY = touch.clientY;
              const startState = mobileCanvasState;
              
              const handleTouchMove = (e: TouchEvent) => {
                const currentY = e.touches[0].clientY;
                const diff = currentY - startY;
                
                // Свайп вниз из fullscreen → sheet
                if (startState === 'fullscreen' && diff > 100) {
                  setMobileCanvasState('sheet');
                  document.removeEventListener('touchmove', handleTouchMove);
                  document.removeEventListener('touchend', handleTouchEnd);
                }
                // Свайп вниз из sheet → hidden
                else if (startState === 'sheet' && diff > 100) {
                  setMobileCanvasState('hidden');
                  document.removeEventListener('touchmove', handleTouchMove);
                  document.removeEventListener('touchend', handleTouchEnd);
                }
                // Свайп вверх из sheet → fullscreen
                else if (startState === 'sheet' && diff < -100) {
                  setMobileCanvasState('fullscreen');
                  document.removeEventListener('touchmove', handleTouchMove);
                  document.removeEventListener('touchend', handleTouchEnd);
                }
              };
              
              const handleTouchEnd = () => {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
              };
              
              document.addEventListener('touchmove', handleTouchMove);
              document.addEventListener('touchend', handleTouchEnd);
            }}
          >
            {/* Drag handle для sheet */}
            {mobileCanvasState === 'sheet' && (
              <div className="flex justify-center py-2 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1 bg-white/20 rounded-full" />
              </div>
            )}
            
            <div className="h-full flex flex-col overflow-hidden">
              <LivePreviewPanel 
                ref={livePreviewRef}
                code={liveCode}
                websiteType={websiteType}
                isStreaming={isStreaming}
                onClose={() => {
                  setShowLiveCanvas(false);
                  setMobileCanvasState('hidden');
                }} 
                onElementSelected={(element) => {
                  setPendingCanvasElement(element);
                  setMobileCanvasState('hidden'); // Возвращаемся к чату
                }}
                onAIDataReceived={async (bridgeData) => {
                  // 🔥 GEMINI BRIDGE — данные от сайта → AI
                  
                  // Создаем красивое сообщение с bridgeData
                  const newUserMsg: Message = {
                    id: generateId(),
                    role: 'user',
                    kind: 'bridge_data',
                    parts: [{ text: `Данные от сайта (${bridgeData.eventType})` }],
                    bridgeData: bridgeData,
                  };
                  
                  setMessages(prev => [...prev, newUserMsg]);
                  
                  // Отправляем в AI
                  const assistantMsg: Message = {
                    id: generateId(),
                    role: 'model',
                    parts: [],
                    isStreaming: true,
                  };
                  
                  setMessages(prev => [...prev, assistantMsg]);
                  
                  // Вызываем streamGeneration с актуальной историей из ref (избегаем stale closure)
                  await streamGeneration([...messagesRef.current, newUserMsg], assistantMsg.id, false);
                }}
              />
            </div>
          </div>
        )}
      </PanelGroup>

      {!isMobile && (
        <div className="flex-shrink-0 overflow-hidden border-l border-[var(--border-subtle)] transition-[width,opacity] duration-300 ease-out" style={settingsSidebarStyle}>
          <div className="h-full w-[360px]">
            <SettingsSidebar {...settingsSidebarProps} />
          </div>
        </div>
      )}

      {/* Tool Builder Modal - Global */}
      <ToolBuilderModal
        open={showToolBuilder}
        initialTool={editingTool}
        onSave={(tool) => {
          const next = editingTool
            ? tools.map(item => item.id === tool.id ? tool : item)
            : [...tools, tool];
          setTools(next);
          setShowToolBuilder(false);
          setEditingTool(null);
        }}
        onClose={() => {
          setShowToolBuilder(false);
          setEditingTool(null);
        }}
      />

      {/* Save Prompt Dialog */}
      {showSavePromptDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">Сохранить промпт</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Введите название для системного промпта
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowSavePromptDialog(false);
                    setNewPromptName('');
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <input
                type="text"
                value={newPromptName}
                onChange={e => setNewPromptName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newPromptName.trim()) {
                    const updated = [...savedPrompts, createSystemPrompt(newPromptName, systemPrompt)];
                    setSavedPrompts(updated);
                    saveSystemPrompts(updated);
                    setNewPromptName('');
                    setShowSavePromptDialog(false);
                  }
                  if (e.key === 'Escape') {
                    setShowSavePromptDialog(false);
                    setNewPromptName('');
                  }
                }}
                placeholder="Название промпта..."
                autoFocus
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none"
              />

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setShowSavePromptDialog(false);
                    setNewPromptName('');
                  }}
                  className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    if (!newPromptName.trim()) return;
                    const updated = [...savedPrompts, createSystemPrompt(newPromptName, systemPrompt)];
                    setSavedPrompts(updated);
                    saveSystemPrompts(updated);
                    setNewPromptName('');
                    setShowSavePromptDialog(false);
                  }}
                  disabled={!newPromptName.trim()}
                  className="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DeepThink Dialog */}
      {showDeepThinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">DeepThink системный промпт</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Промпт для анализа контекста перед генерацией ответа
                  </p>
                </div>
                <button
                  onClick={() => setShowDeepThinkDialog(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <textarea
                value={deepThinkDraft}
                onChange={e => setDeepThinkDraft(e.target.value)}
                placeholder="Введите системный промпт для DeepThink..."
                rows={12}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none"
                style={{ minHeight: '300px', maxHeight: '500px', resize: 'vertical' }}
              />

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setDeepThinkDraft(DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <RefreshCw size={12} />
                  Сбросить
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeepThinkDialog(false)}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      const nextValue = deepThinkDraft.trim() || DEFAULT_DEEPTHINK_SYSTEM_PROMPT;
                      setDeepThinkSystemPrompt(nextValue);
                      saveDeepThinkSystemPrompt(nextValue);
                      setShowDeepThinkDialog(false);
                    }}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Memory Modal */}
      <MemoryModal
        open={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
        chatId={currentChatId || undefined}
      />

      {/* Skills Market Modal */}
      <SkillsMarket
        open={showSkillsMarket}
        onClose={() => setShowSkillsMarket(false)}
        chatId={currentChatId || ''}
        messages={messages}
        onUIEvent={handleSkillEvent}
        onSkillsChanged={() => setSkillsRevision(r => r + 1)}
      />

      {/* HF Spaces Manager Modal */}
      <HFSpaceManager
        open={showHFSpaces}
        onClose={() => setShowHFSpaces(false)}
        onSpacesChanged={() => {
          reloadHFSpaceSkills();
          setSkillsRevision(r => r + 1);
        }}
      />
    </div>
  );
}

function EmptyState({ hasApiKey, hasModel, apiKeysCount, onSuggestionClick }: { hasApiKey: boolean; hasModel: boolean; apiKeysCount: number; onSuggestionClick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center mb-6">
        <Sparkles size={24} className="text-black" />
      </div>

      <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">Gemini Studio</h2>
      <p className="text-[var(--text-muted)] max-w-sm leading-relaxed text-sm">
        {!hasApiKey
          ? 'Добавьте API ключ в левую панель для начала'
          : !hasModel
          ? 'Загрузка доступных моделей…'
          : 'Начните разговор с Gemini'}
      </p>

      {!hasApiKey && (
        <div className="mt-6 flex flex-col gap-2 items-center">
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-xl hover:opacity-80 transition-opacity"
          >
            Получить API ключ
          </a>
          <p className="text-[11px] text-[var(--text-dim)]">Бесплатно · Без карты</p>
        </div>
      )}

      {hasApiKey && hasModel && (
        <div className="mt-8 grid grid-cols-1 gap-2 max-w-sm w-full">
          {[
            { label: '💬 Начать разговор', text: 'Привет! Что умеешь делать?' },
            { label: '💻 Ревью кода', text: 'Посмотри этот код и предложи улучшения:' },
            { label: '✍️ Написать текст', text: 'Напиши короткий рассказ о космическом путешествии.' },
            { label: '🧠 Объяснить тему', text: 'Объясни квантовую запутанность простыми словами.' },
          ].map(s => (
            <div key={s.label}
              onClick={() => onSuggestionClick(s.text)}
              className="text-left text-sm text-[var(--text-dim)] bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] rounded-xl px-4 py-3 cursor-pointer transition-all group shadow-sm hover:shadow-glow-sm"
            >
              <span className="font-medium text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">{s.label}</span>
              <p className="mt-0.5 text-[var(--text-dim)] group-hover:text-[var(--text-muted)] transition-colors text-xs">{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}






