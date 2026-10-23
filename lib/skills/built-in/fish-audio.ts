import type { Skill, SkillConfigField, SkillToolResult, SkillContext } from '../types';

/**
 * Fish Audio — Text-to-Speech skill.
 *
 * Требуется API-ключ Fish Audio (https://fish.audio → API keys).
 * Голос задаётся как reference_id (voice model id) + человекочитаемое имя.
 * Вызов инструмента просто показывает голосовое сообщение в чате (audio artifact).
 */

const MODELS = ['s2.1-pro', 's2.1-pro-free', 's2-pro', 'drama-3', 's1'];

const configSchema: SkillConfigField[] = [
  {
    key: 'api_key',
    label: 'API ключ Fish Audio',
    type: 'password',
    required: true,
    placeholder: 'sk-...',
    description: 'Получить: fish.audio → Settings → API Keys',
  },
  {
    key: 'voice_id',
    label: 'ID голоса (reference_id)',
    type: 'text',
    required: true,
    placeholder: '9a9cf47702da476aa4629e2506d4a857',
    description: 'ID голосовой модели из Voice Library или своего клона',
  },
  {
    key: 'voice_name',
    label: 'Кто это',
    type: 'text',
    placeholder: 'Алиса',
    description: 'Имя голоса — модель будет знать, чьим голосом говорит',
  },
  {
    key: 'model',
    label: 'Модель',
    type: 'select',
    options: MODELS,
    description: 's2.1-pro-free — бесплатный тир для тестов',
  },
  {
    key: 'instructions',
    label: 'Инструкция',
    type: 'text',
    placeholder: 'Используй голос, когда просят озвучить ответ',
    description: 'Когда и как использовать озвучку (попадает в системный промпт)',
  },
];

function getCfg(ctx: SkillContext) {
  const apiKey = (ctx.config.api_key || '').trim();
  const voiceId = (ctx.config.voice_id || '').trim();
  const voiceName = (ctx.config.voice_name || '').trim();
  const model = (ctx.config.model || 's2.1-pro').trim();
  const instructions = (ctx.config.instructions || '').trim();
  return { apiKey, voiceId, voiceName, model, instructions };
}

export const fishAudioSkill: Skill = {
  id: 'fish_audio',
  name: 'Fish Audio',
  description: 'Генерация голоса (TTS) выбранным голосом и моделью Fish Audio',
  longDescription:
    'Озвучивает текст через Fish Audio и показывает голосовое сообщение прямо в чате. ' +
    'В настройках задаются API-ключ, ID голоса, имя голоса, модель и инструкция.',
  version: '1.0.0',
  icon: '🎙️',
  category: 'fun',
  author: 'Gemini Playground',
  tags: ['voice', 'tts', 'audio', 'fish', 'speech'],

  configSchema,

  tools: [
    {
      name: 'generate_voice',
      description:
        'Озвучивает текст выбранным голосом и возвращает голосовое сообщение в чате. ' +
        'Используй, когда пользователь просит что-то сказать/озвучить голосом. ' +
        'Текст передавай дословно, без markdown и служебных символов.',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Текст, который нужно озвучить (чистый текст без разметки)',
          },
          voice_id: {
            type: 'string',
            description: 'Опционально: переопределить ID голоса из настроек',
          },
          speed: {
            type: 'number',
            description: 'Опционально: скорость речи 0.5–2.0 (по умолчанию 1.0)',
          },
        },
        required: ['text'],
      },
    },
  ],

  onSystemPrompt(ctx: SkillContext): string | null {
    const { apiKey, voiceId, voiceName, instructions } = getCfg(ctx);
    if (!apiKey || !voiceId) {
      return '🎙️ FISH AUDIO: не настроен (нужны API-ключ и ID голоса в настройках скилла). Не вызывай generate_voice.';
    }
    return [
      '🎙️ FISH AUDIO — генерация голоса',
      `Голос: ${voiceName || 'безымянный'} (id: ${voiceId}).`,
      'Когда пользователь просит озвучить/сказать голосом — вызови generate_voice с чистым текстом.',
      'После успешного вызова ответь одной короткой фразой — голосовое уже показано в чате.',
      instructions ? `Инструкция: ${instructions}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },

  async onToolCall(toolName, args, ctx): Promise<SkillToolResult> {
    if (toolName !== 'generate_voice') {
      return { mode: 'respond', response: { error: `Unknown tool: ${toolName}` } };
    }

    const { apiKey, voiceId: cfgVoiceId, voiceName, model } = getCfg(ctx);
    const text = String(args.text ?? '').trim();
    const voiceId = String(args.voice_id ?? '').trim() || cfgVoiceId;
    const speed = args.speed != null ? Number(args.speed) : undefined;

    if (!apiKey) {
      return {
        mode: 'respond',
        response: { success: false, error: 'Не задан API-ключ Fish Audio в настройках скилла.' },
      };
    }
    if (!voiceId) {
      return {
        mode: 'respond',
        response: { success: false, error: 'Не задан ID голоса (reference_id) в настройках скилла.' },
      };
    }
    if (!text) {
      return { mode: 'respond', response: { success: false, error: 'Пустой текст для озвучки.' } };
    }

    ctx.emit({
      type: 'toast',
      message: `🎙️ Озвучиваю голосом ${voiceName || 'выбранным'}...`,
      variant: 'default',
    });

    try {
      const res = await fetch('/api/fish-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          model,
          text,
          referenceId: voiceId,
          format: 'mp3',
          speed: Number.isFinite(speed) ? speed : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (!data.base64) {
        throw new Error('Пустой ответ от Fish Audio');
      }

      const label = voiceName ? `🎙️ ${voiceName}` : '🎙️ Голосовое сообщение';

      ctx.emit({
        type: 'toast',
        message: `Голосовое готово (${voiceName || 'голос'})`,
        variant: 'success',
      });

      return {
        mode: 'respond',
        response: {
          success: true,
          message: `Озвучено голосом ${voiceName || 'выбранным'}: ${text.slice(0, 120)}`,
          text,
          voice: voiceName || null,
          model,
        },
        artifacts: [
          {
            id: `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'audio',
            label,
            skillId: 'fish_audio',
            filename: `voice-${Date.now()}.mp3`,
            downloadable: true,
            data: {
              kind: 'base64',
              mimeType: data.mimeType || 'audio/mpeg',
              base64: data.base64,
            },
          },
        ],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.emit({ type: 'toast', message: `Ошибка озвучки: ${message}`, variant: 'error' });
      return { mode: 'respond', response: { success: false, error: message } };
    }
  },
};

export default fishAudioSkill;
