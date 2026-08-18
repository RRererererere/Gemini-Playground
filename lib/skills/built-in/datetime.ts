import type { Skill, SkillToolResult } from '../types';

export const datetimeSkill: Skill = {
  id: 'datetime',
  name: 'Date & Time',
  description: 'Текущее время, дата, таймзоны и форматирование дат.',
  version: '1.0.0',
  icon: '🕐',
  category: 'utils',
  author: 'Built-in',
  tags: ['time', 'date', 'timezone', 'calendar'],

  tools: [
    {
      name: 'get_current_datetime',
      description:
        'Возвращает текущую дату и время пользователя. Вызывай когда нужно знать "сколько сейчас времени", "какое сегодня число", "какой день недели".',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description:
              'IANA timezone (например "Europe/Moscow"). Если не указано — берётся локальный timezone пользователя.',
          },
          format: {
            type: 'string',
            enum: ['full', 'date', 'time', 'iso'],
            description: 'Формат вывода. По умолчанию: full.',
          },
        },
        required: [],
      },
    },
    {
      name: 'format_date',
      description: 'Форматирует дату в нужный вид или вычисляет разницу между датами.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Дата для форматирования (ISO 8601 или описание вроде "2024-03-15")',
          },
          target_format: {
            type: 'string',
            description: 'Целевой формат: "human" (читаемый), "iso", "timestamp", "relative".',
          },
        },
        required: ['date'],
      },
    },
  ],

  async onToolCall(toolName, args): Promise<SkillToolResult> {
    if (toolName === 'get_current_datetime') {
      const now = new Date();
      const tz = args.timezone as string | undefined;
      const format = (args.format as string) || 'full';

      let result: Record<string, string>;

      try {
        const locale = 'ru-RU';
        const tzOptions = tz ? { timeZone: tz } : {};

        const fullDate = now.toLocaleDateString(locale, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          ...tzOptions,
        });

        const timeStr = now.toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          ...tzOptions,
        });

        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

        result = {
          datetime: `${fullDate}, ${timeStr}`,
          date: now.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', ...tzOptions }),
          time: timeStr,
          iso: now.toISOString(),
          timezone: tz || detectedTz,
          timestamp: String(Math.floor(now.getTime() / 1000)),
          day_of_week: now.toLocaleDateString(locale, { weekday: 'long', ...tzOptions }),
          format_requested: format,
        };
      } catch {
        result = {
          datetime: now.toISOString(),
          error: tz ? `Неизвестный timezone: ${tz}` : 'Ошибка форматирования',
        };
      }

      return { mode: 'respond', response: result };
    }

    if (toolName === 'format_date') {
      const dateStr = args.date as string;
      const targetFormat = (args.target_format as string) || 'human';

      try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          return { mode: 'respond', response: { error: `Не удалось распарсить дату: ${dateStr}` } };
        }

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        let relative = '';
        if (diffDays === 0) relative = 'сегодня';
        else if (diffDays === 1) relative = 'вчера';
        else if (diffDays === -1) relative = 'завтра';
        else if (diffDays > 0) relative = `${diffDays} дней назад`;
        else relative = `через ${Math.abs(diffDays)} дней`;

        return {
          mode: 'respond',
          response: {
            original: dateStr,
            human: date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' }),
            iso: date.toISOString(),
            timestamp: String(Math.floor(date.getTime() / 1000)),
            relative,
            format_requested: targetFormat,
          },
        };
      } catch {
        return { mode: 'respond', response: { error: 'Ошибка форматирования даты' } };
      }
    }

    return { mode: 'respond', response: { error: 'Unknown tool' } };
  },
};
