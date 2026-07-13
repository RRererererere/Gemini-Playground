import type { FileDiffOp } from '@/types';

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Применяет серию SEARCH/REPLACE правок с fuzzy matching.
 *
 * Уровни поиска:
 * 1. Точное совпадение
 * 2. Без trailing whitespace построчно
 * 3. Нормализация whitespace
 * 4. Case-insensitive exact (last resort for short keys)
 */
export function applyEdits(
  content: string,
  edits: Array<Extract<FileDiffOp, { type: 'search_replace' }> | { search: string; replace: string; description?: string }>
): {
  result: string;
  applied: number;
  failed: FileDiffOp[];
} {
  let result = normalizeNewlines(content);
  let applied = 0;
  const failed: FileDiffOp[] = [];

  for (const edit of edits) {
    const search = normalizeNewlines(edit.search ?? '');
    const replace = normalizeNewlines(edit.replace ?? '');
    const asOp: FileDiffOp = {
      type: 'search_replace',
      search,
      replace,
      description: edit.description,
    };

    if (!search || search.trim() === '') {
      failed.push(asOp);
      continue;
    }

    // Level 1: exact
    if (result.includes(search)) {
      const index = result.indexOf(search);
      result = result.slice(0, index) + replace + result.slice(index + search.length);
      applied++;
      continue;
    }

    // Level 2: strip trailing whitespace per line
    const searchStripped = search.replace(/[ \t]+$/gm, '');
    const resultLines = result.split('\n');
    const windowSize = search.split('\n').length;
    let foundStripped = false;

    for (let i = 0; i <= resultLines.length - windowSize; i++) {
      const window = resultLines.slice(i, i + windowSize).join('\n');
      const windowStripped = window.replace(/[ \t]+$/gm, '');

      if (windowStripped === searchStripped) {
        const before = resultLines.slice(0, i).join('\n');
        const after = resultLines.slice(i + windowSize).join('\n');
        result = before + (before ? '\n' : '') + replace + (after ? '\n' + after : '');
        applied++;
        foundStripped = true;
        break;
      }
    }
    if (foundStripped) continue;

    // Level 3: normalize all whitespace runs
    const searchNorm = normalizeWhitespace(search);
    const resultNorm = normalizeWhitespace(result);

    if (searchNorm && resultNorm.includes(searchNorm)) {
      const mapped = mapNormalizedRange(result, resultNorm, searchNorm);
      if (mapped) {
        result = result.slice(0, mapped.start) + replace + result.slice(mapped.end);
        applied++;
        continue;
      }
    }

    // Level 4: case-insensitive for short single-line keys (config files)
    if (!search.includes('\n') && search.length <= 80) {
      const lowerResult = result.toLowerCase();
      const lowerSearch = search.toLowerCase();
      const idx = lowerResult.indexOf(lowerSearch);
      if (idx !== -1) {
        result = result.slice(0, idx) + replace + result.slice(idx + search.length);
        applied++;
        continue;
      }
    }

    failed.push(asOp);
  }

  return { result, applied, failed };
}

/**
 * Replace lines [startLine, endLine] inclusive, 1-based.
 */
export function applyLineReplace(
  content: string,
  startLine: number,
  endLine: number,
  newContent: string
): { ok: true; result: string } | { ok: false; error: string } {
  const lines = normalizeNewlines(content).split('\n');
  const start = Math.floor(startLine);
  const end = Math.floor(endLine);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1) {
    return { ok: false, error: `Invalid line range: ${startLine}-${endLine}` };
  }
  if (start > lines.length) {
    return {
      ok: false,
      error: `startLine ${start} is beyond file length (${lines.length} lines)`,
    };
  }
  if (end < start) {
    return { ok: false, error: `endLine (${end}) < startLine (${start})` };
  }

  const safeEnd = Math.min(end, lines.length);
  const newLines = normalizeNewlines(newContent).split('\n');
  // If newContent is empty string, replace with zero lines
  const replacement = newContent === '' ? [] : newLines;

  const resultLines = [
    ...lines.slice(0, start - 1),
    ...replacement,
    ...lines.slice(safeEnd),
  ];

  return { ok: true, result: resultLines.join('\n') };
}

function mapNormalizedRange(
  original: string,
  normalized: string,
  searchNormalized: string
): { start: number; end: number } | null {
  const normIndex = normalized.indexOf(searchNormalized);
  if (normIndex < 0) return null;

  // Map normalized char index → original index by walking non-ws vs original
  // normalizeWhitespace collapses \s+ to single space and trims — mapping is approximate.
  // Better approach: walk original building normalized on the fly.
  let ni = 0;
  let start = -1;
  let end = -1;
  let i = 0;

  // Skip leading whitespace in original the same way trim() did
  while (i < original.length && /\s/.test(original[i])) i++;

  const targetStart = normIndex;
  const targetEnd = normIndex + searchNormalized.length;

  while (i < original.length && ni <= targetEnd) {
    if (/\s/.test(original[i])) {
      // collapse whitespace run to one space in normalized
      while (i < original.length && /\s/.test(original[i])) i++;
      if (ni < normalized.length && normalized[ni] === ' ') {
        if (ni === targetStart) start = i; // space itself rare as start
        ni++;
      }
      continue;
    }

    if (ni === targetStart) start = i;
    ni++;
    i++;
    if (ni === targetEnd) {
      end = i;
      break;
    }
  }

  if (start < 0 || end < 0) return null;
  return { start, end };
}

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
  const originalLines = normalizeNewlines(original).split('\n');
  const modifiedLines = normalizeNewlines(modified).split('\n');

  const diff: string[] = [];
  diff.push(`--- a/${filename}`);
  diff.push(`+++ b/${filename}`);

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

  if (hunkLines.length > 0) {
    diff.push(`@@ -${hunkStart + 1},${maxLen - hunkStart} +${hunkStart + 1},${maxLen - hunkStart} @@`);
    diff.push(...hunkLines);
  }

  return diff.join('\n');
}

/**
 * Вычисляет статистику изменений
 */
export function getDiffStats(
  original: string,
  modified: string
): {
  added: number;
  removed: number;
  changed: number;
} {
  const originalLines = normalizeNewlines(original).split('\n');
  const modifiedLines = normalizeNewlines(modified).split('\n');

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
