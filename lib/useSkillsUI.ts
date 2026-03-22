'use client';

import { useState, useCallback, useRef } from 'react';
import type { SkillUIEvent } from '@/lib/skills';

export interface SkillBadge {
  skillId: string;
  text: string;
  color?: string;
}

export interface SkillToast {
  id: string;
  message: string;
  variant: 'default' | 'success' | 'error' | 'warning';
  expiresAt: number;
}

export interface SkillPanelState {
  [skillId: string]: unknown;
}

export interface SkillsUIState {
  badges: Record<string, SkillBadge>;
  toasts: SkillToast[];
  panelData: SkillPanelState;
}

export function useSkillsUI() {
  const [badges, setBadges] = useState<Record<string, SkillBadge>>({});
  const [toasts, setToasts] = useState<SkillToast[]>([]);
  const [panelData, setPanelData] = useState<SkillPanelState>({});

  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleSkillEvent = useCallback((event: SkillUIEvent) => {
    switch (event.type) {
      case 'badge': {
        setBadges(prev => ({
          ...prev,
          [event.skillId]: { skillId: event.skillId, text: event.text, color: event.color },
        }));
        break;
      }

      case 'badge_clear': {
        setBadges(prev => {
          const next = { ...prev };
          delete next[event.skillId];
          return next;
        });
        break;
      }

      case 'toast': {
        const id = Math.random().toString(36).slice(2);
        const DURATION = 4000;
        const toast: SkillToast = {
          id,
          message: event.message,
          variant: event.variant ?? 'default',
          expiresAt: Date.now() + DURATION,
        };

        setToasts(prev => [...prev.slice(-4), toast]); // max 5 toasts

        const timer = setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
          toastTimers.current.delete(id);
        }, DURATION);

        toastTimers.current.set(id, timer);
        break;
      }

      case 'panel_update': {
        setPanelData(prev => ({ ...prev, [event.skillId]: event.data }));
        break;
      }
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) { clearTimeout(timer); toastTimers.current.delete(id); }
  }, []);

  const clearBadge = useCallback((skillId: string) => {
    setBadges(prev => { const n = { ...prev }; delete n[skillId]; return n; });
  }, []);

  return {
    badges,
    toasts,
    panelData,
    handleSkillEvent,
    dismissToast,
    clearBadge,
  };
}
