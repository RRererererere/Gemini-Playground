/**
 * File Editor Bridge — единый источник правды для редактора.
 * Skill (tool calls) и UI (React) читают/пишут через этот модуль.
 * Синхронизация мгновенная через CustomEvent, без polling.
 */

import type { OpenFile, FileDiffOp, AttachedFile, FileHistoryEntry } from '@/types';
import { applyEdits, applyLineReplace } from '@/lib/diff-engine';

const STORAGE_SUFFIX = 'file_editor_open_files';
const PENDING_SUFFIX = 'file_editor_pending_edits';
const EVENT_NAME = 'file-editor:changed';

export type FileEditorSnapshot = {
  chatId: string;
  openFiles: OpenFile[];
  pendingEdits: Record<string, FileDiffOp[]>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat id / keys
// ─────────────────────────────────────────────────────────────────────────────

/** Стабильный id для чата без сохранённого id (новый чат). */
export function resolveEditorChatId(chatId: string | null | undefined): string {
  if (chatId && chatId.trim()) return chatId.trim();
  if (typeof window === 'undefined') return '_session';
  try {
    let sid = sessionStorage.getItem('file_editor_session_id');
    if (!sid) {
      sid = `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('file_editor_session_id', sid);
    }
    return sid;
  } catch {
    return '_session';
  }
}

function openFilesKey(chatId: string): string {
  return `skill_data_file-editor_${resolveEditorChatId(chatId)}_${STORAGE_SUFFIX}`;
}

function pendingKey(chatId: string): string {
  return `skill_data_file-editor_${resolveEditorChatId(chatId)}_${PENDING_SUFFIX}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Text decode / language
// ─────────────────────────────────────────────────────────────────────────────

/** Декодирует base64 текста (UTF-8 safe). */
export function decodeBase64Text(base64: string): string {
  if (!base64) return '';
  // Уже plain text? (на всякий случай)
  if (base64.includes('\n') && !/^[A-Za-z0-9+/=\s]+$/.test(base64.slice(0, 80))) {
    return base64;
  }
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    try {
      // legacy path
      return decodeURIComponent(escape(atob(base64)));
    } catch {
      return base64;
    }
  }
}

export function detectLanguage(fileName: string, mimeType?: string): string {
  const n = fileName.toLowerCase();
  if (n.endsWith('.ts') || n.endsWith('.tsx')) return 'typescript';
  if (n.endsWith('.js') || n.endsWith('.jsx') || n.endsWith('.mjs') || n.endsWith('.cjs')) return 'javascript';
  if (n.endsWith('.py')) return 'python';
  if (n.endsWith('.html') || n.endsWith('.htm')) return 'html';
  if (n.endsWith('.css') || n.endsWith('.scss') || n.endsWith('.sass')) return 'css';
  if (n.endsWith('.md') || n.endsWith('.mdx')) return 'markdown';
  if (n.endsWith('.json')) return 'json';
  if (n.endsWith('.yaml') || n.endsWith('.yml')) return 'yaml';
  if (n.endsWith('.rs')) return 'rust';
  if (n.endsWith('.go')) return 'go';
  if (n.endsWith('.java')) return 'java';
  if (n.endsWith('.txt') || n.endsWith('.log') || n.endsWith('.cfg') || n.endsWith('.ini')) return 'text';
  if (mimeType?.startsWith('text/')) return mimeType.replace('text/', '') || 'text';
  if (mimeType === 'application/json') return 'json';
  return 'text';
}

export function isEditableFile(mimeType: string, fileName: string): boolean {
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return true;
  const n = fileName.toLowerCase();
  return /\.(txt|json|ts|tsx|js|jsx|mjs|cjs|py|css|scss|sass|html?|md|mdx|ya?ml|rs|go|java|c|cpp|h|hpp|sh|bash|toml|xml|svg|php|rb|swift|kt|kts|sql|log|cfg|ini|env)$/i.test(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage R/W + events
// ─────────────────────────────────────────────────────────────────────────────

function emitChange(chatId: string): void {
  if (typeof window === 'undefined') return;
  const resolved = resolveEditorChatId(chatId);
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: { chatId: resolved, snapshot: getSnapshot(resolved) } satisfies {
        chatId: string;
        snapshot: FileEditorSnapshot;
      },
    })
  );
}

export function getOpenFiles(chatId: string | null | undefined): OpenFile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(openFilesKey(chatId || ''));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OpenFile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setOpenFiles(chatId: string | null | undefined, files: OpenFile[], opts?: { silent?: boolean }): void {
  if (typeof window === 'undefined') return;
  const key = openFilesKey(chatId || '');
  if (files.length === 0) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(files));
  }
  if (!opts?.silent) emitChange(chatId || '');
}

