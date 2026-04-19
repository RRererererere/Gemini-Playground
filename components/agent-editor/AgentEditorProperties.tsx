import React from 'react';
import { Node, Edge } from '@xyflow/react';
import { X, Settings2, Info } from 'lucide-react';
import { UniversalModel, ActiveModel, ApiKeyEntry } from '@/types';
import { NODE_DEFINITIONS } from '@/lib/agent-engine/node-definitions';
import { loadApiKeys } from '@/lib/apiKeyManager';
import { HybridField } from './HybridField';
import { usePortConnection } from './usePortConnection';

interface AgentEditorPropertiesProps {
  node: Node | null;
  edges: Edge[];
  onClose: () => void;
  updateNodeData: (id: string, data: any) => void;
  allModels?: UniversalModel[];
  activeModel?: ActiveModel | null;
  apiKeys?: Record<string, ApiKeyEntry[]>;
}

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
      // Для обратной совместимости сохраняем и в корне data
      [settingId]: value
    });
  };

  const renderSettingField = (setting: any, node: Node, onChange: (id: string, value: any) => void) => {
    const currentValue = (node.data.settings as Record<string, any>)?.[setting.id] ?? 
                        (node.data as Record<string, any>)?.[setting.id] ?? 
                        setting.defaultValue;

    switch (setting.type) {
      case 'select':
        // Динамические options для model и apiKeyIndex
        let options = setting.options || [];
        
        if (setting.id === 'model' && allModels && allModels.length > 0) {
          // Использовать реальные модели из allModels
          options = allModels.map((model: any) => ({
            value: model.name || model.id,
            label: model.displayName || model.name || model.id
          }));
          console.log('[AgentEditorProperties] Model options:', options);
        } else if (setting.id === 'apiKeyIndex') {
          // Читаем API ключи из правильного источника — apiKeyManager (gemini_api_keys)
          try {
            const googleKeys = loadApiKeys('google');
            if (googleKeys.length > 0) {
              options = googleKeys.map((entry: ApiKeyEntry, index: number) => ({
                value: String(index),
                label: `${entry.label || 'Key ' + (index + 1)} (${(entry.key || '').substring(0, 8)}...)`
              }));
            } else {
              options = [{ value: '0', label: '⚠️ No API keys — add in Settings' }];
            }
          } catch (e) {
            options = [{ value: '0', label: '⚠️ No API keys — add in Settings' }];
          }
        }
        
        return (
          <select
            value={currentValue}
            onChange={(e) => onChange(setting.id, e.target.value)}
            className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );

      case 'number':
        if (setting.id === 'temperature') {
          // Слайдер для temperature
          return (
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={currentValue}
              onChange={(e) => onChange(setting.id, Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          );
        }
        return (
          <input
            type="number"
            value={currentValue}
            onChange={(e) => onChange(setting.id, Number(e.target.value))}
            placeholder={setting.placeholder}
            className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        );

      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={currentValue}
              onChange={(e) => onChange(setting.id, e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] bg-[var(--surface-3)] text-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
            />
            <span className="text-sm text-[var(--text-dim)]">
              {setting.description || setting.label}
            </span>
          </label>
        );

      case 'textarea':
        return (
          <textarea
            value={currentValue}
            onChange={(e) => onChange(setting.id, e.target.value)}
            placeholder={setting.placeholder}
            className="w-full h-24 bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-mono"
          />
        );

      case 'json':
        return (
          <textarea
            value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(setting.id, parsed);
              } catch {
                onChange(setting.id, e.target.value);
              }
            }}
            placeholder={setting.placeholder || '{}'}
            className="w-full h-32 bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none font-mono"
          />
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={currentValue}
            onChange={(e) => onChange(setting.id, e.target.value)}
            placeholder={setting.placeholder}
            className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        );
    }
  };

  const renderLegacyFields = (node: Node, onChange: any, allModels: any[], activeModel: any, apiKeys: any) => {
    // Fallback для старых нод без NODE_DEFINITIONS
    return (
      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2">
          ⚠️ Legacy node - update to use NODE_DEFINITIONS
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 bg-[var(--surface-1)] border-l border-[var(--border)] flex flex-col h-full shadow-[-4px_0_15px_rgba(0,0,0,0.1)] z-20 absolute right-0 top-0 bottom-0">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Settings2 size={16} className="text-indigo-400" />
          Properties
        </h3>
        <button onClick={onClose} className="p-1 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors">
          <X size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node description info block */}
        {nodeDef?.description && (
          <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg flex gap-2">
            <Info size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-[var(--text-dim)] leading-relaxed">
              {nodeDef.description}
            </div>
          </div>
        )}

        {/* Common Info */}
        <div className="space-y-1 bg-[var(--surface-2)] p-3 rounded-lg border border-[var(--border)]">
          <div className="text-xs text-[var(--text-dim)] font-mono">ID: {node.id}</div>
          <div className="text-xs text-[var(--text-dim)] uppercase font-semibold">Type: {node.type}</div>
        </div>

        {/* Node Label */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--text-primary)]">Node Label</label>
          <input 
            type="text" 
            name="label" 
            value={node.data?.label as string || ''} 
            onChange={handleChange}
            className="w-full bg-[var(--surface-3)] border border-[var(--border)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
          />
        </div>

        {/* Hybrid Input Fields - из NODE_DEFINITIONS */}
        {nodeDef && nodeDef.inputs.length > 0 && (
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Input Ports
            </h4>
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
          </div>
        )}

        {/* Settings - из NODE_DEFINITIONS */}
        {nodeDef && nodeDef.settings.length > 0 && (
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Settings
            </h4>
            {nodeDef.settings.map(setting => (
              <div key={setting.id} className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between">
                  <span>{setting.label}</span>
                  {setting.type === 'number' && (
                    <span className="text-[var(--text-dim)] font-mono text-[10px]">
                      {(node.data.settings as Record<string, any>)?.[setting.id] ?? 
                       (node.data as Record<string, any>)?.[setting.id] ?? 
                       setting.defaultValue}
                    </span>
                  )}
                </label>
                {renderSettingField(setting, node, handleSettingChange)}
                {setting.description && (
                  <p className="text-[10px] text-[var(--text-dim)] leading-relaxed">
                    {setting.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Legacy Support - для старых нод без NODE_DEFINITIONS */}
        {!nodeDef && renderLegacyFields(node, handleChange, allModels, activeModel, apiKeys)}
      </div>
    </div>
  );
};
