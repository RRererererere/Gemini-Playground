import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Server-side proxy to the OpenRouter Decisions API (Mercury Decide).
 *
 * POST https://openrouter.ai/api/alpha/decisions
 * Body: { model, state, questions }
 * Auth: Bearer <OpenRouter API key>
 *
 * The Decisions path lives OUTSIDE the /api/v1 prefix used by chat,
 * hence the full absolute URL below.
 */
const OPENROUTER_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      apiKey,
      model,
      state,
      questions,
    } = body as {
      apiKey?: string;
      model?: string;
      state?: unknown;
      questions?: Record<string, unknown>;
    };

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing required parameter: apiKey' }, { status: 400 });
    }
    if (!questions || typeof questions !== 'object' || Object.keys(questions).length === 0) {
      return NextResponse.json({ error: 'Missing required parameter: questions (non-empty map)' }, { status: 400 });
    }

    const response = await fetch(OPENROUTER_DECISIONS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://gemini-studio.app',
        'X-Title': 'Gemini Studio',
      },
      body: JSON.stringify({
        model: model || 'inception/mercury-decide:free',
        state: state ?? '',
        questions,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let message = errText;
      try {
        const parsed = JSON.parse(errText);
        message = parsed.error?.message || parsed.message || parsed.detail || errText;
      } catch { /* raw text */ }
      return NextResponse.json({
        error: `OpenRouter Decisions error (${response.status}): ${String(message).slice(0, 500)}`,
      }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
}
