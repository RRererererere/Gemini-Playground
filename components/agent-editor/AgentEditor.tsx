import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  NodeTypes,
  ConnectionMode,
  MarkerType,
  reconnectEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Square, Download, Upload, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { UniversalModel, ActiveModel, ApiKeyEntry } from '@/types';
import { AgentGraph, AgentRun, NodeData, EdgeData } from '@/lib/agent-engine/types';
import { GraphExecutor } from '@/lib/agent-engine/executor';
import { saveGraph, saveRun, exportGraph, importGraph } from '@/lib/agent-engine/graph-storage';
import { AgentEditorSidebar } from './AgentEditorSidebar';
import { AgentEditorProperties } from './AgentEditorProperties';
import { RunPanel } from './RunPanel';
import { ToastContainer } from './Toast';
import { RunInputModal, InputField } from './RunInputModal';
import {
  AgentInputNode, LLMNode, SkillNode, MemoryNode, ConditionNode, AgentOutputNode,
  TransformNode, MergeNode, SplitNode, RouterNode, LoopNode,
  ChatInputNode, ChatOutputNode, ChatHistoryNode, MemoryReadNode, MemoryWriteNode,
  CodeNode, DebugNode, HTTPRequestNode, TextNode
} from './nodes/CustomNodes';


const nodeTypes: NodeTypes = {
  agent_input: AgentInputNode,
  llm: LLMNode,
  skill: SkillNode,
  memory: MemoryNode,
  condition: ConditionNode,
  agent_output: AgentOutputNode,
  transform: TransformNode,
  merge: MergeNode,
  split: SplitNode,
  router: RouterNode,
  loop: LoopNode,
  chat_input: ChatInputNode,
  chat_output: ChatOutputNode,
  chat_history: ChatHistoryNode,
  memory_read: MemoryReadNode,
  memory_write: MemoryWriteNode,
  code: CodeNode,
  debug: DebugNode,
  http_request: HTTPRequestNode,
  text: TextNode,
  input: AgentInputNode,
  output: AgentOutputNode,
};

const initialNodes: Node[] = [
  { id: 'start', type: 'agent_input', position: { x: 250, y: 150 }, data: { label: 'Input' } },
];
const initialEdges: Edge[] = [];

let id = 0;
const getId = () => `dndnode_${id++}`;

export interface AgentEditorProps {
  allModels?: UniversalModel[];
  activeModel?: ActiveModel | null;
  apiKeys?: Record<string, ApiKeyEntry[]>;
  graph?: AgentGraph;
  onGraphChange?: (graph: AgentGraph) => void;
}

type SaveStatus = 'saved' | 'saving' | 'unsaved';

