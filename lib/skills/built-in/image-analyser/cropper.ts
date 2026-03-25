// ─────────────────────────────────────────────────────────────────────────────
// Canvas-based image cropping and scaling (browser-only)
// ─────────────────────────────────────────────────────────────────────────────

import type { ZoomRegion, CropResult } from './types';

/**
 * Generate 4-character image ID
 */
function generateImageId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Crop and scale a region from base64 image
 * @param base64 - Clean base64 string (no data: prefix)
 * @param mimeType - Image MIME type
 * @param region - Region in percentages (0-100)
 * @param scale - Upscale factor (2-6x)
 */
export async function cropAndScale(
  base64: string,
  mimeType: string,
  region: ZoomRegion,
  scale: number
): Promise<CropResult> {
  // Load image
  const img = new Image();
  img.src = `data:${mimeType};base64,${base64}`;
  await img.decode();

  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  // Convert percentages to pixels
  const cropX = Math.round((region.x1_pct / 100) * originalWidth);
  const cropY = Math.round((region.y1_pct / 100) * originalHeight);
  const cropW = Math.round(((region.x2_pct - region.x1_pct) / 100) * originalWidth);
  const cropH = Math.round(((region.y2_pct - region.y1_pct) / 100) * originalHeight);

  // Validate crop dimensions
  if (cropW <= 0 || cropH <= 0) {
    throw new Error('Invalid crop region: width or height is zero or negative');
  }

  // Create scaled canvas
  const scaledW = Math.round(cropW * scale);
  const scaledH = Math.round(cropH * scale);

  const canvas = new OffscreenCanvas(scaledW, scaledH);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get 2D context from canvas');
  }

  // High-quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw cropped and scaled region
  ctx.drawImage(
    img,
    cropX, cropY, cropW, cropH,  // source rectangle
    0, 0, scaledW, scaledH        // destination rectangle
  );

  // Convert to JPEG blob
  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.92
  });

  // Convert blob to base64
  const resultBase64 = await blobToBase64(blob);

  return {
    base64: resultBase64,
    mimeType: 'image/jpeg',
    originalSize: { width: originalWidth, height: originalHeight },
    cropSize: { width: cropW, height: cropH },
    scaledSize: { width: scaledW, height: scaledH },
    newImageId: generateImageId()
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:...;base64, prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
