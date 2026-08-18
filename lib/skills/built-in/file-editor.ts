import type { Skill, SkillContext, GeminiToolDeclaration } from '../types';
import type { FileDiffOp, SkillArtifact } from '@/types';
import {
  openAttachedFile,
  findOpenFile,
  getOpenFiles,
  applySearchReplaceToFile,
  applyLineReplaceToFile,
  withLineNumbers,
  buildOpenFilesPromptSection,
  detectLanguage,
  isEditableFile,
  upsertOpenFile,
  resolveEditorChatId,
  normalizeNewlines,
} from '@/lib/file-editor-bridge';

const tools: GeminiToolDeclaration[] = [
  {
    name: 'open_file_in_editor',
    description:
      'Open an attached text/code file in the editor. Prefer exact fileId from ATTACHED/OPEN FILES. If already open — returns success.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'ID of the attached file (or file name if id unknown)',
        },
        fileName: {
          type: 'string',
          description: 'Name of the file',
        },
        language: {
          type: 'string',
          description: 'Language: text, typescript, python, json, etc.',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'edit_file',
    description: `Apply TARGETED search/replace edits to an open file.
NEVER rewrite the whole file. Each edit is a small SEARCH → REPLACE block.
SEARCH must be copied EXACTLY from get_file_content / OPEN FILES listing (whitespace-sensitive).
If SEARCH fails, read the hint and retry with exact text.`,
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'File id or file name from OPEN FILES',
        },
        edits: {
          type: 'array',
          description: 'Array of small search/replace operations',
          items: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Exact text to find (include 1–5 lines of unique context)',
              },
              replace: {
                type: 'string',
                description: 'Replacement text',
              },
              description: {
                type: 'string',
                description: 'What this edit does',
              },
            },
            required: ['search', 'replace'],
          },
        },
      },
      required: ['fileId', 'edits'],
    },
  },
  {
    name: 'replace_lines',
    description: `Replace a line range (1-based, inclusive) in an open file.
Best for config/.txt files when you know line numbers from get_file_content.
Example: set line 5 only → startLine=5, endLine=5, newContent="autoJump:true"`,
    parameters: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File id or name' },
        startLine: { type: 'number', description: 'First line to replace (1-based)' },
        endLine: { type: 'number', description: 'Last line to replace (1-based, inclusive)' },
        newContent: {
          type: 'string',
          description: 'New content for that range (may be multiple lines, or empty to delete)',
        },
        description: { type: 'string', description: 'What this change does' },
      },
      required: ['fileId', 'startLine', 'endLine', 'newContent'],
    },
  },
  {
    name: 'create_file',
    description:
      'Create a NEW file only when the user asked for a new file. NEVER use for already attached/open files.',
    parameters: {
      type: 'object',
      properties: {
        fileName: { type: 'string', description: 'Name of the new file' },
        language: { type: 'string', description: 'Language' },
        content: { type: 'string', description: 'Initial content' },
        description: { type: 'string', description: 'What this file does' },
      },
      required: ['fileName', 'language', 'content'],
    },
  },
  {
    name: 'get_file_content',
    description:
      'Get current editor content with line numbers. ALWAYS call before editing if you are unsure of exact text.',
    parameters: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File id or name' },
        fromLine: { type: 'number', description: 'Optional start line (1-based)' },
        toLine: { type: 'number', description: 'Optional end line (1-based)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'revert_file',
    description: 'Revert file to original (last accepted) content.',
    parameters: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File id or name' },
        historyIndex: {
          type: 'number',
          description: 'Optional history index; omit to revert to original',
        },
      },
      required: ['fileId'],
    },
  },
];

function chatIdOf(ctx: SkillContext): string {
  return resolveEditorChatId(ctx.chatId);
}

function resolveFile(ctx: SkillContext, fileIdOrName: string) {
  return findOpenFile(chatIdOf(ctx), fileIdOrName);
}

