import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = request.nextUrl.searchParams.get('apiKey');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err?.error?.message || 'Failed to fetch models' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter to text generation models only (not embedding, image, video, audio-only)
    const textModels = (data.models || []).filter((m: any) => {
      const methods: string[] = m.supportedGenerationMethods || [];
      const name: string = m.name || '';
      const displayName: string = (m.displayName || '').toLowerCase();

      // Must support generateContent
      if (!methods.includes('generateContent')) return false;

      // Exclude embedding, image generation, video, TTS models
      if (name.includes('embedding') || name.includes('embed')) return false;
      if (name.includes('imagen')) return false;
      if (name.includes('veo')) return false;
      if (name.includes('lyria')) return false;
      if (displayName.includes('image generation') || displayName.includes('image gen')) return false;

      return true;
    });

    // Sort: latest/stable first
    const sorted = textModels.sort((a: any, b: any) => {
      const priority = (name: string) => {
        if (name.includes('gemini-3')) return 0;
        if (name.includes('gemini-2.5')) return 1;
        if (name.includes('gemini-2.0')) return 2;
        if (name.includes('gemini-1.5')) return 3;
        return 4;
      };
      return priority(a.name) - priority(b.name);
    });

    return NextResponse.json({ models: sorted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Network error' }, { status: 500 });
  }
}
