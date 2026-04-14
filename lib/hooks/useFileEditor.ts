import { useState, useEffect, useCallback } from 'react';
import type { OpenFile, FileDiffOp, AttachedFile } from '@/types';

/**
 * Хук для управления файловым редактором.
 * Синхронизирует openFiles с localStorage (file-editor skill storage).
 */
export function useFileEditor(currentChatId: string | null) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [showFileEditor, setShowFileEditor] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Map<string, FileDiffOp[]>>(new Map());

  // Синхронизация openFiles с file-editor skill storage
  useEffect(() => {
    if (!currentChatId) return;

    // Ключ с привязкой к чату: skill_data_{skillId}_{chatId}_{key}
    const storageKey = `skill_data_file-editor_${currentChatId}_file_editor_open_files`;

    const syncFiles = () => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const files = JSON.parse(stored) as OpenFile[];
          console.log('[FILE EDITOR SYNC] Found files in storage:', files.length, files.map(f => f.name));
          setOpenFiles(prev => {
            // Проверяем, изменились ли файлы
            if (JSON.stringify(prev) !== JSON.stringify(files)) {
              console.log('[FILE EDITOR SYNC] Files changed, updating state');
              if (files.length > 0) {
                setShowFileEditor(true);
                console.log('[FILE EDITOR SYNC] Opening FileEditor');
                if (!activeFileId && files.length > 0) {
                  setActiveFileId(files[0].id);
                  console.log('[FILE EDITOR SYNC] Setting active file:', files[0].id);
                }
              } else {
                // Если файлов нет, закрываем редактор
                setShowFileEditor(false);
                setActiveFileId(null);
              }
              return files;
            }
            return prev;
          });
        } catch (e) {
          console.error('[FILE EDITOR SYNC] Failed to load open files:', e);
        }
      } else {
        // Если нет файлов в storage, очищаем state
        setOpenFiles(prev => {
          if (prev.length > 0) {
            console.log('[FILE EDITOR SYNC] No files in storage, clearing state');
            setShowFileEditor(false);
            setActiveFileId(null);
          }
          return prev.length > 0 ? [] : prev;
        });
      }
    };

    // Синхронизируем сразу
    syncFiles();

    // И каждые 500ms проверяем изменения
    const interval = setInterval(syncFiles, 500);

    return () => clearInterval(interval);
  }, [currentChatId, activeFileId]);

  // Автоматически открываем FileEditor когда прикрепляется code-файл или текстовый файл
  useEffect(() => {
    // Этот эффект будет вызываться извне при изменении сообщений
    // Для этого экспортируем checkFilesForEditor
  }, []);

  const checkFilesForEditor = useCallback((files: AttachedFile[]) => {
    const editableFiles = files.filter(f =>
      (f.mimeType.startsWith('text/') || f.mimeType === 'application/json') &&
      !openFiles.some(of => of.id === f.id)
    );

    if (editableFiles.length > 0) {
      setShowFileEditor(true);
    }
  }, [openFiles]);

  return {
    openFiles,
    setOpenFiles,
    activeFileId,
    setActiveFileId,
    showFileEditor,
    setShowFileEditor,
    pendingEdits,
    setPendingEdits,
    checkFilesForEditor,
  };
}
