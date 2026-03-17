'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChatSidebar, SettingsSidebar } from '@/components/Sidebar';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import {
  PanelLeft, MessageSquarePlus, Sparkles, Trash2, AlertCircle,
  SlidersHorizontal,
  Save, X, ArrowDown
} from 'lucide-react';
import { useDeepThink } from '@/lib/useDeepThink';
import DeepThinkToggle from '@/components/DeepThinkToggle';
import type { Message, GeminiModel, AttachedFile, Part, ApiKeyEntry, SavedChat, DeepThinkAnalysis } from '@/types';
import {
  loadApiKeys, saveApiKeys, getNextAvailableKey,
  markKeyUsed, unblockExpiredKeys, isRateLimitError, isInvalidKeyError,
} from '@/lib/apiKeyManager';
import {
  loadSavedChats, saveChatToStorage, deleteChatFromStorage,
  getActiveChatId, setActiveChatId,
} from '@/lib/storage';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateChatTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'Новый чат';
  const text = (firstUser.parts.find(p => 'text' in p) as any)?.text || '';
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

const DEEPTHINK_MEMORY_MARKER = '[DeepThink context from previous assistant turn]';

function buildChatRequestMessages(history: Message[]) {
  return history
    .map(message => {
      const parts: Part[] = message.parts.filter(part => {
        if ('text' in part) return true;
        if ('inlineData' in part) return Boolean(part.inlineData?.data);
        return false;
      });

      if (message.role === 'model' && message.deepThinking?.trim()) {
        parts.push({
          text: `${DEEPTHINK_MEMORY_MARKER}\n${message.deepThinking.trim()}`,
        });
      }

      return {
        role: message.role,
        parts,
      };
    })
    .filter(message => message.parts.length > 0);
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
  const [temperature, setTemperature] = useState<number>(1.0);
  const [thinkingBudget, setThinkingBudget] = useState<number>(-1); // -1=авто

  // UI state
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [tokenCount, setTokenCount] = useState(0);
  const [error, setError] = useState<string>('');

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
  const lastKeyIndexRef = useRef(-1);

  const { state: deepThinkState, toggle: toggleDeepThink, analyze: deepThinkAnalyze } = useDeepThink();

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
      const keys = unblockExpiredKeys(loadApiKeys());
      setApiKeys(keys);

      const savedModel = localStorage.getItem('gemini_model');
      const savedSysPrompt = localStorage.getItem('gemini_sys_prompt');
      const savedTemp = localStorage.getItem('gemini_temperature');
      const savedLegacySidebar = localStorage.getItem('gemini_sidebar');
      const savedChatSidebar = localStorage.getItem('gemini_chats_sidebar');
      const savedSettingsSidebar = localStorage.getItem('gemini_settings_sidebar');
      const savedThinking = localStorage.getItem('gemini_thinking_budget');
      const mobileViewport = window.matchMedia('(max-width: 767px)').matches;

      if (savedModel) setModel(savedModel);
      if (savedSysPrompt) setSystemPrompt(savedSysPrompt);
      if (savedTemp) setTemperature(parseFloat(savedTemp));
      if (!mobileViewport) {
        if (savedChatSidebar !== null) setChatSidebarOpen(savedChatSidebar === 'true');
        else if (savedLegacySidebar !== null) setChatSidebarOpen(savedLegacySidebar === 'true');
        if (savedSettingsSidebar !== null) setSettingsSidebarOpen(savedSettingsSidebar === 'true');
      }
      if (savedThinking !== null) setThinkingBudget(parseInt(savedThinking));

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
          setTemperature(chat.temperature ?? parseFloat(savedTemp || '1'));
        }
      }
    };
    loadData();
  }, []);

  // Persist simple settings
  useEffect(() => { if (model) localStorage.setItem('gemini_model', model); }, [model]);
  useEffect(() => { localStorage.setItem('gemini_sys_prompt', systemPrompt); }, [systemPrompt]);
  useEffect(() => { localStorage.setItem('gemini_temperature', temperature.toString()); }, [temperature]);
  useEffect(() => { localStorage.setItem('gemini_chats_sidebar', chatSidebarOpen.toString()); }, [chatSidebarOpen]);
  useEffect(() => { localStorage.setItem('gemini_settings_sidebar', settingsSidebarOpen.toString()); }, [settingsSidebarOpen]);
  useEffect(() => { localStorage.setItem('gemini_thinking_budget', thinkingBudget.toString()); }, [thinkingBudget]);

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
  const countTokens = useCallback(async (msgs: Message[], sys: string, mod: string, keys: ApiKeyEntry[]) => {
    const activeKey = keys.find(k => !k.blockedUntil || k.blockedUntil <= Date.now());
    if (!activeKey || !mod || msgs.length === 0) { setTokenCount(0); return; }
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: msgs.map(m => ({
            role: m.role,
            parts: m.parts.map(p => {
              if ('text' in p) return { text: p.text };
              return { inlineData: { mimeType: (p as any).inlineData.mimeType, data: (p as any).inlineData.data.slice(0, 100) } };
            }),
          })),
          model: mod,
          systemInstruction: sys,
          apiKey: activeKey.key,
        }),
      });
      const data = await res.json();
      setTokenCount(data.totalTokens || 0);
    } catch {}
  }, []);

  useEffect(() => {
    if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current);
    tokenDebounceRef.current = setTimeout(() => {
      countTokens(messages, systemPrompt, model, apiKeys);
    }, 1000);
    return () => { if (tokenDebounceRef.current) clearTimeout(tokenDebounceRef.current); };
  }, [messages, systemPrompt, model, apiKeys, countTokens]);

  // ============ SAVE CHAT ============
  const saveCurrentChat = useCallback(async (msgs: Message[], title?: string) => {
    if (msgs.length === 0) return;
    const chatId = currentChatId || generateId();
    const chatObj: SavedChat = {
      id: chatId,
      title: title || chatTitle || generateChatTitle(msgs),
      messages: msgs,
      model,
      systemPrompt,
      temperature,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Если чат уже существует, сохраняем createdAt
    const existing = savedChats.find(c => c.id === chatId);
    if (existing) chatObj.createdAt = existing.createdAt;

    await saveChatToStorage(chatObj);
    const updated = await loadSavedChats();
    setSavedChats(updated);
    setCurrentChatId(chatId);
    setActiveChatId(chatId);
    setChatTitle(chatObj.title);
    setUnsaved(false);
    return chatObj;
  }, [currentChatId, chatTitle, model, systemPrompt, temperature, savedChats]);

  // ============ STREAMING ============
  const streamGeneration = useCallback(async (
    history: Message[],
    targetMessageId: string,
    isAppending: boolean,
    customAnalysis?: DeepThinkAnalysis, // Кастомный анализ после редактирования
  ) => {
    // Получить следующий доступный ключ
    const keyResult = getNextAvailableKey(apiKeys, lastKeyIndexRef.current, model);
    if (!keyResult) {
      setError('Все API ключи временно заблокированы. Попробуйте позже.');
      setIsStreaming(false);
      setStreamingId(null);
      return;
    }

    const { key, index } = keyResult;
    lastKeyIndexRef.current = index;

    // Отметить ключ как используемый
    const usedKeys = markKeyUsed(apiKeys, index);
    setApiKeys(usedKeys);
    saveApiKeys(usedKeys);

    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    setStreamingId(targetMessageId);
    setError('');

    // DeepThink Pass 1 — если включён, анализируем сначала
    let effectiveSystemPrompt = systemPrompt;
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
        systemPrompt,
        key,
        model,
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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: buildChatRequestMessages(history),
          model,
          systemInstruction: effectiveSystemPrompt,
          temperature,
          apiKey: key,
          thinkingBudget,
          includeThoughts: deepThinkState.enabled === true,
        }),
      });

      if (!response.ok) {
        setError(`API error: ${response.status}`);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let thinkingAccumulator = isAppending ? (history.find(m => m.id === targetMessageId)?.thinking || '') : '';
      let retryWithNextKey = false;
      let pendingText = '';
      let pendingThinking = '';
      let flushScheduled = false;

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

            // Текст ответа
            if (parsed.text) {
              pendingText += parsed.text;
              scheduleFlush();
            }
          } catch {}
        }

        if (retryWithNextKey) break;
      }

      // Flush any buffered chunks before finishing.
      flush();

      // Retry с другим ключом если rate limit
      if (retryWithNextKey) {
        // Сбросить накопленный текст только если это не продолжение
        if (!isAppending) {
          setMessages(prev => prev.map(m =>
            m.id !== targetMessageId ? m : {
              ...m,
              parts: [{ text: '' }],
              thinking: undefined,
              isStreaming: true,
            }
          ));
        }
        // Рекурсивный вызов с обновлёнными ключами
        await streamGeneration(history, targetMessageId, isAppending);
        return;
      }

    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Ошибка стриминга');
      }
    } finally {
      setIsStreaming(false);
      setStreamingId(null);
      abortControllerRef.current = null;
      setMessages(prev => prev.map(m =>
        m.id === targetMessageId ? { ...m, isStreaming: false } : m
      ));
    }
  }, [apiKeys, model, systemPrompt, temperature, thinkingBudget, deepThinkState, deepThinkAnalyze]);

  // ============ HANDLERS ============
  const handleSend = useCallback(async (text: string, files: AttachedFile[]) => {
    if (apiKeys.length === 0 || !model || isStreaming) return;

    setError('');
    const userParts: Part[] = [];
    if (text) userParts.push({ text });
    files.forEach(f => userParts.push({ inlineData: { mimeType: f.mimeType, data: f.data } }));

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      parts: userParts,
      files: files.length > 0 ? files : undefined,
    };

    const assistantMsgId = generateId();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: 'model',
      parts: [{ text: '' }],
      isStreaming: true,
      modelName: model,
    };

    const newMessages = [...messages, userMsg, assistantMsg];
    setMessages(newMessages);

    const historyToSend = [...messages, userMsg];
    await streamGeneration(historyToSend, assistantMsgId, false);
  }, [apiKeys, model, isStreaming, messages, streamGeneration]);

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
      { id: newMsgId, role: 'model' as const, parts: [{ text: '' }], isStreaming: true, modelName: model },
    ];
    setMessages(newMessages);
    await streamGeneration(messages.slice(0, actualIdx), newMsgId, false);
  }, [isStreaming, messages, streamGeneration, model]);

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
      };
      // История: всё до DeepThink-сообщения включительно, кроме него
      const historyUpTo = messages.slice(0, messages.length - 1);
      setMessages([...messages, assistantMsg]);
      await streamGeneration(historyUpTo, newMsgId, false);
      return;
    }

    await streamGeneration(messages, lastMsg.id, true);
  }, [isStreaming, messages, streamGeneration, model]);

  const handleEdit = useCallback((id: string, newParts: Part[]) => {
    const msgIdx = messages.findIndex(m => m.id === id);
    if (msgIdx === -1) return;
    const msg = messages[msgIdx];
    if (msg.role === 'user') {
      const updatedUser = { ...msg, parts: newParts };
      const historyUpTo = [...messages.slice(0, msgIdx), updatedUser];
      const assistantMsgId = generateId();
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'model',
        parts: [{ text: '' }],
        isStreaming: true,
        modelName: model,
      };
      setMessages([...historyUpTo, assistantMsg]);
      streamGeneration(historyUpTo, assistantMsgId, false);
    } else {
      setMessages(prev => prev.map(m =>
        m.id === id ? { ...m, parts: newParts, isBlocked: false, error: undefined, errorType: undefined, errorCode: undefined, errorStatus: undefined } : m
      ));
    }
  }, [messages, streamGeneration, model]);

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
  }, []);

  const handleAddUserMessage = useCallback(() => {
    const msg: Message = { id: generateId(), role: 'user', parts: [{ text: '' }] };
    setMessages(prev => [...prev, msg]);
  }, []);

  const handleClearChat = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    setTokenCount(0);
    setError('');
    setCurrentChatId(null);
    setChatTitle('');
    setUnsaved(false);
    setActiveChatId(null);
  }, [isStreaming]);

  const handleNewChat = useCallback(() => {
    if (isStreaming) return;
    // Автосохранение текущего чата
    if (messages.length > 0) {
      saveCurrentChat(messages);
    }
    handleClearChat();
  }, [isStreaming, messages, saveCurrentChat, handleClearChat]);

  const handleLoadChat = useCallback((chat: SavedChat) => {
    if (isStreaming) return;
    if (messages.length > 0 && unsaved) {
      saveCurrentChat(messages);
    }
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setChatTitle(chat.title);
    setModel(chat.model);
    setSystemPrompt(chat.systemPrompt || '');
    setTemperature(chat.temperature ?? 1.0);
    setActiveChatId(chat.id);
    setUnsaved(false);
    setError('');
  }, [isStreaming, messages, unsaved, saveCurrentChat]);

  const handleDeleteSavedChat = useCallback(async (id: string) => {
    await deleteChatFromStorage(id);
    const updated = await loadSavedChats();
    setSavedChats(updated);
    if (currentChatId === id) {
      handleClearChat();
    }
  }, [currentChatId, handleClearChat]);

  const handleSavedChatsChange = useCallback(async (chats: SavedChat[]) => {
    setSavedChats(chats);
    for (const c of chats) {
      await saveChatToStorage(c);
    }
  }, []);

  const handleApiKeysChange = useCallback((keys: ApiKeyEntry[]) => {
    setApiKeys(keys);
    saveApiKeys(keys);
  }, []);

  // Auto-save when streaming stops
  useEffect(() => {
    if (!isStreaming && messages.length > 0 && unsaved) {
      const lastMsg = messages[messages.length - 1];
      // Сохраняем только если получили реальный ответ
      const lastText = (lastMsg.parts.find(p => 'text' in p) as any)?.text;
      if (lastMsg.role === 'model' && (lastText || lastMsg.isBlocked)) {
        saveCurrentChat(messages);
      }
    }
  }, [isStreaming]);

  const hasKeys = apiKeys.some(k => !k.blockedUntil || k.blockedUntil <= Date.now());
  const hasApiAndModel = hasKeys && !!model;
  const lastMessage = messages[messages.length - 1];
  const lastIsModel = lastMessage?.role === 'model';
  const canContinue = lastIsModel && !isStreaming && (
    (!!lastMessage?.parts[0] && 'text' in lastMessage.parts[0] && (lastMessage.parts[0] as any).text.length > 0) ||
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
    temperature,
    onTemperatureChange: setTemperature,
    thinkingBudget,
    onThinkingBudgetChange: setThinkingBudget,
    tokenCount,
    isStreaming,
    savedChats,
    onSavedChatsChange: handleSavedChatsChange,
    currentChatId,
    onLoadChat: handleLoadChat,
    onNewChat: handleNewChat,
    onDeleteChat: handleDeleteSavedChat,
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

      {/* Main Chat Area */}
      <div className="flex-1 flex min-w-0 flex-col overflow-hidden">

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
              {messages.map((message, idx) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  index={idx}
                  isLast={idx === messages.length - 1}
                  isStreaming={isStreaming && message.id === streamingId}
                  canRegenerate={hasApiAndModel && !isStreaming}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRegenerate={handleRegenerate}
                  onContinue={handleContinue}
                  onEditPreviousUserMessage={forceEditPreviousUserMessage}
                  onClearForceEdit={clearForceEdit}
                  onEditDeepThinkAnalysis={handleEditDeepThinkAnalysis}
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
          />
        </div>
      </div>

      {!isMobile && (
        <div className="flex-shrink-0 overflow-hidden border-l border-[var(--border-subtle)] transition-[width,opacity] duration-300 ease-out" style={settingsSidebarStyle}>
          <div className="h-full w-[360px]">
            <SettingsSidebar {...settingsSidebarProps} />
          </div>
        </div>
      )}
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
