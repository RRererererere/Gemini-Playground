import React, { useState } from 'react';
import { Play, X, Info, Settings2, Terminal } from 'lucide-react';

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
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-[var(--surface-1)] border border-[var(--border-strong)] rounded-2xl w-full max-w-[550px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <Terminal size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Pre-flight Execution</h2>
              <p className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider font-semibold">Variables required</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-dim)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {fields.map((field) => (
            <div key={field.nodeId} className="space-y-3 bg-[var(--surface-2)] p-4 rounded-xl border border-[var(--border)]">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  {field.fieldLabel}
                </label>
                <span className="text-[9px] font-bold font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded uppercase">
                  {field.nodeLabel}
                </span>
              </div>
              
              {field.description && (
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed bg-[var(--surface-1)]/50 p-2 rounded-lg border border-[var(--border)]/50 italic">
                  {field.description}
                </p>
              )}

              <div className="relative">
                {field.type === 'textarea' ? (
                  <textarea
                    value={values[field.nodeId] || ''}
                    onChange={(e) => setValues(prev => ({ ...prev, [field.nodeId]: e.target.value }))}
                    placeholder={field.placeholder || 'Enter value...'}
                    rows={4}
                    autoFocus
                    className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none transition-all placeholder:text-[var(--text-dim)]/50 font-mono"
                  />
                ) : (
                  <input
                    type={field.type}
                    value={values[field.nodeId] || ''}
                    onChange={(e) => setValues(prev => ({ ...prev, [field.nodeId]: e.target.value }))}
                    placeholder={field.placeholder || 'Enter value...'}
                    autoFocus
                    className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all placeholder:text-[var(--text-dim)]/50 font-mono"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)]">
             <kbd className="px-1.5 py-0.5 bg-[var(--surface-3)] border border-[var(--border)] rounded text-[9px] font-bold">Ctrl</kbd>
             <span>+</span>
             <kbd className="px-1.5 py-0.5 bg-[var(--surface-3)] border border-[var(--border)] rounded text-[9px] font-bold">Enter</kbd>
             <span className="ml-1">to initiate</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 hover:scale-105 active:scale-95"
            >
              <Play size={16} className="fill-current" />
              Launch Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
