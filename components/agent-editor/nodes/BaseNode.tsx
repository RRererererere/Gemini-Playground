import React, { useState } from 'react';
import { Handle, Position, useNodeId, useNodeConnections, useNodesData } from '@xyflow/react';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Info, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import { PortDef, getPortColor } from '@/lib/agent-engine/node-definitions';
import type { StructuredError } from '@/lib/agent-engine/types';

export interface PortState {
  portId: string;
  isConnected: boolean;
  isActive?: boolean;
  hasError?: boolean;
}

interface BaseNodeProps {
  icon: React.ReactNode;
  title: string;
  colorKey: 'blue' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate' | 'violet';
  selected?: boolean;
  children?: React.ReactNode;
  inputs?: PortDef[];
  outputs?: PortDef[];
  portStates?: PortState[];
  status?: 'idle' | 'running' | 'success' | 'warning' | 'error' | 'disabled' | 'waiting' | 'skipped';
  error?: string | import('@/lib/agent-engine/types').StructuredError;
  description?: string;
  duration?: number;
  nodeData?: any;
}

// ── Refined color palette — muted, professional ─────────────
const categoryColors: Record<string, {
  accent: string;
  headerBg: string;
  headerBorder: string;
  accentMuted: string;
  text: string;
}> = {
  blue:    { accent: '#3b82f6', headerBg: 'rgba(59,130,246,0.08)',  headerBorder: 'rgba(59,130,246,0.15)',  accentMuted: 'rgba(59,130,246,0.12)',  text: '#93c5fd' },
  indigo:  { accent: '#6366f1', headerBg: 'rgba(99,102,241,0.08)',  headerBorder: 'rgba(99,102,241,0.15)', accentMuted: 'rgba(99,102,241,0.12)', text: '#a5b4fc' },
  amber:   { accent: '#f59e0b', headerBg: 'rgba(245,158,11,0.06)',  headerBorder: 'rgba(245,158,11,0.12)', accentMuted: 'rgba(245,158,11,0.10)', text: '#fcd34d' },
  emerald: { accent: '#10b981', headerBg: 'rgba(16,185,129,0.06)',  headerBorder: 'rgba(16,185,129,0.12)', accentMuted: 'rgba(16,185,129,0.10)', text: '#6ee7b7' },
  rose:    { accent: '#f43f5e', headerBg: 'rgba(244,63,94,0.06)',   headerBorder: 'rgba(244,63,94,0.12)',  accentMuted: 'rgba(244,63,94,0.10)',  text: '#fda4af' },
  violet:  { accent: '#8b5cf6', headerBg: 'rgba(139,92,246,0.06)',  headerBorder: 'rgba(139,92,246,0.12)', accentMuted: 'rgba(139,92,246,0.10)', text: '#c4b5fd' },
  slate:   { accent: '#64748b', headerBg: 'rgba(100,116,139,0.06)', headerBorder: 'rgba(100,116,139,0.10)', accentMuted: 'rgba(100,116,139,0.08)', text: '#94a3b8' },
};

const getStatusClassName = (status: string): string => {
  switch (status) {
    case 'running': return 'agent-node--running';
    case 'success': return 'agent-node--success';
    case 'error':   return 'agent-node--error';
    case 'skipped': return 'agent-node--skipped';
    default: return '';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running': return <Loader2 size={11} className="text-indigo-400 animate-spin flex-shrink-0" />;
    case 'success': return <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />;
    case 'error':   return <XCircle size={11} className="text-red-400 flex-shrink-0" />;
    case 'waiting': return <AlertCircle size={11} className="text-amber-400 flex-shrink-0" />;
    case 'skipped': return <AlertCircle size={11} className="text-slate-500 flex-shrink-0" />;
    default:        return null;
  }
};

/** Muted port color — less saturated than original */
const getPortColorMuted = (portType: string): string => {
  const colors: Record<string, string> = {
    text:    '#818cf8',
    number:  '#34d399',
    boolean: '#f472b6',
    object:  '#fb923c',
    array:   '#fbbf24',
    any:     '#94a3b8',
  };
  return colors[portType] || '#94a3b8';
};

/** Resolve handle color based on state */
const resolveHandleColor = (port: PortDef, portState: PortState | undefined): string => {
  if (portState?.hasError) return '#f87171';
  if (portState?.isActive) return '#818cf8';
  return getPortColorMuted(port.type);
};

// ─── PORT ROW — minimal, clean design ────────────────────────

