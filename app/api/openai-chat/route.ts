import { NextRequest } from 'next/server';
import { convertGeminiToOpenAI, convertToolsToOpenAI } from '@/lib/message-converter';
import type { ChatTool } from '@/types';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

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
      tools,      // ChatTool[] — user-defined tools
      memoryTools, // ChatTool[] — memory / skill tools (same shape)
    } = body;

    // DEBUG: Log incoming request
    console.log('[OpenAI Route] Request:', {
      model,
      baseUrl,
      messagesCount: messages?.length,
      toolsCount: tools?.length || 0,
      memoryToolsCount: memoryTools?.length || 0,
    });

    if (!apiKey || !baseUrl || !model) {
      return errorStream('Missing required parameters: apiKey, baseUrl, and model are required');
    }

    // ── OpenAI client ─────────────────────────────────────────────────────────
    // CRITICAL: We use raw fetch instead of OpenAI SDK to avoid protocol auto-detection.
    // The SDK automatically detects Claude/Anthropic endpoints and switches to their
    // protocol, but we want pure OpenAI-compatible protocol for all providers.
    
    let normalizedBase = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    
    // Ensure URL ends with /v1 for OpenAI-compatible endpoints
    if (!normalizedBase.endsWith('/v1')) {
      normalizedBase = normalizedBase + '/v1';
    }

    console.log('[OpenAI Route] Base URL:', {
      original: baseUrl,
      normalized: normalizedBase,
    });

    // ── Convert messages ──────────────────────────────────────────────────────
    const oaiMessages = convertGeminiToOpenAI(messages, systemInstruction);
    
    if (oaiMessages.length === 0) {
      return errorStream('No valid messages after conversion');
    }
    
    // Validate that last message is from user (OpenAI requirement)
    const lastMsg = oaiMessages[oaiMessages.length - 1];
    if (lastMsg.role !== 'user') {
      console.warn('[OpenAI Route] Last message is not from user, this may cause issues');
    }

    // ── Convert tools (user tools + memory/skill tools) ────────────────────────
    const allTools: ChatTool[] = [
      ...(Array.isArray(tools) ? tools : []),
      ...(Array.isArray(memoryTools) ? memoryTools : []),
    ];
    const oaiTools = convertToolsToOpenAI(allTools);

    // ── Build request params ───────────────────────────────────────────────────
    const requestBody: any = {
      model,
      messages: oaiMessages,
      temperature: typeof temperature === 'number' ? temperature : 1.0,
      max_tokens: typeof maxOutputTokens === 'number' ? maxOutputTokens : 8192,
      stream: true,
    };
    
    if (oaiTools.length > 0) {
      requestBody.tools = oaiTools;
    }

    // ── Start streaming with raw fetch ────────────────────────────────────────
    const endpoint = normalizedBase + '/chat/completions';
    let response: Response;
    
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://gemini-studio.app',
          'X-Title': 'Gemini Studio',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OpenAI Route] API error:', errorText);
        return errorStream(`API error (${response.status}): ${errorText}`);
      }
      
      if (!response.body) {
        return errorStream('No response body from API');
      }
    } catch (err: any) {
      console.error('[OpenAI Route] Fetch failed:', err);
      return errorStream(`Failed to connect: ${err.message}`);
    }

    // ── Parse SSE stream ──────────────────────────────────────────────────────
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    // ── Transform SSE stream → app's unified format ───────────────────────────
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const enc = new TextEncoder();

    const send = (payload: Record<string, unknown>) =>
      writer.write(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));

    (async () => {
      type ToolCallAcc = {
        id: string;
        name: string;
        argsRaw: string;
        index: number;
      };
      const toolCallAccumulators = new Map<number, ToolCallAcc>();
      let chunkCount = 0;
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
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              continue;
            }

            try {
              const chunk = JSON.parse(data);
              chunkCount++;
              
              // ── Detect format: OpenAI vs Claude ────────────────────────────
              const isClaudeFormat = chunk.type && (
                chunk.type === 'message_start' ||
                chunk.type === 'content_block_start' ||
                chunk.type === 'content_block_delta' ||
                chunk.type === 'content_block_stop' ||
                chunk.type === 'message_delta' ||
                chunk.type === 'message_stop'
              );

              if (isClaudeFormat) {
                // ── Claude Messages API format ────────────────────────────────
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  await send({ text: chunk.delta.text });
                }
                
                // Claude tool use (function calling)
                if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
                  const toolUse = chunk.content_block;
                  if (!toolCallAccumulators.has(chunk.index)) {
                    toolCallAccumulators.set(chunk.index, {
                      id: toolUse.id || '',
                      name: toolUse.name || '',
                      argsRaw: '',
                      index: chunk.index,
                    });
                  }
                }
                
                if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'input_json_delta') {
                  const idx = chunk.index ?? 0;
                  if (toolCallAccumulators.has(idx)) {
                    const acc = toolCallAccumulators.get(idx)!;
                    acc.argsRaw += chunk.delta.partial_json || '';
                  }
                }
                
                if (chunk.type === 'message_delta' && chunk.delta?.stop_reason) {
                  const stopReason = chunk.delta.stop_reason;
                  
                  // Flush tool calls if any
                  if (stopReason === 'tool_use' || toolCallAccumulators.size > 0) {
                    const toolCalls = Array.from(toolCallAccumulators.values());
                    for (const acc of toolCalls) {
                      let args: unknown = {};
                      try {
                        args = JSON.parse(acc.argsRaw || '{}');
                      } catch {
                        args = acc.argsRaw;
                      }
                      await send({
                        functionCall: {
                          id: acc.id,
                          name: acc.name,
                          args,
                        },
                      });
                    }
                    toolCallAccumulators.clear();
                  }
                  
                  await send({ finishReason: stopReason.toUpperCase() });
                }
                
                if (chunk.type === 'message_stop') {
                  await send({ finishReason: 'STOP' });
                }
                
                continue;
              }
              
              // ── OpenAI Chat Completions format ─────────────────────────────
              const choice = chunk.choices?.[0];
              if (!choice) {
                continue;
              }

              const delta = choice.delta;
              const finishReason = choice.finish_reason;

              // ── Text delta ────────────────────────────────────────────────
              if (delta?.content) {
                await send({ text: delta.content });
              }

              // ── Reasoning / thinking ──────────────────────────────────────
              const reasoning = delta?.reasoning_content ?? delta?.thinking;
              if (reasoning) {
                await send({ thinking: reasoning });
              }

              // ── Tool call deltas — accumulate ─────────────────────────────
              if (delta?.tool_calls?.length) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCallAccumulators.has(idx)) {
                    toolCallAccumulators.set(idx, {
                      id: tc.id ?? '',
                      name: tc.function?.name ?? '',
                      argsRaw: '',
                      index: idx,
                    });
                  }
                  const acc = toolCallAccumulators.get(idx)!;
                  if (tc.id) acc.id = tc.id;
                  if (tc.function?.name) acc.name += tc.function.name;
                  if (tc.function?.arguments) acc.argsRaw += tc.function.arguments;
                }
              }

              // ── Finish reason ─────────────────────────────────────────────
              if (finishReason && finishReason !== 'null') {
                // Flush accumulated tool calls
                if (finishReason === 'tool_calls' || toolCallAccumulators.size > 0) {
                  const toolCalls = Array.from(toolCallAccumulators.values());
                  for (const acc of toolCalls) {
                    let args: unknown = {};
                    try {
                      args = JSON.parse(acc.argsRaw || '{}');
                    } catch {
                      args = acc.argsRaw;
                    }
                    await send({
                      functionCall: {
                        id: acc.id,
                        name: acc.name,
                        args,
                      },
                    });
                  }
                  toolCallAccumulators.clear();
                }

                await send({ finishReason: finishReason.toUpperCase() });
              }
            } catch (parseErr: any) {
              console.error('[OpenAI Route] Failed to parse chunk:', parseErr.message);
            }
          }
        }

        await writer.write(enc.encode('data: [DONE]\n\n'));
      } catch (e: any) {
        console.error('[OpenAI Route] Stream error:', e);
        const errMsg = e?.message || 'Stream error';
        try {
          await send({ error: errMsg });
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

// ─────────────────────────────────────────────────────────────────────────────
// Helper: return an immediate SSE error (no streaming)
// ─────────────────────────────────────────────────────────────────────────────
function errorStream(message: string): Response {
  return new Response(
    `data: ${JSON.stringify({ error: message })}\n\ndata: [DONE]\n\n`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );
}
