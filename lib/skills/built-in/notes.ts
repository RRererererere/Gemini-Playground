import type { Skill, SkillContext, SkillToolResult } from '../types';

// Этот скилл демонстрирует:
// 1. Хранение состояния между сессиями (storage)
// 2. Инжекцию в system prompt (onSystemPrompt)
// 3. fire_and_forget mode
// 4. onInstall hook

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

function getNotes(ctx: SkillContext): Note[] {
  return ctx.storage.getJSON<Note[]>('notes') ?? [];
}

function saveNotes(ctx: SkillContext, notes: Note[]): void {
  ctx.storage.setJSON('notes', notes);
}

export const notesSkill: Skill = {
  id: 'notes',
  name: 'Quick Notes',
  description: 'Постоянное хранилище заметок. AI может сохранять и читать заметки между сессиями.',
  longDescription:
    'Скилл добавляет AI возможность создавать, читать и удалять заметки прямо из чата. Заметки хранятся локально и живут между перезагрузками. AI автоматически видит все заметки через system prompt.',
  version: '1.0.0',
  icon: '📝',
  category: 'productivity',
  author: 'Built-in',
  tags: ['notes', 'memory', 'save', 'storage'],

  onSystemPrompt(ctx: SkillContext): string | null {
    const notes = getNotes(ctx);
    if (notes.length === 0) return null;

    const formatted = notes
      .map(n => `[${n.id}] **${n.title}**\n${n.content}${n.tags.length ? `\nТеги: ${n.tags.join(', ')}` : ''}`)
      .join('\n\n---\n\n');

    return `У пользователя есть ${notes.length} заметок:\n\n${formatted}\n\nТы можешь читать, создавать и удалять заметки через инструменты.`;
  },

  tools: [
    {
      name: 'create_note',
      description: 'Создаёт новую заметку. Fire-and-forget — продолжи ответ сразу после вызова.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Заголовок заметки' },
          content: { type: 'string', description: 'Содержимое заметки' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Теги для организации',
          },
        },
        required: ['title', 'content'],
      },
    },
    {
      name: 'delete_note',
      description: 'Удаляет заметку по ID. Fire-and-forget.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID заметки (берётся из system prompt)' },
        },
        required: ['id'],
      },
    },
    {
      name: 'list_notes',
      description: 'Возвращает список всех заметок.',
      parameters: {
        type: 'object',
        properties: {
          tag_filter: { type: 'string', description: 'Фильтр по тегу (опционально)' },
        },
        required: [],
      },
    },
  ],

  async onToolCall(toolName, args, ctx): Promise<SkillToolResult> {
    if (toolName === 'create_note') {
      const notes = getNotes(ctx);
      const note: Note = {
        id: Math.random().toString(36).slice(2, 8),
        title: args.title as string,
        content: args.content as string,
        tags: (args.tags as string[]) || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      notes.push(note);
      saveNotes(ctx, notes);

      ctx.emit({
        type: 'badge',
        skillId: 'notes',
        text: `${notes.length} заметок`,
        color: '#f59e0b',
      });
      ctx.emit({ type: 'toast', message: `📝 Заметка "${note.title}" сохранена`, variant: 'success' });
      ctx.emit({ type: 'panel_update', skillId: 'notes', data: notes });

      // fire_and_forget — модель продолжает без ответа
      return { mode: 'fire_and_forget' };
    }

    if (toolName === 'delete_note') {
      const notes = getNotes(ctx);
      const id = args.id as string;
      const idx = notes.findIndex(n => n.id === id);

      if (idx === -1) {
        return { mode: 'respond', response: { error: `Заметка ${id} не найдена` } };
      }

      const [removed] = notes.splice(idx, 1);
      saveNotes(ctx, notes);

      ctx.emit({ type: 'toast', message: `🗑️ Заметка "${removed.title}" удалена`, variant: 'default' });
      ctx.emit({ type: 'panel_update', skillId: 'notes', data: notes });

      return { mode: 'fire_and_forget' };
    }

    if (toolName === 'list_notes') {
      const notes = getNotes(ctx);
      const tagFilter = args.tag_filter as string | undefined;

      const filtered = tagFilter
        ? notes.filter(n => n.tags.includes(tagFilter))
        : notes;

      return {
        mode: 'respond',
        response: {
          total: filtered.length,
          notes: filtered.map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: n.tags,
            created: new Date(n.createdAt).toLocaleDateString('ru-RU'),
          })),
        },
      };
    }

    return { mode: 'respond', response: { error: 'Unknown tool' } };
  },

  onInstall(ctx) {
    ctx.emit({
      type: 'toast',
      message: '📝 Quick Notes установлен! AI теперь может создавать заметки.',
      variant: 'success',
    });
  },

  getPanelData(ctx) {
    const notes = getNotes(ctx);
    if (notes.length === 0) return null;
    return {
      title: `Заметки (${notes.length})`,
      items: notes.map(n => ({
        label: n.title,
        value: n.content.slice(0, 60) + (n.content.length > 60 ? '...' : ''),
      })),
    };
  },
};
