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

// ─────────────────────────────────────────────────────────────────────────────
// Annotation Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnnotationType = 'highlight' | 'pointer' | 'warning' | 'success' | 'info';

export type ArrowDirection = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'none';

export interface AnnotationItem {
  x1_pct: number; // 0-100
  y1_pct: number; // 0-100
  x2_pct: number; // 0-100
  y2_pct: number; // 0-100
  label: string; // до 40 символов
  type: AnnotationType;
  arrow_direction?: ArrowDirection;
}

export interface AnnotationResult {
  sourceImageId: string;
  annotations: AnnotationItem[];
}
