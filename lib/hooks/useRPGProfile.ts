import { useEffect, useCallback } from 'react';
import {
  loadRPGProfile,
  saveRPGProfile,
  addFeedbackEntry,
  getStyleInjection,
  needsCondensation,
  buildCondensationPrompt,
} from '@/lib/rpg-style-profile';

/**
 * Хук для управления RPG style profile.
 * Включает периодическую компрессию профиля через Gemini API.
 */
export function useRPGProfile(model: string, selectedApiKey: string | null) {
  // Periodic profile condensation (fire and forget)
  useEffect(() => {
    const profile = loadRPGProfile();
    if (!needsCondensation(profile)) return;

    const doCondense = async () => {
      const prompt = buildCondensationPrompt(profile);
      try {
        if (!selectedApiKey) return;

        // Один вызов к Gemini, короткий, без стриминга
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${selectedApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.7,
              },
            }),
          }
        );

        if (!response.ok) return;

        const data = await response.json();
        const result = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const updatedProfile = {
          ...profile,
          condensedRules: result,
          lastCondensedAt: Date.now(),
          entries: profile.entries.slice(-5)
        };
        saveRPGProfile(updatedProfile);
      } catch (e) {
        console.error('RPG profile condensation failed:', e);
      }
    };

    doCondense();
  }, [model, selectedApiKey]);

  const addFeedback = useCallback(
    (rating: 'like' | 'dislike', comment: string, excerpt: string) => {
      addFeedbackEntry({
        rating,
        comment,
        excerpt,
        timestamp: Date.now()
      });
    },
    []
  );

  const getStyle = useCallback(() => {
    const profile = loadRPGProfile();
    return getStyleInjection(profile);
  }, []);

  return {
    addFeedback,
    getStyle,
  };
}
