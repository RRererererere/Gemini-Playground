'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Key, ChevronDown, Thermometer, BookOpen, Cpu,
  Eye, EyeOff, RefreshCw, Loader2, AlertCircle, CheckCircle2, Hash,
  Plus, Trash2, Copy, X, Shield, Clock, ShieldOff,
  MessageSquare, Download, Upload, Brain, ChevronRight,
  Pencil, FolderOpen, Star, Save, Edit3, Unlock
} from 'lucide-react';
import type { GeminiModel, ApiKeyEntry, SavedChat, SavedSystemPrompt } from '@/types';
import {
  loadApiKeys, saveApiKeys, addApiKey, removeApiKey,
  getNextAvailableKey, markKeyBlocked, markKeyUsed,
  unblockExpiredKeys, getKeyStatus, timeUntilUnblock, isRateLimitError, unblockKey,
} from '@/lib/apiKeyManager';
import {
  loadSavedChats, deleteChatFromStorage, exportChats, exportSingleChat,
  importChatsFromFile, importFromGoogleStudio,
  loadSystemPrompts, saveSystemPrompts, createSystemPrompt, cloneSystemPrompt,
  exportAllSettings, importAllSettings
} from '@/lib/storage';

interface SidebarProps {
  // API keys
  apiKeys: ApiKeyEntry[];
  onApiKeysChange: (keys: ApiKeyEntry[]) => void;
  activeKeyIndex: number;
  onActiveKeyIndexChange: (idx: number) => void;
  // Model
  model: string;
  onModelChange: (model: string) => void;
  models: GeminiModel[];
  onModelsLoad: (models: GeminiModel[]) => void;
  // System prompt
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  // Temperature
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  // Thinking
  thinkingBudget: number;
  onThinkingBudgetChange: (v: number) => void;
  // Stats
  tokenCount: number;
  isStreaming: boolean;
  // Chats
  savedChats: SavedChat[];
  onSavedChatsChange: (chats: SavedChat[]) => void;
  currentChatId: string | null;
  onLoadChat: (chat: SavedChat) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  // Mobile
  onClose?: () => void;
}

type SectionId = 'keys' | 'model' | 'system' | 'chats';

