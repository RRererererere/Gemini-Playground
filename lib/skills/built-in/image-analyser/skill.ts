// ─────────────────────────────────────────────────────────────────────────────
// Image Analyser Skill — zoom into image regions for detailed analysis
// ─────────────────────────────────────────────────────────────────────────────

import type { Skill, SkillContext, SkillToolResult } from '@/lib/skills/types';
import type { ZoomJob, ZoomRegion } from './types';
import { cropAndScale } from './cropper';
import { loadUniversalImage, hasUniversalImage } from '@/lib/universal-image-store';

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
    },
    {
      name: 'annotate_regions',
      description: `Draw labeled annotations on an image to highlight and explain specific areas.

Use this when you want to SHOW the user something visually rather than just describing it:
- Point to a UI element: "Click here", "This button"
- Identify objects: "This is the CPU", "This is a cat"
- Mark problems: "Error here", "Missing field"
- Highlight regions of interest for explanation
- Create visual guides or tutorials

You can draw multiple annotations simultaneously. Each has a type that changes its visual style:
- highlight: Yellow dashed border — general highlighting
- pointer: Blue solid border with arrow — "click here", "look at this"
- warning: Red solid border with pulse — errors, problems
- success: Green solid border — correct, found, verified
- info: Purple border — informational notes

Each annotation shows a labeled badge at the bottom of the region.`,
      parameters: {
        type: 'object' as const,
        properties: {
          image_id: {
            type: 'string',
            description: 'ID or alias of the image to annotate (e.g., "img_1", "img_2")'
          },
          annotations: {
            type: 'array',
            description: 'Array of annotation regions to draw',
            items: {
              type: 'object',
              properties: {
                x1_pct: {
                  type: 'number',
                  description: 'Left edge (0-100 percent)'
                },
                y1_pct: {
                  type: 'number',
                  description: 'Top edge (0-100 percent)'
                },
                x2_pct: {
                  type: 'number',
                  description: 'Right edge (0-100 percent)'
                },
                y2_pct: {
                  type: 'number',
                  description: 'Bottom edge (0-100 percent)'
                },
                label: {
                  type: 'string',
                  description: 'Text label for this annotation (max 40 characters)'
                },
                type: {
                  type: 'string',
                  enum: ['highlight', 'pointer', 'warning', 'success', 'info'],
                  description: 'Visual style: highlight=yellow, pointer=blue+arrow, warning=red, success=green, info=purple'
                },
                arrow_direction: {
                  type: 'string',
                  enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'none'],
                  description: 'Arrow direction for pointer type (optional, default: none)'
                }
              },
              required: ['x1_pct', 'y1_pct', 'x2_pct', 'y2_pct', 'label', 'type']
            }
          }
        },
        required: ['image_id', 'annotations']
      }
    }
  ],

  async onToolCall(toolName, args, ctx): Promise<SkillToolResult> {
    if (toolName === 'zoom_region') {
      return await handleZoomRegion(args, ctx);
    }
    
    if (toolName === 'annotate_regions') {
      return await handleAnnotateRegions(args, ctx);
    }
    
    return { mode: 'respond', response: { error: 'Unknown tool' } };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Tool Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleZoomRegion(args: any, ctx: SkillContext): Promise<SkillToolResult> {
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

    // Определяем ID изображения
    let imageId: string;
    let imageIdentifier: string;
    
    // Try image_id first (preferred)
    if (args.image_id) {
      imageId = String(args.image_id);
      imageIdentifier = imageId;
      
      // Check if it's an alias (img_1, img_2, etc.)
      const fileId = ctx.imageAliases?.get(imageId);
      if (fileId) {
        imageId = fileId;
      }
    }
    // Fallback to image_index (deprecated)
    else if (args.image_index !== undefined) {
      // Find images in chat history for index lookup
      const images = ctx.messages
        .filter(m => m.role === 'user' && m.files && m.files.length > 0)
        .flatMap(m => m.files!.filter(f => f.mimeType.startsWith('image/')))
        .reverse();
      
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
      imageId = images[index].id;
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
    
    // Проверяем существует ли изображение в универсальном хранилище
    if (!hasUniversalImage(imageId)) {
      const availableAliases = ctx.imageAliases 
        ? Array.from(ctx.imageAliases.keys()).join(', ')
        : 'none';
      return {
        mode: 'respond',
        response: { 
          error: `Image "${imageIdentifier}" not found in storage. Available images: ${availableAliases}` 
        }
      };
    }
    
    // Загружаем изображение из универсального хранилища
    const imageData = await loadUniversalImage(imageId);
    
    if (!imageData) {
      return {
        mode: 'respond',
        response: { error: 'Failed to load image data from storage' }
      };
    }
    
    const base64Data = imageData.base64;
    const mimeType = imageData.image.mimeType;

    // Crop and scale
    const result = await cropAndScale(
      base64Data,
      mimeType,
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

async function handleAnnotateRegions(args: any, ctx: SkillContext): Promise<SkillToolResult> {
  try {
    const imageId = String(args.image_id);
    const annotations = args.annotations as any[];

    if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
      return {
        mode: 'respond',
        response: { error: 'annotations array is required and must not be empty' }
      };
    }

    // Validate each annotation
    for (let i = 0; i < annotations.length; i++) {
      const ann = annotations[i];
      
      // Клампим координаты к 0-100
      const x1 = Math.max(0, Math.min(100, Number(ann.x1_pct)));
      const y1 = Math.max(0, Math.min(100, Number(ann.y1_pct)));
      const x2 = Math.max(0, Math.min(100, Number(ann.x2_pct)));
      const y2 = Math.max(0, Math.min(100, Number(ann.y2_pct)));
      
      if (
        typeof ann.x1_pct !== 'number' || typeof ann.y1_pct !== 'number' ||
        typeof ann.x2_pct !== 'number' || typeof ann.y2_pct !== 'number'
      ) {
        return {
          mode: 'respond',
          response: { error: `Invalid coordinate types in annotation ${i}: all coordinates must be numbers` }
        };
      }

      if (x2 <= x1 || y2 <= y1) {
        return {
          mode: 'respond',
          response: { error: `Invalid coordinates in annotation ${i}: x2 must be > x1 and y2 must be > y1 (after clamping to 0-100)` }
        };
      }

      if (!ann.label || typeof ann.label !== 'string' || ann.label.length > 40) {
        return {
          mode: 'respond',
          response: { error: `Invalid label in annotation ${i}: must be a string with max 40 characters` }
        };
      }

      if (!['highlight', 'pointer', 'warning', 'success', 'info'].includes(ann.type)) {
        return {
          mode: 'respond',
          response: { error: `Invalid type in annotation ${i}: must be one of highlight, pointer, warning, success, info` }
        };
      }
      
      // Обновляем координаты на клампнутые значения
      ann.x1_pct = x1;
      ann.y1_pct = y1;
      ann.x2_pct = x2;
      ann.y2_pct = y2;
    }

    // Определяем ID изображения
    let resolvedImageId = imageId;
    
    // Check if it's an alias
    const fileId = ctx.imageAliases?.get(imageId);
    if (fileId) {
      resolvedImageId = fileId;
    }
    
    // Проверяем существует ли изображение
    if (!hasUniversalImage(resolvedImageId)) {
      const availableAliases = ctx.imageAliases 
        ? Array.from(ctx.imageAliases.keys()).join(', ')
        : 'none';
      return {
        mode: 'respond',
        response: { 
          error: `Image "${imageId}" not found in storage. Available images: ${availableAliases}` 
        }
      };
    }
    
    // Загружаем метаданные для имени файла
    const imageData = await loadUniversalImage(resolvedImageId);
    if (!imageData) {
      return {
        mode: 'respond',
        response: { error: 'Failed to load image metadata' }
      };
    }

    // Create artifact with annotations
    const artifact = {
      id: `annotated_${Date.now()}`,
      type: 'annotated_image' as const,
      label: `📍 Annotated: ${imageId}`,
      data: {
        kind: 'annotations' as const,
        sourceImageId: resolvedImageId,
        annotations: annotations.map(ann => ({
          x1_pct: Number(ann.x1_pct),
          y1_pct: Number(ann.y1_pct),
          x2_pct: Number(ann.x2_pct),
          y2_pct: Number(ann.y2_pct),
          label: String(ann.label),
          type: ann.type,
          arrow_direction: ann.arrow_direction || 'none'
        }))
      }
    };

    return {
      mode: 'respond',
      response: {
        status: 'annotated',
        image: imageId,
        annotationCount: annotations.length
      },
      artifacts: [artifact]
    };

  } catch (error) {
    console.error('[image_analyser] Error in annotate_regions:', error);
    return {
      mode: 'respond',
      response: { 
        error: error instanceof Error ? error.message : 'Unknown error during annotation' 
      }
    };
  }
};

export default SKILL;
