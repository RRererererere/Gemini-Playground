'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Trash2, X } from 'lucide-react';
import type { Memory, MemoryCategory } from '@/lib/memory-store';

interface MemoryGraphProps {
  memories: Memory[];
  onSelectMemory: (id: string) => void;
  onDeleteMemory: (id: string) => void;
}

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  identity: '#a855f7',
  tech: '#3b82f6',
  style: '#f59e0b',
  project: '#10b981',
  preference: '#ec4899',
  belief: '#8b5cf6',
  episode: '#6366f1',
};

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  memory: Memory;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export default function MemoryGraph({
  memories,
  onSelectMemory,
  onDeleteMemory,
}: MemoryGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Memory | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | null>(null);

  useEffect(() => {
    if (!svgRef.current || memories.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Фильтр по категории
    const filteredMemories = categoryFilter
      ? memories.filter(m => m.category === categoryFilter)
      : memories;

    // Построить граф
    const nodes: GraphNode[] = filteredMemories.map(m => ({
      id: m.id,
      memory: m,
    }));

    const links: GraphLink[] = [];
    filteredMemories.forEach(m => {
      m.related_to.forEach(relatedId => {
        if (filteredMemories.find(fm => fm.id === relatedId)) {
          links.push({
            source: m.id,
            target: relatedId,
          });
        }
      });
    });

    // Simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id(d => d.id)
          .distance(80)
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    const g = svg.append('g');

    // Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', event => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Links
    const link = g
      .append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 1.5)
      .style('display', showLinks ? 'block' : 'none');

    // Nodes
    const node = g
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => {
        const size = d.memory.confidence * d.memory.mentions;
        return Math.max(8, Math.min(24, 8 + size * 2));
      })
      .attr('fill', d => CATEGORY_COLORS[d.memory.category])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.memory);
      })
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    // Labels
    const label = g
      .append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.memory.fact.slice(0, 20) + (d.memory.fact.length > 20 ? '…' : ''))
      .attr('font-size', 10)
      .attr('fill', 'rgba(255,255,255,0.7)')
      .attr('text-anchor', 'middle')
      .attr('dy', 30)
      .style('pointer-events', 'none')
      .style('display', showLabels ? 'block' : 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node.attr('cx', d => d.x!).attr('cy', d => d.y!);

      label.attr('x', d => d.x!).attr('y', d => d.y!);
    });

    return () => {
      simulation.stop();
    };
  }, [memories, showLabels, showLinks, categoryFilter]);

  return (
    <div className="relative w-full h-full">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="flex gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-2">
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showLinks}
              onChange={e => setShowLinks(e.target.checked)}
              className="rounded"
            />
            Связи
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={e => setShowLabels(e.target.checked)}
              className="rounded"
            />
            Метки
          </label>
        </div>

        <div className="flex flex-wrap gap-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-2 max-w-xs">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-2 py-1 rounded text-[10px] transition-all ${
              categoryFilter === null
                ? 'bg-white text-black'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Все
          </button>
          {(Object.keys(CATEGORY_COLORS) as MemoryCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2 py-1 rounded text-[10px] transition-all ${
                categoryFilter === cat ? 'text-white' : 'text-[var(--text-muted)]'
              }`}
              style={
                categoryFilter === cat
                  ? { backgroundColor: CATEGORY_COLORS[cat] }
                  : undefined
              }
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* SVG */}
      <svg ref={svgRef} className="w-full h-full" />

      {/* Selected Node Panel */}
      {selectedNode && (
        <div className="absolute top-4 right-4 w-80 bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl p-4 shadow-2xl z-10 animate-fade-in">
          <div className="flex items-start justify-between mb-3">
            <span
              className="px-2 py-1 rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: CATEGORY_COLORS[selectedNode.category] }}
            >
              {selectedNode.category}
            </span>
            <button
              onClick={() => setSelectedNode(null)}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-3">
            {selectedNode.fact}
          </p>

          <div className="space-y-2 text-xs text-[var(--text-muted)]">
            <div className="flex items-center justify-between">
              <span>Уверенность:</span>
              <span className="font-mono text-[var(--text-primary)]">
                {Math.round(selectedNode.confidence * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Упоминаний:</span>
              <span className="font-mono text-[var(--text-primary)]">
                {selectedNode.mentions}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Обновлено:</span>
              <span className="text-[var(--text-primary)]">
                {new Date(selectedNode.updated_at).toLocaleDateString('ru-RU')}
              </span>
            </div>
            {selectedNode.keywords.length > 0 && (
              <div>
                <span className="block mb-1">Ключевые слова:</span>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.keywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-[var(--surface-3)] text-[10px]"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => onSelectMemory(selectedNode.id)}
              className="flex-1 px-3 py-2 rounded-lg bg-white text-black text-xs font-medium hover:opacity-80 transition-opacity"
            >
              Редактировать
            </button>
            <button
              onClick={() => {
                onDeleteMemory(selectedNode.id);
                setSelectedNode(null);
              }}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-red-500/30 text-[var(--gem-red)] hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}

      {memories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-[var(--text-muted)]">Нет воспоминаний для отображения</p>
        </div>
      )}
    </div>
  );
}
