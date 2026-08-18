// Script wave 2 — replace remaining Russian text in node-definitions.ts
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'agent-engine', 'node-definitions.ts');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
  // System Prompt leftover
  ['System Prompt для (инструкции для роли AI)', 'System prompt for the model (role instructions)'],
  
  // Memory Read remaining
  ['Массив найденных записей памяти', 'Array of found memory records'],
  ['Найденные данные в виде текста для подачи в LLM', 'Found data as text for LLM input'],
  ['Найденные данные (legacy порт)', 'Found data (legacy port)'],
  ['Number of results found записей', 'Number of results found'],
  ['Были ли найдены данные', 'Whether data was found'],
  ["{ value: 'exact_key', label: 'Точный ключ' }", "{ value: 'exact_key', label: 'Exact key' }"],
  ["{ value: 'list_all', label: 'All записи' }", "{ value: 'list_all', label: 'List all' }"],
  ["{ value: 'recent_n', label: 'Последние N' }", "{ value: 'recent_n', label: 'Recent N' }"],
  ["{ value: 'local', label: 'Локально (текущий чат)' }", "{ value: 'local', label: 'Local (current chat)' }"],
  ["{ value: 'global', label: 'Глобально' }", "{ value: 'global', label: 'Global' }"],
  ["label: 'Лимит',", "label: 'Limit',"],
  ['Максимальное количество результатов', 'Maximum number of results'],
  
  // Memory Write remaining
  ['Ключ для сохранения', 'Key for storage'],
  ['Данные для сохранения', 'Data to save'],
  ['Успешно ли сохранено', 'Whether save was successful'],
  ['Сохранённые данные', 'Saved data'],
  ["{ value: 'upsert', label: 'Добавить/заменить' }", "{ value: 'upsert', label: 'Upsert' }"],
  ["{ value: 'append', label: 'Дописать' }", "{ value: 'append', label: 'Append' }"],
  ["label: 'TTL (секунды)',", "label: 'TTL (seconds)',"],
  ['Время жизни (0 = бессрочно)', 'Time to live (0 = forever)'],

  // Condition Node
  ['❓ Маршрутизация данных по условию. Напишите JavaScript выражение, которое возвращает true/false. Input попадет либо в True, либо в False выход.', 'Route data based on a condition. Write a JavaScript expression that returns true/false. Input goes to either the True or False output.'],
  ['Данные для проверки и передачи в ветку', 'Data to evaluate and route'],
  ['Переопределение JS-условия из настроек. Ожидается: boolean.', 'Override JS condition from settings. Expected: boolean.'],
  ['Выход если условие истинно', 'Output if condition is true'],
  ['Выход если условие ложно', 'Output if condition is false'],
  ['JavaScript выражение, возвращающее true/false. Доступны: context (все входы), input (данные).', 'JavaScript expression returning true/false. Available: context (all inputs), input (data).'],

  // Router Node
  ['Маршрутизация по условиям', 'Route data based on conditions'],
  ['Данные для маршрутизации', 'Data to route'],
  ["label: 'Режим маршрутизации',", "label: 'Routing Mode',"],
  ["{ value: 'if_else', label: 'Цепочка If-Else' }", "{ value: 'if_else', label: 'If-Else chain' }"],
  ["{ value: 'regex_match', label: 'Совпадение Regex' }", "{ value: 'regex_match', label: 'Regex match' }"],
  ["{ value: 'llm_classify', label: 'Классификация LLM' }", "{ value: 'llm_classify', label: 'LLM classify' }"],
  ["label: 'Condition маршрута A',", "label: 'Route A Condition',"],
  ["label: 'Condition маршрута B',", "label: 'Route B Condition',"],
  ["label: 'Condition маршрута C',", "label: 'Route C Condition',"],

  // Loop Node
  ['Итерация по элементам', 'Iterate over elements'],
  ['Массив для итерации', 'Array to iterate over'],
  ['Result обработки текущего элемента', 'Result of processing current element'],
  ['Current item итерации', 'Current iteration item'],
  ['All результаты после завершения', 'All results after completion'],
  ["label: 'Макс. итераций',", "label: 'Max Iterations',"],
  ['Максимальное количество итераций', 'Maximum number of iterations'],
  ["label: 'Итерировать по',", "label: 'Iterate over',"],
  ["{ value: 'array_items', label: 'Элементы массива' }", "{ value: 'array_items', label: 'Array items' }"],
  ["{ value: 'range', label: 'Диапазон чисел' }", "{ value: 'range', label: 'Number range' }"],
  ["{ value: 'json_array_field', label: 'Поле JSON-массива' }", "{ value: 'json_array_field', label: 'JSON array field' }"],

  // Merge Node
  ['Объединение нескольких потоков', 'Combine multiple streams'],
  ['Первый поток', 'First stream'],
  ['Второй поток', 'Second stream'],
  ['Третий поток', 'Third stream'],
  ["{ value: 'concat_text', label: 'Склеить текст' }", "{ value: 'concat_text', label: 'Concatenate text' }"],
  ["{ value: 'merge_objects', label: 'Слить объекты' }", "{ value: 'merge_objects', label: 'Merge objects' }"],
  ["{ value: 'array_collect', label: 'Собрать в массив' }", "{ value: 'array_collect', label: 'Collect into array' }"],
  ["{ value: 'first_non_null', label: 'Первое непустое' }", "{ value: 'first_non_null', label: 'First non-null' }"],
  ["Separator для concat_text", "Separator for concat_text"],

  // Split Node
  ['Разделение данных на части', 'Split data into parts'],
];

let count = 0;
for (const [ru, en] of replacements) {
  if (content.includes(ru)) {
    content = content.split(ru).join(en);
    count++;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Wave 2: Replaced ${count} additional Russian text occurrences.`);

const remaining = content.match(/[а-яА-ЯёЁ]+/g);
if (remaining) {
  const unique = [...new Set(remaining)];
  console.log(`\nRemaining Russian words (${remaining.length} total, ${unique.length} unique):`, unique.slice(0, 20).join(', '));
} else {
  console.log('\nNo Russian text remaining!');
}
