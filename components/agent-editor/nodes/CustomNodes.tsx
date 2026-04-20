import React from 'react';
import { NodeProps } from '@xyflow/react';
import { 
  Cpu, Brain, Wrench, GitBranch, LogIn, LogOut, 
  Shuffle, Merge as MergeIcon, Split, Repeat, 
  Zap, MessageSquare, Database, Code, Bug, Globe, Search,
  Clock, FileText, Braces, Timer, HardDrive, ThumbsUp
} from 'lucide-react';
import { BaseNode } from './BaseNode';
import { NODE_DEFINITIONS } from '@/lib/agent-engine/node-definitions';

// ─── I/O Nodes ───────────────────────────────────────────────

export const AgentInputNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['agent_input'];
  
  return (
    <BaseNode 
      title={data.label as string || 'Input'} 
      icon={<LogIn size={14} />} 
      colorKey="blue" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
      description={nodeDef.description}
    >
      <div style={{ textAlign: 'center', color: '#64748b', fontSize: 10, fontWeight: 500 }}>
        Entry point
      </div>
    </BaseNode>
  );
};

export const AgentOutputNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['agent_output'];
  
  return (
    <BaseNode 
      title={data.label as string || 'Output'} 
      icon={<LogOut size={14} />} 
      colorKey="blue" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
      description={nodeDef.description}
    >
      <div style={{ textAlign: 'center', color: '#64748b', fontSize: 10, fontWeight: 500 }}>
        Exit point
      </div>
    </BaseNode>
  );
};

// ─── AI Nodes ────────────────────────────────────────────────

export const LLMNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['llm'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'LLM'} 
      icon={<Cpu size={14} />} 
      colorKey="indigo" 
      selected={selected}
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
      description={nodeDef.description}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {settings.model || data.model as string || 'gemini-2.0-flash'}
        </div>
        {(settings.systemPrompt || data.prompt) && (
          <div style={{
            height: 32,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.04)',
            overflow: 'hidden',
            padding: '3px 6px',
          }}>
            <span style={{ fontSize: 9, color: '#64748b', whiteSpace: 'pre-wrap' }}>
              {(settings.systemPrompt || data.prompt as string || '').substring(0, 60)}
            </span>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export const PlannerNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['planner'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Planner'} 
      icon={<GitBranch size={14} />} 
      colorKey="indigo"
      selected={selected}
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
      description={nodeDef.description}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
        Decomposing task...
      </div>
    </BaseNode>
  );
};

export const SubAgentNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['subagent'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Sub-Agent'} 
      icon={<Cpu size={14} />} 
      colorKey="indigo"
      selected={selected}
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
      description={nodeDef.description}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {settings.agentId ? `ID: ${settings.agentId.substring(0, 20)}…` : 'Select an agent'}
      </div>
    </BaseNode>
  );
};

export const SkillNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['skill'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Skill'} 
      icon={<Wrench size={14} />} 
      colorKey="amber" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {settings.skillId || data.skillId as string || 'Select a skill'}
      </div>
    </BaseNode>
  );
};

// ─── Logic Nodes ─────────────────────────────────────────────

export const ConditionNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['condition'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Condition'} 
      icon={<GitBranch size={14} />} 
      colorKey="amber" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {(settings.conditionCode as string)?.substring(0, 30) || 'true'}
      </div>
    </BaseNode>
  );
};

export const RouterNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['router'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Router'} 
      icon={<GitBranch size={14} />} 
      colorKey="amber" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        Mode: {settings.routerMode || 'if_else'}
      </div>
    </BaseNode>
  );
};

export const LoopNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['loop'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Loop'} 
      icon={<Repeat size={14} />} 
      colorKey="amber" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        Max: {settings.maxIterations || '100'}
      </div>
    </BaseNode>
  );
};

// ─── Memory Nodes ────────────────────────────────────────────

export const MemoryNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['memory_read'];
  
  return (
    <BaseNode 
      title={data.label as string || 'Memory Ops'} 
      icon={<Brain size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {data.operation as string || 'Read / Write'}
      </div>
    </BaseNode>
  );
};

export const MemoryReadNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['memory_read'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Memory Read'} 
      icon={<Database size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {settings.readMode || 'semantic_search'}
      </div>
    </BaseNode>
  );
};

export const MemoryWriteNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['memory_write'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Memory Write'} 
      icon={<Database size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {settings.writeMode || 'direct_save'}
      </div>
    </BaseNode>
  );
};

// ─── Chat Nodes ──────────────────────────────────────────────

export const ChatInputNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['chat_input'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Chat Input'} 
      icon={<MessageSquare size={14} />} 
      colorKey="violet" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {settings.source || 'active_chat'}
      </div>
    </BaseNode>
  );
};

