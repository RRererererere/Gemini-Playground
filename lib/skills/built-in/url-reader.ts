import type { Skill, SkillToolResult } from '../types';

export const urlReaderSkill: Skill = {
  id: 'url_reader',
  name: 'URL Reader',
  description: 'Читает содержимое веб-страниц и возвращает текст. Использует Jina AI Reader.',
  version: '1.0.0',
  icon: '🌐',
  category: 'search',
  author: 'Built-in',
  tags: ['web', 'url', 'fetch', 'read', 'browse'],

  tools: [
    {
      name: 'read_url',
      description:
        'Читает содержимое веб-страницы по URL и возвращает текст. Используй когда пользователь хочет узнать что на странице, проанализировать статью, или ты хочешь проверить какую-то информацию онлайн.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Полный URL страницы (включая https://)',
          },
          focus: {
            type: 'string',
            description:
              'На что сфокусироваться при чтении. Опционально — без этого вернётся весь текст.',
          },
        },
        required: ['url'],
      },
    },
  ],

  async onToolCall(toolName, args, ctx): Promise<SkillToolResult> {
    if (toolName === 'read_url') {
      const url = args.url as string;
      const focus = args.focus as string | undefined;

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return {
          mode: 'respond',
          response: { error: 'URL должен начинаться с http:// или https://' },
        };
      }

      ctx.emit({ type: 'toast', message: `📖 Читаю: ${new URL(url).hostname}...`, variant: 'default' });

      try {
        // Jina AI Reader — CORS-friendly, бесплатный, не требует ключа
        const jinaUrl = `https://r.jina.ai/${url}`;
        const response = await fetch(jinaUrl, {
          headers: {
            Accept: 'text/plain',
            'X-Return-Format': 'text',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        const trimmed = text.trim();

        if (!trimmed) {
          return {
            mode: 'respond',
            response: { url, error: 'Страница пустая или не удалось извлечь текст' },
          };
        }

        // Обрезаем до ~8000 символов чтобы не перегружать контекст
        const MAX_CHARS = 8000;
        const truncated = trimmed.length > MAX_CHARS;
        const content = truncated ? trimmed.slice(0, MAX_CHARS) + '\n\n[...текст обрезан...]' : trimmed;

        ctx.emit({
          type: 'badge',
          skillId: 'url_reader',
          text: new URL(url).hostname,
          color: '#6366f1',
        });

        return {
          mode: 'respond',
          response: {
            url,
            hostname: new URL(url).hostname,
            content,
            char_count: trimmed.length,
            truncated,
            focus: focus || null,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.emit({ type: 'toast', message: `Ошибка чтения URL: ${message}`, variant: 'error' });
        return {
          mode: 'respond',
          response: { url, error: message },
        };
      }
    }

    return { mode: 'respond', response: { error: 'Unknown tool' } };
  },
};
