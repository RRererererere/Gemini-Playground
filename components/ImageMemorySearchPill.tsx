/**
 * Компонент для отображения результатов preflight поиска изображений
 */

'use client';

import { useState } from 'react';
import { Search, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import type { ImageMemoryMeta } from '@/lib/image-memory-store';

interface ImageMemorySearchPillProps {
  memories: Array<{
    id: string;
    description: string;
    tags: string[];
    entities: string[];
    thumbnailBase64: string;
    score?: number;
  }>;
  entities: string[];
  confidence: number;
  onSelect?: (memoryId: string) => void;
}

export default function ImageMemorySearchPill({
  memories,
  entities,
  confidence,
  onSelect,
}: ImageMemorySearchPillProps) {
  const [expanded, setExpanded] = useState(false);
  
  if (memories.length === 0) return null;
  
  const confidenceColor = 
    confidence > 0.7 ? 'text-green-400' :
    confidence > 0.4 ? 'text-yellow-400' :
    'text-gray-400';
  
  const entityStr = entities.slice(0, 2).join(', ');
  const more = entities.length > 2 ? ` +${entities.length - 2}` : '';
  
  return (
    <div className="inline-block mb-2 animate-fade-in">
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-500/15 transition-colors"
        >
          <Search size={12} className="text-purple-400 flex-shrink-0" />
          <span className="text-xs text-purple-300 flex-1 text-left">
            Найдено {memories.length} изображений: {entityStr}{more}
          </span>
          <span className={`text-[9px] font-mono ${confidenceColor}`}>
            {Math.round(confidence * 100)}%
          </span>
          {expanded ? (
            <ChevronUp size={12} className="text-purple-400/70" />
          ) : (
            <ChevronDown size={12} className="text-purple-400/70" />
          )}
        </button>
        
        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-purple-500/20 p-3 space-y-2">
            {memories.map(mem => (
              <button
                key={mem.id}
                onClick={() => onSelect?.(mem.id)}
                className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-purple-500/10 transition-colors text-left group"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-purple-500/30">
                  <img
                    src={mem.thumbnailBase64}
                    alt={mem.description}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs text-purple-200 font-medium line-clamp-1">
                      {mem.entities.join(', ') || 'Изображение'}
                    </p>
                    {mem.score !== undefined && (
                      <span className="text-[9px] text-purple-400/70 font-mono">
                        {Math.round(mem.score * 100)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-purple-300/70 line-clamp-2 mb-1">
                    {mem.description}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {mem.tags.slice(0, 3).map((tag, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded bg-purple-500/20 text-[8px] text-purple-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
