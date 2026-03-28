import type { FileDiffOp } from '@/types';

/**
 * Применяет серию правок к содержимому файла с fuzzy matching
 * 
 * Уровни поиска:
 * 1. Точное совпадение
 * 2. Без trailing whitespace
 * 3. Нормализация отступов
 */
export function applyEdits(content: string, edits: FileDiffOp[]): {
  result: string;
  applied: number;
  failed: FileDiffOp[];
} {
  let result = content;
  let applied = 0;
  const failed: FileDiffOp[] = [];

  for (const edit of edits) {
    // Защита от пустого search
    if (!edit.search || edit.search.trim() === '') {
      console.error('Empty search string in edit:', edit);
      failed.push(edit);
      continue;
    }

    // Уровень 1: точное совпадение
    if (result.includes(edit.search)) {
      // Проверяем что search встречается только один раз
      const occurrences = countOccurrences(result, edit.search);
      if (occurrences > 1) {
        console.warn(`Search string appears ${occurrences} times, replacing first occurrence:`, edit.search.slice(0, 50));
      }
      
      // Заменяем только первое вхождение
      const index = result.indexOf(edit.search);
      result = result.slice(0, index) + edit.replace + result.slice(index + edit.search.length);
      applied++;
      continue;
    }

    // Уровень 2: без trailing whitespace
    const searchStripped = edit.search.replace(/\s+$/gm, '');
    const resultLines = result.split('\n');
    let foundStripped = false;
    
    for (let i = 0; i < resultLines.length; i++) {
      const windowSize = edit.search.split('\n').length;
      const window = resultLines.slice(i, i + windowSize).join('\n');
      const windowStripped = window.replace(/\s+$/gm, '');
      
      if (windowStripped === searchStripped) {
        // Нашли совпадение без trailing whitespace
        const before = resultLines.slice(0, i).join('\n');
        const after = resultLines.slice(i + windowSize).join('\n');
        result = before + (before ? '\n' : '') + edit.replace + (after ? '\n' + after : '');
        applied++;
        foundStripped = true;
        break;
      }
    }
    
    if (foundStripped) continue;

    // Уровень 3: нормализация отступов (заменяем все whitespace на один пробел)
    const searchNormalized = normalizeWhitespace(edit.search);
    const resultNormalized = normalizeWhitespace(result);
    
    if (resultNormalized.includes(searchNormalized)) {
      // Находим позицию в нормализованной строке
      const normalizedIndex = resultNormalized.indexOf(searchNormalized);
      
      // Восстанавливаем позицию в оригинальной строке (приблизительно)
      let charCount = 0;
      let originalIndex = 0;
      
      for (let i = 0; i < result.length; i++) {
        if (charCount >= normalizedIndex) {
          originalIndex = i;
          break;
        }
        if (!/\s/.test(result[i])) {
          charCount++;
        }
      }
      
      // Находим конец совпадения
      let endCharCount = charCount + searchNormalized.replace(/\s/g, '').length;
      let originalEndIndex = originalIndex;
      
      for (let i = originalIndex; i < result.length; i++) {
        if (charCount >= endCharCount) {
          originalEndIndex = i;
          break;
        }
        if (!/\s/.test(result[i])) {
          charCount++;
        }
      }
      
      result = result.slice(0, originalIndex) + edit.replace + result.slice(originalEndIndex);
      applied++;
      continue;
    }

    // Не удалось найти совпадение
    failed.push(edit);
  }

  return { result, applied, failed };
}

/**
 * Подсчитывает количество вхождений подстроки
 */
function countOccurrences(text: string, search: string): number {
  let count = 0;
  let pos = 0;
  
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  
  return count;
}

/**
 * Нормализует whitespace для fuzzy matching
 */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Генерирует unified diff для отображения изменений
 */
export function generateUnifiedDiff(
  original: string,
  modified: string,
  filename: string
): string {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  const diff: string[] = [];
  diff.push(`--- a/${filename}`);
  diff.push(`+++ b/${filename}`);
  
  // Простой line-by-line diff (можно улучшить с Myers algorithm)
  const maxLen = Math.max(originalLines.length, modifiedLines.length);
  let hunkStart = -1;
  let hunkLines: string[] = [];
  
  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i];
    const modLine = modifiedLines[i];
    
    if (origLine === modLine) {
      if (hunkStart !== -1) {
        hunkLines.push(` ${origLine || ''}`);
      }
    } else {
      if (hunkStart === -1) {
        hunkStart = i;
      }
      
      if (origLine !== undefined) {
        hunkLines.push(`-${origLine}`);
      }
      if (modLine !== undefined) {
        hunkLines.push(`+${modLine}`);
      }
    }
    
    // Закрываем hunk если нашли 3 одинаковые строки подряд
    if (origLine === modLine && hunkLines.length > 0) {
      const lastThree = hunkLines.slice(-3);
      if (lastThree.every(l => l.startsWith(' '))) {
        diff.push(`@@ -${hunkStart + 1},${i - hunkStart} +${hunkStart + 1},${i - hunkStart} @@`);
        diff.push(...hunkLines.slice(0, -3));
        hunkStart = -1;
        hunkLines = [];
      }
    }
  }
  
  // Закрываем последний hunk
  if (hunkLines.length > 0) {
    diff.push(`@@ -${hunkStart + 1},${maxLen - hunkStart} +${hunkStart + 1},${maxLen - hunkStart} @@`);
    diff.push(...hunkLines);
  }
  
  return diff.join('\n');
}

/**
 * Вычисляет статистику изменений
 */
export function getDiffStats(original: string, modified: string): {
  added: number;
  removed: number;
  changed: number;
} {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  let added = 0;
  let removed = 0;
  let changed = 0;
  
  const maxLen = Math.max(originalLines.length, modifiedLines.length);
  
  for (let i = 0; i < maxLen; i++) {
    const origLine = originalLines[i];
    const modLine = modifiedLines[i];
    
    if (origLine === undefined) {
      added++;
    } else if (modLine === undefined) {
      removed++;
    } else if (origLine !== modLine) {
      changed++;
    }
  }
  
  return { added, removed, changed };
}
