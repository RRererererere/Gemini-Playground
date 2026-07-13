/**
 * F-Love profile — стиль письма пользователя.
 * Учится на: like/dislike, diff правок model-сообщений, abort-as-accept.
 * Хранит только стиль/форму (длина, формат, регистр), не сюжетный контент.
 */

const STORAGE_KEY = 'f_love_profile_v1';
const MAX_EDIT_EVENTS = 40;
const MAX_FEEDBACK = 40;

export type StyleOp =
  | 'shorten'
  | 'lengthen'
  | 'remove_asterisk_actions'
  | 'remove_markdown'
  | 'more_chatty'
  | 'lowercase_start'
  | 'abort_accept'
  | 'custom';

export interface StyleEditEvent {
  id: string;
  ts: number;
  messageId?: string;
  beforeLen: number;
  afterLen: number;
  ratio: number;
  ops: StyleOp[];
  /** Короткие безопасные заметки (не полный текст) */
  note?: string;
}

export interface StyleFeedbackEvent {
  id: string;
  ts: number;
  rating: 'like' | 'dislike';
  comment?: string;
  excerpt?: string;
  source: 'thumb' | 'edit' | 'abort' | 'shorter';
}

export interface FLoveProfile {
  version: 1;
  editEvents: StyleEditEvent[];
  feedback: StyleFeedbackEvent[];
  /** Явные правила, которые всегда в промпте */
  rules: string[];
  /** Счётчики ops */
  opCounts: Partial<Record<StyleOp, number>>;
  totalLikes: number;
  totalDislikes: number;
  totalEdits: number;
  totalAbortsAccepted: number;
  updatedAt: number;
}

const DEFAULT_RULES: string[] = [
  'Пиши живым разговорным языком, без канцелярита и «AI-воды».',
  'По умолчанию короче: не раздувай ответ; если можно в 2–6 предложениях — так и пиши.',
  'Не злоупотребляй markdown: без **жирного** и без *действий в звёздочках*, если пользователь не просил формат ролки.',
  'Если пользователь остановил генерацию — считай частичный текст принятым, не извиняйся и не пересказывай заново.',
  'После правок пользователя повторяй его тон, длину и регистр (часто более «чат», иногда lowercase).',
];

function emptyProfile(): FLoveProfile {
  return {
    version: 1,
    editEvents: [],
    feedback: [],
    rules: [...DEFAULT_RULES],
    opCounts: {},
    totalLikes: 0,
    totalDislikes: 0,
    totalEdits: 0,
    totalAbortsAccepted: 0,
    updatedAt: Date.now(),
  };
}

export function loadFLoveProfile(): FLoveProfile {
  if (typeof window === 'undefined') return emptyProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProfile();
    const p = JSON.parse(raw) as FLoveProfile;
    return {
      ...emptyProfile(),
      ...p,
      rules: p.rules?.length ? p.rules : [...DEFAULT_RULES],
      editEvents: p.editEvents || [],
      feedback: p.feedback || [],
      opCounts: p.opCounts || {},
    };
  } catch {
    return emptyProfile();
  }
}

export function saveFLoveProfile(profile: FLoveProfile): void {
  if (typeof window === 'undefined') return;
  try {
    profile.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent('f-love:changed', { detail: profile }));
  } catch (e) {
    console.error('[F-Love] save failed', e);
  }
}

export function analyzeEditOps(before: string, after: string): StyleOp[] {
  const ops: StyleOp[] = [];
  if (!before && after) return ops;
  const bl = before.length;
  const al = after.length;
  if (bl > 0 && al < bl * 0.85) ops.push('shorten');
  if (bl > 0 && al > bl * 1.15) ops.push('lengthen');
  if (/\*[^*\n]+\*/.test(before) && !/\*[^*\n]+\*/.test(after)) ops.push('remove_asterisk_actions');
  if (/\*\*/.test(before) && !/\*\*/.test(after)) ops.push('remove_markdown');
  if (before !== before.toLowerCase() && after === after.toLowerCase()) ops.push('lowercase_start');
  // «чатнее»: меньше абзацев / меньше формальных точек с новой строки
  const beforeParas = before.split(/\n\n+/).length;
  const afterParas = after.split(/\n\n+/).length;
  if (beforeParas >= 3 && afterParas < beforeParas) ops.push('more_chatty');
  return ops;
}

export function recordStyleEdit(args: {
  messageId?: string;
  before: string;
  after: string;
}): FLoveProfile {
  const profile = loadFLoveProfile();
  const ops = analyzeEditOps(args.before, args.after);
  if (ops.length === 0 && args.before === args.after) return profile;

  const event: StyleEditEvent = {
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    messageId: args.messageId,
    beforeLen: args.before.length,
    afterLen: args.after.length,
    ratio: args.before.length > 0 ? args.after.length / args.before.length : 1,
    ops: ops.length ? ops : ['custom'],
  };

  profile.editEvents = [...profile.editEvents, event].slice(-MAX_EDIT_EVENTS);
  profile.totalEdits++;
  for (const op of event.ops) {
    profile.opCounts[op] = (profile.opCounts[op] || 0) + 1;
  }

  // Эвристика: сильное укорачивание → лайк «короче»
  if (ops.includes('shorten')) {
    const fb: StyleFeedbackEvent = {
      id: `f_${Date.now()}`,
      ts: Date.now(),
      rating: 'like',
      comment: 'Предпочёл более короткий ответ (правка)',
      source: 'edit',
      excerpt: args.after.slice(0, 120),
    };
    profile.feedback = [...profile.feedback, fb].slice(-MAX_FEEDBACK);
    profile.totalLikes++;
  }

  saveFLoveProfile(profile);
  return profile;
}