function makeEditArtifact(args: {
  fileId: string;
  fileName: string;
  language?: string;
  applied: number;
  failed: number;
  description?: string;
  preview?: string;
}): SkillArtifact {
  return {
    id: `file_edit_${args.fileId}_${Date.now()}`,
    type: 'file_edit',
    label: `📝 ${args.fileName}`,
    skillId: 'file-editor',
    filename: args.fileName,
    downloadable: false,
    data: {
      kind: 'file_edit',
      fileId: args.fileId,
      fileName: args.fileName,
      language: args.language,
      applied: args.applied,
      failed: args.failed,
      description: args.description,
      preview: args.preview,
    },
  };
}

const fileEditorSkill: Skill = {
  id: 'file-editor',
  name: 'File Editor',
  description: 'Точечное AI-редактирование txt/code через SEARCH/REPLACE и line ranges',
  version: '2.0.0',
  author: 'Gemini Playground',
  icon: '📝',
  category: 'productivity',

  tools,

  onSystemPrompt: (ctx: SkillContext) => {
    const openSection = buildOpenFilesPromptSection(chatIdOf(ctx), 100);

    const attachedEditable = (ctx.attachedFiles || []).filter(f =>
      isEditableFile(f.mimeType, f.name)
    );
    const attachedList =
      attachedEditable.length > 0
        ? attachedEditable
            .map(f => `- ${f.name} (ID: ${f.id}, MIME: ${f.mimeType})`)
            .join('\n')
        : '';

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 FILE EDITOR — targeted edits only (NO full rewrites)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL RULES:
1. NEVER rewrite an entire file in chat. NEVER paste the full file as your answer.
2. ALWAYS use edit_file (SEARCH/REPLACE) or replace_lines — even for a single word/value change.
3. For .txt / config: one-line SEARCH/REPLACE is enough (e.g. "Шестегранник = False" → "Шестегранник = True").
4. SEARCH must match EXACTLY (copy from OPEN FILES / get_file_content, including spaces around =).
5. If edit fails — read "hint", call get_file_content, fix SEARCH, retry. Do not create a new file.
6. After tools succeed, reply with ONE short sentence (e.g. "Готово: Шестегранник = True"). No full dump.
7. Russian requests like «замени X на True/False» ALWAYS mean edit_file on the open .txt — not chat text.

WORKFLOW:
A) File already in OPEN FILES → edit_file / replace_lines directly (open_file_in_editor optional).
B) File only in ATTACHED → open_file_in_editor({ fileId }) then edit.
C) User wants a brand-new file → create_file.

Example (.txt):
User attached options.txt, asks "включи autoJump".
1) get_file_content({ fileId: "..." })  // see "autoJump:false" on line 12
2) edit_file({
     fileId: "...",
     edits: [{ search: "autoJump:false", replace: "autoJump:true", description: "enable autoJump" }]
   })
// OR replace_lines({ fileId, startLine: 12, endLine: 12, newContent: "autoJump:true" })

