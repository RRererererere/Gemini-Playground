# Requirements Document

## Introduction

Gemini Studio — это Next.js 14 приложение для чата с AI через Gemini API. Текущая версия поддерживает базовую загрузку изображений (base64 в сообщениях), сохранение чатов в localStorage/IndexedDB, и DeepThink режим для анализа контекста разговора.

Данный документ описывает требования для расширения функциональности тремя новыми системами:

1. **Система анализа изображений** — автоматический анализ загруженных изображений с извлечением метаданных, описаний и тегов
2. **Система памяти** — долгосрочное хранение контекста между сессиями с автоматическим извлечением релевантной информации
3. **Векторная база данных** — хранение и семантический поиск по эмбеддингам сообщений, изображений и фактов

Эти системы интегрируются с существующей архитектурой и используют Gemini API для генерации эмбеддингов и анализа контента.

## Glossary

- **Vision_System**: Система анализа изображений, использующая Gemini Vision API
- **Memory_System**: Система долгосрочной памяти для хранения фактов и контекста между сессиями
- **Vector_Database**: Локальная векторная БД (IndexedDB) для хранения и поиска эмбеддингов
- **Embedding**: Векторное представление текста или изображения (768-мерный вектор от Gemini)
- **Memory_Entry**: Запись в системе памяти (факт, предпочтение, контекст)
- **Image_Analysis**: Результат анализа изображения (описание, теги, объекты, текст)
- **Semantic_Search**: Поиск по смыслу через косинусное сходство векторов
- **Chat_Context**: Контекст текущего чата (последние N сообщений + релевантная память)

- **Relevance_Score**: Оценка релевантности записи памяти к текущему контексту (0-1)
- **Auto_Tagging**: Автоматическое извлечение тегов из контента
- **Fact_Extraction**: Извлечение фактов из разговора для сохранения в память
- **Context_Window**: Окно контекста для отправки в Gemini API (включает историю + память)

## Requirements

### Requirement 1: Image Analysis System

**User Story:** Как пользователь, я хочу автоматически анализировать загруженные изображения, чтобы AI понимал их содержимое и мог использовать эту информацию в разговоре.

#### Acceptance Criteria

1. WHEN пользователь загружает изображение в чат, THE Vision_System SHALL отправить изображение в Gemini Vision API для анализа
2. THE Vision_System SHALL извлечь из изображения: детальное описание, список объектов, распознанный текст (OCR), цветовую палитру, и автоматические теги
3. THE Image_Analysis SHALL сохраняться вместе с AttachedFile в структуре сообщения
4. WHEN изображение анализируется, THE Vision_System SHALL показать индикатор загрузки и прогресс анализа
5. THE Vision_System SHALL обрабатывать ошибки API (rate limits, invalid images) и показывать понятные сообщения пользователю
6. WHERE пользователь включил настройку "Auto-analyze images", THE Vision_System SHALL автоматически анализировать все загруженные изображения
7. WHERE пользователь выключил автоанализ, THE Vision_System SHALL показывать кнопку "Analyze" для ручного запуска анализа
8. THE Vision_System SHALL кэшировать результаты анализа в IndexedDB по хешу изображения
9. WHEN изображение уже было проанализировано ранее, THE Vision_System SHALL загрузить результат из кэша вместо повторного API запроса

10. THE Vision_System SHALL генерировать эмбеддинг для каждого проанализированного изображения и сохранять его в Vector_Database
11. WHEN пользователь спрашивает об изображении, THE Vision_System SHALL использовать сохраненный анализ для формирования ответа

### Requirement 2: Long-Term Memory System

**User Story:** Как пользователь, я хочу чтобы AI запоминал важную информацию обо мне между сессиями, чтобы не повторять одно и то же в каждом новом чате.

#### Acceptance Criteria

