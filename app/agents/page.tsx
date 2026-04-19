'use client';

import React, { useState, useEffect } from 'react';
import { AgentsList } from '@/components/agent-editor/AgentsList';
import { AgentEditor } from '@/components/agent-editor/AgentEditor';
import { AgentsHistory } from '@/components/agent-editor/AgentsHistory';
import { AgentGraph } from '@/lib/agent-engine/types';
import { getGraphById, createEmptyGraph } from '@/lib/agent-engine/graph-storage';
import { Zap, History, ArrowLeft } from 'lucide-react';

type View = 'list' | 'editor' | 'history';

export default function AgentsPage() {
  const [view, setView] = useState<View>('list');
  const [currentGraph, setCurrentGraph] = useState<AgentGraph | null>(null);
  const [allModels, setAllModels] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, any[]>>({});

  // Load models and API keys
  useEffect(() => {
    loadModels();
    loadApiKeys();
  }, []);

  const loadModels = async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        setAllModels(data.models || []);
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  };

  const loadApiKeys = () => {
    try {
      // Попробовать загрузить из нового формата (multi-provider)
      const providersData = localStorage.getItem('api_providers');
      if (providersData) {
        const providers = JSON.parse(providersData);
        console.log('[AgentsPage] providers from localStorage:', providers);
        
        // Собрать все ключи по провайдерам
        const keysByProvider: Record<string, any[]> = {};
        
        for (const [providerId, providerKeys] of Object.entries(providers)) {
          if (Array.isArray(providerKeys) && providerKeys.length > 0) {
            keysByProvider[providerId] = providerKeys;
          }
        }
        
        console.log('[AgentsPage] formatted apiKeys:', keysByProvider);
        setApiKeys(keysByProvider);
        return;
      }
      
      // Fallback на старый формат
      const settings = localStorage.getItem('gemini_settings');
      console.log('[AgentsPage] gemini_settings from localStorage:', settings);
      
      if (settings) {
        const parsed = JSON.parse(settings);
        console.log('[AgentsPage] parsed settings:', parsed);
        
        if (parsed.apiKeys) {
          const formattedKeys = { gemini: parsed.apiKeys.map((key: string) => ({ key })) };
          console.log('[AgentsPage] formatted apiKeys (legacy):', formattedKeys);
          setApiKeys(formattedKeys);
        }
      }
    } catch (e) {
      console.error('Failed to load API keys:', e);
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
          <div className="ml-auto text-sm text-[var(--text-dim)]">
            Editing: <span className="text-[var(--text-primary)] font-medium">{currentGraph.name}</span>
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
