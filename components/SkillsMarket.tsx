'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download, Settings, Trash2, Check, Search, Package, Sparkles } from 'lucide-react';
import type { Skill, InstalledSkillRecord, SkillConfigField } from '@/lib/skills';
import {
  getSkillCatalog,
  getInstalledSkills,
  isSkillActive,
  installSkill,
  uninstallSkill,
  setSkillEnabled,
  saveSkillConfig,
  getSkillConfig,
  callSkillInstallHook,
  callSkillUninstallHook,
} from '@/lib/skills';
import type { SkillUIEvent } from '@/lib/skills';
import type { Message } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────

interface SkillsMarketProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
  messages: Message[];
  onUIEvent: (event: SkillUIEvent) => void;
  /** Вызывается когда набор активных скиллов изменился */
  onSkillsChanged: () => void;
}

type Tab = 'installed' | 'browse';

const CATEGORY_LABELS: Record<string, string> = {
  search: 'Поиск',
  data: 'Данные',
  utils: 'Утилиты',
  dev: 'Разработка',
  productivity: 'Продуктивность',
  fun: 'Развлечения',
};

const CATEGORY_ICONS: Record<string, string> = {
  search: '🔍',
  data: '📊',
  utils: '🔧',
  dev: '💻',
  productivity: '⚡',
  fun: '🎉',
};

// ─────────────────────────────────────────────────────────────────────────────

