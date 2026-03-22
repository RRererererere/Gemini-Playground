// Примеры обработки ошибок Gemini API
import { classifyGeminiError } from './gemini-errors';

// Пример 1: Ошибка квоты с превышением лимита входных токенов
const error1 = classifyGeminiError(
  429,
  'You exceeded your current quota, please check your plan and billing details. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count'
);
console.log('Ошибка квоты (input tokens):', error1);
// Результат: { errorType: 'quota', userMessage: 'Контекст слишком большой. Попробуйте сократить сообщение или начать новый чат.' }

// Пример 2: Ошибка квоты с превышением лимита выходных токенов
const error2 = classifyGeminiError(
  429,
  'Quota exceeded for metric: output_token_count'
);
console.log('Ошибка квоты (output tokens):', error2);
// Результат: { errorType: 'quota', userMessage: 'Превышен лимит токенов ответа. Попробуйте позже или используйте другую модель.' }

// Пример 3: Общая ошибка квоты
const error3 = classifyGeminiError(
  429,
  'You exceeded your current quota, please check your plan and billing details.'
);
console.log('Ошибка квоты (общая):', error3);
// Результат: { errorType: 'quota', userMessage: 'Превышена квота API. Попробуйте позже или проверьте лимиты вашего аккаунта.' }

// Пример 4: Rate limit
const error4 = classifyGeminiError(
  429,
  'Rate limit exceeded. Please retry in 49.577498103s'
);
console.log('Rate limit:', error4);
// Результат: { errorType: 'rate_limit', userMessage: 'Слишком много запросов. Подождите немного и попробуйте снова.' }

// Пример 5: Неверный API ключ
const error5 = classifyGeminiError(
  401,
  'API key not valid'
);
console.log('Неверный ключ:', error5);
// Результат: { errorType: 'invalid_key', userMessage: 'Неверный API ключ. Проверьте настройки.' }