export function getPendingEditsMap(chatId: string | null | undefined): Record<string, FileDiffOp[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(pendingKey(chatId || ''));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, FileDiffOp[]>;
  } catch {
    return {};
  }
}

export function setPendingEditsMap(
  chatId: string | null | undefined,
  map: Record<string, FileDiffOp[]>,
  opts?: { silent?: boolean }
): void {
  if (typeof window === 'undefined') return;
  const key = pendingKey(chatId || '');
  if (Object.keys(map).length === 0) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, JSON.stringify(map));
  }
  if (!opts?.silent) emitChange(chatId || '');
}

export function getSnapshot(chatId: string | null | undefined): FileEditorSnapshot {
  const resolved = resolveEditorChatId(chatId);
  return {
    chatId: resolved,
    openFiles: getOpenFiles(resolved),
    pendingEdits: getPendingEditsMap(resolved),
  };
}

export function subscribeFileEditor(
  chatId: string | null | undefined,
  cb: (snapshot: FileEditorSnapshot) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const resolved = resolveEditorChatId(chatId);

  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as { chatId?: string; snapshot?: FileEditorSnapshot } | undefined;
    if (detail?.chatId && detail.chatId !== resolved) return;
    cb(detail?.snapshot ?? getSnapshot(resolved));
  };

  // storage event from other tabs
  const storageHandler = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key === openFilesKey(resolved) || e.key === pendingKey(resolved)) {
      cb(getSnapshot(resolved));
    }
  };

  window.addEventListener(EVENT_NAME, handler as EventListener);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler as EventListener);
    window.removeEventListener('storage', storageHandler);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// File ops
// ─────────────────────────────────────────────────────────────────────────────

export function findOpenFile(
  chatId: string | null | undefined,
  fileIdOrName: string
): OpenFile | undefined {
  const files = getOpenFiles(chatId);
  return (
    files.find(f => f.id === fileIdOrName) ||
    files.find(f => f.name === fileIdOrName) ||
    files.find(f => f.name.toLowerCase() === fileIdOrName.toLowerCase())
  );
}

export function upsertOpenFile(chatId: string | null | undefined, file: OpenFile): OpenFile {
  const files = getOpenFiles(chatId);
  const idx = files.findIndex(f => f.id === file.id);
  if (idx >= 0) {
    files[idx] = file;
  } else {
    files.push(file);
  }
  setOpenFiles(chatId, files);
  return file;
}

export function updateOpenFile(
  chatId: string | null | undefined,
  fileId: string,
  updater: (f: OpenFile) => OpenFile
): OpenFile | null {
  const files = getOpenFiles(chatId);
  const idx = files.findIndex(f => f.id === fileId);
  if (idx < 0) return null;
  files[idx] = updater(files[idx]);
  setOpenFiles(chatId, files);
  return files[idx];
}

export function removeOpenFile(chatId: string | null | undefined, fileId: string): void {
  const files = getOpenFiles(chatId).filter(f => f.id !== fileId);
  setOpenFiles(chatId, files);
  const pending = getPendingEditsMap(chatId);
  if (pending[fileId]) {
    delete pending[fileId];
    setPendingEditsMap(chatId, pending, { silent: true });
    emitChange(chatId || '');
  }
}