1. THE Memory_System SHALL автоматически извлекать факты из разговора после каждого ответа модели
2. WHEN модель генерирует ответ, THE Memory_System SHALL анализировать последние 3-5 сообщений и извлекать: факты о пользователе, предпочтения, важные детали контекста, упомянутые имена и даты
3. THE Memory_Entry SHALL содержать: уникальный ID, текст факта, категорию (personal/preference/context/technical), timestamp, source_chat_id, embedding вектор, и теги
4. THE Memory_System SHALL сохранять Memory_Entry в IndexedDB с индексами по категории и timestamp
5. WHEN пользователь начинает новое сообщение, THE Memory_System SHALL выполнить семантический поиск релевантных записей памяти
6. THE Memory_System SHALL использовать эмбеддинг текущего сообщения для поиска топ-5 наиболее релевантных Memory_Entry
7. THE Memory_System SHALL добавлять релевантные записи памяти в системный промпт перед отправкой в Gemini API
8. THE Memory_System SHALL показывать UI индикатор когда память используется в текущем запросе
9. WHERE пользователь открыл настройки памяти, THE Memory_System SHALL показать список всех сохраненных фактов с возможностью редактирования и удаления

10. THE Memory_System SHALL группировать похожие факты и предлагать объединение дубликатов
11. WHEN пользователь удаляет чат, THE Memory_System SHALL спросить хотят ли они сохранить извлеченные факты
12. THE Memory_System SHALL поддерживать экспорт и импорт памяти в JSON формате
13. WHERE пользователь включил настройку "Auto-extract facts", THE Memory_System SHALL автоматически извлекать факты после каждого ответа
14. WHERE автоизвлечение выключено, THE Memory_System SHALL показывать кнопку "Save to memory" для ручного сохранения
15. THE Memory_System SHALL ограничивать размер памяти до 1000 записей и автоматически удалять самые старые при превышении лимита

### Requirement 3: Vector Database System

**User Story:** Как пользователь, я хочу искать по смыслу в своих чатах и памяти, чтобы быстро находить релевантную информацию.

#### Acceptance Criteria

1. THE Vector_Database SHALL использовать IndexedDB для хранения эмбеддингов с индексами по типу и timestamp
2. THE Vector_Database SHALL хранить записи формата: id, type (message/image/memory), embedding (Float32Array), metadata (chat_id, timestamp, preview_text), и tags
3. WHEN новое сообщение отправляется, THE Vector_Database SHALL генерировать эмбеддинг через Gemini Embedding API
4. THE Vector_Database SHALL использовать модель "text-embedding-004" для генерации 768-мерных векторов
5. THE Vector_Database SHALL батчить запросы эмбеддингов (до 100 текстов за раз) для оптимизации API вызовов
6. THE Vector_Database SHALL кэшировать эмбеддинги и не генерировать повторно для идентичного текста

7. WHEN пользователь выполняет Semantic_Search, THE Vector_Database SHALL вычислить косинусное сходство между query эмбеддингом и всеми сохраненными векторами
8. THE Vector_Database SHALL возвращать топ-K результатов отсортированных по Relevance_Score
9. THE Vector_Database SHALL поддерживать фильтрацию по типу (message/image/memory) и временному диапазону
10. THE Vector_Database SHALL предоставлять API для добавления, удаления, и поиска векторов
11. WHEN чат удаляется, THE Vector_Database SHALL удалить все связанные эмбеддинги сообщений
12. THE Vector_Database SHALL оптимизировать хранение используя сжатие Float32Array
13. WHERE база данных превышает 10000 записей, THE Vector_Database SHALL показать предупреждение о размере и предложить очистку старых данных

### Requirement 4: Embedding API Integration

**User Story:** Как система, я хочу эффективно генерировать эмбеддинги через Gemini API, чтобы минимизировать задержки и расход квоты.

#### Acceptance Criteria

1. THE Embedding_API SHALL использовать endpoint "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents"
2. THE Embedding_API SHALL поддерживать батчинг до 100 запросов за один API вызов
3. WHEN генерируется эмбеддинг, THE Embedding_API SHALL обрабатывать rate limits и автоматически повторять запрос с exponential backoff
4. THE Embedding_API SHALL кэшировать результаты в памяти для идентичных текстов в рамках одной сессии
5. THE Embedding_API SHALL использовать ту же систему ротации API ключей что и основной чат
6. WHEN API возвращает ошибку, THE Embedding_API SHALL логировать детали и показывать понятное сообщение пользователю