export default function Sidebar({
  apiKeys, onApiKeysChange, activeKeyIndex, onActiveKeyIndexChange,
  model, onModelChange, models, onModelsLoad,
  systemPrompt, onSystemPromptChange,
  temperature, onTemperatureChange,
  thinkingBudget, onThinkingBudgetChange,
  tokenCount, isStreaming,
  savedChats, onSavedChatsChange, currentChatId, onLoadChat, onNewChat, onDeleteChat,
  onClose,
}: SidebarProps) {
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set<SectionId>(['keys', 'model']));

  // API Keys
  const [newKeyInput, setNewKeyInput] = useState('');
  const [showNewKey, setShowNewKey] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<number, boolean>>({});

  // System prompts
  const [savedPrompts, setSavedPrompts] = useState<SavedSystemPrompt[]>([]);
  const [promptDropdownOpen, setPromptDropdownOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SavedSystemPrompt | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [showSavePromptDialog, setShowSavePromptDialog] = useState(false);

  // Import
  const importRef = useRef<HTMLInputElement>(null);
  const importGsRef = useRef<HTMLInputElement>(null);
  const importBackupRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');

  // Prevent re-fetching models when only apiKeys metadata changes (e.g. lastUsed).
  const modelsAutoLoadSignature = useMemo(() => {
    const now = Date.now();
    return apiKeys
      .map(k => `${k.key}:${k.blockedUntil && k.blockedUntil > now ? 'b' : 'a'}`)
      .join('|');
  }, [apiKeys]);
  const lastModelsAutoLoadSigRef = useRef<string>('');

  // Load saved prompts
  useEffect(() => {
    setSavedPrompts(loadSystemPrompts());
  }, []);

  const savePrompts = (prompts: SavedSystemPrompt[]) => {
    setSavedPrompts(prompts);
    saveSystemPrompts(prompts);
  };

  const toggleSection = (s: SectionId) => {
    setOpenSections(prev => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s); else n.add(s);
      return n;
    });
  };

  // Load models with first available key
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
        const preferred = data.models.find((m: GeminiModel) =>
          m.name.includes('gemini-2.5-flash') && !m.name.includes('lite') && !m.name.includes('audio')
        ) || data.models.find((m: GeminiModel) =>
          m.name.includes('gemini-2.0-flash') && !m.name.includes('lite')
        ) || data.models[0];
        if (preferred) onModelChange(preferred.name);
      }
    } catch {
      setModelError('Ошибка сети');
    } finally {
      setLoadingModels(false);
    }
  }, [model, onModelChange, onModelsLoad]);

  // Авто-загрузка моделей при изменении ключей
  useEffect(() => {
    const activeKeys = apiKeys.filter(k => !k.blockedUntil || k.blockedUntil <= Date.now());
    if (activeKeys.length === 0) return;

    // Only auto-load when models are empty OR the key availability set changed.
    if (models.length > 0 && lastModelsAutoLoadSigRef.current === modelsAutoLoadSignature) {
      return;
    }
    lastModelsAutoLoadSigRef.current = modelsAutoLoadSignature;

    const timer = setTimeout(() => loadModels(activeKeys[0].key), 800);
    return () => clearTimeout(timer);
  }, [apiKeys, loadModels, models.length, modelsAutoLoadSignature]);

  const addKey = () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) return;
    const updated = addApiKey(apiKeys, trimmed);
    onApiKeysChange(updated);
    saveApiKeys(updated);
    setNewKeyInput('');
    setShowNewKey(false);
  };

  const deleteKey = (key: string) => {
    const updated = removeApiKey(apiKeys, key);
    onApiKeysChange(updated);
    saveApiKeys(updated);
  };

  const formatTokenCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  const selectedModel = models.find(m => m.name === model);
  const modelDisplayName = selectedModel?.displayName || model || 'Выбрать модель';

  const tempLabel = temperature < 0.4 ? 'Точно' : temperature < 0.8 ? 'Баланс' : temperature < 1.4 ? 'Творчески' : 'Хаос';
  const tempColor = temperature < 0.4 ? '#2dd4bf' : temperature < 0.8 ? '#4ade80' : temperature < 1.4 ? '#f59e0b' : '#ef4444';

  const thinkingLabel = thinkingBudget === 0 ? 'Выкл' : thinkingBudget === -1 ? 'Авто' : `${thinkingBudget} токенов`;

  // Импорт чатов
  const handleImportChats = async (file: File) => {
    setImportError('');
    try {
      const imported = await importChatsFromFile(file);
      const merged = [...savedChats];
      for (const chat of imported) {
        if (!merged.find(c => c.id === chat.id)) {
          merged.unshift(chat);
        }
      }
      onSavedChatsChange(merged);
    } catch (e: any) {
      setImportError(e.message);
    }
  };

  // Импорт Google Studio
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
        temperature: result.temperature ?? temperature,
        createdAt: result.createdAt!,
        updatedAt: result.updatedAt!,
      };
      const merged = [chat, ...savedChats];
      onSavedChatsChange(merged);
      onLoadChat(chat);
    } catch (e: any) {
      setImportError(e.message);
    }
  };

  const SectionHeader = ({ id, label, icon: Icon }: { id: SectionId; label: string; icon: any }) => (
    <button
      onClick={() => toggleSection(id)}
      className="flex items-center justify-between w-full px-5 py-3 hover:bg-surface-2/50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-surface-3 transition-colors group-hover:bg-surface-4">
           <Icon size={14} className="text-text-muted" />
        </div>
        <span className="text-[11px] font-bold text-text-dim uppercase tracking-[0.1em] group-hover:text-text-muted transition-colors">{label}</span>
      </div>
      <ChevronDown size={14} className={`text-text-dim transition-transform duration-300 ${openSections.has(id) ? '' : '-rotate-90'}`} />
    </button>
  );

  return (
    <aside className="w-full h-full flex flex-col bg-surface-1 border-r border-border glass relative z-40">
      {/* Header */}
      <div className="px-6 py-8 flex flex-col gap-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-glow-sm">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                   <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="black" />
                </svg>
             </div>
             <div>
                <h1 className="text-lg font-bold text-text-primary tracking-tight">Gemini Studio</h1>
                <p className="text-[10px] text-text-dim uppercase tracking-widest font-semibold mt-0.5">Premium AI Suite</p>
             </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 text-text-dim hover:text-text-primary bg-surface-2 rounded-xl transition-colors md:hidden">
              <X size={18} />
            </button>
          )}
        </div>

        <button
          onClick={() => { onNewChat(); onClose?.(); }}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-black font-bold rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all shadow-premium group"
        >
          <Plus size={18} className="transition-transform group-hover:rotate-90" />
          Новый чат
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">

        {/* ===== API KEYS ===== */}
        <div className="border-b border-[var(--border)]">
          <SectionHeader id="keys" label="API Ключи" icon={Key} />
          {openSections.has('keys') && (
            <div className="px-5 pb-5 space-y-3 animate-slide-down">
              {/* Список ключей */}
              {apiKeys.map((entry, idx) => {
                const status = getKeyStatus(entry, model);
                const isActive = idx === activeKeyIndex;
                return (
                  <div
                    key={idx}
                    className={`relative group flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
                      isActive
                        ? 'bg-surface-3 border-accent/20'
                        : 'bg-surface-2 border-border hover:border-border-strong'
                    }`}
                  >
                    {/* Статус индикатор */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 shadow-glow-sm ${
                      status === 'active' ? 'bg-gem-green' :
                      status === 'cooling' ? 'bg-gem-yellow animate-pulse' :
                      'bg-gem-red'
                    }`} />

                    {/* Ключ */}
                    <div className="flex-1 min-w-0">
                      {entry.label && (
                        <p className="text-[10px] text-[var(--text-muted)] mb-0.5">{entry.label}</p>
                      )}
                      <p className="text-xs font-mono text-[var(--text-dim)] truncate">
                        {showKeys[idx]
                          ? entry.key
                          : entry.key.slice(0, 8) + '••••••••' + entry.key.slice(-4)
                        }
                      </p>
                      {status !== 'active' && (
                        <p className="text-[10px] text-[var(--gem-red)] mt-0.5 flex items-center gap-1">
                          <Clock size={8} />
                          Разблокируется через {timeUntilUnblock(entry, model)}
                        </p>
                      )}
                    </div>

                    {/* Действия */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {status !== 'active' && (
                        <button
                          onClick={() => {
                            const updated = unblockKey(apiKeys, idx, model);
                            onApiKeysChange(updated);
                            saveApiKeys(updated);
                          }}
                          className="p-1 text-[var(--text-dim)] hover:text-[var(--text-muted)] rounded"
                          title="Разблокировать ключ для текущей модели"
                        >
                          <Unlock size={11} />
                        </button>
                      )}
                      <button
                        onClick={() => setShowKeys(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        className="p-1 text-[var(--text-dim)] hover:text-[var(--text-primary)] rounded"
                      >
                        {showKeys[idx] ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                      <button
                        onClick={() => deleteKey(entry.key)}
                        className="p-1 text-[var(--text-dim)] hover:text-[var(--gem-red)] rounded"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Добавить ключ */}
              {showNewKey ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newKeyInput}
                    onChange={e => setNewKeyInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addKey(); if (e.key === 'Escape') setShowNewKey(false); }}
                    placeholder="AIza..."
                    autoFocus
                    className="w-full bg-[var(--surface-3)] border border-[var(--border-strong)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-white/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addKey}
                      disabled={!newKeyInput.trim()}
                      className="flex-1 py-1.5 bg-white text-black text-xs font-medium rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity"
                    >
                      Добавить
                    </button>
                    <button
                      onClick={() => { setShowNewKey(false); setNewKeyInput(''); }}
                      className="px-3 py-1.5 bg-[var(--surface-3)] text-[var(--text-muted)] text-xs rounded-lg border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewKey(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-[var(--border-strong)] rounded-lg text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:border-[#444] transition-all"
                >
                  <Plus size={12} />
                  Добавить API ключ
                </button>
              )}

              {apiKeys.length === 0 && (
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                  Ключи из{' '}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                    className="text-[var(--gem-blue)] hover:underline">
                    aistudio.google.com
                  </a>
                </p>
              )}

              {/* Статус: N ключей, M заблокировано */}
              {apiKeys.length > 0 && (
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
                  <span>{apiKeys.length} ключ{apiKeys.length > 1 ? 'а' : ''}</span>
                  {apiKeys.some(k => k.blockedUntil && k.blockedUntil > Date.now()) && (
                    <>
                      <span>·</span>
                      <span className="text-[var(--gem-red)]">
                        {apiKeys.filter(k => k.blockedUntil && k.blockedUntil > Date.now()).length} заблокировано
                      </span>
                    </>
                  )}
                </div>
              )}

              {modelError && (
                <p className="text-xs text-[var(--gem-red)] flex items-center gap-1">
                  <AlertCircle size={10} />
                  {modelError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ===== MODEL ===== */}
        <div className="border-b border-[var(--border)]">
          <SectionHeader id="model" label="Модель" icon={Cpu} />
          {openSections.has('model') && (
            <div className="px-4 pb-3 space-y-3 animate-slide-down">
              {/* Model dropdown */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-[var(--text-dim)]">Выбранная модель</span>
                  {apiKeys.length > 0 && (
                    <button
                      onClick={() => {
                        const active = apiKeys.find(k => !k.blockedUntil || k.blockedUntil <= Date.now());
                        if (active) loadModels(active.key);
                      }}
                      disabled={loadingModels}
                      className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors p-0.5"
                      title="Обновить модели"
                    >
                      <RefreshCw size={10} className={loadingModels ? 'animate-spin' : ''} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                  disabled={models.length === 0}
                  className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between hover:border-[var(--border-strong)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className={`${model ? 'text-[var(--text-primary)]' : 'text-[var(--text-dim)]'} text-[13px] truncate`}>
                    {loadingModels ? 'Загрузка...' : modelDisplayName.replace('Gemini ', '').replace(' (Preview)', '').trim() || 'Выбрать модель'}
                  </span>
                  <ChevronDown size={12} className={`text-[var(--text-dim)] transition-transform flex-shrink-0 ml-2 ${modelDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {modelDropdownOpen && models.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-3)] border border-[var(--border-strong)] rounded-lg shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto animate-slide-down">
                    {models.map(m => {
                      const id = m.name.split('/')[1];
                      const isSelected = m.name === model;
                      const isNew = m.name.includes('3') || m.name.includes('2.5');
                      return (
                        <button
                          key={m.name}
                          onClick={() => { onModelChange(m.name); setModelDropdownOpen(false); }}
                          className={`w-full text-left px-3 py-2.5 text-sm flex flex-col gap-0.5 transition-colors ${
                            isSelected
                              ? 'bg-white/10 text-white'
                              : 'text-[var(--text-primary)] hover:bg-[var(--surface-4)]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[13px] truncate">{m.displayName || id}</span>
                            {isNew && (
                              <span className="text-[9px] bg-white text-black px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ml-2 flex-shrink-0">New</span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--text-dim)] font-mono truncate">{id}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedModel && (
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-dim)]">
                  {selectedModel.inputTokenLimit && <span>In: {formatTokenCount(selectedModel.inputTokenLimit)}</span>}
                  {selectedModel.outputTokenLimit && <span>Out: {formatTokenCount(selectedModel.outputTokenLimit)}</span>}
                </div>
              )}

              {/* Temperature */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Thermometer size={11} className="text-[var(--text-dim)]" />
                    <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">Температура</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono" style={{ color: tempColor }}>{tempLabel}</span>
                    <span className="text-xs font-mono text-[var(--text-primary)] bg-[var(--surface-3)] border border-[var(--border)] rounded px-1.5 py-0.5">{temperature.toFixed(1)}</span>
                  </div>
                </div>
                <input type="range" min="0" max="2" step="0.05" value={temperature} onChange={e => onTemperatureChange(parseFloat(e.target.value))} className="w-full" />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-[var(--text-dim)]">0 — Точно</span>
                  <span className="text-[9px] text-[var(--text-dim)]">2 — Хаос</span>
                </div>
              </div>

              {/* Thinking budget */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Brain size={11} className="text-[var(--text-dim)]" />
                    <span className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">Размышления</span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-primary)] bg-[var(--surface-3)] border border-[var(--border)] rounded px-1.5 py-0.5">{thinkingLabel}</span>
                </div>
                {/* -1=Авто, 0=Выкл, слайдер 128..32768 */}
                <div className="flex gap-1.5 mb-2">
                  {[
                    { label: 'Выкл', v: 0 },
                    { label: 'Авто', v: -1 },
                    { label: 'Мало', v: 512 },
                    { label: 'Много', v: 8192 },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => onThinkingBudgetChange(opt.v)}
                      className={`flex-1 py-1 text-[10px] rounded-md border transition-all ${
                        thinkingBudget === opt.v
                          ? 'bg-white text-black border-white font-medium'
                          : 'bg-[var(--surface-3)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text-muted)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {thinkingBudget > 0 && (
                  <input
                    type="range"
                    min="128"
                    max="32768"
                    step="128"
                    value={thinkingBudget}
                    onChange={e => onThinkingBudgetChange(parseInt(e.target.value))}
                    className="w-full"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===== SYSTEM PROMPT ===== */}
        <div className="border-b border-[var(--border)]">
          <SectionHeader id="system" label="Система" icon={BookOpen} />
          {openSections.has('system') && (
            <div className="px-4 pb-3 space-y-2 animate-slide-down">
              {/* Выбор сохранённого промпта */}
              <div className="relative">
                <button
                  onClick={() => setPromptDropdownOpen(!promptDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:border-[var(--border-strong)] transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <Star size={10} />
                    {savedPrompts.length > 0 ? `Сохранённые (${savedPrompts.length})` : 'Нет сохранённых'}
                  </span>
                  <ChevronDown size={10} className={`transition-transform ${promptDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {promptDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--surface-3)] border border-[var(--border-strong)] rounded-lg z-50 overflow-hidden shadow-2xl animate-slide-down">
                    {savedPrompts.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-[var(--text-dim)]">Нет сохранённых промптов</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto">
                        {savedPrompts.map(p => (
                          <div key={p.id} className="flex items-center group">
                            <button
                              onClick={() => {
                                onSystemPromptChange(p.content);
                                setPromptDropdownOpen(false);
                              }}
                              className="flex-1 text-left px-3 py-2.5 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-4)] transition-colors truncate"
                            >
                              {p.name}
                            </button>
                            <div className="flex items-center gap-0.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  const cloned = cloneSystemPrompt(p);
                                  savePrompts([...savedPrompts, cloned]);
                                }}
                                className="p-1 text-[var(--text-dim)] hover:text-[var(--text-muted)] rounded"
                                title="Клонировать"
                              >
                                <Copy size={10} />
                              </button>
                              <button
                                onClick={() => {
                                  savePrompts(savedPrompts.filter(x => x.id !== p.id));
                                }}
                                className="p-1 text-[var(--text-dim)] hover:text-[var(--gem-red)] rounded"
                                title="Удалить"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Текстовое поле */}
              <textarea
                value={systemPrompt}
                onChange={e => onSystemPromptChange(e.target.value)}
                placeholder="Вы — полезный ассистент…"
                rows={4}
                className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-white/15 transition-colors leading-relaxed"
                style={{ minHeight: '100px', maxHeight: '250px', resize: 'vertical' }}
              />

              {/* Сохранить промпт */}
              {systemPrompt.trim() && (
                <button
                  onClick={() => setShowSavePromptDialog(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] border border-dashed border-[var(--border-strong)] rounded-lg hover:border-[#444] transition-all"
                >
                  <Save size={11} />
                  Сохранить промпт
                </button>
              )}

              {/* Диалог сохранения промпта */}
              {showSavePromptDialog && (
                <div className="bg-[var(--surface-3)] border border-[var(--border-strong)] rounded-lg p-3 space-y-2 animate-slide-down">
                  <input
                    type="text"
                    value={newPromptName}
                    onChange={e => setNewPromptName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newPromptName.trim()) {
                        savePrompts([...savedPrompts, createSystemPrompt(newPromptName, systemPrompt)]);
                        setNewPromptName('');
                        setShowSavePromptDialog(false);
                      }
                      if (e.key === 'Escape') setShowSavePromptDialog(false);
                    }}
                    placeholder="Название промпта..."
                    autoFocus
                    className="w-full bg-[var(--surface-4)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-white/15"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!newPromptName.trim()) return;
                        savePrompts([...savedPrompts, createSystemPrompt(newPromptName, systemPrompt)]);
                        setNewPromptName('');
                        setShowSavePromptDialog(false);
                      }}
                      disabled={!newPromptName.trim()}
                      className="flex-1 py-1.5 bg-white text-black text-xs font-medium rounded-lg disabled:opacity-40 hover:opacity-80 transition-opacity"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => { setShowSavePromptDialog(false); setNewPromptName(''); }}
                      className="px-3 py-1.5 bg-[var(--surface-4)] text-[var(--text-muted)] text-xs rounded-lg border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 border-b border-[var(--border)]">
          <div className="flex items-center justify-between border-b border-[var(--border)]">
            <SectionHeader id="chats" label="Чаты" icon={MessageSquare} />
          </div>

          <input ref={importRef} type="file" accept=".json" className="hidden"
            onChange={e => { if (e.target.files?.[0]) { handleImportChats(e.target.files[0]); e.target.value = ''; } }} />
          <input ref={importGsRef} type="file" accept=".json,*" className="hidden"
            onChange={e => { if (e.target.files?.[0]) { handleImportGoogleStudio(e.target.files[0]); e.target.value = ''; } }} />

          {importError && (
            <p className="mx-4 mt-2 text-[11px] text-[var(--gem-red)] flex items-center gap-1">
              <AlertCircle size={10} />
              {importError}
            </p>
          )}

          {openSections.has('chats') && (
            <div className="animate-slide-down">
              {savedChats.length === 0 ? (
                <p className="px-4 py-4 text-xs text-[var(--text-dim)]">Нет сохранённых чатов</p>
              ) : (
                <div className="overflow-y-auto max-h-64">
                  {savedChats.map(chat => (
                    <div
                      key={chat.id}
                      className={`group flex items-center gap-2 px-4 py-2.5 cursor-pointer transition-colors ${
                        chat.id === currentChatId
                          ? 'bg-[var(--surface-3)]'
                          : 'hover:bg-[var(--surface-2)]'
                      }`}
                      onClick={() => { onLoadChat(chat); onClose?.(); }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[var(--text-primary)] truncate">{chat.title}</p>
                        <p className="text-[10px] text-[var(--text-dim)]">
                          {chat.messages.length} сообщ. · {formatDate(chat.updatedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); exportSingleChat(chat); }}
                          className="p-1 text-[var(--text-dim)] hover:text-[var(--text-muted)] rounded"
                          title="Экспортировать"
                        >
                          <Download size={10} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onDeleteChat(chat.id); }}
                          className="p-1 text-[var(--text-dim)] hover:text-[var(--gem-red)] rounded"
                          title="Удалить"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ===== УПРАВЛЕНИЕ / РЕЗЕРВНЫЕ КОПИИ ===== */}
      <div className="mt-auto px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-1)]">
        <p className="text-[10px] font-mono font-medium text-[var(--text-dim)] uppercase tracking-widest mb-2">
          Управление данными
        </p>

        {/* Импорт/Экспорт Всего (Бэкап) */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={exportAllSettings}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-4)] border border-[var(--border)] rounded-lg transition-colors"
            title="Сделать полный бэкап настроек и чатов"
          >
            <Download size={12} />
            Бэкап
          </button>
          
          <button
            onClick={() => importBackupRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-4)] border border-[var(--border)] rounded-lg transition-colors"
            title="Восстановить настройки и чаты из бэкапа"
          >
            <Upload size={12} />
            Восстановить
          </button>
        </div>

        {/* Импорт/Экспорт Частно */}
        <div className="flex gap-2">
          {savedChats.length > 0 && (
            <button
              onClick={() => exportChats(savedChats)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-4)] border border-[var(--border)] rounded-lg transition-colors"
              title="Экспорт только чатов"
            >
              <Download size={10} />
              Чаты
            </button>
          )}

          <button
            onClick={() => importRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-4)] border border-[var(--border)] rounded-lg transition-colors"
            title="Импорт чатов из JSON"
          >
            <Upload size={10} />
            Чаты
          </button>

          <button
            onClick={() => importGsRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-[var(--surface-3)] text-[var(--gem-blue)] hover:bg-[var(--surface-4)] border border-[var(--border)] rounded-lg transition-colors"
            title="Импорт чатов из Google AI Studio"
          >
            <FolderOpen size={10} />
            AI Studio
          </button>
        </div>

        {/* Скрытые инпуты для загрузки файлов */}
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={e => { if (e.target.files?.[0]) { handleImportChats(e.target.files[0]); e.target.value = ''; } }} />
        <input ref={importGsRef} type="file" accept=".json,*" className="hidden" onChange={e => { if (e.target.files?.[0]) { handleImportGoogleStudio(e.target.files[0]); e.target.value = ''; } }} />
        <input ref={importBackupRef} type="file" accept=".json" className="hidden" onChange={e => {
            if (e.target.files?.[0]) {
              if (confirm('Внимание! Импорт перезапишет ВСЕ текущие настройки, API-ключи, системные промпты и чаты. Продолжить?')) {
                importAllSettings(e.target.files[0]).catch(err => alert(err.message));
              }
              e.target.value = '';
            }
          }} 
        />
      </div>

      {/* Token Counter Footer */}
      <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-0)] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[var(--text-dim)]">
            <Hash size={10} />
            <span className="text-[10px]">Токены контекста</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isStreaming && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gem-green)] animate-pulse" />
            )}
            <span className={`text-sm font-mono font-medium ${tokenCount > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-dim)]'}`}>
              {formatTokenCount(tokenCount)}
            </span>
          </div>
        </div>
        {selectedModel?.inputTokenLimit && tokenCount > 0 && (
          <div className="mt-1.5">
            <div className="h-0.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min((tokenCount / selectedModel.inputTokenLimit) * 100, 100)}%`,
                  background: tokenCount / selectedModel.inputTokenLimit > 0.8 ? '#ef4444' : tokenCount / selectedModel.inputTokenLimit > 0.5 ? '#f59e0b' : '#ffffff',
                }}
              />
            </div>
            <p className="text-[10px] text-[var(--text-dim)] mt-0.5">
              {((tokenCount / selectedModel.inputTokenLimit) * 100).toFixed(1)}% из {formatTokenCount(selectedModel.inputTokenLimit)}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
