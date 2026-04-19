import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Play, Copy, Download, Archive, Trash2, 
  MoreVertical, Calendar, Zap, AlertCircle, CheckCircle2,
  Filter, SortAsc
} from 'lucide-react';
import { AgentGraph } from '@/lib/agent-engine/types';
import { 
  getGraphs, 
  createEmptyGraph, 
  duplicateGraph, 
  deleteGraph, 
  exportGraph,
  GRAPHS_UPDATED_EVENT 
} from '@/lib/agent-engine/graph-storage';

interface AgentsListProps {
  onOpenGraph: (graph: AgentGraph) => void;
  onCreateNew: () => void;
}

export const AgentsList: React.FC<AgentsListProps> = ({ onOpenGraph, onCreateNew }) => {
  const [graphs, setGraphs] = useState<AgentGraph[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'runs'>('date');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    loadGraphs();
    
    const handleUpdate = () => loadGraphs();
    window.addEventListener(GRAPHS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(GRAPHS_UPDATED_EVENT, handleUpdate);
  }, []);

  const loadGraphs = () => {
    setGraphs(getGraphs());
  };

  const handleCreateNew = () => {
    const newGraph = createEmptyGraph('New Agent');
    onOpenGraph(newGraph);
  };

  const handleDuplicate = (graph: AgentGraph) => {
    const duplicate = duplicateGraph(graph.id);
    if (duplicate) {
      onOpenGraph(duplicate);
    }
    setMenuOpen(null);
  };

  const handleExport = (graph: AgentGraph) => {
    const json = exportGraph(graph);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.name.replace(/\s+/g, '_')}.agent.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(null);
  };

  const handleDelete = (graph: AgentGraph) => {
    if (confirm(`Delete agent "${graph.name}"? This cannot be undone.`)) {
      deleteGraph(graph.id);
      setMenuOpen(null);
    }
  };

  const filteredAndSortedGraphs = graphs
    .filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           g.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return g.metadata.runCount > 0;
      if (filterStatus === 'draft') return g.metadata.runCount === 0;
      
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') return b.updatedAt - a.updatedAt;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'runs') return b.metadata.runCount - a.metadata.runCount;
      return 0;
    });

  const getStatusBadge = (graph: AgentGraph) => {
    if (graph.metadata.runCount === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-slate-500/10 text-slate-400 rounded-full border border-slate-500/20">
          <AlertCircle size={10} />
          Draft
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
        <CheckCircle2 size={10} />
        Active
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-1)] px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Agents</h1>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              Create and manage your AI agent workflows
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus size={18} />
            New Agent
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-[var(--surface-3)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="runs">Sort by Runs</option>
          </select>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredAndSortedGraphs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center mb-4">
              <Zap size={32} className="text-[var(--text-dim)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {searchQuery ? 'No agents found' : 'No agents yet'}
            </h3>
            <p className="text-sm text-[var(--text-dim)] mb-6 max-w-md">
              {searchQuery 
                ? 'Try adjusting your search or filters'
                : 'Create your first agent to start building AI workflows'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus size={18} />
                Create First Agent
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAndSortedGraphs.map((graph) => (
              <div
                key={graph.id}
                className="group relative bg-[var(--surface-1)] border border-[var(--border)] rounded-xl p-5 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all cursor-pointer"
                onClick={() => onOpenGraph(graph)}
              >
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  {getStatusBadge(graph)}
                </div>

                {/* Content */}
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 pr-16">
                    {graph.name}
                  </h3>
                  <p className="text-sm text-[var(--text-dim)] line-clamp-2 min-h-[2.5rem]">
                    {graph.description || 'No description'}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] mb-4">
                  <div className="flex items-center gap-1">
                    <Zap size={12} />
                    <span>{graph.nodes.length} nodes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Play size={12} />
                    <span>{graph.metadata.runCount} runs</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center gap-1 text-xs text-[var(--text-dim)]">
                    <Calendar size={12} />
                    <span>{new Date(graph.updatedAt).toLocaleDateString()}</span>
                  </div>

                  {/* Actions Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === graph.id ? null : graph.id);
                      }}
                      className="p-1.5 rounded-md hover:bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {menuOpen === graph.id && (
                      <div className="absolute right-0 bottom-full mb-2 w-48 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg shadow-xl z-50 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(graph);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
                        >
                          <Copy size={14} />
                          Duplicate
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExport(graph);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)] transition-colors"
                        >
                          <Download size={14} />
                          Export
                        </button>
                        <div className="my-1 border-t border-[var(--border)]" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(graph);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