export const ChatOutputNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['chat_output'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Chat Output'} 
      icon={<MessageSquare size={14} />} 
      colorKey="violet" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {settings.target || 'active_chat'}
      </div>
    </BaseNode>
  );
};

export { DatabaseHubNode } from './DatabaseHubNode';

// ─── Data Nodes ──────────────────────────────────────────────

export const TransformNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['transform'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Transform'} 
      icon={<Shuffle size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {settings.transformType || 'js_expression'}
      </div>
    </BaseNode>
  );
};

export const MergeNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['merge'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Merge'} 
      icon={<MergeIcon size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {settings.mergeMode || 'concat_text'}
      </div>
    </BaseNode>
  );
};

export const SplitNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['split'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Split'} 
      icon={<Split size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {settings.splitMode || data.splitMode as string || 'by_newline'}
      </div>
    </BaseNode>
  );
};

// ─── Utility Nodes ───────────────────────────────────────────

export const TextNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['text'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Text'} 
      icon={<FileText size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
    >
      <div style={{
        height: 36,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
        padding: '4px 6px',
      }}>
        <span style={{ fontSize: 9, color: '#64748b', whiteSpace: 'pre-wrap' }}>
          {(settings.content as string)?.substring(0, 80) || 'Enter text…'}
        </span>
      </div>
    </BaseNode>
  );
};

export const TemplateNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['template'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Template'} 
      icon={<FileText size={14} />} 
      colorKey="slate"
      selected={selected}
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
      description={nodeDef.description}
    >
      <div style={{
        height: 28,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
        padding: '3px 6px',
      }}>
        <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
          {(settings.template as string)?.substring(0, 50) || '{{var1}} + {{var2}}'}
        </span>
      </div>
    </BaseNode>
  );
};

export const VariableNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['variable'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Variable'} 
      icon={<Braces size={14} />} 
      colorKey="slate"
      selected={selected}
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
        ${settings.varName || 'myVar'}
      </div>
    </BaseNode>
  );
};

export const JsonExtractNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['json_extract'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'JSON Extract'} 
      icon={<Search size={14} />} 
      colorKey="slate"
      selected={selected}
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
        .{settings.path || 'data.result'}
      </div>
    </BaseNode>
  );
};

export const CodeNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['code'];
  
  return (
    <BaseNode 
      title={data.label as string || 'Code'} 
      icon={<Code size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
        JavaScript
      </div>
    </BaseNode>
  );
};

export const DebugNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['debug'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Debug'} 
      icon={<Bug size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8' }}>
        {settings.debugLabel || 'Debug'}
      </div>
    </BaseNode>
  );
};

export const HTTPRequestNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['http_request'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'HTTP Request'} 
      icon={<Globe size={14} />} 
      colorKey="slate" 
      selected={selected} 
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
        {settings.method || 'GET'}
      </div>
    </BaseNode>
  );
};

export const DelayNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['delay'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Delay'} 
      icon={<Timer size={14} />} 
      colorKey="slate"
      selected={selected}
      inputs={nodeDef.inputs}
      outputs={nodeDef.outputs}
      status={data.status as any}
      nodeData={data}
      error={data.error as string}
    >
      <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center' }}>
        {settings.milliseconds || 1000}ms
      </div>
    </BaseNode>
  );
};

// ─── Global DB Node ──────────────────────────────────────────

export const GlobalDbNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['global_db'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Глобальная БД'} 
      icon={<HardDrive size={14} />} 
      colorKey="emerald" 
      selected={selected} 
      inputs={nodeDef?.inputs || []}
      outputs={nodeDef?.outputs || []}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
      description={nodeDef?.description}
    >
      <div style={{ fontSize: 10, color: '#5eead4', textAlign: 'center', fontWeight: 600 }}>
        🗄️ {settings.storeId || 'my_db'}
      </div>
    </BaseNode>
  );
};

// ─── Feedback Node ───────────────────────────────────────────

export const FeedbackNode = ({ data, selected }: NodeProps) => {
  const nodeDef = NODE_DEFINITIONS['feedback'];
  const settings = (data.settings as any) || {};
  
  return (
    <BaseNode 
      title={data.label as string || 'Обратная связь'} 
      icon={<ThumbsUp size={14} />} 
      colorKey="amber" 
      selected={selected} 
      inputs={nodeDef?.inputs || []}
      outputs={nodeDef?.outputs || []}
      status={data.status as any}
      nodeData={data} 
      error={data.error as string}
      description={nodeDef?.description}
    >
      <div style={{ fontSize: 10, color: '#fbbf24', textAlign: 'center' }}>
        {settings.promptText || 'Оцените ответ ИИ'}
      </div>
    </BaseNode>
  );
};
