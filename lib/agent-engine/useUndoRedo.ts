import { useCallback, useEffect, useState } from 'react';
import { Node, Edge } from '@xyflow/react';

export default function useUndoRedo({
  nodes,
  edges,
  setNodes,
  setEdges,
}: {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
}) {
  const [past, setPast] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [isIterating, setIsIterating] = useState(false);

  const takeSnapshot = useCallback(() => {
    setPast((p) => [
      ...p.slice(Math.max(p.length - 20, 0)), // Limit to 20 states
      { nodes, edges },
    ]);
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      const newPast = p.slice(0, p.length - 1);
      
      setFuture((f) => [{ nodes, edges }, ...f]);
      setIsIterating(true);
      setNodes(previous.nodes);
      setEdges(previous.edges);
      
      return newPast;
    });
  }, [setNodes, setEdges, nodes, edges]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      const newFuture = f.slice(1);
      
      setPast((p) => [...p, { nodes, edges }]);
      setIsIterating(true);
      setNodes(next.nodes);
      setEdges(next.edges);
      
      return newFuture;
    });
  }, [setNodes, setEdges, nodes, edges]);

  // Hook keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Mac uses metaKey (Command), Windows uses ctrlKey
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;
      
      if (cmdKey && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (cmdKey && e.key === 'y') {
        redo();
      }
    };
    
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  return {
    takeSnapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    isIterating,
    setIsIterating,
  };
}
