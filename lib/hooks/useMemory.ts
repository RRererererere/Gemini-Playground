import { useState, useCallback } from 'react';
import type { Message, MemoryOperation } from '@/types';
import { buildMemoryPrompt, markMemoriesUsed } from '@/lib/memory-prompt';
import { saveMemory, updateMemory, forgetMemory, getMemories } from '@/lib/memory-store';
import {
  saveImageMemory,
  searchImageMemories,
  getImageMemory,
  loadImageMemoryData,
  incrementImageMemoryMentions
} from '@/lib/image-memory-store';
import { collectImages } from '@/lib/image-context';
import { generateImageId } from '@/lib/imageId';

/**
 * Хук для управления памятью (memory + image memory).
 * Предоставляет функции для сохранения, поиска и извлечения воспоминаний.
 */
export function useMemory() {
  const [showMemoryModal, setShowMemoryModal] = useState(false);

  // Build memory prompt for a given message history
  const buildMemoryContext = useCallback(
    (userMessages: string[], chatId?: string, enabled: boolean = true) => {
      return buildMemoryPrompt(userMessages, chatId, enabled);
    },
    []
  );

  // Mark memories as used
  const markUsed = useCallback(
    (memoryIds: string[], imageMemoryIds: string[], chatId?: string) => {
      markMemoriesUsed(memoryIds, imageMemoryIds, chatId);
    },
    []
  );

  // Save a new memory
  const save = useCallback(
    (fact: string, category: any, keywords: string[], confidence: number = 0.5, scope: 'local' | 'global' = 'global', chatId?: string) => {
      return saveMemory({
        fact,
        category,
        keywords,
        confidence,
        scope,
        related_to: [],
      }, chatId);
    },
    []
  );

  // Update an existing memory
  const update = useCallback(
    (id: string, scope: 'local' | 'global', patch: Partial<{ fact: string; confidence: number; keywords: string[]; category: any }>, chatId?: string) => {
      return updateMemory(id, scope, patch, chatId);
    },
    []
  );

  // Forget/delete a memory
  const forget = useCallback(
    (id: string, scope: 'local' | 'global', chatId?: string) => {
      return forgetMemory(id, scope, chatId);
    },
    []
  );

  // Get all memories
  const getAll = useCallback(
    (scope: 'local' | 'global', chatId?: string) => {
      return getMemories(scope, chatId);
    },
    []
  );

  // Image memory operations
  const saveImage = useCallback(
    async (
      base64: string,
      mimeType: string,
      width: number,
      height: number,
      description: string,
      tags: string[],
      entities: string[],
      scope: 'local' | 'global',
      chatId: string,
      messageContext: string
    ) => {
      return saveImageMemory({
        base64,
        mimeType,
        width,
        height,
        description,
        tags,
        entities,
        scope,
        chatId,
        messageContext,
      });
    },
    []
  );

  const searchImages = useCallback(
    (query: string, scope?: 'local' | 'global', limit: number = 10) => {
      return searchImageMemories(query, scope, limit);
    },
    []
  );

  const getImage = useCallback(
    async (id: string) => {
      return getImageMemory(id);
    },
    []
  );

  const loadImageData = useCallback(
    async (id: string) => {
      return loadImageMemoryData(id);
    },
    []
  );

  const incrementImageMentions = useCallback(
    (ids: string[]) => {
      incrementImageMemoryMentions(ids);
    },
    []
  );

  // Save image memory to universal store (for recall)
  const saveToUniversalStore = useCallback(
    async (memoryId: string, base64: string, mimeType: string, width: number, height: number, metadata: any, chatId?: string, messageId?: string) => {
      const { saveUniversalImage } = await import('@/lib/universal-image-store');
      return saveUniversalImage({
        id: memoryId,
        source: 'recalled',
        base64,
        mimeType,
        width,
        height,
        chatId,
        messageId,
        metadata,
      });
    },
    []
  );

  // Collect image aliases from messages
  const collectImageAliases = useCallback((messages: Message[]) => {
    const imageInfos = collectImages(messages);
    const aliases = new Map<string, string>();
    imageInfos.forEach(info => {
      aliases.set(info.alias, info.id);
    });
    return aliases;
  }, []);

  // Generate short alias for image
  const generateAlias = useCallback(() => {
    return generateImageId();
  }, []);

  return {
    showMemoryModal,
    setShowMemoryModal,
    buildMemoryContext,
    markUsed,
    save,
    update,
    forget,
    getAll,
    saveImage,
    searchImages,
    getImage,
    loadImageData,
    incrementImageMentions,
    saveToUniversalStore,
    collectImageAliases,
    generateAlias,
  };
}