7. THE Embedding_API SHALL нормализовать векторы для косинусного сходства (если API не возвращает нормализованные)
8. THE Embedding_API SHALL поддерживать генерацию эмбеддингов для текста и изображений (через multimodal embedding)

### Requirement 5: Memory UI and Controls

**User Story:** Как пользователь, я хочу управлять системой памяти через удобный интерфейс, чтобы контролировать что AI запоминает обо мне.

#### Acceptance Criteria

1. THE Memory_UI SHALL показывать иконку "мозг" в сайдбаре для доступа к настройкам памяти
2. WHEN пользователь открывает Memory_UI, THE Memory_UI SHALL показать список всех Memory_Entry сгруппированных по категориям
3. THE Memory_UI SHALL поддерживать поиск по тексту и фильтрацию по категориям и датам
4. THE Memory_UI SHALL показывать для каждой записи: текст факта, категорию, дату создания, source chat (с ссылкой), и теги
5. WHEN пользователь кликает на Memory_Entry, THE Memory_UI SHALL показать детальный просмотр с возможностью редактирования
6. THE Memory_UI SHALL позволять пользователю вручную добавлять новые факты через форму
7. THE Memory_UI SHALL показывать индикатор "Memory active" в ChatInput когда релевантная память используется
8. WHEN пользователь наводит на индикатор памяти, THE Memory_UI SHALL показать tooltip со списком используемых фактов
9. THE Memory_UI SHALL предоставлять toggle для включения/выключения автоматического извлечения фактов
10. THE Memory_UI SHALL показывать статистику: общее количество фактов, использование памяти, последнее обновление

11. WHERE пользователь удаляет Memory_Entry, THE Memory_UI SHALL также удалить связанный эмбеддинг из Vector_Database
12. THE Memory_UI SHALL поддерживать bulk операции: выбрать несколько записей и удалить/экспортировать

### Requirement 6: Image Analysis UI

**User Story:** Как пользователь, я хочу видеть результаты анализа изображений прямо в чате, чтобы понимать что AI "видит" на картинке.

#### Acceptance Criteria

1. WHEN изображение анализируется, THE Image_UI SHALL показать индикатор прогресса на превью изображения
2. WHEN анализ завершен, THE Image_UI SHALL показать иконку "глаз" на превью для доступа к результатам
3. WHEN пользователь кликает на иконку анализа, THE Image_UI SHALL открыть модальное окно с детальными результатами
4. THE Image_UI SHALL показывать в модальном окне: полное описание, список объектов с confidence scores, распознанный текст, цветовую палитру, и теги
5. THE Image_UI SHALL позволять копировать описание и теги в буфер обмена
6. WHERE автоанализ выключен, THE Image_UI SHALL показывать кнопку "Analyze image" на превью
7. THE Image_UI SHALL показывать ошибки анализа с возможностью повторить попытку
8. THE Image_UI SHALL поддерживать сравнение анализа нескольких изображений side-by-side
9. WHEN изображение содержит текст, THE Image_UI SHALL выделять его отдельным блоком с возможностью копирования

### Requirement 7: Semantic Search UI

**User Story:** Как пользователь, я хочу искать по смыслу в своих чатах, чтобы находить информацию даже если не помню точные слова.

#### Acceptance Criteria

1. THE Search_UI SHALL добавить иконку поиска в сайдбар для доступа к семантическому поиску

2. WHEN пользователь вводит поисковый запрос, THE Search_UI SHALL генерировать эмбеддинг и выполнить Semantic_Search
3. THE Search_UI SHALL показывать результаты с Relevance_Score, превью текста, и ссылкой на исходный чат
4. THE Search_UI SHALL поддерживать фильтры: тип контента (messages/images/memory), временной диапазон, и минимальный Relevance_Score
5. WHEN пользователь кликает на результат, THE Search_UI SHALL открыть соответствующий чат и прокрутить к сообщению
6. THE Search_UI SHALL показывать индикатор загрузки во время генерации эмбеддинга и поиска
7. THE Search_UI SHALL поддерживать поиск по изображениям: загрузить изображение и найти похожие
8. THE Search_UI SHALL показывать "No results" с предложениями если ничего не найдено
9. THE Search_UI SHALL кэшировать последние 10 поисковых запросов для быстрого доступа

