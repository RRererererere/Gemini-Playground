'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Download, Trash2, RefreshCw } from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isQuota = error?.message?.includes('QuotaExceeded') ||
                  error?.message?.includes('storage') ||
                  error?.name === 'QuotaExceededError';

  const handleExportAndClear = () => {
    try {
      // Экспортируем всё что есть
      const chatsRaw = localStorage.getItem('gemini_saved_chats');
      if (chatsRaw) {
        const blob = new Blob([chatsRaw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gemini-emergency-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
  };

  const handleClearChats = () => {
    if (!confirm('Удалить историю чатов? API ключи и настройки сохранятся.')) return;
    try {
      localStorage.removeItem('gemini_saved_chats');
      localStorage.removeItem('gemini_active_chat_id');
    } catch {}
    reset();
  };

  const handleHardReset = () => {
    if (!confirm('Полный сброс? Удалятся ВСЕ данные включая ключи.')) return;
    try { localStorage.clear(); } catch {}
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-yellow-400" size={28} />
          <h1 className="text-xl font-semibold">
            {isQuota ? 'Хранилище переполнено' : 'Ошибка приложения'}
          </h1>
        </div>

        <p className="text-sm text-gray-400 leading-relaxed">
          {isQuota
            ? 'Браузерное хранилище на телефоне заполнено — скорее всего накопилось много чатов с файлами. Сначала экспортируй данные, потом очисти историю.'
            : `Что-то сломалось при рендере. ${error?.message || ''}`}
        </p>

        <div className="space-y-3">
          <button
            onClick={handleExportAndClear}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Скачать резервную копию
          </button>

          <button
            onClick={handleClearChats}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600/80 hover:bg-orange-500 text-sm font-medium transition-colors"
          >
            <Trash2 size={16} />
            Очистить историю чатов (ключи останутся)
          </button>

          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-700 hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            <RefreshCw size={16} />
            Попробовать снова
          </button>

          <button
            onClick={handleHardReset}
            className="w-full text-xs text-gray-600 hover:text-red-400 transition-colors py-1"
          >
            Полный сброс всего (последний шанс)
          </button>
        </div>
      </div>
    </div>
  );
}
