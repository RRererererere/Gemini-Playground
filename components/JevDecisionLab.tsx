'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Check, Copy, History, Plus, RotateCcw, Send, Trash2, Zap } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type DecisionType = 'choice' | 'noul' | 'score' | 'box';

type Question = {
  id: string;
  type: DecisionType;
  instructions: string;
  criteria: string;
};

type HistoryEntry = {
  id: string;
  timestamp: number;
  model: string;
  state: string;
  questions: Question[];
  answers: Record<string, any>;
  usage?: { inputTokens?: number; outputTokens?: number };
};

// ─── Models ──────────────────────────────────────────────────────────────────

const DECISION_MODELS = [
  { id: 'inception/mercury-decide:free', label: 'Mercury Decide (free)', provider: 'Inception' },
  { id: 'typesafe/jev-1.13', label: 'Jev 1.13', provider: 'TypeSafe' },
  { id: 'typesafe/jev-1.12', label: 'Jev 1.12', provider: 'TypeSafe' },
];

// ─── Presets ─────────────────────────────────────────────────────────────────

const PRESETS: Array<{ label: string; description: string; state: string; questions: Question[] }> = [
  {
    label: '🎫 Ticket Triage',
    description: 'Классификация тикета поддержки: баг ли это, какая команда, срочность.',
    state: 'Customer tier: enterprise\nTicket: "My checkout page shows a blank screen after I click Pay. I have tried two browsers."',
    questions: [
      { id: 'is_bug', type: 'noul', instructions: 'Is the customer reporting a software defect?', criteria: 'true: The customer describes broken or unexpected product behavior.\nfalse: The customer is asking a question or requesting a feature.' },
      { id: 'team', type: 'choice', instructions: 'Which team should own this ticket?', criteria: 'account: Login, permissions, or profile issues.\nfrontend: Rendering, layout, or browser compatibility issues.\npayments: Checkout, billing, or payment processing issues.' },
      { id: 'urgency', type: 'score', instructions: 'How urgent is this ticket?', criteria: 'Can wait for the next release\nShould be fixed this week\nBlocking revenue right now' },
    ],
  },
  {
    label: '⚖️ Code Review Gate',
    description: 'Решение: можно ли смержить PR, нужен ли рефакторинг, уровень риска.',
    state: 'PR title: "Add retry logic to payment webhook handler"\nFiles changed: 3, Lines: +47 -12\nDescription: Adds exponential backoff retry for failed webhook deliveries.',
    questions: [
      { id: 'approve', type: 'noul', instructions: 'Should this PR be approved as-is?', criteria: 'true: Code is correct, tested, and safe to merge.\nfalse: Needs changes before merging.' },
      { id: 'risk', type: 'choice', instructions: 'What is the risk level of this change?', criteria: 'low: Cosmetic or isolated change.\nmedium: Touches shared logic but well-tested.\nhigh: Affects critical path or data integrity.' },
      { id: 'confidence', type: 'score', instructions: 'How confident are you in this assessment? (0-100)', criteria: '0: No context available\n50: Partial understanding\n100: Full certainty' },
    ],
  },
  {
    label: '🛒 Product Recommendation',
    description: 'Выбор лучшего варианта продукта по контексту пользователя.',
    state: 'User: small business owner, budget $50/mo, needs invoicing + CRM, no technical skills.',
    questions: [
      { id: 'recommend', type: 'choice', instructions: 'Which plan fits best?', criteria: 'starter: Simple invoicing, no CRM, under $20/mo.\ngrowth: Invoicing + CRM, under $50/mo.\npro: Full suite, over $50/mo, advanced features.' },
      { id: 'fit_score', type: 'score', instructions: 'How well does the recommendation fit? (0-100)', criteria: '0: Completely wrong\n50: Partially relevant\n100: Perfect match' },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<DecisionType, string> = {
  choice: 'Choice · один вариант',
  noul: 'Noul · да / нет',
  score: 'Score · числовая оценка',
  box: 'Box · область на изображении',
};

function parseCriteria(question: Question): Record<string, string> | string[] | undefined {
  const lines = question.criteria.split('\n').map(line => line.trim()).filter(Boolean);
  if (question.type === 'score' || question.type === 'box') return lines.length > 0 ? lines : undefined;
  const map: Record<string, string> = {};
  for (const line of lines) {
    const separator = line.indexOf(':');
    if (separator === -1) map[line] = line;
    else map[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

function makeQuestions(questions: Question[]) {
  return Object.fromEntries(questions.map(q => [q.id || 'question', {
    type: q.type,
    instructions: q.instructions,
    ...(parseCriteria(q) ? { criteria: parseCriteria(q) } : {}),
  }]));
}

function answerDisplay(answer: any): string {
  if (!answer || typeof answer !== 'object') return String(answer ?? '—');
  if (answer.type === 'choice') return answer.choice;
  if (answer.type === 'noul') return answer.noul ? '✓ Да' : '✗ Нет';
  if (answer.type === 'score') return String(answer.score);
  if (answer.type === 'box') return `left ${answer.box?.left ?? '—'} · top ${answer.box?.top ?? '—'} · right ${answer.box?.right ?? '—'} · bottom ${answer.box?.bottom ?? '—'}`;
  return JSON.stringify(answer);
}

function answerColor(type?: string): string {
  switch (type) {
    case 'noul': return 'text-emerald-300';
    case 'choice': return 'text-cyan-200';
    case 'score': return 'text-amber-200';
    case 'box': return 'text-pink-200';
    default: return 'text-[var(--text-primary)]';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function JevDecisionLab({ defaultApiKey = '' }: { defaultApiKey?: string }) {
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [model, setModel] = useState(DECISION_MODELS[0].id);
  const [state, setState] = useState('');
  const [questions, setQuestions] = useState<Question[]>(PRESETS[0].questions);
  const [answers, setAnswers] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load persisted state
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem('jev_lab_api_key');
      const storedModel = localStorage.getItem('jev_lab_model');
      const storedHistory = localStorage.getItem('jev_lab_history');
      if (storedKey) setApiKey(storedKey);
      if (storedModel && DECISION_MODELS.some(m => m.id === storedModel)) setModel(storedModel);
      if (storedHistory) setHistory(JSON.parse(storedHistory));
    } catch { /* ignore */ }
  }, []);

  const requestQuestions = useMemo(() => makeQuestions(questions), [questions]);

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setState(preset.state);
    setQuestions(preset.questions);
    setAnswers(null);
    setUsage(null);
    setError('');
  };

  const run = async () => {
    setLoading(true);
    setError('');
    setAnswers(null);
    localStorage.setItem('jev_lab_api_key', apiKey.trim());
    localStorage.setItem('jev_lab_model', model.trim());
    try {
      const response = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model: model.trim(),
          state,
          questions: requestQuestions,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);
      const ans = data.answers || {};
      const usg = data.usage || null;
      setAnswers(ans);
      setUsage(usg);

      // Save to history
      const entry: HistoryEntry = {
        id: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
        timestamp: Date.now(),
        model: data.model || model,
        state,
        questions: [...questions],
        answers: ans,
        usage: usg,
      };
      const nextHistory = [entry, ...history].slice(0, 20);
      setHistory(nextHistory);
      try { localStorage.setItem('jev_lab_history', JSON.stringify(nextHistory)); } catch { /* quota */ }
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setLoading(false);
    }
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify({ model, answers, usage }, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const restoreFromHistory = (entry: HistoryEntry) => {
    setModel(entry.model);
    setState(entry.state);
    setQuestions(entry.questions);
    setAnswers(entry.answers);
    setUsage(entry.usage || null);
    setShowHistory(false);
    setError('');
  };

  const clearHistory = () => {
    setHistory([]);
    try { localStorage.removeItem('jev_lab_history'); } catch { /* ignore */ }
  };

  const activeModelInfo = DECISION_MODELS.find(m => m.id === model);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8 px-4 pt-2">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-violet-300/70">Decision Playground</span>
            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[9px] font-medium text-violet-300">Jev Mode</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Jev Decisions</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
            Structured decision-making playground. Choose a model, define questions with typed answers (choice, boolean, score, bounding box), and get deterministic structured output — not free-form text.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-all ${
              showHistory
                ? 'border-violet-400/30 bg-violet-400/10 text-violet-200'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
            }`}
          >
            <History size={13} />
            История ({history.length})
          </button>
          <div className="rounded-xl border border-violet-300/20 bg-violet-300/8 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider text-violet-200/60">Model</div>
            <div className="font-mono text-xs text-violet-100">{activeModelInfo?.label || model}</div>
          </div>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="rounded-2xl border border-violet-400/20 bg-[var(--surface-1)] p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">История решений</h3>
            {history.length > 0 && (
              <button onClick={clearHistory} className="flex items-center gap-1 text-[11px] text-red-400/70 hover:text-red-300 transition-colors">
                <Trash2 size={11} /> Очистить
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-dim)]">Пока пусто. Запустите решение, и оно появится здесь.</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {history.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => restoreFromHistory(entry)}
                  className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 hover:border-violet-400/30 hover:bg-[var(--surface-3)] transition-all group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-violet-300/70">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    <span className="text-[10px] text-[var(--text-dim)]">{entry.model.replace(/^.*\//, '')}</span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)] truncate">{entry.state || '(empty state)'}</div>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {Object.entries(entry.answers).map(([key, ans]: [string, any]) => (
                      <span key={key} className={`rounded-md border border-[var(--border)] bg-[var(--surface-3)] px-1.5 py-0.5 text-[9px] font-mono ${answerColor(ans?.type)}`}>
                        {key}: {answerDisplay(ans)}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset, i) => (
          <button
            key={i}
            onClick={() => applyPreset(preset)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left transition-all hover:border-violet-400/30 hover:bg-[var(--surface-3)] group"
          >
            <div className="text-xs font-medium text-[var(--text-primary)] group-hover:text-violet-200 transition-colors">{preset.label}</div>
            <div className="mt-0.5 text-[10px] text-[var(--text-dim)] leading-snug max-w-xs">{preset.description}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Config */}
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
            <label className="text-xs text-[var(--text-muted)]">
              OpenRouter API key
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400/50"
              />
            </label>
            <label className="text-xs text-[var(--text-muted)]">
              Модель
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-violet-400/50"
              >
                {DECISION_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.label} — {m.provider}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-[var(--text-muted)]">
            State · контекст решения
            <textarea
              value={state}
              onChange={e => setState(e.target.value)}
              rows={4}
              placeholder="Опиши задачу, факты, метаданные…"
              className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none focus:border-violet-400/50"
            />
          </label>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Questions</h2>
              <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Каждый вопрос → один структурированный answer.</p>
            </div>
            <button
              onClick={() => setQuestions(prev => [...prev, { id: `q_${prev.length + 1}`, type: 'choice', instructions: '', criteria: '' }])}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
            >
              <Plus size={13} /> Добавить
            </button>
          </div>

          <div className="space-y-3">
            {questions.map(q => (
              <div key={q.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={q.id}
                    onChange={e => updateQuestion(q.id, { id: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)] outline-none"
                  />
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(q.id, { type: e.target.value as DecisionType })}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none"
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  {questions.length > 1 && (
                    <button
                      onClick={() => setQuestions(prev => prev.filter(item => item.id !== q.id))}
                      className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-red-400/10 hover:text-red-300"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <input
                  value={q.instructions}
                  onChange={e => updateQuestion(q.id, { instructions: e.target.value })}
                  placeholder="Что нужно определить?"
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none"
                />
                <textarea
                  value={q.criteria}
                  onChange={e => updateQuestion(q.id, { criteria: e.target.value })}
                  placeholder={q.type === 'choice' ? 'key: описание варианта, по одному на строку' : q.type === 'noul' ? 'true: условие для «да»\nfalse: условие для «нет»' : 'Критерии или шкала, по одному на строку'}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2.5 py-1.5 text-xs leading-relaxed text-[var(--text-primary)] outline-none"
                />
              </div>
            ))}
          </div>

          <button
            onClick={run}
            disabled={loading || !apiKey.trim() || questions.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Zap size={15} />
            {loading ? 'Решение выполняется…' : 'Запустить Jev'}
          </button>
          {error && <div className="rounded-xl border border-red-400/25 bg-red-400/8 px-3 py-2 text-xs text-red-200">{error}</div>}
        </section>

        {/* Right: Results */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Ответы</h2>
              <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Типизированный результат Decisions API</p>
            </div>
            {answers && (
              <button
                onClick={copyJson}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Скопировано' : 'JSON'}
              </button>
            )}
          </div>

          {!answers ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-6 text-center">
              <Zap size={24} className="text-[var(--text-dim)]/40" />
              <div className="text-xs leading-relaxed text-[var(--text-dim)]">
                Выберите пресет или настройте вопросы,<br />затем нажмите «Запустить Jev».
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(answers).map(([id, answer]: [string, any]) => (
                <div key={id} className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-violet-200">{id}</span>
                    <span className={`rounded-full border border-violet-400/20 px-2 py-0.5 text-[10px] uppercase tracking-wider ${answerColor(answer?.type)} opacity-80`}>
                      {answer?.type || 'answer'}
                    </span>
                  </div>
                  <div className={`mt-2 text-sm font-medium ${answerColor(answer?.type)}`}>
                    {answerDisplay(answer)}
                  </div>
                  {answer?.type === 'box' && (
                    <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] text-[var(--text-dim)]">
                      {['left', 'top', 'right', 'bottom'].map(key => (
                        <div key={key} className="rounded-md bg-[var(--surface-3)] px-2 py-1">
                          <span>{key}</span>
                          <b className="ml-1 text-[var(--text-muted)]">{answer.box?.[key] ?? '—'}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {usage && (
            <div className="mt-4 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--text-dim)]">
              {usage.inputTokens ?? 0} input · {usage.outputTokens ?? 0} output tokens
            </div>
          )}
        </section>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
        <RotateCcw size={12} />
        Jev Decisions возвращает типизированные JSON-ответы: choice, noul (boolean), score и box. Ключ, модель и история сохраняются локально.
      </div>
    </div>
  );
}
