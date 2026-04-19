import React, { useState } from 'react';
import { Play, X } from 'lucide-react';

export interface InputField {
  nodeId: string;
  nodeLabel: string;
  fieldLabel: string;
  placeholder?: string;
  description?: string;
  type: 'text' | 'textarea' | 'number';
}

interface RunInputModalProps {
  fields: InputField[];
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export const RunInputModal: React.FC<RunInputModalProps> = ({ fields, onConfirm, onCancel }) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleConfirm = () => {
    onConfirm(values);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl w-full max-w-[500px] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Play size={14} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Run Agent</h2>
              <p className="text-[10px] text-[var(--text-dim)]">Fill in the required inputs to start</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {fields.map((field) => (
            <div key={field.nodeId} className="space-y-2">
              <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                  {field.nodeLabel}
                </span>
                {field.fieldLabel}
              </label>
              {field.description && (
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">{field.description}</p>
              )}
              {field.type === 'textarea' ? (
                <textarea
                  value={values[field.nodeId] || ''}
                  onChange={(e) => setValues(prev => ({ ...prev, [field.nodeId]: e.target.value }))}
                  placeholder={field.placeholder || 'Enter value...'}
                  rows={4}
                  autoFocus
                  className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all"
                />
              ) : (
                <input
                  type={field.type}
                  value={values[field.nodeId] || ''}
                  onChange={(e) => setValues(prev => ({ ...prev, [field.nodeId]: e.target.value }))}
                  placeholder={field.placeholder || 'Enter value...'}
                  autoFocus
                  className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-dim)]">Ctrl+Enter to run</span>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--surface-3)]"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Play size={13} />
              Run Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
