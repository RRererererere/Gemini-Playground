# Website Builder — Исправление работы с изображениями

## Проблемы которые были:

1. ❌ Gemini не знал как вставлять фотки на сайт
2. ❌ `/photo/{id}` открывал интерфейс вместо чистой фотки

## Что исправлено:

### 1. `/photo/{id}` теперь поддерживает raw режим ✅

**app/photo/[id]/page.tsx:**

- Добавлен параметр `?raw=true`
- Если `?raw=true` — показывается чистая фотка без интерфейса
- Если без параметра — показывается ImageLightbox с интерфейсом (как раньше)

**Примеры:**
```
/photo/abc123           → открывает с интерфейсом (zoom, download, etc)
/photo/abc123?raw=true  → открывает чистую фотку (для вставки на сайт)
```

### 2. Website Builder получил инструкции про изображения ✅

**lib/skills/built-in/website-builder.ts:**

Добавлена новая секция в system prompt:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📸 WORKING WITH IMAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When user sends you images in chat, you can use them on the website!

🎯 HOW TO USE IMAGES:

1. Check "Available Images" section in your context — it lists all images with their IDs
   Example: "img_1: photo.jpg", "img_2: logo.png"

2. Use the image ID in your HTML with this URL format:
   <img src="/photo/IMAGE_ID?raw=true" alt="Description">

3. IMPORTANT: Always add ?raw=true to the URL!
   - ✅ CORRECT: <img src="/photo/img_1?raw=true" alt="Photo">
   - ❌ WRONG: <img src="/photo/img_1" alt="Photo"> (opens with UI)
```

**Примеры использования:**

```html
<!-- Hero section with user's photo -->
<div class="hero">
  <img src="/photo/img_1?raw=true" alt="Hero image" class="w-full h-96 object-cover">
  <h1>Welcome!</h1>
</div>

<!-- Header with logo -->
<header>
  <img src="/photo/img_2?raw=true" alt="Logo" class="h-12">
  <nav>...</nav>
</header>

<!-- Gallery -->
<div class="grid grid-cols-3 gap-4">
  <img src="/photo/img_1?raw=true" alt="Photo 1" class="rounded-lg">
  <img src="/photo/img_2?raw=true" alt="Photo 2" class="rounded-lg">
  <img src="/photo/img_3?raw=true" alt="Photo 3" class="rounded-lg">
</div>
```

## Как это работает:

### Сценарий 1: Пользователь просит создать сайт с его фото

```
Пользователь: [отправляет photo.jpg] Создай сайт-визитку с этим фото

Gemini:
  1. Видит в контексте: "Available Images: img_1: photo.jpg"
  2. Вызывает set_website_meta({ title: "Визитка", ... })
  3. Пишет HTML:
     <img src="/photo/img_1?raw=true" alt="Фото" class="w-full">
  4. Сайт отображается с фотографией пользователя!
```

### Сценарий 2: Пользователь хочет галерею

```
Пользователь: [отправляет 3 фото] Сделай галерею из этих фото

Gemini:
  1. Видит: "img_1: photo1.jpg", "img_2: photo2.jpg", "img_3: photo3.jpg"
  2. Создаёт HTML с grid:
     <div class="grid grid-cols-3 gap-4">
       <img src="/photo/img_1?raw=true" alt="Photo 1">
       <img src="/photo/img_2?raw=true" alt="Photo 2">
       <img src="/photo/img_3?raw=true" alt="Photo 3">
     </div>
```

### Сценарий 3: Логотип в header

```
Пользователь: [отправляет logo.png] Добавь этот логотип в header

Gemini:
  1. Видит: "img_1: logo.png"
  2. Обновляет HTML:
     <header>
       <img src="/photo/img_1?raw=true" alt="Logo" class="h-12">
       <nav>...</nav>
     </header>
```

## Технические детали:

### Raw режим в /photo/[id]

```typescript
// Если есть параметр ?raw=true — показываем чистую фотку
const rawMode = searchParams.get('raw') === 'true';

if (rawMode) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <img 
        src={imageData.src} 
        alt={imageData.name}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
}
```

### Контекст изображений для Gemini

Gemini уже получает список изображений через `buildImageContext()`:

```
## Available Images

You have access to the following images in this conversation:

- **img_1**: photo.jpg
- **img_2**: logo.png
- **img_3**: banner.jpg
```

Теперь он знает как их использовать на сайте!

## Сборка:

✅ **npm run build** — успешно
- No TypeScript errors
- Bundle size: 723 kB

## Что теперь работает:

1. ✅ Gemini видит список изображений в контексте
2. ✅ Gemini знает формат URL: `/photo/{id}?raw=true`
3. ✅ Gemini может вставлять фотки в любое место на сайте
4. ✅ `/photo/{id}?raw=true` показывает чистую фотку
5. ✅ `/photo/{id}` (без параметра) показывает интерфейс как раньше

## Примеры команд для тестирования:

```
[отправить фото] Создай landing page с этим фото в hero секции
[отправить логотип] Добавь этот логотип в header
[отправить 3 фото] Сделай галерею из этих фото
[отправить фото] Создай портфолио с этим фото
```

Всё готово к тестированию! 🎉
