import { useState, useEffect, useCallback, useRef } from 'react';
import type { OpenFile, FileDiffOp, AttachedFile } from '@/types';
import {
  getSnapshot,
  subscribeFileEditor,
  resolveEditorChatId,
  openEditableAttachments,
  acceptFileEdits,
  rejectFileEdits,
  setManualContent,
  removeOpenFile,
  revertFileToOriginal,
  isEditableFile,
  setOpenFiles as bridgeSetOpenFiles,
  setPendingEditsMap,
  getPendingEditsMap,
  type FileEditorSnapshot,
} from '@/lib/file-editor-bridge';

/**
 * React-хук поверх file-editor-bridge.
 * Мгновенная синхронизация через события (без polling).
 */
export function useFileEditor(currentChatId: string | null) {
  const chatKey = resolveEditorChatId(currentChatId);
  const [snapshot, setSnapshot] = useState<FileEditorSnapshot>(() => getSnapshot(chatKey));
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [showFileEditor, setShowFileEditor] = useState(false);
  const activeFileIdRef = useRef<string | null>(null);
  activeFileIdRef.current = activeFileId;

  useEffect(() => {
    const initial = getSnapshot(chatKey);
    setSnapshot(initial);
    if (initial.openFiles.length > 0) {
      setShowFileEditor(true);
      if (!activeFileIdRef.current) {
        setActiveFileId(initial.openFiles[0].id);
      }
    }

    return subscribeFileEditor(chatKey, next => {
      setSnapshot(next);
      if (next.openFiles.length > 0) {
        setShowFileEditor(true);
        setActiveFileId(prev => {
          if (prev && next.openFiles.some(f => f.id === prev)) return prev;
          return next.openFiles[0].id;
        });
      } else {
        setShowFileEditor(false);
        setActiveFileId(null);
      }
    });
  }, [chatKey]);

  const openFiles = snapshot.openFiles;

  const pendingEditsMap = (() => {
    const m = new Map<string, FileDiffOp[]>();
    for (const [k, v] of Object.entries(snapshot.pendingEdits)) m.set(k, v);
    return m;
  })();

  const setOpenFiles = useCallback(
    (updater: OpenFile[] | ((prev: OpenFile[]) => OpenFile[])) => {
      const prev = getSnapshot(chatKey).openFiles;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      bridgeSetOpenFiles(chatKey, next);
    },
    [chatKey]
  );

  const setPendingEdits = useCallback(
    (updater: Map<string, FileDiffOp[]> | ((prev: Map<string, FileDiffOp[]>) => Map<string, FileDiffOp[]>)) => {
      const prevObj = getPendingEditsMap(chatKey);
      const prevMap = new Map(Object.entries(prevObj));
      const next = typeof updater === 'function' ? updater(prevMap) : updater;
      const obj: Record<string, FileDiffOp[]> = {};
      next.forEach((v, k) => {
        obj[k] = v;
      });
      setPendingEditsMap(chatKey, obj);
    },
    [chatKey]
  );

  const checkFilesForEditor = useCallback(
    async (files: AttachedFile[]) => {
      const editable = files.filter(f => isEditableFile(f.mimeType, f.name));
      if (editable.length === 0) return;

      // Авто-включение скилла, иначе AI не получит tools
      try {
        const { isSkillActive, installSkill } = await import('@/lib/skills/registry');
        if (!isSkillActive('file-editor')) {
          installSkill('file-editor');
        }
      } catch {
        /* ignore */
      }

      const opened = await openEditableAttachments(
        chatKey,
        editable.map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          data: f.data,
        }))
      );
      if (opened.length > 0) {
        setShowFileEditor(true);
        setActiveFileId(opened[0].id);
      }
    },
    [chatKey]
  );

  const acceptEdits = useCallback(
    (fileId: string) => {
      acceptFileEdits(chatKey, fileId);
    },
    [chatKey]
  );

  const rejectEdits = useCallback(
    (fileId: string) => {
      rejectFileEdits(chatKey, fileId);
    },
    [chatKey]
  );

  const manualEdit = useCallback(
    (fileId: string, content: string) => {
      setManualContent(chatKey, fileId, content);
    },
    [chatKey]
  );

  const closeFile = useCallback(
    (fileId: string) => {
      removeOpenFile(chatKey, fileId);
    },
    [chatKey]
  );

  const revertFile = useCallback(
    (fileId: string) => {
      revertFileToOriginal(chatKey, fileId);
    },
    [chatKey]
  );

  return {
    openFiles,
    setOpenFiles,
    activeFileId,
    setActiveFileId,
    showFileEditor,
    setShowFileEditor,
    pendingEdits: pendingEditsMap,
    setPendingEdits,
    checkFilesForEditor,
    acceptEdits,
    rejectEdits,
    manualEdit,
    closeFile,
    revertFile,
    chatKey,
  };
}
