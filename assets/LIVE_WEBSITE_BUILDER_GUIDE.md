# 🌐 Live Website Builder — Руководство

## Обзор

Live Website Builder — это мощная система для создания и модификации веб-сайтов в реальном времени с помощью AI. Сайт появляется на глазах по мере того как AI пишет код, а пользователь может взаимодействовать с элементами сайта прямо в чате.

## ✨ Ключевые возможности

### 1. **Live Preview** — Рендеринг в реальном времени
- Сайт появляется по мере генерации кода (live streaming)
- Плавные обновления без перезагрузки iframe
- Поддержка HTML/CSS/JS
- Автоматическое обнаружение кода в ответах AI

### 2. **Bidirectional Communication** — Двустороннее взаимодействие
- **Сайт → Чат**: Клик на элемент → информация попадает в контекст
- **Чат → Сайт**: AI обновляет код → сайт мгновенно обновляется
- Hover подсказки с метаданными элементов
- Visual feedback при наведении

### 3. **Drag & Drop** — Перетаскивание элементов
- Перетащи изображение с сайта в чат → AI видит картинку
- Перетащи текст → AI получает контекст
- Мобильная поддержка через long press
- Автоматическая конвертация в base64

### 4. **Split-Screen Layout** — Разделённый экран
- Resizable панели (изменяй размер перетаскиванием)
- Чат слева, Preview справа
- На мобилке: табы с свайпом
- Полноэкранный режим для preview

### 5. **Website Builder Skill** — AI инструменты
- `create_website` — создать сайт с нуля
- `update_website` — обновить существующий
- `add_component` — добавить компонент (navbar, footer, hero)
- `apply_theme` — применить тему (dark, light, glassmorphism)

---

## 🚀 Быстрый старт

### Шаг 1: Включи Website Builder Skill

1. Открой **Settings** (справа вверху)
2. Перейди в секцию **Skills**
3. Найди **Website Builder** (🌐)
4. Включи переключатель

### Шаг 2: Попроси AI создать сайт

```
Создай landing page для кофейни с hero секцией, меню и формой контакта
```

AI автоматически:
- Вызовет `create_website` tool
- Сгенерирует HTML/CSS/JS код
- Код появится в Live Preview справа
- Сайт будет интерактивным

### Шаг 3: Взаимодействуй с сайтом

**Клик на элемент**:
- Кликни на кнопку/текст/изображение
- Информация об элементе попадёт в чат
- AI увидит контекст и сможет модифицировать именно этот элемент

**Drag & Drop**:
- Перетащи изображение с сайта в поле ввода
- AI увидит картинку и сможет её модифицировать
- Работает с текстом, изображениями, видео

**Обновление**:
```
Измени цвет этой кнопки на синий
```
AI обновит код → сайт мгновенно изменится

---

## 📋 Примеры использования

### Пример 1: Создание лендинга

**Запрос**:
```
Создай современный landing page для SaaS продукта с:
- Hero секцией с градиентом
- Секцией с фичами (3 колонки)
- Pricing таблицей
- Footer с соцсетями
```

**Результат**:
- AI вызовет `create_website`
- Сгенерирует полный HTML с Tailwind CSS
- Сайт появится в preview с анимациями
- Все элементы будут кликабельны

### Пример 2: Модификация элемента

**Действия**:
1. Кликни на hero заголовок
2. Напиши: "Сделай этот текст больше и добавь тень"
3. AI обновит CSS для этого элемента
4. Изменения применятся мгновенно

### Пример 3: Добавление компонента

**Запрос**:
```
Добавь navbar с логотипом и меню навигации
```

**Результат**:
- AI вызовет `add_component`
- Navbar добавится в начало body
- Стили будут соответствовать общему дизайну

### Пример 4: Применение темы

**Запрос**:
```
Примени dark theme к сайту
```

**Результат**:
- AI вызовет `apply_theme` с параметром "dark"
- CSS обновится с тёмными цветами
- Сайт перекрасится без перезагрузки

### Пример 5: Drag & Drop workflow

**Действия**:
1. Перетащи изображение с сайта в чат
2. Напиши: "Сделай эту картинку круглой и добавь border"
3. AI увидит изображение и обновит CSS
4. Изменения применятся к этому элементу

