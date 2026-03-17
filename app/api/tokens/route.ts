import { NextRequest, NextResponse } from 'next/server';

function estimateTokensFromText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function estimateTokensFromInlineData(data: string): number {
  if (!data) return 0;
  const approxBytes = Math.floor((data.length * 3) / 4);
  return Math.max(1, Math.ceil(approxBytes / 4));
}

function estimateTotalTokens(messages: any[], systemInstruction?: string): number {
  let total = estimateTokensFromText(systemInstruction || '');

  for (const message of messages || []) {
    for (const part of message.parts || []) {
      if ('text' in part) {
        total += estimateTokensFromText(part.text || '');
      } else if ('inlineData' in part) {
        total += estimateTokensFromInlineData(part.inlineData?.data || '');
      }
    }
    total += 4;
  }

  return total;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, model, systemInstruction, apiKey } = body;
    const estimatedTokens = estimateTotalTokens(messages, systemInstruction);

    if (!apiKey || !model) {
      return NextResponse.json({ totalTokens: estimatedTokens, estimated: true });
    }

    const modelId = model.startsWith('models/') ? model.slice(7) : model;

    const requestBody: any = {
      contents: messages
        .filter((m: any) => m.parts && m.parts.length > 0)
        .map((m: any) => ({
          role: m.role,
          parts: m.parts.filter((p: any) => {
            // Only include non-empty parts
            if ('text' in p) return p.text && p.text.length > 0;
            if ('inlineData' in p) return p.inlineData?.data;
            return false;
          }),
        }))
        .filter((m: any) => m.parts.length > 0),
    };

    if (systemInstruction && systemInstruction.trim()) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (requestBody.contents.length === 0) {
      return NextResponse.json({ totalTokens: estimatedTokens, estimated: true });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:countTokens?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ totalTokens: estimatedTokens, estimated: true });
    }

    const data = await response.json();
    return NextResponse.json({ totalTokens: data.totalTokens || estimatedTokens, estimated: !data.totalTokens });
  } catch {
    return NextResponse.json({ totalTokens: 0, estimated: true });
  }
}