/** Открыть attached file в редакторе (идемпотентно). */
export async function openAttachedFile(
  chatId: string | null | undefined,
  file: {
    id: string;
    name: string;
    mimeType: string;
    getData: () => Promise<string>;
  },
  language?: string
): Promise<{ file: OpenFile; alreadyOpen: boolean }> {
  const existing = findOpenFile(chatId, file.id);
  if (existing) {
    return { file: existing, alreadyOpen: true };
  }

  const raw = await file.getData();
  const content =
    isEditableFile(file.mimeType, file.name) || file.mimeType.startsWith('text/') || file.mimeType === 'application/json'
      ? decodeBase64Text(raw)
      : raw;

  const openFile: OpenFile = {
    id: file.id,
    name: file.name,
    language: language || detectLanguage(file.name, file.mimeType),
    content,
    originalContent: content,
    mimeType: file.mimeType || 'text/plain',
    isDirty: false,
    history: [],
  };

  upsertOpenFile(chatId, openFile);
  return { file: openFile, alreadyOpen: false };
}

/** Открыть все editable файлы из списка attached. */
export async function openEditableAttachments(
  chatId: string | null | undefined,
  files: Array<{ id: string; name: string; mimeType: string; data?: string; getData?: () => Promise<string> }>
): Promise<OpenFile[]> {
  const opened: OpenFile[] = [];
  for (const f of files) {
    if (!isEditableFile(f.mimeType, f.name)) continue;
    const getData = f.getData || (async () => f.data || '');
    const { file } = await openAttachedFile(chatId, {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      getData,
    });
    opened.push(file);
  }
  return opened;
}

function pushHistory(file: OpenFile, description: string): FileHistoryEntry[] {
  return [
    ...file.history,
    {
      timestamp: Date.now(),
      content: file.content,
      description,
    },
  ].slice(-50);
}

export type ApplyEditsResult = {
  success: boolean;
  file?: OpenFile;
  applied: number;
  failed: FileDiffOp[];
  message: string;
  /** Подсказка модели: фрагмент файла вокруг неудачи */
  hint?: string;
};

/** Применить SEARCH/REPLACE правки. */
export function applySearchReplaceToFile(
  chatId: string | null | undefined,
  fileId: string,
  edits: FileDiffOp[]
): ApplyEditsResult {
  const file = findOpenFile(chatId, fileId);
  if (!file) {
    return {
      success: false,
      applied: 0,
      failed: edits,
      message: `File not open: "${fileId}". Call open_file_in_editor or use exact file id/name from OPEN FILES list.`,
    };
  }

  // Нормализуем \r\n → \n перед match (и в content, и в search)
  const normalizedContent = normalizeNewlines(file.content);
  const normalizedEdits = edits.map(e =>
    e.type === 'search_replace'
      ? { ...e, search: normalizeNewlines(e.search), replace: normalizeNewlines(e.replace) }
      : e
  );

  const searchOps = normalizedEdits.filter(e => e.type === 'search_replace') as Array<
    FileDiffOp & { type: 'search_replace' }
  >;

  const { result, applied, failed } = applyEdits(normalizedContent, searchOps);

  if (applied === 0) {
    return {
      success: false,
      file,
      applied: 0,
      failed,
      message: `No edits applied to "${file.name}". SEARCH text not found.`,
      hint: buildFailureHint(normalizedContent, searchOps[0]?.search),
    };
  }

  // Partial success still updates file so chain can continue
  const desc = edits.map(e => e.description || 'edit').join('; ');
  const updated: OpenFile = {
    ...file,
    content: result,
    isDirty: result !== file.originalContent,
    history: pushHistory(file, desc),
  };
  upsertOpenFile(chatId, updated);

  const pending = getPendingEditsMap(chatId);
  pending[file.id] = [...(pending[file.id] || []), ...edits];
  setPendingEditsMap(chatId, pending);

  if (failed.length > 0) {
    return {
      success: false,
      file: updated,
      applied,
      failed,
      message: `Partial: applied ${applied}/${edits.length} to "${file.name}". ${failed.length} failed.`,
      hint: buildFailureHint(result, failed[0]?.type === 'search_replace' ? failed[0].search : undefined),
    };
  }

  return {
    success: true,
    file: updated,
    applied,
    failed: [],
    message: `Applied ${applied} edit(s) to "${file.name}".`,
  };
}