${attachedList ? `ATTACHED EDITABLE FILES THIS TURN:\n${attachedList}\n` : ''}
${openSection || '(no files open yet — open attached files first if user provided any)'}
`.trim();
  },

  onToolCall: async (toolName: string, args: Record<string, unknown>, ctx: SkillContext) => {
    const cid = chatIdOf(ctx);

    switch (toolName) {
      case 'open_file_in_editor': {
        const fileId = String(args.fileId || '');
        const fileName = args.fileName ? String(args.fileName) : undefined;
        const language = args.language ? String(args.language) : undefined;

        // Already open?
        const existing = resolveFile(ctx, fileId) || (fileName ? resolveFile(ctx, fileName) : undefined);
        if (existing) {
          return {
            mode: 'respond' as const,
            response: {
              success: true,
              alreadyOpen: true,
              fileId: existing.id,
              fileName: existing.name,
              lines: normalizeNewlines(existing.content).split('\n').length,
              message: `File "${existing.name}" already open`,
            },
          };
        }

        // Find in attached (current turn — may include history via executor)
        let attached =
          ctx.attachedFiles.find(f => f.id === fileId) ||
          ctx.attachedFiles.find(f => f.name === fileId) ||
          (fileName
            ? ctx.attachedFiles.find(f => f.name === fileName || f.name.toLowerCase() === fileName.toLowerCase())
            : undefined);

        if (!attached) {
          // Try open files list names for better error
          const open = getOpenFiles(cid);
          return {
            mode: 'respond' as const,
            response: {
              success: false,
              error: `File not found: "${fileId}".`,
              openFiles: open.map(f => ({ id: f.id, name: f.name })),
              attached: ctx.attachedFiles.map(f => ({ id: f.id, name: f.name, mime: f.mimeType })),
              hint: 'Use exact ID from ATTACHED/OPEN FILES. If the file was attached earlier, it should appear in attached list.',
            },
          };
        }

        const { file, alreadyOpen } = await openAttachedFile(
          cid,
          {
            id: attached.id,
            name: fileName || attached.name,
            mimeType: attached.mimeType,
            getData: () => attached!.getData(),
          },
          language || detectLanguage(attached.name, attached.mimeType)
        );

        ctx.emit({
          type: 'toast',
          message: alreadyOpen ? `"${file.name}" уже открыт` : `Файл "${file.name}" открыт в редакторе`,
          variant: 'success',
        });
        ctx.emit({
          type: 'panel_update',
          skillId: 'file-editor',
          data: { action: 'open', fileId: file.id, fileName: file.name },
        });

        return {
          mode: 'respond' as const,
          response: {
            success: true,
            fileId: file.id,
            fileName: file.name,
            lines: normalizeNewlines(file.content).split('\n').length,
            message: `Opened "${file.name}"`,
            preview: withLineNumbers(file.content, 1, Math.min(40, file.content.split('\n').length)),
          },
        };
      }

      case 'edit_file': {
        const fileId = String(args.fileId || '');
        const rawEdits = (args.edits as any[]) || [];

        // Auto-open if needed by id/name from attached
        let file = resolveFile(ctx, fileId);
        if (!file) {
          const attached =
            ctx.attachedFiles.find(f => f.id === fileId) ||
            ctx.attachedFiles.find(f => f.name === fileId) ||
            ctx.attachedFiles.find(f => f.name.toLowerCase() === fileId.toLowerCase());
          if (attached) {
            const opened = await openAttachedFile(cid, {
              id: attached.id,
              name: attached.name,
              mimeType: attached.mimeType,
              getData: () => attached.getData(),
            });
            file = opened.file;
          }
        }

        if (!file) {
          return {
            mode: 'respond' as const,
            response: {
              success: false,
              error: `File not open: "${fileId}". Call open_file_in_editor first or use id from OPEN FILES.`,
              openFiles: getOpenFiles(cid).map(f => ({ id: f.id, name: f.name })),
            },
          };
        }

        const edits: FileDiffOp[] = rawEdits.map((e: any) => ({
          type: 'search_replace' as const,
          search: String(e.search ?? ''),
          replace: String(e.replace ?? ''),
          description: e.description ? String(e.description) : undefined,
        }));

        // Guard: refuse near-full-file rewrite disguised as one edit
        const fileLen = file.content.length;
        for (const e of edits) {
          if (e.type === 'search_replace' && e.search.length > fileLen * 0.85 && fileLen > 200) {
            return {
              mode: 'respond' as const,
              response: {
                success: false,
                error:
                  'Rejected: SEARCH covers almost the entire file. Use small targeted SEARCH/REPLACE or replace_lines instead of rewriting.',
              },
            };
          }
        }

        const result = applySearchReplaceToFile(cid, file.id, edits);

        if (result.applied > 0) {
          ctx.emit({
            type: 'toast',
            message: `Применено ${result.applied} правок к "${file.name}"`,
            variant: result.success ? 'success' : 'warning',
          });
          ctx.emit({
            type: 'panel_update',
            skillId: 'file-editor',
            data: { action: 'edit', fileId: file.id, applied: result.applied },
          });
        }

        const preview = result.file
          ? withLineNumbers(result.file.content, 1, Math.min(25, result.file.content.split('\n').length))
          : undefined;

        return {
          mode: 'respond' as const,
          response: {
            success: result.success,
            applied: result.applied,
            failed: result.failed.length,
            failedEdits: result.failed
              .filter((f): f is Extract<FileDiffOp, { type: 'search_replace' }> => f.type === 'search_replace')
              .map(f => ({
                searchPreview: f.search.slice(0, 120),
                description: f.description,
              })),
            message: result.message,
            hint: result.hint,
            fileId: file.id,
            fileName: file.name,
          },
          artifacts:
            result.applied > 0
              ? [
                  makeEditArtifact({
                    fileId: file.id,
                    fileName: file.name,
                    language: file.language,
                    applied: result.applied,
                    failed: result.failed.length,
                    description: edits.map(e => e.description || 'edit').join('; '),
                    preview,
                  }),
                ]
              : [],
        };
      }

      case 'replace_lines': {
        const fileId = String(args.fileId || '');
        const startLine = Number(args.startLine);
        const endLine = Number(args.endLine);
        const newContent = String(args.newContent ?? '');
        const description = args.description ? String(args.description) : undefined;

        let file = resolveFile(ctx, fileId);
        if (!file) {
          const attached =
            ctx.attachedFiles.find(f => f.id === fileId) ||
            ctx.attachedFiles.find(f => f.name === fileId);
          if (attached) {
            file = (
              await openAttachedFile(cid, {
                id: attached.id,
                name: attached.name,
                mimeType: attached.mimeType,
                getData: () => attached.getData(),
              })
            ).file;
          }
        }

        if (!file) {
          return {
            mode: 'respond' as const,
            response: {
              success: false,
              error: `File not open: "${fileId}"`,
              openFiles: getOpenFiles(cid).map(f => ({ id: f.id, name: f.name })),
            },
          };
        }

        const result = applyLineReplaceToFile(cid, file.id, startLine, endLine, newContent, description);

        if (result.success) {
          ctx.emit({
            type: 'toast',
            message: `Строки ${startLine}–${endLine} в "${file.name}" обновлены`,
            variant: 'success',
          });
          ctx.emit({
            type: 'panel_update',
            skillId: 'file-editor',
            data: { action: 'replace_lines', fileId: file.id, startLine, endLine },
          });
        }

        const preview = result.file
          ? withLineNumbers(
              result.file.content,
              Math.max(1, startLine - 2),
              Math.min(result.file.content.split('\n').length, endLine + 4)
            )
          : undefined;

        return {
          mode: 'respond' as const,
          response: {
            success: result.success,
            message: result.message,
            hint: result.hint,
            fileId: file.id,
            fileName: file.name,
            startLine,
            endLine,
          },
          artifacts: result.success
            ? [
                makeEditArtifact({
                  fileId: file.id,
                  fileName: file.name,
                  language: file.language,
                  applied: 1,
                  failed: 0,
                  description: description || `lines ${startLine}-${endLine}`,
                  preview,
                }),
              ]
            : [],
        };
      }

      case 'create_file': {
        const fileName = String(args.fileName || 'untitled.txt');
        const language = String(args.language || detectLanguage(fileName));
        const content = normalizeNewlines(String(args.content ?? ''));

        // Block accidental create when same name already open / attached
        const collision =
          getOpenFiles(cid).find(f => f.name.toLowerCase() === fileName.toLowerCase()) ||
          ctx.attachedFiles.find(f => f.name.toLowerCase() === fileName.toLowerCase());
        if (collision) {
          return {
            mode: 'respond' as const,
            response: {
              success: false,
              error: `File "${fileName}" already exists (id: ${'id' in collision ? collision.id : (collision as any).id}). Use edit_file / replace_lines instead of create_file.`,
            },
          };
        }

        const newFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: fileName,
          language,
          content,
          originalContent: content,
          mimeType: language === 'json' ? 'application/json' : `text/${language === 'text' ? 'plain' : language}`,
          isDirty: false,
          history: [],
        };
        upsertOpenFile(cid, newFile);

        ctx.emit({ type: 'toast', message: `Создан файл "${fileName}"`, variant: 'success' });
        ctx.emit({
          type: 'panel_update',
          skillId: 'file-editor',
          data: { action: 'create', fileId: newFile.id, fileName },
        });

        return {
          mode: 'respond' as const,
          response: {
            success: true,
            fileId: newFile.id,
            fileName,
            lines: content.split('\n').length,
            message: `Created "${fileName}"`,
          },
          artifacts: [
            makeEditArtifact({
              fileId: newFile.id,
              fileName,
              language,
              applied: 1,
              failed: 0,
              description: args.description ? String(args.description) : 'created',
              preview: withLineNumbers(content, 1, Math.min(25, content.split('\n').length)),
            }),
          ],
        };
      }

      case 'get_file_content': {
        const fileId = String(args.fileId || '');
        const fromLine = args.fromLine != null ? Number(args.fromLine) : 1;
        const toLine = args.toLine != null ? Number(args.toLine) : undefined;

        let file = resolveFile(ctx, fileId);
        if (!file) {
          const attached =
            ctx.attachedFiles.find(f => f.id === fileId) ||
            ctx.attachedFiles.find(f => f.name === fileId);
          if (attached) {
            file = (
              await openAttachedFile(cid, {
                id: attached.id,
                name: attached.name,
                mimeType: attached.mimeType,
                getData: () => attached.getData(),
              })
            ).file;
          }
        }

        if (!file) {
          return {
            mode: 'respond' as const,
            response: {
              success: false,
              error: 'File not found',
              openFiles: getOpenFiles(cid).map(f => ({ id: f.id, name: f.name })),
            },
          };
        }

        const total = normalizeNewlines(file.content).split('\n').length;
        const content = withLineNumbers(file.content, fromLine, toLine ?? total);

        return {
          mode: 'respond' as const,
          response: {
            success: true,
            fileId: file.id,
            fileName: file.name,
            language: file.language,
            isDirty: file.isDirty,
            totalLines: total,
            fromLine,
            toLine: toLine ?? total,
            content,
          },
        };
      }

      case 'revert_file': {
        const fileId = String(args.fileId || '');
        const historyIndex = args.historyIndex != null ? Number(args.historyIndex) : undefined;
        const file = resolveFile(ctx, fileId);
        if (!file) {
          return {
            mode: 'respond' as const,
            response: { success: false, error: 'File not found' },
          };
        }

        if (historyIndex !== undefined) {
          if (historyIndex < 0 || historyIndex >= file.history.length) {
            return {
              mode: 'respond' as const,
              response: { success: false, error: 'Invalid history index' },
            };
          }
          const content = file.history[historyIndex].content;
          upsertOpenFile(cid, {
            ...file,
            content,
            isDirty: content !== file.originalContent,
          });
        } else {
          const { rejectFileEdits } = await import('@/lib/file-editor-bridge');
          rejectFileEdits(cid, file.id);
        }

        ctx.emit({ type: 'toast', message: `Файл "${file.name}" восстановлен`, variant: 'success' });

        return {
          mode: 'respond' as const,
          response: {
            success: true,
            message: `Reverted "${file.name}"`,
          },
        };
      }

      default:
        return {
          mode: 'respond' as const,
          response: { success: false, error: `Unknown tool: ${toolName}` },
        };
    }
  },
};

export default fileEditorSkill;
