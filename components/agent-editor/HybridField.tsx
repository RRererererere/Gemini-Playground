import React from 'react';
import { Link2, Edit3 } from 'lucide-react';
import { PortDef } from '@/lib/agent-engine/node-definitions';

interface HybridFieldProps {
  port: PortDef;
  isConnected: boolean;
  value: any;
  onChange: (value: any) => void;
  nodeType?: string;
}

/**
 * HybridField - универсальное поле для Properties Panel
 * Может быть заполнено вручную ИЛИ подключено через wire
 */
export const HybridField: React.FC<HybridFieldProps> = ({
  port,
  isConnected,
  value,
  onChange,
  nodeType
}) => {
  const renderInput = () => {
    // Если подключено через wire - показываем заблокированное поле
    if (isConnected) {
      return (
        <div className="w-full bg-[var(--surface-3)] border border-indigo-500/50 rounded-md px-3 py-2 text-sm text-[var(--text-dim)] flex items-center gap-2">
          <Link2 size={14} className="text-indigo-400" />
          <span className="italic">Connected via wire</span>
        </div>
      );
    }

    // Иначе показываем редактируемое поле в зависимости от типа
    switch (port.type) {
      case 'text':
        if (port.id === 'prompt' || port.id === 'expression' || port.id === 'condition' || port.id === 'code') {
          // Большое текстовое поле для промптов и кода
          return (
            <textarea
              value={value ?? port.defaultValue ?? ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={port.description || `Enter ${port.label.toLowerCase()}...`}
              className="w-full h-24 bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none font-mono"
            />
          );
        }
        
        // Обычное текстовое поле
        return (
          <input
            type="text"
            value={value ?? port.defaultValue ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={port.description || `Enter ${port.label.toLowerCase()}...`}
            className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? port.defaultValue ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={port.description || `Enter ${port.label.toLowerCase()}...`}
            className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value ?? port.defaultValue ?? false}
              onChange={(e) => onChange(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface-3)] text-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
            />
            <span className="text-sm text-[var(--text-dim)]">
              {port.description || 'Enable'}
            </span>
          </label>
        );

      case 'object':
      case 'array':
        // JSON редактор
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value ?? port.defaultValue ?? {}, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                // Если невалидный JSON - сохраняем как строку
                onChange(e.target.value);
              }
            }}
            placeholder={port.description || `Enter JSON ${port.type}...`}
            className="w-full h-32 bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none font-mono"
          />
        );

      case 'any':
      default:
        // Универсальное текстовое поле
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value ?? port.defaultValue ?? '', null, 2)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={port.description || `Enter value...`}
            className="w-full h-20 bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
          />
        );
    }
  };

  const canFillManually = !port.required || port.defaultValue !== undefined;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {port.label}
          {port.required && !isConnected && (
            <span className="text-rose-400 text-[10px]">*</span>
          )}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-dim)]">
          {isConnected ? (
            <>
              <Link2 size={10} className="text-indigo-400" />
              <span className="text-indigo-400">wired</span>
            </>
          ) : canFillManually ? (
            <>
              <Edit3 size={10} />
              <span>manual</span>
            </>
          ) : null}
          <span className="bg-[var(--surface-3)] px-1.5 py-0.5 rounded font-mono">
            {port.type}
          </span>
        </span>
      </label>
      
      {renderInput()}
      
      {port.description && !isConnected && (
        <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
          {port.description}
        </p>
      )}
    </div>
  );
};
