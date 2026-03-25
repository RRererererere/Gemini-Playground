// ─────────────────────────────────────────────────────────────────────────────
// Image Analysis Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

import type { Message, AttachedFile, SkillArtifact } from '@/types';

/**
 * ZoomRegion interface - percentage-based coordinates
 */
export interface ZoomRegion {
  x1_pct: number; // 0-100
  y1_pct: number; // 0-100
  x2_pct: number; // 0-100
  y2_pct: number; // 0-100
}

/**
 * Pixel coordinates for overlay positioning
 */
export interface PixelCoordinates {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Find an image in message history by ID or index
 * 
 * @param messages - Array of chat messages
 * @param imageIdentifier - Image ID (string) or index (number)
 * @returns AttachedFile if found, null otherwise
 */
export function findImageInMessages(
  messages: readonly Message[],
  imageIdentifier: string | number
): AttachedFile | null {
  // Step 1: Collect all images from user messages
  const allImages: AttachedFile[] = [];
  
  for (const message of messages) {
    if (message.role === 'user' && message.files) {
      for (const file of message.files) {
        if (file.mimeType.startsWith('image/')) {
          allImages.push(file);
        }
      }
    }
  }
  
  // Reverse to get most recent first
  allImages.reverse();
  
  // Step 2: Try to match by ID or alias
  if (typeof imageIdentifier === 'string') {
    // Try direct file ID match
    for (const image of allImages) {
      if (image.id === imageIdentifier) {
        return image;
      }
    }
    
    // Try alias match (img_1, img_2, etc.)
    const aliasMatch = imageIdentifier.match(/^img_(\d+)$/);
    if (aliasMatch) {
      const index = parseInt(aliasMatch[1], 10) - 1;
      if (index >= 0 && index < allImages.length) {
        return allImages[index];
      }
    }
  } else if (typeof imageIdentifier === 'number') {
    // Legacy index-based lookup
    if (imageIdentifier >= 0 && imageIdentifier < allImages.length) {
      return allImages[imageIdentifier];
    }
  }
  
  // Not found
  return null;
}

/**
 * Create a data URL from an AttachedFile or SkillArtifact
 * 
 * @param source - AttachedFile or SkillArtifact
 * @returns Data URL string or regular URL
 */
export function createImageDataURL(source: AttachedFile | SkillArtifact): string {
  // Handle AttachedFile
  if ('mimeType' in source && 'data' in source && typeof source.data === 'string') {
    const file = source as AttachedFile;
    if (file.previewUrl) {
      return file.previewUrl;
    }
    return `data:${file.mimeType};base64,${file.data}`;
  }
  
  // Handle SkillArtifact
  const artifact = source as SkillArtifact;
  if (artifact.data.kind === 'base64') {
    return `data:${artifact.data.mimeType};base64,${artifact.data.base64}`;
  } else if (artifact.data.kind === 'url') {
    return artifact.data.url;
  }
  
  return '';
}

/**
 * Calculate pixel coordinates from percentage-based region
 * 
 * @param region - Percentage-based zoom region
 * @param imageWidth - Actual image width in pixels
 * @param imageHeight - Actual image height in pixels
 * @returns Pixel coordinates for overlay positioning
 */
export function calculateHighlightPosition(
  region: ZoomRegion,
  imageWidth: number,
  imageHeight: number
): PixelCoordinates {
  // Convert percentages to pixels
  const x1_px = (region.x1_pct / 100) * imageWidth;
  const y1_px = (region.y1_pct / 100) * imageHeight;
  const x2_px = (region.x2_pct / 100) * imageWidth;
  const y2_px = (region.y2_pct / 100) * imageHeight;
  
  // Calculate dimensions
  const width_px = x2_px - x1_px;
  const height_px = y2_px - y1_px;
  
  return {
    left: x1_px,
    top: y1_px,
    width: width_px,
    height: height_px
  };
}

/**
 * Validate zoom region coordinates
 * 
 * @param region - Zoom region to validate
 * @returns true if valid, false otherwise
 */
export function validateZoomRegion(region: ZoomRegion): boolean {
  return (
    region.x1_pct >= 0 && region.x1_pct <= 100 &&
    region.y1_pct >= 0 && region.y1_pct <= 100 &&
    region.x2_pct >= 0 && region.x2_pct <= 100 &&
    region.y2_pct >= 0 && region.y2_pct <= 100 &&
    region.x2_pct > region.x1_pct &&
    region.y2_pct > region.y1_pct
  );
}
