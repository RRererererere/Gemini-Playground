import type { Skill, SkillContext, GeminiToolDeclaration } from '../types';
import {
  buildFLoveInjection,
  loadFLoveProfile,
  addCustomRule,
  recordStyleFeedback,
  resetFLoveProfile,
} from '@/lib/f-love-profile';

const tools: GeminiToolDeclaration[] = [
  {
    name: 'f_love_add_rule',
    description:
      'Save a durable writing-style rule the user wants (length, tone, formatting). Use when user says "всегда пиши короче", "без звёздочек", etc.',
    parameters: {
      type: 'object',
      properties: {
        rule: {
          type: 'string',
          description: 'Short style rule in Russian, e.g. "Без *действий* в звёздочках"',
        },
      },
      required: ['rule'],
    },
  },
  {
    name: 'f_love_status',
    description: 'Show current F-Love style profile stats (likes, edits, top ops).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

const fLoveSkill: Skill = {
  id: 'f-love',
  name: 'F-Love Style',
  description:
    'Персональный стиль ответов: учится на правках, лайках/дизлайках и «стоп = принять». Пишет так, как нравится пользователю по форме.',
  version: '1.0.0',
  author: 'Gemini Playground',
  icon: '💜',
  category: 'productivity',
  tags: ['style', 'preferences', 'f-love'],

  tools,

  onSystemPrompt: (_ctx: SkillContext) => {
    try {
      return buildFLoveInjection(loadFLoveProfile());
    } catch {
      return null;
    }
  },

  onToolCall: async (toolName, args, ctx) => {
    switch (toolName) {
      case 'f_love_add_rule': {
        const rule = String(args.rule || '').trim();
        if (!rule) {
          return { mode: 'respond', response: { success: false, error: 'empty rule' } };
        }
        const p = addCustomRule(rule);
        ctx.emit({ type: 'toast', message: `F-Love: правило сохранено`, variant: 'success' });
        return {
          mode: 'respond',
          response: { success: true, rulesCount: p.rules.length, rule },
        };
      }
      case 'f_love_status': {
        const p = loadFLoveProfile();
        return {
          mode: 'respond',
          response: {
            success: true,
            totalEdits: p.totalEdits,
            totalLikes: p.totalLikes,
            totalDislikes: p.totalDislikes,
            abortsAccepted: p.totalAbortsAccepted,
            opCounts: p.opCounts,
            rules: p.rules,
          },
        };
      }
      default:
        return { mode: 'respond', response: { success: false, error: 'unknown tool' } };
    }
  },
};

export default fLoveSkill;

// re-export helpers for UI
export { recordStyleFeedback, resetFLoveProfile, loadFLoveProfile };
