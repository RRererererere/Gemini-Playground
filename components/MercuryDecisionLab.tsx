'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plus, RotateCcw, Send, Trash2 } from 'lucide-react';

type DecisionType = 'choice' | 'noul' | 'score' | 'box';
type Question = {
  id: string;
  type: DecisionType;
  instructions: string;
  criteria: string;
};

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'recommend',
    type: 'choice',
    instructions: 'Какой вариант лучше подходит для этой задачи?',
    criteria: 'fast: Нужен быстрый и простой вариант\nflexible: Нужен гибкий вариант\nsafe: Важнее всего безопасность',
  },
];

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
  return Object.fromEntries(questions.map(question => [question.id || 'question', {
    type: question.type,
    instructions: question.instructions,
    ...(parseCriteria(question) ? { criteria: parseCriteria(question) } : {}),
  }]));
}

function answerValue(answer: any) {
  if (!answer || typeof answer !== 'object') return String(answer ?? '—');
  if (answer.type === 'choice') return answer.choice;
  if (answer.type === 'noul') return answer.noul ? 'Да' : 'Нет';
  if (answer.type === 'score') return String(answer.score);
  if (answer.type === 'box') return `left ${answer.box?.left ?? '—'} · top ${answer.box?.top ?? '—'} · right ${answer.box?.right ?? '—'} · bottom ${answer.box?.bottom ?? '—'}`;
  return JSON.stringify(answer);
}

export default function MercuryDecisionLab({ defaultApiKey = '' }: { defaultApiKey?: string }) {
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [model, setModel] = useState('inception/mercury-decide:free');
  const [state, setState] = useState('Опиши задачу, контекст и доступные факты.');
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [answers, setAnswers] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem('mercury_decide_lab_api_key');
    const storedModel = localStorage.getItem('mercury_decide_lab_model');
    if (storedKey) setApiKey(storedKey);
    if (storedModel) setModel(storedModel);
  }, []);

  const requestQuestions = useMemo(() => makeQuestions(questions), [questions]);

  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions(prev => prev.map(question => question.id === id ? { ...question, ...patch } : question));
  };

  const run = async () => {
    setLoading(true);
    setError('');
    setAnswers(null);
    localStorage.setItem('mercury_decide_lab_api_key', apiKey.trim());
    localStorage.setItem('mercury_decide_lab_model', model.trim());
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
      setAnswers(data.answers || {});
      setUsage(data.usage || null);
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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300/70">Decision Lab</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Mercury Decide</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">Проверяй структурированные решения отдельно от обычного чата: выбор, да/нет, оценка и координаты.</p>
        </div>
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/8 px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wider text-cyan-200/60">Model</div>
          <div className="font-mono text-xs text-cyan-100">{model || '—'}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr]">
            <label className="text-xs text-[var(--text-muted)]">OpenRouter API key
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-v1-..." className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-cyan-300/50" />
            </label>
            <label className="text-xs text-[var(--text-muted)]">Модель
              <input value={model} onChange={e => setModel(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-cyan-300/50" />
            </label>
          </div>
          <label className="block text-xs text-[var(--text-muted)]">State · контекст решения
            <textarea value={state} onChange={e => setState(e.target.value)} rows={5} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none focus:border-cyan-300/50" />
          </label>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
            <div>
              <h2 className="text-sm font-medium text-[var(--text-primary)]">Questions</h2>
              <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Каждый вопрос превращается в один структурированный answer.</p>
            </div>
            <button onClick={() => setQuestions(prev => [...prev, { id: `question_${prev.length + 1}`, type: 'choice', instructions: '', criteria: '' }])} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"><Plus size={13} /> Добавить</button>
          </div>

          <div className="space-y-3">
            {questions.map(question => (
              <div key={question.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <div className="flex items-center gap-2">
                  <input value={question.id} onChange={e => updateQuestion(question.id, { id: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-primary)] outline-none" />
                  <select value={question.type} onChange={e => updateQuestion(question.id, { type: e.target.value as DecisionType })} className="rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none">{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  {questions.length > 1 && <button onClick={() => setQuestions(prev => prev.filter(item => item.id !== question.id))} className="rounded-lg p-1.5 text-[var(--text-dim)] hover:bg-red-400/10 hover:text-red-300"><Trash2 size={13} /></button>}
                </div>
                <input value={question.instructions} onChange={e => updateQuestion(question.id, { instructions: e.target.value })} placeholder="Что нужно определить?" className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none" />
                <textarea value={question.criteria} onChange={e => updateQuestion(question.id, { criteria: e.target.value })} placeholder={question.type === 'choice' ? 'key: описание варианта, по одному на строку' : 'Критерии или шкала, по одному на строку'} rows={3} className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2.5 py-1.5 text-xs leading-relaxed text-[var(--text-primary)] outline-none" />
              </div>
            ))}
          </div>

          <button onClick={run} disabled={loading || !apiKey.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} />{loading ? 'Решение выполняется…' : 'Запустить Mercury'}</button>
          {error && <div className="rounded-xl border border-red-400/25 bg-red-400/8 px-3 py-2 text-xs text-red-200">{error}</div>}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-medium text-[var(--text-primary)]">Ответы</h2><p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Типизированный результат Decisions API</p></div>{answers && <button onClick={copyJson} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Скопировано' : 'JSON'}</button>}</div>
          {!answers ? <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-6 text-center text-xs leading-relaxed text-[var(--text-dim)]">Здесь появятся карточки ответов Mercury.<br />Они не теряются в длинном текстовом ответе.</div> : <div className="space-y-3">{Object.entries(answers).map(([id, answer]: [string, any]) => <div key={id} className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3"><div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-cyan-200">{id}</span><span className="rounded-full border border-cyan-300/20 px-2 py-0.5 text-[10px] uppercase tracking-wider text-cyan-200/70">{answer?.type || 'answer'}</span></div><div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{answerValue(answer)}</div>{answer?.type === 'box' && <div className="mt-2 grid grid-cols-4 gap-1 text-[10px] text-[var(--text-dim)]">{['left', 'top', 'right', 'bottom'].map(key => <div key={key} className="rounded-md bg-[var(--surface-3)] px-2 py-1"><span>{key}</span><b className="ml-1 text-[var(--text-muted)]">{answer.box?.[key] ?? '—'}</b></div>)}</div>}</div>)}</div>}
          {usage && <div className="mt-4 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--text-dim)]">{usage.inputTokens ?? 0} input · {usage.outputTokens ?? 0} output tokens</div>}
        </section>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-dim)]"><RotateCcw size={12} /> Mercury Decide возвращает JSON-решения: choice, noul, score и box. Ключ и модель сохраняются локально в этом браузере.</div>
    </div>
  );
}
