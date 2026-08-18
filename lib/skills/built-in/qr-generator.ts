import type { Skill } from '../types';

/**
 * QR Code Generator Skill
 * Генерирует QR-коды для текста или URL
 */
export const qrGeneratorSkill: Skill = {
  id: 'qr_generator',
  name: 'QR Generator',
  description: 'Генерирует QR-коды для текста или URL',
  longDescription: 'Создает QR-коды которые можно скачать как изображения. Поддерживает текст, URL, контакты и другие данные.',
  version: '1.0.0',
  icon: '📱',
  category: 'utils',
  author: 'Built-in',
  tags: ['qr', 'code', 'generator', 'image'],

  tools: [
    {
      name: 'generate_qr_code',
      description: 'Генерирует QR-код для текста или URL. Вызывай когда пользователь просит создать QR-код.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Текст или URL для кодирования в QR-код'
          },
          size: {
            type: 'number',
            description: 'Размер QR-кода в пикселях (по умолчанию 256)'
          }
        },
        required: ['content']
      }
    }
  ],

  async onToolCall(toolName, args, ctx) {
    const content = args.content as string;
    const size = (args.size as number) || 256;

    if (!content) {
      return {
        mode: 'respond',
        response: { error: 'Нужен текст для генерации QR-кода' }
      };
    }

    try {
      // Генерируем QR-код через API (используем бесплатный сервис)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(content)}`;

      ctx.emit({
        type: 'toast',
        message: '✅ QR-код сгенерирован!',
        variant: 'success'
      });

      return {
        mode: 'fire_and_forget',
        artifacts: [{
          id: `qr_${Date.now()}`,
          type: 'image',
          label: `QR-код: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
          data: {
            kind: 'url',
            url: qrUrl,
            mimeType: 'image/png'
          },
          downloadable: true,
          filename: 'qr-code.png',
          sendToGemini: false
        }]
      };
    } catch (err) {
      ctx.emit({
        type: 'toast',
        message: `Ошибка генерации QR-кода: ${err}`,
        variant: 'error'
      });

      return {
        mode: 'respond',
        response: { error: String(err) }
      };
    }
  },

  onInstall(ctx) {
    ctx.emit({
      type: 'toast',
      message: '📱 QR Generator установлен!',
      variant: 'success'
    });
  }
};
