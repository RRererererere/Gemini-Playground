# File Editor Changelog

## v1.0.0 - Initial Implementation

### ✨ Features

- **Diff-based editing**: AI использует SEARCH/REPLACE блоки вместо переписывания всего файла
- **Fuzzy matching**: Три уровня поиска совпадений (точное, без whitespace, нормализация отступов)
- **Multiple view modes**: Diff, Editor, Split view
- **File history**: Отслеживание всех изменений с возможностью отката
- **Accept/Reject workflow**: Контроль над применением изменений
- **Multi-file support**: Работа с несколькими файлами одновременно
- **Language support**: 20+ языков программирования

### 🏗️ Architecture

- **Skill**: `file-editor` с 5 инструментами
- **Diff Engine**: `lib/diff-engine.ts` с fuzzy matching
- **UI Component**: `FileEditorCanvas` с табами и toolbar
- **Type System**: `OpenFile`, `FileDiffOp`, `FileHistoryEntry`

### 📦 Components

- `lib/skills/built-in/file-editor.ts` - Skill implementation
- `lib/diff-engine.ts` - Diff calculation and application
- `components/FileEditorCanvas.tsx` - UI component
- `types/index.ts` - Type definitions

### 🔧 Changes

- Extended `ACCEPTED_TYPES` in `ChatInput.tsx` with code file formats
- Added `fileToText()` helper for reading text files
- Updated file processing logic to handle code files as text (not base64)
- Registered `file-editor` skill in `lib/skills/built-in/index.ts`

### 📝 Documentation

- `assets/FILE_EDITOR_GUIDE.md` - Complete user guide
- System prompt instructions for AI
- Architecture documentation

### 🎯 Next Steps (Phase 4)

- [ ] Integration with Website Builder (`sync_to_file_editor` tool)
- [ ] Bidirectional sync between FileEditor and LivePreview
- [ ] Layout changes in `page.tsx` (resizable panels)
- [ ] State management for `openFiles` and `pendingEdits`
- [ ] Per-chat file persistence

### 🐛 Known Issues

- Monaco Editor not yet integrated (using simple textarea)
- No syntax highlighting in editor mode
- No auto-save functionality
- Files not persisted between sessions

### 🔒 Security

- UTF-8 text reading (not base64 for code files)
- 100KB limit for text files
- MIME type validation
- Empty search string protection
- Multiple occurrence warnings
