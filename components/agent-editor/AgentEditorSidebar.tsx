import React, { useState } from 'react';
import { 
  Cpu, Brain, Wrench, GitBranch, LogIn, LogOut,
  Shuffle, Merge as MergeIcon, Split, Repeat,
  MessageSquare, Database, Code, Bug, Globe, Search
} from 'lucide-react';
import { NODE_DEFINITIONS, getPortColor } from '@/lib/agent-engine/node-definitions';

const NODE_CATEGORIES = [
  {
    name: 'Core',
    nodes: [
      { type: 'agent_input', label: 'Input', icon: <LogIn size={16} />, description: 'Entry point for data' },
      { type: 'agent_output', label: 'Output', icon: <LogOut size={16} />, description: 'Final result' },
    ]
  },
  {
    name: 'AI Models',
    nodes: [
      { type: 'llm', label: 'LLM Node', icon: <Cpu size={16} />, description: 'Call language model' },
    ]
  },
  {
    name: 'Data',
    nodes: [
      { type: 'transform', label: 'Transform', icon: <Shuffle size={16} />, description: 'Transform data' },
      { type: 'merge', label: 'Merge', icon: <MergeIcon size={16} />, description: 'Combine multiple inputs' },
      { type: 'split', label: 'Split', icon: <Split size={16} />, description: 'Split data into parts' },
    ]
  },
  {
    name: 'Skills',
    nodes: [
      { type: 'skill', label: 'Skill Call', icon: <Wrench size={16} />, description: 'Execute a skill' },
    ]
  },
  {
    name: 'Memory',
    nodes: [
      { type: 'memory_read', label: 'Memory Read', icon: <Database size={16} />, description: 'Read from memory' },
      { type: 'memory_write', label: 'Memory Write', icon: <Database size={16} />, description: 'Write to memory' },
      { type: 'memory', label: 'Memory Ops', icon: <Brain size={16} />, description: 'Memory operations' },
    ]
  },
  {
    name: 'Logic',
    nodes: [
      { type: 'condition', label: 'Condition', icon: <GitBranch size={16} />, description: 'If/else branching' },
      { type: 'router', label: 'Router', icon: <GitBranch size={16} />, description: 'Multi-way routing' },
      { type: 'loop', label: 'Loop', icon: <Repeat size={16} />, description: 'Iterate over items' },
    ]
  },
  {
    name: 'Chat',
    nodes: [
      { type: 'chat_input', label: 'Chat Input', icon: <MessageSquare size={16} />, description: 'Get chat messages' },
      { type: 'chat_output', label: 'Chat Output', icon: <MessageSquare size={16} />, description: 'Send to chat' },
    ]
  },
  {
    name: 'Utilities',
    nodes: [
      { type: 'text', label: 'Text', icon: <MessageSquare size={16} />, description: 'Static text value' },
      { type: 'code', label: 'Code', icon: <Code size={16} />, description: 'Custom JavaScript' },
      { type: 'debug', label: 'Debug', icon: <Bug size={16} />, description: 'Debug point' },
      { type: 'http_request', label: 'HTTP Request', icon: <Globe size={16} />, description: 'Make HTTP calls' },
    ]
  },
];

export const AgentEditorSidebar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(NODE_CATEGORIES.map(c => c.name))
  );

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  };

  const filteredCategories = NODE_CATEGORIES.map(category => ({
    ...category,
    nodes: category.nodes.filter(node =>
      node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.nodes.length > 0);

  return (
    <div className="w-64 bg-[var(--surface-1)] border-r border-[var(--border)] flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Node Library</h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--surface-3)] border border-[var(--border)] rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredCategories.map((category) => (
          <div key={category.name} className="space-y-1">
            <button
              onClick={() => toggleCategory(category.name)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] uppercase tracking-wider transition-colors"
            >
              <span>{category.name}</span>
              <span className="text-[10px]">{expandedCategories.has(category.name) ? '▼' : '▶'}</span>
            </button>
            
            {expandedCategories.has(category.name) && (
              <div className="space-y-1.5 pl-1">
                {category.nodes.map((node) => {
                  const nodeDef = NODE_DEFINITIONS[node.type];
                  
                  return (
                    <div
                      key={node.type}
                      className="group flex flex-col gap-2 p-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] hover:border-indigo-500/30 cursor-grab active:cursor-grabbing transition-all"
                      onDragStart={(e) => onDragStart(e, node.type, node.label)}
                      draggable
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-[var(--accent)] mt-0.5 group-hover:text-indigo-400 transition-colors">{node.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[var(--text-primary)] truncate">{node.label}</div>
                          <div className="text-[10px] text-[var(--text-dim)] line-clamp-2 mt-0.5">{node.description}</div>
                        </div>
                      </div>
                      
                      {/* Port Preview */}
                      {nodeDef && (nodeDef.inputs.length > 0 || nodeDef.outputs.length > 0) && (
                        <div className="flex items-center justify-between text-[9px] text-[var(--text-dim)] pt-2 border-t border-[var(--border)]">
                          {/* Inputs */}
                          <div className="flex items-center gap-1">
                            {nodeDef.inputs.slice(0, 3).map(port => (
                              <div 
                                key={port.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: getPortColor(port.type) }}
                                title={`${port.label} (${port.type})`}
                              />
                            ))}
                            {nodeDef.inputs.length > 3 && (
                              <span className="text-[8px]">+{nodeDef.inputs.length - 3}</span>
                            )}
                          </div>
                          
                          {/* Arrow */}
                          <div className="text-[8px] text-slate-600">→</div>
                          
                          {/* Outputs */}
                          <div className="flex items-center gap-1">
                            {nodeDef.outputs.slice(0, 3).map(port => (
                              <div 
                                key={port.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: getPortColor(port.type) }}
                                title={`${port.label} (${port.type})`}
                              />
                            ))}
                            {nodeDef.outputs.length > 3 && (
                              <span className="text-[8px]">+{nodeDef.outputs.length - 3}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
