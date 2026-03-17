'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Plus, Save, Trash2, Wrench, X } from 'lucide-react';
import type { ChatTool, ToolSchemaField, ToolSchemaType } from '@/types';
import { createChatTool, createToolSchemaField, sanitizeToolFieldName, sanitizeToolName } from '@/lib/gemini';

const FIELD_TYPES: ToolSchemaType[] = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

function cloneField(field: ToolSchemaField): ToolSchemaField {
  return {
    ...field,
    enumValues: field.enumValues ? [...field.enumValues] : [],
    properties: field.properties ? field.properties.map(cloneField) : undefined,
    items: field.items ? cloneField(field.items) : field.items,
  };
}

function cloneTool(tool: ChatTool): ChatTool {
  return {
    ...tool,
    parameters: tool.parameters.map(cloneField),
  };
}

function updateTree(fields: ToolSchemaField[], targetId: string, updater: (field: ToolSchemaField) => ToolSchemaField): ToolSchemaField[] {
  return fields.map(field => {
    if (field.id === targetId) return updater(field);
    if (field.properties?.length) {
      return { ...field, properties: updateTree(field.properties, targetId, updater) };
    }
    if (field.items) {
      if (field.items.id === targetId) return { ...field, items: updater(field.items) };
      if (field.items.properties?.length) {
        return {
          ...field,
          items: {
            ...field.items,
            properties: updateTree(field.items.properties, targetId, updater),
          },
        };
      }
    }
    return field;
  });
}

function removeTree(fields: ToolSchemaField[], targetId: string): ToolSchemaField[] {
  return fields
    .filter(field => field.id !== targetId)
    .map(field => ({
      ...field,
      properties: field.properties ? removeTree(field.properties, targetId) : field.properties,
      items:
        field.items?.id === targetId
          ? null
          : field.items && field.items.properties
            ? { ...field.items, properties: removeTree(field.items.properties, targetId) }
            : field.items,
    }));
}

