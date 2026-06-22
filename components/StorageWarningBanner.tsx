'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X, Download, Trash2, Database } from 'lucide-react';
import { getStorageWarning, clearStorageWarning, loadSavedChats, exportChats } from '@/lib/storage';
import { exportFileDatabase, deleteFileDatabase } from '@/lib/fileStorage';

export default function StorageWarningBanner() {
  const [warning, setWarning] = useState<string | null>(null);
  const [dbDeleting, setDbDeleting] = useState(false);

  useEffect(() => {
    const w = getStorageWarning();
    if (w) setWarning(w);
  }, []);

  if (!warning) return null;

  const isCritical = warning === 'critical';

  const handleExport = async () => {
    const chats = await loadSavedChats();
    exportChats(chats);
  };

  const handleExportFilesDB = async () => {
    try {
      await exportFileDatabase();
    } catch {
      // silent — user sees nothing downloaded
    }
  };

  const handleDeleteFilesDB = async () => {
    if (!confirm('Удалить базу данных файлов (изображения, вложения)? Это освободит место, но файлы в чатах исчезнут.')) return;
    setDbDeleting(true);
    try {
      await deleteFileDatabase();
      window.location.reload();
    } catch {
      setDbDeleting(false);
    }
  };

  const handleDismiss = () => {
    clearStorageWarning();
    setWarning(null);
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] px-4 py-3 flex items-start gap-3 text-sm
      ${isCritical ? 'bg-red-900/95' : 'bg-yellow-900/90'} backdrop-blur border-b border-white/10`}>
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-yellow-400" />
      <div className="flex-1">
        <p className="font-medium text-white">
          {isCritical ? 'Критическое переполнение хранилища' : 'Хранилище почти заполнено'}
        </p>
        <p className="text-xs text-white/70 mt-0.5">
          {isCritical
            ? 'Некоторые чаты не сохранились. Экспортируй данные и очисти старые чаты.'
            : warning}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors"
          >
            <Download size={12} />
            Экспорт чатов
          </button>
          <button
            onClick={handleExportFilesDB}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors"
          >
            <Database size={12} />
            Скачать БД файлов
          </button>
          <button
            onClick={() => { localStorage.removeItem('gemini_saved_chats'); handleDismiss(); window.location.reload(); }}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600/80 hover:bg-red-500 rounded-lg text-xs text-white transition-colors"
          >
            <Trash2 size={12} />
            Очистить чаты
          </button>
          <button
            onClick={handleDeleteFilesDB}
            disabled={dbDeleting}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 rounded-lg text-xs text-white transition-colors"
          >
            <Trash2 size={12} />
            {dbDeleting ? 'Удаление...' : 'Удалить БД файлов'}
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-white/50 hover:text-white transition-colors">
        <X size={16} />
      </button>
    </div>
  );
}