const AgentEditorContent = ({ allModels, activeModel, apiKeys, graph, onGraphChange }: AgentEditorProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph?.nodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph?.edges || initialEdges);
  const { screenToFlowPosition, setViewport, getViewport } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: 'error' | 'warning' | 'info' }>>([]);

  const showToast = useCallback((message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    const id = `toast_${Date.now()}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Execution state
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | undefined>();
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const executorRef = useRef<GraphExecutor | null>(null);
  const reconnectSuccessful = useRef(false);

  // Save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Context Menus
  const [nodeMenu, setNodeMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // Run Input Modal
  const [showInputModal, setShowInputModal] = useState(false);
  const [pendingInputFields, setPendingInputFields] = useState<InputField[]>([]);

  // Close menus on global click
  useEffect(() => {
    const handleGlobalClick = () => {
      setNodeMenu(null);
      setEdgeMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Load graph viewport
  useEffect(() => {
    if (graph?.viewport) {
      setViewport(graph.viewport);
    }
  }, [graph?.id]);

  // Auto-save graph with status indicator
  useEffect(() => {
    if (!graph) return;

    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      setSaveStatus('saving');
      const updatedGraph: AgentGraph = {
        ...graph,
        nodes: nodes as Node<NodeData>[],
        edges: edges as Edge<EdgeData>[],
        viewport: getViewport(),
        updatedAt: Date.now(),
      };

      saveGraph(updatedGraph);

      if (onGraphChange) {
        onGraphChange(updatedGraph);
      }
      setSaveStatus('saved');
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges]);

  // Sync selectedNode with changes
  useEffect(() => {
    if (selectedNode) {
      const current = nodes.find(n => n.id === selectedNode.id);
      if (current) setSelectedNode(current);
      else setSelectedNode(null);
    }
  }, [nodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setNodeMenu(null);
    setEdgeMenu(null);
  }, []);

  const onNodeContextMenu = useCallback((event: any, node: Node) => {
    event.preventDefault();
    setEdgeMenu(null);
    setNodeMenu({ id: node.id, top: event.clientY, left: event.clientX });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    setNodeMenu(null);
    setEdgeMenu({ id: edge.id, x: event.clientX, y: event.clientY });
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneContextMenu = useCallback((event: any) => {
    event.preventDefault();
    setNodeMenu(null);
    setEdgeMenu(null);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
    setNodeMenu(null);
  }, [selectedNode, setNodes, setEdges]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setEdgeMenu(null);
  }, [setEdges]);

  const duplicateNode = useCallback((nodeId: string) => {
    const nodeToDuplicate = nodes.find(n => n.id === nodeId);
    if (!nodeToDuplicate) return;

    const newNode = {
      ...nodeToDuplicate,
      id: getId(),
      position: { x: nodeToDuplicate.position.x + 50, y: nodeToDuplicate.position.y + 50 },
      selected: false,
    };

    setNodes((nds) => nds.concat(newNode));
    setNodeMenu(null);
  }, [nodes, setNodes]);

  const onNodesDelete = useCallback((deleted: Node[]) => {
    setNodes((nds) => nds.filter((n) => !deleted.find((d) => d.id === n.id)));
    setEdges((eds) => eds.filter(e => !deleted.find(d => d.id === e.source || d.id === e.target)));
    if (selectedNode && deleted.find(d => d.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [setNodes, setEdges, selectedNode]);

  // Обработчик удаления edges через Delete/Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEdge && !e.repeat) {
        // Проверяем что фокус не в input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
        
        e.preventDefault();
        setEdges(eds => eds.filter(ed => ed.id !== selectedEdge.id));
        setSelectedEdge(null);
        showToast('🔌 Connection deleted', 'info');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdge, setEdges, showToast]);

  const updateNodeData = useCallback((id: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data };
        }
        return node;
      })
    );
  }, [setNodes]);

  const onConnect = useCallback((params: Connection | Edge) => {
    setEdges((eds) => {
      const { NODE_DEFINITIONS, getPortColor } = require('@/lib/agent-engine/node-definitions');

      const sourceNode = nodes.find(n => n.id === params.source);
      let color = 'rgba(99, 102, 241, 0.6)';

      if (sourceNode) {
        const sourceDef = NODE_DEFINITIONS[sourceNode.type!];
        if (sourceDef) {
          const sourcePort = sourceDef.outputs.find((p: any) => p.id === params.sourceHandle);
          if (sourcePort) {
            color = getPortColor(sourcePort.type);
          }
        }
      }

      const targetNode = nodes.find(n => n.id === params.target);
      const targetDef = targetNode ? NODE_DEFINITIONS[targetNode.type!] : null;
      const targetPort = targetDef?.inputs.find((p: any) => p.id === params.targetHandle);

      const newEdge = {
        ...params,
        style: { stroke: color, strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
      };

      // Если порт не multi, удаляем старую связь перед добавлением новой
      if (targetPort && !targetPort.multi) {
        return addEdge(newEdge, eds.filter(e => e.target !== params.target || e.targetHandle !== params.targetHandle));
      }

      return addEdge(newEdge, eds);
    });
  }, [setEdges, nodes]);

  const onReconnectStart = useCallback(() => {
    reconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    reconnectSuccessful.current = true;
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
  }, [setEdges]);

  const onReconnectEnd = useCallback((_: any, edge: Edge) => {
    if (!reconnectSuccessful.current) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      showToast('🔌 Connection removed', 'info');
    }
    reconnectSuccessful.current = false;
  }, [setEdges, showToast]);

  // Обновление цветов edges и выделение выбранного
  useEffect(() => {
    const { NODE_DEFINITIONS, getPortColor } = require('@/lib/agent-engine/node-definitions');

    setEdges((eds) => eds.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode) return edge;

      const sourceDef = NODE_DEFINITIONS[sourceNode.type!];
      if (!sourceDef) return edge;

      const sourcePort = sourceDef.outputs.find((p: any) => p.id === edge.sourceHandle);
      if (!sourcePort) return edge;

      const color = getPortColor(sourcePort.type);
      const isSelected = selectedEdge?.id === edge.id;

      return {
        ...edge,
        style: { 
          ...edge.style, 
          stroke: isSelected ? '#fbbf24' : color, 
          strokeWidth: isSelected ? 4 : 2.5,
          opacity: isSelected ? 1 : 0.8
        },
        animated: isSelected ? true : edge.animated
      };
    }));
  }, [nodes, selectedEdge, setEdges]);

  // Валидация соединений
  const isValidConnection = useCallback((connection: Connection | Edge): boolean => {
    const { NODE_DEFINITIONS, isPortCompatible } = require('@/lib/agent-engine/node-definitions');

    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const sourceDef = NODE_DEFINITIONS[sourceNode.type!];
    const targetDef = NODE_DEFINITIONS[targetNode.type!];
    if (!sourceDef || !targetDef) return true;

    const sourcePort = sourceDef.outputs.find((p: any) => p.id === connection.sourceHandle);
    const targetPort = targetDef.inputs.find((p: any) => p.id === connection.targetHandle);
    if (!sourcePort || !targetPort) return false;

    if (!isPortCompatible(sourcePort.type, targetPort.type)) {
      showToast(`Cannot connect ${sourcePort.type} → ${targetPort.type}`, 'error');
      return false;
    }

    if (connection.source === connection.target) {
      showToast('Self-loops are not allowed', 'warning');
      return false;
    }

    if (!targetPort.multi) {
      // Мы возвращаем true, чтобы onConnect сработал и заменил связь,
      // но визуально можно было бы дать понять. Пока просто разрешаем.
      return true;
    }

    return true;
  }, [nodes, edges, showToast]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode: Node = {
        id: getId(),
        type,
        position,
        data: { label, type, inputs: {}, outputs: {}, settings: {} },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes]
  );

  // === Graph Execution ===

  const executeGraph = useCallback(async (userInputValues: Record<string, string> = {}) => {
    setIsRunning(true);
    setCurrentRun(null);
    setCurrentNodeId(undefined);
    setStreamingContent({});

    // Inject user input values into nodes
    const nodesWithInputs = nodes.map(n => {
      if (userInputValues[n.id] !== undefined) {
        return { ...n, data: { ...n.data, initialValue: userInputValues[n.id] } };
      }
      return n;
    });

    // Reset statuses
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...n.data, status: 'idle' as const }
    })));

    const currentGraph = graph || {
      id: 'temp-graph',
      name: 'Temporary Graph',
      nodes: nodesWithInputs as Node<NodeData>[],
      edges: edges as Edge<EdgeData>[],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { version: '1.0.0', tags: [], runCount: 0 },
    };

    const graphToRun: AgentGraph = {
      ...currentGraph,
      nodes: nodesWithInputs as Node<NodeData>[],
      edges: edges as Edge<EdgeData>[],
      viewport: getViewport(),
    };

    const executor = new GraphExecutor(graphToRun, {
      onNodeStart: (nodeId) => {
        setCurrentNodeId(nodeId);
        // Очищаем streaming для начинающегося узла
        setStreamingContent(prev => {
          const next = { ...prev };
          delete next[nodeId];
          return next;
        });
        setNodes((nds) => nds.map(n =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'running' as const } }
            : n
        ));
      },
      onNodeComplete: (nodeId) => {
        setNodes((nds) => nds.map(n =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'success' as const } }
            : n
        ));
      },
      onNodeError: (nodeId, error) => {
        setNodes((nds) => nds.map(n =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'error' as const, error: error.message } }
            : n
        ));
      },
      onNodeStream: (nodeId, _chunk, accumulated) => {
        setStreamingContent(prev => ({ ...prev, [nodeId]: accumulated }));
      },
      onRunComplete: (run) => {
        setCurrentRun(run);
        setIsRunning(false);
        setCurrentNodeId(undefined);
        saveRun(run);

        // Сбрасываем только status, НЕ error — пользователь должен видеть что пошло не так
        setTimeout(() => {
          setNodes((nds) => nds.map(n => ({
            ...n,
            data: { ...n.data, status: 'idle' as const }
            // error намеренно не сбрасывается
          })));
        }, 3000);
      },
    });

    executorRef.current = executor;

    try {
      const run = await executor.run();
      setCurrentRun(run);
    } catch (error) {
      console.error('Graph execution failed:', error);
      showToast('Execution failed: ' + (error instanceof Error ? error.message : String(error)), 'error');
    } finally {
      setIsRunning(false);
      setCurrentNodeId(undefined);
    }
  }, [graph, nodes, edges, getViewport, setNodes, showToast]);

  const handleRunGraph = useCallback(async () => {
    if (isRunning) return;

    // Найти все Input ноды с типом user_input
    const userInputNodes = nodes.filter(n =>
      (n.type === 'agent_input' || n.type === 'input') &&
      (n.data.settings as any)?.inputType === 'user_input'
    );

    if (userInputNodes.length > 0) {
      const fields: InputField[] = userInputNodes.map(n => ({
        nodeId: n.id,
        nodeLabel: (n.data.label as string) || 'Input',
        fieldLabel: (n.data.settings as any)?.fieldLabel || 'Your message',
        placeholder: (n.data.settings as any)?.placeholder,
        description: (n.data.settings as any)?.description,
        type: 'textarea' as const,
      }));

      setPendingInputFields(fields);
      setShowInputModal(true);
      return;
    }

    await executeGraph({});
  }, [isRunning, nodes, executeGraph]);

  const handleInputModalConfirm = useCallback(async (values: Record<string, string>) => {
    setShowInputModal(false);
    await executeGraph(values);
  }, [executeGraph]);

  const handleStopExecution = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.cancel();
      setIsRunning(false);
      setCurrentNodeId(undefined);
    }
  }, []);

  const handleSaveGraph = useCallback(() => {
    const currentGraph = graph || {
      id: `graph-${Date.now()}`,
      name: 'New Agent',
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { version: '1.0.0', tags: [], runCount: 0 },
    };

    const updatedGraph: AgentGraph = {
      ...currentGraph,
      nodes: nodes as Node<NodeData>[],
      edges: edges as Edge<EdgeData>[],
      viewport: getViewport(),
      updatedAt: Date.now(),
    };

    setSaveStatus('saving');
    saveGraph(updatedGraph);

    if (onGraphChange) {
      onGraphChange(updatedGraph);
    }

    setSaveStatus('saved');
    showToast('✅ Агент сохранен! (Сохраняется в браузер как локальный кэш. Ваши агенты на вкладке /agents)', 'info');
  }, [graph, nodes, edges, getViewport, onGraphChange, showToast]);

  // Export graph to JSON
  const handleExportGraph = useCallback(() => {
    const currentGraph: AgentGraph = {
      ...(graph || {
        id: `graph_${Date.now()}`,
        name: 'Exported Agent',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: { version: '1.0.0', tags: [], runCount: 0 },
        viewport: getViewport(),
      }),
      nodes: nodes as Node<NodeData>[],
      edges: edges as Edge<EdgeData>[],
      viewport: getViewport(),
      updatedAt: Date.now(),
    };

    const json = exportGraph(currentGraph);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentGraph.name.replace(/\s+/g, '_')}.agent.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Agent exported!', 'info');
  }, [graph, nodes, edges, getViewport, showToast]);

  // Import graph from JSON
  const handleImportGraph = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.agent.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const jsonStr = ev.target?.result as string;
          const imported = importGraph(jsonStr);
          if (onGraphChange) onGraphChange(imported);
          setNodes(imported.nodes);
          setEdges(imported.edges);
          if (imported.viewport) setViewport(imported.viewport);
          showToast('Agent imported successfully!', 'info');
        } catch {
          showToast('Failed to import: invalid file format', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [onGraphChange, setNodes, setEdges, setViewport, showToast]);

  // Показываем онбординг если только стартовая нода
  const showOnboarding = nodes.length === 1 && nodes[0]?.type === 'agent_input';

  return (
    <div className="flex w-full h-full text-[var(--text-primary)]">
      {/* Sidebar */}
      <AgentEditorSidebar />

      {/* Canvas */}
      <div className="flex-1 h-full relative bg-[var(--surface-0)]" ref={reactFlowWrapper}>
        {/* Onboarding hint */}
        {showOnboarding && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0" style={{ bottom: '320px', top: '60px' }}>
            <div className="text-center max-w-sm opacity-50">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Build Your Agent</h3>
              <p className="text-sm text-[var(--text-dim)] mb-4 leading-relaxed">
                Drag nodes from the left panel to the canvas.<br />
                Connect them by dragging from an output <span className="text-indigo-400">●</span> to an input <span className="text-indigo-400">●</span>.<br />
                Click <strong>Run Agent</strong> to execute.
              </p>
              <div className="text-xs text-[var(--text-dim)] space-y-1">
                <div>💡 Start: <strong>Input → LLM → Output</strong></div>
                <div>🔌 Disconnect: <strong>Drag line & drop on empty space</strong></div>
                <div>⌨️ Delete: <strong>Click line + press Delete</strong></div>
              </div>
            </div>
          </div>
        )}


        {/* Toolbar */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {/* Save status indicator */}
          {graph && (
            <span className="text-xs text-[var(--text-dim)] flex items-center gap-1 mr-1">
              {saveStatus === 'saved' && <><CheckCircle2 size={11} className="text-emerald-400" /> Saved</>}
              {saveStatus === 'saving' && <><Loader2 size={11} className="animate-spin" /> Saving...</>}
              {saveStatus === 'unsaved' && <><AlertCircle size={11} className="text-amber-400" /> Unsaved</>}
            </span>
          )}

          <button
            onClick={handleExportGraph}
            title="Export agent to .json"
            className="px-3 py-2 text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border)] flex items-center gap-1.5"
          >
            <Download size={13} />
            Export
          </button>

          <button
            onClick={handleImportGraph}
            title="Import agent from .json"
            className="px-3 py-2 text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border)] flex items-center gap-1.5"
          >
            <Upload size={13} />
            Import
          </button>

          {isRunning ? (
            <button
              onClick={handleStopExecution}
              className="px-4 py-2 text-sm font-medium bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-red-400 rounded-lg transition-colors shadow-lg backdrop-blur-sm border border-red-500/30 flex items-center gap-2"
            >
              <Square size={14} />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRunGraph}
              className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-lg flex items-center gap-2"
            >
              <Play size={14} />
              Run Agent
            </button>
          )}
          <button
            id="save-graph-btn"
            onClick={handleSaveGraph}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-lg"
          >
            Save Agent
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onEdgeClick={onEdgeClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodesDelete={onNodesDelete}
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode={['Control', 'Meta']}
          selectionKeyCode={['Shift']}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          className="bg-transparent h-full w-full absolute inset-0 z-10"
          minZoom={0.1}
          connectionMode={ConnectionMode.Loose}
          edgesReconnectable={true}
          reconnectRadius={40}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: 'rgba(99, 102, 241, 0.6)', strokeWidth: 3 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
          }}
        >
          <Controls className="bg-[var(--surface-3)] border-[var(--border)] fill-[var(--text-primary)] text-[var(--text-primary)] shadow-lg" />
          <MiniMap
            nodeStrokeColor="#4f46e5"
            nodeColor="var(--surface-2)"
            maskColor="rgba(0,0,0,0.5)"
            style={{ backgroundColor: 'var(--surface-1)' }}
            position="bottom-left"
          />
          <Background gap={24} size={1} color="rgba(255,255,255,0.06)" />
        </ReactFlow>


        {/* Node Context Menu */}
        {nodeMenu && (
          <div
            className="fixed bg-[var(--surface-1)] border border-[var(--border-strong)] rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-50 py-1 min-w-[160px]"
            style={{ top: nodeMenu.top, left: nodeMenu.left }}
          >
            <div className="px-3 py-1.5 text-xs text-[var(--text-dim)] border-b border-[var(--border)] mb-1 font-mono uppercase">
              Node Actions
            </div>
            <button
              onClick={() => duplicateNode(nodeMenu.id)}
              className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)] hover:text-indigo-400 transition-colors"
            >
              Duplicate Node
            </button>
            <button
              onClick={() => deleteNode(nodeMenu.id)}
              className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              Delete Node
            </button>
          </div>
        )}

        {/* Edge Context Menu */}
        {edgeMenu && (
          <div
            className="fixed bg-[var(--surface-1)] border border-[var(--border-strong)] rounded-lg shadow-2xl z-50 py-1 min-w-[180px]"
            style={{ top: edgeMenu.y, left: edgeMenu.x }}
          >
            <div className="px-3 py-1.5 text-xs text-[var(--text-dim)] border-b border-[var(--border)] mb-1 font-mono uppercase">
              Connection Actions
            </div>
            <button
              onClick={() => {
                const edge = edges.find(e => e.id === edgeMenu.id);
                if (edge) {
                  setSelectedEdge(edge);
                  showToast('💡 Press Delete or Backspace to remove', 'info');
                }
                setEdgeMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)] hover:text-amber-400 transition-colors flex items-center gap-2"
            >
              <span className="text-amber-400">⚡</span>
              Select Connection
            </button>
            <button
              onClick={() => deleteEdge(edgeMenu.id)}
              className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
            >
              <span>🗑</span>
              Delete Connection
            </button>
          </div>
        )}

        {/* Properties Panel */}
        <AgentEditorProperties
          node={selectedNode}
          edges={edges}
          onClose={() => setSelectedNode(null)}
          updateNodeData={updateNodeData}
          allModels={allModels}
          activeModel={activeModel}
          apiKeys={apiKeys}
        />

        {/* Run Panel */}
        <RunPanel
          run={currentRun}
          isRunning={isRunning}
          onStop={handleStopExecution}
          currentNodeId={currentNodeId}
          streamingContent={streamingContent}
        />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        {/* Run Input Modal */}
        {showInputModal && (
          <RunInputModal
            fields={pendingInputFields}
            onConfirm={handleInputModalConfirm}
            onCancel={() => setShowInputModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export const AgentEditor = (props: AgentEditorProps) => {
  return (
    <ReactFlowProvider>
      <div className="w-full h-full bg-[var(--surface-0)] absolute inset-0 z-10 flex flex-col rounded-lg overflow-hidden border border-[var(--border)] m-2 shadow-2xl">
        <div className="flex items-center px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-1)]">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse"></span>
            Agent Editor
            <span className="text-xs text-[var(--text-dim)] font-normal ml-2">
              {props.graph?.name || 'Visualize & Connect'}
            </span>
          </h2>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <AgentEditorContent {...props} />
        </div>
      </div>
    </ReactFlowProvider>
  );
};