/** Заменить строки [startLine, endLine] (1-based, inclusive). */
export function applyLineReplaceToFile(
  chatId: string | null | undefined,
  fileId: string,
  startLine: number,
  endLine: number,
  newContent: string,
  description?: string
): ApplyEditsResult {
  const file = findOpenFile(chatId, fileId);
  if (!file) {
    return {
      success: false,
      applied: 0,
      failed: [],
      message: `File not open: "${fileId}"`,
    };
  }

  const op: FileDiffOp = {
    type: 'replace_lines',
    startLine,
    endLine,
    newContent: normalizeNewlines(newContent),
    description,
  };

  const res = applyLineReplace(normalizeNewlines(file.content), startLine, endLine, normalizeNewlines(newContent));
  if (!res.ok) {
    return {
      success: false,
      file,
      applied: 0,
      failed: [op],
      message: res.error || 'Line replace failed',
      hint: withLineNumbers(file.content, Math.max(1, startLine - 3), Math.min(file.content.split('\n').length, endLine + 3)),
    };
  }

  const updated: OpenFile = {
    ...file,
    content: res.result,
    isDirty: res.result !== file.originalContent,
    history: pushHistory(file, description || `Replace lines ${startLine}-${endLine}`),
  };
  upsertOpenFile(chatId, updated);

  const pending = getPendingEditsMap(chatId);
  pending[file.id] = [...(pending[file.id] || []), op];
  setPendingEditsMap(chatId, pending);

  return {
    success: true,
    file: updated,
    applied: 1,
    failed: [],
    message: `Replaced lines ${startLine}-${endLine} in "${file.name}".`,
  };
}

export function acceptFileEdits(chatId: string | null | undefined, fileId: string): OpenFile | null {
  const file = findOpenFile(chatId, fileId);
  if (!file) return null;

  const updated: OpenFile = {
    ...file,
    originalContent: file.content,
    isDirty: false,
    history: pushHistory(file, 'Accepted AI edits'),
  };
  upsertOpenFile(chatId, updated);

  const pending = getPendingEditsMap(chatId);
  delete pending[fileId];
  setPendingEditsMap(chatId, pending);

  return updated;
}

export function rejectFileEdits(chatId: string | null | undefined, fileId: string): OpenFile | null {
  const file = findOpenFile(chatId, fileId);
  if (!file) return null;

  const updated: OpenFile = {
    ...file,
    content: file.originalContent,
    isDirty: false,
  };
  upsertOpenFile(chatId, updated);

  const pending = getPendingEditsMap(chatId);
  delete pending[fileId];
  setPendingEditsMap(chatId, pending);

  return updated;
}

export function revertFileToOriginal(chatId: string | null | undefined, fileId: string): OpenFile | null {
  return rejectFileEdits(chatId, fileId);
}

