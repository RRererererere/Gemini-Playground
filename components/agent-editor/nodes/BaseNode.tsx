import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';
import { PortDef, getPortColor } from '@/lib/agent-engine/node-definitions';

export interface PortState {
  portId: string;
  isConnected: boolean;
  isActive?: boolean;
  hasError?: boolean;
}

interface BaseNodeProps {
  icon: React.ReactNode;
  title: string;
  colorKey: 'blue' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate';
  selected?: boolean;
  children?: React.ReactNode;
  inputs?: PortDef[];
  outputs?: PortDef[];
  portStates?: PortState[];
  status?: 'idle' | 'running' | 'success' | 'warning' | 'error' | 'disabled' | 'waiting';
  error?: string;
  description?: string;
}

const categoryColors = {
  blue:    { border: '#3b82f6', glow: 'rgba(59,130,246,0.25)',   header: 'rgba(59,130,246,0.15)',  text: '#93c5fd' },
  indigo:  { border: '#6366f1', glow: 'rgba(99,102,241,0.25)',   header: 'rgba(99,102,241,0.15)', text: '#a5b4fc' },
  amber:   { border: '#f59e0b', glow: 'rgba(245,158,11,0.25)',   header: 'rgba(245,158,11,0.12)', text: '#fcd34d' },
  emerald: { border: '#10b981', glow: 'rgba(16,185,129,0.25)',   header: 'rgba(16,185,129,0.12)', text: '#6ee7b7' },
  rose:    { border: '#f43f5e', glow: 'rgba(244,63,94,0.25)',    header: 'rgba(244,63,94,0.12)',  text: '#fda4af' },
  slate:   { border: '#64748b', glow: 'rgba(100,116,139,0.2)',   header: 'rgba(100,116,139,0.1)', text: '#94a3b8' },
};

const getStatusGlow = (status: string) => {
  switch (status) {
    case 'running': return { outline: '2px solid #6366f1', boxShadow: '0 0 0 2px #6366f1, 0 0 24px rgba(99,102,241,0.6)' };
    case 'success': return { outline: '2px solid #10b981', boxShadow: '0 0 0 2px #10b981, 0 0 20px rgba(16,185,129,0.4)' };
    case 'error':   return { outline: '2px solid #ef4444', boxShadow: '0 0 0 2px #ef4444, 0 0 24px rgba(239,68,68,0.6)' };
    case 'waiting': return { outline: '2px solid #f59e0b', boxShadow: '0 0 0 2px #f59e0b, 0 0 16px rgba(245,158,11,0.4)' };
    default: return {};
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running': return <Loader2 size={12} className="text-indigo-400 animate-spin flex-shrink-0" />;
    case 'success': return <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />;
    case 'error':   return <XCircle size={12} className="text-red-400 flex-shrink-0" />;
    case 'waiting': return <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />;
    default:        return null;
  }
};

/** Получить цвет handle по состоянию */
const resolveHandleColor = (port: PortDef, portState: PortState | undefined): string => {
  if (portState?.hasError) return '#f87171';
  if (portState?.isActive)  return '#818cf8';
  if (portState?.isConnected) return getPortColor(port.type);
  if (port.required && !port.defaultValue) return '#fb7185'; // обязательный незаполненный
  return getPortColor(port.type);
};

// ─── PORT ROW — строка с handle + лейблом, выровненная в один ряд ───────────

const InputPortRow = ({
  port,
  portState,
}: {
  port: PortDef;
  portState: PortState | undefined;
}) => {
  const color = resolveHandleColor(port, portState);
  const isConnected = portState?.isConnected;
  const isActive = portState?.isActive;

  return (
    <div className="flex items-center gap-0" style={{ position: 'relative', height: 28 }}>
      {/* Handle — крупный, выступает за левый край ноды */}
      <Handle
        type="target"
        position={Position.Left}
        id={port.id}
        title={`${port.label}${port.required ? ' (required)' : ''}${port.description ? ' — ' + port.description : ''}`}
        style={{
          position: 'absolute',
          left: -22,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: color,
          border: `2.5px solid rgba(0,0,0,0.6)`,
          boxShadow: isActive
            ? `0 0 0 3px ${color}66, 0 0 12px ${color}`
            : isConnected
            ? `0 0 0 2px ${color}44, 0 0 8px ${color}88`
            : `0 0 6px ${color}66`,
          cursor: 'crosshair',
          zIndex: 10,
          transition: 'all 0.15s ease',
        }}
      />

      {/* Лейбл — постоянно виден, слева от handle, с цветной точкой */}
      <div className="flex items-center gap-1.5 pl-2">
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
        />
        <span className="text-[10px] font-medium leading-none" style={{ color: '#94a3b8' }}>
          {port.label}
          {port.required && <span style={{ color: '#f87171', marginLeft: 2 }}>*</span>}
        </span>
      </div>
    </div>
  );
};

