// ─────────────────────────────────────────────────────────────────────────────
// Image Analyser Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ZoomRegion {
  x1_pct: number; // 0-100
  y1_pct: number; // 0-100
  x2_pct: number; // 0-100
  y2_pct: number; // 0-100
}

export interface ZoomJob {
  imageIndex: number; // 0 = most recent image
  region: ZoomRegion;
  scale: number; // 2-6x
  reason: string;
}

export interface CropResult {
  base64: string;
  mimeType: string;
  originalSize: { width: number; height: number };
  cropSize: { width: number; height: number };
  scaledSize: { width: number; height: number };
  newImageId: string; // ID для кропнутого изображения
}

export interface ImageReference {
  id: string; // 4-char ID
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}
