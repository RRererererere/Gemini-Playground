import type {
  ChatTool,
  Message,
  Part,
  ThoughtPart,
  ToolResponse,
  ToolSchemaField,
  ToolSchemaType,
} from '@/types';

export const DEFAULT_DEEPTHINK_SYSTEM_PROMPT = `You are the internal strategist and observer.
Read the conversation, think through the user's real intent, and produce a system prompt for the answering model.
Output only the final system prompt after your reasoning.`;

export const DEEPTHINK_MEMORY_MARKER = '[DeepThink context from previous assistant turn]';

export function isThoughtPart(part: Part): part is ThoughtPart {
  return 'thought' in part && part.thought === true;
}

export function getVisibleMessageText(parts: Part[]): string {
  return parts
    .filter(part => 'text' in part && !isThoughtPart(part))
    .map(part => (part as { text: string }).text)
    .join('');
}

export function partToGeminiPart(part: Part) {
  if ('inlineData' in part) {
    return {
      inlineData: {
        mimeType: part.inlineData.mimeType,
        data: part.inlineData.data,
      },
    };
  }

  if (isThoughtPart(part)) {
    return {
      text: part.text,
      thought: true,
      ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
    };
  }

  return { text: part.text };
}

export function buildToolResponsePart(response: ToolResponse) {
  return {
    functionResponse: {
      name: response.name,
      response: normalizeToolResponseInput(response.response),
      ...(response.toolCallId ? { id: response.toolCallId } : {}),
    },
  };
}

export function normalizeToolResponseInput(input: unknown): unknown {
  if (typeof input !== 'string') return input;

  const trimmed = input.trim();
  if (!trimmed) return { result: '' };

  try {
    return JSON.parse(trimmed);
  } catch {
    return { result: trimmed };
  }
}

export function sanitizeToolName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export function sanitizeToolFieldName(value: string): string {
  return sanitizeToolName(value);
}

function createId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createToolSchemaField(overrides: Partial<ToolSchemaField> = {}): ToolSchemaField {
  return {
    id: createId(),
    name: '',
    type: 'string',
    description: '',
    required: false,
    enumValues: [],
    properties: undefined,
    items: null,
    ...overrides,
  };
}

export function createChatTool(): ChatTool {
  return {
    id: createId(),
    name: '',
    description: '',
    parameters: [],
  };
}

type ToolSchema = {
  type: ToolSchemaType;
  description?: string;
  enum?: string[];
  properties?: Record<string, ToolSchema>;
  required?: string[];
  items?: ToolSchema;
};

function fieldToSchema(field: ToolSchemaField): ToolSchema {
  const base: ToolSchema = {
    type: field.type,
  };

  if (field.description?.trim()) base.description = field.description.trim();
  if (field.enumValues?.length) base.enum = field.enumValues.filter(Boolean);

  if (field.type === 'object') {
    const properties = Object.fromEntries(
      (field.properties || [])
        .filter(item => item.name.trim())
        .map(item => [item.name.trim(), fieldToSchema(item)])
    );
    base.properties = properties;
    const required = (field.properties || [])
      .filter(item => item.required && item.name.trim())
      .map(item => item.name.trim());
    if (required.length) base.required = required;
  }

  if (field.type === 'array' && field.items) {
    base.items = fieldToSchema(field.items);
  }

  return base;
}

export function toolToDeclaration(tool: ChatTool) {
  const properties = Object.fromEntries(
    tool.parameters
      .filter(param => param.name.trim())
      .map(param => [param.name.trim(), fieldToSchema(param)])
  );

  const required = tool.parameters
    .filter(param => param.required && param.name.trim())
    .map(param => param.name.trim());

  return {
    name: sanitizeToolName(tool.name),
    description: tool.description.trim(),
    parameters: {
      type: 'object',
      properties,
      ...(required.length ? { required } : {}),
    },
  };
}

export function formatToolPayload(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildChatRequestMessages(messages: Message[]) {
  return messages
    .map(message => {
      // Для bridge_data сообщений создаем специальный формат
      if (message.kind === 'bridge_data' && message.bridgeData) {
        const dataText = JSON.stringify(message.bridgeData.data, null, 2);
        return {
          role: message.role,
          parts: [{
            text: `[🌐 SITE DATA] ${message.bridgeData.eventType}\n\`\`\`json\n${dataText}\n\`\`\``
          }]
        };
      }
      
      const parts: any[] = message.parts
        .filter(part => {
          if ('text' in part) return isThoughtPart(part) || Boolean(part.text);
          if ('inlineData' in part) return Boolean(part.inlineData?.data);
          return false;
        })
        .map(part => partToGeminiPart(part));

      // Добавляем текст аннотаций если есть
      if (message.annotationRefs && message.annotationRefs.length > 0) {
        const annotationsText = message.annotationRefs.map(ref => {
          const region = `${ref.annotation.x1_pct.toFixed(1)}%-${ref.annotation.y1_pct.toFixed(1)}% to ${ref.annotation.x2_pct.toFixed(1)}%-${ref.annotation.y2_pct.toFixed(1)}%`;
          return `@[${ref.annotation.label}] (на изображении "${ref.imageName}", область: ${region})`;
        }).join(', ');
        
        // Находим текстовую часть и добавляем к ней аннотации
        const textPartIndex = parts.findIndex(p => p.text !== undefined);
        if (textPartIndex >= 0) {
          parts[textPartIndex].text = parts[textPartIndex].text 
            ? `${parts[textPartIndex].text}\n\nСсылаюсь на: ${annotationsText}`
            : `Расскажи подробнее про: ${annotationsText}`;
        } else {
          // Если нет текстовой части, добавляем новую
          parts.unshift({ text: `Расскажи подробнее про: ${annotationsText}` });
        }
      }

      for (const toolCall of message.toolCalls || []) {
        parts.push({
          functionCall: {
            id: toolCall.id,
            name: toolCall.name,
            args: toolCall.args,
          },
          ...(toolCall.thought ? { thought: true } : {}),
          ...(toolCall.thoughtSignature ? { thoughtSignature: toolCall.thoughtSignature } : {}),
        });
      }

      for (const toolResponse of message.toolResponses || []) {
        parts.push(buildToolResponsePart(toolResponse));
        // Добавляем sibling parts для Gemini 2.x (например, изображения рядом с functionResponse)
        if (toolResponse.extraParts) {
          for (const extraPart of toolResponse.extraParts) {
            parts.push(extraPart);
          }
        }
      }

      return {
        role: message.role,
        parts,
      };
    })
    .filter(message => message.parts.length > 0);
}
