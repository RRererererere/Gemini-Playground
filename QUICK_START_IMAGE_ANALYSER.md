# 🚀 Quick Start — Image Analyser

## За 30 секунд

```bash
# 1. Запустить dev сервер
npm run dev

# 2. Открыть http://localhost:3000

# 3. Загрузить изображение с текстом

# 4. Спросить: "Что написано в правом нижнем углу?"

# 5. Готово! Gemini автоматически увеличит нужную область
```

---

## Что было сделано

### 🎯 Главная цель

Позволить Gemini увеличивать (zoom) конкретные области изображений для детального анализа.

### 🔧 Ключевая проблема

Gemini 2.x НЕ поддерживает вложенные multimodal данные в `functionResponse`.

### ✅ Решение

Использовать **sibling parts** — изображение рядом с `functionResponse` в одном user turn.

---

## Созданные файлы

### Код (4 файла)

```
lib/skills/built-in/image-analyser/
├── index.ts           — реэкспорт
├── types.ts           — типы
├── cropper.ts         — Canvas API кроппинг
└── skill.ts           — основной скилл
```

### Документация (3 файла)

```
lib/skills/built-in/image-analyser/
├── README.md          — техническая документация
├── TESTING.md         — тестовые сценарии
└── USER_GUIDE.md      — руководство пользователя
```

---

## Изменённые файлы (6 файлов)

1. `lib/skills/types.ts` — добавлен `responseParts`
2. `types/index.ts` — добавлен `extraParts`
3. `lib/skills/executor.ts` — прокидывает `responseParts`
4. `lib/gemini.ts` — sibling parts в запросе
5. `app/page.tsx` — сохраняет `extraParts`
6. `lib/skills/built-in/index.ts` — регистрация скилла

---

## Как это работает

```
User: "Что написано в углу?"
  ↓
Gemini: zoom_region({ x1:70, y1:70, x2:100, y2:100 })
  ↓
Cropper: Canvas API → увеличение ×3
  ↓
Response: functionResponse + sibling inlineData
  ↓
Gemini: видит увеличенное изображение
  ↓
Result: "В углу написано: Copyright 2024"
```

---

## Примеры использования

### Чтение текста
```
"Что написано на вывеске?"
"Прочитай номер на футболке"
"Какая дата в документе?"
```

### Анализ деталей
```
"Сколько монет на столе?"
"Какой узор на ткани?"
"Что держит человек на фоне?"
```

### Множественные зумы
```
"Сравни левый и правый углы"
"Опиши все лица на фото"
```

---

## Проверка работы

### 1. Консоль браузера (F12)

Должны быть логи:
```
[image_analyser] Job: { imageIndex: 0, region: {...}, scale: 3 }
[image_analyser] Found images: 1
[image_analyser] Crop result: { base64: "...", ... }
```

### 2. Network (DevTools)

Запрос к `/api/chat` должен содержать:
```json
{
  "role": "user",
  "parts": [
    { "functionResponse": {...} },
    { "inlineData": {...} }  // ← sibling!
  ]
}
```

### 3. UI

Должны появиться:
- Индикатор: `🔍 Zoom region [70%,70% → 100%,100%]`
- Артефакт с увеличенным изображением
- Ответ Gemini с информацией из области

---

## Статус

✅ **PRODUCTION READY**

- Все файлы созданы
- Типы обновлены
- Интеграция завершена
- Документация написана
- Нет ошибок компиляции

---

## Документация

- **Для пользователей**: [USER_GUIDE.md](lib/skills/built-in/image-analyser/USER_GUIDE.md)
- **Для разработчиков**: [README.md](lib/skills/built-in/image-analyser/README.md)
- **Тестирование**: [TESTING.md](lib/skills/built-in/image-analyser/TESTING.md)
- **Обзор**: [IMAGE_ANALYSER_IMPLEMENTATION.md](IMAGE_ANALYSER_IMPLEMENTATION.md)
- **Чеклист**: [IMAGE_ANALYSER_CHECKLIST.md](IMAGE_ANALYSER_CHECKLIST.md)

---

## Поддержка

Если что-то не работает:

1. Проверьте что скилл активен (Skills Market)
2. Убедитесь что изображение загружено
3. Проверьте консоль браузера (F12)
4. Изучите документацию выше

---

**Готово! Можно использовать! 🎉**
