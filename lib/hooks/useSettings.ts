import { useState, useEffect, useCallback } from 'react';
import type { Provider, ApiKeyEntry, UniversalModel, ActiveModel, ChatTool, SavedSystemPrompt } from '@/types';
import {
  loadApiKeys, saveApiKeys,
} from '@/lib/apiKeyManager';
import {
  loadProviders, saveCustomProvider, removeProvider,
  loadModelsCache, saveModelsCache,
  getActiveProviderId, setActiveProviderId,
  getActiveModel, setActiveModel,
  GOOGLE_PROVIDER,
  sanitizeApiKeys,
} from '@/lib/providerStorage';
import {
  loadDeepThinkSystemPrompt,
  saveDeepThinkSystemPrompt,
  loadSystemPrompts,
  saveSystemPrompts,
  createSystemPrompt,
  loadGhostNudgeEnabled, saveGhostNudgeEnabled,
  loadGhostNudgeMaxRetries, saveGhostNudgeMaxRetries,
  loadMaxUploadSizeMB, saveMaxUploadSizeMB, DEFAULT_MAX_UPLOAD_SIZE_MB,
} from '@/lib/storage';
import { DEFAULT_DEEPTHINK_SYSTEM_PROMPT } from '@/lib/gemini';

/**
 * Хук для управления настройками: провайдеры, API ключи, модели,
 * системные промпты, temperature, tools и т.д.
 */
