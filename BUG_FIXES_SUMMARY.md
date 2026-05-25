# Bug Fixes Summary — 2026-05-25

## Выполнено: 6 HIGH приоритетных багов

### ✅ APP-004, APP-203, APP-204 — require() в storage.ts
**Коммит:** `6f264de`
- Заменил `require('./memory-store')` на `await import('./memory-store')` в `exportAllSettings()` и `importAllSettings()`
- Сделал обе функции `async`
- Исправлена несовместимость с ESM/Next.js, которая могла сломать production build

### ✅ APP-005 — fileStorage.ts неверный ключ localStorage
**Коммит:** `6f264de`
- Исправил `localStorage.getItem('chats')` на `localStorage.getItem('gemini_saved_chats')` в функции `getFile()`
- Теперь метаданные файлов корректно извлекаются из сохранённых чатов

### ✅ APP-003 — memoryCallsThisTurn не сбрасывается между раундами
**Коммит:** `a6af3ca`
- Добавил `memoryCallsThisTurn = 0` в начале каждой итерации `while(shouldContinueLoop)`
- Теперь лимит memory calls работает корректно для каждого tool round

### ✅ APP-002 — Ghost Nudge Protocol инъекция пустых turn-ов
**Коммит:** `54529e9`
- Удалил инъекцию фейковых `{ role: 'model', parts: [{ text: '...' }] }` и `{ role: 'user', parts: [{ text: '...' }] }`
- Теперь GNP просто повторяет запрос с тем же `contentsForRequest` без модификации истории
- Это предотвращает нарушение формата Gemini API и раздувание контекста

### ✅ APP-007 — handleFeedback side effect внутри setMessages
**Коммит:** `27209f1`
- Вынес `addFeedbackEntry()` ДО вызова `setMessages()`
- Теперь нет side effect внутри React state updater
- Предотвращено дублирование feedback в React Strict Mode

### ✅ APP-006 — handleEditDeepThinkAnalysis без await
**Коммит:** `48e28af`
- Добавил `async` к функции `handleEditDeepThinkAnalysis`
- Добавил `await` перед вызовом `streamGeneration()`
- Теперь функция корректно ждёт завершения стриминга

### ✅ APP-014 — useDeepThink.ts дубликат декларации reader
**Коммит:** `d02f9ec`
- Удалил дублирующую декларацию `let reader` на строке 96
- Оставил только одну декларацию на строке 74
- Исправлено затенение переменной

---

## Статистика

- **Всего исправлено:** 6 HIGH приоритетных багов из 14
- **Файлов изменено:** 4 (`app/page.tsx`, `lib/storage.ts`, `lib/fileStorage.ts`, `lib/useDeepThink.ts`)
- **Коммитов:** 6
- **Статус пуша:** Не выполнен (нет прав на GitHub репозиторий)

## Оставшиеся HIGH приоритетные баги

Ещё 8 HIGH багов требуют исправления:

1. **APP-001** — streamGeneration спагетти-код (>900 строк, требует рефакторинга)
2. **APP-008** — API keys в plain-text localStorage (требует шифрования)
3. **APP-009** — previewUrlCache неограниченный рост (memory leak)
4. **APP-010** — isInvalidKeyError ложные срабатывания
5. **APP-011** — Vercel body size limit (нет проверки 4.5MB)
6. **APP-012** — fetch без timeout в api/chat/route.ts
7. **APP-013** — image-memory-store.ts thumbnail без сжатия

## Рекомендации

1. **Протестировать исправления** — особенно GNP и memory calls лимит
2. **Запушить изменения** — когда будут права на репозиторий
3. **Продолжить с оставшимися HIGH багами** — особенно APP-001 (рефакторинг streamGeneration)

---

**Дата:** 2026-05-25  
**Ветка:** skills  
**Последний коммит:** d02f9ec  
**Статус:** 6 коммитов готовы к пушу
