import type { Skill } from '../types';

/**
 * Table Generator Skill
 * Создает красивые таблицы из данных
 */
export const tableGeneratorSkill: Skill = {
  id: 'table_generator',
  name: 'Table Generator',
  description: 'Создает таблицы из структурированных данных',
  longDescription: 'Преобразует JSON данные в красивые интерактивные таблицы с возможностью скачивания в CSV.',
  version: '1.0.0',
  icon: '📊',
  category: 'data',
  author: 'Built-in',
  tags: ['table', 'data', 'csv', 'visualization'],

  tools: [
    {
      name: 'create_table',
      description: 'Создает таблицу из данных. Принимает заголовки и строки. Вызывай когда нужно показать данные в табличном виде.',
      parameters: {
        type: 'object',
        properties: {
          headers: {
            type: 'array',
            description: 'Массив заголовков столбцов',
            items: { type: 'string' }
          },
          rows: {
            type: 'array',
            description: 'Массив строк, каждая строка - массив значений',
            items: {
              type: 'array',
              items: { type: 'string' }
            }
          },
          title: {
            type: 'string',
            description: 'Название таблицы (опционально)'
          }
        },
        required: ['headers', 'rows']
      }
    }
  ],

  async onToolCall(toolName, args, ctx) {
    const headers = args.headers as string[];
    const rows = args.rows as string[][];
    const title = args.title as string | undefined;

    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      return {
        mode: 'respond',
        response: { error: 'Нужны заголовки таблицы' }
      };
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return {
        mode: 'respond',
        response: { error: 'Нужны данные для таблицы' }
      };
    }

    ctx.emit({
      type: 'toast',
      message: `📊 Таблица создана (${rows.length} строк)`,
      variant: 'success'
    });

    return {
      mode: 'fire_and_forget',
      artifacts: [{
        id: `table_${Date.now()}`,
        type: 'table',
        label: title || `Таблица (${rows.length} строк)`,
        data: {
          kind: 'json',
          value: { headers, rows }
        },
        downloadable: true,
        filename: 'table.csv'
      }]
    };
  },

  onInstall(ctx) {
    ctx.emit({
      type: 'toast',
      message: '📊 Table Generator установлен!',
      variant: 'success'
    });
  }
};