const InputPortRow = ({ port, portState, nodeData }: { port: PortDef; portState: PortState | undefined; nodeData: any }) => {
  const connections = useNodeConnections({ handleType: 'target', handleId: port.id });
  const isConnected = connections.length > 0;
  const color = resolveHandleColor(port, { ...portState, isConnected, portId: port.id });
  
  const sourceNodeData = useNodesData(connections[0]?.source);
  
  const manualValue = nodeData?.inputs?.[port.id] ?? nodeData?.settings?.[port.id];
  let preview = null;
  
  if (isConnected && sourceNodeData) {
    const sType = String(sourceNodeData.type || '').replace('agent_', '');
    const sLabel = String(sourceNodeData.data?.label || sType || 'Node');
    preview = (
      <span style={{ fontSize: 9, color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 120 }}>
        {sLabel}
      </span>
    );
  } else if (manualValue !== undefined && manualValue !== null && manualValue !== '') {
    preview = (
      <span style={{ fontSize: 9, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 120, fontFamily: 'var(--font-mono)' }}>
        {typeof manualValue === 'string' ? manualValue : JSON.stringify(manualValue)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0 w-full" style={{ position: 'relative', height: 26 }}>
      <Handle
        type="target"
        position={Position.Left}
        id={port.id}
        title={`${port.label}${port.required ? ' (required)' : ''}${port.description ? ' — ' + port.description : ''}`}
        style={{
          position: 'absolute',
          left: -18,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: isConnected ? color : 'transparent',
          border: `2px solid ${color}`,
          boxShadow: isConnected ? `0 0 6px ${color}55` : 'none',
          cursor: 'crosshair',
          zIndex: 10,
          transition: 'all 0.15s ease',
        }}
      />
      <div className="flex items-center justify-between pl-1 w-full gap-2">
        <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', lineHeight: 1, whiteSpace: 'nowrap' }}>
          {port.label}
          {port.required && <span style={{ color: '#f87171', marginLeft: 2, fontSize: 9 }}>*</span>}
        </span>
        {preview && (
          <div className="flex-1 flex justify-end min-w-0 pr-2">
            {preview}
          </div>
        )}
      </div>
    </div>
  );
};

const OutputPortRow = ({ port, portState }: { port: PortDef; portState: PortState | undefined }) => {
  const color = resolveHandleColor(port, portState);
  const isConnected = portState?.isConnected;

  return (
    <div className="flex items-center justify-end gap-0" style={{ position: 'relative', height: 24 }}>
      <div className="flex items-center gap-1.5 pr-1">
        <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8', lineHeight: 1 }}>
          {port.label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id={port.id}
        title={`${port.label} (${port.type})${port.description ? ' — ' + port.description : ''}`}
        style={{
          position: 'absolute',
          right: -18,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: isConnected ? color : 'transparent',
          border: `2px solid ${color}`,
          boxShadow: isConnected ? `0 0 6px ${color}55` : 'none',
          cursor: 'crosshair',
          zIndex: 10,
          transition: 'all 0.15s ease',
        }}
      />
    </div>
  );
};

// ─── STRUCTURED ERROR DISPLAY ─────────────────────────────────

interface StructuredErrorDisplayProps {
  error: StructuredError;
  nodeData?: any;
}

const StructuredErrorDisplay = ({ error, nodeData }: StructuredErrorDisplayProps) => {
  const [showInput, setShowInput] = useState(false);
  const [showStack, setShowStack] = useState(false);

  const copyToClipboard = () => {
    const fullError = {
      message: error.message,
      type: error.type,
      nodeType: error.nodeType,
      timestamp: new Date(error.timestamp).toISOString(),
      inputSnapshot: error.inputSnapshot,
      stack: error.stack,
    };
    navigator.clipboard.writeText(JSON.stringify(fullError, null, 2));
  };

  return (
    <div style={{
      marginTop: 6,
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '6px 8px',
        background: 'rgba(239,68,68,0.12)',
        borderBottom: '1px solid rgba(239,68,68,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <XCircle size={12} style={{ color: '#f87171', flexShrink: 0 }} />
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: '#fca5a5',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          flex: 1,
        }}>
          {error.type || 'Error'}
        </span>
        <button
          onClick={copyToClipboard}
          title="Копировать в буфер"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '2px 4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          }}
        >
          <Copy size={10} style={{ color: '#94a3b8' }} />
        </button>
      </div>

      {/* Message */}
      <div style={{
        padding: '6px 8px',
        fontSize: 10,
        color: '#f87171',
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>
        {error.message}
      </div>

      {/* Input Snapshot */}
      {error.inputSnapshot && Object.keys(error.inputSnapshot).length > 0 && (
        <div style={{ borderTop: '1px solid rgba(239,68,68,0.1)' }}>
          <button
            onClick={() => setShowInput(!showInput)}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              color: '#94a3b8',
              textAlign: 'left',
            }}
          >
            {showInput ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span>Input данные</span>
          </button>
          {showInput && (
            <pre style={{
              margin: 0,
              padding: '4px 8px',
              fontSize: 8,
              color: '#cbd5e1',
              background: 'rgba(0,0,0,0.2)',
              overflowX: 'auto',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.4,
            }}>
              {JSON.stringify(error.inputSnapshot, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Stack Trace */}
      {error.stack && (
        <div style={{ borderTop: '1px solid rgba(239,68,68,0.1)' }}>
          <button
            onClick={() => setShowStack(!showStack)}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 9,
              color: '#94a3b8',
              textAlign: 'left',
            }}
          >
            {showStack ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span>Stack trace</span>
          </button>
          {showStack && (
            <pre style={{
              margin: 0,
              padding: '4px 8px',
              fontSize: 7,
              color: '#64748b',
              background: 'rgba(0,0,0,0.2)',
              overflowX: 'auto',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.3,
              maxHeight: 120,
              overflowY: 'auto',
            }}>
              {error.stack}
            </pre>
          )}
        </div>
      )}

      {/* Metadata */}
      <div style={{
        padding: '4px 8px',
        borderTop: '1px solid rgba(239,68,68,0.1)',
        fontSize: 8,
        color: '#64748b',
        display: 'flex',
        gap: 8,
      }}>
        {error.nodeType && <span>Node: {error.nodeType}</span>}
        <span>
          {new Date(error.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

// ─── MAIN BaseNode ────────────────────────────────────────────

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
  duration,
  nodeData,
}: BaseNodeProps) => {
  const colors = categoryColors[colorKey] || categoryColors.slate;
  const getPortState = (portId: string) => portStates.find(ps => ps.portId === portId);
  const statusClass = getStatusClassName(status);

  const nodeStyle: React.CSSProperties = {
    minWidth: 240,
    maxWidth: 360,
    borderRadius: 'var(--node-radius)',
    border: `1px solid ${selected ? colors.accent + '60' : 'var(--node-border)'}`,
    background: 'var(--node-bg)',
    backdropFilter: 'blur(16px)',
    boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
    transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease',
    fontFamily: 'var(--font-sans)',
  };

  return (
    <div style={nodeStyle} className={statusClass}>

      {/* ── Header ──────────────────────────────────── */}
      <div
        style={{
          padding: '8px 12px',
          background: colors.headerBg,
          borderBottom: `1px solid ${colors.headerBorder}`,
          borderRadius: 'var(--node-radius) var(--node-radius) 0 0',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
        }}
      >
        <span style={{ color: colors.text, display: 'flex', alignItems: 'center', opacity: 0.85 }}>{icon}</span>
        <span style={{
          color: '#e2e8f0',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>

        {/* Duration badge */}
        {((duration !== undefined && duration > 0) || (nodeData?.duration && nodeData.duration > 0)) && status !== 'running' && (
          <span style={{
            fontSize: 9,
            fontWeight: 500,
            color: (duration || nodeData.duration) < 1000 ? '#34d399' : (duration || nodeData.duration) < 3000 ? '#fbbf24' : '#f87171',
            background: 'rgba(255,255,255,0.04)',
            padding: '1px 5px',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
          }}>
            {(duration || nodeData.duration) < 1000 ? `${(duration || nodeData.duration)}ms` : `${((duration || nodeData.duration) / 1000).toFixed(1)}s`}
          </span>
        )}

        {getStatusIcon(status)}

        {description && (
          <div className="group relative flex-shrink-0">
            <Info size={11} style={{ color: '#475569', cursor: 'help', opacity: 0.6 }} />
            <div
              className="absolute right-0 top-6 z-50 hidden group-hover:block pointer-events-none"
              style={{
                width: 220,
                background: 'rgba(8,8,14,0.97)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 10,
                color: '#94a3b8',
                lineHeight: 1.6,
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {description}
            </div>
          </div>
        )}
      </div>

      {/* ── Ports + Body ──────────────────────────────── */}
      <div style={{ display: 'flex', padding: '6px 0' }}>

        {/* Left column — inputs */}
        {inputs.length > 0 && (
          <div style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            gap: 1,
            paddingLeft: 18,
            paddingRight: 4,
            paddingTop: 2,
            paddingBottom: 2,
            minWidth: 100,
            borderRight: outputs.length > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
          }}>
            <div style={{
              fontSize: 8,
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
              marginBottom: 2,
              paddingLeft: 1,
            }}>
              Inputs
            </div>
            {inputs.map(port => (
              <InputPortRow key={port.id} port={port} portState={getPortState(port.id)} nodeData={nodeData} />
            ))}
          </div>
        )}

        {/* Node Center / Floating Error — Render only if there's an error */}
        {error && (
          <div style={{ flex: 1, minWidth: 0, padding: '2px 8px' }}>
            {typeof error === 'string' ? (
              // Простая строка (legacy)
              <div style={{
                marginTop: 6,
                padding: '4px 8px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 6,
                fontSize: 10,
                color: '#f87171',
                wordBreak: 'break-word',
              }}>
                {error}
              </div>
            ) : (
              // 🔴 ФИКС #6: Structured Error Display
              <StructuredErrorDisplay error={error} nodeData={nodeData} />
            )}
          </div>
        )}

        {/* Right column — outputs */}
        {outputs.length > 0 && (
          <div style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            gap: 1,
            paddingRight: 18,
            paddingLeft: 4,
            paddingTop: 2,
            paddingBottom: 2,
            minWidth: 100,
            alignItems: 'flex-end',
            borderLeft: inputs.length > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
          }}>
            <div style={{
              fontSize: 8,
              color: '#334155',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 600,
              marginBottom: 2,
              paddingRight: 1,
            }}>
              Outputs
            </div>
            {outputs.map(port => (
              <OutputPortRow key={port.id} port={port} portState={getPortState(port.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Children (custom node body) ──────────────── */}
      {children && (
        <div style={{ padding: '4px 12px 10px' }}>
          {children}
        </div>
      )}
    </div>
  );
};
