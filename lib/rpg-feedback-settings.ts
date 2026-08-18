/**
 * Настройки RPG Feedback системы
 * Позволяет пользователю контролировать когда показывать feedback запросы
 */

export interface RPGFeedbackSettings {
  enabled: boolean;                    // Включена ли система вообще
  showInlineFeedback: boolean;         // Показывать ли inline feedback виджеты
  autoCondensation: boolean;           // Автоматическая компрессия профиля
  condensationThreshold: number;       // Порог для компрессии (кол-во entries)
  maxHistoryEntries: number;           // Максимум сырых entries в истории
}

export const DEFAULT_RPG_FEEDBACK_SETTINGS: RPGFeedbackSettings = {
  enabled: true,
  showInlineFeedback: true,
  autoCondensation: true,
  condensationThreshold: 10,
  maxHistoryEntries: 30,
};

const STORAGE_KEY = 'rpg_feedback_settings';

export function loadRPGFeedbackSettings(): RPGFeedbackSettings {
  if (typeof window === 'undefined') return DEFAULT_RPG_FEEDBACK_SETTINGS;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_RPG_FEEDBACK_SETTINGS;
    
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_RPG_FEEDBACK_SETTINGS, ...parsed };
  } catch (err) {
    console.error('[RPG Feedback Settings] Load error:', err);
    return DEFAULT_RPG_FEEDBACK_SETTINGS;
  }
}

export function saveRPGFeedbackSettings(settings: RPGFeedbackSettings): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('[RPG Feedback Settings] Save error:', err);
  }
}

export function resetRPGFeedbackSettings(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
