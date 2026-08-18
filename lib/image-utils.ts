// ─────────────────────────────────────────────────────────────────────────────
// Image Utilities — вспомогательные функции для работы с изображениями
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Получает размеры изображения из base64
 */
export async function getImageDimensions(
  base64: string,
  mimeType: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for dimension detection'));
    };
    
    if (base64.startsWith('data:')) {
      img.src = base64;
    } else {
      img.src = `data:${mimeType};base64,${base64}`;
    }
  });
}

/**
 * Конвертирует base64 в Blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const cleanBase64 = base64.replace(/^data:image\/[^;]+;base64,/, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: mimeType });
}

/**
 * Конвертирует Blob в base64
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Убираем data:...;base64, префикс
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Проверяет является ли файл изображением
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Получает расширение файла по MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff'
  };
  
  return map[mimeType] || 'jpg';
}

/**
 * Форматирует размер файла в человекочитаемый формат
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Создаёт data URL из base64 и MIME type
 */
export function createDataUrl(base64: string, mimeType: string): string {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Извлекает чистый base64 из data URL
 */
export function extractBase64(dataUrl: string): string {
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  return dataUrl.split(',')[1];
}
