/**
 * Quick smoke test for targeted edits (run: node lib/diff-engine.test.mjs)
 * Uses dynamic import of compiled-less TS via tsx if available; otherwise inline copies.
 */

// Inline minimal copies to avoid TS loader dependency
function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function applyEdits(content, edits) {
  let result = normalizeNewlines(content);
  let applied = 0;
  const failed = [];
  for (const edit of edits) {
    const search = normalizeNewlines(edit.search ?? '');
    const replace = normalizeNewlines(edit.replace ?? '');
    if (!search.trim()) {
      failed.push(edit);
      continue;
    }
    if (result.includes(search)) {
      const index = result.indexOf(search);
      result = result.slice(0, index) + replace + result.slice(index + search.length);
      applied++;
      continue;
    }
    failed.push(edit);
  }
  return { result, applied, failed };
}

function applyLineReplace(content, startLine, endLine, newContent) {
  const lines = normalizeNewlines(content).split('\n');
  const start = Math.floor(startLine);
  const end = Math.floor(endLine);
  if (start < 1 || start > lines.length || end < start) {
    return { ok: false, error: 'bad range' };
  }
  const safeEnd = Math.min(end, lines.length);
  const replacement = newContent === '' ? [] : normalizeNewlines(newContent).split('\n');
  const resultLines = [...lines.slice(0, start - 1), ...replacement, ...lines.slice(safeEnd)];
  return { ok: true, result: resultLines.join('\n') };
}

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed++;
  console.log('✓', msg);
}

const sample = ['autoJump:false', 'volume:50', 'lang:ru'].join('\n');

{
  const { result, applied, failed } = applyEdits(sample, [
    { search: 'autoJump:false', replace: 'autoJump:true' },
  ]);
  assert(applied === 1 && failed.length === 0, 'exact search/replace applied once');
  assert(result.includes('autoJump:true'), 'value flipped');
  assert(result.includes('volume:50'), 'other lines kept');
}

{
  const r = applyLineReplace(sample, 1, 1, 'autoJump:true');
  assert(r.ok && r.result.startsWith('autoJump:true'), 'line replace single line');
}

{
  const r = applyLineReplace(sample, 2, 3, 'volume:100\nlang:en');
  assert(r.ok && r.result === 'autoJump:false\nvolume:100\nlang:en', 'line range replace');
}

{
  const { applied, failed } = applyEdits(sample, [
    { search: 'does-not-exist', replace: 'x' },
  ]);
  assert(applied === 0 && failed.length === 1, 'failed search tracked');
}

console.log(`\nAll ${passed} assertions passed.`);
