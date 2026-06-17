import { NextRequest } from 'next/server';
import { normalizeApiBaseUrl } from '@/lib/api-base-url';
import type { ChatTool, Message, Part, ToolSchemaField } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// ─────────────────────────────────────────────────────────────────────────────
// Schema helpers (mirrors message-converter.ts fieldToJsonSchema)
// ─────────────────────────────────────────────────────────────────────────────

function fieldToJsonSchema(field: ToolSchemaField): Record<string, unknown> {
  const schema: Record<string, unknown> = { type: field.type };
  if (field.description) schema.description = field.description;
  if (field.enumValues?.length) schema.enum = field.enumValues;

  if (field.type === 'object' && field.properties?.length) {
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

function convertToolsToAnthropic(tools: any[]) {
  return tools
    .filter(t => t.name?.trim() && t.description?.trim())
    .map(tool => {
      // Gemini format (parameters is object)
      if (tool.parameters && typeof tool.parameters === 'object' && !Array.isArray(tool.parameters)) {
        return {
          name: tool.name.trim(),
          description: tool.description.trim(),
          input_schema: tool.parameters,
        };
      }

      // ChatTool format (parameters is array)
      const params = Array.isArray(tool.parameters) ? tool.parameters : [];
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const param of params) {
        if (!param.name.trim()) continue;
        properties[param.name.trim()] = fieldToJsonSchema(param);
        if (param.required) required.push(param.name.trim());
      }

      return {
        name: tool.name.trim(),
        description: tool.description.trim(),
        input_schema: {
          type: 'object',
          properties,
          ...(required.length ? { required } : {}),
        },
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Message[] → Anthropic messages[]
// ─────────────────────────────────────────────────────────────────────────────

function convertGeminiToAnthropic(messages: Message[]): any[] {
  const result: any[] = [];

  for (const msg of messages) {
    if (msg.kind === 'bridge_data') continue;

    // Tool responses → user message with tool_result blocks
    if (msg.kind === 'tool_response') {
      if (!msg.toolResponses?.length) continue;

      const toolResultContent = msg.toolResponses.map(tr => ({
        type: 'tool_result',
        tool_use_id: tr.toolCallId || tr.id,
        content: typeof tr.response === 'string' ? tr.response : JSON.stringify(tr.response ?? 'null'),
      }));

      result.push({ role: 'user', content: toolResultContent });
      continue;
    }

    const role = msg.role === 'model' ? 'assistant' : 'user';

    // Collect text (skip thought parts)
    const textParts = msg.parts.filter(
      (p): p is Extract<Part, { text: string }> =>
        'text' in p && Boolean((p as any).text) && !('thought' in p),
    );

    // Collect images
    const imageParts = msg.parts.filter(
      (p): p is Extract<Part, { inlineData: { mimeType: string; data: string } }> =>
        'inlineData' in p,
    );

    // Assistant with tool calls
    if (role === 'assistant' && msg.toolCalls?.length) {
      const content: any[] = [];

      const textStr = textParts.map(p => p.text).join('');
      if (textStr) content.push({ type: 'text', text: textStr });

      for (const tc of msg.toolCalls) {
        if (!tc.name) continue;
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: typeof tc.args === 'string' ? JSON.parse(tc.args || '{}') : (tc.args ?? {}),
        });
      }

      if (content.length) result.push({ role: 'assistant', content });
      continue;
    }

    // Regular message
    if (imageParts.length > 0) {
      const content: any[] = [];

      for (const img of imageParts) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: (img as any).inlineData.mimeType,
            data: (img as any).inlineData.data,
          },
        });
      }

      const textStr = textParts.map(p => p.text).join('');
      if (textStr) content.push({ type: 'text', text: textStr });

      if (content.length) result.push({ role, content });
    } else {
      const textStr = textParts.map(p => p.text).join('');
      if (!textStr && role === 'assistant') continue; // skip empty assistant messages
      result.push({ role, content: textStr });
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      model,
      systemInstruction,
      temperature,
      apiKey,
      baseUrl,
      maxOutputTokens,
      tools,
      memoryTools,
    } = body;

    if (!apiKey || !baseUrl || !model) {
      return errorStream('Missing required parameters: apiKey, baseUrl, and model are required');
    }

    const normalizedBase = normalizeApiBaseUrl(baseUrl);

    const anthropicMessages = convertGeminiToAnthropic(messages);

    if (anthropicMessages.length === 0) {
      return errorStream('No valid messages after conversion');
    }

    const allTools = [
      ...(Array.isArray(tools) ? tools : []),
      ...(Array.isArray(memoryTools) ? memoryTools : []),
    ];
    const anthropicTools = convertToolsToAnthropic(allTools);

    const requestBody: any = {
      model,
      messages: anthropicMessages,
      max_tokens: typeof maxOutputTokens === 'number' ? maxOutputTokens : 8192,
      stream: true,
    };

    if (systemInstruction?.trim()) {
      requestBody.system = systemInstruction.trim();
    }

    if (typeof temperature === 'number') {
      requestBody.temperature = Math.min(temperature, 1.0); // Anthropic max is 1.0
    }

    if (anthropicTools.length > 0) {
      requestBody.tools = anthropicTools;
    }

    const endpoint = normalizedBase + '/messages';
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'interleaved-thinking-2025-05-14',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Anthropic Route] API error:', errorText);
        return errorStream(`API error (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        return errorStream('No response body from API');
      }
    } catch (err: any) {
      console.error('[Anthropic Route] Fetch failed:', err);
      return errorStream(`Failed to connect: ${err.message}`);
    }

    // ── Transform Anthropic SSE → app unified format ──────────────────────────
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const enc = new TextEncoder();

    const send = (payload: Record<string, unknown>) =>
      writer.write(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));

    (async () => {
      type ToolUseAcc = { id: string; name: string; inputRaw: string; index: number };
      const toolAccumulators = new Map<number, ToolUseAcc>();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data);

              // Text delta
              if (chunk.type === 'content_block_delta') {
                if (chunk.delta?.type === 'text_delta' && chunk.delta.text) {
                  await send({ text: chunk.delta.text });
                }
                if (chunk.delta?.type === 'thinking_delta' && chunk.delta.thinking) {
                  await send({ thinking: chunk.delta.thinking });
                }
                if (chunk.delta?.type === 'input_json_delta') {
                  const idx = chunk.index ?? 0;
                  if (toolAccumulators.has(idx)) {
                    toolAccumulators.get(idx)!.inputRaw += chunk.delta.partial_json || '';
                  }
                }
              }

              // Tool use start
              if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
                const cb = chunk.content_block;
                toolAccumulators.set(chunk.index, {
                  id: cb.id || '',
                  name: cb.name || '',
                  inputRaw: '',
                  index: chunk.index,
                });
              }

              // Message stop / delta with stop_reason
              if (
                chunk.type === 'message_delta' &&
                (chunk.delta?.stop_reason === 'tool_use' || chunk.delta?.stop_reason === 'end_turn')
              ) {
                const stopReason = chunk.delta.stop_reason;

                if (toolAccumulators.size > 0) {
                  for (const acc of Array.from(toolAccumulators.values())) {
                    let input: unknown = {};
                    try { input = JSON.parse(acc.inputRaw || '{}'); } catch { input = acc.inputRaw; }
                    await send({
                      functionCall: { id: acc.id, name: acc.name, args: input },
                    });
                  }
                  toolAccumulators.clear();
                }

                await send({ finishReason: stopReason === 'tool_use' ? 'TOOL_CALLS' : 'STOP' });
              }

              if (chunk.type === 'message_stop') {
                if (toolAccumulators.size > 0) {
                  for (const acc of Array.from(toolAccumulators.values())) {
                    let input: unknown = {};
                    try { input = JSON.parse(acc.inputRaw || '{}'); } catch { input = acc.inputRaw; }
                    await send({
                      functionCall: { id: acc.id, name: acc.name, args: input },
                    });
                  }
                  toolAccumulators.clear();
                }
                await send({ finishReason: 'STOP' });
              }
            } catch (parseErr: any) {
              console.error('[Anthropic Route] Failed to parse chunk:', parseErr.message);
            }
          }
        }

        await writer.write(enc.encode('data: [DONE]\n\n'));
      } catch (e: any) {
        console.error('[Anthropic Route] Stream error:', e);
        try {
          await send({ error: e?.message || 'Stream error' });
          await writer.write(enc.encode('data: [DONE]\n\n'));
        } catch {}
      } finally {
        try { await writer.close(); } catch {}
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    return errorStream(`Server error: ${error.message}`);
  }
}

function errorStream(message: string): Response {
  return new Response(
    `data: ${JSON.stringify({ error: message })}\n\ndata: [DONE]\n\n`,
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}
