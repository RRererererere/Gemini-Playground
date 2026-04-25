'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ background: '#0f0f0f', color: '#fff', fontFamily: 'sans-serif' }}>
        {/* Минимальный HTML без зависимостей, т.к. layout упал */}
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '400px', width: '100%' }}>
            <h1 style={{ fontSize: '18px', marginBottom: '12px' }}>⚠️ Критическая ошибка</h1>
            <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.6, marginBottom: '24px' }}>
              {error?.message?.includes('QuotaExceeded') || error?.message?.includes('storage')
                ? 'Хранилище браузера переполнено. Нажми кнопку ниже чтобы очистить историю чатов и вернуться в нормальный режим.'
                : `Произошла внутренняя ошибка. ${error?.message || ''}`
              }
            </p>
            <button
              onClick={() => {
                try { localStorage.removeItem('gemini_saved_chats'); } catch {}
                reset();
              }}
              style={{ background: '#e55', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', width: '100%', marginBottom: '8px' }}
            >
              Очистить историю и перезагрузить
            </button>
            <button
              onClick={() => { try { localStorage.clear(); } catch {} window.location.href = '/'; }}
              style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', width: '100%' }}
            >
              Полный сброс
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
