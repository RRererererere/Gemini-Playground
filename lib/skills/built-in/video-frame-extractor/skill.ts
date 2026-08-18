import type { Skill, SkillContext, SkillToolResult } from '../../types';
import { generateImageId } from '@/lib/imageId';
import { saveUniversalImage } from '@/lib/universal-image-store';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Video Frame Extractor Skill
// Извлекает кадры из видео для анализа как обычные изображения
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ExtractFrameArgs {
  video_identifier: string; // "video_1", "video_2" или file ID
  timestamp_seconds?: number; // время в секундах (приоритет)
  frame_number?: number; // номер кадра (если timestamp не указан)
  reason: string; // зачем извлекаем этот кадр
}

/**
 * Извлекает кадр из видео используя Canvas API
 */
async function extractVideoFrame(
  videoFile: { data: string; mimeType: string; name: string },
  timestampSeconds?: number,
  frameNumber?: number
): Promise<{ base64: string; width: number; height: number; actualTime: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    
    // Создаем blob URL из base64
    const byteString = atob(videoFile.data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: videoFile.mimeType });
    const url = URL.createObjectURL(blob);
    
    video.src = url;
    
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };
    
    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video'));
    };
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      
      // Определяем время для извлечения кадра
      let targetTime = 0;
      if (timestampSeconds !== undefined) {
        targetTime = Math.max(0, Math.min(timestampSeconds, duration));
      } else if (frameNumber !== undefined) {
        // Предполагаем 30 fps если frame_number указан
        targetTime = Math.max(0, Math.min(frameNumber / 30, duration));
      }
      
      video.currentTime = targetTime;
    };
    
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Конвертируем в base64 (JPEG для меньшего размера)
        const base64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
        
        cleanup();
        resolve({
          base64,
          width: canvas.width,
          height: canvas.height,
          actualTime: video.currentTime,
        });
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
  });
}

/**
 * Находит видео файл по идентификатору
 */
function findVideoFile(
  identifier: string,
  ctx: SkillContext
): { file: any; index: number; alias: string } | null {
  const messages = ctx.messages || [];
  let videoIndex = 0;
  
  for (const msg of messages) {
    if (msg.role !== 'user' || !msg.files) continue;
    
    for (const file of msg.files) {
      if (!file.mimeType.startsWith('video/')) continue;
      
      videoIndex++;
      const alias = `video_${videoIndex}`;
      
      // Проверяем совпадение по alias или file ID
      if (alias === identifier || file.id === identifier) {
        return { file, index: videoIndex, alias };
      }
    }
  }
  
  return null;
}

/**
 * Tool: extract_video_frame
 */