export function setManualContent(
  chatId: string | null | undefined,
  fileId: string,
  newContent: string
): OpenFile | null {
  return updateOpenFile(chatId, fileId, f => ({
    ...f,
    content: newContent,
    isDirty: newContent !== f.originalContent,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for AI
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Пронумерованный контент для модели: "  12| line" */
export function withLineNumbers(content: string, fromLine = 1, toLine?: number): string {
  const lines = normalizeNewlines(content).split('\n');
  const start = Math.max(1, fromLine);
  const end = Math.min(lines.length, toLine ?? lines.length);
  const width = String(end).length;
  const out: string[] = [];
  for (let i = start; i <= end; i++) {
    out.push(`${String(i).padStart(width, ' ')}| ${lines[i - 1]}`);
  }
  return out.join('\n');
}

function buildFailureHint(content: string, search?: string): string {
  if (!search) {
    return `Current file (first 40 lines):\n${withLineNumbers(content, 1, 40)}`;
  }
  // Try to find a partial match for context
  const lines = normalizeNewlines(content).split('\n');
  const needle = normalizeNewlines(search).trim().split('\n')[0]?.trim() || '';
  let hit = -1;
  if (needle.length > 2) {
    hit = lines.findIndex(l => l.includes(needle.slice(0, Math.min(40, needle.length))));
  }
  if (hit >= 0) {
    const from = Math.max(1, hit + 1 - 5);
    const to = Math.min(lines.length, hit + 1 + 10);
    return `SEARCH not found exactly. Nearby lines (${from}-${to}):\n${withLineNumbers(content, from, to)}\n\nYour SEARCH started with: ${JSON.stringify(needle.slice(0, 80))}`;
  }
  return `SEARCH not found. File has ${lines.length} lines. First 30 lines:\n${withLineNumbers(content, 1, 30)}\n\nTip: call get_file_content first and copy EXACT text into search.`;
}

/** Краткий snapshot открытых файлов для system prompt. */
export function buildOpenFilesPromptSection(chatId: string | null | undefined, maxLinesPerFile = 120): string {
  const files = getOpenFiles(chatId);
  if (files.length === 0) return '';

  const parts = files.map(f => {
    const lines = normalizeNewlines(f.content).split('\n');
    const total = lines.length;
    const body =
      total <= maxLinesPerFile
        ? withLineNumbers(f.content)
        : withLineNumbers(f.content, 1, maxLinesPerFile) +
          `\n... (${total - maxLinesPerFile} more lines — use get_file_content for full file)`;

    return [
      `### ${f.name}`,
      `- fileId: ${f.id}`,
      `- language: ${f.language}`,
      `- lines: ${total}`,
      `- dirty: ${f.isDirty ? 'yes' : 'no'}`,
      '```',
      body,
      '```',
    ].join('\n');
  });

  return (
    `OPEN FILES IN EDITOR (edit these — do NOT create_file duplicates):\n\n` + parts.join('\n\n')
  );
}

/** Tool names owned by file-editor skill (for forced function calling). */
export const FILE_EDITOR_TOOL_NAMES = [
  'open_file_in_editor',
  'edit_file',
  'replace_lines',
  'get_file_content',
  'create_file',
  'revert_file',
] as const;

/**
 * Instruction injected into the last user turn so the model MUST use tools
 * instead of pasting the whole file into chat.
 */
export function buildFileEditorForceInstruction(chatId: string | null | undefined): string {
  const files = getOpenFiles(chatId);
  if (files.length === 0) return '';

  const blocks = files.map(f => {
    const lines = normalizeNewlines(f.content).split('\n');
    const body =
      lines.length <= 200
        ? withLineNumbers(f.content)
        : withLineNumbers(f.content, 1, 200) + `\n... (${lines.length - 200} more lines)`;
    return [
      `FILE: ${f.name}`,
      `fileId: ${f.id}`,
      `lines: ${lines.length}`,
      'CONTENT (line-numbered, copy EXACTLY into search):',
      body,
    ].join('\n');
  });

  return [
    '⛔ FILE EDITOR MODE — MANDATORY TOOL USE',
    'The user wants to CHANGE an open file. You MUST call tools: edit_file or replace_lines (or get_file_content first).',
    'FORBIDDEN: printing the full updated file in chat as your answer.',
    'FORBIDDEN: create_file for an already open/attached file.',
    'Do a tiny SEARCH/REPLACE (often one line). Example: search "Шестегранник = False" replace "Шестегранник = True".',
    'After tools succeed, reply in 1 short sentence only.',
    '',
    ...blocks,
  ].join('\n');
}

/** true if editor has open files that need tool-based edits */
export function hasOpenEditorFiles(chatId: string | null | undefined): boolean {
  return getOpenFiles(chatId).length > 0;
}

/** Migrate open files from session key to real chat id when chat is first saved. */
export function migrateEditorChatId(fromChatId: string | null | undefined, toChatId: string): void {
  if (!toChatId) return;
  const from = resolveEditorChatId(fromChatId);
  const to = resolveEditorChatId(toChatId);
  if (from === to) return;

  const files = getOpenFiles(from);
  const pending = getPendingEditsMap(from);
  if (files.length === 0 && Object.keys(pending).length === 0) return;

  setOpenFiles(to, files, { silent: true });
  setPendingEditsMap(to, pending, { silent: true });
  // clear old
  setOpenFiles(from, [], { silent: true });
  setPendingEditsMap(from, {}, { silent: true });
  emitChange(to);
}
