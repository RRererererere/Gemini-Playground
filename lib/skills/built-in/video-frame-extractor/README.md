# Video Frame Extractor Skill

Извлекает кадры из видео для детального анализа с помощью AI.

## Зачем это нужно?

Gemini API не умеет работать с видео напрямую, но отлично анализирует изображения. Этот скилл решает проблему — извлекает нужные кадры из видео и превращает их в обычные изображения, которые можно:

- Анализировать с помощью AI
- Увеличивать (zoom_region)
- Аннотировать (annotate_regions)
- Сохранять в визуальную память (save_image_memory)
- Сравнивать между собой

## Как это работает?

1. Пользователь загружает видео в чат
2. AI автоматически видит доступные видео (video_1, video_2, ...)
3. AI вызывает `extract_video_frame` с нужным таймкодом
4. Скилл извлекает кадр через Canvas API
5. Кадр появляется как артефакт + автоматически добавляется в контекст
6. AI может работать с кадром как с обычным изображением

## Примеры использования

### Базовый пример

```
Пользователь: "Что происходит на 15 секунде видео?"

AI вызывает:
extract_video_frame(
  video_identifier="video_1",
  timestamp_seconds=15,
  reason="Пользователь спросил про сцену на 15 секунде"
)

Результат:
- Кадр извлечён и показан в чате
- AI видит изображение и может его описать
- image_id доступен для дальнейшего анализа
```

### Сравнение кадров

```
Пользователь: "Сравни начало и конец видео"

AI вызывает:
1. extract_video_frame(video_identifier="video_1", timestamp_seconds=0, reason="Начало видео")
2. extract_video_frame(video_identifier="video_1", timestamp_seconds=120, reason="Конец видео")

Результат:
- Два кадра показаны рядом
- AI сравнивает и описывает различия
```

### Детальный анализ

```
Пользователь: "Что написано на табличке в видео на 0:30?"

AI вызывает:
1. extract_video_frame(video_identifier="video_1", timestamp_seconds=30, reason="Табличка на 0:30")
2. zoom_region(image_identifier="frame_001", region={x1: 40, y1: 30, x2: 60, y2: 50}, scale=4, reason="Увеличить табличку")

Результат:
- Кадр извлечён
- Регион с табличкой увеличен в 4 раза
- AI читает текст с высокой точностью
```

## API

### Tool: `extract_video_frame`

Извлекает кадр из видео по таймкоду.

**Параметры:**

- `video_identifier` (string, required) — идентификатор видео
  - Формат: `"video_1"`, `"video_2"`, ... (по порядку в чате)
  - Или file ID напрямую
  
- `timestamp_seconds` (number, optional) — время в секундах
  - Пример: `15.5` для 15.5 секунд
  - Приоритет над `frame_number`
  
- `frame_number` (integer, optional) — номер кадра
  - Используется если `timestamp_seconds` не указан
  - Предполагается 30 fps
  
- `reason` (string, required) — зачем извлекаем кадр
  - Пример: `"User asked about scene at 0:15"`

**Возвращает:**

```json
{
  "image_id": "a3f9",
  "video_source": "demo.mp4",
  "timestamp_seconds": 15.02,
  "frame_number": 450,
  "width": 1920,
  "height": 1080,
  "reason": "User asked about scene at 0:15",
  "message": "Extracted frame at 15.02s from demo.mp4. Image ID: a3f9. You can now analyze this frame using image analysis tools."
}
```

**Артефакт:**

Создаётся изображение-артефакт с:
- `type: 'image'`
- `label: "Frame from demo.mp4 at 15.02s"`
- `sendToGemini: true` — автоматически добавляется в контекст
- `downloadable: true` — можно скачать

## Интеграция с другими скиллами

### Image Analyser

Извлечённые кадры полностью совместимы с Image Analyser:

```typescript
// 1. Извлечь кадр
extract_video_frame(video_identifier="video_1", timestamp_seconds=10, reason="...")

// 2. Увеличить регион
zoom_region(image_identifier="a3f9", region={...}, scale=3, reason="...")

// 3. Аннотировать
annotate_regions(image_identifier="a3f9", annotations=[...])

// 4. Сохранить в память
save_image_memory(image_identifier="a3f9", description="...", tags=[...])
```

### Visual Memory

Важные кадры можно сохранять в визуальную память:

```typescript
extract_video_frame(video_identifier="video_1", timestamp_seconds=45, reason="Key moment")
save_image_memory(
  image_identifier="b7k2",
  description="Product demonstration at 0:45",
  tags=["product", "demo", "key-moment"],
  entities=["laptop", "presenter"]
)
```

## UI/UX

### Визуальный индикатор

Извлечённые кадры показываются с фиолетовым индикатором:

```
🎬 demo.mp4  ⏱ 0:15.02  │ User asked about scene
```

### Артефакт

Кадр отображается как обычное изображение с:
- Превью (max-height: 200px)
- Кнопкой увеличения (zoom)
- Кнопкой скачивания
- Метаданными (размер, формат)

### Filename

Автоматически генерируется:
```
demo_frame_15.02s.jpg
```

## Технические детали

### Извлечение кадра

1. Видео загружается из base64 в Blob
2. Создаётся `<video>` элемент с Blob URL
3. Устанавливается `currentTime` на нужный таймкод
4. Кадр рисуется на Canvas через `drawImage()`
5. Canvas конвертируется в JPEG (quality: 0.92)
6. Результат возвращается как base64

### Производительность

- Извлечение кадра: ~100-300ms (зависит от размера видео)
- Формат: JPEG с качеством 0.92 (баланс размер/качество)
- Размер кадра: обычно 100-500 KB

### Ограничения

- Работает только в браузере (Canvas API)
- Поддерживаются форматы: MP4, MOV, WebM (что поддерживает `<video>`)
- Максимальный размер видео ограничен памятью браузера

## System Prompt

Когда в чате есть видео, AI получает инструкции:

```markdown
# Video Frame Extraction

You have access to video files in this conversation.

**Available videos:**
- video_1: "demo.mp4"
- video_2: "tutorial.mov"

**How to use:**
1. Call extract_video_frame with video_identifier and timestamp_seconds
2. The tool returns an image_id for further analysis
3. You can zoom, annotate, save to memory, etc.

**Tips:**
- Extract frames at key moments mentioned by the user
- Use multiple extractions to compare different timestamps
- Combine with image analysis tools for detailed examination
```

## Changelog

### v1.0.0 (2024)
- Initial release
- Canvas-based frame extraction
- Auto-inject to Gemini context
- Integration with Image Analyser
- Visual indicator in UI
