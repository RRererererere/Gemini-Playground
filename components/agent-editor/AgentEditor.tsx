import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
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
import { Play, Square, Download, Upload, CheckCircle2, Loader2, AlertCircle, Undo2, Redo2, Wand2, Rocket } from 'lucide-react';
import { UniversalModel, ActiveModel, ApiKeyEntry } from '@/types';
import { AgentGraph, AgentRun, NodeData, EdgeData } from '@/lib/agent-engine/types';
import { GraphExecutor } from '@/lib/agent-engine/executor';
import { saveGraph, saveRun, exportGraph, importGraph } from '@/lib/agent-engine/graph-storage';
import { getLayoutedElements } from '@/lib/agent-engine/layout';
import useUndoRedo from '@/lib/agent-engine/useUndoRedo';
import { createAgentConfig, getAgentConfigByGraphId, saveAgentConfig, deleteAgentConfig } from '@/lib/agent-engine/agent-chat-store';
import { AgentEditorSidebar } from './AgentEditorSidebar';
import { AgentEditorProperties } from './AgentEditorProperties';
import { RunPanel } from './RunPanel';
import { ToastContainer } from './Toast';
import { RunInputModal, InputField } from './RunInputModal';
import {
  AgentInputNode, LLMNode, SkillNode, MemoryNode, ConditionNode, AgentOutputNode,
  TransformNode, MergeNode, SplitNode, RouterNode, LoopNode,
  ChatInputNode, ChatOutputNode, DatabaseHubNode, MemoryReadNode, MemoryWriteNode,
  CodeNode, DebugNode, HTTPRequestNode, TextNode,
  TemplateNode, VariableNode, JsonExtractNode, DelayNode, SubAgentNode, GlobalDbNode, FeedbackNode,
  PlannerNode
} from './nodes/CustomNodes';
import { FeedbackModal } from './FeedbackModal';


