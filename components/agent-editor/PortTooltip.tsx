import React, { useState } from 'react';
import { PortDef } from '@/lib/agent-engine/node-definitions';

interface PortTooltipProps {
  port: PortDef;
  isConnected: boolean;
  children: React.ReactNode;
}

/**
 * Улучшенный тултип для портов с детальной информацией
 */
export const PortTooltip: React.FC<PortTooltipProps> = ({ port, isConnected, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div className="absolute z-50 pointer-events-none" style={{ 
          left: '50%', 
          top: '100%',
          transform: 'translateX(-50%)',
          marginTop: '8px'
        }}>
          <div className="bg-[var(--surface-0)] border border-[var(--border)] rounded-lg shadow-2xl p-3 min-w-[200px] max-w-[300px]">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {port.label}
              </span>
              <span className="text-[10px] font-mono bg-[var(--surface-3)] px-1.5 py-0.5 rounded text-[var(--text-dim)]">
                {port.type}
              </span>
            </div>

            {/* Description */}
            {port.description && (
              <p className="text-[11px] text-[var(--text-dim)] leading-relaxed mb-2">
                {port.description}
              </p>
            )}

            {/* Status */}
            <div className="flex items-center gap-2 text-[10px]">
              {isConnected ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-indigo-400 font-medium">Connected</span>
                </>
              ) : port.required ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="text-rose-400 font-medium">Required</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className="text-slate-400 font-medium">Optional</span>
                </>
              )}
            </div>

            {/* Default Value */}
            {port.defaultValue !== undefined && !isConnected && (
              <div className="mt-2 pt-2 border-t border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-dim)]">Default: </span>
                <span className="text-[10px] font-mono text-[var(--text-primary)]">
                  {typeof port.defaultValue === 'object' 
                    ? JSON.stringify(port.defaultValue) 
                    : String(port.defaultValue)}
                </span>
              </div>
            )}

            {/* Multi */}
            {port.multi && (
              <div className="mt-2 pt-2 border-t border-[var(--border)]">
                <span className="text-[10px] text-amber-400">⚡ Accepts multiple connections</span>
              </div>
            )}
          </div>
          
          {/* Arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-[var(--surface-0)] border-l border-t border-[var(--border)] rotate-45" />
        </div>
      )}
    </div>
  );
};