async function handleExtractFrame(
  args: any,
  ctx: SkillContext
): Promise<SkillToolResult> {
  const { video_identifier, timestamp_seconds, frame_number, reason } = args as ExtractFrameArgs;
  
  if (!video_identifier) {
    return {
      mode: 'respond',
      response: { error: 'video_identifier is required' },
    };
  }
  
  if (timestamp_seconds === undefined && frame_number === undefined) {
    return {
      mode: 'respond',
      response: { error: 'Either timestamp_seconds or frame_number must be provided' },
    };
  }
  
  // Находим видео файл
  const videoInfo = findVideoFile(video_identifier, ctx);
  if (!videoInfo) {
    return {
      mode: 'respond',
      response: { error: `Video "${video_identifier}" not found in conversation` },
    };
  }
  
  try {
    // Извлекаем кадр
    const result = await extractVideoFrame(
      videoInfo.file,
      timestamp_seconds,
      frame_number
    );
    
    // Генерируем ID для нового изображения
    const imageId = generateImageId();
    
    // Сохраняем кадр в универсальное хранилище
    await saveUniversalImage({
      id: imageId,
      source: 'video',
      base64: result.base64,
      mimeType: 'image/jpeg',
      width: result.width,
      height: result.height,
      chatId: ctx.chatId,
      metadata: {
        videoSource: videoInfo.file.name,
        videoId: videoInfo.file.id,
        timestamp: result.actualTime,
        frameNumber: Math.round(result.actualTime * 30),
        reason,
      },
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 дней TTL для видео кадров
    });
    
    console.log(`[VideoFrameExtractor] Saved frame ${imageId} from ${videoInfo.file.name} at ${result.actualTime.toFixed(2)}s`);
    
    // Создаем артефакт с извлеченным кадром
    const artifact = {
      id: imageId,
      type: 'image' as const,
      label: `🎬 Frame from ${videoInfo.file.name} at ${result.actualTime.toFixed(2)}s`,
      data: {
        kind: 'base64' as const,
        mimeType: 'image/jpeg',
        base64: result.base64,
      },
      sendToGemini: true, // Автоматически добавляем в контекст для Gemini
      downloadable: true,
      filename: `${videoInfo.file.name.replace(/\.[^.]+$/, '')}_frame_${result.actualTime.toFixed(2)}s.jpg`,
    };
    
    return {
      mode: 'respond',
      response: {
        image_id: imageId,
        video_source: videoInfo.file.name,
        timestamp_seconds: result.actualTime,
        frame_number: Math.round(result.actualTime * 30), // Предполагаем 30 fps
        width: result.width,
        height: result.height,
        reason,
        message: `Extracted frame at ${result.actualTime.toFixed(2)}s from ${videoInfo.file.name}. Image ID: ${imageId}. You can now analyze this frame using image analysis tools (zoom_region, annotate_regions, etc.).`,
      },
      responseParts: [{
        inlineData: {
          mimeType: 'image/jpeg',
          data: result.base64,
        }
      }],
      artifacts: [artifact],
    };
  } catch (err: any) {
    return {
      mode: 'respond',
      response: { error: err.message || 'Failed to extract video frame' },
    };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Skill Definition
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const videoFrameExtractorSkill: Skill = {
  id: 'video-frame-extractor',
  name: 'Video Frame Extractor',
  description: 'Extract frames from videos for detailed analysis',
  version: '1.0.0',
  icon: '🎬',
  category: 'utils',
  
  tools: [
    {
      name: 'extract_video_frame',
      description: `Extract a specific frame from a video file for analysis. The extracted frame becomes a regular image that can be analyzed using image analysis tools (zoom_region, annotate_regions, save_image_memory, etc.).

Use this when:
- User asks about a specific moment in a video
- You need to analyze visual details at a particular timestamp
- User wants to save a frame as an image
- You need to compare frames from different timestamps

The extracted frame will be automatically added to the conversation context and can be referenced by its image_id in subsequent tool calls.`,
      parameters: {
        type: 'object' as const,
        properties: {
          video_identifier: {
            type: 'string' as const,
            description: 'Video identifier (e.g., "video_1", "video_2") or file ID. Videos are numbered in order of appearance in the conversation.',
          },
          timestamp_seconds: {
            type: 'number' as const,
            description: 'Timestamp in seconds to extract the frame from (e.g., 5.5 for 5.5 seconds). Takes priority over frame_number if both are provided.',
          },
          frame_number: {
            type: 'integer' as const,
            description: 'Frame number to extract (assuming 30 fps). Used only if timestamp_seconds is not provided.',
          },
          reason: {
            type: 'string' as const,
            description: 'Brief explanation of why you are extracting this specific frame (e.g., "User asked about the scene at 0:15", "Analyzing the product shown in the middle of the video")',
          },
        },
        required: ['video_identifier', 'reason'],
      },
    },
  ],
  
  async onToolCall(toolName: string, args: Record<string, unknown>, ctx: SkillContext) {
    if (toolName === 'extract_video_frame') {
      return handleExtractFrame(args, ctx);
    }
    
    return {
      mode: 'respond',
      response: { error: `Unknown tool: ${toolName}` },
    };
  },
  
  onSystemPrompt(ctx: SkillContext) {
    // Собираем информацию о видео в чате
    const videos: Array<{ alias: string; name: string; duration?: string }> = [];
    let videoIndex = 0;
    
    for (const msg of ctx.messages) {
      if (msg.role !== 'user' || !msg.files) continue;
      
      for (const file of msg.files) {
        if (file.mimeType.startsWith('video/')) {
          videoIndex++;
          videos.push({
            alias: `video_${videoIndex}`,
            name: file.name,
          });
        }
      }
    }
    
    if (videos.length === 0) return null;
    
    return `
# Video Frame Extraction

You have access to video files in this conversation. You can extract specific frames from videos for detailed analysis.

**Available videos:**
${videos.map(v => `- ${v.alias}: "${v.name}"`).join('\n')}

**How to use:**
1. Call \`extract_video_frame\` with video_identifier and timestamp_seconds (or frame_number)
2. The tool returns an image_id that you can use with image analysis tools
3. You can zoom into regions, annotate, save to memory, etc.

**Example workflow:**
User: "What's happening at 0:15 in the video?"
→ extract_video_frame(video_identifier="video_1", timestamp_seconds=15, reason="User asked about scene at 0:15")
→ Analyze the extracted frame
→ Optionally: zoom_region() for details, annotate_regions() to highlight, save_image_memory() to remember

**Tips:**
- Extract frames at key moments mentioned by the user
- Use multiple extractions to compare different timestamps
- Combine with image analysis tools for detailed examination
- Save important frames to image memory for future reference
`;
  },
};
