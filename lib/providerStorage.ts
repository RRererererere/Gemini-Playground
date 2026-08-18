import type { Provider, ProviderModelsCache, UniversalModel, ActiveModel, ApiKeyEntry } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Storage Keys
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDERS_KEY = 'providers_registry';
const MODELS_CACHE_PREFIX = 'models_cache_';
const ACTIVE_PROVIDER_KEY = 'active_provider_id';
const ACTIVE_MODEL_KEY = 'active_model';

// ─────────────────────────────────────────────────────────────────────────────
// API Key Sanitization
// ─────────────────────────────────────────────────────────────────────────────

export function sanitizeApiKeys(keys: ApiKeyEntry[]): ApiKeyEntry[] {
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

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

export const GOOGLE_PROVIDER: Provider = {
  id: 'google',
  name: 'Google AI',
  type: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com',
  isBuiltin: true,
  createdAt: 0,
};

export function loadProviders(): Provider[] {
  if (typeof window === 'undefined') return [GOOGLE_PROVIDER];
  try {
    const raw = localStorage.getItem(PROVIDERS_KEY);
    const custom: Provider[] = raw ? JSON.parse(raw) : [];
    return [GOOGLE_PROVIDER, ...custom]; // Google всегда первый
  } catch {
    return [GOOGLE_PROVIDER];
  }
}

export function saveCustomProvider(provider: Provider): void {
  if (typeof window === 'undefined') return;
  const providers = loadProviders().filter(p => !p.isBuiltin);
  const existing = providers.findIndex(p => p.id === provider.id);
  if (existing >= 0) {
    providers[existing] = provider;
  } else {
    providers.push(provider);
  }
  localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
}

export function removeProvider(id: string): void {
  if (typeof window === 'undefined') return;
  if (id === 'google') return; // нельзя удалить встроенный
  const providers = loadProviders().filter(p => !p.isBuiltin && p.id !== id);
  localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers));
  
  // Очистить кэш моделей
  clearModelsCache(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Models Cache
// ─────────────────────────────────────────────────────────────────────────────

export function loadModelsCache(providerId: string): ProviderModelsCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${MODELS_CACHE_PREFIX}${providerId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ProviderModelsCache;
  } catch {
    return null;
  }
}

export function saveModelsCache(cache: ProviderModelsCache): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${MODELS_CACHE_PREFIX}${cache.providerId}`, JSON.stringify(cache));
}

export function clearModelsCache(providerId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${MODELS_CACHE_PREFIX}${providerId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Active Provider & Model
// ─────────────────────────────────────────────────────────────────────────────

export function getActiveProviderId(): string {
  if (typeof window === 'undefined') return 'google';
  return localStorage.getItem(ACTIVE_PROVIDER_KEY) || 'google';
}

export function setActiveProviderId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_PROVIDER_KEY, id);
}

export function getActiveModel(): ActiveModel | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_MODEL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveModel;
  } catch {
    return null;
  }
}

export function setActiveModel(model: ActiveModel): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACTIVE_MODEL_KEY, JSON.stringify(model));
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Миграция старого gemini_model → active_model
export function migrateOldModelSelection(): void {
  if (typeof window === 'undefined') return;
  
  const oldModel = localStorage.getItem('gemini_model');
  const newModel = getActiveModel();
  
  if (oldModel && !newModel) {
    setActiveModel({
      providerId: 'google',
      modelId: oldModel,
    });
  }
}
