// ─────────────────────────────────────────────────────────────────────────────
// Image Hashing — Perceptual Hash (pHash) + SHA-256 для дедупликации
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Вычисляет SHA-256 хэш для точного определения дубликатов
 */
export async function computeCryptoHash(base64: string): Promise<string> {
  try {
    // Убираем data:image/...;base64, префикс если есть
    const cleanBase64 = base64.replace(/^data:image\/[^;]+;base64,/, '');
    
    // Конвертируем base64 в Uint8Array
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Вычисляем SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    
    // Конвертируем в hex строку
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Failed to compute crypto hash:', error);
    throw error;
  }
}

/**
 * Вычисляет перцептивный хэш (pHash) для определения похожих изображений
 * Использует DCT-based алгоритм (Discrete Cosine Transform)
 * Возвращает 64-битный хэш как hex-строку (16 символов)
 */
export async function computePerceptualHash(base64: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      
      img.onload = () => {
        try {
          // Шаг 1: Уменьшаем до 32x32
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, 32, 32);
          const imageData = ctx.getImageData(0, 0, 32, 32);
          const pixels = imageData.data;
          
          // Шаг 2: Конвертируем в grayscale
          const gray = new Float64Array(32 * 32);
          for (let i = 0; i < 32 * 32; i++) {
            const r = pixels[i * 4];
            const g = pixels[i * 4 + 1];
            const b = pixels[i * 4 + 2];
            // Стандартная формула luminance
            gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
          }
          
          // Шаг 3: Применяем 2D DCT (упрощённая версия для 32x32)
          const dct = compute2DDCT(gray, 32);
          
          // Шаг 4: Берём верхний левый квадрант 8x8 (без DC компонента)
          const dctLowFreq: number[] = [];
          for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
              dctLowFreq.push(dct[y * 32 + x]);
            }
          }
          
          // Шаг 5: Вычисляем медиану
          const sorted = [...dctLowFreq].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          
          // Шаг 6: Создаём 64-битный хэш (каждый бит = сравнение с медианой)
          let hash = '';
          for (let i = 0; i < 64; i += 4) {
            let nibble = 0;
            for (let j = 0; j < 4 && i + j < 64; j++) {
              if (dctLowFreq[i + j] > median) {
                nibble |= (1 << (3 - j));
              }
            }
            hash += nibble.toString(16);
          }
          
          resolve(hash);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image for hashing'));
      
      // Загружаем изображение
      if (base64.startsWith('data:')) {
        img.src = base64;
      } else {
        img.src = `data:${mimeType};base64,${base64}`;
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Упрощённая 2D DCT для 32x32 изображения
 */
function compute2DDCT(pixels: Float64Array, size: number): Float64Array {
  const dct = new Float64Array(size * size);
  const sqrt2 = Math.sqrt(2);
  const sqrtN = Math.sqrt(size);
  
  for (let v = 0; v < size; v++) {
    for (let u = 0; u < size; u++) {
      let sum = 0;
      
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const pixel = pixels[y * size + x];
          const cosU = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size));
          const cosV = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
          sum += pixel * cosU * cosV;
        }
      }
      
      const cu = u === 0 ? 1 / sqrtN : sqrt2 / sqrtN;
      const cv = v === 0 ? 1 / sqrtN : sqrt2 / sqrtN;
      dct[v * size + u] = cu * cv * sum;
    }
  }
  
  return dct;
}

/**
 * Вычисляет Hamming distance между двумя pHash
 * Возвращает количество различающихся битов (0-64)
 * 0 = идентичные, ≤10 = очень похожие, >10 = разные
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hash lengths must match');
  }
  
  let distance = 0;
  
  for (let i = 0; i < hash1.length; i++) {
    const nibble1 = parseInt(hash1[i], 16);
    const nibble2 = parseInt(hash2[i], 16);
    const xor = nibble1 ^ nibble2;
    
    // Считаем количество единиц в XOR
    let bits = xor;
    while (bits > 0) {
      distance += bits & 1;
      bits >>= 1;
    }
  }
  
  return distance;
}

/**
 * Создаёт thumbnail 80x80 для UI
 */
export async function createThumbnail(
  base64: string,
  mimeType: string,
  size: number = 80
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Вычисляем размеры для cover-fit (заполняем квадрат, обрезая лишнее)
      const scale = Math.max(size / img.width, size / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const offsetX = (size - scaledWidth) / 2;
      const offsetY = (size - scaledHeight) / 2;
      
      ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
      
      // Конвертируем в base64 (JPEG для меньшего размера)
      const thumbnailBase64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(thumbnailBase64);
    };
    
    img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
    
    if (base64.startsWith('data:')) {
      img.src = base64;
    } else {
      img.src = `data:${mimeType};base64,${base64}`;
    }
  });
}
