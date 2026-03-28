import type { Skill, SkillContext, GeminiToolDeclaration } from '../types';
import type { OpenFile, FileDiffOp } from '@/types';
import { applyEdits } from '@/lib/diff-engine';

const tools: GeminiToolDeclaration[] = [
  {
    name: 'open_file_in_editor',
    description: 'Register a file to be tracked/edited. Call this when user attaches a code file.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'ID of the attached file'
        },
        fileName: {
          type: 'string',
          description: 'Name of the file'
        },
        language: {
          type: 'string',
          description: 'Programming language (typescript, python, html, css, etc.)'
        }
      },
      required: ['fileId', 'fileName', 'language']
    }
  },
  {
    name: 'edit_file',
    description: `Apply targeted edits to an open file using SEARCH/REPLACE blocks.
      ALWAYS use this instead of rewriting the whole file.
      Returns success/fail per block.`,
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'ID of the file to edit'
        },
        edits: {
          type: 'array',
          description: 'Array of search/replace operations',
          items: {
            type: 'object',
            properties: {
              search: {
                type: 'string',
                description: 'Exact text to find (include 3-5 lines of context for uniqueness)'
              },
              replace: {
                type: 'string',
                description: 'Text to replace with'
              },
              description: {
                type: 'string',
                description: 'What this edit does (e.g., "Add error handling")'
              }
            },
            required: ['search', 'replace']
          }
        }
      },
      required: ['fileId', 'edits']
    }
  },
  {
    name: 'create_file',
    description: 'Create a new file from scratch. Use when user asks to create a new file.',
    parameters: {
      type: 'object',
      properties: {
        fileName: {
          type: 'string',
          description: 'Name of the new file (e.g., "utils.ts")'
        },
        language: {
          type: 'string',
          description: 'Programming language'
        },
        content: {
          type: 'string',
          description: 'Initial file content'
        },
        description: {
          type: 'string',
          description: 'What this file does'
        }
      },
      required: ['fileName', 'language', 'content']
    }
  },
  {
    name: 'get_file_content',
    description: 'Get current content of a tracked file.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'ID of the file'
        }
      },
      required: ['fileId']
    }
  },
  {
    name: 'revert_file',
    description: 'Revert file to original or specific history entry.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'ID of the file'
        },
        historyIndex: {
          type: 'number',
          description: 'Optional: index in history to revert to (default: revert to original)'
        }
      },
      required: ['fileId']
    }
  }
];