### Requirement 8: Context Enhancement with Memory

**User Story:** Как система, я хочу автоматически обогащать контекст релевантной памятью, чтобы AI давал более персонализированные ответы.

#### Acceptance Criteria

1. WHEN пользователь отправляет сообщение, THE Context_Builder SHALL собрать Chat_Context из последних 10 сообщений
2. THE Context_Builder SHALL выполнить Semantic_Search в Memory_System используя эмбеддинг текущего сообщения
3. THE Context_Builder SHALL выбрать топ-5 Memory_Entry с Relevance_Score > 0.7
4. THE Context_Builder SHALL добавить релевантные факты в системный промпт в формате: "[Memory] {fact_text}"
5. THE Context_Builder SHALL ограничить добавленную память до 500 токенов чтобы не превысить context window
6. WHEN DeepThink режим активен, THE Context_Builder SHALL также передать релевантную память в DeepThink анализ

7. THE Context_Builder SHALL логировать какие факты были использованы для отладки
8. WHERE пользователь выключил память в настройках, THE Context_Builder SHALL пропустить добавление Memory_Entry
9. THE Context_Builder SHALL приоритизировать более свежие факты при одинаковом Relevance_Score

### Requirement 9: Fact Extraction System

**User Story:** Как система, я хочу автоматически извлекать важные факты из разговора, чтобы пополнять долгосрочную память.

#### Acceptance Criteria

1. WHEN модель генерирует ответ, THE Fact_Extractor SHALL анализировать последние 3-5 сообщений для извлечения фактов
2. THE Fact_Extractor SHALL использовать Gemini API с специальным промптом для извлечения фактов
3. THE Fact_Extractor SHALL извлекать: факты о пользователе (имя, профессия, интересы), предпочтения (любимые темы, стиль общения), технические детали (используемые технологии, проекты), и контекстную информацию (текущие задачи, цели)
4. THE Fact_Extractor SHALL возвращать факты в структурированном JSON формате с категориями и тегами
5. THE Fact_Extractor SHALL фильтровать тривиальные факты (приветствия, благодарности) и дубликаты
6. WHEN факт извлечен, THE Fact_Extractor SHALL проверить существует ли похожий факт в памяти (через Semantic_Search)
7. IF похожий факт найден с Relevance_Score > 0.9, THEN THE Fact_Extractor SHALL обновить существующий факт вместо создания нового
8. THE Fact_Extractor SHALL генерировать эмбеддинг для каждого извлеченного факта
9. THE Fact_Extractor SHALL сохранять факты в Memory_System и Vector_Database атомарно
10. WHERE автоизвлечение включено, THE Fact_Extractor SHALL работать в фоне без блокировки UI

11. THE Fact_Extractor SHALL показывать уведомление когда новые факты добавлены в память
12. THE Fact_Extractor SHALL обрабатывать ошибки API gracefully и не прерывать основной поток чата

### Requirement 10: Data Export and Import

**User Story:** Как пользователь, я хочу экспортировать и импортировать свою память и векторную базу, чтобы переносить данные между устройствами.

#### Acceptance Criteria

1. THE Export_System SHALL поддерживать экспорт всей памяти в JSON файл
2. THE Export_System SHALL включать в экспорт: все Memory_Entry, метаданные, и эмбеддинги
3. THE Export_System SHALL сжимать эмбеддинги для уменьшения размера файла
4. THE Export_System SHALL добавлять версию формата и timestamp в экспортированный файл
5. THE Import_System SHALL валидировать формат импортируемого файла перед загрузкой
6. WHEN пользователь импортирует память, THE Import_System SHALL предложить: заменить существующую память, объединить с существующей, или отменить
7. THE Import_System SHALL показывать прогресс импорта для больших файлов
8. THE Import_System SHALL обрабатывать конфликты дубликатов через Semantic_Search
9. THE Export_System SHALL поддерживать экспорт результатов анализа изображений отдельно
10. THE Export_System SHALL позволять выборочный экспорт по категориям и датам

