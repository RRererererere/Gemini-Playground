/**
 * Chat Image Sync
 * 
 * Синхронизирует изображения из чата с универсальным хранилищем
 */

import { saveUniversalImage, hasUniversalImage } from './universal-image-store';
import type { Message } from '@/types';

/**
 * Синхронизирует изображения из сообщения с универсальным хранилищем
 */
export async function syncMessageImages(
  message: Message,
  chatId: string
): Promise<void> {
  if (message.role !== 'user' || !message.files || message.files.length === 0) {
    return;
  }
  
  const imageFiles = message.files.filter(f => f.mimeType.startsWith('image/'));
  
  for (const file of imageFiles) {
    // Проверяем существует ли уже
    if (hasUniversalImage(file.id)) {
      continue;
    }
    
    // Получаем размеры изображения
    let width = 0;
    let height = 0;
    
    try {
      const img = new Image();
      const dataUrl = `data:${file.mimeType};base64,${file.data}`;
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          width = img.width;
          height = img.height;
          resolve(null);
        };
        img.onerror = reject;
        img.src = dataUrl;
      });
    } catch (err) {
      console.warn(`[ChatImageSync] Failed to get dimensions for ${file.id}:`, err);
      // Используем дефолтные значения
      width = 1920;
      height = 1080;
    }
    
    // Сохраняем в универсальное хранилище
    await saveUniversalImage({
      id: file.id,
      source: 'chat',
      base64: file.data,
      mimeType: file.mimeType,
      width,
      height,
      chatId,
      messageId: message.id,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
      },
      // Изображения из чата не имеют TTL — живут пока чат существует
    });
    
    console.log(`[ChatImageSync] Synced image ${file.id} from message ${message.id}`);
  }
}

/**
 * Синхронизирует все изображения из истории чата
 */
export async function syncChatHistory(
  messages: Message[],
  chatId: string
): Promise<void> {
  for (const message of messages) {
    await syncMessageImages(message, chatId);
  }
}
