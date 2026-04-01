import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get('apiKey');
  const baseUrl = request.nextUrl.searchParams.get('baseUrl');

  if (!apiKey || !baseUrl) {
    return NextResponse.json({ error: 'Missing apiKey or baseUrl' }, { status: 400 });
  }

  try {
    // Нормализуем baseUrl: убираем trailing slash и trailing /v1
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
    const response = await fetch(`${normalizedBaseUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Failed to fetch models: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // data.data = [ { id: 'gpt-4o', object: 'model', ... } ]
    // Фильтр: исключаем embedding/audio/image модели по id
    const allModels = data.data || [];
    const textModels = allModels.filter((m: any) => {
      const id = m.id.toLowerCase();
      return (
        !id.includes('embed') &&
        !id.includes('tts') &&
        !id.includes('whisper') &&
        !id.includes('dall-e') &&
        !id.includes('davinci-002') && // legacy
        !id.includes('babbage-002')   // legacy
      );
    });

    // Маппинг в UniversalModel (providerId заполняет клиент)
    const models = textModels.map((m: any) => ({
      id: m.id,
      displayName: m.id, // OpenAI не даёт красивые displayName
      providerId: '',     // заполняет клиент
      inputTokenLimit: m.context_window || m.max_tokens,
    }));

    return NextResponse.json({ models });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Network error: ${error.message}` },
      { status: 500 }
    );
  }
}
