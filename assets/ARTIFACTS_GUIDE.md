# Skill Artifacts - Руководство

## Что такое артефакты?

Артефакты — это файлы, медиа и визуализации которые скиллы возвращают для отображения в чате. В отличие от обычных файлов пользователя, артефакты создаются скиллами автоматически.

## Типы артефактов

### 1. Image (изображения)
- Отображаются с zoom и кнопками скачивания
- Множественные изображения группируются в галерею с навигацией
- Поддержка base64 и URL

```typescript
{
  type: 'image',
  label: 'QR-код',
  data: { kind: 'url', url: 'https://...', mimeType: 'image/png' },
  downloadable: true,
  filename: 'qr.png'
}
```

### 2. Video (видео)
- HTML5 video player с controls
- Кнопка скачивания

```typescript
{
  type: 'video',
  data: { kind: 'base64', mimeType: 'video/mp4', base64: '...' }
}
```

### 3. Audio (аудио)
- HTML5 audio player
- Кнопка скачивания

```typescript
{
  type: 'audio',
  data: { kind: 'base64', mimeType: 'audio/mpeg', base64: '...' }
}
```

### 4. Code (код)
- Подсветка синтаксиса
- Кнопка скачивания

```typescript
{
  type: 'code',
  label: 'SQL запрос',
  data: { kind: 'text', content: 'SELECT * FROM users', language: 'sql' },
  filename: 'query.sql'
}
```

### 5. Table (таблицы)
- Интерактивная таблица с hover эффектами
- Экспорт в CSV

```typescript
{
  type: 'table',
  label: 'Результаты',
  data: {
    kind: 'json',
    value: {
      headers: ['Name', 'Age', 'City'],
      rows: [
        ['Alice', '25', 'Moscow'],
        ['Bob', '30', 'SPb']
      ]
    }
  },
  filename: 'results.csv'
}
```

### 6. Text (текст)
- Простой текстовый блок
- Сохраняет форматирование

```typescript
{
  type: 'text',
  data: { kind: 'text', content: 'Plain text content' }
}
```

## UI Features

### Галерея изображений
Когда скилл возвращает несколько изображений, они автоматически группируются в галерею:
- Навигация стрелками (← →)
- Миниатюры внизу
- Счетчик (1 / 5)
- Zoom в полноэкранный режим
- Кнопки скачивания

### Кнопки действий
Все кнопки используют lucide-react иконки:
- `Download` - скачивание файлов
- `ZoomIn` - увеличение изображений
- `X` - закрытие модалов
- `ChevronLeft/Right` - навигация

### Адаптивность
- Изображения масштабируются под размер экрана
- Таблицы имеют горизонтальный скролл
- Все элементы responsive

## Хранение

### Маленькие артефакты (<100KB)
Хранятся в localStorage как часть Message

### Большие артефакты (>100KB)
Автоматически сохраняются в IndexedDB:
```typescript
{
  data: { kind: 'stored', stored: 'idb' }
}
```

При загрузке чата восстанавливаются автоматически.

## Примеры скиллов

### QR Generator
```typescript
return {
  mode: 'fire_and_forget',
  artifacts: [{
    type: 'image',
    label: 'QR-код',
    data: { kind: 'url', url: qrApiUrl },
    downloadable: true,
    filename: 'qr-code.png'
  }]
};
```

### Table Generator
```typescript
return {
  mode: 'fire_and_forget',
  artifacts: [{
    type: 'table',
    label: 'Таблица данных',
    data: { kind: 'json', value: { headers, rows } },
    downloadable: true,
    filename: 'data.csv'
  }]
};
```

## Best Practices

1. **Используй label** - помогает пользователю понять что это
2. **Указывай filename** - для корректного скачивания
3. **Группируй связанные изображения** - они автоматически станут галереей
4. **Используй URL для больших файлов** - вместо base64
5. **Добавляй downloadable: false** - если скачивание не имеет смысла
