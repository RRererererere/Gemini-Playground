# File Editor — AI-powered Code Editing

Система AI-редактирования файлов для Gemini Playground с diff-based подходом.

## Возможности

- 📝 Diff-based редактирование (не переписывает весь файл)
- 🔍 Fuzzy matching для поиска изменений
- 📊 Визуализация изменений (diff view)
- 📜 История правок с возможностью отката
- ✅ Accept/Reject workflow для контроля изменений
- 🎨 Поддержка множества языков программирования

## Поддерживаемые форматы

- TypeScript/JavaScript (.ts, .tsx, .js, .jsx, .mjs, .cjs)
- Python (.py)
- HTML/CSS (.html, .css, .scss, .sass)
- Markdown (.md, .mdx)
- YAML (.yaml, .yml)
- Rust (.rs)
- Go (.go)
- Java (.java)
- C/C++ (.c, .cpp, .h, .hpp)
- Shell scripts (.sh, .bash)
- И многие другие...

## Как использовать

### 1. Прикрепите code-файл

Просто перетащите файл в чат или используйте кнопку прикрепления. Файл автоматически откроется в редакторе.

### 2. Попросите AI внести изменения

```
Добавь обработку ошибок в функцию handleClick
```

AI использует `edit_file` tool с SEARCH/REPLACE блоками вместо переписывания всего файла.

### 3. Просмотрите изменения

Изменения отображаются в diff-view:
- 🟢 Зелёные строки — добавлено
- 🔴 Красные строки — удалено
- ⚪ Белые строки — без изменений

### 4. Accept или Reject

- ✅ Accept — применить изменения
- ❌ Reject — отменить изменения
- 🔄 Revert — вернуться к оригиналу

## Режимы просмотра

### Diff Mode
Показывает изменения построчно с цветовой кодировкой.

### Editor Mode
Полноценный текстовый редактор для ручного редактирования.

### Split Mode
Сравнение оригинала и изменённой версии side-by-side.

## Архитектура

### Skill: file-editor

Инструменты:
- `open_file_in_editor` — регистрация файла для отслеживания
- `edit_file` — применение целевых правок через SEARCH/REPLACE
- `create_file` — создание нового файла с нуля
- `get_file_content` — получение текущего содержимого
- `revert_file` — откат к оригиналу или истории

### Diff Engine (lib/diff-engine.ts)

Fuzzy matching с тремя уровнями:
1. Точное совпадение
2. Без trailing whitespace
3. Нормализация отступов

### UI Component (FileEditorCanvas)

- Табы для множественных файлов
- Toolbar с действиями
- Три режима просмотра
- История изменений

## Системный промпт

AI получает инструкцию:

```
CRITICAL: NEVER rewrite an entire file. 
ALWAYS use edit_file tool with targeted SEARCH/REPLACE blocks.

Rules:
1. First call open_file_in_editor when user attaches a file
2. Use edit_file for ALL changes — even single line fixes
3. Include enough context in SEARCH (3-5 lines) to be unique
4. One edit block = one logical change
5. Describe each edit in "description" field
```

## Пример использования

### Пользователь прикрепляет файл App.tsx

AI автоматически вызывает:
```typescript
open_file_in_editor({
  fileId: "file_123",
  fileName: "App.tsx",
  language: "typescript"
})
```

### Пользователь: "Добавь логирование в handleClick"

AI вызывает:
```typescript
edit_file({
  fileId: "file_123",
  edits: [{
    search: "function handleClick() {\n  console.log('clicked');\n}",
    replace: "function handleClick() {\n  console.log('clicked');\n  trackEvent('button_click');\n}",
    description: "Add analytics tracking"
  }]
})
```

### Результат

Пользователь видит diff и может:
- ✅ Accept — изменения применяются
- ❌ Reject — изменения отменяются
- 📥 Download — скачать файл
- 📋 Copy — скопировать в буфер

## Интеграция с Website Builder

Website Builder может экспортировать HTML в File Editor через:

```typescript
sync_to_file_editor()
```

Это создаёт `index.html` файл в редакторе, который можно редактировать напрямую. Изменения автоматически синхронизируются с LivePreview.

## Хранение данных

- Открытые файлы: `ctx.storage` (per-chat)
- История правок: в объекте `OpenFile`
- Оригинальное содержимое: для diff и revert

## Безопасность

- Файлы читаются как UTF-8 текст (не base64)
- Лимит размера: 100KB текста
- Валидация MIME типов
- Защита от пустых search строк
- Предупреждение при множественных совпадениях

## Будущие улучшения

- [ ] Monaco Editor для подсветки синтаксиса
- [ ] Автосохранение в localStorage
- [ ] Экспорт всех файлов как ZIP
- [ ] Интеграция с Git (commit, diff)
- [ ] Collaborative editing
- [ ] AI code review mode
