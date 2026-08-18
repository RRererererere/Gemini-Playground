// Validation Modal — отображение ошибок валидации графа
// 🟢 ФИКС #12: UI для валидации

'use client';

import React from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ValidationResult, ValidationError } from '@/lib/agent-engine/validator';

interface ValidationModalProps {
  result: ValidationResult;
  onClose: () => void;
  onHighlightNode?: (nodeId: string) => void;
  onFixNode?: (nodeId: string) => void;
}

export function ValidationModal({ result, onClose, onHighlightNode, onFixNode }: ValidationModalProps) {
  const { valid, errors, warnings } = result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--surface-1)] border border-[var(--border-strong)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            {valid ? (
              <CheckCircle2 size={20} className="text-emerald-400" />
            ) : (
              <AlertCircle size={20} className="text-red-400" />
            )}
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {valid ? 'Граф валиден ✓' : 'Ошибки валидации'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {valid ? (
            <div className="text-center py-8">
              <CheckCircle2 size={48} className="text-emerald-400 mx-auto mb-4" />
              <p className="text-[var(--text-secondary)] text-sm">
                Граф прошёл валидацию. Все обязательные порты подключены и настройки заполнены.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Errors */}
              {errors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={16} className="text-red-400" />
                    <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                      Ошибки ({errors.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {errors.map((error, idx) => (
                      <ErrorCard
                        key={idx}
                        error={error}
                        onHighlight={onHighlightNode}
                        onFix={onFixNode}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle size={16} className="text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                      Предупреждения ({warnings.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {warnings.map((warning, idx) => (
                      <ErrorCard
                        key={idx}
                        error={warning}
                        onHighlight={onHighlightNode}
                        onFix={onFixNode}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
          <div className="text-xs text-[var(--text-dim)]">
            {errors.length > 0 && (
              <span className="text-red-400">{errors.length} ошибок</span>
            )}
            {errors.length > 0 && warnings.length > 0 && <span className="mx-2">•</span>}
            {warnings.length > 0 && (
              <span className="text-amber-400">{warnings.length} предупреждений</span>
            )}
          </div>
          <div className="flex gap-2">
            {!valid && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Отмена
              </button>
            )}
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                valid
                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  : 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25'
              }`}
            >
              {valid ? 'Закрыть' : 'Понятно'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorCard({
  error,
  onHighlight,
  onFix,
}: {
  error: ValidationError;
  onHighlight?: (nodeId: string) => void;
  onFix?: (nodeId: string) => void;
}) {
  const isError = error.severity === 'error';

  return (
    <div
      className={`p-3 rounded-lg border ${
        isError
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-amber-500/5 border-amber-500/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {error.nodeId && (
              <span className="text-xs font-mono text-[var(--text-dim)] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                {error.nodeName}
              </span>
            )}
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                isError ? 'text-red-400' : 'text-amber-400'
              }`}
            >
              {error.type.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {error.message}
          </p>
          {error.portId && (
            <p className="text-xs text-[var(--text-dim)] mt-1">
              Порт: <span className="font-mono">{error.portId}</span>
            </p>
          )}
          {error.settingId && (
            <p className="text-xs text-[var(--text-dim)] mt-1">
              Настройка: <span className="font-mono">{error.settingId}</span>
            </p>
          )}
        </div>

        {error.nodeId && (
          <div className="flex gap-1 flex-shrink-0">
            {onHighlight && (
              <button
                onClick={() => onHighlight(error.nodeId)}
                className="px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-3)] hover:bg-[var(--surface-4)] rounded transition-colors"
                title="Показать ноду"
              >
                Показать
              </button>
            )}
            {onFix && (
              <button
                onClick={() => onFix(error.nodeId)}
                className="px-2 py-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded transition-colors"
                title="Открыть настройки"
              >
                Исправить
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
