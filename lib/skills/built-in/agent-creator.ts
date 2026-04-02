// Agent Creator Skill - создание персонализированных AI агентов

import type { Skill } from '../types';
import { saveAgent, updateAgent, deleteAgent, getAgents } from '@/lib/agents/agent-store';
import type { Agent } from '@/lib/agents/types';
import { nanoid } from 'nanoid';

export const agentCreatorSkill: Skill = {
  id: 'agent-creator',
  name: 'Agent Creator',
  description: 'Создание персонализированных AI агентов с уникальными характеристиками',
  version: '1.0.0',
  icon: '🤖',
  category: 'productivity',
  author: 'Gemini Studio',
  
  tools: [
    {
      name: 'create_agent',
      description: `Создать нового AI агента с уникальной личностью и характеристиками.
      
Когда создавать агента:
- Пользователь просит создать персонажа для общения
- Пользователь говорит "хочу пообщаться с X"
- Пользователь хочет специализированного ассистента

Как писать системный промпт агента:
- Детально опиши характер, личность, манеру общения
- Укажи как агент должен реагировать на разные ситуации
- Пропиши стиль речи (формальный/неформальный, эмоциональный/сдержанный)
- Добавь контекст: кто этот агент, его роль, знания
- Укажи чего агент должен избегать
- Если есть референсные изображения из image memory - используй их ID

После создания агента сразу скажи пользователю: "Агент [имя] создан! Кликай по нему в сайдбаре чтобы начать общение."`,
      
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Имя агента (короткое, запоминающееся)',
          },
          description: {
            type: 'string',
            description: 'Краткое описание агента для отображения в сайдбаре (1-2 предложения)',
          },
          systemPrompt: {
            type: 'string',
            description: 'Полный системный промпт агента с детальным описанием личности, стиля общения, поведения',
          },
          avatarEmoji: {
            type: 'string',
            description: 'Эмодзи для аватара агента (например: 🧑‍💼, 👨‍🎨, 👩‍🔬, 🤖)',
          },
          avatarImageMemoryId: {
            type: 'string',
            description: 'ID изображения из image memory для аватара (опционально)',
          },
          referenceImageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Массив ID изображений из image memory для контекста агента',
          },
          enabledSkillIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Массив ID скиллов которые должны быть доступны агенту',
          },
          model: {
            type: 'string',
            description: 'Модель для агента (например: models/gemini-2.0-flash-exp)',
          },
          temperature: {
            type: 'number',
            description: 'Температура генерации (0.0-2.0, по умолчанию 1.0)',
          },
        },
        required: ['name', 'description', 'systemPrompt', 'avatarEmoji', 'model'],
      },
    },
    
    {
      name: 'update_agent',
      description: 'Обновить существующего агента (изменить характеристики, промпт, настройки)',
      
      parameters: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'ID агента для обновления',
          },
          name: {
            type: 'string',
            description: 'Новое имя агента',
          },
          description: {
            type: 'string',
            description: 'Новое описание',
          },
          systemPrompt: {
            type: 'string',
            description: 'Обновлённый системный промпт',
          },
          avatarEmoji: {
            type: 'string',
            description: 'Новый эмодзи аватара',
          },
          avatarImageMemoryId: {
            type: 'string',
            description: 'Новый ID изображения для аватара',
          },
          referenceImageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Обновлённый массив референсных изображений',
          },
          enabledSkillIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Обновлённый список скиллов',
          },
          model: {
            type: 'string',
            description: 'Новая модель',
          },
          temperature: {
            type: 'number',
            description: 'Новая температура',
          },
        },
        required: ['agent_id'],
      },
    },
    
    {
      name: 'delete_agent',
      description: 'Удалить агента',
      
      parameters: {
        type: 'object',
        properties: {
          agent_id: {
            type: 'string',
            description: 'ID агента для удаления',
          },
          reason: {
            type: 'string',
            description: 'Причина удаления (опционально)',
          },
        },
        required: ['agent_id'],
      },
    },
    
    {
      name: 'list_agents',
      description: 'Получить список всех созданных агентов',
      
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  ],
  
  onSystemPrompt: (context) => {
    const agents = getAgents();
    
    if (agents.length === 0) {
      return `
# Agent Creator

У пользователя пока нет созданных агентов. Ты можешь создать агента когда:
- Пользователь просит персонажа для общения
- Пользователь говорит "хочу пообщаться с X"
- Пользователь хочет специализированного ассистента

При создании агента пиши детальный системный промпт с характером, стилем общения, поведением.
После создания скажи: "Агент [имя] создан! Кликай по нему в сайдбаре."
`;
    }
    
    const agentsList = agents.map(a => 
      `- ${a.name} (${a.id}): ${a.description}`
    ).join('\n');
    
    return `
# Agent Creator

Существующие агенты:
${agentsList}

Ты можешь создавать новых агентов, обновлять или удалять существующих.
При создании пиши детальный системный промпт с характером и поведением.
После создания скажи: "Агент [имя] создан! Кликай по нему в сайдбаре."
`;
  },
  
  onToolCall: async (toolName, args, context) => {
    switch (toolName) {
      case 'create_agent': {
        const {
          name,
          description,
          systemPrompt,
          avatarEmoji,
          avatarImageMemoryId,
          referenceImageIds = [],
          enabledSkillIds = [],
          model,
          temperature = 1.0,
        } = args as {
          name: string;
          description: string;
          systemPrompt: string;
          avatarEmoji: string;
          avatarImageMemoryId?: string;
          referenceImageIds?: string[];
          enabledSkillIds?: string[];
          model: string;
          temperature?: number;
        };
        
        const agent: Agent = {
          id: nanoid(8),
          name,
          description,
          systemPrompt,
          avatarEmoji,
          avatarImageMemoryId,
          referenceImageIds,
          enabledSkillIds,
          model,
          temperature,
          creatorChatId: context.chatId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          starred: false,
        };
        
        saveAgent(agent);
        
        return {
          mode: 'fire_and_forget',
          artifacts: [
            {
              id: `agent_card_${agent.id}`,
              type: 'agent_card',
              label: `Агент: ${agent.name}`,
              data: {
                kind: 'agent',
                agentId: agent.id,
                name: agent.name,
                description: agent.description,
                avatarEmoji: agent.avatarEmoji,
                model: agent.model,
                enabledSkillIds: agent.enabledSkillIds,
              },
            },
          ],
        };
      }
      
      case 'update_agent': {
        const { agent_id, ...updates } = args as {
          agent_id: string;
          [key: string]: any;
        };
        
        updateAgent(agent_id, updates);
        
        return {
          mode: 'fire_and_forget',
          artifacts: [],
        };
      }
      
      case 'delete_agent': {
        const { agent_id } = args as {
          agent_id: string;
          reason?: string;
        };
        
        deleteAgent(agent_id);
        
        return {
          mode: 'fire_and_forget',
          artifacts: [],
        };
      }
      
      case 'list_agents': {
        const agents = getAgents();
        
        return {
          mode: 'respond',
          response: {
            agents: agents.map(a => ({
              id: a.id,
              name: a.name,
              description: a.description,
              model: a.model,
              temperature: a.temperature,
              enabledSkillIds: a.enabledSkillIds,
              createdAt: a.createdAt,
            })),
          },
          artifacts: [],
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  },
};