### Requirement 11: Performance and Optimization

**User Story:** Как система, я хочу эффективно работать с большими объемами данных, чтобы не замедлять пользовательский интерфейс.

#### Acceptance Criteria

1. THE Vector_Database SHALL использовать Web Workers для вычисления косинусного сходства

2. THE Vector_Database SHALL индексировать векторы для ускорения поиска при базе > 1000 записей
3. THE Memory_System SHALL лениво загружать Memory_Entry (только метаданные при старте, полные данные по требованию)
4. THE Embedding_API SHALL дебаунсить запросы на 300ms для избежания лишних API вызовов
5. THE Vision_System SHALL сжимать изображения перед отправкой в API если размер > 4MB
6. THE Vector_Database SHALL использовать IndexedDB транзакции для батчевых операций
7. THE Memory_System SHALL кэшировать часто используемые факты в памяти
8. WHEN база данных превышает 5000 записей, THE System SHALL предложить архивировать старые данные
9. THE System SHALL измерять и логировать время выполнения критических операций (embedding generation, search)
10. THE System SHALL показывать предупреждение если операция занимает > 5 секунд

### Requirement 12: Privacy and Security

**User Story:** Как пользователь, я хочу контролировать свои данные и быть уверенным в их безопасности.

#### Acceptance Criteria

1. THE System SHALL хранить все данные локально в браузере (IndexedDB + localStorage)
2. THE System SHALL не отправлять данные на сторонние серверы кроме Gemini API
3. THE Memory_System SHALL позволять пользователю полностью очистить всю память одной кнопкой
4. THE System SHALL показывать предупреждение перед удалением больших объемов данных
5. THE System SHALL поддерживать экспорт логов API запросов для аудита
6. WHERE пользователь использует несколько API ключей, THE System SHALL изолировать данные между ключами
7. THE System SHALL шифровать чувствительные данные в localStorage (опционально)

8. THE System SHALL предоставлять настройку для автоматического удаления памяти старше N дней
9. THE System SHALL логировать все операции с памятью для возможности отката

### Requirement 13: Settings and Configuration

**User Story:** Как пользователь, я хочу настраивать поведение систем памяти и анализа, чтобы адаптировать их под свои нужды.

#### Acceptance Criteria

1. THE Settings_UI SHALL добавить секцию "Memory & Vision" в настройки
2. THE Settings_UI SHALL предоставлять toggles для: автоматического извлечения фактов, автоматического анализа изображений, использования памяти в контексте, и показа индикаторов памяти
3. THE Settings_UI SHALL позволять настроить: максимальное количество фактов в памяти, минимальный Relevance_Score для поиска, количество релевантных фактов в контексте, и время жизни кэша эмбеддингов
4. THE Settings_UI SHALL показывать текущее использование: количество фактов, размер Vector_Database, количество проанализированных изображений
5. THE Settings_UI SHALL предоставлять кнопки для: очистки всей памяти, очистки векторной базы, очистки кэша анализа изображений, и экспорта/импорта данных
6. THE Settings_UI SHALL показывать предупреждения перед деструктивными операциями
7. THE Settings_UI SHALL сохранять настройки в localStorage и применять их немедленно
8. THE Settings_UI SHALL предоставлять preset конфигурации: "Minimal" (только ручное управление), "Balanced" (умеренное автоизвлечение), "Aggressive" (максимальное запоминание)

### Requirement 14: Error Handling and Resilience

**User Story:** Как система, я хочу gracefully обрабатывать ошибки, чтобы не ломать пользовательский опыт.

#### Acceptance Criteria

1. WHEN Gemini API недоступен, THE System SHALL показать понятное сообщение и предложить повторить позже

