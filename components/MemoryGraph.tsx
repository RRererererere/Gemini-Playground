'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Trash2, X, Edit2 } from 'lucide-react';
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
  const [selectedNodePosition, setSelectedNodePosition] = useState<{ x: number; y: number } | null>(null);
  const [showLinks, setShowLinks] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | null>(null);
  const [zoom, setZoom] = useState(1);

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

    // Defs для glow фильтров
    const defs = svg.append('defs');
    Object.entries(CATEGORY_COLORS).forEach(([category, color]) => {
      const filter = defs.append('filter')
        .attr('id', `glow-${category}`)
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');
      
      filter.append('feGaussianBlur')
        .attr('stdDeviation', '3')
        .attr('result', 'blur');
      
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'blur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    });

    // Zoom
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', event => {
        g.attr('transform', event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior as any);

    // Links - изогнутые рёбра
    const link = g
      .append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-width', 1)
      .attr('fill', 'none')
      .style('display', showLinks ? 'block' : 'none');

    // Nodes - двойные кольца
    const nodeGroup = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.memory);
        setSelectedNodePosition({ x: d.x || 0, y: d.y || 0 });
      })
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
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

    // Внешнее кольцо (confidence)
    nodeGroup.append('circle')
      .attr('r', d => {
        const innerR = Math.max(6, Math.min(18, 6 + d.memory.mentions * 1.5));
        return innerR + 4;
      })
      .attr('fill', 'none')
      .attr('stroke', d => CATEGORY_COLORS[d.memory.category])
      .attr('stroke-width', 2)
      .attr('opacity', d => d.memory.confidence);

    // Внутренний круг (mentions)
    nodeGroup.append('circle')
      .attr('r', d => Math.max(6, Math.min(18, 6 + d.memory.mentions * 1.5)))
      .attr('fill', d => CATEGORY_COLORS[d.memory.category])
      .attr('fill-opacity', 0.85);

    // Labels - показываем только при zoom > 1.3
    const label = g
      .append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => d.memory.fact.slice(0, 18) + (d.memory.fact.length > 18 ? '…' : ''))
      .attr('font-size', 10)
      .attr('fill', 'rgba(255,255,255,0.7)')
      .attr('text-anchor', 'middle')
      .attr('dy', 30)
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('transition', 'opacity 200ms');

    simulation.on('tick', () => {
      // Изогнутые рёбра
      link.attr('d', d => {
        const source = d.source as GraphNode;
        const target = d.target as GraphNode;
        const dx = (target.x || 0) - (source.x || 0);
        const dy = (target.y || 0) - (source.y || 0);
        const dr = Math.sqrt(dx * dx + dy * dy) * 0.6;
        return `M${source.x},${source.y} A${dr},${dr} 0 0,1 ${target.x},${target.y}`;
      });

      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
      label.attr('x', d => d.x!).attr('y', d => d.y!);
    });

    // Обновляем opacity labels при изменении zoom
    const updateLabelsVisibility = () => {
      label.style('opacity', zoom > 1.3 ? 1 : 0);
    };
    updateLabelsVisibility();

    // Применяем glow к выбранному ноду
    if (selectedNode) {
      nodeGroup
        .filter(d => d.memory.id === selectedNode.id)
        .attr('filter', `url(#glow-${selectedNode.category})`);
    }

    // Подсвечиваем связанные рёбра при выборе нода
    if (selectedNode) {
      link
        .attr('stroke', d => {
          const source = (d.source as GraphNode).id;
          const target = (d.target as GraphNode).id;
          return source === selectedNode.id || target === selectedNode.id
            ? 'rgba(255,255,255,0.3)'
            : 'rgba(255,255,255,0.08)';
        });
    }

    return () => {
      simulation.stop();
    };
  }, [memories, showLinks, categoryFilter, selectedNode, zoom]);

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
      <svg ref={svgRef} className="w-full h-full" onClick={() => setSelectedNode(null)} />

      {/* In-Graph Tooltip */}
      {selectedNode && selectedNodePosition && (
        <div
          className="absolute bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl p-4 shadow-2xl z-20 animate-fade-in pointer-events-auto"
          style={{
            left: Math.min(Math.max(selectedNodePosition.x + 20, 20), window.innerWidth - 320),
            top: Math.min(Math.max(selectedNodePosition.y - 80, 20), window.innerHeight - 200),
            width: '280px',
          }}
        >
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
              onClick={() => {
                onSelectMemory(selectedNode.id);
                setSelectedNode(null);
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-white text-black text-xs font-medium hover:opacity-80 transition-opacity flex items-center justify-center gap-1.5"
            >
              <Edit2 size={12} />
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
