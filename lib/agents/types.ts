// Agent Creator Types

export interface Agent {
  id: string;                    // nanoid(8)
  name: string;
  description: string;           // краткое, для сайдбара
  systemPrompt: string;          // полный промпт
  avatarEmoji: string;           // 🧑‍💼 fallback
  avatarImageMemoryId?: string;  // ID из image-memory-store
  referenceImageIds: string[];   // другие image memory IDs
  enabledSkillIds: string[];     // ID установленных скиллов
  model: string;                 // какую модель юзать
  temperature: number;
  creatorChatId: string;         // из какого чата создан
  createdAt: number;
  updatedAt: number;
  starred: boolean;              // избранный агент
}