function FieldEditor({
  field,
  depth,
  onChange,
  onRemove,
  onAddChild,
  isItemSchema = false,
}: {
  field: ToolSchemaField;
  depth: number;
  onChange: (field: ToolSchemaField) => void;
  onRemove?: () => void;
  onAddChild: (fieldId: string) => void;
  isItemSchema?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const enumValue = useMemo(() => (field.enumValues || []).join(', '), [field.enumValues]);

  const updateType = (nextType: ToolSchemaType) => {
    onChange({
      ...field,
      type: nextType,
      properties: nextType === 'object' ? field.properties || [] : undefined,
      items: nextType === 'array' ? field.items || createToolSchemaField() : null,
      enumValues: nextType === 'string' ? field.enumValues || [] : [],
    });
  };

  return (
    <div
      className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
      style={{ marginLeft: depth > 0 ? `${Math.min(depth * 14, 42)}px` : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-2 text-left"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]">
            <ChevronDown size={12} className={`transition-transform ${expanded ? '' : '-rotate-90'}`} />
          </span>
          <div>
            <p className="text-xs font-medium text-[var(--text-primary)]">{isItemSchema ? 'Array item' : field.name || 'New field'}</p>
            <p className="text-[10px] text-[var(--text-dim)]">{field.type}</p>
          </div>
        </button>

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-3">
          {!isItemSchema && (
            <div className="grid gap-3 md:grid-cols-[1.2fr,0.9fr]">
              <input
                type="text"
                value={field.name}
                onChange={event => onChange({ ...field, name: sanitizeToolFieldName(event.target.value) })}
                placeholder="field_name"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--text-primary)]"
              />

              <select
                value={field.type}
                onChange={event => updateType(event.target.value as ToolSchemaType)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--text-primary)]"
              >
                {FIELD_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          )}

          <textarea
            value={field.description || ''}
            onChange={event => onChange({ ...field, description: event.target.value })}
            placeholder="Description for model"
            rows={2}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--text-primary)]"
          />

          {!isItemSchema && (
            <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={Boolean(field.required)}
                onChange={event => onChange({ ...field, required: event.target.checked })}
              />
              Required
            </label>
          )}

          {field.type === 'string' && (
            <input
              type="text"
              value={enumValue}
              onChange={event => onChange({
                ...field,
                enumValues: event.target.value.split(',').map(item => item.trim()).filter(Boolean),
              })}
              placeholder="enum1, enum2"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-xs text-[var(--text-primary)]"
            />
          )}

          {field.type === 'object' && (
            <div className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-black/10 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Properties</span>
                <button
                  type="button"
                  onClick={() => onAddChild(field.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-3)] px-2.5 py-1.5 text-[11px] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <Plus size={11} />
                  Field
                </button>
              </div>

              {(field.properties || []).length > 0 ? (
                <div className="space-y-2">
                  {(field.properties || []).map(child => (
                    <FieldEditor
                      key={child.id}
                      field={child}
                      depth={depth + 1}
                      onChange={updated => onChange({
                        ...field,
                        properties: (field.properties || []).map(item => item.id === updated.id ? updated : item),
                      })}
                      onRemove={() => onChange({
                        ...field,
                        properties: (field.properties || []).filter(item => item.id !== child.id),
                      })}
                      onAddChild={onAddChild}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-3 text-[11px] text-[var(--text-dim)]">
                  No nested fields yet.
                </p>
              )}
            </div>
          )}

          {field.type === 'array' && field.items && (
            <div className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] bg-black/10 p-3">
              <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">Item schema</span>
              <FieldEditor
                field={field.items}
                depth={depth + 1}
                isItemSchema
                onChange={updated => onChange({ ...field, items: updated })}
                onAddChild={onAddChild}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolBuilderModal({
  open,
  initialTool,
  onClose,
  onSave,
}: {
  open: boolean;
  initialTool?: ChatTool | null;
  onClose: () => void;
  onSave: (tool: ChatTool) => void;
}) {
  const [tool, setTool] = useState<ChatTool>(createChatTool());

  useEffect(() => {
    if (!open) return;
    setTool(initialTool ? cloneTool(initialTool) : createChatTool());
  }, [initialTool, open]);

  if (!open) return null;

  const normalizedName = sanitizeToolName(tool.name);
  const canSave = Boolean(normalizedName) && Boolean(tool.description.trim());

  const updateField = (fieldId: string, updater: (field: ToolSchemaField) => ToolSchemaField) => {
    setTool(prev => ({ ...prev, parameters: updateTree(prev.parameters, fieldId, updater) }));
  };

  const addChildField = (fieldId: string) => {
    setTool(prev => ({
      ...prev,
      parameters: updateTree(prev.parameters, fieldId, field => ({
        ...field,
        properties: [...(field.properties || []), createToolSchemaField()],
      })),
    }));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(9,9,9,0.98))] shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-[var(--text-primary)]">
              <Wrench size={16} />
              <h3 className="text-base font-semibold tracking-tight">{initialTool ? 'Edit tool' : 'New tool'}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 md:grid-cols-[1.1fr,1fr]">
            <input
              type="text"
              value={tool.name}
              onChange={event => setTool(prev => ({ ...prev, name: event.target.value }))}
              placeholder="tool_name"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-primary)]"
            />

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs leading-relaxed text-[var(--text-dim)]">
              Final name: <span className="font-mono text-[var(--text-primary)]">{normalizedName || 'tool_name'}</span>
            </div>
          </div>

          <textarea
            value={tool.description}
            onChange={event => setTool(prev => ({ ...prev, description: event.target.value }))}
            placeholder="What this function does and when the model should call it"
            rows={3}
            className="mt-3 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-primary)]"
          />

          <div className="mt-5 rounded-[24px] border border-[var(--border)] bg-[var(--surface-1)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Parameters</p>
              </div>

              <button
                type="button"
                onClick={() => setTool(prev => ({ ...prev, parameters: [...prev.parameters, createToolSchemaField()] }))}
                className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
              >
                <Plus size={12} />
                Field
              </button>
            </div>

            {tool.parameters.length > 0 ? (
              <div className="space-y-3">
                {tool.parameters.map(field => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    depth={0}
                    onChange={updated => updateField(field.id, () => updated)}
                    onRemove={() => setTool(prev => ({ ...prev, parameters: removeTree(prev.parameters, field.id) }))}
                    onAddChild={addChildField}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-6 text-center text-sm text-[var(--text-dim)]">
                No parameters yet.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-xs text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...tool, name: normalizedName, description: tool.description.trim() })}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            <Save size={12} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