export function useSettings() {
  // Multi-provider support
  const [providers, setProviders] = useState<Provider[]>([GOOGLE_PROVIDER]);
  const [activeProviderId, setActiveProviderIdState] = useState('google');

  // API Keys (per provider)
  const [apiKeys, setApiKeys] = useState<Record<string, ApiKeyEntry[]>>({});
  const [activeKeyIndex, setActiveKeyIndex] = useState<Record<string, number>>({});

  // Models (unified)
  const [activeModel, setActiveModelState] = useState<ActiveModel | null>(null);
  const [allModels, setAllModels] = useState<UniversalModel[]>([]);

  // Settings
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [tools, setTools] = useState<ChatTool[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<SavedSystemPrompt[]>([]);
  const [deepThinkSystemPrompt, setDeepThinkSystemPrompt] = useState<string>(DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
  const [temperature, setTemperature] = useState<number>(1.0);
  const [thinkingBudget, setThinkingBudget] = useState<number>(-1);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(8192);
  const [memoryEnabled, setMemoryEnabled] = useState<boolean>(true);
  const [maxToolRounds, setMaxToolRounds] = useState<number>(20);
  const [maxMemoryCalls, setMaxMemoryCalls] = useState<number>(100);
  const [ghostNudgeEnabled, setGhostNudgeEnabled] = useState<boolean>(true);
  const [ghostNudgeMaxRetries, setGhostNudgeMaxRetries] = useState<number>(3);
  const [maxUploadSizeMB, setMaxUploadSizeMBState] = useState<number>(DEFAULT_MAX_UPLOAD_SIZE_MB);

  // Load from localStorage
  useEffect(() => {
    const loadData = async () => {
      // Load providers
      const loadedProviders = loadProviders();
      setProviders(loadedProviders);

      // Load active provider
      const savedActiveProviderId = getActiveProviderId();
      setActiveProviderIdState(savedActiveProviderId);

      // Load API keys per provider
      const keysMap: Record<string, ApiKeyEntry[]> = {};
      const keyIndexMap: Record<string, number> = {};

      for (const provider of loadedProviders) {
        const providerKeys = sanitizeApiKeys(loadApiKeys(provider.id));
        keysMap[provider.id] = providerKeys;
        saveApiKeys(provider.id, providerKeys);

        const savedIndex = parseInt(localStorage.getItem(`${provider.id}_active_key_index`) || '0', 10);
        if (providerKeys.length > 0 && Number.isFinite(savedIndex)) {
          keyIndexMap[provider.id] = Math.min(Math.max(savedIndex, 0), providerKeys.length - 1);
        } else {
          keyIndexMap[provider.id] = 0;
        }
      }

      setApiKeys(keysMap);
      setActiveKeyIndex(keyIndexMap);

      // Load models cache
      const modelsMap: UniversalModel[] = [];
      for (const provider of loadedProviders) {
        const cache = loadModelsCache(provider.id);
        if (cache && cache.models) {
          modelsMap.push(...cache.models);
        }
      }
      setAllModels(modelsMap);

      // Load active model
      const savedActiveModel = getActiveModel();
      if (savedActiveModel) {
        setActiveModelState(savedActiveModel);
      }

      const savedSysPrompt = localStorage.getItem('gemini_sys_prompt');
      const savedTemp = localStorage.getItem('gemini_temperature');
      const savedThinking = localStorage.getItem('gemini_thinking_budget');
      const savedMemoryEnabled = localStorage.getItem('gemini_memory_enabled');
      const savedMaxToolRounds = localStorage.getItem('gemini_max_tool_rounds');
      const savedMaxMemoryCalls = localStorage.getItem('gemini_max_memory_calls');
      const savedDeepThinkPrompt = loadDeepThinkSystemPrompt();
      const savedGhostNudgeEnabled = loadGhostNudgeEnabled();
      const savedGhostNudgeMaxRetries = loadGhostNudgeMaxRetries();
      const savedMaxUploadSizeMB = loadMaxUploadSizeMB();

      if (savedSysPrompt) setSystemPrompt(savedSysPrompt);
      if (savedTemp) setTemperature(parseFloat(savedTemp));
      setDeepThinkSystemPrompt(savedDeepThinkPrompt || DEFAULT_DEEPTHINK_SYSTEM_PROMPT);
      if (savedThinking !== null) setThinkingBudget(parseInt(savedThinking));
      if (savedMemoryEnabled !== null) setMemoryEnabled(savedMemoryEnabled === 'true');
      if (savedMaxToolRounds !== null) setMaxToolRounds(parseInt(savedMaxToolRounds));
      if (savedMaxMemoryCalls !== null) setMaxMemoryCalls(parseInt(savedMaxMemoryCalls));
      setGhostNudgeEnabled(savedGhostNudgeEnabled);
      setGhostNudgeMaxRetries(savedGhostNudgeMaxRetries);
      setMaxUploadSizeMBState(savedMaxUploadSizeMB);
    };
    loadData();
  }, []);

  // Load saved prompts
  useEffect(() => {
    setSavedPrompts(loadSystemPrompts());
  }, []);

  // Persist simple settings
  useEffect(() => {
    if (activeModel) {
      setActiveModel(activeModel);
      localStorage.setItem('gemini_model', activeModel.modelId);
    }
  }, [activeModel]);

  useEffect(() => {
    setActiveProviderId(activeProviderId);
  }, [activeProviderId]);

  useEffect(() => { localStorage.setItem('gemini_sys_prompt', systemPrompt); }, [systemPrompt]);
  useEffect(() => { localStorage.setItem('gemini_temperature', temperature.toString()); }, [temperature]);
  useEffect(() => {
    Object.entries(activeKeyIndex).forEach(([providerId, idx]) => {
      localStorage.setItem(`${providerId}_active_key_index`, idx.toString());
    });
  }, [activeKeyIndex]);
  useEffect(() => { localStorage.setItem('gemini_thinking_budget', thinkingBudget.toString()); }, [thinkingBudget]);
  useEffect(() => { localStorage.setItem('gemini_memory_enabled', memoryEnabled.toString()); }, [memoryEnabled]);
  useEffect(() => { localStorage.setItem('gemini_max_tool_rounds', maxToolRounds.toString()); }, [maxToolRounds]);
  useEffect(() => { localStorage.setItem('gemini_max_memory_calls', maxMemoryCalls.toString()); }, [maxMemoryCalls]);
  useEffect(() => { saveGhostNudgeEnabled(ghostNudgeEnabled); }, [ghostNudgeEnabled]);
  useEffect(() => { saveGhostNudgeMaxRetries(ghostNudgeMaxRetries); }, [ghostNudgeMaxRetries]);
  useEffect(() => { saveMaxUploadSizeMB(maxUploadSizeMB); }, [maxUploadSizeMB]);

  // Helper: get current API key
  const effectiveProviderId = activeModel?.providerId || activeProviderId;
  const currentProviderKeys = apiKeys[effectiveProviderId] || [];
  const currentKeyIndex = activeKeyIndex[effectiveProviderId] || 0;
  const selectedApiKeyEntry = currentProviderKeys[currentKeyIndex] || null;
  const selectedApiKey = selectedApiKeyEntry?.key || '';
  const selectedApiKeySuffix = selectedApiKeyEntry?.key ? selectedApiKeyEntry.key.slice(-4) : '';
  const activeProvider = providers.find(p => p.id === (activeModel?.providerId || activeProviderId));

  // Model alias
  const model = activeModel?.modelId || '';
  const models = allModels.filter(m => m.providerId === activeProviderId);

  // Handlers
  const handleModelsLoad = useCallback((providerId: string, models: UniversalModel[]) => {
    setAllModels(prev => {
      const filtered = prev.filter(m => m.providerId !== providerId);
      return [...filtered, ...models];
    });
    saveModelsCache({ providerId, models, fetchedAt: Date.now() });
  }, []);

  const handleRefreshModels = useCallback(async (providerId: string) => {
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
            id: m.name,
            displayName: m.displayName,
            providerId,
            inputTokenLimit: m.inputTokenLimit,
            outputTokenLimit: m.outputTokenLimit,
            supportedGenerationMethods: m.supportedGenerationMethods,
          }));
          handleModelsLoad(providerId, geminiModels);
        }
      } else {
        const res = await fetch(`/api/openai-models?apiKey=${encodeURIComponent(key)}&baseUrl=${encodeURIComponent(provider.baseUrl)}`);
        const data = await res.json();
        if (res.ok && data.models) {
          const openaiModels: UniversalModel[] = data.models.map((m: any) => ({
            id: m.id,
            displayName: m.displayName,
            providerId,
            inputTokenLimit: m.inputTokenLimit,
          }));
          handleModelsLoad(providerId, openaiModels);
        }
      }
    } catch (error) {
      console.error('Failed to refresh models:', error);
    }
  }, [providers, apiKeys, activeKeyIndex, handleModelsLoad]);

  const handleSavePrompt = useCallback((name: string) => {
    if (!name.trim()) return;
    const updated = [...savedPrompts, createSystemPrompt(name, systemPrompt)];
    setSavedPrompts(updated);
    saveSystemPrompts(updated);
  }, [savedPrompts, systemPrompt]);

  return {
    // Providers
    providers,
    setProviders,
    activeProviderId,
    setActiveProviderId: setActiveProviderIdState,

    // API Keys
    apiKeys,
    setApiKeys,
    activeKeyIndex,
    setActiveKeyIndex,

    // Models
    activeModel,
    setActiveModel: setActiveModelState,
    allModels,
    setAllModels,
    model,
    models,

    // Current key info
    selectedApiKeyEntry,
    selectedApiKey,
    selectedApiKeySuffix,
    activeProvider,
    effectiveProviderId,

    // Settings
    systemPrompt,
    setSystemPrompt,
    tools,
    setTools,
    savedPrompts,
    setSavedPrompts,
    handleSavePrompt,
    deepThinkSystemPrompt,
    setDeepThinkSystemPrompt,
    temperature,
    setTemperature,
    thinkingBudget,
    setThinkingBudget,
    maxOutputTokens,
    setMaxOutputTokens,
    memoryEnabled,
    setMemoryEnabled,
    maxToolRounds,
    setMaxToolRounds,
    maxMemoryCalls,
    setMaxMemoryCalls,
    ghostNudgeEnabled,
    setGhostNudgeEnabled,
    ghostNudgeMaxRetries,
    setGhostNudgeMaxRetries,
    maxUploadSizeMB,
    setMaxUploadSizeMB: setMaxUploadSizeMBState,

    // Model handlers
    onModelsLoad: handleModelsLoad,
    onRefreshModels: handleRefreshModels,
  };
}
