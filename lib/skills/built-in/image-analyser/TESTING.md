# Testing Guide — Image Analyser Skill

## Быстрый тест

### 1. Загрузите изображение с текстом

Используйте любое изображение с мелким текстом (скриншот, фото документа, инфографика).

### 2. Задайте вопрос

```
"Что написано в правом нижнем углу?"
```

### 3. Ожидаемое поведение

1. Gemini должен вызвать `zoom_region` с координатами правого нижнего угла
2. В чате появится индикатор: `🔍 Zoom region [70%,70% → 100%,100%]`
3. Появится артефакт с увеличенным изображением
4. Gemini прочитает текст и ответит

## Тестовые сценарии

### Сценарий 1: Чтение мелкого текста

**Изображение**: Скриншот веб-страницы с мелким шрифтом

**Промпт**:
```
"Прочитай текст в footer'е страницы"
```

**Ожидаемый результат**:
- Вызов `zoom_region` с координатами нижней части (y1:80-90, y2:100)
- Увеличение ×3-4
- Точное чтение текста

---

### Сценарий 2: Анализ деталей

**Изображение**: Фото с множеством мелких объектов

**Промпт**:
```
"Сколько монет на столе?"
```

**Ожидаемый результат**:
- Вызов `zoom_region` для области со столом
- Увеличение ×3-5
- Точный подсчёт монет

---

### Сценарий 3: Множественные зумы

**Изображение**: Комплексное изображение (карта, схема)

**Промпт**:
```
"Что написано в левом верхнем углу и в правом нижнем?"
```

**Ожидаемый результат**:
- Первый вызов `zoom_region` для левого верхнего угла
- Второй вызов `zoom_region` для правого нижнего угла
- Ответ с информацией из обеих областей

---

### Сценарий 4: Несколько изображений

**Изображения**: Загрузите 2-3 изображения в одном сообщении

**Промпт**:
```
"Что написано на втором изображении в центре?"
```

**Ожидаемый результат**:
- Вызов `zoom_region` с `image_index: 1` (второе изображение)
- Координаты центральной области (x1:30-40, y1:30-40, x2:60-70, y2:60-70)
- Правильное чтение текста со второго изображения

---

### Сценарий 5: Высокое увеличение

**Изображение**: Изображение с очень мелкими деталями

**Промпт**:
```
"Увеличь максимально центральную часть и опиши что видишь"
```

**Ожидаемый результат**:
- Вызов `zoom_region` с `scale: 6` (максимум)
- Высококачественное увеличение
- Детальное описание

---

## Проверка технических аспектов

### 1. Sibling Parts (Gemini 2.x)

Откройте DevTools → Network → найдите запрос к `/api/chat`