function ConfigModal({
  skill,
  onSave,
  onClose,
}: {
  skill: Skill;
  onSave: (config: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'config' | 'prompt'>('config');
  const [values, setValues] = useState<Record<string, string>>(() => getSkillConfig(skill.id));
  
  // Prompt state
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [defaultPrompt, setDefaultPrompt] = useState<string>('');

  const fields = skill.configSchema ?? [];

  // Load prompt on mount
  useEffect(() => {
    const { getSkillPrompt } = require('@/lib/storage');
    const custom = getSkillPrompt(skill.id);
    
    // Get default prompt from skill
    const ctx = {
      chatId: '',
      messages: [],
      storage: {
        get: () => null,
        set: () => {},
        getJSON: () => null,
        setJSON: () => {},
        remove: () => {},
      },
      emit: () => {},
    };
    const defaultP = skill.onSystemPrompt?.(ctx as any) || '';
    
    setDefaultPrompt(defaultP);
    if (custom) {
      setCustomPrompt(custom);
      setHasCustomPrompt(true);
    } else {
      setCustomPrompt(defaultP);
      setHasCustomPrompt(false);
    }
  }, [skill]);

  const handleSavePrompt = () => {
    const { saveSkillPrompt } = require('@/lib/storage');
    saveSkillPrompt(skill.id, customPrompt);
    setHasCustomPrompt(true);
  };

  const handleResetPrompt = () => {
    const { resetSkillPrompt } = require('@/lib/storage');
    resetSkillPrompt(skill.id);
    setCustomPrompt(defaultPrompt);
    setHasCustomPrompt(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {skill.icon} {skill.name}
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Настройки скилла</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4 border-b border-[var(--border)] pb-3">
          <button
            onClick={() => setTab('config')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'config'
                ? 'bg-white text-black'
                : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
            }`}
          >
            ⚙️ Настройки
          </button>
          <button
            onClick={() => setTab('prompt')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'prompt'
                ? 'bg-white text-black'
                : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
            }`}
          >
            📝 Промпт
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'config' ? (
            fields.length === 0 ? (
              <p className="text-sm italic text-[var(--text-dim)]">У этого скилла нет настроек.</p>
            ) : (
              <div className="space-y-4">
                {fields.map(field => (
                  <div key={field.key}>
                    <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                      {field.label}
                      {field.required && <span className="ml-1 text-red-400">*</span>}
                    </label>
                    {field.description && (
                      <p className="mb-2 text-xs text-[var(--text-muted)]">{field.description}</p>
                    )}
                    {field.type === 'select' ? (
                      <select
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[var(--border-strong)] focus:outline-none"
                        value={values[field.key] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      >
                        <option value="">— выбери —</option>
                        {field.options?.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'password' ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none"
                        value={values[field.key] ?? ''}
                        onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col h-full">
              <div className="mb-3">
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  {hasCustomPrompt 
                    ? '✅ Используется кастомный промпт'
                    : '📄 Используется дефолтный промпт'}
                </p>
              </div>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="flex-1 w-full min-h-[300px] rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-primary)] font-mono focus:border-[var(--border-strong)] focus:outline-none resize-none"
                placeholder="Системный промпт для скилла..."
              />
              <div className="mt-3 text-xs text-[var(--text-dim)]">
                {customPrompt.length} символов
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--border)] px-6 py-4 flex gap-2">
          {tab === 'config' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                Отмена
              </button>
              <button
                onClick={() => onSave(values)}
                className="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Сохранить
              </button>
            </>
          ) : (
            <>
              {hasCustomPrompt && (
                <button
                  onClick={handleResetPrompt}
                  className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20"
                >
                  Восстановить дефолтный
                </button>
              )}
              <button
                onClick={handleSavePrompt}
                className="flex-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Сохранить промпт
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function SkillCard({
  skill,
  installed,
  active,
  onInstall,
  onUninstall,
  onToggle,
  onConfigure,
}: {
  skill: Skill;
  installed: boolean;
  active: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onToggle: () => void;
  onConfigure: () => void;
}) {
  return (
    <div className={`group rounded-2xl border p-4 transition-all ${
      active
        ? 'border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] shadow-[0_18px_40px_rgba(0,0,0,0.26)]'
        : 'border-[var(--border)] bg-[var(--surface-1)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--surface-3)] text-xl">
          {skill.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-medium text-[var(--text-primary)]">{skill.name}</span>
            <span className="text-[10px] text-[var(--text-dim)]">v{skill.version}</span>
            {active && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <Check size={10} />
                Активен
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">{skill.description}</p>

          {skill.tags && skill.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {skill.tags.slice(0, 4).map(tag => (
                <span key={tag} className="rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {!installed ? (
          <button
            onClick={onInstall}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Download size={12} />
            Установить
          </button>
        ) : (
          <>
            <button
              onClick={onToggle}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                active
                  ? 'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              {active ? 'Отключить' : 'Включить'}
            </button>
            <button
              onClick={onConfigure}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
              title="Настройки"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={onUninstall}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] transition-colors hover:bg-red-500/10 hover:text-red-400"
              title="Удалить"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function SkillsMarket({
  open,
  onClose,
  chatId,
  messages,
  onUIEvent,
  onSkillsChanged,
}: SkillsMarketProps) {
  const [tab, setTab] = useState<Tab>('browse');
  const [search, setSearch] = useState('');
  const [installed, setInstalled] = useState<InstalledSkillRecord[]>([]);
  const [configuringSkill, setConfiguringSkill] = useState<Skill | null>(null);

  const catalog = getSkillCatalog();

  const refresh = useCallback(() => {
    setInstalled(getInstalledSkills());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  const installedIds = new Set(installed.map(r => r.id));

  const filteredCatalog = catalog.filter(skill => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      skill.name.toLowerCase().includes(q) ||
      skill.description.toLowerCase().includes(q) ||
      skill.tags?.some(t => t.includes(q))
    );
  });

  const installedSkills = catalog.filter(s => installedIds.has(s.id));
  const activeCount = installed.filter(r => r.enabled).length;

  const handleInstall = (skill: Skill) => {
    installSkill(skill.id);
    callSkillInstallHook(skill.id, chatId, messages, onUIEvent);
    refresh();
    onSkillsChanged();
  };

  const handleUninstall = (skill: Skill) => {
    callSkillUninstallHook(skill.id, chatId, messages, onUIEvent);
    uninstallSkill(skill.id);
    refresh();
    onSkillsChanged();
  };

  const handleToggle = (skill: Skill) => {
    const rec = installed.find(r => r.id === skill.id);
    if (!rec) return;
    setSkillEnabled(skill.id, !rec.enabled);
    refresh();
    onSkillsChanged();
  };

  const handleSaveConfig = (config: Record<string, string>) => {
    if (!configuringSkill) return;
    saveSkillConfig(configuringSkill.id, config);
    setConfiguringSkill(null);
    onSkillsChanged();
  };

  // Group by category for browse tab
  const byCategory = filteredCatalog.reduce<Record<string, Skill[]>>((acc, skill) => {
    const cat = skill.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  return (
    <>
      {/* Modal */}
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="flex w-full max-w-3xl max-h-[85vh] flex-col rounded-3xl border border-[var(--border-strong)] bg-[var(--surface-1)] shadow-2xl">
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-5">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <Sparkles size={18} className="text-white" />
                <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Маркет скиллов</h2>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {activeCount > 0 ? `${activeCount} ${activeCount === 1 ? 'скилл активен' : 'скиллов активно'}` : 'Расширяйте возможности модели'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-dim)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex flex-shrink-0 gap-2 px-6 pt-4">
            {(['browse', 'installed'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  tab === t
                    ? 'bg-white text-black'
                    : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t === 'browse' ? (
                  <>
                    <Package size={14} />
                    Каталог ({catalog.length})
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Установлены ({installed.length})
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-shrink-0 px-6 pb-2 pt-3">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="Поиск скиллов..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2.5 pl-11 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-strong)] focus:outline-none"
              />
            </div>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {tab === 'browse' ? (
              Object.entries(byCategory).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                    <Search size={24} className="text-[var(--text-dim)]" />
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">Ничего не найдено</p>
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  {Object.entries(byCategory).map(([cat, skills]) => (
                    <div key={cat}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
                        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </h3>
                        <span className="text-xs text-[var(--text-dim)]">({skills.length})</span>
                      </div>
                      <div className="grid gap-3">
                        {skills.map(skill => (
                          <SkillCard
                            key={skill.id}
                            skill={skill}
                            installed={installedIds.has(skill.id)}
                            active={isSkillActive(skill.id)}
                            onInstall={() => handleInstall(skill)}
                            onUninstall={() => handleUninstall(skill)}
                            onToggle={() => handleToggle(skill)}
                            onConfigure={() => setConfiguringSkill(skill)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="grid gap-3 pt-2">
                {installedSkills.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                      <Package size={24} className="text-[var(--text-dim)]" />
                    </div>
                    <p className="mb-1 text-sm font-medium text-[var(--text-primary)]">Нет установленных скиллов</p>
                    <p className="mb-4 text-xs text-[var(--text-muted)]">Установите скиллы из каталога</p>
                    <button
                      onClick={() => setTab('browse')}
                      className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                    >
                      Открыть каталог
                    </button>
                  </div>
                ) : (
                  installedSkills.map(skill => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      installed
                      active={isSkillActive(skill.id)}
                      onInstall={() => handleInstall(skill)}
                      onUninstall={() => handleUninstall(skill)}
                      onToggle={() => handleToggle(skill)}
                      onConfigure={() => setConfiguringSkill(skill)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Config modal */}
      {configuringSkill && (
        <ConfigModal
          skill={configuringSkill}
          onSave={handleSaveConfig}
          onClose={() => setConfiguringSkill(null)}
        />
      )}
    </>
  );
}
