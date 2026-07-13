import type { Message } from '@/types';
import { getVisibleMessageText } from '@/lib/gemini';
import {
  buildMemoryFactsBlock,
  buildMemoryInstructionsBlock,
} from '@/lib/memory-prompt';
import { buildSkillsSystemPrompt } from '@/lib/skills';
import { buildImageContext } from '@/lib/image-context';
import { loadRPGProfile, getStyleInjection } from '@/lib/rpg-style-profile';
import { buildFLoveInjection, loadFLoveProfile } from '@/lib/f-love-profile';
import {
  type ContextLayerId,
  type ContextLayersConfig,
  loadContextLayersConfig,
  loadMemoryInstructionsOverride,
  CONTEXT_LAYER_META,
} from '@/lib/context-layers-storage';

export interface ContextLayerPreview {
  id: ContextLayerId;
  label: string;
  description: string;
  content: string;
  enabled: boolean;
  editable: boolean;
  isEmpty: boolean;
  charCount: number;
  link?: string;
}

export interface BuildSystemPromptParams {
  messages: Message[];
  systemPrompt: string;
  chatId?: string | null;
  memoryEnabled: boolean;
  config?: ContextLayersConfig;
  handleSkillEvent: (event: unknown) => void;
  /** DeepThink enhanced prompt — если есть, заменяет базовые слои при enabled */
  deepThinkEnhancedPrompt?: string | null;
  /** RPG injection override (для редактирования в UI) */
  rpgStyleOverride?: string | null;
  /** Image context override */
  imageContextOverride?: string | null;
}

export interface BuiltSystemPrompt {
  text: string;
  layers: ContextLayerPreview[];
  usedMemoryIds: string[];
  usedImageMemoryIds: string[];
  /** Базовый промпт до DeepThink (для анализатора) */
  baseBeforeDeepThink: string;
}

function layerPreview(
  id: ContextLayerId,
  content: string,
  enabled: boolean,
  config: ContextLayersConfig
): ContextLayerPreview {
  const meta = CONTEXT_LAYER_META[id];
  const trimmed = content.trim();
  return {
    id,
    label: meta.label,
    description: meta.description,
    content: trimmed,
    enabled,
    editable: meta.editable,
    isEmpty: !trimmed,
    charCount: trimmed.length,
    link: meta.link,
  };
}

export function buildSystemPromptLayers(params: BuildSystemPromptParams): BuiltSystemPrompt {
  const config = params.config || loadContextLayersConfig();
  const userMessages = params.messages
    .filter(m => m.role === 'user')
    .map(m => getVisibleMessageText(m.parts));

  const customMemoryInstructions = loadMemoryInstructionsOverride();
  const layers: ContextLayerPreview[] = [];
  const stackParts: string[] = [];

  const memInstrEnabled =
    params.memoryEnabled && config.layers.memory_instructions.enabled;
  const memFactsEnabled =
    params.memoryEnabled && config.layers.memory_facts.enabled;

  const { facts, usedMemoryIds, usedImageMemoryIds } = params.memoryEnabled
    ? buildMemoryFactsBlock(userMessages, params.chatId || undefined)
    : { facts: '', usedMemoryIds: [] as string[], usedImageMemoryIds: [] as string[] };

  const hasFacts = Boolean(facts.trim());
  const instrContent =
    memInstrEnabled && (hasFacts || config.alwaysIncludeMemoryInstructions)
      ? buildMemoryInstructionsBlock(customMemoryInstructions)
      : '';

  layers.push(layerPreview('memory_instructions', instrContent, memInstrEnabled, config));
  layers.push(layerPreview('memory_facts', facts, memFactsEnabled, config));

  if (memInstrEnabled && instrContent) stackParts.push(instrContent);
  if (memFactsEnabled && facts) stackParts.push(facts);

  // User system prompt
  const userSysEnabled = config.layers.user_system.enabled;
  const userSysContent = params.systemPrompt.trim();
  layers.push(layerPreview('user_system', userSysContent, userSysEnabled, config));
  if (userSysEnabled && userSysContent) stackParts.push(userSysContent);

  // Skills
  const skillsEnabled = config.layers.skills.enabled;
  const skillsContent = skillsEnabled
    ? buildSkillsSystemPrompt(params.chatId || '', params.messages, params.handleSkillEvent)
    : '';
  layers.push(layerPreview('skills', skillsContent, skillsEnabled, config));
  if (skillsEnabled && skillsContent.trim()) stackParts.push(skillsContent.trim());

  // RPG style + F-Love (personal form preferences)
  const rpgEnabled = config.layers.rpg_style.enabled;
  let rpgContent = '';
  if (rpgEnabled) {
    if (params.rpgStyleOverride !== undefined && params.rpgStyleOverride !== null) {
      rpgContent = params.rpgStyleOverride;
    } else if (config.layers.rpg_style.customText !== null) {
      rpgContent = config.layers.rpg_style.customText;
    } else {
      const rpg = getStyleInjection(loadRPGProfile()) || '';
      // Always merge F-Love style profile (learns from edits/likes/stop)
      const flove = buildFLoveInjection(loadFLoveProfile());
      rpgContent = [rpg, flove].filter(Boolean).join('\n\n');
    }
  }
  layers.push(layerPreview('rpg_style', rpgContent, rpgEnabled, config));
  if (rpgEnabled && rpgContent.trim()) stackParts.push(rpgContent.trim());

  const baseBeforeDeepThink = stackParts.join('\n\n');

  // Image context (added in tool loop — preview here)
  const imageEnabled = config.layers.image_context.enabled;
  let imageContent = '';
  if (imageEnabled) {
    if (params.imageContextOverride !== undefined && params.imageContextOverride !== null) {
      imageContent = params.imageContextOverride;
    } else if (config.layers.image_context.customText !== null) {
      imageContent = config.layers.image_context.customText;
    } else {
      imageContent = buildImageContext(params.messages, params.chatId || undefined);
    }
  }
  layers.push(layerPreview('image_context', imageContent, imageEnabled, config));

  // DeepThink enhanced
  const dtEnabled = config.layers.deepthink_enhanced.enabled;
  const dtContent = params.deepThinkEnhancedPrompt?.trim() || '';
  layers.push(layerPreview('deepthink_enhanced', dtContent, dtEnabled, config));

  let finalText: string;
  if (dtEnabled && dtContent) {
    finalText = dtContent;
    if (imageEnabled && imageContent.trim()) {
      finalText = finalText + imageContent;
    }
  } else {
    finalText = baseBeforeDeepThink;
    if (imageEnabled && imageContent.trim()) {
      finalText = finalText ? finalText + imageContent : imageContent.trim();
    }
  }

  return {
    text: finalText,
    layers,
    usedMemoryIds,
    usedImageMemoryIds,
    baseBeforeDeepThink,
  };
}

export function assembleSystemPromptWithImageContext(
  baseText: string,
  imageContext: string,
  config?: ContextLayersConfig
): string {
  const cfg = config || loadContextLayersConfig();
  if (!cfg.layers.image_context.enabled || !imageContext.trim()) return baseText;
  return baseText + imageContext;
}
