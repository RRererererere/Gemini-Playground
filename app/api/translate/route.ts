import { NextRequest } from 'next/server';
import { translate } from '@vitalets/google-translate-api';

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, to = 'ru' } = body;

    if (!text) {
      return Response.json({ error: 'Text is required' }, { status: 400 });
    }

    const result = await translate(text, { to });

    return Response.json({ 
      translatedText: result.text,
      // Library typings vary by version; keep response stable without relying on optional fields.
      from: (result as any)?.from?.language?.iso || 'unknown',
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    return Response.json({ 
      error: error.message || 'Translation failed' 
    }, { status: 500 });
  }
}
