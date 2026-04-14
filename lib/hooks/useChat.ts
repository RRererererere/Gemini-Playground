import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message, SavedChat, ChatTool, OpenFile, FileDiffOp } from '@/types';
import {
  loadSavedChats,
  saveChatToStorage,
  deleteChatFromStorage,
  getActiveChatId,
  setActiveChatId,
  revokePreviewUrls,
} from '@/lib/storage';
import { getVisibleMessageText } from '@/lib/gemini';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateChatTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'Новый чат';
  const text = getVisibleMessageText(firstUser.parts);
  if (!text) return 'Новый чат';
  return text.slice(0, 50).trim() + (text.length > 50 ? '…' : '');
}

type MessagesState = Message[];
type MessagesSetter = React.Dispatch<React.SetStateAction<MessagesState>>;

export interface UseChatReturn {
  savedChats: SavedChat[];
  setSavedChats: React.Dispatch<React.SetStateAction<SavedChat[]>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  chatTitle: string;
  setChatTitle: React.Dispatch<React.SetStateAction<string>>;
  messages: MessagesState;
  setMessages: MessagesSetter;
  messagesRef: React.MutableRefObject<MessagesState>;
  unsaved: boolean;
  setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
  loadChats: () => Promise<SavedChat | null>;
  loadChat: (chat: SavedChat) => any;
  saveChat: (...args: any[]) => Promise<any>;
  deleteChat: (id: string, currentChatId: string | null) => Promise<boolean>;
  clearChat: () => void;
  updateSavedChats: (chats: SavedChat[]) => Promise<void>;
}

export function useChat(): UseChatReturn {
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState('');
  const [messages, setMessages] = useState<MessagesState>([]);
  const [unsaved, setUnsaved] = useState(false);
  const messagesRef = useRef<MessagesState>([]);

  // Keep messagesRef in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Mark unsaved when messages change
  useEffect(() => {
    if (messages.length > 0) setUnsaved(true);
  }, [messages]);

  const markUnsaved = useCallback((msgs: Message[]) => {
    setMessages(msgs);
  }, []);

  // Load saved chats from storage
  const loadChats = useCallback(async () => {
    const chats = await loadSavedChats();
    setSavedChats(chats);

    const activeChatId = getActiveChatId();
    if (activeChatId) {
      const chat = chats.find(c => c.id === activeChatId);
      if (chat) {
        setMessages(chat.messages);
        setCurrentChatId(chat.id);
        setChatTitle(chat.title);
        return chat;
      }
    }
    return null;
  }, []);

  // Load a specific chat - returns chat data for page.tsx to apply
  const loadChat = useCallback((chat: SavedChat) => {
    return {
      messages: chat.messages,
      currentChatId: chat.id,
      chatTitle: chat.title,
      model: chat.model,
      systemPrompt: chat.systemPrompt || '',
      deepThinkSystemPrompt: chat.deepThinkSystemPrompt,
      tools: chat.tools || [],
      temperature: chat.temperature ?? 1.0,
    };
  }, []);

  // Save current chat
  const saveChat = useCallback(async (
    msgs: Message[],
    opts: {
      title?: string;
      model: string;
      systemPrompt: string;
      deepThinkSystemPrompt: string;
      tools: ChatTool[];
      temperature: number;
      currentChatId?: string | null;
      chatTitle?: string;
      savedChats: SavedChat[];
      updateCurrentId?: boolean;
    }
  ) => {
    if (msgs.length === 0) return null;

    const chatId = opts.currentChatId || generateId();
    const chatObj: SavedChat = {
      id: chatId,
      title: opts.title || opts.chatTitle || generateChatTitle(msgs),
      messages: msgs,
      model: opts.model,
      systemPrompt: opts.systemPrompt,
      deepThinkSystemPrompt: opts.deepThinkSystemPrompt,
      tools: opts.tools,
      temperature: opts.temperature,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Если чат уже существует, сохраняем createdAt
    const existing = opts.savedChats.find(c => c.id === chatId);
    if (existing) chatObj.createdAt = existing.createdAt;

    await saveChatToStorage(chatObj);

    // Оптимизация: обновляем savedChats локально
    setSavedChats(prev => {
      const idx = prev.findIndex(c => c.id === chatId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = chatObj;
        return updated;
      }
      return [...prev, chatObj];
    });

    if (opts.updateCurrentId !== false) {
      setCurrentChatId(chatId);
      setActiveChatId(chatId);
      setChatTitle(chatObj.title);
    }

    setUnsaved(false);
    return chatObj;
  }, []);

  // Delete a saved chat
  const deleteChat = useCallback(async (id: string, currentChatId: string | null) => {
    const chat = savedChats.find(c => c.id === id);
    if (chat) {
      const fileIds: string[] = [];
      chat.messages.forEach(msg => {
        if (msg.files) {
          msg.files.forEach(file => {
            fileIds.push(file.id);
          });
        }
      });
      if (fileIds.length > 0) {
        revokePreviewUrls(fileIds);
      }
    }

    await deleteChatFromStorage(id);
    setSavedChats(prev => prev.filter(c => c.id !== id));

    return currentChatId === id; // returns true if current chat was deleted
  }, [savedChats]);

  // Clear chat state (new chat)
  const clearChat = useCallback(() => {
    setMessages([]);
    setCurrentChatId(null);
    setChatTitle('');
    setUnsaved(false);
  }, []);

  // Update saved chats order
  const updateSavedChats = useCallback(async (chats: SavedChat[]) => {
    setSavedChats(chats);
    await Promise.all(chats.map(c => saveChatToStorage(c)));
  }, []);

  return {
    savedChats,
    setSavedChats,
    currentChatId,
    setCurrentChatId,
    chatTitle,
    setChatTitle,
    messages,
    setMessages,
    messagesRef,
    unsaved,
    setUnsaved,
    loadChats,
    loadChat,
    saveChat,
    deleteChat,
    clearChat,
    updateSavedChats,
  };
}
