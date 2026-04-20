import React, { useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { X, Settings2, Info, ChevronDown, Plug, SlidersHorizontal, Tag } from 'lucide-react';
import { UniversalModel, ActiveModel, ApiKeyEntry } from '@/types';
import { NODE_DEFINITIONS } from '@/lib/agent-engine/node-definitions';
import { loadApiKeys } from '@/lib/apiKeyManager';
import { HybridField } from './HybridField';
import { usePortConnection } from './usePortConnection';

// ── Debounced Inputs ────────────────────────────────────────

const DebouncedInput = ({ value: initialValue, onChange, ...props }: any) => {
  const [value, setValue] = useState(initialValue);

  // Update local state and trigger parent change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onChange(e.target.value);
  };

  // Sync if parent updates externally
  useEffect(() => {
    if (initialValue !== value) {
      setValue(initialValue);
    }
  }, [initialValue]);

  return <input value={value} onChange={handleChange} {...props} />;
};

const DebouncedTextarea = ({ value: initialValue, onChange, ...props }: any) => {
  const [value, setValue] = useState(initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onChange(e.target.value);
  };

  useEffect(() => {
    if (initialValue !== value) {
      setValue(initialValue);
    }
  }, [initialValue]);

  return <textarea value={value} onChange={handleChange} {...props} />;
};

interface AgentEditorPropertiesProps {
  node: Node | null;
  edges: Edge[];
  onClose: () => void;
  updateNodeData: (id: string, data: any) => void;
  allModels?: UniversalModel[];
  activeModel?: ActiveModel | null;
  apiKeys?: Record<string, ApiKeyEntry[]>;
}

// ── Accordion Section ────────────────────────────────────────

