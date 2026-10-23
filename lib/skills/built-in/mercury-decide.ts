import type { Skill, SkillConfigField, SkillContext, SkillToolResult } from '../types';

const DEFAULT_MODEL = 'inception/mercury-decide:free';

const configSchema: SkillConfigField[] = [
  {
    key: 'api_key',
    label: 'OpenRouter API key',
    type: 'password',
    required: true,
    placeholder: 'sk-or-v1-...',
    description: 'Ключ используется только для запроса к OpenRouter Decisions API.',
  },
  {
    key: 'model',
    label: 'Модель Decisions',
    type: 'text',
    placeholder: DEFAULT_MODEL,
    description: 'По умолчанию — inception/mercury-decide:free. Можно указать совместимую Decisions-модель.',
  },
  {
    key: 'instructions',
    label: 'Инструкция',
    type: 'text',
    placeholder: 'Выбирай только допустимые варианты и не додумывай факты.',
    description: 'Дополнительные правила, которые попадут в контекст скилла.',
  },
];

function getConfig(ctx: SkillContext) {
  return {
    apiKey: (ctx.config.api_key || '').trim(),
    model: (ctx.config.model || DEFAULT_MODEL).trim(),
    instructions: (ctx.config.instructions || '').trim(),
  };
}

export const mercuryDecideSkill: Skill = {
  id: 'mercury_decide',
  name: 'Mercury Decide',
  description: 'Структурированные решения: выбор, boolean, score и bounding box через OpenRouter',
  longDescription:
    'Использует Alpha Decisions API OpenRouter. Подходит для классификации, маршрутизации, оценки уверенности и поиска объекта на изображении. ' +
    'Ответ возвращается структурированно, а не смешивается с обычным текстовым ответом.',
  version: '1.0.0',
  icon: '◈',
  category: 'data',
  author: 'Gemini Playground',
  tags: ['decision', 'classification', 'routing', 'mercury', 'openrouter'],
  configSchema,
  tools: [
    {
      name: 'mercury_decide',
      description:
        'Выполняет структурированное решение через Mercury Decide. Используй для классификации, выбора одного варианта, boolean-проверки, числовой оценки или поиска bounding box. Передай state и questions в формате OpenRouter Decisions API.',
      parameters: {
        type: 'object',
        properties: {
          state: {
            type: 'object',
            description: 'Контекст задачи: текст, факты, метаданные или данные изображения.',
          },
          questions: {
            type: 'object',
            description: 'Карта вопросов. Каждый вопрос: { type: choice|noul|score|box, instructions, criteria }.',
          },
        },
        required: ['questions'],
      },
    },
  ],

  onSystemPrompt(ctx) {
    const { apiKey, model, instructions } = getConfig(ctx);
    if (!apiKey) {
      return '◈ MERCURY DECIDE: скилл не настроен. Не вызывай mercury_decide, пока пользователь не добавит OpenRouter API key в настройках.';
    }
    return [
      '◈ MERCURY DECIDE — структурированные решения через OpenRouter Decisions API.',
      `Модель: ${model}.`,
      'Вызывай mercury_decide, когда нужен строгий выбор, классификация, boolean, score или bounding box, а не свободный текст.',
      'Типы вопросов: choice (один вариант), noul (true/false), score (число по шкале), box (координаты объекта).',
      instructions ? `Инструкция пользователя: ${instructions}` : '',
    ].filter(Boolean).join('\n');
  },

  async onToolCall(toolName, args, ctx): Promise<SkillToolResult> {
    if (toolName !== 'mercury_decide') return { mode: 'respond', response: { error: `Unknown tool: ${toolName}` } };

    const { apiKey, model } = getConfig(ctx);
    if (!apiKey) return { mode: 'respond', response: { success: false, error: 'Не задан OpenRouter API key.' } };
    const questions = args.questions;
    if (!questions || typeof questions !== 'object' || Array.isArray(questions) || Object.keys(questions as object).length === 0) {
      return { mode: 'respond', response: { success: false, error: 'questions должен быть непустым объектом.' } };
    }

    ctx.emit({ type: 'toast', message: '◈ Mercury принимает решение…', variant: 'default' });
    try {
      const response = await fetch('/api/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, model, state: args.state ?? {}, questions }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);

      ctx.emit({ type: 'toast', message: 'Решение Mercury готово', variant: 'success' });
      return {
        mode: 'respond',
        response: { success: true, model: data.model || model, answers: data.answers || {}, usage: data.usage },
        artifacts: [{
          id: `decision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'decision',
          label: 'Mercury Decide',
          skillId: 'mercury_decide',
          downloadable: false,
          data: { kind: 'json', value: { model: data.model || model, answers: data.answers || {}, usage: data.usage } },
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.emit({ type: 'toast', message: `Mercury: ${message}`, variant: 'error' });
      return { mode: 'respond', response: { success: false, error: message } };
    }
  },
};

export default mercuryDecideSkill;
