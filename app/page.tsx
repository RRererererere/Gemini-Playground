'use client';

// Запрещаем статическую генерацию — страница использует localStorage
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import dynamicImport from 'next/dynamic';
import { ChatSidebar, SettingsSidebar } from '@/components/Sidebar';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import MemoryPill from '@/components/MemoryPill';
import ImageMemoryPill from '@/components/ImageMemoryPill';
import ImageMemoryRecallPill from '@/components/ImageMemoryRecallPill';
import StorageWarningBanner from '@/components/StorageWarningBanner';
import {
  PanelLeft, MessageSquarePlus, Sparkles, Trash2, AlertCircle,
  SlidersHorizontal,
  ChevronUp,
  Save, X, ArrowDown, RefreshCw, MonitorPlay, Zap, FilePen, BarChart2,
  Brain, Loader2, CheckCircle2, Bot, Pencil
} from 'lucide-react';

import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import LivePreviewPanel from '@/components/LivePreviewPanel';
import FileEditorCanvas from '@/components/FileEditorCanvas';
import InsightsPanel from '@/components/InsightsPanel';
import { useDeepThink } from '@/lib/useDeepThink';
import DeepThinkToggle from '@/components/DeepThinkToggle';

import AgentMessageHeader from '@/components/AgentMessageHeader';
import ArenaInputBar from '@/components/ArenaInputBar';
import ArenaAgentsSidebar from '@/components/ArenaAgentsSidebar';
import JevDecisionLab from '@/components/JevDecisionLab';
import { useArena } from '@/lib/useArena';
import { loadSceneStateConfig, saveSceneStateConfig } from '@/lib/scene-state-storage';
import type { ChatTool, GeminiModel, ApiKeyEntry, SavedChat, ToolResponse, SavedSystemPrompt, SkillArtifact, CanvasElement, Provider, UniversalModel, ActiveModel, Message, AttachedFile, Part, DeepThinkAnalysis, WebsiteType, OpenFile, FileDiffOp } from '@/types';
import {
  loadApiKeys, saveApiKeys, isRateLimitError, addApiKey, removeApiKey, getNextAvailableKey, markKeyBlocked, markKeyUsed, unblockExpiredKeys, migrateOldApiKeys,
} from '@/lib/apiKeyManager';
import {
  loadProviders, saveCustomProvider, removeProvider, loadModelsCache, saveModelsCache, getActiveProviderId, setActiveProviderId, getActiveModel, setActiveModel, migrateOldModelSelection, GOOGLE_PROVIDER,
} from '@/lib/providerStorage';
import {
  loadSavedChats, saveChatToStorage, deleteChatFromStorage, renameChatInStorage,
  getActiveChatId, setActiveChatId,
  loadDeepThinkSystemPrompt,
  saveDeepThinkSystemPrompt,
  loadSystemPrompts,
  saveSystemPrompts,
  createSystemPrompt,
  revokePreviewUrls,
  checkAndRepairStorage,
} from '@/lib/storage';
import { addLogEntry, serializeMessage } from '@/lib/logStore';
import {
  DEFAULT_DEEPTHINK_SYSTEM_PROMPT,
  DEEPTHINK_MEMORY_MARKER,
  buildChatRequestMessages,
  getVisibleMessageText,
  isThoughtPart,
  normalizeToolResponseInput,
} from '@/lib/gemini';
import { markMemoriesUsed } from '@/lib/memory-prompt';
import { buildSystemPromptLayers } from '@/lib/context-layers';
import { loadContextLayersConfig } from '@/lib/context-layers-storage';
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
import { collectImages } from '@/lib/image-context';
import { cropAndScale } from '@/lib/skills/built-in/image-analyser/cropper';
import { generateImageId } from '@/lib/imageId';
// Skills system
import {
  collectSkillTools,
  executeSkillToolCall,
  notifySkillsMessageComplete,
  isSkillToolCall,
} from '@/lib/skills';
import { useSkillsUI } from '@/lib/useSkillsUI';
import { useAppState } from '@/lib/useAppState';
import { useWindowedMessages } from '@/lib/hooks/useWindowedMessages';

