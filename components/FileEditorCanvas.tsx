'use client';

import React, { useState, useMemo } from 'react';
import { Check, X, Download, Copy, RotateCcw, FileCode, ChevronDown } from 'lucide-react';
import type { OpenFile, FileDiffOp } from '@/types';
import { getDiffStats } from '@/lib/diff-engine';

interface FileEditorCanvasProps {
  openFiles: OpenFile[];
  activeFileId: string | null;
  pendingEdits?: Map<string, FileDiffOp[]>;
  onAccept: (fileId: string) => void;
  onReject: (fileId: string) => void;
  onManualEdit: (fileId: string, newContent: string) => void;
  onFileSelect: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onRevert: (fileId: string) => void;
  onClose: (fileId: string) => void;
}

type ViewMode = 'diff' | 'editor' | 'split';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'context';
  content: string;
  lineNum?: number;
  newLineNum?: number;
}

function renderDiffLines(original: string, modified: string): DiffLine[] {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');
  const result: DiffLine[] = [];
  
  let origIndex = 0;
  let modIndex = 0;
  
  while (origIndex < origLines.length || modIndex < modLines.length) {
    const origLine = origLines[origIndex];
    const modLine = modLines[modIndex];
    
    if (origLine === modLine) {
      result.push({
        type: 'unchanged',
        content: origLine || '',
        lineNum: origIndex + 1,
        newLineNum: modIndex + 1
      });
      origIndex++;
      modIndex++;
    } else {
      // Ищем следующее совпадение
      let foundMatch = false;
      
      // Проверяем следующие 5 строк
      for (let i = 1; i <= 5; i++) {
        if (origLines[origIndex + i] === modLine) {
          // Удалены строки
          for (let j = 0; j < i; j++) {
            result.push({
              type: 'removed',
              content: origLines[origIndex + j] || '',
              lineNum: origIndex + j + 1
            });
          }
          origIndex += i;
          foundMatch = true;
          break;
        }
        
        if (modLines[modIndex + i] === origLine) {
          // Добавлены строки
          for (let j = 0; j < i; j++) {
            result.push({
              type: 'added',
              content: modLines[modIndex + j] || '',
              newLineNum: modIndex + j + 1
            });
          }
          modIndex += i;
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        // Изменённая строка
        if (origIndex < origLines.length) {
          result.push({
            type: 'removed',
            content: origLine || '',
            lineNum: origIndex + 1
          });
          origIndex++;
        }
        if (modIndex < modLines.length) {
          result.push({
            type: 'added',
            content: modLine || '',
            newLineNum: modIndex + 1
          });
          modIndex++;
        }
      }
    }
  }
  
  return result;
}

function getLanguageIcon(language: string): string {
  const icons: Record<string, string> = {
    typescript: '📘',
    javascript: '📙',
    python: '🐍',
    html: '🌐',
    css: '🎨',
    rust: '🦀',
    go: '🐹',
    java: '☕',
    markdown: '📝',
    json: '📋',
    yaml: '⚙️',
  };
  return icons[language] || '📄';
}

export default function FileEditorCanvas({
  openFiles,
  activeFileId,
  pendingEdits = new Map(),
  onAccept,
  onReject,
  onManualEdit,
  onFileSelect,
  onDownload,
  onRevert,
  onClose
}: FileEditorCanvasProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('diff');
  const [copied, setCopied] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const activeFile = openFiles.find(f => f.id === activeFileId);
  const hasPendingEdits = activeFile && pendingEdits.has(activeFile.id);
  
  const diffLines = useMemo(() => {
    if (!activeFile) return [];
    return renderDiffLines(activeFile.originalContent, activeFile.content);
  }, [activeFile]);
  
  const diffStats = useMemo(() => {
    if (!activeFile) return { added: 0, removed: 0, changed: 0 };
    return getDiffStats(activeFile.originalContent, activeFile.content);
  }, [activeFile]);
  
  const handleAccept = async () => {
    if (!activeFile || isAccepting) return;
    setIsAccepting(true);
    try {
      await onAccept(activeFile.id);
    } finally {
      setIsAccepting(false);
    }
  };
  
  const handleCopy = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  if (openFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--surface-1)] text-[var(--text-dim)]">
        <div className="text-center">
          <FileCode size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Прикрепите code-файл для редактирования</p>
          <p className="text-xs mt-1 opacity-60">Поддерживаются: .ts, .js, .py, .html, .css и др.</p>
        </div>
      </div>
    );
  }
  
  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--surface-1)] text-[var(--text-dim)]">
        <p className="text-sm">Выберите файл из вкладок</p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-[var(--surface-1)]">
      {/* Табы файлов */}
      <div className="flex items-center gap-1 px-2 py-2 bg-[var(--surface-2)] border-b border-[var(--border)] overflow-x-auto">
        {openFiles.map(file => (
          <button
            key={file.id}
            onClick={() => onFileSelect(file.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
              file.id === activeFileId
                ? 'bg-[var(--surface-3)] text-[var(--text-primary)] border border-[var(--border)]'
                : 'text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span>{getLanguageIcon(file.language)}</span>
            <span>{file.name}</span>
            {file.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
            <X
              size={14}
              className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.id);
              }}
            />
          </button>
        ))}
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-[var(--surface-3)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('diff')}
              className={`px-2 py-1 text-xs rounded transition-all ${
                viewMode === 'diff'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              Diff
            </button>
            <button
              onClick={() => setViewMode('editor')}
              className={`px-2 py-1 text-xs rounded transition-all ${
                viewMode === 'editor'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2 py-1 text-xs rounded transition-all ${
                viewMode === 'split'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-dim)] hover:text-[var(--text-primary)]'
              }`}
            >
              Split
            </button>
          </div>
          
          {/* Stats */}
          {activeFile.isDirty && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-400">+{diffStats.added}</span>
              <span className="text-red-400">−{diffStats.removed}</span>
              <span className="text-[var(--text-dim)]">{diffStats.changed} changed</span>
            </div>
          )}
          
          {/* History */}
          {activeFile.history.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded transition-all"
              >
                <span>История ({activeFile.history.length})</span>
                <ChevronDown size={12} />
              </button>
              
              {showHistory && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {activeFile.history.map((entry, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        onRevert(activeFile.id);
                        setShowHistory(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)] transition-all border-b border-[var(--border)] last:border-b-0"
                    >
                      <div className="text-[var(--text-primary)] font-medium">{entry.description}</div>
                      <div className="text-[var(--text-dim)] text-[10px] mt-0.5">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {hasPendingEdits && (
            <>
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 rounded-lg transition-all disabled:opacity-50"
              >
                <Check size={14} />
                <span>Accept</span>
              </button>
              <button
                onClick={() => onReject(activeFile.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg transition-all"
              >
                <X size={14} />
                <span>Reject</span>
              </button>
            </>
          )}
          
          {activeFile.isDirty && !hasPendingEdits && (
            <button
              onClick={() => onRevert(activeFile.id)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-all"
              title="Revert to original"
            >
              <RotateCcw size={14} />
            </button>
          )}
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-all"
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          
          <button
            onClick={() => onDownload(activeFile.id)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-all"
            title="Download file"
          >
            <Download size={14} />
          </button>
        </div>
      </div>
      
      {/* Content area */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'diff' && (
          <div className="font-mono text-xs">
            {diffLines.map((line, index) => (
              <div
                key={index}
                className={`flex ${
                  line.type === 'added'
                    ? 'bg-green-500/10'
                    : line.type === 'removed'
                    ? 'bg-red-500/10'
                    : ''
                }`}
              >
                <div className="w-12 flex-shrink-0 text-right px-2 py-0.5 text-[var(--text-dim)] select-none border-r border-[var(--border)]">
                  {line.lineNum || ''}
                </div>
                <div className="w-12 flex-shrink-0 text-right px-2 py-0.5 text-[var(--text-dim)] select-none border-r border-[var(--border)]">
                  {line.newLineNum || ''}
                </div>
                <div className="flex-1 px-3 py-0.5">
                  <span
                    className={
                      line.type === 'added'
                        ? 'text-green-400'
                        : line.type === 'removed'
                        ? 'text-red-400'
                        : 'text-[var(--text-primary)]'
                    }
                  >
                    {line.type === 'added' && '+ '}
                    {line.type === 'removed' && '- '}
                    {line.content}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {viewMode === 'editor' && (
          <textarea
            value={activeFile.content}
            onChange={e => onManualEdit(activeFile.id, e.target.value)}
            className="w-full h-full p-4 bg-transparent text-[var(--text-primary)] font-mono text-xs resize-none focus:outline-none"
            spellCheck={false}
          />
        )}
        
        {viewMode === 'split' && (
          <div className="grid grid-cols-2 h-full divide-x divide-[var(--border)]">
            <div className="overflow-auto">
              <div className="px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border)] text-xs text-[var(--text-dim)]">
                Original
              </div>
              <pre className="p-4 font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap">
                {activeFile.originalContent}
              </pre>
            </div>
            <div className="overflow-auto">
              <div className="px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border)] text-xs text-[var(--text-dim)]">
                Modified
              </div>
              <pre className="p-4 font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap">
                {activeFile.content}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
