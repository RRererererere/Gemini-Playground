import type { SavedChat, SavedSystemPrompt, AttachedFile, InlineDataPart, Message, Part } from '@/types';
import { saveFiles, loadFiles } from './fileStorage';

// ====================== FILE HELPERS ======================

// Extract file IDs from messages
function extractFileIds(messages: Message[]): string[] {
  const ids: string[] = [];
  for (const msg of messages) {
    if (msg.files) {
      for (const file of msg.files) {
        ids.push(file.id);
      }
    }
  }
  return ids;
}

// Strip file data before saving to localStorage (save to IndexedDB instead)
async function stripFileData(messages: Message[]): Promise<Message[]> {
  const filesToSave: Array<{ id: string; data: string }> = [];
  
  const stripped = messages.map(msg => {
    if (!msg.files || msg.files.length === 0) return msg;
    
    const strippedFiles = msg.files.map(file => {
      if (file.data) {
        filesToSave.push({ id: file.id, data: file.data });
      }
      // Keep metadata, remove data
      return { ...file, data: '', previewUrl: undefined };
    });

    const strippedParts = msg.parts.filter(part => !('inlineData' in part));

    return { ...msg, files: strippedFiles, parts: strippedParts };
  });
  
  // Save file data to IndexedDB
  if (filesToSave.length > 0) {
    try {
      await saveFiles(filesToSave);
    } catch (err) {
      console.error('Failed to save files to IndexedDB:', err);
    }
  }
  
  return stripped;
}

// Restore file data from IndexedDB
async function restoreFileData(messages: Message[]): Promise<Message[]> {
  const fileIds = extractFileIds(messages);
  if (fileIds.length === 0) return messages;
  
  const fileDataMap = await loadFiles(fileIds);
  
  return messages.map(msg => {
    if (!msg.files || msg.files.length === 0) return msg;
    
    const restoredFiles = msg.files.map(file => {
      const data = fileDataMap.get(file.id) || '';
      return restoreFilePreviewUrl({ ...file, data });
    });

    const inlineParts: InlineDataPart[] = restoredFiles
      .filter(file => file.data)
      .map(file => ({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data,
        },
      }));

    const textAndOtherParts = msg.parts.filter(part => !('inlineData' in part));

    return {
      ...msg,
      files: restoredFiles,
      parts: [...textAndOtherParts, ...inlineParts] as Part[],
    };
  });
}

// Restore previewUrl (object URL) for previewable files from base64 data
function restoreFilePreviewUrl(file: AttachedFile): AttachedFile {
  const canPreviewInline =
    file.mimeType.startsWith('image/') ||
    file.mimeType === 'application/pdf';

  if (canPreviewInline && file.data && !file.previewUrl) {
    try {
      const blob = base64ToBlob(file.data, file.mimeType);
      return { ...file, previewUrl: URL.createObjectURL(blob) };
    } catch {
      return file;
    }
  }
  return file;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}

// ====================== СОХРАНЁННЫЕ ЧАТЫ ======================

const CHATS_KEY = 'gemini_saved_chats';
const ACTIVE_CHAT_KEY = 'gemini_active_chat_id';

export async function loadSavedChats(): Promise<SavedChat[]> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    if (!raw) return [];
    const chats = JSON.parse(raw) as SavedChat[];
    
    // Restore file data from IndexedDB
    const restored = await Promise.all(
      chats.map(async chat => ({
        ...chat,
        messages: await restoreFileData(chat.messages),
      }))
    );
    
    return restored;
  } catch {
    return [];
  }
}

export async function saveChatToStorage(chat: SavedChat): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Strip file data and save to IndexedDB
  const strippedMessages = await stripFileData(chat.messages);
  const strippedChat = { ...chat, messages: strippedMessages };
  
  const chats = await loadSavedChatsSync(); // Load without file data
  const idx = chats.findIndex(c => c.id === chat.id);
  if (idx >= 0) {
    chats[idx] = strippedChat;
  } else {
    chats.unshift(strippedChat);
  }
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
}

// Sync version without file data restoration (for internal use)
function loadSavedChatsSync(): SavedChat[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedChat[];
  } catch {
    return [];
  }
}