const ToolBuilderModal = dynamicImport(() => import('@/components/ToolBuilder').then(module => module.ToolBuilderModal));
const MemoryModal = dynamicImport(() => import('@/components/MemoryModal'));
const CommandPalette = dynamicImport(() => import('@/components/CommandPalette').then(module => module.CommandPalette));
const DeepThinkSettingsDialog = dynamicImport(() => import('@/components/DeepThinkSettingsDialog').then(module => module.DeepThinkSettingsDialog));
const SceneStateSettingsModal = dynamicImport(() => import('@/components/SceneStateSettingsModal').then(module => module.SceneStateSettingsModal));
const ContextInspectorModal = dynamicImport(() => import('@/components/ContextInspectorModal').then(module => module.ContextInspectorModal));
const SkillsMarket = dynamicImport(() => import('@/components/SkillsMarket').then(module => module.SkillsMarket));
const SelectionToolbar = dynamicImport(() => import('@/components/SelectionToolbar').then(module => module.SelectionToolbar));

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
  const now = Date.now();
  return keys.map(k => {
    const next: ApiKeyEntry = { ...k };
    if (next.blockedUntil && next.blockedUntil <= now) next.blockedUntil = undefined;
    if (next.blockedByModel) {
      const cleaned: Record<string, number> = {};
      for (const [m, until] of Object.entries(next.blockedByModel)) {
        if (typeof until === 'number' && until > now) cleaned[m] = until;
      }
      next.blockedByModel = Object.keys(cleaned).length ? cleaned : undefined;
    }
    return next;
  });
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
  const app = useAppState();

  // Destructure all for backward compatibility
  const {
    providers, setProviders, activeProviderId, activeProvider,
    apiKeys, activeKeyIndex, activeModel, setActiveModel: setActiveModelState, allModels, setAllModels,
    model, models, effectiveProviderId, currentProviderKeys, currentKeyIndex,
    selectedApiKeyEntry, selectedApiKey, selectedApiKeySuffix,
    setActiveProviderId: setActiveProviderIdState,
    systemPrompt, setSystemPrompt, tools, setTools,
    deepThinkSystemPrompt, setDeepThinkSystemPrompt,
    deepThinkProviderId, setDeepThinkProviderId,
    deepThinkModelId, setDeepThinkModelId,
    deepThinkApiKeyIndex, setDeepThinkApiKeyIndex,
    temperature, setTemperature, thinkingBudget, setThinkingBudget,
    maxOutputTokens, maxMemoryCalls, maxToolRounds,
    memoryEnabled, setMemoryEnabled,
    savedPrompts, setSavedPrompts,
    messages, setMessages, messagesRef,
    savedChats, setSavedChats,
    currentChatId, setCurrentChatId, chatTitle, setChatTitle, unsaved, setUnsaved,
    isStreaming, setIsStreaming, streamingId, setStreamingId,
    error, setError, abortControllerRef,
    showLiveCanvas, setShowLiveCanvas, liveCode, setLiveCode,
    websiteType, setWebsiteType, showInsights, setShowInsights,
    livePreviewRef,
    openFiles, setOpenFiles, activeFileId, setActiveFileId,
    showFileEditor, setShowFileEditor, pendingEdits, setPendingEdits,
    checkFilesForEditor,
    acceptFileEditorEdits, rejectFileEditorEdits, manualFileEditorEdit,
    closeFileEditorFile, revertFileEditorFile, fileEditorChatKey,
    mobileCanvasState, setMobileCanvasState, pendingCanvasElement, setPendingCanvasElement,
    appMode, setAppMode, arena,
    showToolBuilder, setShowToolBuilder, editingTool, setEditingTool,
    showSavePromptDialog, setShowSavePromptDialog, newPromptName, setNewPromptName,
    showDeepThinkDialog, setShowDeepThinkDialog, deepThinkDraft, setDeepThinkDraft,
    chatSidebarOpen, setChatSidebarOpen,
    settingsSidebarOpen, setSettingsSidebarOpen,
    isMobile,
    showSkillsMarket, setShowSkillsMarket,
    showContextInspector, setShowContextInspector,
    skillsRevision, setSkillsRevision,
    handleSkillEvent,
    showScrollBottom, isAtBottomRef, chatEndRef, handleScroll, scrollToBottom,
    scrollToBottomImmediate, maintainScrollPosition, getScrollContainer, setScrollContainer,
    tokenCount, setTokenCount, isCountingTokens, countTokens, scheduleTokenCount,
    showMemoryModal, setShowMemoryModal,
    deepThink,
    settingsSidebarProps,
    chatSidebarArenaProps,
  } = app;

  // ============ STORAGE REPAIR ============
  useEffect(() => {
    const result = checkAndRepairStorage();
    if (!result.ok) {
      console.warn('[storage] Repair result:', result.warning);
    }
  }, []); // только один раз при маунте

  const { state: deepThinkState, toggle: toggleDeepThink, analyze: deepThinkAnalyze, abort: abortDeepThink } = deepThink;

  const [isSceneStatePinned, setIsSceneStatePinned] = useState(() => {
    if (typeof window !== 'undefined') {
      return loadSceneStateConfig().pinned;
    }
    return false;
  });
  const [isSceneStateSettingsOpen, setIsSceneStateSettingsOpen] = useState(false);

  const handleToggleSceneStatePin = useCallback(() => {
    setIsSceneStatePinned(prev => {
      const next = !prev;
      const config = loadSceneStateConfig();
      saveSceneStateConfig({ ...config, pinned: next });
      return next;
    });
  }, []);

  const handleRequestSceneCategory = useCallback((request: { id: string; content: string }) => {
    const config = loadSceneStateConfig();
    if (!config.customCategories.find(c => c.id === request.id)) {
      const newCategory = {
        id: request.id,
        label: request.id.charAt(0).toUpperCase() + request.id.slice(1),
        icon: '🤖',
        priority: 'medium' as const,
        enabled: true,
        content: request.content,
      };
      saveSceneStateConfig({
        ...config,
        customCategories: [...config.customCategories, newCategory],
        enabledCategories: [...config.enabledCategories, request.id],
        categoryOrder: [...config.categoryOrder, request.id],
      });
    }
  }, []);

  // ============ SIDEBAR PROPS SETUP ============
  // onLoadChat, onNewChat, onDeleteChat — будут установлены ниже после определения handlers

  // ============ FILE EDITOR AUTO-OPEN ============
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user' && lastMessage.files) {
      checkFilesForEditor(lastMessage.files);
    }
  }, [messages]);

  // ============ TOKEN COUNTING (auto-debounced) ============
  useEffect(() => {
    scheduleTokenCount(
      messages, systemPrompt, model, selectedApiKey,
      currentChatId, memoryEnabled, handleSkillEvent,
      isStreaming, skillsRevision
    );
  }, [messages, systemPrompt, model, selectedApiKey, currentChatId, memoryEnabled, handleSkillEvent, isStreaming, skillsRevision]);

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
    const existing = savedChats.find((c: SavedChat) => c.id === chatId);
    if (existing) chatObj.createdAt = existing.createdAt;

    await saveChatToStorage(chatObj);

    // File editor: переносим open files с session-id на реальный chatId
    if (!currentChatId || currentChatId !== chatId) {
      try {
        const { migrateEditorChatId } = await import('@/lib/file-editor-bridge');
        migrateEditorChatId(fileEditorChatKey || currentChatId, chatId);
      } catch (e) {
        console.error('[File Editor] migrate chat id failed:', e);
      }
    }
    
    // Оптимизация: обновляем savedChats локально вместо перезагрузки всех чатов
    // Канонический порядок: самые свежие чаты сверху (по updatedAt) — как в storage
    setSavedChats((prev: SavedChat[]) => {
      const withoutCurrent = prev.filter((c: SavedChat) => c.id !== chatId);
      return [chatObj, ...withoutCurrent].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    });
    
    // Обновляем состояние сессии только если это не фоновое сохранение старого чата.
    // Иначе асинхронный хвост сохранения вернёт currentChatId/заголовок обратно
    // и "перетащит" пользователя в прежний чат (гонка при загрузке чата/создании ветки).
    if (updateCurrentId) {
      setCurrentChatId(chatId);
      setActiveChatId(chatId);
      setChatTitle(chatObj.title);
      setUnsaved(false);
    }
    
    return chatObj;
  }, [currentChatId, chatTitle, model, systemPrompt, deepThinkSystemPrompt, tools, temperature, savedChats, fileEditorChatKey]);

  // ============ STREAMING ============
  const streamGeneration = useCallback(async (
    history: Message[],
    targetMessageId: string,
    isAppending: boolean,
    customAnalysis?: DeepThinkAnalysis, // Кастомный анализ после редактирования
    prebuiltSystemPrompt?: string,      // Готовый prompt от предыдущего DeepThink
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
    // Сборка системного промпта (слои из Context Inspector)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const contextConfig = loadContextLayersConfig();
    const messageFilters = contextConfig.messageFilters;

    const initialBuilt = buildSystemPromptLayers({
      messages: history,
      systemPrompt,
      chatId: currentChatId,
      memoryEnabled,
      config: contextConfig,
      handleSkillEvent,
    });

    if (initialBuilt.usedMemoryIds.length > 0 || initialBuilt.usedImageMemoryIds.length > 0) {
      markMemoriesUsed(initialBuilt.usedMemoryIds, initialBuilt.usedImageMemoryIds, currentChatId || undefined);
    }

    let effectiveSystemPrompt = initialBuilt.baseBeforeDeepThink;
    let deepThinkEnhancedForRequest: string | null = null;

    let finalAnalysis: DeepThinkAnalysis | null = null;
    
    // Получаем текущее сообщение для возможного восстановления промпта при isAppending
    const targetMsg = history.find(m => m.id === targetMessageId);

    if (deepThinkState.enabled && !customAnalysis && !prebuiltSystemPrompt && !isAppending) {
      // Путь 1: DeepThink enabled, нет customAnalysis, нет prebuiltSystemPrompt, это не продолжение
      // Сохраняем исходный prompt ДО DeepThink для diff в Insights
      const originalPromptBeforeDeepThink = effectiveSystemPrompt;
      
      // Показываем визуально, что идет анализ - создаем пустое сообщение с deepThinking
      setMessages(prev => prev.map(m =>
        m.id !== targetMessageId ? m : {
          ...m,
          parts: [{ text: '' }],
          deepThinking: '',
          isStreaming: true,
        }
      ));

      // Вычисляем правильный ключ и модель для DeepThink
      // Если настроен кастомный провайдер — берём из него, иначе используем текущий
      const dtProviderId = deepThinkProviderId || effectiveProviderId;
      const dtKeys = apiKeys[dtProviderId] || currentProviderKeys;
      const dtKeyIndex = deepThinkProviderId ? deepThinkApiKeyIndex : currentKeyIndex;
      const dtKey = dtKeys[dtKeyIndex]?.key || key;
      const dtModel = deepThinkModelId || model;

      const dtProvider = providers.find(p => p.id === dtProviderId) || providers.find(p => p.isBuiltin);
      const sceneStateConfig = loadSceneStateConfig();
      const dtResult = await deepThinkAnalyze(
        history,
        effectiveSystemPrompt, // Передаём с памятью!
        dtKey,
        dtModel,
        deepThinkSystemPrompt,
        (thinking: string) => {
          setMessages(prev => prev.map(m =>
            m.id !== targetMessageId ? m : {
              ...m,
              deepThinking: thinking,
              isStreaming: true,
            }
          ));
        },
        0,
        sceneStateConfig,
        dtProvider?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
        dtProvider?.type === 'gemini' ? 'gemini' : dtProvider?.type === 'openai' ? 'openai' : 'gemini'
      );

      effectiveSystemPrompt = dtResult.enhancedPrompt;
      deepThinkEnhancedForRequest = dtResult.enhancedPrompt || null;
      finalAnalysis = dtResult.analysis;
      
      // Сохранить enhancedPrompt и originalPrompt на сообщение для последующего переиспользования
      if (dtResult.enhancedPrompt && !dtResult.error) {
        setMessages(prev => prev.map(m =>
          m.id !== targetMessageId ? m : {
            ...m,
            deepThinkEnhancedPrompt: dtResult.enhancedPrompt,
            deepThinkOriginalPrompt: originalPromptBeforeDeepThink,
          }
        ));
      }
      
      if (dtResult.error) {
        // DeepThink прерван - НЕ останавливаем генерацию, продолжаем с оригинальным промптом
        setMessages(prev => prev.map(m =>
          m.id !== targetMessageId ? m : {
            ...m,
            deepThinkError: dtResult.error || 'DeepThink failed',
            deepThinkInterrupted: true,
            isStreaming: true, // ← НЕ останавливаем
          }
        ));
        
        // Логируем ошибку, но НЕ показываем пользователю (не блокируем UI)
        console.warn('[DeepThink] Error occurred, falling back to original prompt:', dtResult.error);
        
        // Продолжаем с оригинальным системным промптом (fallback)
        effectiveSystemPrompt = originalPromptBeforeDeepThink;
        deepThinkEnhancedForRequest = null;
        
        // НЕ вызываем setIsStreaming(false) и return — продолжаем генерацию
      } else if (finalAnalysis) {
        // DeepThink успешен — используем улучшенный промпт
        setMessages(prev => prev.map(m =>
          m.id !== targetMessageId ? m : {
            ...m,
            deepThinkAnalysis: finalAnalysis || undefined,
            isStreaming: true,
          }
        ));
      }
    } else if (customAnalysis) {
      // Путь 2: Используем кастомный анализ после редактирования
      finalAnalysis = customAnalysis;
      effectiveSystemPrompt = buildEnhancedPromptFromAnalysis(customAnalysis);
      deepThinkEnhancedForRequest = effectiveSystemPrompt;
      
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
    } else if (prebuiltSystemPrompt) {
      // Путь 3: Готовый prompt (регенерация текста без DeepThink)
      effectiveSystemPrompt = prebuiltSystemPrompt;
      deepThinkEnhancedForRequest = prebuiltSystemPrompt;
      // DeepThink НЕ запускается, deepThinking на сообщении НЕ трогается
    } else if (isAppending && targetMsg) {
      // Путь 4: Продолжение разорванной генерации (реюз старого промпта)
      if (targetMsg.deepThinkEnhancedPrompt) {
        effectiveSystemPrompt = targetMsg.deepThinkEnhancedPrompt;
        deepThinkEnhancedForRequest = targetMsg.deepThinkEnhancedPrompt;
      }
    }

    // Cleanup tracker для таймеров
    const cleanupTimers: ReturnType<typeof setTimeout>[] = [];
    
    try {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Tool loop — поддерживает несколько раундов memory tool calls
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      // Накапливаем раунды tool calls/responses
      const completedRounds: Array<{ calls: any[]; responses: any[] }> = [];
      let memoryCallsThisTurn = 0;
      const MAX_MEMORY_CALLS_LOCAL = maxMemoryCalls; // Из настроек UI
      const MAX_TOOL_ROUNDS_LOCAL = maxToolRounds; // Из настроек UI
      let toolRoundCount = 0;
      let shouldContinueLoop = true;

      // ── File Editor: force tool use so model doesn't paste whole file into chat ──
      const {
        resolveEditorChatId,
        openEditableAttachments,
        hasOpenEditorFiles,
        buildFileEditorForceInstruction,
        FILE_EDITOR_TOOL_NAMES,
        isEditableFile,
      } = await import('@/lib/file-editor-bridge');
      const editorChatId = fileEditorChatKey || resolveEditorChatId(currentChatId);

      const { isSkillActive, isSkillInstalled, installSkill } = await import('@/lib/skills/registry');

      const historyFiles = history
        .filter(m => m.role === 'user' && m.files?.length)
        .flatMap(m => m.files || [])
        .filter(f => isEditableFile(f.mimeType, f.name));

      // Авто-установка ТОЛЬКО если пользователь прикрепил редактируемые файлы и скилл
      // ещё никогда не ставился. Если стоит но выключен — уважаем выбор юзера,
      // раньше installSkill() молча включал его обратно перед каждым запросом.
      if (historyFiles.length > 0 && !isSkillInstalled('file-editor')) {
        try {
          installSkill('file-editor');
        } catch { /* ignore */ }
      }

      if (historyFiles.length > 0) {
        try {
          await openEditableAttachments(
            editorChatId,
            historyFiles.map(f => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              data: f.data,
            }))
          );
        } catch (e) {
          console.error('[File Editor] pre-open failed:', e);
        }
      }

      // Форсим file-editor tools только когда скилл активен, файлы открыты и в ТЕКУЩЕМ
      // ходе реально прикреплён редактируемый файл. Иначе модель принуждают звать
      // edit_file на обычные вопросы — она и «правит» несуществующие файлы.
      const fileEditorActive = isSkillActive('file-editor');
      const lastUserTurn = [...history].reverse().find(m => m.role === 'user');
      const editableAttachedThisTurn = Boolean(
        lastUserTurn?.files?.some(f => isEditableFile(f.mimeType, f.name))
      );
      let forceFileEditorTools =
        fileEditorActive && editableAttachedThisTurn && hasOpenEditorFiles(editorChatId);
      let fileEditorMutated = false;

      while (shouldContinueLoop) {
        // ЗАЩИТА: ограничиваем максимальное количество раундов
        if (toolRoundCount >= MAX_TOOL_ROUNDS_LOCAL) {
          console.warn(`[TOOL LOOP] Превышен лимит раундов (${MAX_TOOL_ROUNDS_LOCAL}), цикл остановлен`);
          break;
        }
        toolRoundCount++;
        memoryCallsThisTurn = 0; // Сбрасываем счётчик memory calls для нового раунда

        shouldContinueLoop = false; // по умолчанию — выходим после одного прохода

        // Строим историю
        const messagesForRequest = buildChatRequestMessages(history, messageFilters);

        // Если есть завершённые раунды — добавляем их как отдельные model/user turns
        let contentsForRequest = messagesForRequest;
        if (completedRounds.length > 0) {
          for (const round of completedRounds) {
            // Добавляем model turn с functionCalls этого раунда
            contentsForRequest.push({
              role: 'model',
              parts: round.calls.map(tc => ({
                functionCall: { id: tc.id, name: tc.name, args: tc.args },
                ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
              })),
            });

            // Добавляем user turn с functionResponses + extraParts этого раунда
            contentsForRequest.push({
              role: 'user',
              parts: [
                ...round.responses.map(tr => ({
                  functionResponse: {
                    id: tr.toolCallId,
                    name: tr.name,
                    response: tr.response,
                  },
                })),
                // extraParts (recalled images) — в тот же turn
                ...round.responses.flatMap(tr => tr.extraParts || []),
              ],
            });
          }
        }

        // Собираем skill tools. File-editor tools приходят только если скилл активен —
        // принудительно не переустанавливаем (это включало выключенный скилл).
        const skillTools = collectSkillTools();
        
        // Пересобираем промпт внутри цикла (image context обновляется после zoom)
        // chatId = editorChatId so OPEN FILES section matches bridge storage
        const loopBuilt = buildSystemPromptLayers({
          messages: history,
          systemPrompt,
          chatId: editorChatId,
          memoryEnabled,
          config: contextConfig,
          handleSkillEvent,
          deepThinkEnhancedPrompt: deepThinkEnhancedForRequest,
        });
        const effectiveSystemPromptWithImages = loopBuilt.text;

        // Inject mandatory tool-use block into the ORIGINAL user turn only (not tool-response turns)
        let messagesForApi = contentsForRequest;
        const forceInstr =
          forceFileEditorTools && toolRoundCount === 0
            ? buildFileEditorForceInstruction(editorChatId)
            : '';
        if (forceInstr) {
          // First user message in this request that still has text/inlineData (not pure functionResponse)
          let injected = false;
          messagesForApi = contentsForRequest.map((m: any) => {
            if (injected || m.role !== 'user') return m;
            const parts = Array.isArray(m.parts) ? m.parts : [];
            const isToolResponseTurn = parts.some((p: any) => p && 'functionResponse' in p);
            if (isToolResponseTurn) return m;
            injected = true;
            return {
              ...m,
              parts: [{ text: forceInstr + '\n\n' }, ...parts],
            };
          });
        }
        
        // Определяем endpoint и параметры в зависимости от типа провайдера
        const endpoint = activeProvider?.type === 'openai'
          ? '/api/openai-chat'
          : activeProvider?.type === 'anthropic'
          ? '/api/anthropic-chat'
          : '/api/chat';
        const requestBody: any = {
          messages: messagesForApi,
          model: activeModel?.modelId || model,
          systemInstruction: effectiveSystemPromptWithImages,
          tools: tools,
          memoryTools: [
            ...(memoryEnabled && memoryCallsThisTurn < MAX_MEMORY_CALLS_LOCAL ? MEMORY_TOOLS : []),
            ...(memoryEnabled && memoryCallsThisTurn < MAX_MEMORY_CALLS_LOCAL ? IMAGE_MEMORY_TOOLS : []),
            ...skillTools,
          ],
          temperature,
          apiKey: key,
          maxOutputTokens,
          // Gemini: всегда запрашиваем thought-парты — иначе размышления не приходят вовсе
          includeThoughts: true,
        };

        // Force function calling while file needs editing
        if (forceFileEditorTools && !fileEditorMutated) {
          if (activeProvider?.type === 'openai') {
            requestBody.toolChoice = 'required';
          } else if (activeProvider?.type === 'anthropic') {
            requestBody.toolChoice = { type: 'any' };
          } else {
            requestBody.toolConfig = {
              functionCallingConfig: {
                mode: 'ANY',
                allowedFunctionNames: [...FILE_EDITOR_TOOL_NAMES],
              },
            };
          }
        }
        
        // Для OpenAI/Anthropic-провайдеров добавляем baseUrl
        if (activeProvider?.type === 'openai' || activeProvider?.type === 'anthropic') {
          requestBody.baseUrl = activeProvider.baseUrl;
          requestBody.includeThoughts = false;
        } else {
          // Только для Gemini
          requestBody.thinkingBudget = thinkingBudget;
        }
        
        const _logTs = Date.now();
        const _logProvider = activeProvider?.type === 'openai' ? 'openai' : activeProvider?.type === 'anthropic' ? 'anthropic' : 'gemini';
        const _logModel = activeModel?.modelId || model;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current!.signal,
          body: JSON.stringify(requestBody),
        });

        // Debug: проверяем что IMAGE_MEMORY_TOOLS отправляются
        if (memoryEnabled && memoryCallsThisTurn < MAX_MEMORY_CALLS_LOCAL) {
          console.log('[DEBUG] Sending IMAGE_MEMORY_TOOLS:', IMAGE_MEMORY_TOOLS.map(t => t.name));
        }

        if (!response.ok) {
          addLogEntry({ type: 'stream_error', source: 'chat', provider: _logProvider, model: _logModel, status: 'error', statusCode: response.status, durationMs: Date.now() - _logTs, error: `HTTP ${response.status}`, chatId: currentChatId || undefined, messageId: targetMessageId });
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
        
        // tool calls и responses собранные в этом раунде
        const roundToolCalls: any[] = [];
        const roundToolResponses: any[] = [];

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

            // Обработка прерываний из-за лимита токенов
            if (parsed.finishReason === 'MAX_TOKENS') {
              setMessages(prev => prev.map(m =>
                m.id !== targetMessageId ? m : {
                  ...m,
                  finishReason: parsed.finishReason,
                  isPartial: true,
                  interruptedChunk: {
                    type: 'chat',
                    messageId: m.id,
                    partialContent: getVisibleMessageText(m.parts),
                    interruptedAt: Date.now(),
                    reason: 'unknown' // or 'max_tokens' if added to the type InterruptReason 
                  }
                }
              ));
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
                  editorChatId || fileEditorChatKey || currentChatId || '',
                  history, // Используем history вместо messages — актуальный массив с текущим user сообщением
                  handleSkillEvent
                );

                // After a successful file mutation, stop forcing tools so model can reply briefly
                if (
                  (name === 'edit_file' || name === 'replace_lines' || name === 'create_file') &&
                  skillResult.functionResponse &&
                  typeof skillResult.functionResponse === 'object' &&
                  (skillResult.functionResponse as any).success
                ) {
                  fileEditorMutated = true;
                  forceFileEditorTools = false;
                }
                
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
                  roundToolResponses.push({
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
                  roundToolResponses.push({
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
                if (memoryCallsThisTurn >= MAX_MEMORY_CALLS_LOCAL) continue;
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
                roundToolResponses.push({
                  toolCallId: callId,
                  name,
                  response: { success: memoryResult.success, id: memoryResult.id },
                });
                
                // После стрима сделаем ещё один раунд
                shouldContinueLoop = true;
              } 
              else if (memoryEnabled && (name === 'save_image_memory' || name === 'search_image_memories' || name === 'recall_image_memory')) {
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // Обработка инструментов визуальной памяти
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                console.log('[IMAGE MEMORY] Tool called:', name, 'args:', args);
                // Лимит вызовов за turn
                if (memoryCallsThisTurn >= MAX_MEMORY_CALLS_LOCAL) continue;
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
                    let base64: string;
                    let mimeType: string;
                    let width: number;
                    let height: number;
                    
                    if (!file) {
                      // Fallback: загрузить из universal image store
                      const { loadUniversalImage } = await import('@/lib/universal-image-store');
                      const universalImg = await loadUniversalImage(fileId);
                      
                      if (universalImg) {
                        base64 = universalImg.base64;
                        mimeType = universalImg.image.mimeType;
                        width = universalImg.image.width;
                        height = universalImg.image.height;
                        console.log('[save_image_memory] Loaded from universal store:', fileId);
                      } else {
                        console.error('[save_image_memory] Image not found:', { imageId, fileId, availableFiles: attachedFiles.map(f => f.id) });
                        imageMemoryResult = { success: false, error: `Image not found: ${imageId}. Available: ${attachedFiles.map(f => f.id).join(', ')}` };
                        continue;
                      }
                    } else {
                      base64 = await file.getData();
                      mimeType = file.mimeType;
                      
                      // Получить размеры изображения
                      const dimensions = await getImageDimensions(base64, mimeType);
                      width = dimensions.width;
                      height = dimensions.height;
                    }
                    
                    // Получить контекст из последних сообщений
                    const messageContext = history
                      .slice(-3)
                      .map(m => getVisibleMessageText(m.parts))
                      .join(' ')
                      .slice(-200);
                    
                    // Сохранить в память
                    const memory = await saveImageMemory({
                      base64,
                      mimeType,
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
                            mimeType,
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
                    
                    // Добавляем memory operation для отображения в чате (с thumbnails для UI)
                    const memoryOp: import('@/types').MemoryOperation = {
                      type: 'search_image',
                      query: args.query,
                      scope: args.scope,
                      results: results.map(r => ({
                        id: r.id,
                        description: r.description,
                        tags: r.tags,
                        entities: r.entities,
                        thumbnailBase64: r.thumbnailBase64,
                      })),
                    };
                    
                    setMessages(prev => prev.map(m => 
                      m.id === targetMessageId
                        ? { ...m, memoryOperations: [...(m.memoryOperations || []), memoryOp] }
                        : m
                    ));
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
                        // Проверяем размер изображения (Gemini имеет лимиты)
                        const imageSizeBytes = base64.length * 0.75; // base64 -> bytes
                        const maxSizeMB = 20; // Gemini лимит ~20MB
                        
                        if (imageSizeBytes > maxSizeMB * 1024 * 1024) {
                          console.warn(`[recall_image_memory] Image too large: ${(imageSizeBytes / 1024 / 1024).toFixed(2)}MB`);
                          imageMemoryResult = { 
                            success: false, 
                            error: `Image too large (${(imageSizeBytes / 1024 / 1024).toFixed(2)}MB). Maximum ${maxSizeMB}MB.` 
                          };
                        } else {
                          // Сохраняем recalled изображение в universal store для доступа skill tools
                          const { saveUniversalImage } = await import('@/lib/universal-image-store');
                          const recalledImageId = memory.id; // Используем ID памяти как ID изображения
                          
                          await saveUniversalImage({
                            id: recalledImageId,
                            source: 'recalled',
                            base64,
                            mimeType: memory.mimeType,
                            width: memory.originalWidth,
                            height: memory.originalHeight,
                            chatId: currentChatId || undefined,
                            messageId: targetMessageId,
                            metadata: {
                              description: memory.description,
                              tags: memory.tags,
                              scope: memory.scope,
                            },
                          });
                          
                          // Генерируем короткий alias для модели
                          const shortAlias = generateImageId();
                          imageAliases.set(shortAlias, recalledImageId);
                          
                          console.log(`[recall_image_memory] Saved to universal store: ${recalledImageId}, alias: ${shortAlias}`);
                          
                          // Обновляем imageMemoryResult с alias для модели
                          imageMemoryResult = {
                            ...imageMemoryResult,
                            image_id: shortAlias, // Короткий ID для использования в следующих tool calls
                          };
                          
                          // Создаем артефакт для UI
                          const recallArtifact: import('@/types').SkillArtifact = {
                            id: `recall_${memory.id}`,
                            type: 'image',
                            label: `🧠 Recalled: ${memory.description}`,
                            data: { 
                              kind: 'base64', 
                              mimeType: memory.mimeType, 
                              base64 
                            },
                            downloadable: true,
                            filename: `recalled_${memory.id}.${memory.mimeType.split('/')[1]}`,
                          };
                          
                          // Добавляем memory operation для отображения в чате
                          const memoryOp: import('@/types').MemoryOperation = {
                            type: 'recall_image',
                            memoryId: memory.id,
                            description: memory.description,
                            tags: memory.tags,
                            thumbnailBase64: memory.thumbnailBase64,
                            scope: memory.scope,
                          };
                          
                          roundToolResponses.push({
                            toolCallId: callId,
                            name,
                            response: imageMemoryResult,
                            extraParts: [{
                              inlineData: {
                                mimeType: memory.mimeType,
                                data: base64
                              }
                            }],
                            artifacts: [recallArtifact],
                            hidden: true,
                          });
                          
                          // Добавляем memory operation к сообщению
                          setMessages(prev => prev.map(m => 
                            m.id === targetMessageId
                              ? { ...m, memoryOperations: [...(m.memoryOperations || []), memoryOp] }
                              : m
                          ));
                          
                          roundToolCalls.push({ 
                            id: callId, 
                            name, 
                            args,
                            thoughtSignature: parsed.thoughtSignature,
                          });
                          
                          shouldContinueLoop = true;
                          continue; // Пропускаем обычную обработку ниже
                        }
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
                roundToolResponses.push({
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

        // Flush any buffered chunks before finishing.
        flush();
        addLogEntry({ type: 'stream_done', source: 'chat', provider: _logProvider, model: _logModel, status: 'ok', statusCode: 200, durationMs: Date.now() - _logTs, chatId: currentChatId || undefined, messageId: targetMessageId });

        // Если были tool calls в этом раунде — сохраняем раунд для следующей итерации
        if (roundToolCalls.length > 0 && roundToolResponses.length > 0) {
          completedRounds.push({
            calls: roundToolCalls,
            responses: roundToolResponses,
          });
          
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
      } // конец while (shouldContinueLoop)
    } // конец try

    } catch (e: any) {
      if (e.name === 'AbortError') {
        addLogEntry({ type: 'stream_aborted', source: 'chat', provider: (activeProvider?.type === 'openai' ? 'openai' : activeProvider?.type === 'anthropic' ? 'anthropic' : 'gemini'), model: activeModel?.modelId || model, status: 'aborted', durationMs: 0, chatId: currentChatId || undefined, messageId: targetMessageId });
      } else {
        addLogEntry({ type: 'stream_error', source: 'chat', provider: (activeProvider?.type === 'openai' ? 'openai' : activeProvider?.type === 'anthropic' ? 'anthropic' : 'gemini'), model: activeModel?.modelId || model, status: 'error', durationMs: 0, error: e.message || 'Ошибка стриминга', chatId: currentChatId || undefined, messageId: targetMessageId });
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
  }, [selectedApiKeyEntry, model, systemPrompt, tools, temperature, thinkingBudget, deepThinkState, deepThinkAnalyze, deepThinkSystemPrompt, currentChatId, fileEditorChatKey, memoryEnabled, activeProvider, maxOutputTokens, handleSkillEvent, maxToolRounds, maxMemoryCalls]);

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

    // File Editor: сразу открываем txt/code в панели (мост skill↔UI)
    if (files.length > 0) {
      try {
        await checkFilesForEditor(files);
      } catch (e) {
        console.error('[File Editor] auto-open failed:', e);
      }
    }

    addLogEntry({
      type: 'send', source: 'chat',
      chatId: currentChatId || undefined,
      messageId: userMsg.id, after: serializeMessage(userMsg),
    });
    addLogEntry({
      type: 'stream_start', source: 'chat',
      chatId: currentChatId || undefined,
      messageId: assistantMsgId, after: serializeMessage(assistantMsg),
    });

    const historyToSend = [...messages, userMsg];
    await streamGeneration(historyToSend, assistantMsgId, false);
  }, [selectedApiKey, model, isStreaming, messages, streamGeneration, selectedApiKeySuffix, activeModel, currentChatId, checkFilesForEditor]);

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
      addLogEntry({
        type: 'regenerate', source: 'chat',
        chatId: currentChatId || undefined,
        messageId: newMsgId, after: serializeMessage(assistantMsg),
      });
      await streamGeneration(messages, newMsgId, false);
      return;
    }

    // Иначе это сообщение от модели — находим его, удаляем и пересоздаём (регенерация)
    const lastModelIdx = [...messages].reverse().findIndex(m => m.role === 'model');
    if (lastModelIdx === -1) return;
    const actualIdx = messages.length - 1 - lastModelIdx;
    const oldMsg = messages[actualIdx];
    const newMsgId = generateId();
    const newMessages = [
      ...messages.slice(0, actualIdx),
      { id: newMsgId, role: 'model' as const, parts: [{ text: '' }], isStreaming: true, modelName: model, apiKeySuffix: selectedApiKeySuffix || undefined },
    ];
    setMessages(newMessages);
    addLogEntry({
      type: 'regenerate', source: 'chat',
      chatId: currentChatId || undefined,
      messageId: newMsgId, before: serializeMessage(oldMsg),
    });
    await streamGeneration(messages.slice(0, actualIdx), newMsgId, false);
  }, [isStreaming, messages, streamGeneration, model, selectedApiKeySuffix, currentChatId]);

  // Continue: отправляет точку в чат и сразу запускает новую генерацию.
  // (Старый append-режим streamGeneration больше не поддерживается Gemini API)
  const handleContinue = useCallback(async () => {
    if (isStreaming) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'model') return;
    if (!selectedApiKeyEntry?.key) {
      setError('Выберите API ключ в настройках.');
      return;
    }

    // Очищаем флаги прерывания у последнего сообщения
    const cleaned = messages.map((m, i) => {
      if (i === messages.length - 1 && (m.isPartial || m.interruptedChunk)) {
        const resetMsg = { ...m };
        delete resetMsg.isPartial;
        delete resetMsg.interruptedChunk;
        return resetMsg;
      }
      return m;
    });

    const dotMsg: Message = {
      id: generateId(),
      role: 'user',
      parts: [{ text: '.' }],
    };
    const newMsgId = generateId();
    const assistantMsg: Message = {
      id: newMsgId,
      role: 'model',
      parts: [{ text: '' }],
      isStreaming: true,
      modelName: model,
      apiKeySuffix: selectedApiKeySuffix || undefined,
    };

    const historyForApi = [...cleaned, dotMsg];
    setMessages([...historyForApi, assistantMsg]);
    setUnsaved(true);

    addLogEntry({
      type: 'continue', source: 'chat',
      chatId: currentChatId || undefined,
      messageId: newMsgId,
    });

    await streamGeneration(historyForApi, newMsgId, false);
  }, [isStreaming, messages, streamGeneration, model, selectedApiKeySuffix, selectedApiKeyEntry, currentChatId, setUnsaved, setError]);

  // ============ MERGE MESSAGES ============
  // Слияние: если между двумя model-сообщениями нет user-сообщения,
  // нижнее можно слить в верхнее (текст нижнего добавляется к верхнему).
  const handleMergeWithPrevious = useCallback((messageId: string) => {
    if (isStreaming) return;
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx <= 0) return prev;
      const current = prev[idx];
      if (current.role !== 'model' || current.isStreaming) return prev;

      // Ищем предыдущее ВИДИМОЕ сообщение (пропускаем скрытые kind)
      let prevIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        const m = prev[i];
        if (m.kind === 'tool_response' || m.kind === 'bridge_data') continue;
        prevIdx = i;
        break;
      }
      if (prevIdx === -1) return prev;
      const target = prev[prevIdx];
      if (target.role !== 'model') return prev;

      // Извлекаем чистый текст обоих сообщений
      const targetText = getVisibleMessageText(target.parts);
      const currentText = getVisibleMessageText(current.parts);

      // Склеиваем через два переноса строки
      const combinedText = targetText && currentText
        ? `${targetText}\n\n${currentText}`
        : (targetText || currentText || '');

      // Сохраняем нетекстовые части (мысли и т.д.)
      const nonTextPartsTarget = target.parts.filter(p => isThoughtPart(p) || !('text' in p));
      const nonTextPartsCurrent = current.parts.filter(p => isThoughtPart(p) || !('text' in p));

      const mergedParts: Part[] = [
        ...nonTextPartsTarget,
        ...nonTextPartsCurrent,
        { text: combinedText },
      ];

      const mergedFiles = [
        ...(target.files || []),
        ...(current.files || []),
      ];

      const mergedArtifacts = [
        ...(target.skillArtifacts || []),
        ...(current.skillArtifacts || []),
      ];

      const mergedTarget: Message = {
        ...target,
        parts: mergedParts,
        files: mergedFiles.length > 0 ? mergedFiles : undefined,
        skillArtifacts: mergedArtifacts.length > 0 ? mergedArtifacts : undefined,
        thinking: [target.thinking, current.thinking].filter(Boolean).join('\n\n---\n\n') || undefined,
        deepThinking: [target.deepThinking, current.deepThinking].filter(Boolean).join('\n\n---\n\n') || undefined,
      };

      const next = [...prev];
      next[prevIdx] = mergedTarget;
      next.splice(idx, 1);

      addLogEntry({
        type: 'merge', source: 'chat',
        chatId: currentChatId || undefined,
        messageId: target.id,
        before: serializeMessage(current),
        after: serializeMessage(mergedTarget),
      });

      if (currentChatId) {
        saveCurrentChat(next, undefined, false).catch(console.error);
      }
      return next;
    });
    setUnsaved(true);
  }, [isStreaming, currentChatId, saveCurrentChat, setUnsaved]);

  // ============ DEEPTHINK IMPROVEMENTS ============
  
  // Регенерация только текста без повторного DeepThink
  const handleRegenerateTextOnly = useCallback(async (messageId: string) => {
    if (isStreaming) return;

    const msgIdx = messages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;

    const existingMsg = messages[msgIdx];
    const historyBefore = messages.slice(0, msgIdx);

    // Сбросить только основной текст и ошибки — сохранить deepThinking, deepThinkAnalysis
    setMessages(prev => prev.map(m =>
      m.id !== messageId ? m : {
        ...m,
        parts: [{ text: '' }],
        thinking: undefined,
        error: undefined,
        errorType: undefined,
        errorCode: undefined,
        errorStatus: undefined,
        errorRetryAfterMs: undefined,
        isBlocked: false,
        blockReason: undefined,
        finishReason: undefined,
        isStreaming: true,
      }
    ));

    addLogEntry({
      type: 'regenerate', source: 'chat',
      chatId: currentChatId || undefined,
      messageId,
      before: serializeMessage(existingMsg),
    });

    // Передать сохранённый enhanced prompt через новый параметр
    await streamGeneration(
      historyBefore,
      messageId,
      false,
      undefined,                                // customAnalysis
      existingMsg.deepThinkEnhancedPrompt,      // prebuiltSystemPrompt
    );
  }, [isStreaming, messages, streamGeneration, currentChatId]);

  // Редактирование DeepThink размышлений
  const extractEnhancedPromptFromThinking = (thinking: string): string => {
    const marker = '---СИСТЕМНЫЙ ПРОМПТ---';
    const idx = thinking.indexOf(marker);
    return idx !== -1
      ? thinking.slice(idx + marker.length).trim()
      : thinking.trim();
  };

  const handleEditDeepThinking = useCallback((messageId: string, newThinking: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const newEnhancedPrompt = extractEnhancedPromptFromThinking(newThinking);
      return {
        ...m,
        deepThinking: newThinking,
        deepThinkEnhancedPrompt: newEnhancedPrompt || m.deepThinkEnhancedPrompt,
      };
    }));
  }, []);

  // Скрыть blocked state
  const handleDismissBlocked = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id !== messageId ? m : { ...m, isBlocked: false, blockReason: undefined }
    ));
  }, []);

  // Продолжить DeepThink после прерывания
  const handleContinueDeepThink = useCallback(async (messageId: string) => {
    if (isStreaming) return;
    
    const msgIdx = messages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;
    
    const historyBefore = messages.slice(0, msgIdx);
    
    // Сбросить флаг interrupted и запустить заново
    setMessages(prev => prev.map(m =>
      m.id !== messageId ? m : {
        ...m,
        deepThinkInterrupted: false,
        deepThinkError: undefined,
        isStreaming: true,
      }
    ));
    
    // Запустить streamGeneration заново с DeepThink
    await streamGeneration(historyBefore, messageId, false);
  }, [isStreaming, messages, streamGeneration]);

  // Пропустить DeepThink и начать генерацию текста
  const handleSkipDeepThink = useCallback(async (messageId: string) => {
    if (isStreaming) return;
    
    const msgIdx = messages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;
    
    const historyBefore = messages.slice(0, msgIdx);
    
    // Сбросить флаг interrupted и начать генерацию без DeepThink
    setMessages(prev => prev.map(m =>
      m.id !== messageId ? m : {
        ...m,
        deepThinkInterrupted: false,
        deepThinkError: undefined,
        isStreaming: true,
      }
    ));
    
    // Запустить streamGeneration без DeepThink (используя базовый systemPrompt)
    await streamGeneration(historyBefore, messageId, false, undefined, systemPrompt);
  }, [isStreaming, messages, streamGeneration, systemPrompt]);

  const handleBranch = useCallback((messageId: string) => {
    if (isStreaming || (appMode === 'arena' && arena.isStreaming)) return;
    
    if (appMode === 'arena') {
      arena.branchSession(messageId);
      return;
    }
    
    const msgIdx = messages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;
    
    if (messages.length > 0) {
      // updateCurrentId=false: иначе асинхронный хвост сохранения старого чата
      // отменит создание ветки (вернёт currentChatId, заголовок и unsaved)
      saveCurrentChat(messages, undefined, false).catch(console.error);
    }
    
    const branchMessages = messages.slice(0, msgIdx + 1).map(m => ({ ...m }));
    const newChatId = generateId();
    setCurrentChatId(newChatId);
    setActiveChatId(newChatId);
    setMessages(branchMessages);
    setChatTitle(chatTitle ? `${chatTitle} (Ветка)` : 'Новая ветка');
    setUnsaved(true);

    addLogEntry({
      type: 'branch', source: 'chat',
      chatId: newChatId,
      messageId,
      affectedMessageIds: branchMessages.map(m => m.id),
      messageCount: branchMessages.length,
    });
  }, [isStreaming, appMode, arena, messages, chatTitle, saveCurrentChat]);

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

    addLogEntry({
      type: 'send', source: 'chat',
      chatId: currentChatId || undefined,
      messageId: userToolMessage.id,
      after: serializeMessage(userToolMessage),
      affectedMessageIds: [modelMessageId, userToolMessage.id, assistantMsgId],
    });

    await streamGeneration([...updatedMessages, userToolMessage], assistantMsgId, false);
  }, [isStreaming, messages, model, selectedApiKeySuffix, streamGeneration, currentChatId]);

  const handleEdit = useCallback((id: string, newParts: Part[]) => {
    const msgIdx = messages.findIndex(m => m.id === id);
    if (msgIdx === -1) return;
    const msg = messages[msgIdx];
    const before = serializeMessage(msg);
    const after = serializeMessage({ ...msg, parts: newParts });
    addLogEntry({
      type: 'edit_message', source: 'chat',
      chatId: currentChatId || undefined,
      messageId: id, before, after,
    });

    if (msg.role === 'user') {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, parts: newParts, forceEdit: false } : m
      ));
    } else {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, parts: newParts, isBlocked: false, error: undefined, errorType: undefined, errorCode: undefined, errorStatus: undefined } : m
      ));
    }
  }, [messages, currentChatId]);

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
    const msg = messages.find(m => m.id === id);
    if (msg) {
      addLogEntry({
        type: 'delete_message', source: 'chat',
        chatId: currentChatId || undefined,
        messageId: id, before: serializeMessage(msg),
      });
    }
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }, [messages, currentChatId]);

  // ============ FILE EDITOR HANDLERS (bridge) ============
  const handleAcceptEdits = useCallback((fileId: string) => {
    acceptFileEditorEdits(fileId);
  }, [acceptFileEditorEdits]);

  const handleRejectEdits = useCallback((fileId: string) => {
    rejectFileEditorEdits(fileId);
  }, [rejectFileEditorEdits]);

  const handleManualEdit = useCallback((fileId: string, newContent: string) => {
    manualFileEditorEdit(fileId, newContent);
  }, [manualFileEditorEdit]);

  const handleDownloadFile = useCallback((fileId: string) => {
    const file = openFiles.find(f => f.id === fileId);
    if (!file) return;

    const blob = new Blob([file.content], { type: file.mimeType || 'text/plain' });
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
    revertFileEditorFile(fileId);
  }, [revertFileEditorFile]);

  const handleCloseFile = useCallback((fileId: string) => {
    closeFileEditorFile(fileId);
  }, [closeFileEditorFile]);

  const handleEditDeepThinkAnalysis = useCallback(async (id: string, analysis: DeepThinkAnalysis) => {
    // Найти сообщение и перегенерировать с новым анализом
    const msgIdx = messages.findIndex(m => m.id === id);
    if (msgIdx === -1) return;
    
    // Получить историю до этого сообщения
    const historyUpTo = messages.slice(0, msgIdx);
    
    // Перегенерировать с кастомным анализом
    await streamGeneration(historyUpTo, id, false, analysis);
  }, [messages, streamGeneration]);

  const handleStop = useCallback(() => {
    // Помечаем оборванное сообщение как partial — для кнопки "Продолжить"
    try {
      const streaming = messagesRef.current.find(m => m.isStreaming && m.role === 'model');
      const partial = streaming ? getVisibleMessageText(streaming.parts) : '';
      if (partial.trim().length > 20 && streaming) {
        setMessages(prev => prev.map(m =>
          m.id === streaming.id ? { ...m, isPartial: true } : m
        ));
      }
    } catch (e) {
      console.error('stop marking failed', e);
    }

    abortControllerRef.current?.abort();
    abortDeepThink();
  }, [abortDeepThink]);

  /** Пустой ход модели — для ручного ввода/правки ответа ассистента (не user). */
  const handleAddModelMessage = useCallback(() => {
    const msg: Message = {
      id: generateId(),
      role: 'model',
      parts: [{ text: '' }],
      modelName: model || undefined,
      apiKeySuffix: selectedApiKeySuffix || undefined,
    };
    setMessages(prev => [...prev, msg]);
    setUnsaved(true);
  }, [model, selectedApiKeySuffix]);

  const clearChatState = useCallback(() => {
    if (messages.length > 0) {
      addLogEntry({
        type: 'clear_chat', source: 'chat',
        chatId: currentChatId || undefined,
        messageCount: messages.length,
      });
    }
    setMessages([]);
    setTokenCount(0);
    setError('');
    setCurrentChatId(null);
    setChatTitle('');
    setUnsaved(false);
    setActiveChatId(null);
  }, [messages, currentChatId]);

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
    addLogEntry({ type: 'new_chat', source: 'chat', chatId: currentChatId || undefined });
    // Сразу очищаем чат БЕЗ подтверждения (это новый чат, не удаление)
    clearChatState();
    setSystemPrompt('');
    setDeepThinkSystemPrompt(loadDeepThinkSystemPrompt() || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
    setTools([]);
    // 🔥 Сбрасываем canvas
    setLiveCode('');
    setWebsiteType(null);
    setShowLiveCanvas(false);
  }, [isStreaming, messages, saveCurrentChat, clearChatState, currentChatId]);

  // Visible messages (filtered for display)
  const visibleMessages = useMemo(
    () => messages.filter(message => {
      if (message.kind === 'tool_response') return false;
      if (message.kind === 'bridge_data') return false;
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

  // Windowed rendering: only render a subset of messages for performance
  const {
    renderedMessages,
    hasMoreAbove,
    loadMoreAbove,
    resetWindow: resetMessageWindow,
    topSentinelRef,
    isAutoLoading,
  } = useWindowedMessages({
    messages: visibleMessages,
    initialWindowSize: 50,
    loadMoreCount: 30,
  });

  const handleLoadChat = useCallback((chat: SavedChat) => {
    if (isStreaming) return;
    if (messages.length > 0 && unsaved) {
      // updateCurrentId=false: фоновое сохранение СТАРОГО чата не должно
      // возвращать currentChatId/заголовок после загрузки нового чата
      saveCurrentChat(messages, undefined, false).catch(err => {
        console.error('Failed to save current chat before loading:', err);
        // TODO: показать toast пользователю
      });
    }
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setChatTitle(chat.title);
    const loadModel = allModels.find(m => m.id === chat.model);
    if (loadModel) {
      setActiveProviderIdState(loadModel.providerId);
      setActiveModelState({ providerId: loadModel.providerId, modelId: loadModel.id });
    } else {
      setActiveModelState({ providerId: 'google', modelId: chat.model });
    }
    setSystemPrompt(chat.systemPrompt || '');
    setDeepThinkSystemPrompt(chat.deepThinkSystemPrompt || loadDeepThinkSystemPrompt() || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
    setTools(chat.tools || []);
    setTemperature(chat.temperature ?? 1.0);
    setActiveChatId(chat.id);
    setUnsaved(false);
    setError('');

    addLogEntry({
      type: 'load_chat', source: 'chat',
      chatId: chat.id,
      messageCount: chat.messages.length,
    });

    // Reset windowed messages and scroll to bottom immediately
    resetMessageWindow();
    requestAnimationFrame(() => {
      scrollToBottomImmediate();
    });
  }, [isStreaming, messages, unsaved, saveCurrentChat, allModels, resetMessageWindow, scrollToBottomImmediate]);

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
    setSavedChats((prev: SavedChat[]) => prev.filter((c: SavedChat) => c.id !== id));
    
    if (currentChatId === id) {
      // clearChatState напрямую: удаление чата уже подтверждено пользователем,
      // дополнительный confirm "Очистить текущий чат?" не нужен
      clearChatState();
    }
  }, [currentChatId, clearChatState, savedChats]);

  // Переименование сохранённого чата (title обновляется в storage без перезаписи сообщений)
  const handleRenameChat = useCallback(async (id: string, newTitle: string) => {
    const title = newTitle.trim();
    if (!title) return;
    await renameChatInStorage(id, title);
    setSavedChats((prev: SavedChat[]) =>
      prev
        .map((c: SavedChat) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    );
    // Если это открытый чат — обновляем заголовок сессии
    if (currentChatId === id) {
      setChatTitle(title);
    }
    addLogEntry({ type: 'edit_message', source: 'chat', chatId: id });
  }, [currentChatId, setSavedChats, setChatTitle]);

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

  // Connect handlers to sidebar props
  settingsSidebarProps.onLoadChat = handleLoadChat;
  settingsSidebarProps.onNewChat = handleNewChat;
  settingsSidebarProps.onDeleteChat = handleDeleteSavedChat;

  // Messages to display: in arena mode use arena session messages
  const displayMessages = appMode === 'arena'
    ? (arena.activeSession?.messages ?? [])
    : messages;

  const arenaVisibleMessages = useMemo(
    () => displayMessages.filter(message => {
      if (message.kind === 'tool_response') return false;
      return true;
    }),
    [displayMessages]
  );

  // Windowed rendering for arena mode
  const {
    renderedMessages: arenaRenderedMessages,
    hasMoreAbove: arenaHasMoreAbove,
    loadMoreAbove: arenaLoadMoreAbove,
    topSentinelRef: arenaTopSentinelRef,
    isAutoLoading: arenaIsAutoLoading,
  } = useWindowedMessages({
    messages: arenaVisibleMessages,
    initialWindowSize: 50,
    loadMoreCount: 30,
  });

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_24%),var(--surface-0)]">
      {/* Storage Warning Banner */}
      <StorageWarningBanner />

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
              onRenameChat={handleRenameChat}
              onClose={() => setChatSidebarOpen(false)}
              {...chatSidebarArenaProps}
            />
          </div>
        </div>
      )}

      {isMobile && settingsSidebarOpen && (
        <div className="sidebar-mobile-overlay sidebar-mobile-overlay-right" onClick={(e) => { if (e.target === e.currentTarget) setSettingsSidebarOpen(false); }}>
          <div className="sidebar-backdrop" />
          <div className="sidebar-panel">
            {appMode === 'arena' ? (
              <ArenaAgentsSidebar
                session={arena.activeSession}
                models={allModels}
                providers={providers}
                globalApiKeys={apiKeys}
                savedChats={savedChats}
                onUpdateAgent={arena.updateAgent}
                onAddAgent={arena.addAgent}
                onRemoveAgent={arena.removeAgent}
                responseMode={arena.activeSession?.responseMode ?? 'auto'}
                onToggleMode={arena.toggleResponseMode}
                onImportChat={arena.importChatAsSession}
                onUpdateSessionPrompt={arena.updateSessionSystemPrompt}
                onClose={() => setSettingsSidebarOpen(false)}
              />
            ) : (
              <SettingsSidebar
                {...settingsSidebarProps}
                onClose={() => setSettingsSidebarOpen(false)}
              />
            )}
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="flex-shrink-0 overflow-hidden border-r border-[var(--border-subtle)] transition-[width,opacity] duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]" style={chatSidebarStyle}>
          <div className="h-full w-[320px]">
            <ChatSidebar
              savedChats={savedChats}
              currentChatId={currentChatId}
              onLoadChat={handleLoadChat}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteSavedChat}
              onRenameChat={handleRenameChat}
              {...chatSidebarArenaProps}
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
            <div className="hidden md:flex items-center gap-1 mx-2 bg-[var(--surface-2)] p-0.5 rounded-lg border border-[var(--border)]">
              <button onClick={() => setAppMode('chat')} className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${appMode === 'chat' ? 'bg-[var(--surface-4)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'}`}>Chat</button>
              <button onClick={() => setAppMode('arena')} className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${appMode === 'arena' ? 'bg-amber-400/20 text-amber-400 shadow-sm border border-amber-400/30' : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'}`}>Arena</button>
              <button onClick={() => setAppMode('jev')} className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${appMode === 'jev' ? 'bg-violet-400/15 text-violet-200 shadow-sm border border-violet-400/25' : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'}`}>Jev</button>
            </div>            <div className="flex items-center gap-2 min-w-0">
              {appMode === 'arena' && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full flex-shrink-0">
                  <Zap size={9} />
                  Arena
                </span>
              )}
              {appMode === 'jev' ? (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-200 bg-violet-400/10 border border-violet-400/20 px-2 py-0.5 rounded-full flex-shrink-0">◈ Jev Decisions</span>
              ) : appMode === 'arena' ? (
                <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px] md:max-w-xs">
                  {arena.activeSession?.title || 'Новая арена'}
                </span>
              ) : chatTitle ? (
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
                  ? appMode === 'arena'
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-400'
                    : 'border-[var(--border-strong)] bg-[var(--surface-3)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-dim)] hover:border-[var(--border)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
              }`}
              title={appMode === 'arena' ? 'Агенты' : 'Настройки'}
            >
              {appMode === 'arena' ? <Zap size={13} /> : <SlidersHorizontal size={13} />}
              <span className="hidden md:block">{appMode === 'arena' ? 'Агенты' : 'Настройки'}</span>
            </button>
            
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
                <FilePen size={13} />
                <span className="hidden md:block">Editor</span>
                {openFiles.some(f => f.isDirty) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                )}
              </button>
            )}
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
          ref={setScrollContainer}
          className="flex-1 overflow-y-auto chat-messages-area px-6 py-8 relative"
          onScroll={handleScroll}
        >
          {appMode === 'jev' ? (
            <JevDecisionLab defaultApiKey={selectedApiKey || ''} />
          ) : showLiveCanvas ? (
            <LivePreviewPanel
              code={liveCode}
              onClose={() => setShowLiveCanvas(false)}
              websiteType={websiteType}
            />
          ) : (appMode === 'arena' ? (arena.activeSession?.messages ?? []) : messages).length === 0 ? (
            appMode === 'arena' ? (
              <ArenaEmptyState
                hasSession={!!arena.activeSession}
                agentCount={arena.activeSession?.agents.length ?? 0}
                onCreateSession={arena.createSession}
              />
            ) : (
              <EmptyState 
                hasApiKey={hasKeys} 
                hasModel={!!model} 
                apiKeysCount={Object.values(apiKeys).flat().length} 
                onSuggestionClick={(text) => handleSend(text, [])}
              />
            )
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Load more indicator for chat mode */}
              {appMode === 'chat' && hasMoreAbove && (
                <div ref={topSentinelRef as any} className="flex justify-center py-3">
                  <button
                    onClick={loadMoreAbove}
                    disabled={isAutoLoading}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded-lg transition-all disabled:opacity-50"
                  >
                    {isAutoLoading ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <ChevronUp size={12} />
                        ЗагрузитьEarlier сообщения
                      </>
                    )}
                  </button>
                </div>
              )}
              {/* Load more indicator for arena mode */}
              {appMode === 'arena' && arenaHasMoreAbove && (
                <div ref={arenaTopSentinelRef as any} className="flex justify-center py-3">
                  <button
                    onClick={arenaLoadMoreAbove}
                    disabled={arenaIsAutoLoading}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded-lg transition-all disabled:opacity-50"
                  >
                    {arenaIsAutoLoading ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Загрузка...
                      </>
                    ) : (
                      <>
                        <ChevronUp size={12} />
                        ЗагрузитьEarlier сообщения
                      </>
                    )}
                  </button>
                </div>
              )}
              {(appMode === 'arena' ? arenaRenderedMessages : renderedMessages).map((message, idx) => {
                const msgList = appMode === 'arena' ? arenaRenderedMessages : renderedMessages;
                const isLastMessage = idx === msgList.length - 1;
                return (
                  <div key={message.id} className={isLastMessage ? 'animate-message-appear' : ''}>
                    {/* Arena: agent header above model messages */}
                    {appMode === 'arena' && message.role === 'model' && message.arenaAgentId && (
                      <AgentMessageHeader
                        agent={arena.activeSession?.agents.find(a => a.id === message.arenaAgentId)}
                      />
                    )}
                    <ChatMessage
                      message={message}
                      index={idx}
                      isLast={idx === msgList.length - 1}
                      isStreaming={appMode === 'arena'
                        ? (arena.isStreaming && message.isStreaming === true)
                        : (isStreaming && message.id === streamingId)
                      }
                      canRegenerate={appMode === 'arena' ? (!isStreaming && !!arena.activeSession && arena.activeSession.messages.some(m => m.role === 'model' && !m.isStreaming)) : (hasApiAndModel && !isStreaming)}
                      onEdit={appMode === 'arena'
                        ? (id: string, newParts: Part[]) => arena.editMessage(id, newParts)
                        : handleEdit
                      }
                      onDelete={appMode === 'arena'
                        ? (id: string) => arena.deleteMessage(id)
                        : handleDelete
                      }
                      onRegenerate={appMode === 'arena' ? () => {
                        // Regenerate last model message
                        const lastModelMsg = [...(arena.activeSession?.messages || [])].reverse().find(m => m.role === 'model');
                        if (lastModelMsg) arena.regenerateAgentResponse(lastModelMsg.id);
                      } : handleRegenerate}
                      onContinue={appMode === 'arena' ? () => arena.continueAgentStream(message.id) : handleContinue}
                      onBranch={() => handleBranch(message.id)}
                      onSubmitToolResults={appMode === 'arena' ? () => {} : handleSubmitToolResults}
                      onEditPreviousUserMessage={appMode === 'arena' ? () => {} : forceEditPreviousUserMessage}
                      onClearForceEdit={appMode === 'arena' ? () => {} : clearForceEdit}
                      onEditDeepThinkAnalysis={appMode === 'arena' ? () => {} : handleEditDeepThinkAnalysis}
                      onPlayHTML={(html) => {
                        setLiveCode(html);
                        setShowLiveCanvas(true);
                      }}
                      onAnnotationClick={(annotation) => {
                        const imageFile = message.files?.find(f => f.mimeType.startsWith('image/'));
                        if (!imageFile) return;
                        
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
                      canMergeWithPrevious={
                        appMode !== 'arena' &&
                        message.role === 'model' &&
                        !message.isStreaming &&
                        idx > 0 &&
                        msgList[idx - 1].role === 'model'
                      }
                      onMergeWithPrevious={handleMergeWithPrevious}
                      onRegenerateTextOnly={appMode === 'arena' ? undefined : handleRegenerateTextOnly}
                      onDismissBlocked={appMode === 'arena' ? undefined : handleDismissBlocked}
                      onEditDeepThinking={appMode === 'arena' ? undefined : handleEditDeepThinking}
                      onContinueDeepThink={appMode === 'arena' ? undefined : handleContinueDeepThink}
                      onSkipDeepThink={appMode === 'arena' ? undefined : handleSkipDeepThink}
                      onSceneStateSettingsOpen={() => setIsSceneStateSettingsOpen(true)}
                      isSceneStatePinned={isSceneStatePinned}
                      onToggleSceneStatePin={handleToggleSceneStatePin}
                      onRequestSceneCategory={handleRequestSceneCategory}
                    />
                  </div>
                );
              })}
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
        <div className={`flex-shrink-0 max-w-3xl mx-auto w-full chat-input-wrapper ${appMode === 'jev' ? 'hidden' : ''}`}>
          {appMode === 'chat' && (
            <div className="px-4 mb-2 flex items-center justify-end gap-2">
              <DeepThinkToggle
                state={deepThinkState}
                onToggle={toggleDeepThink}
              />
              <button
                onClick={() => setShowInsights(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  showInsights
                    ? 'bg-[var(--gem-teal)]/15 border-[var(--gem-teal)]/40 text-[var(--gem-teal)]'
                    : 'bg-transparent border-[var(--border)] text-white/40 hover:text-white/60'
                }`}
              >
                <BarChart2 size={13} />
                Insights
              </button>
            </div>
          )}
          <ChatInput
            onSend={appMode === 'arena'
              ? (text, files) => arena.sendUserMessage(text, files)
              : handleSend
            }
            onStop={appMode === 'arena' ? arena.stopStreaming : handleStop}
            onAddUserMessage={appMode === 'arena' ? () => {} : handleAddModelMessage}
            isStreaming={appMode === 'arena' ? arena.isStreaming : isStreaming}
            disabled={appMode === 'arena' ? !arena.activeSession : !hasApiAndModel}
            canContinue={appMode === 'arena' ? (
              arena.activeSession?.messages.some(m => m.role === 'model' && !m.isStreaming && m.parts.some(p => 'text' in p && (p as {text:string}).text.length > 0)) ?? false
            ) : canContinue}
            onContinue={appMode === 'arena' ? () => {
              // Continue the last incomplete model message
              const lastModelMsg = [...(arena.activeSession?.messages || [])].reverse().find(m => m.role === 'model' && !m.isStreaming);
              if (lastModelMsg) arena.continueAgentStream(lastModelMsg.id);
            } : handleContinue}
            canRun={appMode === 'arena' ? (
              !!arena.activeSession && arena.activeSession.messages.length > 0 && !arena.isStreaming
            ) : (messages.length > 0 && !isStreaming && hasApiAndModel)}
            onRun={appMode === 'arena' ? () => {
              // Regenerate all agent responses from the last user message
              const lastUserMsg = [...(arena.activeSession?.messages || [])].reverse().find(m => m.role === 'user');
              if (lastUserMsg) {
                arena.regenerateFromMessage(lastUserMsg.id);
              }
            } : handleRegenerate}
            pendingCanvasElement={pendingCanvasElement}
            onCanvasElementConsumed={() => setPendingCanvasElement(null)}
            onAnnotationClick={() => {}}
            deepThinkEnabled={appMode === 'arena' ? false : deepThinkState.enabled}
            onDeepThinkToggle={appMode === 'arena' ? () => {} : toggleDeepThink}
            maxUploadSizeMB={app.maxUploadSizeMB}
          />
          {/* Arena Input Bar */}
          {appMode === 'arena' && arena.activeSession && (
            <ArenaInputBar
              agents={arena.activeSession.agents}
              isStreaming={arena.isStreaming}
              streamingAgentId={arena.streamingAgentId}
              responseMode={arena.activeSession.responseMode}
              onTriggerAgent={arena.triggerAgent}
              onToggleMode={arena.toggleResponseMode}
            />
          )}
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

        {/* Insights Panel - Desktop */}
        {!isMobile && showInsights && (
          <>
            <PanelResizeHandle className="w-1 bg-[var(--border-subtle)] hover:bg-[var(--border-strong)] transition-colors cursor-col-resize z-10" />
            <Panel
              defaultSize={38}
              minSize={28}
              maxSize={55}
              className="flex flex-col min-w-0 border-l border-[var(--border)] overflow-hidden bg-[var(--surface-1)]"
            >
              <InsightsPanel
                messages={messages}
                chatId={currentChatId || ''}
                onClose={() => setShowInsights(false)}
              />
            </Panel>
          </>
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

        {/* Insights Panel - Mobile Bottom Sheet */}
        {isMobile && showInsights && (
          <div
            className="fixed inset-x-0 bottom-0 z-40 flex flex-col bg-[var(--surface-1)] border-t border-[var(--border)] rounded-t-2xl shadow-2xl"
            style={{ height: '72vh', touchAction: 'none' }}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              const startY = touch.clientY;
              
              const handleTouchMove = (e: TouchEvent) => {
                const currentY = e.touches[0].clientY;
                const diff = currentY - startY;
                
                // Свайп вниз на 80px+ = закрыть
                if (diff > 80) {
                  setShowInsights(false);
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
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-[var(--border-strong)]" />
            </div>
            <InsightsPanel
              messages={messages}
              chatId={currentChatId || ''}
              onClose={() => setShowInsights(false)}
            />
          </div>
        )}
      </PanelGroup>

      {!isMobile && (
        <div className="flex-shrink-0 overflow-hidden border-l border-[var(--border-subtle)] transition-[width,opacity] duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]" style={settingsSidebarStyle}>
          <div className="h-full w-[360px]">
            {appMode === 'arena' ? (
              <ArenaAgentsSidebar
                session={arena.activeSession}
                models={allModels}
                providers={providers}
                globalApiKeys={apiKeys}
                savedChats={savedChats}
                onUpdateAgent={arena.updateAgent}
                onAddAgent={arena.addAgent}
                onRemoveAgent={arena.removeAgent}
                responseMode={arena.activeSession?.responseMode ?? 'auto'}
                onToggleMode={arena.toggleResponseMode}
                onImportChat={arena.importChatAsSession}
                onUpdateSessionPrompt={arena.updateSessionSystemPrompt}
              />
            ) : (
              <SettingsSidebar {...settingsSidebarProps} />
            )}
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
        <DeepThinkSettingsDialog
          open={showDeepThinkDialog}
          onClose={() => setShowDeepThinkDialog(false)}
          deepThinkDraft={deepThinkDraft}
          setDeepThinkDraft={setDeepThinkDraft}
          deepThinkSystemPrompt={deepThinkSystemPrompt}
          setDeepThinkSystemPrompt={setDeepThinkSystemPrompt}
          deepThinkProviderId={deepThinkProviderId}
          setDeepThinkProviderId={setDeepThinkProviderId}
          deepThinkModelId={deepThinkModelId}
          setDeepThinkModelId={setDeepThinkModelId}
          deepThinkApiKeyIndex={deepThinkApiKeyIndex}
          setDeepThinkApiKeyIndex={setDeepThinkApiKeyIndex}
          providers={providers}
          apiKeys={apiKeys}
          allModels={allModels}
          currentProviderId={effectiveProviderId}
          currentModel={model}
          currentApiKey={selectedApiKey}
        />
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

      {/* Command Palette */}
      <CommandPalette
        savedChats={savedChats}
        onNewChat={handleNewChat}
        onLoadChat={(id) => {
          const chat = savedChats.find(c => c.id === id);
          if (chat) handleLoadChat(chat);
        }}
        onOpenSettings={() => setSettingsSidebarOpen(true)}
        onOpenMemory={() => setShowMemoryModal(true)}
        onOpenContextInspector={() => setShowContextInspector(true)}
        onToggleCanvas={() => setShowLiveCanvas(prev => !prev)}
      />

      <SceneStateSettingsModal 
        isOpen={isSceneStateSettingsOpen}
        onClose={() => setIsSceneStateSettingsOpen(false)}
      />

      <ContextInspectorModal
        open={showContextInspector}
        onClose={() => {
          setShowContextInspector(false);
          setSkillsRevision(r => r + 1);
        }}
        messages={messages}
        systemPrompt={systemPrompt}
        chatId={currentChatId}
        memoryEnabled={memoryEnabled}
        onMemoryEnabledChange={setMemoryEnabled}
        onSystemPromptChange={setSystemPrompt}
        handleSkillEvent={handleSkillEvent}
        deepThinkEnhancedPrompt={
          messages.filter(m => m.role === 'model').slice(-1)[0]?.deepThinkEnhancedPrompt || null
        }
        onOpenMemory={() => setShowMemoryModal(true)}
        onOpenSkills={() => setShowSkillsMarket(true)}
        onOpenDeepThink={() => setShowDeepThinkDialog(true)}
        onOpenSystem={() => setSettingsSidebarOpen(true)}
      />

      {/* Selection Toolbar */}
      <SelectionToolbar
        onQuote={(text) => {
          const quoted = `> ${text.split('\n').join('\n> ')}\n\n`;
          window.dispatchEvent(new CustomEvent('append-to-input', { detail: quoted }));
        }}
        onAsk={(text) => {
          handleSend(text, []);
        }}
      />
    </div>
  );
}

function EmptyState({ hasApiKey, hasModel, apiKeysCount, onSuggestionClick }: { hasApiKey: boolean; hasModel: boolean; apiKeysCount: number; onSuggestionClick: (text: string) => void }) {
  const [activePool, setActivePool] = useState(0);
  const [fading, setFading] = useState(false);

  const SUGGESTION_POOLS = [
    // Группа 1: Код
    ['Напиши REST API на TypeScript', 'Объясни разницу между useMemo и useCallback', 'Как работает event loop в Node.js?', 'Создай алгоритм бинарного поиска'],
    // Группа 2: Анализ
    ['Проанализируй этот текст на предмет логических ошибок', 'Составь SWOT-анализ для стартапа', 'Помоги структурировать мои мысли', 'Найди противоречия в этом аргументе'],
    // Группа 3: Творчество
    ['Придумай название для продукта', 'Напиши метафору для объяснения квантовой механики', 'Создай необычный персонаж для истории', 'Предложи 5 способов улучшить презентацию'],
    // Группа 4: Факты
    ['Объясни как работает TCP/IP', 'Что такое теорема Гёделя о неполноте?', 'Как устроен нейрон?', 'Расскажи историю интернета кратко'],
  ];

  useEffect(() => {
    if (!hasApiKey || !hasModel) return;
    
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActivePool(prev => (prev + 1) % SUGGESTION_POOLS.length);
        setFading(false);
      }, 200);
    }, 4000);
    return () => clearInterval(interval);
  }, [hasApiKey, hasModel]);

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
        <div className={`mt-8 grid grid-cols-2 gap-2 max-w-sm w-full transition-opacity duration-200 ${fading ? 'opacity-0' : 'opacity-100'}`}>
          {SUGGESTION_POOLS[activePool].map((suggestion, i) => (
            <button
              key={`${activePool}-${i}`}
              onClick={() => onSuggestionClick(suggestion)}
              disabled={fading}
              className="text-left px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] text-xs text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ArenaEmptyState({ hasSession, agentCount, onCreateSession }: { hasSession: boolean; agentCount: number; onCreateSession: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] flex items-center justify-center mb-6">
        <Zap size={24} className="text-black" />
      </div>

      <h2 className="text-2xl font-semibold text-white mb-2 tracking-tight">Multi-AI Arena</h2>
      <p className="text-[var(--text-muted)] max-w-sm leading-relaxed text-sm">
        {!hasSession
          ? 'Создайте сессию, чтобы начать мультиагентное обсуждение'
          : `${agentCount} агентов готовы к обсуждению. Напишите сообщение для начала.`
        }
      </p>

      {!hasSession && (
        <button
          onClick={onCreateSession}
          className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-[linear-gradient(135deg,#fbbf24,#f59e0b)] text-black text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          <Zap size={16} />
          Создать сессию
        </button>
      )}

      {hasSession && (
        <div className="mt-8 grid grid-cols-1 gap-2 max-w-sm w-full">
          {[
            { label: '🎯 Дебаты', text: 'Обсудите плюсы и минусы удалённой работы.' },
            { label: '🧠 Мозговой штурм', text: 'Предложите идеи для мобильного приложения.' },
            { label: '📊 Анализ', text: 'Какие технологии будут доминировать через 5 лет?' },
          ].map(s => (
            <div key={s.label}
              className="text-left text-sm text-[var(--text-dim)] bg-[var(--surface-2)] border border-amber-400/15 hover:border-amber-400/30 hover:text-[var(--text-primary)] rounded-xl px-4 py-3 cursor-default transition-all group"
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