2. WHEN IndexedDB недоступна (private mode), THE System SHALL fallback на in-memory хранение с предупреждением
3. WHEN эмбеддинг не может быть сгенерирован, THE System SHALL сохранить факт без эмбеддинга и пометить для повторной попытки
4. WHEN Vector_Database поврежден, THE System SHALL предложить пересоздать базу из существующих данных
5. IF операция занимает > 30 секунд, THEN THE System SHALL показать возможность отменить операцию
6. THE System SHALL логировать все ошибки в консоль с контекстом для отладки
7. THE System SHALL показывать toast уведомления для некритичных ошибок
8. THE System SHALL использовать retry logic с exponential backoff для временных ошибок API
9. WHEN quota API исчерпана, THE System SHALL показать оставшееся время до сброса
10. THE System SHALL сохранять состояние перед критичными операциями для возможности отката

### Requirement 15: Additional Features and Enhancements

**User Story:** Как пользователь, я хочу дополнительные возможности для работы с памятью и изображениями.

#### Acceptance Criteria

1. THE System SHALL поддерживать создание "Memory Collections" — тематических групп фактов
2. THE System SHALL позволять помечать факты как "Important" для приоритизации в контексте
3. THE System SHALL поддерживать связывание фактов между собой (граф знаний)
4. THE System SHALL показывать timeline визуализацию памяти по датам
5. THE System SHALL поддерживать автоматическое суммирование длинных чатов в компактные факты
6. THE System SHALL предлагать "Memory insights" — анализ паттернов в сохраненных фактах
7. THE Vision_System SHALL поддерживать сравнение изображений (найти отличия, похожие элементы)

8. THE Vision_System SHALL извлекать метаданные EXIF из изображений (дата, камера, геолокация)
9. THE System SHALL поддерживать голосовые заметки в память (через Speech-to-Text)
10. THE System SHALL интегрироваться с DeepThink для более глубокого анализа контекста с учетом памяти
11. THE System SHALL поддерживать "Forget mode" — временное отключение памяти для приватных разговоров
12. THE System SHALL показывать "Memory suggestions" — предложения что можно сохранить из текущего чата

## Implementation Notes

### Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Storage**: IndexedDB (векторы, изображения, память), localStorage (настройки)
- **API**: Gemini API (chat, vision, embeddings)
- **Libraries**: 
  - `idb` для удобной работы с IndexedDB
  - `ml-distance` для вычисления косинусного сходства
  - `hash-wasm` для хеширования изображений

### API Endpoints to Create

1. `/api/embeddings` — генерация эмбеддингов (batch support)
2. `/api/vision/analyze` — анализ изображений через Gemini Vision
3. `/api/memory/extract` — извлечение фактов из разговора
4. `/api/memory/search` — семантический поиск в памяти

### Database Schema (IndexedDB)

**Store: vectors**
- id (string, primary key)
- type (string: 'message' | 'image' | 'memory')
- embedding (Float32Array)
- metadata (object: chat_id, timestamp, preview_text)
- tags (string[])
- created_at (number)

**Store: memory**
- id (string, primary key)
- text (string)
- category (string: 'personal' | 'preference' | 'context' | 'technical')
- source_chat_id (string)
- timestamp (number)
- tags (string[])
- importance (number: 0-1)
- embedding_id (string, foreign key to vectors)

**Store: image_analysis**
- image_hash (string, primary key)
- description (string)
- objects (array)
- ocr_text (string)
- colors (array)
- tags (string[])
- analyzed_at (number)
- embedding_id (string)

### Performance Targets

- Embedding generation: < 2s for single text, < 5s for batch of 10
- Semantic search: < 500ms for database of 1000 vectors
- Image analysis: < 5s for typical image
- Fact extraction: < 3s in background
- Memory context injection: < 100ms

### Future Enhancements

- Поддержка multimodal embeddings (текст + изображение вместе)
- Интеграция с внешними knowledge bases (Wikipedia, документация)
- Collaborative memory (синхронизация между устройствами через cloud)
- Advanced graph visualization для связей между фактами
- Automatic memory consolidation (объединение похожих фактов)
- Smart notifications когда память может быть полезна
