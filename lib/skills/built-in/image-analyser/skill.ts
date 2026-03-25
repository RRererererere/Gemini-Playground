// ─────────────────────────────────────────────────────────────────────────────
// Image Analyser Skill — zoom into image regions for detailed analysis
// ─────────────────────────────────────────────────────────────────────────────

import type { Skill, SkillContext, SkillToolResult } from '@/lib/skills/types';
import type { ZoomJob, ZoomRegion } from './types';
import { cropAndScale } from './cropper';

const SKILL: Skill = {
  id: 'image_analyser',
  name: '🔍 Image Analyser',
  description: 'Zoom into image regions for detailed analysis',
  longDescription: 'Allows Gemini to zoom into specific regions of images to see fine details like small text, faces, or intricate patterns. Uses percentage-based coordinates for resolution independence.',
  version: '1.0.0',
  icon: '🔍',
  category: 'utils',
  author: 'Built-in',
  tags: ['image', 'vision', 'zoom', 'ocr', 'analysis'],

  tools: [
    {
      name: 'zoom_region',
      description: `FIRE IMMEDIATELY when you need to see details more clearly in an image.

Call this to zoom into a specific rectangular area of an image to analyze fine details like:
- Small text that's hard to read
- Faces or people in the background
- Intricate patterns or textures
- Small objects or details
- Any region that needs closer inspection

Coordinates are in PERCENTAGES (0-100) — resolution independent.
After calling this tool, you WILL receive the zoomed crop and can analyze it in detail.

IMPORTANT: Always call this when user asks about specific parts of an image or when you can't read something clearly.`,
      parameters: {
        type: 'object' as const,
        properties: {
          image_id: {
            type: 'string',
            description: 'ID or alias of the image to zoom (e.g., "img_1", "img_2"). Check "Available Images" section in context for valid aliases.'
          },
          image_index: {
            type: 'number',
            description: '[DEPRECATED] Use image_id instead. Index of image (0 = most recent, 1 = second most recent, etc.)'
          },
          x1_pct: {
            type: 'number',
            description: 'Left edge of region (0-100 percent from left)'
          },
          y1_pct: {
            type: 'number',
            description: 'Top edge of region (0-100 percent from top)'
          },
          x2_pct: {
            type: 'number',
            description: 'Right edge of region (0-100 percent from left)'
          },
          y2_pct: {
            type: 'number',
            description: 'Bottom edge of region (0-100 percent from top)'
          },
          reason: {
            type: 'string',
            description: 'Why you need to zoom this region (e.g., "Need to read text in bottom-right corner")'
          },
          scale: {
            type: 'number',
            description: 'Zoom scale factor (2-6x, default 3). Higher values for smaller details.'
          }
        },
        required: ['x1_pct', 'y1_pct', 'x2_pct', 'y2_pct', 'reason']
      }
    }
  ],

  async onToolCall(toolName, args, ctx): Promise<SkillToolResult> {
    if (toolName !== 'zoom_region') {
      return { mode: 'respond', response: { error: 'Unknown tool' } };
    }

    try {
      // Parse arguments
      const job: ZoomJob = {
        imageIndex: Number(args.image_index ?? 0),
        region: {
          x1_pct: Number(args.x1_pct),
          y1_pct: Number(args.y1_pct),
          x2_pct: Number(args.x2_pct),
          y2_pct: Number(args.y2_pct)
        },
        scale: Number(args.scale ?? 3),
        reason: String(args.reason ?? 'Zoom for analysis')
      };

      // Validate region
      if (
        job.region.x1_pct < 0 || job.region.x1_pct > 100 ||
        job.region.y1_pct < 0 || job.region.y1_pct > 100 ||
        job.region.x2_pct < 0 || job.region.x2_pct > 100 ||
        job.region.y2_pct < 0 || job.region.y2_pct > 100 ||
        job.region.x2_pct <= job.region.x1_pct ||
        job.region.y2_pct <= job.region.y1_pct
      ) {
        return {
          mode: 'respond',
          response: { error: 'Invalid region: coordinates must be 0-100 and x2>x1, y2>y1' }
        };
      }

      // Validate scale
      if (job.scale < 2 || job.scale > 6) {
        return {
          mode: 'respond',
          response: { error: 'Invalid scale: must be between 2 and 6' }
        };
      }

      // Find all images in message history
      const images = ctx.messages
        .filter(m => m.role === 'user' && m.files && m.files.length > 0)
        .flatMap(m => m.files!.filter(f => f.mimeType.startsWith('image/')))
        .reverse(); // Most recent first

      if (images.length === 0) {
        return {
          mode: 'respond',
          response: { error: 'No images found in chat history' }
        };
      }

      // Find target image by ID or index
      let targetImage: typeof images[0] | undefined;
      let imageIdentifier: string;

      // Try image_id first (preferred)
      if (args.image_id) {
        const imageId = String(args.image_id);
        imageIdentifier = imageId;
        
        // Check if it's an alias (img_1, img_2, etc.)
        const fileId = ctx.imageAliases?.get(imageId);
        
        if (fileId) {
          targetImage = images.find(img => img.id === fileId);
        } else {
          // Maybe it's a direct file ID
          targetImage = images.find(img => img.id === imageId);
        }
        
        if (!targetImage) {
          const availableAliases = ctx.imageAliases 
            ? Array.from(ctx.imageAliases.keys()).join(', ')
            : 'none';
          return {
            mode: 'respond',
            response: { 
              error: `Image "${imageId}" not found. Available images: ${availableAliases}` 
            }
          };
        }
      }
      // Fallback to image_index (deprecated)
      else if (args.image_index !== undefined) {
        const index = Number(args.image_index);
        imageIdentifier = `index ${index}`;
        
        if (index >= images.length) {
          return {
            mode: 'respond',
            response: { 
              error: `Image index ${index} out of range (only ${images.length} image(s) available)` 
            }
          };
        }
        targetImage = images[index];
      }
      // No identifier provided
      else {
        return {
          mode: 'respond',
          response: { 
            error: 'Either image_id or image_index must be provided' 
          }
        };
      }

      // Get image data (might be in memory or IndexedDB)
      let base64Data = targetImage.data;
      if (!base64Data) {
        // Try to load from IndexedDB via attachedFiles
        const attachedFile = ctx.attachedFiles.find(f => f.id === targetImage.id);
        if (attachedFile) {
          base64Data = await attachedFile.getData();
        }
      }

      if (!base64Data) {
        return {
          mode: 'respond',
          response: { error: 'Failed to load image data' }
        };
      }

      // Crop and scale
      const result = await cropAndScale(
        base64Data,
        targetImage.mimeType,
        job.region,
        job.scale
      );

      // Prepare response
      const responseData = {
        status: 'zoomed',
        image: imageIdentifier,
        region: job.region,
        originalSize: `${result.originalSize.width}×${result.originalSize.height}px`,
        cropSize: `${result.cropSize.width}×${result.cropSize.height}px`,
        scaledSize: `${result.scaledSize.width}×${result.scaledSize.height}px`,
        scale: `${job.scale}x`,
        reason: job.reason
      };

      // Create artifact for UI preview
      const artifact = {
        id: `zoom_${Date.now()}`,
        type: 'image' as const,
        label: `🔍 Zoomed ×${job.scale} from ${imageIdentifier} — ${job.reason}`,
        data: {
          kind: 'base64' as const,
          mimeType: result.mimeType,
          base64: result.base64
        },
        downloadable: true,
        filename: `zoom_${job.region.x1_pct}-${job.region.y1_pct}_${job.region.x2_pct}-${job.region.y2_pct}.jpg`
      };

      // Return with sibling inlineData for Gemini 2.x
      return {
        mode: 'respond',
        response: responseData,
        responseParts: [
          {
            inlineData: {
              mimeType: result.mimeType,
              data: result.base64
            }
          }
        ],
        artifacts: [artifact]
      };

    } catch (error) {
      console.error('[image_analyser] Error:', error);
      return {
        mode: 'respond',
        response: { 
          error: error instanceof Error ? error.message : 'Unknown error during zoom operation' 
        }
      };
    }
  }
};

export default SKILL;
