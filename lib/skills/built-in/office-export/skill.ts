/**
 * Office Export Skill — Main Skill Implementation
 * 
 * Создание Word, Excel и PowerPoint файлов из HTML
 */

import { nanoid } from 'nanoid';
import type { Skill, SkillContext, SkillToolResult, GeminiToolDeclaration } from '@/lib/skills/types';
import type { Message, SkillArtifact } from '@/types';
import { convertToOffice } from './converter';
import { extractHtmlFromMessage } from './html-parser';
import { MIME_TYPES, FORMAT_ICONS, FORMAT_LABELS, STORAGE_KEYS } from './constants';
import type { ExportJob, ExportHistoryEntry } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Tool Declarations
// ─────────────────────────────────────────────────────────────────────────────

const tools: GeminiToolDeclaration[] = [{
  name: 'prepare_office_export',
  description: `⚠️ FIRE-AND-FORGET TOOL: This tool executes INSTANTLY on the client. You will NOT receive a functionResponse. You MUST continue generating text IN THE SAME turn.

Call this tool to prepare Word, Excel, or PowerPoint document export. After calling it, IMMEDIATELY write the full document as HTML in a markdown code block IN THE SAME RESPONSE. Do NOT stop after calling this tool.

CRITICAL: The Gemini API supports functionCall + text in the same candidate. You MUST use this pattern:
Turn 1: [functionCall: prepare_office_export(...)] + [text: HTML code block with triple backticks]

The HTML will be automatically converted to the requested Office format.

HTML guidelines by format:
- DOCX: Use semantic HTML5. <h1>-<h4> for headings, <p> for paragraphs, <ul>/<ol> for lists, <table> for tables, <strong>/<em> for emphasis. Inline CSS for colors and alignment.
- XLSX: Use <table> elements ONLY. Multiple <table> elements = multiple sheets. Use <thead>/<tbody> to mark header rows.
- PPTX: Wrap each slide in <section>. Use <h2> for slide title. Use <p> and <ul>/<li> for bullets. Use <table> for data tables.

Make the HTML rich and complete — this is what the user will download.`,
  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['docx', 'xlsx', 'pptx'],
        description: 'Target format: docx for Word, xlsx for Excel, pptx for PowerPoint'
      },
      filename: {
        type: 'string',
        description: 'Output filename without extension (use kebab-case, e.g. "sales-report-q3")'
      },
      title: {
        type: 'string',
        description: 'Human-readable document title shown in chat (e.g. "Отчёт о продажах Q3")'
      },
      sheet_names: {
        type: 'array',
        items: { type: 'string' },
        description: 'For xlsx only: names for each sheet. Must match the number of <table> elements in HTML.'
      },
      page_orientation: {
        type: 'string',
        enum: ['portrait', 'landscape'],
        description: 'Page orientation. For wide tables use landscape. Default: portrait.'
      }
    },
    required: ['format', 'filename', 'title']
  }
}];

// ─────────────────────────────────────────────────────────────────────────────
// Tool Call Handler
// ─────────────────────────────────────────────────────────────────────────────

