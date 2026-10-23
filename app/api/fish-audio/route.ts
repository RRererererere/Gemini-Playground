import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const FISH_TTS_URL = 'https://api.fish.audio/v1/tts';

const MIME_BY_FORMAT: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  opus: 'audio/ogg',
  pcm: 'audio/wav',
};

/**
 * Server-side proxy to Fish Audio TTS (POST https://api.fish.audio/v1/tts).
 * Avoids browser CORS/CSP issues — client sends apiKey in the body.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      apiKey,
      model,
      text,
      referenceId,
      format,
      speed,
      latency,
    } = body as {
      apiKey?: string;
      model?: string;
      text?: string;
      referenceId?: string;
      format?: string;
      speed?: number;
      latency?: string;
    };

    if (!apiKey || !text) {
      return NextResponse.json(
        { error: 'Missing required parameters: apiKey and text' },
        { status: 400 }
      );
    }

    const fmt = format || 'mp3';

    const ttsBody: Record<string, unknown> = {
      text,
      format: fmt,
      normalize: true,
      latency: latency || 'balanced',
    };
    if (referenceId) ttsBody.reference_id = referenceId;
    if (typeof speed === 'number' && speed > 0) ttsBody.prosody = { speed };

    const response = await fetch(FISH_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Модель TTS передаётся заголовком, не в body (спека Fish Audio)
        'model': model || 's2.1-pro',
      },
      body: JSON.stringify(ttsBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      let message = errText;
      try {
        const parsed = JSON.parse(errText);
        message = parsed.message || parsed.detail || errText;
      } catch { /* raw text */ }
      return NextResponse.json(
        { error: `Fish Audio error (${response.status}): ${String(message).slice(0, 500)}` },
        { status: response.status }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = MIME_BY_FORMAT[fmt] || 'audio/mpeg';

    return NextResponse.json({
      base64: buffer.toString('base64'),
      mimeType,
      size: buffer.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: `Server error: ${error.message}` }, { status: 500 });
  }
}