---

## 🎨 Архитектура

### Компоненты

```
components/
├── LivePreviewPanel.tsx    — Главный компонент preview
│   ├── Iframe с sandboxing
│   ├── PostMessage bridge
│   ├── Drag & Drop handlers
│   ├── Toolbar (refresh, copy, download, fullscreen)
│   └── Hover info display
│
└── ChatInput.tsx           — Обработка drag&drop из preview
    ├── Canvas element preview
    ├── File attachment
    └── Send to AI
```

### Skills

```
lib/skills/built-in/
└── website-builder.ts      — Website Builder Skill
    ├── create_website      — Создание сайта
    ├── update_website      — Обновление
    ├── add_component       — Добавление компонента
    └── apply_theme         — Применение темы
```

### Потоки данных

```
┌─────────────────────────────────────────────────────────┐
│                    User Request                          │
│  "Создай landing page для кофейни"                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  AI (Gemini API)                         │
│  Анализирует запрос → вызывает create_website tool      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Website Builder Skill                       │
│  Генерирует HTML/CSS/JS → возвращает artifact           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Live Preview Panel                       │
│  Парсит HTML → обновляет iframe → рендерит сайт         │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              User Interaction                            │
│  Клик на элемент → postMessage → ChatInput              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Next Request                            │
│  "Измени цвет этой кнопки" + element context            │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Технические детали

### PostMessage Bridge

**Из iframe в parent**:
```javascript
window.parent.postMessage({
  source: 'live-preview',
  data: {
    type: 'click',
    tagName: 'BUTTON',
    id: 'submit-btn',
    className: 'btn-primary',
    innerText: 'Submit'
  }
}, '*');
```

**Из parent в iframe**:
```javascript
iframe.contentWindow.postMessage({
  source: 'live-preview-update',
  code: '<html>...</html>'
}, '*');
```

### Drag & Drop Protocol

**Image drag**:
```json
{
  "source": "live-preview-drag",
  "type": "drag-image",
  "tagName": "IMG",
  "dataURL": "data:image/png;base64,...",
  "alt": "Logo",
  "id": "logo",
  "className": "w-32 h-32"
}
```

**Text drag**:
```json
{
  "source": "live-preview-drag",
  "type": "drag-text",
  "tagName": "H1",
  "innerText": "Welcome to our site",
  "id": "hero-title",
  "className": "text-4xl font-bold"
}
```

### Skill Tool Declarations

**create_website**:
```typescript
{
  name: 'create_website',
  description: 'Create a complete HTML/CSS/JS website',
  parameters: {
    html: string,           // Full HTML code
    description: string,    // Brief description
    features?: string[]     // List of features
  }
}
```

**update_website**:
```typescript
{
  name: 'update_website',
  description: 'Update existing website code',
  parameters: {
    html: string,           // Updated HTML
    changes: string         // Description of changes
  }
}
```

**add_component**:
```typescript
{
  name: 'add_component',
  description: 'Add new component to website',
  parameters: {
    component_html: string, // Component HTML
    position: 'top' | 'bottom' | 'before_selector' | 'after_selector',
    selector?: string,      // CSS selector (if needed)
    description: string     // What component does
  }
}
```

**apply_theme**:
```typescript
{
  name: 'apply_theme',
  description: 'Apply visual theme to website',
  parameters: {
    theme: 'dark' | 'light' | 'blue' | 'purple' | 'glassmorphism' | ...,
    custom_colors?: {
      primary: string,
      secondary: string,
      background: string,
      text: string
    }
  }
}
```

---

## 🎯 Best Practices

### Для пользователей

1. **Будь конкретным**: "Создай navbar с логотипом слева и 3 ссылками справа"
2. **Используй клики**: Кликай на элементы чтобы дать AI контекст
3. **Drag & Drop**: Перетаскивай элементы для быстрого редактирования
4. **Итеративно**: Создай базовый сайт → улучшай по частям
5. **Экспортируй**: Используй кнопку Download для сохранения HTML

### Для AI

1. **Полный HTML**: Всегда возвращай complete HTML с <!DOCTYPE>, <head>, <body>
2. **Responsive**: Используй Tailwind CSS или media queries
3. **Semantic HTML**: Используй <header>, <nav>, <main>, <footer>
4. **Accessibility**: Добавляй alt text, ARIA labels
5. **Animations**: Используй CSS transitions для плавности

### Для разработчиков

1. **Sandbox**: Iframe всегда с sandbox="allow-scripts allow-same-origin"
2. **XSS Protection**: Sanitize HTML перед инжекцией
3. **Error Handling**: Обрабатывай ошибки парсинга HTML
4. **Performance**: Debounce обновления (150-300ms)
5. **Memory**: Revoke Object URLs при unmount

---

## 🐛 Troubleshooting

### Проблема: Сайт не появляется

**Решение**:
1. Проверь что Website Builder Skill включён
2. Убедись что AI вернул HTML код в блоке ```html
3. Открой DevTools → Console → проверь ошибки
4. Нажми кнопку Refresh в preview панели