const nodeTypes: NodeTypes = {
  agent_input: AgentInputNode,
  planner: PlannerNode,
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
  database_hub: DatabaseHubNode,
  memory_read: MemoryReadNode,
  memory_write: MemoryWriteNode,
  code: CodeNode,
  debug: DebugNode,
  http_request: HTTPRequestNode,
  text: TextNode,
  input: AgentInputNode,
  output: AgentOutputNode,
  // New nodes
  template: TemplateNode,
  variable: VariableNode,
  json_extract: JsonExtractNode,
  delay: DelayNode,
  subagent: SubAgentNode,
  global_db: GlobalDbNode,
  feedback: FeedbackNode,
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

type FeedbackRequestState = {
  promptText: string;
  context: any;
  resolve: (val: any) => void;
  reject: (err: any) => void;
};

const AgentEditorContent = ({ allModels, activeModel, apiKeys, graph, onGraphChange }: AgentEditorProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph?.nodes || initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph?.edges || initialEdges);
  const { screenToFlowPosition, setViewport, getViewport } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  // Undo/Redo State
  const { takeSnapshot, undo, redo, canUndo, canRedo, isIterating, setIsIterating } = useUndoRedo({
    nodes,
    edges,
    setNodes,
    setEdges,
  });

  // Handle graph structural changes to snapshot reliably
  const handleNodesChange = useCallback((changes: any) => {
    // Only snapshot if it's a structural change or the end of a drag, to avoid saving every pixel frame
    const hasSignificantChange = changes.some((c: any) => 
      c.type === 'remove' || c.type === 'add' || 
      (c.type === 'position' && !c.dragging) // End of drag
    );
    if (hasSignificantChange && !isIterating) takeSnapshot();
    if (isIterating && !changes.some((c: any) => c.dragging)) setIsIterating(false);
    onNodesChange(changes);
  }, [onNodesChange, takeSnapshot, isIterating, setIsIterating]);

  const handleEdgesChange = useCallback((changes: any) => {
    const hasSignificantChange = changes.some((c: any) => c.type === 'remove' || c.type === 'add');
    if (hasSignificantChange && !isIterating) takeSnapshot();
    onEdgesChange(changes);
  }, [onEdgesChange, takeSnapshot, isIterating]);

  const onLayout = useCallback(() => {
    takeSnapshot();
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      'LR'
    );
    setNodes([...layoutedNodes] as Node[]);
    setEdges([...layoutedEdges] as Edge[]);
    setTimeout(() => {
      // Use standard react flow fitView after layout
      const evt = new CustomEvent('agent-graph-fit-view');
      window.dispatchEvent(evt);
    }, 50);
  }, [nodes, edges, setNodes, setEdges, takeSnapshot]);

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
  const [feedbackRequest, setFeedbackRequest] = useState<FeedbackRequestState | null>(null);

  // Publication state
  const [isPublished, setIsPublished] = useState(false);

  // Check if graph is published
  useEffect(() => {
    if (graph) {
      const config = getAgentConfigByGraphId(graph.id);
      setIsPublished(config?.isPublished || false);
    }
  }, [graph?.id]);

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
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
    setNodeMenu(null);
  }, [selectedNode, setNodes, setEdges, takeSnapshot]);

  const deleteEdge = useCallback((edgeId: string) => {
    takeSnapshot();
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setEdgeMenu(null);
  }, [setEdges, takeSnapshot]);

  const duplicateNode = useCallback((nodeId: string) => {
    const nodeToDuplicate = nodes.find(n => n.id === nodeId);
    if (!nodeToDuplicate) return;
    takeSnapshot();

    const newNode = {
      ...nodeToDuplicate,
      id: getId(),
      position: { x: nodeToDuplicate.position.x + 50, y: nodeToDuplicate.position.y + 50 },
      selected: false,
    };

    setNodes((nds) => nds.concat(newNode));
    setNodeMenu(null);
  }, [nodes, setNodes, takeSnapshot]);

  const onNodesDelete = useCallback((deleted: Node[]) => {
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => !deleted.find((d) => d.id === n.id)));
    setEdges((eds) => eds.filter(e => !deleted.find(d => d.id === e.source || d.id === e.target)));
    if (selectedNode && deleted.find(d => d.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [setNodes, setEdges, selectedNode, takeSnapshot]);

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
        takeSnapshot();
        setEdges(eds => eds.filter(ed => ed.id !== selectedEdge.id));
        setSelectedEdge(null);
        showToast('🔌 Connection deleted', 'info');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdge, setEdges, showToast]);

  const updateNodeData = useCallback((id: string, data: any) => {
    takeSnapshot();
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data };
        }
        return node;
      })
    );
  }, [setNodes, takeSnapshot]);

  const onConnect = useCallback((params: Connection | Edge) => {
    takeSnapshot();
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
    takeSnapshot();
    reconnectSuccessful.current = true;
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
  }, [setEdges, takeSnapshot]);

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
      // BUG-09: callback для пропущенных нод
      onNodeSkip: (nodeId) => {
        setNodes((nds) => nds.map(n =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'skipped' as const } }
            : n
        ));
      },
      onRunComplete: (run) => {
        setCurrentRun(run);
        setIsRunning(false);
        setCurrentNodeId(undefined);
        saveRun(run);

        // Внедряем продолжительность выполнения (duration) в каждую ноду
        setNodes((nds) => nds.map(n => {
          const runResult = run.results[n.id];
          if (runResult) {
            return {
              ...n,
              data: { ...n.data, duration: runResult.duration }
            };
          }
          return n;
        }));

        // Сбрасываем только status, НЕ error и НЕ duration
        setTimeout(() => {
          setNodes((nds) => nds.map(n => ({
            ...n,
            data: { ...n.data, status: 'idle' as const }
            // error и duration намеренно не сбрасываются
          })));
        }, 3000);
      },
      onChatInputRequest: (type, options) => {
        return new Promise((resolve, reject) => {
          if (type === 'feedback') {
            setFeedbackRequest({
              promptText: options?.promptText || 'Оцените ответ ИИ',
              context: options?.context,
              resolve,
              reject
            });
          } else {
             reject(new Error(`Unsupported input type: ${type}`));
          }
        });
      }
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

  // Publish/Unpublish agent
  const handleTogglePublish = useCallback(() => {
    if (!graph) return;

    const existingConfig = getAgentConfigByGraphId(graph.id);

    if (existingConfig && existingConfig.isPublished) {
      // Unpublish
      existingConfig.isPublished = false;
      saveAgentConfig(existingConfig);
      setIsPublished(false);
      showToast('Агент снят с публикации', 'info');
    } else {
      // Find existing chat_input node
      const chatInputNode = nodes.find(n => n.type === 'chat_input');
      
      if (chatInputNode) {
        // Check if it's already in ask_user mode
        const currentSource = (chatInputNode.data.settings as any)?.source;
        
        if (currentSource !== 'ask_user') {
          // Switch to ask_user mode
          const updatedNodes = nodes.map(n => {
            if (n.id === chatInputNode.id) {
              return {
                ...n,
                data: {
                  ...n.data,
                  settings: {
                    ...(n.data.settings as any),
                    source: 'ask_user',
                  },
                },
              };
            }
            return n;
          });
          setNodes(updatedNodes);
          takeSnapshot();
          showToast('Нода "Chat Input" переключена в режим "Ask User"', 'info');
        }
      } else {
        // No chat_input node found - show error
        showToast('Для публикации агента нужна нода "Chat Input" (Получить ввод из чата)', 'error');
        return;
      }

      // Create or update config
      if (existingConfig) {
        existingConfig.isPublished = true;
        saveAgentConfig(existingConfig);
      } else {
        createAgentConfig(
          graph.id,
          graph.name,
          graph.description || 'Агент без описания'
        );
      }

      setIsPublished(true);
      showToast('Агент опубликован! Доступен во вкладке "Агенты"', 'info');
    }
  }, [graph, nodes, setNodes, takeSnapshot, showToast]);

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

        {/* Toolbar — compact top bar */}
        <div className="absolute top-3 flex items-center gap-2 transition-all duration-300" style={{ 
          right: selectedNode ? 332 : 12, 
          zIndex: 40,
          background: 'rgba(14,14,18,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '4px 6px',
        }}>          {/* Save status */}
          {graph && (
            <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3, padding: '0 4px' }}>
              {saveStatus === 'saved' && <><CheckCircle2 size={10} style={{ color: '#34d399' }} /> Saved</>}
              {saveStatus === 'saving' && <><Loader2 size={10} className="animate-spin" /> Saving</>}
              {saveStatus === 'unsaved' && <><AlertCircle size={10} style={{ color: '#fbbf24' }} /> Unsaved</>}
            </span>
          )}

          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{ padding: '5px', fontSize: 11, background: 'none', border: 'none', color: canUndo ? '#94a3b8' : '#334155', cursor: canUndo ? 'pointer' : 'default', borderRadius: 6, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { if(canUndo) e.currentTarget.style.color = '#e2e8f0'; }}
            onMouseLeave={e => { if(canUndo) e.currentTarget.style.color = '#94a3b8'; }}
          >
            <Undo2 size={14} />
          </button>

          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y / Cmd+Shift+Z)"
            style={{ padding: '5px', fontSize: 11, background: 'none', border: 'none', color: canRedo ? '#94a3b8' : '#334155', cursor: canRedo ? 'pointer' : 'default', borderRadius: 6, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => { if(canRedo) e.currentTarget.style.color = '#e2e8f0'; }}
            onMouseLeave={e => { if(canRedo) e.currentTarget.style.color = '#94a3b8'; }}
          >
            <Redo2 size={14} />
          </button>

          <button
            onClick={onLayout}
            title="Auto Layout"
            style={{ padding: '5px 8px', fontSize: 11, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = '#a5b4fc'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <Wand2 size={14} />
            <span className="hidden lg:inline">Layout</span>
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border)', marginLeft: 2, marginRight: 2 }} />

          <button
            onClick={handleExportGraph}
            title="Export agent to .json"
            style={{ padding: '5px 8px', fontSize: 11, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <Download size={12} />
            Export
          </button>

          <button
            onClick={handleImportGraph}
            title="Import agent from .json"
            style={{ padding: '5px 8px', fontSize: 11, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          >
            <Upload size={12} />
            Import
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          {isRunning ? (
            <button
              onClick={handleStopExecution}
              style={{
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171',
                cursor: 'pointer',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Square size={11} />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRunGraph}
              style={{
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.25)',
                color: '#34d399',
                cursor: 'pointer',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Play size={11} />
              Run
            </button>
          )}

          <button
            id="save-graph-btn"
            onClick={handleSaveGraph}
            style={{
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#818cf8',
              cursor: 'pointer',
              borderRadius: 8,
            }}
          >
            Save
          </button>

          <button
            onClick={handleTogglePublish}
            title={isPublished ? 'Снять публикацию' : 'Опубликовать как агента'}
            style={{
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              background: isPublished ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
              border: isPublished ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(99,102,241,0.25)',
              color: isPublished ? '#34d399' : '#818cf8',
              cursor: 'pointer',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Rocket size={11} />
            {isPublished ? 'Опубликован ✓' : 'Опубликовать'}
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges.map(e => {
            const sourceNode = nodes.find(n => n.id === e.source);
            const targetNode = nodes.find(n => n.id === e.target);
            const sStatus = sourceNode?.data?.status;
            const tStatus = targetNode?.data?.status;

            if (tStatus === 'running') {
              return { ...e, animated: true, className: 'edge-executing', style: { stroke: '#818cf8', strokeWidth: 2 } };
            } else if (sStatus === 'success' && tStatus === 'success') {
              return { ...e, animated: false, style: { stroke: '#34d399', strokeWidth: 2 } };
            } else if (tStatus === 'error' || sStatus === 'error') {
              return { ...e, animated: false, style: { stroke: '#f87171', strokeWidth: 2 } };
            }
            return { ...e, animated: false, style: { stroke: 'rgba(99, 102, 241, 0.35)', strokeWidth: 2 } };
          })}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
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
            animated: false,
            style: { stroke: 'rgba(99, 102, 241, 0.35)', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8, color: 'rgba(99, 102, 241, 0.5)' },
          }}
        >
          <Controls className="bg-[var(--surface-3)] border-[var(--border)] fill-[var(--text-primary)] text-[var(--text-primary)] shadow-lg" />
          <Background gap={20} size={0.8} color="rgba(255,255,255,0.04)" />
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
          hasSidebar={!!selectedNode}
        />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>

      {showInputModal && pendingInputFields.length > 0 && (
        <RunInputModal
          fields={pendingInputFields}
          onConfirm={handleInputModalConfirm}
          onCancel={() => setShowInputModal(false)}
        />
      )}

      {feedbackRequest && (
        <FeedbackModal
          promptText={feedbackRequest.promptText}
          context={feedbackRequest.context}
          onSubmit={(feedback) => {
            feedbackRequest.resolve(feedback);
            setFeedbackRequest(null);
          }}
        />
      )}
    </div>
  );
};

export const AgentEditor = (props: AgentEditorProps) => {
  return (
    <ReactFlowProvider>
      <div className="w-full h-full bg-[var(--surface-0)] absolute inset-0 z-10 flex flex-col rounded-lg overflow-hidden border border-[var(--border)] m-2 shadow-2xl">
        <div className="flex items-center px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-1)]">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500/60"></span>
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