export function recordStyleFeedback(args: {
  rating: 'like' | 'dislike';
  comment?: string;
  excerpt?: string;
  source?: StyleFeedbackEvent['source'];
}): FLoveProfile {
  const profile = loadFLoveProfile();
  const fb: StyleFeedbackEvent = {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    rating: args.rating,
    comment: args.comment,
    excerpt: args.excerpt?.slice(0, 200),
    source: args.source || 'thumb',
  };
  profile.feedback = [...profile.feedback, fb].slice(-MAX_FEEDBACK);

  if (args.rating === 'like') profile.totalLikes++;
  else profile.totalDislikes++;

  saveFLoveProfile(profile);
  return profile;
}

export function recordAbortAccepted(excerpt?: string): FLoveProfile {
  const profile = loadFLoveProfile();
  profile.totalAbortsAccepted++;
  profile.opCounts.abort_accept = (profile.opCounts.abort_accept || 0) + 1;
  const fb: StyleFeedbackEvent = {
    id: `f_abort_${Date.now()}`,
    ts: Date.now(),
    rating: 'like',
    comment: 'Остановил генерацию — частичный ответ принят',
    excerpt: excerpt?.slice(0, 200),
    source: 'abort',
  };
  profile.feedback = [...profile.feedback, fb].slice(-MAX_FEEDBACK);
  profile.totalLikes++;
  saveFLoveProfile(profile);
  return profile;
}

/** Собрать injection для system prompt */
export function buildFLoveInjection(profile?: FLoveProfile): string {
  const p = profile || loadFLoveProfile();
  const lines: string[] = [];

  lines.push('═══ F-LOVE STYLE (персональные предпочтения формы ответа) ═══');
  lines.push('Соблюдай эти правила стиля всегда, пока пользователь явно не попросит иначе:');

  for (const r of p.rules) {
    lines.push(`• ${r}`);
  }

  // Динамика по ops
  const ops = p.opCounts;
  const dyn: string[] = [];
  if ((ops.shorten || 0) >= 3) {
    dyn.push('Пользователь часто укорачивает ответы — держи ответы компактными.');
  }
  if ((ops.remove_asterisk_actions || 0) >= 2) {
    dyn.push('Не используй *описания действий* в звёздочках.');
  }
  if ((ops.remove_markdown || 0) >= 2) {
    dyn.push('Минимум markdown-форматирования.');
  }
  if ((ops.more_chatty || 0) >= 2) {
    dyn.push('Пиши как в мессенджере: короткие абзацы, живой тон.');
  }
  if ((ops.lowercase_start || 0) >= 2) {
    dyn.push('Допустим неформальный регистр (не всегда с заглавной).');
  }
  if ((ops.abort_accept || 0) >= 2) {
    dyn.push('Не переписывай уже принятый частичный текст с нуля без запроса.');
  }

  if (dyn.length) {
    lines.push('');
    lines.push('Из последних правок:');
    dyn.forEach(d => lines.push(`• ${d}`));
  }

  const recentFb = p.feedback.slice(-8);
  const likes = recentFb.filter(f => f.rating === 'like' && f.comment);
  const dislikes = recentFb.filter(f => f.rating === 'dislike' && f.comment);
  if (likes.length || dislikes.length) {
    lines.push('');
    if (likes.length) {
      lines.push('Понравилось (комменты):');
      likes.slice(-4).forEach(f => lines.push(`• ${f.comment}`));
    }
    if (dislikes.length) {
      lines.push('Не понравилось (комменты):');
      dislikes.slice(-4).forEach(f => lines.push(`• ${f.comment}`));
    }
  }

  // Средний ratio правок
  const ratios = p.editEvents.filter(e => e.beforeLen > 40).map(e => e.ratio);
  if (ratios.length >= 3) {
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    if (avg < 0.85) {
      lines.push('');
      lines.push(
        `Целевая длина: около ${Math.round(avg * 100)}% от «обычного» verbose-ответа (пользователь режет длинноты).`
      );
    }
  }

  lines.push('═══ END F-LOVE ═══');
  return lines.join('\n');
}

export function addCustomRule(rule: string): FLoveProfile {
  const profile = loadFLoveProfile();
  const t = rule.trim();
  if (!t) return profile;
  if (!profile.rules.includes(t)) profile.rules = [...profile.rules, t].slice(-20);
  saveFLoveProfile(profile);
  return profile;
}

export function resetFLoveProfile(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('f-love:changed'));
}

/** Промпт-хинт для «Короче» */
export const SHORTER_HINT =
  '[STYLE] Перепиши / ответь значительно короче: в 2–5 раз меньше текста, без воды, без markdown-украшений, только суть. Сохрани смысл и тон. Не извиняйся.';

/** Промпт-хинт для continue-from-cursor (append) */
export const CONTINUE_FROM_CURSOR_HINT =
  '[STYLE] Продолжи с места обрыва того же сообщения. Не повторяй уже написанное. Сохраняй тон и длину в духе F-Love (компактно, живо).';
