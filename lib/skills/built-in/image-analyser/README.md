# 🔍 Image Analyser Skill

Позволяет Gemini увеличивать (zoom) конкретные области изображений для детального анализа.

## Возможности

- Увеличение любой прямоугольной области изображения
- Координаты в процентах (0-100) — независимо от разрешения
- Масштабирование 2-6x для разных уровней детализации
- Высококачественная интерполяция (Canvas API)
- Автоматический поиск изображений в истории чата
- Совместимость с Gemini 2.x через sibling parts

## Как это работает

### Архитектура для Gemini 2.x

Gemini 2.x (2.0-flash, 2.5-pro) **НЕ поддерживает** вложенные multimodal данные внутри `functionResponse`. Изображение должно быть **sibling-партом** рядом с `functionResponse` в том же user turn:

```json
{
  "role": "user",
  "parts": [
    {
      "functionResponse": {
        "name": "zoom_region",
        "response": { "status": "zoomed", "region": {...} }
      }
    },
    {
      "inlineData": {
        "mimeType": "image/jpeg",
        "data": "BASE64_CROP"
      }
    }
  ]
}
```

### Поток данных

1. **User**: загружает изображение + задаёт вопрос
2. **Gemini**: видит изображение, вызывает `zoom_region({ x1:20, y1:30, x2:60, y2:70 })`
3. **Skill**: получает base64 оригинала из `ctx.messages`
4. **Cropper**: Canvas API кропает регион, масштабирует ×3
5. **Skill**: возвращает `mode: 'respond'` + `responseParts: [{ inlineData }]` + `artifacts: [UI-превью]`
6. **Executor**: передаёт `responseParts` → `page.tsx`
7. **Page**: сохраняет `extraParts` в `accumulatedToolResponses`
8. **Gemini**: получает functionResponse + sibling inlineData, видит детали
9. **UI**: показывает артефакт с зум-превью

## Tool Declaration

```typescript
{
  name: 'zoom_region',
  description: 'Zoom into a specific rectangular area of an image',
  parameters: {
    image_index: number,  // 0 = самое последнее изображение
    x1_pct: number,       // левый край 0-100%
    y1_pct: number,       // верхний край 0-100%
    x2_pct: number,       // правый край 0-100%
    y2_pct: number,       // нижний край 0-100%
    reason: string,       // "Need to read text in corner"
    scale: number,        // 2-6x увеличение (default 3)
  }
}
```

## Примеры использования

### Чтение мелкого текста
```
User: "Что написано в правом нижнем углу?"
Gemini: *вызывает zoom_region({ x1:70, y1:70, x2:100, y2:100, scale:4 })*
Skill: *возвращает увеличенный кроп ×4*
Gemini: "В правом нижнем углу написано: Copyright 2024"
```

### Анализ лиц на фоне
```
User: "Сколько людей на заднем плане?"
Gemini: *вызывает zoom_region({ x1:30, y1:10, x2:70, y2:40, scale:3 })*
Skill: *возвращает увеличенный фон*
Gemini: "На заднем плане видно 3 человека"
```

### Детали узора
```
User: "Какой узор на ткани?"
Gemini: *вызывает zoom_region({ x1:40, y1:40, x2:60, y2:60, scale:5 })*
Skill: *возвращает увеличенный фрагмент ×5*
Gemini: "Это геометрический узор в виде ромбов"
```

## Технические детали

### Cropper (cropper.ts)

Использует `OffscreenCanvas` для высокопроизводительной обработки:

```typescript
const canvas = new OffscreenCanvas(scaledW, scaledH);
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, scaledW, scaledH);
```

- **Browser-only** (не требует сервера)
- Высококачественная интерполяция
- Вывод в JPEG (quality: 0.92)
- Автоматическая конвертация в base64

### Поиск изображений

Скилл ищет изображения в истории чата:

```typescript
const images = ctx.messages
  .filter(m => m.role === 'user' && m.files?.length)
  .flatMap(m => m.files!.filter(f => f.mimeType.startsWith('image/')))
  .reverse(); // 0 = самое последнее

const target = images[image_index ?? 0];
```

### Артефакты

Создаёт артефакт для UI:

```typescript
{
  type: 'image',
  label: '🔍 Zoomed ×3 — Need to read text',
  data: { kind: 'base64', mimeType: 'image/jpeg', base64: '...' },
  downloadable: true,
  filename: 'zoom_20-30_60-70.jpg'
}
```

## Изменённые файлы

### Типы
- `lib/skills/types.ts` — добавлен `responseParts` в `SkillToolResult` и `SkillExecutionResult`
- `types/index.ts` — добавлен `extraParts` в `ToolResponse`

### Логика
- `lib/skills/executor.ts` — прокидывает `responseParts` из скилла
- `lib/gemini.ts` — добавляет sibling parts в `buildChatRequestMessages`
- `app/page.tsx` — сохраняет `extraParts` в `accumulatedToolResponses`

### Скилл
- `lib/skills/built-in/image-analyser/types.ts` — типы для zoom операций
- `lib/skills/built-in/image-analyser/cropper.ts` — Canvas API кроппинг
- `lib/skills/built-in/image-analyser/skill.ts` — основной скилл
- `lib/skills/built-in/image-analyser/index.ts` — реэкспорт
- `lib/skills/built-in/index.ts` — регистрация скилла

## Ограничения

- Работает только в браузере (Canvas API)
- Максимальный scale: 6x (для производительности)
- Координаты должны быть валидными (x2 > x1, y2 > y1)
- Требует наличия изображений в истории чата

## Совместимость

- ✅ Gemini 2.0 Flash (sibling parts)
- ✅ Gemini 2.5 Pro (sibling parts)
- ✅ Gemini 3.0+ (поддерживает оба формата)
- ✅ Все браузеры с OffscreenCanvas (Chrome 69+, Firefox 105+, Safari 16.4+)

## Будущие улучшения

- [ ] Поддержка множественных регионов за один вызов
- [ ] Автоматическое определение интересных областей (OCR, face detection)
- [ ] Кэширование кропов для повторного использования
- [ ] Поддержка других форматов вывода (PNG, WebP)
- [ ] Аннотации на оригинальном изображении (рамки, стрелки)