### Проблема: Клик на элемент не работает

**Решение**:
1. Проверь что элемент не перекрыт другим элементом (z-index)
2. Убедись что JavaScript в iframe не блокирует события
3. Попробуй кликнуть на другой элемент
4. Перезагрузи preview (кнопка Refresh)

### Проблема: Drag & Drop не работает

**Решение**:
1. Убедись что элемент имеет атрибут draggable="true"
2. Проверь что браузер поддерживает Drag API
3. На мобилке используй long press (600ms)
4. Проверь что ChatInput принимает drop события

### Проблема: Стили не применяются

**Решение**:
1. Проверь что CSS находится внутри <style> тега в <head>
2. Убедись что нет конфликтов с существующими стилями
3. Используй !important для переопределения (осторожно)
4. Проверь DevTools → Elements → Computed styles

### Проблема: JavaScript не выполняется

**Решение**:
1. Проверь sandbox атрибуты iframe (allow-scripts)
2. Убедись что скрипт находится перед </body>
3. Проверь Console на ошибки
4. Используй defer или async для внешних скриптов

---

## 🔮 Roadmap

### Ближайшие улучшения

- [ ] **Component Library** — библиотека готовых компонентов
- [ ] **Template Gallery** — галерея шаблонов сайтов
- [ ] **Multi-page Support** — поддержка нескольких страниц
- [ ] **CSS Framework Selector** — выбор фреймворка (Tailwind/Bootstrap/Custom)
- [ ] **Export Options** — экспорт в ZIP с assets
- [ ] **Version History** — история изменений сайта
- [ ] **Collaborative Editing** — совместное редактирование
- [ ] **Deploy Integration** — деплой на Vercel/Netlify одной кнопкой

### Долгосрочные планы

- [ ] **React/Vue Components** — генерация компонентов фреймворков
- [ ] **Backend Integration** — подключение к API
- [ ] **Database Schema** — генерация схемы БД
- [ ] **SEO Optimization** — автоматическая оптимизация SEO
- [ ] **Performance Audit** — анализ производительности
- [ ] **A/B Testing** — тестирование вариантов дизайна
- [ ] **Analytics Integration** — подключение аналитики
- [ ] **CMS Integration** — интеграция с CMS

---

## 📚 Дополнительные ресурсы

- [ARCHITECTURE.md](../ARCHITECTURE.md) — Общая архитектура проекта
- [SKILLS_DEV_GUIDE.md](./SKILLS_DEV_GUIDE.md) — Разработка skills
- [ARTIFACTS_GUIDE.md](./ARTIFACTS_GUIDE.md) — Работа с артефактами

---

## 💡 Примеры промптов

### Создание сайтов

```
Создай portfolio сайт для фотографа с галереей в grid layout
```

```
Сделай landing page для мобильного приложения с app store badges
```

```
Создай dashboard с графиками и таблицами данных
```

### Модификация

```
Добавь sticky navbar который появляется при скролле
```

```
Сделай hero секцию с parallax эффектом
```

```
Добавь dark mode toggle в правый верхний угол
```

### Темы и стили

```
Примени glassmorphism стиль ко всем карточкам
```

```
Сделай сайт в стиле brutalism с жирными шрифтами
```

```
Примени gradient background от фиолетового к синему
```

---

**Создано для Gemini Playground** 🚀
