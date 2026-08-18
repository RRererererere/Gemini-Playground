import type { Message, ChatTool } from '@/types';

export interface ArenaAgent {
  id: string;
  name: string;
  emoji: string;
  color: string;          // hex: '#6366f1'
  model: string;
  providerId: string;
  apiKey: string;         // '' = из глобального пула
  systemPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  isActive: boolean;
  deepThinkEnabled: boolean; // DeepThink per-agent
  // reserved:
  skillIds: string[];
  tools: ChatTool[];
}

export interface ArenaSession {
  id: string;
  title: string;
  systemPrompt?: string;
  agents: ArenaAgent[];
  messages: Message[];            // ОБЫЧНЫЙ Message[] — переиспользуем!
  responseMode: 'auto' | 'manual';
  createdAt: number;
  updatedAt: number;
}

// Набор эмодзи для выбора
export const AGENT_EMOJIS = [
  '🟣', '🔴', '🔵', '🟢', '🟡', '🟠', '⚪', '🩷',
  '🧠', '🎯', '⚡', '🔥', '💎', '🌟', '🎨', '🤖',
  '🦊', '🐺', '🦁', '🦅', '🐲', '🦄', '👾', '🎭',
];

// Набор цветов для агентов
export const AGENT_COLORS = [
  '#6366f1', // indigo
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

export function createDefaultAgent(index: number): ArenaAgent {
  const defaults: Array<{ name: string; emoji: string; prompt: string }> = [
    { name: 'Аналитик', emoji: '🟣', prompt: 'Ты строгий аналитик. Разбираешь тему глубоко и структурированно, приводишь факты и логические аргументы.' },
    { name: 'Скептик', emoji: '🔴', prompt: 'Ты скептик и критик. Ищешь слабые места в аргументах, задаёшь неудобные вопросы, указываешь на подводные камни.' },
    { name: 'Креатив', emoji: '🔵', prompt: 'Ты творческий мыслитель. Предлагаешь нестандартные решения, используешь метафоры и аналогии.' },
    { name: 'Практик', emoji: '🟢', prompt: 'Ты практик. Фокусируешься на конкретных шагах, дедлайнах и реализуемости идей.' },
  ];

  const def = defaults[index % defaults.length];

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: def.name,
    emoji: def.emoji,
    color: AGENT_COLORS[index % AGENT_COLORS.length],
    model: '',  // будет подставлена глобальная модель
    providerId: 'google',
    apiKey: '',
    systemPrompt: def.prompt,
    temperature: 0.8,
    maxOutputTokens: 4096,
    isActive: true,
    deepThinkEnabled: false,
    skillIds: [],
    tools: [],
  };
}
