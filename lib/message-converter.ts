/**
 * message-converter.ts
 *
 * Bidirectional converters between the app's internal Gemini-shaped Message[]
 * and the OpenAI ChatCompletionMessageParam[] format.
 *
 * Covers:
 *   • text parts
 *   • inlineData (images) → image_url content parts
 *   • model tool calls  → assistant + tool_calls[]
 *   • tool responses    → role:'tool' messages
 *   • ChatTool[]        → OpenAI Tool[] (function schemas)
 */

import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionContentPart,
} from 'openai/resources/chat/completions';
import type { Message, Part, ChatTool, ToolSchemaField } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function responseToString(response: unknown): string {
  if (response === null || response === undefined) return 'null';
  if (typeof response === 'string') return response;
  return JSON.stringify(response);
}

/**
 * Recursively convert a ToolSchemaField into a JSON-Schema-compatible object
 * that OpenAI function calling accepts.
 */
function fieldToJsonSchema(field: ToolSchemaField): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type: field.type,
  };

  if (field.description) schema.description = field.description;

  if (field.enumValues && field.enumValues.length > 0) {
    schema.enum = field.enumValues;
  }

  if (field.type === 'object' && field.properties && field.properties.length > 0) {
    const props: Record<string, unknown> = {};
    const required: string[] = [];

    for (const prop of field.properties) {
      if (!prop.name.trim()) continue;
      props[prop.name.trim()] = fieldToJsonSchema(prop);
      if (prop.required) required.push(prop.name.trim());
    }

    schema.properties = props;
    if (required.length) schema.required = required;
  }

  if (field.type === 'array' && field.items) {
    schema.items = fieldToJsonSchema(field.items);
  }

  return schema;
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatTool[] → OpenAI Tool[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert the app's ChatTool schema OR Gemini-style tool into OpenAI function-calling format.
 * Handles both formats:
 * - ChatTool with parameters: ToolSchemaField[]
 * - Gemini tool with parameters: { type, properties, required }
 */
export function convertToolsToOpenAI(tools: any[]): ChatCompletionTool[] {
  return tools
    .filter(t => t.name?.trim() && t.description?.trim())
    .map(tool => {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      // ── Handle Gemini format (parameters is an object) ────────────────────
      if (tool.parameters && typeof tool.parameters === 'object' && !Array.isArray(tool.parameters)) {
        // Gemini format: { type: 'object', properties: {...}, required: [...] }
        const geminiParams = tool.parameters;
        
        return {
          type: 'function' as const,
          function: {
            name: tool.name.trim(),
            description: tool.description.trim(),
            parameters: geminiParams, // Use as-is, it's already in JSON Schema format
          },
        };
      }

      // ── Handle ChatTool format (parameters is an array) ───────────────────
      const params = Array.isArray(tool.parameters) ? tool.parameters : [];
      
      for (const param of params) {
        if (!param.name.trim()) continue;
        properties[param.name.trim()] = fieldToJsonSchema(param);
        if (param.required) required.push(param.name.trim());
      }

      return {
        type: 'function' as const,
        function: {
          name: tool.name.trim(),
          description: tool.description.trim(),
          parameters: {
            type: 'object',
            properties,
            ...(required.length ? { required } : {}),
          },
        },
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Message[] → OpenAI ChatCompletionMessageParam[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert the app's internal Gemini-shaped history into OpenAI messages.
 *
 * Mapping rules:
 *   user  message  →  { role: 'user',      content: string | ContentPart[] }
 *   model message  →  { role: 'assistant', content: string | null, tool_calls?: [...] }
 *   tool_response  →  one { role: 'tool', ... } per toolResponse entry
 *
 * Thought parts (thinking tokens) are skipped — OpenAI has no equivalent.
 * bridge_data messages are also skipped.
 */
export function convertGeminiToOpenAI(
  messages: Message[],
  systemInstruction?: string,
): ChatCompletionMessageParam[] {
  const result: ChatCompletionMessageParam[] = [];

  // System prompt
  if (systemInstruction?.trim()) {
    result.push({ role: 'system', content: systemInstruction.trim() });
  }

  for (const msg of messages) {
    // Skip special internal message kinds
    if (msg.kind === 'bridge_data') continue;

    // ── Tool responses ────────────────────────────────────────────────────────
    // In the app, tool responses live in dedicated messages with kind:'tool_response'.
    // OpenAI wants one { role: 'tool' } message per tool result.
    if (msg.kind === 'tool_response') {
      if (!msg.toolResponses?.length) continue;

      for (const tr of msg.toolResponses) {
        result.push({
          role: 'tool',
          tool_call_id: tr.toolCallId || tr.id,
          content: responseToString(tr.response),
        });
      }
      continue;
    }

    const role = msg.role === 'model' ? 'assistant' : 'user';

    // ── Collect text (skip thought parts) ─────────────────────────────────────
    const textContent = msg.parts
      .filter((p): p is Extract<Part, { text: string }> =>
        'text' in p && Boolean(p.text) && !('thought' in p),
      )
      .map(p => p.text)
      .join('');

    // ── Collect images ────────────────────────────────────────────────────────
    const imageParts: ChatCompletionContentPart[] = msg.parts
      .filter((p): p is Extract<Part, { inlineData: { mimeType: string; data: string } }> =>
        'inlineData' in p,
      )
      .map(p => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:${(p as any).inlineData.mimeType};base64,${(p as any).inlineData.data}`,
        },
      }));

    // ── Assistant with tool calls ─────────────────────────────────────────────
    if (role === 'assistant' && msg.toolCalls?.length) {
      const tool_calls = msg.toolCalls
        .filter(tc => tc.name)
        .map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args ?? {}),
          },
        }));

      result.push({
        role: 'assistant',
        // If there's also text alongside tool calls, include it; otherwise null
        content: textContent || null,
        tool_calls: tool_calls.length ? tool_calls : undefined,
      });
      continue;
    }

    // ── Regular user / assistant message ─────────────────────────────────────
    if (imageParts.length > 0) {
      // Mixed content: images + text
      const contentParts: ChatCompletionContentPart[] = [
        ...imageParts,
        { type: 'text' as const, text: textContent },
      ];
      result.push({ role, content: contentParts } as ChatCompletionMessageParam);
    } else {
      // Text only — keep it as a plain string (cheaper, more compatible)
      if (!textContent && role === 'assistant') {
        // Empty assistant message — skip to avoid API errors
        continue;
      }
      result.push({ role, content: textContent } as ChatCompletionMessageParam);
    }
  }

  return result;
}
