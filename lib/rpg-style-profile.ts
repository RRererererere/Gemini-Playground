// ─────────────────────────────────────────────────────────────────────────────
// RPG Style Profile - хранение и компрессия вкусовых предпочтений пользователя
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'rpg_style_profile';
const MAX_ENTRIES = 30;
const MIN_ENTRIES_FOR_INJECTION = 5;
const ENTRIES_THRESHOLD_FOR_CONDENSATION = 10;

export interface FeedbackEntry {
  rating: 'like' | 'dislike';
  comment: string;
  excerpt: string;          // первые 200 символов ответа модели
  timestamp: number;
}

export interface RPGStyleProfile {
  entries: FeedbackEntry[]; // сырые записи, максимум 30 последних
  condensedRules?: string;  // AI-сжатое резюме, строка 3-7 пунктов
  lastCondensedAt?: number; // timestamp последней компрессии
  totalLikes: number;
  totalDislikes: number;
}

// Загрузить профиль из localStorage
export function loadRPGProfile(): RPGStyleProfile {
  if (typeof window === 'undefined') {
    return { entries: [], totalLikes: 0, totalDislikes: 0 };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { entries: [], totalLikes: 0, totalDislikes: 0 };
    }
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to load RPG profile:', e);
    return { entries: [], totalLikes: 0, totalDislikes: 0 };
  }
}

// Сохранить профиль
export function saveRPGProfile(profile: RPGStyleProfile): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save RPG profile:', e);
  }
}

// Добавить запись фидбека. Обрезает entries до 30 последних.
export function addFeedbackEntry(entry: FeedbackEntry): RPGStyleProfile {
  const profile = loadRPGProfile();
  
  profile.entries.push(entry);
  
  // Обрезаем до MAX_ENTRIES последних
  if (profile.entries.length > MAX_ENTRIES) {
    profile.entries = profile.entries.slice(-MAX_ENTRIES);
  }
  
  // Обновляем счетчики
  if (entry.rating === 'like') {
    profile.totalLikes++;
  } else {
    profile.totalDislikes++;
  }
  
  saveRPGProfile(profile);
  return profile;
}

// Вернуть строку для инжекции в system prompt
export function getStyleInjection(profile: RPGStyleProfile): string | null {
  // Если есть сжатые правила — использовать их
  if (profile.condensedRules) {
    return `--- [Предпочтения пользователя по стилю нарратива]
${profile.condensedRules}
---`;
  }
  
  // Если entries >= 5 но нет condensedRules — вернуть краткий список
  if (profile.entries.length >= MIN_ENTRIES_FOR_INJECTION) {
    const recentEntries = profile.entries.slice(-MIN_ENTRIES_FOR_INJECTION);
    const lines: string[] = [];
    
    const likes = recentEntries.filter(e => e.rating === 'like');
    const dislikes = recentEntries.filter(e => e.rating === 'dislike');
    
    if (likes.length > 0) {
      lines.push('Понравилось:');
      likes.forEach(e => {
        if (e.comment) {
          lines.push(`• ${e.comment}`);
        }
      });
    }
    
    if (dislikes.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push('Не понравилось:');
      dislikes.forEach(e => {
        if (e.comment) {
          lines.push(`• ${e.comment}`);
        }
      });
    }
    
    if (lines.length === 0) return null;
    
    return `--- [Предпочтения пользователя по стилю нарратива]
${lines.join('\n')}
---`;
  }
  
  // Если entries < 5 — вернуть null
  return null;
}

// Проверить нужна ли компрессия
export function needsCondensation(profile: RPGStyleProfile): boolean {
  // Если нет lastCondensedAt — проверяем есть ли >= 10 entries
  if (!profile.lastCondensedAt) {
    return profile.entries.length >= ENTRIES_THRESHOLD_FOR_CONDENSATION;
  }
  
  // Если была компрессия — считаем сколько новых entries после неё
  const entriesAfterCondensation = profile.entries.filter(
    e => e.timestamp > profile.lastCondensedAt!
  );
  
  return entriesAfterCondensation.length >= ENTRIES_THRESHOLD_FOR_CONDENSATION;
}

// Сформировать промпт для компрессии
export function buildCondensationPrompt(profile: RPGStyleProfile): string {
  const likes = profile.entries.filter(e => e.rating === 'like');
  const dislikes = profile.entries.filter(e => e.rating === 'dislike');
  
  let prompt = `Проанализируй фидбек пользователя по ответам RPG-нарратора и сформулируй 3-7 конкретных правил стиля в виде коротких пунктов. Правила должны быть практичными указаниями для модели.\n\n`;
  
  if (likes.length > 0) {
    prompt += 'Понравилось:\n';
    likes.forEach(e => {
      const commentPart = e.comment ? `[${e.comment}]` : '[без комментария]';
      prompt += `- ${commentPart}: "${e.excerpt}"\n`;
    });
    prompt += '\n';
  }
  
  if (dislikes.length > 0) {
    prompt += 'Не понравилось:\n';
    dislikes.forEach(e => {
      const commentPart = e.comment ? `[${e.comment}]` : '[без комментария]';
      prompt += `- ${commentPart}: "${e.excerpt}"\n`;
    });
    prompt += '\n';
  }
  
  prompt += 'Ответь ТОЛЬКО списком правил без вступления, каждое с новой строки, начиная с "•".';
  
  return prompt;
}
