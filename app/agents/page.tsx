'use client';

import React, { useState, useEffect } from 'react';
import { AgentsList } from '@/components/agent-editor/AgentsList';
import { AgentEditor } from '@/components/agent-editor/AgentEditor';
import { AgentsHistory } from '@/components/agent-editor/AgentsHistory';
import { AgentGraph } from '@/lib/agent-engine/types';
import { getGraphById, createEmptyGraph, saveGraph } from '@/lib/agent-engine/graph-storage';
import { Zap, History, ArrowLeft, Pencil, Check } from 'lucide-react';
import { loadApiKeys } from '@/lib/apiKeyManager';

type View = 'list' | 'editor' | 'history';

// Inline Editor Component for Graph Name
const AgentTitleEditor = ({ 
  graph, 
  onSave 
}: { 
  graph: AgentGraph; 
  onSave: (newName: string) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(graph.name);

  useEffect(() => {
    setName(graph.name);
  }, [graph.name]);

  const handleSave = () => {
    if (name.trim() && name !== graph.name) {
      onSave(name.trim());
    } else {
      setName(graph.name); // Reset if empty
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setName(graph.name);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="bg-[var(--surface-3)] px-2 py-0.5 rounded text-sm text-[var(--text-primary)] font-medium outline-none border border-indigo-500/50"
        />
        <button onMouseDown={(e) => { e.preventDefault(); handleSave(); }} className="text-emerald-400 hover:text-emerald-300">
          <Check size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
      <span className="text-[var(--text-primary)] font-medium">{graph.name}</span>
      <button className="text-[var(--text-dim)] group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all">
        <Pencil size={12} />
      </button>
    </div>
  );
};

export default function AgentsPage() {
  const [view, setView] = useState<View>('list');
  const [currentGraph, setCurrentGraph] = useState<AgentGraph | null>(null);
  const [allModels, setAllModels] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, any[]>>({});

  // Load models and API keys
  useEffect(() => {
    const keys = loadApiKeys('google');
    if (keys.length > 0 && allModels.length === 0) {
       loadModels(keys[0].key);
    }
  }, [apiKeys]); 

  // We should also load keys initially
  useEffect(() => {
    refreshApiKeys();
  }, []);

  const refreshApiKeys = () => {
    try {
      const googleKeys = loadApiKeys('google');
      if (googleKeys.length > 0) {
        setApiKeys({ google: googleKeys });
        // After loading keys, trigger model loading
        loadModels(googleKeys[0].key);
        return;
      }

      // Legacy fallbacks if needed
      const settings = localStorage.getItem('gemini_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.apiKeys && parsed.apiKeys.length > 0) {
          const formattedKeys = { google: parsed.apiKeys.map((key: string) => ({ key })) };
          setApiKeys(formattedKeys);
          loadModels(parsed.apiKeys[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load API keys:', e);
    }
  };

  const loadModels = async (apiKey?: string) => {
    if (!apiKey) return;
    try {
      const res = await fetch(`/api/models?apiKey=${encodeURIComponent(apiKey)}`);
      if (res.ok) {
        const data = await res.json();
        setAllModels(data.models || []);
      } else {
        console.warn('[AgentsPage] Failed to load models API:', res.status);
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  };

  const handleOpenGraph = (graph: AgentGraph) => {
    setCurrentGraph(graph);
    setView('editor');
  };

  const handleCreateNew = () => {
    const newGraph = createEmptyGraph('New Agent');
    setCurrentGraph(newGraph);
    setView('editor');
  };

  const handleBackToList = () => {
    setView('list');
    setCurrentGraph(null);
  };

  const handleGraphChange = (graph: AgentGraph) => {
    setCurrentGraph(graph);
  };

  return (
    <div className="w-full h-screen bg-[var(--surface-0)] flex flex-col">
      {/* Top Navigation */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-1)]">
        {view !== 'list' && (
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-md transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
        
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'list'
              ? 'bg-indigo-600 text-white'
              : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
          }`}
        >
          <Zap size={16} />
          Agents
        </button>

        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            view === 'history'
              ? 'bg-indigo-600 text-white'
              : 'text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]'
          }`}
        >
          <History size={16} />
          History
        </button>

        {view === 'editor' && currentGraph && (
          <div className="ml-auto text-sm text-[var(--text-dim)] flex items-center gap-2">
            Editing: 
            <AgentTitleEditor 
              graph={currentGraph} 
              onSave={(newName) => {
                const updatedGraph = { ...currentGraph, name: newName, updatedAt: Date.now() };
                setCurrentGraph(updatedGraph);
                saveGraph(updatedGraph);
              }} 
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'list' && (
          <AgentsList
            onOpenGraph={handleOpenGraph}
            onCreateNew={handleCreateNew}
          />
        )}

        {view === 'editor' && currentGraph && (
          <AgentEditor
            graph={currentGraph}
            onGraphChange={handleGraphChange}
            allModels={allModels}
            apiKeys={apiKeys}
          />
        )}

        {view === 'history' && <AgentsHistory />}
      </div>
    </div>
  );
}
