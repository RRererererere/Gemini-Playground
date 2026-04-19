import React from 'react';
import { NodeProps } from '@xyflow/react';
import { 
  Cpu, Brain, Wrench, GitBranch, LogIn, LogOut, 
  Shuffle, Merge as MergeIcon, Split, Repeat, 
  Zap, MessageSquare, Database, Code, Bug, Globe
} from 'lucide-react';
import { BaseNode } from './BaseNode';
import { NODE_DEFINITIONS } from '@/lib/agent-engine/node-definitions';

export const AgentInputNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['input'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<LogIn size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      error={data.error as string}
      description={nodeDef.description}
    >
      <div className="text-center text-[var(--text-dim)] text-[10px] font-medium opacity-70">
        Entry point
      </div>
    </BaseNode>
  );
};

export const LLMNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['llm'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Cpu size={14} />} 
      colorKey="indigo" 
      selected={selected}
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      error={data.error as string}
      description={nodeDef.description}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Model: {(data.settings as any)?.model || data.model as string || 'Default'}</div>
        <div className="h-16 bg-[var(--surface-3)] rounded border border-[var(--border)] overflow-hidden p-1">
          <span className="text-[10px] text-[var(--text-dim)] whitespace-pre-wrap">{(data.prompt as string) || 'Prompt goes here...'}</span>
        </div>
      </div>
    </BaseNode>
  );
};

export const SkillNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['skill'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Wrench size={14} />} 
      colorKey="amber" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Tool: {data.skillId as string || 'Select a skill'}</div>
      </div>
    </BaseNode>
  );
};

export const MemoryNode = ({ data, selected }: NodeProps) => {
  // Legacy node - может быть read или write
  const nodeDef = NODE_DEFINITIONS['memory_read'];
  
  return (
    <BaseNode 
      title={data.label as string || "Memory Ops"} 
      icon={<Brain size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Op: {data.operation as string || 'Save / Retrieve'}</div>
      </div>
    </BaseNode>
  );
};

export const ConditionNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['condition'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<GitBranch size={14} />} 
      colorKey="rose" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate font-mono">{(data.conditionCode as string)?.substring(0, 30) || 'if (context...) then'}...</div>
      </div>
    </BaseNode>
  );
};

export const TransformNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['transform'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Shuffle size={14} />} 
      colorKey="blue" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Type: {data.transformType as string || 'js_expression'}</div>
      </div>
    </BaseNode>
  );
};

export const MergeNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['merge'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<MergeIcon size={14} />} 
      colorKey="blue" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Mode: {data.mergeMode as string || 'concat_text'}</div>
      </div>
    </BaseNode>
  );
};

export const SplitNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['split'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Split size={14} />} 
      colorKey="blue" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Mode: {data.splitMode as string || 'by_newline'}</div>
      </div>
    </BaseNode>
  );
};

export const RouterNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['router'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<GitBranch size={14} />} 
      colorKey="rose" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Mode: {data.routerMode as string || 'if_else'}</div>
      </div>
    </BaseNode>
  );
};

export const LoopNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['loop'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Repeat size={14} />} 
      colorKey="rose" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Max: {data.maxIterations as string || '100'} iterations</div>
      </div>
    </BaseNode>
  );
};

export const ChatInputNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['chat_input'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<MessageSquare size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Source: {data.source as string || 'active_chat'}</div>
      </div>
    </BaseNode>
  );
};

export const ChatOutputNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['chat_output'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<MessageSquare size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Target: {data.target as string || 'active_chat'}</div>
      </div>
    </BaseNode>
  );
};

export const ChatHistoryNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['chat_history'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<MessageSquare size={14} />} 
      colorKey="indigo" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
      description={nodeDef.description}
    >
      <div className="flex flex-col gap-1">
        <div className="text-xs text-[var(--text-dim)] truncate">Store: {settings.storeId || 'main'}</div>
        <div className="text-xs text-[var(--text-dim)] truncate">Op: {settings.operation || 'read'}</div>
      </div>
    </BaseNode>
  );
};

export const MemoryReadNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['memory_read'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Database size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Mode: {data.readMode as string || 'semantic_search'}</div>
      </div>
    </BaseNode>
  );
};

export const MemoryWriteNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['memory_write'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Database size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Mode: {data.writeMode as string || 'direct_save'}</div>
      </div>
    </BaseNode>
  );
};

export const CodeNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['code'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Code size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate font-mono">Custom JS execution</div>
      </div>
    </BaseNode>
  );
};

export const DebugNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['debug'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Bug size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Label: {data.debugLabel as string || 'Debug point'}</div>
      </div>
    </BaseNode>
  );
};

export const HTTPRequestNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['http_request'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<Globe size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-[var(--text-dim)] truncate">Method: {data.method as string || 'GET'}</div>
      </div>
    </BaseNode>
  );
};

export const AgentOutputNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['output'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<LogOut size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any} 
      error={data.error as string}
      description={nodeDef.description}
    >
      <div className="text-center text-[var(--text-dim)] text-[10px] font-medium opacity-70">
        Exit point
      </div>
    </BaseNode>
  );
};

export const TextNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['text'];
  
  return (
    <BaseNode 
      title={data.label as string || nodeDef.label} 
      icon={<MessageSquare size={14} />} 
      colorKey="blue" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      error={data.error as string}
    >
      <div className="h-20 bg-[var(--surface-3)] rounded border border-[var(--border)] overflow-hidden p-2">
        <span className="text-[10px] text-[var(--text-dim)] whitespace-pre-wrap line-clamp-4">
          {(data.content as string) || 'Enter text in properties...'}
        </span>
      </div>
    </BaseNode>
  );
};