**Проверьте payload**:
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "functionResponse": {
            "name": "zoom_region",
            "response": { "status": "zoomed", ... }
          }
        },
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "BASE64_STRING"
          }
        }
      ]
    }
  ]
}
```

✅ `functionResponse` и `inlineData` должны быть **sibling** (в одном массиве parts)

❌ НЕ должно быть вложенности: `functionResponse.response.inlineData`

---

### 2. Артефакты в UI

После вызова `zoom_region` проверьте:

1. **Индикатор вызова** в сообщении модели:
   ```
   🔍 Zoom region [20%,30% → 60%,70%] — Need to read text
   ```

2. **Артефакт** с превью увеличенного изображения:
   - Должен быть кликабельным
   - Должна быть кнопка скачивания
   - Filename: `zoom_20-30_60-70.jpg`

3. **Ответ модели** должен содержать информацию из увеличенной области

---

### 3. Качество увеличения

Скачайте артефакт и проверьте:

- Нет артефактов сжатия (JPEG quality: 0.92)
- Плавная интерполяция (не пиксельная)
- Правильные размеры (cropSize × scale)

---

### 4. Обработка ошибок

#### Тест: Нет изображений

**Промпт** (без загрузки изображения):
```
"Увеличь правый верхний угол"
```

**Ожидаемый результат**:
```json
{ "error": "No images found in chat history" }
```

#### Тест: Неверные координаты

Вручную вызовите через custom tool:
```json
{
  "x1_pct": 60,
  "y1_pct": 70,
  "x2_pct": 40,  // x2 < x1 — ошибка!
  "y2_pct": 90
}
```

**Ожидаемый результат**:
```json
{ "error": "Invalid region: coordinates must be 0-100 and x2>x1, y2>y1" }
```

#### Тест: Неверный scale

```json
{ "scale": 10 }  // > 6
```

**Ожидаемый результат**:
```json
{ "error": "Invalid scale: must be between 2 and 6" }
```

---

## Performance Testing

### Метрики

Измерьте время выполнения для разных размеров:

| Размер оригинала | Размер кропа | Scale | Время |
|------------------|--------------|-------|-------|
| 1920×1080        | 500×500      | 3x    | ~50ms |
| 3840×2160 (4K)   | 1000×1000    | 3x    | ~150ms|
| 7680×4320 (8K)   | 2000×2000    | 3x    | ~500ms|

### Тест производительности

```javascript
// В DevTools Console
const start = performance.now();
// Вызовите zoom_region
const end = performance.now();
console.log(`Zoom took ${end - start}ms`);
```

**Целевые значения**:
- < 100ms для Full HD
- < 300ms для 4K
- < 1000ms для 8K

---

## Regression Testing

После изменений проверьте:

1. ✅ Обычные tool calls работают (calculator, datetime)
2. ✅ Memory tools работают (save_memory, forget_memory)
3. ✅ Другие skill tools работают (website_builder, office_export)
4. ✅ Множественные tool calls в одном turn
5. ✅ Tool calls с thoughtSignature (Deep Think mode)

---

## Browser Compatibility

Протестируйте в:

- ✅ Chrome 120+ (OffscreenCanvas stable)
- ✅ Firefox 120+ (OffscreenCanvas stable)
- ✅ Safari 17+ (OffscreenCanvas stable)
- ⚠️ Edge 120+ (должен работать как Chrome)

**Fallback**: Если `OffscreenCanvas` недоступен, используйте обычный `<canvas>`:

```typescript
// В cropper.ts можно добавить fallback:
const canvas = typeof OffscreenCanvas !== 'undefined'
  ? new OffscreenCanvas(scaledW, scaledH)
  : document.createElement('canvas');
```

---

## Debugging Tips

### 1. Логирование

Добавьте в `skill.ts`:

```typescript
console.log('[image_analyser] Job:', job);
console.log('[image_analyser] Found images:', images.length);
console.log('[image_analyser] Target image:', targetImage.name);
console.log('[image_analyser] Crop result:', result);
```

### 2. Визуализация координат

Создайте helper для отрисовки рамки на оригинале:

```typescript
function drawRegionBox(base64: string, region: ZoomRegion): string {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64}`;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  // Рисуем рамку
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 5;
  ctx.strokeRect(
    (region.x1_pct / 100) * img.width,
    (region.y1_pct / 100) * img.height,
    ((region.x2_pct - region.x1_pct) / 100) * img.width,
    ((region.y2_pct - region.y1_pct) / 100) * img.height
  );
  
  return canvas.toDataURL('image/jpeg');
}
```

### 3. Network Inspector

Проверьте размер payload:

- Оригинальное изображение: ~500KB base64
- Кроп ×3: ~100-200KB base64
- Total request size: должен быть разумным (< 5MB)

---

## Known Issues

### Issue 1: Large Images

**Проблема**: 8K изображения могут вызвать OOM в браузере

**Решение**: Добавить проверку размера:

```typescript
if (originalWidth * originalHeight > 33_000_000) { // > 8K
  throw new Error('Image too large (max 8K resolution)');
}
```

### Issue 2: CORS

**Проблема**: Если изображение загружено с внешнего URL (не через file input)

**Решение**: Все изображения должны быть в base64 (уже реализовано)

---

## Success Criteria

✅ Скилл активируется автоматически при вопросах о деталях изображения

✅ Координаты вычисляются правильно (проверить на 10+ примерах)

✅ Качество увеличения высокое (без артефактов)

✅ Gemini получает sibling parts (проверить в Network)

✅ UI показывает артефакты корректно

✅ Нет ошибок в консоли

✅ Производительность приемлемая (< 300ms для 4K)

✅ Работает в Chrome, Firefox, Safari
