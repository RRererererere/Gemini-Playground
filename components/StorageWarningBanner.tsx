'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X, Download, Trash2, Database, ScrollText } from 'lucide-react';
import { getStorageWarning, clearStorageWarning, loadSavedChats, exportChats } from '@/lib/storage';
import { exportFileDatabase, deleteFileDatabase } from '@/lib/fileStorage';
import { exportLogs, deleteLogsDatabase, getLogsCount, getStorageEstimate } from '@/lib/logStore';

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function StorageWarningBanner() {
  const [warning, setWarning] = useState<string | null>(null);
  const [dbDeleting, setDbDeleting] = useState(false);
  const [logsCount, setLogsCount] = useState<number>(0);
  const [estimate, setEstimate] = useState<{ usage: number; quota: number; ratio: number } | null>(null);

  useEffect(() => {
    const w = getStorageWarning();
    if (w) { setWarning(w); }

    // Проверка storage estimate — если quota заполнена >85%, показываем предупреждение
    // даже без localStorage-флага, чтобы не потерять данные
    getStorageEstimate().then(est => {
      if (!est.available) return;
      setEstimate({ usage: est.usage, quota: est.quota, ratio: est.ratio });
      if (est.ratio > 0.85 && !w) {
        setWarning('storage_high');
      }
    }).catch(() => {});

    getLogsCount().then(setLogsCount).catch(() => setLogsCount(0));
  }, []);

  // Критический флаг — localStorage-based (старый путь) ИЛИ ratio > 95%
  const isCritical = warning === 'critical' || (estimate?.ratio ?? 0) > 0.95;

  const refreshLogsCount = () => {
    getLogsCount().then(setLogsCount).catch(() => setLogsCount(0));
  };

  if (!warning) return null;

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

  const handleExportLogs = async () => {
    await exportLogs();
    refreshLogsCount();
  };

  const handleDeleteLogs = async () => {
    const msg = logsCount > 0
      ? `Удалить все логи действий (${logsCount} записей)? Это необратимо — сначала экспортируйте, если нужно сохранить.`
      : 'Удалить базу логов? Это необратимо.';
    if (!confirm(msg)) return;
    await deleteLogsDatabase();
    setLogsCount(0);
  };

  const handleDismiss = () => {
    clearStorageWarning();
    setWarning(null);
  };

  const usagePct = estimate ? Math.round(estimate.ratio * 100) : null;
  const title = isCritical
    ? 'Критическое переполнение хранилища'
    : 'Хранилище почти заполнено';
  const subtitle = isCritical
    ? 'Некоторые данные могут не сохраняться. Экспортируй чаты, файлы и логи, затем очисти старое.'
    : warning === 'storage_high' && estimate
      ? `Занято ${formatBytes(estimate.usage)} из ${formatBytes(estimate.quota)} (${usagePct}%). Рекомендуется экспортировать данные.`
      : warning || '';

  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] px-4 py-3 flex items-start gap-3 text-sm
      ${isCritical ? 'bg-red-900/95' : 'bg-yellow-900/90'} backdrop-blur border-b border-white/10`}>
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-yellow-400" />
      <div className="flex-1">
        <p className="font-medium text-white">{title}</p>
        <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>

        {/* Прогресс-бар использования */}
        {estimate && (
          <div className="mt-2 h-1.5 w-full max-w-md rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full ${isCritical ? 'bg-red-500' : 'bg-yellow-500'}`}
              style={{ width: `${Math.min(100, usagePct ?? 0)}%` }}
            />
          </div>
        )}

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
            onClick={handleExportLogs}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-colors"
          >
            <ScrollText size={12} />
            Экспорт логов{logsCount > 0 ? ` (${logsCount})` : ''}
          </button>
          <button
            onClick={handleDeleteLogs}
            className="flex items-center gap-1.5 px-3 py-1 bg-orange-600/80 hover:bg-orange-500 rounded-lg text-xs text-white transition-colors"
          >
            <Trash2 size={12} />
            Удалить логи
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
