# Video Frame Extractor — Changelog

## v1.0.0 — Initial Release

### ✨ Новые возможности

**Извлечение кадров из видео**
- Canvas-based extraction с высоким качеством (JPEG 92%)
- Поддержка timestamp (секунды) и frame_number
- Автоматическое определение видео в чате (video_1, video_2, ...)
- Быстрое извлечение (~100-300ms на кадр)

**Интеграция с AI**
- Автоматическое добавление кадров в контекст Gemini
- System prompt с инструкциями и списком доступных видео
- Поддержка multimodal response (изображение + JSON)

**UI/UX**
- Визуальный индикатор с источником и таймкодом (🎬 video.mp4 ⏱ 0:15.02)
- Артефакт с превью, zoom и download
- Автоматическая генерация filename (video_frame_15.02s.jpg)

**Интеграция с другими скиллами**
- Полная совместимость с Image Analyser (zoom_region, annotate_regions)
- Поддержка Visual Memory (save_image_memory)
- Работа с существующей image context системой

### 🏗️ Архитектура

**Skill структура**
```
lib/skills/built-in/video-frame-extractor/
├── skill.ts          # Основная логика
├── index.ts          # Export
└── README.md         # Документация
```

**Компоненты**
- `VideoFrameIndicator.tsx` — визуальный индикатор в чате
- Интеграция в `SkillArtifactRenderer.tsx`

**API**
- Tool: `extract_video_frame`
- Параметры: video_identifier, timestamp_seconds, frame_number, reason
- Response: image_id, video_source, timestamp, dimensions, message
- Artifacts: image с sendToGemini=true

### 📝 Документация

- `README.md` — техническая документация для разработчиков
- `VIDEO_FRAME_EXTRACTOR_GUIDE.md` — гайд для пользователей
- Обновлён основной `README.md` проекта

### 🔧 Технические детали

**Извлечение кадра**
1. Видео загружается из base64 → Blob → Blob URL
2. Создаётся `<video>` элемент
3. Устанавливается `currentTime` на нужный таймкод
4. Кадр рисуется на Canvas через `drawImage()`
5. Canvas → JPEG blob → base64

**Производительность**
- Используется `OffscreenCanvas` для лучшей производительности
- High-quality image smoothing
- Оптимальное качество JPEG (0.92)

**Безопасность**
- Все операции в браузере (client-side)
- Нет отправки видео на сервер
- Blob URLs автоматически очищаются

### 🎯 Use Cases

**Базовый анализ**
- "Что происходит на 15 секунде?"
- "Опиши сцену в начале видео"

**Детальный анализ**
- "Что написано на табличке на 0:45?" → extract + zoom
- "Сравни начало и конец" → multiple extracts

**Сохранение в память**
- "Сохрани ключевой момент на 2:15"
- "Запомни этот продукт из видео"

### 🐛 Известные ограничения

- Работает только в браузере (Canvas API)
- Поддерживаются форматы: MP4, MOV, WebM (что поддерживает `<video>`)
- Размер видео ограничен памятью браузера
- Не работает с live/streaming видео

### 📦 Зависимости

Нет новых зависимостей — использует встроенные Web APIs:
- Canvas API
- Blob API
- FileReader API

### 🚀 Deployment

- Включён по умолчанию в BUILT_IN_SKILLS
- Не требует настройки
- Работает сразу после загрузки видео

---

## Roadmap

### v1.1.0 (Planned)

**Улучшения производительности**
- [ ] Кэширование извлечённых кадров
- [ ] Batch extraction для множественных кадров
- [ ] WebWorker для фоновой обработки

**Новые возможности**
- [ ] Автоматическое определение ключевых кадров (scene detection)
- [ ] Извлечение диапазона кадров (start-end)
- [ ] Поддержка GIF анимации из нескольких кадров

**UI/UX**
- [ ] Timeline preview с миниатюрами
- [ ] Drag-to-select region на timeline
- [ ] Сравнение кадров side-by-side

**Интеграция**
- [ ] OCR для текста на кадрах
- [ ] Object detection для автоматических аннотаций
- [ ] Face recognition для поиска людей

### v2.0.0 (Future)

**Advanced features**
- [ ] Video segmentation (разбивка на сцены)
- [ ] Motion analysis (анализ движения между кадрами)
- [ ] Audio extraction (извлечение звука для транскрипции)
- [ ] Subtitle overlay (наложение субтитров на кадры)

---

**Дата релиза**: 2024  
**Автор**: Gemini Studio Team  
**Лицензия**: Same as main project