async function onToolCall(
  toolName: string,
  args: Record<string, unknown>,
  ctx: SkillContext
): Promise<SkillToolResult> {
  console.log('[office-export] onToolCall', { toolName, args });
  
  if (toolName !== 'prepare_office_export') {
    return { 
      mode: 'respond', 
      response: { error: `Unknown tool: ${toolName}` } 
    };
  }

  const format = args.format as 'docx' | 'xlsx' | 'pptx';
  const job: ExportJob = {
    format,
    filename: (args.filename as string) || 'document',
    title: (args.title as string) || FORMAT_LABELS[format],
    sheetNames: args.sheet_names as string[] | undefined,
    orientation: args.page_orientation as 'portrait' | 'landscape' | undefined,
    createdAt: Date.now(),
  };

  console.log('[office-export] saving job:', job);

  // Сохраняем задание в storage
  ctx.storage.setJSON(STORAGE_KEYS.pendingJob, job);

  // Уведомляем пользователя
  ctx.emit({
    type: 'toast',
    message: `${FORMAT_ICONS[format]} Готовлю ${FORMAT_LABELS[format]}...`,
    variant: 'default'
  });

  // fire_and_forget — Gemini не ждёт и сразу пишет HTML
  return { mode: 'fire_and_forget' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Complete Handler
// ─────────────────────────────────────────────────────────────────────────────

async function onMessageComplete(message: Message, ctx: SkillContext): Promise<SkillArtifact[]> {
  console.log('[office-export] onMessageComplete called', { messageId: message.id, role: message.role });
  
  const job = ctx.storage.getJSON<ExportJob>(STORAGE_KEYS.pendingJob);
  console.log('[office-export] pending job:', job);
  
  if (!job) return [];

  // Собираем полный текст сообщения
  const text = message.parts
    .filter((p): p is { text: string } => 'text' in p)
    .map(p => p.text)
    .join('');

  console.log('[office-export] message text length:', text.length);

  const html = extractHtmlFromMessage(text);
  console.log('[office-export] extracted HTML:', html ? `${html.length} chars` : 'null');
  
  if (!html) {
    // HTML не найден — может Gemini написал что-то другое
    // Если job слишком старый (> 5 минут) — чистим
    if (Date.now() - job.createdAt > 5 * 60 * 1000) {
      ctx.storage.remove(STORAGE_KEYS.pendingJob);
    }
    return [];
  }

  // Нашли HTML — удаляем job и начинаем конвертацию
  ctx.storage.remove(STORAGE_KEYS.pendingJob);

  ctx.emit({
    type: 'toast',
    message: `⚙️ Конвертирую в ${FORMAT_LABELS[job.format]}...`,
    variant: 'default'
  });

  try {
    const blob = await convertToOffice(html, job);

    // Добавляем в историю
    const history = ctx.storage.getJSON<ExportHistoryEntry[]>(STORAGE_KEYS.history) ?? [];
    const entry: ExportHistoryEntry = {
      id: nanoid(),
      format: job.format,
      title: job.title,
      filename: `${job.filename}.${job.format}`,
      createdAt: job.createdAt,
    };
    history.unshift(entry);
    ctx.storage.setJSON(STORAGE_KEYS.history, history.slice(0, 20)); // храним последние 20

    // Счётчик
    const total = parseInt(ctx.storage.get(STORAGE_KEYS.totalCount) ?? '0') + 1;
    ctx.storage.set(STORAGE_KEYS.totalCount, String(total));

    // Бейдж
    ctx.emit({
      type: 'badge',
      skillId: 'office_export',
      text: `${total} файл${total === 1 ? '' : total < 5 ? 'а' : 'ов'}`,
      color: '#4f46e5'
    });

    const artifact = {
      id: nanoid(),
      type: 'document' as const,
      label: `${FORMAT_ICONS[job.format]} ${job.title}`,
      data: { kind: 'blob' as const, blob, mimeType: MIME_TYPES[job.format] },
      downloadable: true,
      filename: `${job.filename}.${job.format}`,
      sendToGemini: false,
    };

    ctx.emit({
      type: 'toast',
      message: `✅ ${job.title} готов! Нажми скачать.`,
      variant: 'success'
    });

    ctx.emit({
      type: 'panel_update',
      skillId: 'office_export',
      data: { lastExport: entry }
    });

    return [artifact];
  } catch (err) {
    console.error('[office-export] conversion error:', err);
    ctx.emit({
      type: 'toast',
      message: `❌ Ошибка конвертации: ${(err as Error).message}`,
      variant: 'error'
    });
    ctx.storage.remove(STORAGE_KEYS.pendingJob);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────────────────────────────────────

function onSystemPrompt(ctx: SkillContext): string | null {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 OFFICE EXPORT — Create Word, Excel & PowerPoint files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can create real downloadable Office files. The user will get a file to download right in the chat.

WHEN TO USE:
- User asks for Word document / .docx / реферат / документ → format: "docx"
- User asks for Excel spreadsheet / .xlsx / table / таблица → format: "xlsx"
- User asks for PowerPoint / presentation / slides / презентация → format: "pptx"
- User asks to "export", "download", "save as file" any content
- User asks to "make a document" / "create a report" / "создай документ"

⚠️ MANDATORY: You MUST call prepare_office_export FIRST before writing HTML. Without this call, the file will NOT be created!

HOW TO USE (CRITICAL — follow exactly):
1. FIRST: Call prepare_office_export with format, filename, title
2. IMMEDIATELY in the SAME response: Write the complete content as HTML in a markdown code block
3. Do NOT write any text between the tool call and the HTML block
4. Write rich, complete HTML — this becomes the actual document

Example: User asks "создай Word документ про белок" → You call prepare_office_export(format="docx") and immediately write HTML code block

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 DOCX — HTML Structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use standard semantic HTML. Examples:

\`\`\`html
<h1>Главный заголовок</h1>
<h2>Раздел 1</h2>
<p>Текст параграфа с <strong>жирным</strong> и <em>курсивом</em>.</p>
<ul>
  <li>Пункт списка</li>
  <li>Второй пункт</li>
</ul>
<table>
  <thead><tr><th>Колонка 1</th><th>Колонка 2</th></tr></thead>
  <tbody>
    <tr><td>Данные</td><td>Значение</td></tr>
  </tbody>
</table>
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 XLSX — HTML Structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each <table> = one sheet. Use sheet_names to name them.

\`\`\`html
<!-- Sheet 1: Продажи -->
<table>
  <thead><tr><th>Месяц</th><th>Выручка</th><th>Расходы</th><th>Прибыль</th></tr></thead>
  <tbody>
    <tr><td>Январь</td><td>150000</td><td>80000</td><td>70000</td></tr>
    <tr><td>Февраль</td><td>180000</td><td>90000</td><td>90000</td></tr>
  </tbody>
</table>

<!-- Sheet 2: Сотрудники -->
<table>
  <thead><tr><th>Имя</th><th>Отдел</th><th>Зарплата</th></tr></thead>
  <tbody>
    <tr><td>Иванов И.И.</td><td>Разработка</td><td>120000</td></tr>
  </tbody>
</table>
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📽️ PPTX — HTML Structure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each <section> = one slide. Use <h2> for slide title.

\`\`\`html
<section>
  <h2>Заголовок первого слайда</h2>
  <p>Вводный текст или подзаголовок</p>
  <ul>
    <li>Ключевой тезис 1</li>
    <li>Ключевой тезис 2</li>
    <li>Ключевой тезис 3</li>
  </ul>
</section>

<section>
  <h2>Слайд с данными</h2>
  <table>
    <thead><tr><th>Показатель</th><th>2023</th><th>2024</th></tr></thead>
    <tbody>
      <tr><td>Выручка</td><td>10M</td><td>15M</td></tr>
    </tbody>
  </table>
</section>

<section>
  <h2>Заключение</h2>
  <p>Итоги и следующие шаги</p>
  <ul>
    <li>Вывод 1</li>
    <li>Вывод 2</li>
  </ul>
</section>
\`\`\`

IMPORTANT: Always make the content rich and complete. Don't create skeleton documents — fill them with real, useful content.
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Install Handler
// ─────────────────────────────────────────────────────────────────────────────

function onInstall(ctx: SkillContext): void {
  ctx.emit({
    type: 'toast',
    message: '📄 Office Export установлен! Попроси создать Word, Excel или PowerPoint файл.',
    variant: 'success'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel Data
// ─────────────────────────────────────────────────────────────────────────────

function getPanelData(ctx: SkillContext) {
  const history = ctx.storage.getJSON<ExportHistoryEntry[]>(STORAGE_KEYS.history) ?? [];
  if (history.length === 0) return null;

  const total = ctx.storage.get(STORAGE_KEYS.totalCount) ?? '0';

  return {
    title: `История экспортов (${total})`,
    items: history.slice(0, 5).map(entry => ({
      label: `${FORMAT_ICONS[entry.format]} ${entry.title}`,
      value: entry.filename,
      highlight: false,
    }))
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Export
// ─────────────────────────────────────────────────────────────────────────────

export const officeExportSkill: Skill = {
  id: 'office_export',
  name: 'Office Export',
  description: 'Create Word, Excel, and PowerPoint files from HTML',
  longDescription: 'Generate real downloadable Office documents. Gemini writes HTML, and this skill converts it to DOCX, XLSX, or PPTX format. Perfect for reports, spreadsheets, and presentations.',
  version: '1.0.0',
  icon: '📄',
  category: 'productivity',
  author: 'Gemini Playground',
  tags: ['office', 'word', 'excel', 'powerpoint', 'export', 'docx', 'xlsx', 'pptx', 'documents'],

  tools,
  onToolCall,
  onMessageComplete,
  onSystemPrompt,
  onInstall,
  getPanelData,
};