const AccordionSection = ({
  title,
  icon,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: '#64748b' }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', flex: 1, textAlign: 'left' }}>
          {title}
        </span>
        {badge !== undefined && (
          <span style={{
            fontSize: 9,
            fontWeight: 600,
            background: 'rgba(99,102,241,0.1)',
            color: '#818cf8',
            padding: '1px 6px',
            borderRadius: 4,
          }}>
            {badge}
          </span>
        )}
        <ChevronDown
          size={14}
          style={{
            color: '#64748b',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
      </button>
      {isOpen && (
        <div style={{ paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────

export const AgentEditorProperties: React.FC<AgentEditorPropertiesProps> = ({ 
  node, 
  edges,
  onClose, 
  updateNodeData, 
  allModels = [], 
  activeModel, 
  apiKeys = {} 
}) => {
  
  if (!node) return null;

  const nodeDef = NODE_DEFINITIONS[node.type!];
  const { isPortConnected } = usePortConnection(node, edges);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    updateNodeData(node.id, {
       ...node.data,
       [e.target.name]: e.target.value
    });
  };

  const handleInputChange = (portId: string, value: any) => {
    updateNodeData(node.id, {
      ...node.data,
      inputs: {
        ...(node.data.inputs as Record<string, any> || {}),
        [portId]: value
      }
    });
  };

  const handleSettingChange = (settingId: string, value: any) => {
    updateNodeData(node.id, {
      ...node.data,
      settings: {
        ...(node.data.settings as Record<string, any> || {}),
        [settingId]: value
      },
      // Backward compatibility — also save to data root
      [settingId]: value
    });
  };

  const renderSettingField = (setting: any, node: Node, onChange: (id: string, value: any) => void) => {
    const currentValue = (node.data.settings as Record<string, any>)?.[setting.id] ?? 
                        (node.data as Record<string, any>)?.[setting.id] ?? 
                        setting.defaultValue;

    const inputClass = "w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all";

    // Wrapper functions for inputs
    const handleDebouncedChange = (val: string) => {
      onChange(setting.id, val);
    };

    switch (setting.type) {
      case 'select': {
        let options = setting.options || [];
        
        if (setting.id === 'model') {
          if (allModels && allModels.length > 0) {
            options = allModels.map((model: any) => ({
              value: model.name || model.id,
              label: model.displayName || model.name || model.id
            }));
          }
        } else if (setting.id === 'apiKeyIndex') {
          try {
            const googleKeys = loadApiKeys('google');
            if (googleKeys.length > 0) {
              options = googleKeys.map((entry: ApiKeyEntry, index: number) => ({
                value: String(index),
                label: `${entry.label || 'Key ' + (index + 1)} (${(entry.key || '').substring(0, 8)}…)`
              }));
            } else {
              options = [{ value: '0', label: 'No API keys — add in Settings' }];
            }
          } catch {
            options = [{ value: '0', label: 'No API keys — add in Settings' }];
          }
        }
        
        return (
          <select
            value={currentValue}
            onChange={(e) => onChange(setting.id, e.target.value)}
            className={inputClass}
          >
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      }

      case 'number':
        if (setting.id === 'temperature') {
          return (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={currentValue}
                onChange={(e) => onChange(setting.id, Number(e.target.value))}
                className="flex-1 accent-indigo-500"
                style={{ height: 4 }}
              />
              <span className="text-[10px] font-mono text-[var(--text-dim)] w-6 text-right">{currentValue}</span>
            </div>
          );
        }
        return (
          <input
            type="number"
            value={currentValue}
            onChange={(e) => onChange(setting.id, Number(e.target.value))}
            placeholder={setting.placeholder}
            className={inputClass}
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={currentValue}
                onChange={(e) => onChange(setting.id, e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface-3)] text-indigo-500 focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>
            <span className="text-xs text-[var(--text-dim)] group-hover:text-[var(--text-primary)] transition-colors">
              {setting.description || setting.label}
            </span>
          </label>
        );

      case 'textarea':
        return (
          <DebouncedTextarea
            value={currentValue || ''}
            onChange={handleDebouncedChange}
            placeholder={setting.placeholder}
            className={`${inputClass} h-20 resize-none font-mono`}
          />
        );

      case 'json':
        return (
          <DebouncedTextarea
            value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue, null, 2) || ''}
            onChange={(val: string) => {
              try {
                const parsed = JSON.parse(val);
                onChange(setting.id, parsed);
              } catch {
                onChange(setting.id, val);
              }
            }}
            placeholder={setting.placeholder || '{}'}
            className={`${inputClass} h-28 resize-none font-mono`}
          />
        );

      case 'text':
      default:
        return (
          <DebouncedInput
            value={currentValue || ''}
            onChange={handleDebouncedChange}
            placeholder={setting.placeholder}
            className={inputClass}
          />
        );
    }
  };

  return (
    <div
      className="bg-[var(--surface-1)] border-l border-[var(--border)] flex flex-col h-full z-20 absolute right-0 top-0 bottom-0"
      style={{ width: 320, boxShadow: '-4px 0 20px rgba(0,0,0,0.15)' }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
      }}>
        <h3 style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          margin: 0,
        }}>
          <Settings2 size={14} style={{ color: '#818cf8' }} />
          Properties
        </h3>
        <button
          onClick={onClose}
          style={{
            padding: 4,
            borderRadius: 6,
            border: 'none',
            background: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>
      
      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>

        {/* Description badge */}
        {nodeDef?.description && (
          <div style={{
            marginTop: 12,
            padding: '8px 10px',
            background: 'rgba(99,102,241,0.04)',
            border: '1px solid rgba(99,102,241,0.1)',
            borderRadius: 10,
            display: 'flex',
            gap: 6,
          }}>
            <Info size={12} style={{ color: '#818cf8', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
              {nodeDef.description}
            </span>
          </div>
        )}

        {/* ── Identity Section ──────────────────────────── */}
        <AccordionSection title="Identity" icon={<Tag size={13} />} defaultOpen={true}>
          <div style={{
            padding: '8px 10px',
            background: 'var(--surface-2)',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              {node.id}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>
              {node.type}
            </div>
          </div>
          
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
              Node Label
            </label>
            <input 
              type="text" 
              name="label" 
              value={node.data?.label as string || ''} 
              onChange={handleChange}
              className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all font-medium"
            />
          </div>
        </AccordionSection>

        {/* ── Input Ports Section ──────────────────────── */}
        {nodeDef && nodeDef.inputs.length > 0 && (
          <AccordionSection
            title="Input Ports"
            icon={<Plug size={13} />}
            defaultOpen={true}
            badge={nodeDef.inputs.length}
          >
            {nodeDef.inputs.map(port => (
              <HybridField
                key={port.id}
                port={port}
                isConnected={isPortConnected(port.id, true)}
                value={(node.data.inputs as Record<string, any>)?.[port.id]}
                onChange={(value) => handleInputChange(port.id, value)}
                nodeType={node.type}
              />
            ))}
          </AccordionSection>
        )}

        {/* ── Settings Section ────────────────────────── */}
        {nodeDef && nodeDef.settings.length > 0 && (
          <AccordionSection
            title="Settings"
            icon={<SlidersHorizontal size={13} />}
            defaultOpen={true}
            badge={nodeDef.settings.length}
          >
            {nodeDef.settings.map(setting => (
              <div key={setting.id}>
                <label style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}>
                  <span>{setting.label}</span>
                  {setting.type === 'number' && (
                    <span style={{ color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      {(node.data.settings as Record<string, any>)?.[setting.id] ?? 
                       (node.data as Record<string, any>)?.[setting.id] ?? 
                       setting.defaultValue}
                    </span>
                  )}
                </label>
                {renderSettingField(setting, node, handleSettingChange)}
                {setting.description && setting.type !== 'checkbox' && (
                  <p style={{
                    fontSize: 10,
                    color: '#64748b',
                    lineHeight: 1.4,
                    marginTop: 3,
                    marginBottom: 0,
                  }}>
                    {setting.description}
                  </p>
                )}
              </div>
            ))}
          </AccordionSection>
        )}

        {/* Legacy Support */}
        {!nodeDef && (
          <div style={{ marginTop: 16, padding: '8px 10px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 8 }}>
            <span style={{ fontSize: 10, color: '#fbbf24' }}>
              Legacy node — update to use NODE_DEFINITIONS
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
