// ─────────────────────────────────────────────────────────────────────────────
// Image Context Builder — генерирует список изображений для Gemini
// ─────────────────────────────────────────────────────────────────────────────

import type { Message } from '@/types';

export interface ImageInfo {
  alias: string;
  filename: string;
  id: string;
}

/**
 * Собирает все изображения из истории чата и генерирует для них алиасы.
 * Возвращает массив с информацией о каждом изображении.
 */
export function collectImages(messages: Message[]): ImageInfo[] {
  const images: ImageInfo[] = [];
  
  messages
    .filter(m => m.role === 'user' && m.files && m.files.length > 0)
    .forEach(m => {
      m.files!
        .filter(f => f.mimeType.startsWith('image/'))
        .forEach(f => {
          images.push({
            alias: f.id, // Используем реальный ID файла
            filename: f.name,
            id: f.id
          });
        });
    });
  
  return images;
}

/**
 * Генерирует текстовый блок с информацией об изображениях для system prompt.
 * Если изображений нет — возвращает пустую строку.
 */
export function buildImageContext(messages: Message[]): string {
  const images = collectImages(messages);
  
  if (images.length === 0) return '';
  
  return `

## Available Images

You have access to the following images in this conversation:

${images.map(img => `- **${img.id}**: ${img.filename}`).join('\n')}

When using the zoom_region tool, reference images by their ID (e.g., "${images[0]?.id || 'ph_abc123'}") using the image_id parameter, or by index (0 = most recent) using the deprecated image_index parameter.
`;
}
