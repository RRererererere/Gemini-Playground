import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, model, systemInstruction, apiKey } = body;

    if (!apiKey || !model) {
      return NextResponse.json({ totalTokens: 0 });
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
      return NextResponse.json({ totalTokens: 0 });
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
      return NextResponse.json({ totalTokens: 0 });
    }

    const data = await response.json();
    return NextResponse.json({ totalTokens: data.totalTokens || 0 });
  } catch {
    return NextResponse.json({ totalTokens: 0 });
  }
}