const OutputPortRow = ({
  port,
  portState,
}: {
  port: PortDef;
  portState: PortState | undefined;
}) => {
  const color = resolveHandleColor(port, portState);
  const isConnected = portState?.isConnected;
  const isActive = portState?.isActive;

  return (
    <div className="flex items-center justify-end gap-0" style={{ position: 'relative', height: 28 }}>
      {/* Лейбл — постоянно виден, справа */}
      <div className="flex items-center gap-1.5 pr-2">
        <span className="text-[10px] font-medium leading-none" style={{ color: '#94a3b8' }}>
          {port.label}
        </span>
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }}
        />
      </div>

      {/* Handle — крупный, выступает за правый край */}
      <Handle
        type="source"
        position={Position.Right}
        id={port.id}
        title={`${port.label} (${port.type})${port.description ? ' — ' + port.description : ''}`}
        style={{
          position: 'absolute',
          right: -22,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: color,
          border: `2.5px solid rgba(0,0,0,0.6)`,
          boxShadow: isActive
            ? `0 0 0 3px ${color}66, 0 0 12px ${color}`
            : isConnected
            ? `0 0 0 2px ${color}44, 0 0 8px ${color}88`
            : `0 0 6px ${color}66`,
          cursor: 'crosshair',
          zIndex: 10,
          transition: 'all 0.15s ease',
        }}
      />
    </div>
  );
};

// ─── MAIN BaseNode ────────────────────────────────────────────────────────────

export const BaseNode = ({
  icon,
  title,
  colorKey,
  selected,
  children,
  inputs = [],
  outputs = [],
  portStates = [],
  status = 'idle',
  error,
  description,
}: BaseNodeProps) => {
  const colors = categoryColors[colorKey];
  const getPortState = (portId: string) => portStates.find(ps => ps.portId === portId);

  const nodeStyle: React.CSSProperties = {
    minWidth: 260,
    maxWidth: 380,
    borderRadius: 14,
    border: `1.5px solid ${selected ? colors.border : colors.border + '80'}`,
    background: 'rgba(10, 10, 16, 0.92)',
    backdropFilter: 'blur(12px)',
    boxShadow: selected
      ? `0 0 0 2px ${colors.border}40, 0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${colors.glow}`
      : `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${colors.glow}`,
    transition: 'all 0.2s ease',
    transform: selected ? 'scale(1.01)' : 'scale(1)',
    ...getStatusGlow(status),
  };

  return (
    <div style={nodeStyle}>

      {/* ── Заголовок ─────────────────────────────────── */}
      <div
        style={{
          padding: '9px 12px',
          background: colors.header,
          borderBottom: `1px solid ${colors.border}30`,
          borderRadius: '14px 14px 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ color: colors.text, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span style={{ color: colors.text, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        {getStatusIcon(status)}
        {description && (
          <div className="group relative flex-shrink-0">
            <Info size={11} style={{ color: '#475569', cursor: 'help' }} />
            <div
              className="absolute right-0 top-6 z-50 hidden group-hover:block pointer-events-none"
              style={{
                width: 220,
                background: 'rgba(6,6,12,0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 10,
                color: '#94a3b8',
                lineHeight: 1.6,
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
              }}
            >
              {description}
            </div>
          </div>
        )}
      </div>

      {/* ── Порты + тело ──────────────────────────────── */}
      <div style={{ display: 'flex', padding: '8px 0' }}>

        {/* Левая колонка — входные порты */}
        {inputs.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              paddingLeft: 22,   // 22px = handle выступает на 22px, так что текст начинается от края ноды
              paddingRight: 4,
              paddingTop: 4,
              paddingBottom: 4,
              minWidth: 110,
              borderRight: outputs.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, paddingLeft: 2 }}>
              Inputs
            </div>
            {inputs.map(port => (
              <InputPortRow key={port.id} port={port} portState={getPortState(port.id)} />
            ))}
          </div>
        )}

        {/* Центр — основной контент */}
        <div style={{ flex: 1, minWidth: 0, padding: '4px 8px' }}>
          {children}
          {error && (
            <div style={{
              marginTop: 6,
              padding: '4px 8px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              fontSize: 10,
              color: '#f87171',
              wordBreak: 'break-word',
            }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* Правая колонка — выходные порты */}
        {outputs.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              paddingRight: 22,
              paddingLeft: 4,
              paddingTop: 4,
              paddingBottom: 4,
              minWidth: 110,
              alignItems: 'flex-end',
              borderLeft: inputs.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, paddingRight: 2 }}>
              Outputs
            </div>
            {outputs.map(port => (
              <OutputPortRow key={port.id} port={port} portState={getPortState(port.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