export async function deleteChatFromStorage(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const chats = loadSavedChatsSync();
  const chat = chats.find(c => c.id === id);
  
  // Delete associated files from IndexedDB
  if (chat) {
    const fileIds = extractFileIds(chat.messages);
    if (fileIds.length > 0) {
      const { deleteFileData } = await import('./fileStorage');
      await Promise.all(fileIds.map(fid => deleteFileData(fid)));
    }
  }
  
  const filtered = chats.filter(c => c.id !== id);
  localStorage.setItem(CHATS_KEY, JSON.stringify(filtered));
}

export function getActiveChatId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_CHAT_KEY);
}

export function setActiveChatId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(ACTIVE_CHAT_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
}

// Экспорт чатов в JSON файл
export function exportChats(chats: SavedChat[]): void {
  const data = JSON.stringify({ version: 1, exportedAt: Date.now(), chats }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gemini-studio-chats-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Экспорт одного чата
export function exportSingleChat(chat: SavedChat): void {
  const data = JSON.stringify({ version: 1, exportedAt: Date.now(), chats: [chat] }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${chat.title.replace(/[^a-z0-9а-яё]/gi, '_').slice(0, 50)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Импорт чатов из JSON файла (Gemini Studio формат)
export async function importChatsFromFile(file: File): Promise<SavedChat[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        if (raw.chats && Array.isArray(raw.chats)) {
          // Restore file data (will be saved to IndexedDB when chat is saved)
          const chats = await Promise.all(
            (raw.chats as SavedChat[]).map(async chat => ({
              ...chat,
              messages: await restoreFileData(chat.messages),
            }))
          );
          resolve(chats);
        } else {
          reject(new Error('Неверный формат файла'));
        }
      } catch {
        reject(new Error('Не удалось разобрать JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsText(file, 'utf-8');
  });
}

// ====================== ИМПОРТ GOOGLE AI STUDIO ======================

interface GeminiStudioChunk {
  text?: string;
  role: 'user' | 'model';
  tokenCount?: number;
  isThought?: boolean;
  finishReason?: string;
  parts?: Array<{ text?: string; thought?: boolean }>;
  driveImage?: { id: string };
}

interface GeminiStudioFormat {
  runSettings?: {
    temperature?: number;
    model?: string;
    thinkingBudget?: number;
  };
  systemInstruction?: { text?: string; parts?: Array<{ text: string }> };
  chunkedPrompt?: {
    chunks?: GeminiStudioChunk[];
    pendingInputs?: GeminiStudioChunk[];
  };
}

// Глобальный счётчик для гарантии уникальности ID при импорте
let _importCounter = 0;
function importId(): string {
  return `import_${Date.now()}_${++_importCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

export function importFromGoogleStudio(file: File): Promise<Partial<SavedChat>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as GeminiStudioFormat;
        const chunks = raw.chunkedPrompt?.chunks || [];
        const pending = raw.chunkedPrompt?.pendingInputs || [];

        const allChunks = [...chunks, ...pending];

        // Группировать подряд идущие "мышления" с ответами
        const messages: import('@/types').Message[] = [];
        let i = 0;

        while (i < allChunks.length) {
          const chunk = allChunks[i];

          // Пропускаем driveImage (нет данных для нас)
          if (chunk.driveImage) { i++; continue; }

          if (chunk.role === 'user') {
            const text = chunk.text || '';
            if (text) {
              messages.push({
                id: importId(),
                role: 'user',
                parts: [{ text }],
              });
            }
            i++;
          } else if (chunk.role === 'model') {
            // Собираем все подряд идущие model-чанки (thinking + ответ)
            let thinkingText = '';
            let responseText = '';
            let finishReason = '';

            while (i < allChunks.length && allChunks[i].role === 'model') {
              const c = allChunks[i];
              if (c.isThought || c.parts?.some(p => p.thought)) {
                thinkingText += c.text || '';
              } else {
                responseText += c.text || '';
                if (c.finishReason) finishReason = c.finishReason;
              }
              i++;
            }

            if (responseText || thinkingText) {
              messages.push({
                id: importId(),
                role: 'model',
                parts: responseText ? [{ text: responseText }] : [{ text: '' }],
                thinking: thinkingText || undefined,
                finishReason: finishReason || undefined,
              });
            }
          } else {
            i++;
          }
        }

        // Системный промпт
        let systemPrompt = '';
        if (raw.systemInstruction) {
          systemPrompt = raw.systemInstruction.text ||
            raw.systemInstruction.parts?.map(p => p.text).join('\n') || '';
        }

        const result: Partial<SavedChat> = {
          id: `gs_${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, '') || 'Импорт из Google Studio',
          messages,
          model: raw.runSettings?.model || '',
          systemPrompt,
          temperature: raw.runSettings?.temperature ?? 1.0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        resolve(result);
      } catch (err: any) {
        reject(new Error('Не удалось импортировать: ' + (err.message || 'неверный формат')));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsText(file, 'utf-8');
  });
}

// ====================== СИСТЕМНЫЕ ПРОМПТЫ ======================

const SYSTEM_PROMPTS_KEY = 'gemini_system_prompts';
const DEEPTHINK_SYSTEM_PROMPT_KEY = 'gemini_deepthink_system_prompt';

export function loadSystemPrompts(): SavedSystemPrompt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYSTEM_PROMPTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedSystemPrompt[];
  } catch {
    return [];
  }
}

export function saveSystemPrompts(prompts: SavedSystemPrompt[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYSTEM_PROMPTS_KEY, JSON.stringify(prompts));
}

export function createSystemPrompt(name: string, content: string): SavedSystemPrompt {
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name,
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function cloneSystemPrompt(prompt: SavedSystemPrompt): SavedSystemPrompt {
  return {
    ...prompt,
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    name: prompt.name + ' (копия)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function loadDeepThinkSystemPrompt(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(DEEPTHINK_SYSTEM_PROMPT_KEY) || '';
}

export function saveDeepThinkSystemPrompt(prompt: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEEPTHINK_SYSTEM_PROMPT_KEY, prompt);
}

// ====================== ПОЛНЫЙ ЭКСПОРТ/ИМПОРТ НАСТРОЕК ======================

export function exportAllSettings(): void {
  if (typeof window === 'undefined') return;
  const data = {
    version: 1,
    exportedAt: Date.now(),
    keys: localStorage.getItem('gemini_api_keys') || '[]',
    chats: localStorage.getItem(CHATS_KEY) || '[]',
    prompts: localStorage.getItem(SYSTEM_PROMPTS_KEY) || '[]',
    model: localStorage.getItem('gemini_model') || '',
    temperature: localStorage.getItem('gemini_temperature') || '1',
    thinkingBudget: localStorage.getItem('gemini_thinking_budget') || '-1',
    systemPrompt: localStorage.getItem('gemini_sys_prompt') || '',
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gemini-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAllSettings(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        if (raw.version && raw.exportedAt) {
          if (raw.keys) localStorage.setItem('gemini_api_keys', raw.keys);
          if (raw.chats) {
            // Restore file data before saving
            try {
              const chats = JSON.parse(raw.chats) as SavedChat[];
              const restored = await Promise.all(
                chats.map(async chat => ({
                  ...chat,
                  messages: await restoreFileData(chat.messages),
                }))
              );
              // Save each chat (will strip and save to IndexedDB)
              for (const chat of restored) {
                await saveChatToStorage(chat);
              }
            } catch {
              localStorage.setItem(CHATS_KEY, raw.chats);
            }
          }
          if (raw.prompts) localStorage.setItem(SYSTEM_PROMPTS_KEY, raw.prompts);
          if (raw.model) localStorage.setItem('gemini_model', raw.model);
          if (raw.temperature) localStorage.setItem('gemini_temperature', raw.temperature);
          if (raw.thinkingBudget) localStorage.setItem('gemini_thinking_budget', raw.thinkingBudget);
          if (raw.systemPrompt) localStorage.setItem('gemini_sys_prompt', raw.systemPrompt);
          
          window.location.reload();
          resolve();
        } else {
          reject(new Error('Неверный формат файла бекапа'));
        }
      } catch {
        reject(new Error('Не удалось прочитать JSON бекапа'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsText(file, 'utf-8');
  });
}
