import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { useNodeGraphStore, type GraphNode, type GraphEdge, type NodeGraphState } from '../../stores/nodeGraph.js';
import { NODE_DEFINITIONS } from '../../types/nodeGraph.js';
import type { NodeType } from '../../types/nodeGraph.js';
import { InputNode } from './nodes/InputNode.js';
import { OutputNode } from './nodes/OutputNode.js';
import { TrimNode } from './nodes/TrimNode.js';
import { CropNode } from './nodes/CropNode.js';
import { ResizeNode } from './nodes/ResizeNode.js';
import { TranscodeNode } from './nodes/TranscodeNode.js';
import { ConcatNode } from './nodes/ConcatNode.js';
import { BaseNode } from './nodes/BaseNode.js';
import { ResizeHandle } from './nodes/ResizeHandle.js';
import { ConnectionHandle } from './nodes/ConnectionHandle.js';
import { HandlePalette } from './HandlePalette.js';
import { Handle, Position } from '@xyflow/react';

function makeBaseNodeComponent(type: keyof typeof NODE_DEFINITIONS) {
  return function GenericNode(props: any) {
    const id = props.id;
    const config = props.data.config || {};
    const status = props.data.status || 'idle';
    const error = props.data.error;
    const store = useNodeGraphStore();

    const statusBorder =
      status === 'completed' ? 'border-green-500' :
      status === 'processing' ? 'border-blue-500' :
      status === 'error' ? 'border-red-500' :
      'border-slate-600';

    const def = NODE_DEFINITIONS[type];

    const updateConfig = (updates: Record<string, any>) => {
      store.updateNodeConfig(id, updates);
    };

    return (
      <div className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[200px] relative ${props.selected ? 'ring-2 ring-blue-400' : ''}`} style={{ touchAction: 'none' }}>
        {props.selected && (
        <ResizeHandle minWidth={200} selected={props.selected} />
        )}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
          <span className="text-lg">{def.icon}</span>
          <span className="font-semibold text-sm flex-1">{def.label}</span>
          {status === 'completed' && <span className="text-xs text-green-400">✓</span>}
          {status === 'processing' && <span className="text-xs text-blue-400 animate-pulse">●</span>}
          {status === 'error' && <span className="text-xs text-red-400">✗</span>}
        </div>

        {error && (
          <div className="px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="nodrag cursor-default px-3 py-2 space-y-2">
          <div className="text-xs text-slate-400">
            {getConfigSummary(type, config)}
          </div>
        </div>

        {def.inputs.map((port) => (
          <ConnectionHandle key={port.id} type="target" position={Position.Left} id={port.id} portType={port.type} />
        ))}
        {def.outputs.map((port) => (
          <ConnectionHandle key={port.id} type="source" position={Position.Right} id={port.id} portType={port.type} />
        ))}
      </div>
    );
  };
}

function getConfigSummary(type: keyof typeof NODE_DEFINITIONS, config: Record<string, any>): string {
  switch (type) {
    case 'filter': return 'Adjustments';
    case 'speed': return `${config.speed ?? 1}x`;
    case 'rotate': return `${config.angle ?? 90}°`;
    case 'flip': return config.direction || 'horizontal';
    case 'concat': return 'Join videos';
    case 'watermark': return config.position || 'bottom-right';
    case 'pip': return 'PiP overlay';
    case 'audioExtract': return config.audioCodec || 'mp3';
    case 'gif': return `${config.fps ?? 10}fps`;
    case 'reverse': return config.videoOnly ? 'Video only' : 'Video+Audio';
    case 'loop': return `${config.count ?? 2}× loop`;
    case 'subtitle': return 'Burn subtitles';
    default: return NODE_DEFINITIONS[type]?.label || 'Configure';
  }
}

const nodeTypes: NodeTypes = {
  fileInput: InputNode,
  fileOutput: OutputNode,
  trim: TrimNode,
  crop: CropNode,
  resize: ResizeNode,
  transcode: TranscodeNode,
  concat: ConcatNode,
  filter: makeBaseNodeComponent('filter'),
  speed: makeBaseNodeComponent('speed'),
  rotate: makeBaseNodeComponent('rotate'),
  flip: makeBaseNodeComponent('flip'),
  watermark: makeBaseNodeComponent('watermark'),
  pip: makeBaseNodeComponent('pip'),
  audioExtract: makeBaseNodeComponent('audioExtract'),
  gif: makeBaseNodeComponent('gif'),
  reverse: makeBaseNodeComponent('reverse'),
  loop: makeBaseNodeComponent('loop'),
  subtitle: makeBaseNodeComponent('subtitle'),
};

function ValidatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: any) {
  const edgePath = `M${sourceX},${sourceY} C${sourceX + 50},${sourceY} ${targetX - 50},${targetY} ${targetX},${targetY}`;
  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      strokeWidth={2}
      stroke="#60a5fa"
      fill="none"
      markerEnd={markerEnd}
    />
  );
}

const edgeTypes: EdgeTypes = {
  default: ValidatedEdge,
};

interface FileItem {
  id: string;
  filename: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  size: number;
}

interface NodeCanvasProps {
  sessionId: string;
  files: FileItem[];
  onFileUpload: (file: File) => Promise<any>;
}

interface HandlePaletteState {
  position: { x: number; y: number };
  portType: 'video' | 'audio' | 'image';
  direction: 'source' | 'target';
  currentNodeType?: string;
  mode: 'click' | 'drag-abandon';
  sourceNodeId?: string;
  sourceHandleId?: string;
  targetNodeId?: string;
  targetHandleId?: string;
}

interface FlowInnerDataProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any[]) => void;
  onEdgesChange: (changes: any[]) => void;
  onConnect: (params: Connection) => void;
  onConnectStart: (_event: any, params: any) => void;
  onNodeClick: (_event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onNodeDragStop: (_event: React.MouseEvent, node: Node) => void;
  onNodesDelete: (deletedNodes: Node[]) => void;
  onEdgesDelete: (deletedEdges: Edge[]) => void;
  handlePalette: HandlePaletteState | null;
  setHandlePalette: React.Dispatch<React.SetStateAction<HandlePaletteState | null>>;
  store: NodeGraphState;
  storeEdges: GraphEdge[];
  pendingConnectionRef: React.MutableRefObject<{
    portType: 'video' | 'audio' | 'image';
    direction: 'source' | 'target';
    currentNodeType?: string;
    sourceNodeId?: string;
    sourceHandleId?: string;
    targetNodeId?: string;
    targetHandleId?: string;
  } | null>;
}

function FlowWithProvider(props: FlowInnerDataProps) {
  return (
    <ReactFlowProvider>
      <FlowInner {...props} />
    </ReactFlowProvider>
  );
}

function FlowInner({
  nodes, edges, onNodesChange, onEdgesChange, onConnect, onConnectStart,
  onNodeClick, onPaneClick, onNodeDragStop, onNodesDelete, onEdgesDelete,
  handlePalette, setHandlePalette, store, storeEdges, pendingConnectionRef,
}: FlowInnerDataProps) {
  const { screenToFlowPosition } = useReactFlow();
  const handlePaletteRef = useRef(handlePalette);
  handlePaletteRef.current = handlePalette;
  const justEndedConnection = useRef(false);

  const handleConnectEnd = useCallback((event: any) => {
    const pending = pendingConnectionRef.current;
    if (!pending) return;

    const targetWasHit = event?.target?.classList?.contains('react-flow__handle');
    if (targetWasHit) {
      pendingConnectionRef.current = null;
      return;
    }

    const screenX = event.clientX - 20;
    const screenY = event.clientY - 40;

    justEndedConnection.current = true;
    setHandlePalette({
      position: { x: screenX, y: screenY },
      ...pending,
      mode: 'drag-abandon',
    });
    pendingConnectionRef.current = null;
  }, [setHandlePalette, pendingConnectionRef]);

  const handlePaneClick = useCallback(() => {
    if (justEndedConnection.current) {
      justEndedConnection.current = false;
      return;
    }
    onPaneClick();
  }, [onPaneClick]);

  const handlePaletteSelect = useCallback((nodeType: NodeType) => {
    const palette = handlePaletteRef.current;
    if (!palette) return;

    const def = NODE_DEFINITIONS[nodeType];
    if (!def) return;

    const flowPos = screenToFlowPosition(palette.position);

    const newNodeId = crypto.randomUUID();
    const newNode = {
      id: newNodeId,
      type: nodeType,
      position: flowPos,
      data: { config: { ...def.defaultConfig }, status: 'idle' as const, definition: def },
    };
    store.addNode(newNode);

    if (palette.direction === 'source' && palette.sourceNodeId && palette.sourceHandleId) {
      const compatibleInput = def.inputs.find(p => p.type === palette.portType);
      if (compatibleInput) {
        const newEdge: GraphEdge = {
          id: `${palette.sourceNodeId}-${newNodeId}-${palette.sourceHandleId}-${compatibleInput.id}`,
          source: palette.sourceNodeId,
          target: newNodeId,
          sourceHandle: palette.sourceHandleId,
          targetHandle: compatibleInput.id,
          type: palette.portType,
        };
        store.addEdge(newEdge);
      }
    } else if (palette.direction === 'target' && palette.targetNodeId && palette.targetHandleId) {
      const compatibleOutput = def.outputs.find(p => p.type === palette.portType);
      if (compatibleOutput) {
        const newEdge: GraphEdge = {
          id: `${newNodeId}-${palette.targetNodeId}-${compatibleOutput.id}-${palette.targetHandleId}`,
          source: newNodeId,
          target: palette.targetNodeId,
          sourceHandle: compatibleOutput.id,
          targetHandle: palette.targetHandleId,
          type: palette.portType,
        };
        store.addEdge(newEdge);
      }
    }

    setHandlePalette(null);
  }, [screenToFlowPosition, store, setHandlePalette]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={4}
        attributionPosition="bottom-left"
        defaultEdgeOptions={{
          animated: true,
          style: { stroke: '#60a5fa', strokeWidth: 2 },
        }}
        connectionLineStyle={{ stroke: '#60a5fa', strokeWidth: 2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="!bg-slate-800 !border-slate-700 !shadow-lg" />
        <MiniMap
          nodeColor={() => '#3b82f6'}
          className="!bg-slate-800 !border-slate-700"
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
      {handlePalette && (
        <HandlePalette
          position={handlePalette.position}
          portType={handlePalette.portType}
          direction={handlePalette.direction}
          currentNodeType={handlePalette.currentNodeType}
          onSelect={handlePaletteSelect}
          onClose={() => setHandlePalette(null)}
        />
      )}
    </>
  );
}

function FlowContent({ sessionId, files, onFileUpload, storeNodes, storeEdges }: {
  sessionId: string;
  files: FileItem[];
  onFileUpload: (file: File) => Promise<any>;
  storeNodes: GraphNode[];
  storeEdges: GraphEdge[];
}) {
  const store = useNodeGraphStore();

  const [handlePalette, setHandlePalette] = useState<HandlePaletteState | null>(null);
  const pendingConnectionRef = useRef<{
    portType: 'video' | 'audio' | 'image';
    direction: 'source' | 'target';
    currentNodeType?: string;
    sourceNodeId?: string;
    sourceHandleId?: string;
    targetNodeId?: string;
    targetHandleId?: string;
  } | null>(null);

  const rfNodes: Node[] = useMemo(
    () => {
      const resolveFileId = (nodeId: string): string | undefined => {
        const node = storeNodes.find(n => n.id === nodeId);
        if (!node) return undefined;
        if (node.type === 'fileInput') return node.data?.config?.fileId;
        const inputEdge = storeEdges.find(e => e.target === nodeId && e.targetHandle === 'video');
        if (inputEdge) {
          const sourceNode = storeNodes.find(n => n.id === inputEdge.source);
          if (sourceNode?.data?.outputId) return sourceNode.data.outputId;
          return resolveFileId(inputEdge.source);
        }
        return node.data?.config?.fileId;
      };

      return storeNodes.map((n) => {
        if (!n.data) {
          return {
            id: n.id,
            type: n.type,
            position: n.position,
            data: { config: {} },
          };
        }

        const fileId = n.type === 'fileInput' ? n.data.config?.fileId : resolveFileId(n.id);

        return {
          id: n.id,
          type: n.type,
          position: n.position,
          ...(n.width && n.height ? { width: n.width, height: n.height } : {}),
          data: {
            ...n.data,
            sessionId,
            config: {
              ...n.data.config,
              fileId,
            },
            files,
            onFileUpload,
          },
        };
      });
    },
    [storeNodes, storeEdges, files, onFileUpload, sessionId]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      storeEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        animated: true,
        style: { stroke: '#60a5fa', strokeWidth: 2 },
      })),
    [storeEdges]
  );

  const rfNodesKey = useMemo(() => JSON.stringify(rfNodes), [rfNodes]);
  const rfEdgesKey = useMemo(() => JSON.stringify(rfEdges), [rfEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  const handleNodesChange = useCallback(
    (changes: any[]) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions) {
          store.updateNodeSize(change.id, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          });
        }
      }
    },
    [onNodesChange, store]
  );

  useEffect(() => {
    setNodes(rfNodes);
  }, [rfNodesKey, setNodes]);

  useEffect(() => {
    setEdges(rfEdges);
  }, [rfEdgesKey, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const target = params.target!;
      const targetHandle = params.targetHandle!;

      const edgesToRemove = storeEdges.filter(
        (e) => e.target === target && e.targetHandle === targetHandle
      );
      for (const edge of edgesToRemove) {
        store.removeEdge(edge.id);
      }

      const newEdge: GraphEdge = {
        id: `${params.source}-${params.target}-${params.sourceHandle}-${params.targetHandle}`,
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle!,
        targetHandle: params.targetHandle!,
        type: 'video',
      };
      store.addEdge(newEdge);
      setEdges((eds) => {
        let updated = eds.filter(
          (e) => !(e.target === target && e.targetHandle === targetHandle)
        );
        return addEdge(
          { ...params, animated: true, style: { stroke: '#60a5fa', strokeWidth: 2 } },
          updated
        );
      });
    },
    [store, storeEdges, setEdges]
  );

  const onConnectStart = useCallback((_event: any, params: any) => {
    if (params?.nodeId && params?.handleId && params?.handleType) {
      const sourceNode = storeNodes.find(n => n.id === params.nodeId);
      pendingConnectionRef.current = {
        portType: 'video',
        direction: params.handleType as 'source' | 'target',
        currentNodeType: sourceNode?.type,
        sourceNodeId: params.handleType === 'source' ? params.nodeId : undefined,
        sourceHandleId: params.handleType === 'source' ? params.handleId : undefined,
        targetNodeId: params.handleType === 'target' ? params.nodeId : undefined,
        targetHandleId: params.handleType === 'target' ? params.handleId : undefined,
      };
    }
  }, [storeNodes]);

  const handleHandleClick = useCallback((info: { handleId: string; portType: string; type: 'source' | 'target' }, screenPosition: { x: number; y: number }) => {
    const sourceNode = storeNodes.find(n => {
      const def = NODE_DEFINITIONS[n.type];
      if (!def) return false;
      if (info.type === 'source') {
        return def.outputs.some(p => p.id === info.handleId);
      }
      return def.inputs.some(p => p.id === info.handleId);
    });

    setHandlePalette({
      position: { x: screenPosition.x + 200, y: screenPosition.y },
      portType: info.portType as 'video' | 'audio' | 'image',
      direction: info.type,
      currentNodeType: sourceNode?.type,
      mode: 'click',
      sourceNodeId: info.type === 'source' ? sourceNode?.id : undefined,
      sourceHandleId: info.type === 'source' ? info.handleId : undefined,
      targetNodeId: info.type === 'target' ? sourceNode?.id : undefined,
      targetHandleId: info.type === 'target' ? info.handleId : undefined,
    });
  }, [storeNodes]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      store.selectNode(node.id);
    },
    [store]
  );

  const onPaneClick = useCallback(() => {
    store.selectNode(null);
    setHandlePalette(null);
  }, [store]);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      store.updateNodePosition(node.id, node.position);
    },
    [store]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      for (const node of deletedNodes) {
        store.removeNode(node.id);
      }
    },
    [store]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        store.removeEdge(edge.id);
      }
    },
    [store]
  );

  const nodesWithHandleCallbacks = useMemo(() => {
    return nodes.map(node => {
      const nodeDef = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
      if (!nodeDef) return node;
      return {
        ...node,
        data: {
          ...node.data,
          onHandleClick: handleHandleClick,
          nodeType: node.type,
        },
      };
    });
  }, [nodes, handleHandleClick]);

  return (
    <FlowWithProvider
      nodes={nodesWithHandleCallbacks}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectStart={onConnectStart}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onNodeDragStop={onNodeDragStop}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      handlePalette={handlePalette}
      setHandlePalette={setHandlePalette}
      store={store}
      storeEdges={storeEdges}
      pendingConnectionRef={pendingConnectionRef}
    />
  );
}

export default function NodeCanvas({ sessionId, files, onFileUpload }: NodeCanvasProps) {
  const store = useNodeGraphStore();
  const storeNodes = store.nodes;
  const storeEdges = store.edges;

  return (
    <div className="flex-1 h-full">
      <FlowContent
        sessionId={sessionId}
        files={files}
        onFileUpload={onFileUpload}
        storeNodes={storeNodes}
        storeEdges={storeEdges}
      />
    </div>
  );
}