const fileEditorSkill: Skill = {
  id: 'file-editor',
  name: 'File Editor',
  description: 'AI-powered code file editing with diff-based changes',
  version: '1.0.0',
  author: 'Gemini Playground',
  icon: '📝',
  category: 'productivity',
  
  tools,
  
  onSystemPrompt: (ctx: SkillContext) => {
    const hasAttachedFiles = ctx.attachedFiles && ctx.attachedFiles.length > 0;
    const filesList = hasAttachedFiles 
      ? ctx.attachedFiles.map(f => `- ${f.name} (ID: ${f.id}, MIME: ${f.mimeType})`).join('\n')
      : '';
    
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 FILE EDITOR — Diff-based code editing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${hasAttachedFiles ? `⚠️⚠️⚠️ USER HAS ATTACHED FILES - YOU MUST EDIT THEM, NOT CREATE NEW ONES! ⚠️⚠️⚠️

ATTACHED FILES:
${filesList}

CRITICAL: Use open_file_in_editor with the EXACT file ID from above, then edit_file!
DO NOT use create_file when user has attached a file!

` : ''}WORKFLOW:

**IF USER ATTACHED A FILE:**
1. Call open_file_in_editor({ fileId: "EXACT_ID_FROM_LIST_ABOVE", fileName: "...", language: "..." })
2. Call edit_file({ fileId: "SAME_ID", edits: [...] })
3. NEVER call create_file for attached files!

**IF USER WANTS NEW FILE:**
1. Call create_file({ fileName: "...", language: "...", content: "..." })

EDITING RULES:
- NEVER rewrite entire files
- ALWAYS use edit_file with SEARCH/REPLACE blocks
- Include 3-5 lines of context in SEARCH
- SEARCH must be exact match (whitespace-sensitive)

Example for ATTACHED file:
\`\`\`
// User attached: options.txt (ID: file_abc123)
// User says: "включи autoJump"

// Step 1: Open the ATTACHED file
open_file_in_editor({
  fileId: "file_abc123",  // ← EXACT ID from attached files list!
  fileName: "options.txt",
  language: "text"
})

// Step 2: Edit it
edit_file({
  fileId: "file_abc123",  // ← SAME ID!
  edits: [{
    search: "autoJump:false",
    replace: "autoJump:true",
    description: "Enable auto jump"
  }]
})
\`\`\`

${hasAttachedFiles ? '⚠️ REMEMBER: User attached files! Use their IDs, do NOT create new files!\n' : ''}`;
  },
  
  onToolCall: async (toolName: string, args: Record<string, unknown>, ctx: SkillContext) => {
    const openFiles = ctx.storage.getJSON<OpenFile[]>('file_editor_open_files') || [];
    
    switch (toolName) {
      case 'open_file_in_editor': {
        const { fileId, fileName, language } = args as { fileId: string; fileName: string; language: string };
        
        if (openFiles.some(f => f.id === fileId)) {
          return {
            mode: 'respond' as const,
            response: { success: false, error: 'File already open in editor' }
          };
        }
        
        const file = ctx.attachedFiles?.find(f => f.id === fileId);
        if (!file) {
          return {
            mode: 'respond' as const,
            response: { success: false, error: 'File not found in attached files' }
          };
        }
        
        // Получаем данные файла (они в base64)
        let content = await file.getData();
        
        // Для текстовых файлов декодируем base64 обратно в текст
        if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
          try {
            content = decodeURIComponent(escape(atob(content)));
          } catch (e) {
            console.error('Failed to decode base64 text file:', e);
            // Если не удалось декодировать, используем как есть
          }
        }
        
        const openFile: OpenFile = {
          id: fileId,
          name: fileName,
          language,
          content,
          originalContent: content,
          mimeType: file.mimeType,
          isDirty: false,
          history: []
        };
        
        openFiles.push(openFile);
        ctx.storage.setJSON('file_editor_open_files', openFiles);
        
        ctx.emit({ type: 'toast', message: `Файл "${fileName}" открыт в редакторе`, variant: 'success' });
        
        return {
          mode: 'respond' as const,
          response: { success: true, message: `File "${fileName}" opened in editor` }
        };
      }
      
      case 'edit_file': {
        const { fileId, edits } = args as { fileId: string; edits: any[] };
        
        const fileIndex = openFiles.findIndex(f => f.id === fileId);
        if (fileIndex === -1) {
          return {
            mode: 'respond' as const,
            response: { success: false, error: 'File not open. Call open_file_in_editor first.' }
          };
        }
        
        const file = openFiles[fileIndex];
        const diffOps: FileDiffOp[] = edits.map((e: any) => ({
          type: 'search_replace' as const,
          search: e.search,
          replace: e.replace,
          description: e.description
        }));
        
        const { result, applied, failed } = applyEdits(file.content, diffOps);
        
        if (failed.length > 0) {
          return {
            mode: 'respond' as const,
            response: {
              success: false,
              applied,
              failed: failed.length,
              failedEdits: failed.map(f => ({ search: f.search.slice(0, 100), description: f.description })),
              message: `Applied ${applied}/${edits.length} edits. ${failed.length} failed (search text not found).`
            }
          };
        }
        
        file.history.push({
          timestamp: Date.now(),
          content: file.content,
          description: edits.map((e: any) => e.description || 'Edit').join(', ')
        });
        
        file.content = result;
        file.isDirty = true;
        
        openFiles[fileIndex] = file;
        ctx.storage.setJSON('file_editor_open_files', openFiles);
        
        ctx.emit({ type: 'toast', message: `Применено ${applied} изменений к "${file.name}"`, variant: 'success' });
        
        // Возвращаем артефакт с изменённым файлом
        return {
          mode: 'respond' as const,
          response: { success: true, applied, message: `Successfully applied ${applied} edit(s) to "${file.name}"` },
          artifacts: [{
            id: `${fileId}_${Date.now()}`,
            type: 'text' as const,
            label: `📝 ${file.name} (edited)`,
            data: { kind: 'text' as const, content: result, language: file.language },
            downloadable: true,
            filename: file.name,
            skillId: 'file-editor'
          }]
        };
      }
      
      case 'create_file': {
        const { fileName, language, content } = args as { fileName: string; language: string; content: string };
        
        const newFile: OpenFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: fileName,
          language,
          content,
          originalContent: '',
          mimeType: `text/${language}`,
          isDirty: true,
          history: []
        };
        
        openFiles.push(newFile);
        ctx.storage.setJSON('file_editor_open_files', openFiles);
        
        ctx.emit({ type: 'toast', message: `Создан файл "${fileName}"`, variant: 'success' });
        
        // Возвращаем артефакт с новым файлом
        return {
          mode: 'respond' as const,
          response: { success: true, fileId: newFile.id, message: `Created new file "${fileName}"` },
          artifacts: [{
            id: newFile.id,
            type: 'text' as const,
            label: `📄 ${fileName} (new)`,
            data: { kind: 'text' as const, content, language },
            downloadable: true,
            filename: fileName,
            skillId: 'file-editor'
          }]
        };
      }
      
      case 'get_file_content': {
        const { fileId } = args as { fileId: string };
        
        const file = openFiles.find(f => f.id === fileId);
        if (!file) {
          return {
            mode: 'respond' as const,
            response: { success: false, error: 'File not found' }
          };
        }
        
        return {
          mode: 'respond' as const,
          response: { success: true, content: file.content, isDirty: file.isDirty, historyLength: file.history.length }
        };
      }
      
      case 'revert_file': {
        const { fileId, historyIndex } = args as { fileId: string; historyIndex?: number };
        
        const fileIndex = openFiles.findIndex(f => f.id === fileId);
        if (fileIndex === -1) {
          return {
            mode: 'respond' as const,
            response: { success: false, error: 'File not found' }
          };
        }
        
        const file = openFiles[fileIndex];
        
        if (historyIndex !== undefined) {
          if (historyIndex < 0 || historyIndex >= file.history.length) {
            return {
              mode: 'respond' as const,
              response: { success: false, error: 'Invalid history index' }
            };
          }
          file.content = file.history[historyIndex].content;
        } else {
          file.content = file.originalContent;
        }
        
        file.isDirty = file.content !== file.originalContent;
        
        openFiles[fileIndex] = file;
        ctx.storage.setJSON('file_editor_open_files', openFiles);
        
        ctx.emit({ type: 'toast', message: `Файл "${file.name}" восстановлен`, variant: 'success' });
        
        return {
          mode: 'respond' as const,
          response: {
            success: true,
            message: `Reverted "${file.name}" to ${historyIndex !== undefined ? `history entry ${historyIndex}` : 'original'}`
          }
        };
      }
      
      default:
        return {
          mode: 'respond' as const,
          response: { success: false, error: 'Unknown tool' }
        };
    }
  }
};

export default fileEditorSkill;
