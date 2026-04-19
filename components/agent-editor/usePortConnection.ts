import { useMemo } from 'react';
import { Edge, Node } from '@xyflow/react';

/**
 * Хук для проверки подключённости портов ноды
 */
export function usePortConnection(node: Node | null, edges: Edge[]) {
  return useMemo(() => {
    if (!node) {
      return {
        isPortConnected: () => false,
        getConnectedPorts: () => [],
        getIncomingEdges: () => [],
        getOutgoingEdges: () => []
      };
    }

    const incomingEdges = edges.filter(e => e.target === node.id);
    const outgoingEdges = edges.filter(e => e.source === node.id);

    const connectedInputPorts = new Set(
      incomingEdges.map(e => e.targetHandle).filter((h): h is string => Boolean(h))
    );

    const connectedOutputPorts = new Set(
      outgoingEdges.map(e => e.sourceHandle).filter((h): h is string => Boolean(h))
    );

    return {
      /**
       * Проверяет подключён ли конкретный порт
       */
      isPortConnected: (portId: string, isInput: boolean = true): boolean => {
        return isInput 
          ? connectedInputPorts.has(portId)
          : connectedOutputPorts.has(portId);
      },

      /**
       * Возвращает список всех подключённых портов
       */
      getConnectedPorts: (isInput: boolean = true): string[] => {
        return Array.from(isInput ? connectedInputPorts : connectedOutputPorts);
      },

      /**
       * Возвращает входящие edges
       */
      getIncomingEdges: () => incomingEdges,

      /**
       * Возвращает исходящие edges
       */
      getOutgoingEdges: () => outgoingEdges
    };
  }, [node, edges]);
}
