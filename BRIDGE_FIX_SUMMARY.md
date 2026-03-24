# 🔧 Исправление GeminiBridge — Краткое резюме

## Проблема

Website Builder skill имел функцию создания AI-интерактивных сайтов (`website_type: 'ai_interactive'`), которые должны были отправлять данные в чат через `window.GeminiBridge.send()`. Однако это не работало.

## Причина

В `components/LivePreviewPanel.tsx` скрипт `bridgeScript` генерировался как константа при первом рендере компонента. Внутри скрипта использовалась переменная `previewMode`, которая "замораживалась" в момент создания скрипта. При переключении режимов preview (Interact → AI App) скрипт не обновлялся, и GeminiBridge инициализировался с неправильным режимом.

## Решение

### 1. Преобразовали константу в функцию
```typescript
// Было:
const bridgeScript = `<script>...</script>`;

// Стало:
const getBridgeScript = useCallback(() => {
  return `<script>...</script>`;
}, [previewMode]);
```

### 2. Добавили перезагрузку iframe при смене режима
```typescript
useEffect(() => {
  if (code && isRenderedRef.current && iframeRef.current) {
    // Полная перезагрузка iframe с новым скриптом
    isRenderedRef.current = false;
    prevCodeRef.current = '';
    iframeRef.current.srcdoc = getSrcDoc();
    iframeRef.current.onload = () => {
      isRenderedRef.current = true;
      prevCodeRef.current = code;
    };
  }
}, [previewMode, getBridgeScript]);
```

### 3. Добавили логирование для отладки
```javascript
console.log('[GeminiBridge] Initialized successfully');
console.log('[GeminiBridge] Sending to AI:', eventType, data);
console.log('[LivePreview] Mode:', mode);
```

### 4. Обновили системный промпт
Добавили инструкцию автоматически блокировать кнопку отправки:
```javascript
submitBtn.disabled = true;
submitBtn.textContent = 'Отправлено...';
```

### 5. Создали красивый компонент для отображения данных
Вместо текста `[🌐 SITE DATA] ...` теперь красивый блок:
- Иконка и цвет зависят от типа события
- Сворачиваемый JSON с подсветкой
- Адаптивный дизайн в стиле чата

## Измененные файлы

1. **components/LivePreviewPanel.tsx**
   - Преобразовали `bridgeScript` в `getBridgeScript()`
   - Добавили useCallback с зависимостью от `previewMode`
   - Добавили useEffect для перезагрузки iframe при смене режима
   - Обновили все зависимости в других useEffect и useCallback
   - Добавили console.log для отладки

2. **lib/skills/built-in/website-builder.ts**
   - Обновили описание `ai_interactive` типа
   - Добавили пример кода с автоблокировкой кнопки
   - Добавили инструкцию в системный промпт о блокировке кнопки
   - Добавили больше примеров использования

3. **components/ChatMessage.tsx**
   - Добавили компонент `BridgeDataBlock` для красивого отображения
   - Добавили импорты иконок (Send, Calculator, ClipboardList, MessageSquare, Globe)
   - Добавили рендеринг `BridgeDataBlock` для user сообщений с `bridgeData`

4. **app/page.tsx**
   - Изменили создание сообщения: вместо текста теперь `kind: 'bridge_data'` и `bridgeData`
   - Обновили оба обработчика `onAIDataReceived` (desktop и mobile)

5. **lib/gemini.ts**
   - Обновили `buildChatRequestMessages` для обработки `bridge_data` сообщений
   - Добавили форматирование JSON для отправки в Gemini API

6. **types/index.ts**
   - Добавили `kind?: 'tool_response' | 'bridge_data'` в Message
   - Добавили `bridgeData?: BridgePayload` в Message
   - Добавили импорт `BridgePayload` в ChatMessage

## Как проверить

1. Попросите Gemini создать AI-интерактивный сайт:
   ```
   Создай форму обратной связи. Тип: ai_interactive.
   При отправке данные должны идти в чат через GeminiBridge.
   ```

2. Откройте DevTools (F12) → Console

3. Убедитесь что режим preview = "AI App" (⚡)

4. Заполните форму и отправьте

5. В консоли должно появиться:
   ```
   [GeminiBridge] Sending to AI: form_submission {...}
   ```

6. В чате должно появиться сообщение с данными формы

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    LivePreviewPanel.tsx                      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  getBridgeScript() — генерирует скрипт с           │    │
│  │  актуальным previewMode                            │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  getSrcDoc() — вставляет скрипт в HTML             │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  <iframe srcdoc={getSrcDoc()} />                   │    │
│  │                                                     │    │
│  │  ┌──────────────────────────────────────────┐     │    │
│  │  │  window.GeminiBridge.send()              │     │    │
│  │  │         ↓                                 │     │    │
│  │  │  window.parent.postMessage()             │     │    │
│  │  └──────────────────────────────────────────┘     │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  handleMessage() — ловит postMessage               │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  onAIDataReceived(bridgeData)                      │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                        page.tsx                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Создает новое user сообщение с данными            │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  streamGeneration() — отправляет в Gemini API      │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  AI анализирует данные и отвечает в чат            │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Что дальше?

Если нужна двусторонняя коммуникация (AI → сайт):
1. Раскомментировать `sendAIResponseToSite()` в LivePreviewPanel
2. Добавить логику отправки ответов AI обратно на сайт в page.tsx
3. Использовать `window.GeminiBridge.onResponse()` на сайте
