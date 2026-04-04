import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useMemo, useEffect } from 'react';
import { useNodeGraphStore, type GraphNode, type GraphEdge } from '../../stores/nodeGraph.js';
import { NODE_DEFINITIONS } from '../../types/nodeGraph.js';
import { InputNode } from './nodes/InputNode.js';
import { OutputNode } from './nodes/OutputNode.js';
import { TrimNode } from './nodes/TrimNode.js';
import { CropNode } from './nodes/CropNode.js';
import { ResizeNode } from './nodes/ResizeNode.js';
import { TranscodeNode } from './nodes/TranscodeNode.js';
import { BaseNode } from './nodes/BaseNode.js';
import { ResizeHandle } from './nodes/ResizeHandle.js';

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
          <Handle key={port.id} type="target" position={Position.Left} id={port.id}
            className={`!w-3 !h-3 !rounded-full ${port.type === 'video' ? 'bg-blue-400' : port.type === 'audio' ? 'bg-purple-400' : 'bg-green-400'} !border-2 !border-slate-900`} />
        ))}
        {def.outputs.map((port) => (
          <Handle key={port.id} type="source" position={Position.Right} id={port.id}
            className={`!w-3 !h-3 !rounded-full ${port.type === 'video' ? 'bg-blue-400' : port.type === 'audio' ? 'bg-purple-400' : 'bg-green-400'} !border-2 !border-slate-900`} />
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

function InlineConfig({ type, config, updateConfig }: {
  type: keyof typeof NODE_DEFINITIONS;
  config: Record<string, any>;
  updateConfig: (updates: Record<string, any>) => void;
}) {
  switch (type) {
    case 'filter':
      return (
        <>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Brightness: {config.brightness ?? 0}</label>
            <input type="range" min={-1} max={1} step={0.01} value={config.brightness ?? 0}
              onChange={(e) => updateConfig({ brightness: parseFloat(e.target.value) })}
              className="w-full accent-blue-500" onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Contrast: {config.contrast ?? 1}</label>
            <input type="range" min={0} max={3} step={0.01} value={config.contrast ?? 1}
              onChange={(e) => updateConfig({ contrast: parseFloat(e.target.value) })}
              className="w-full accent-blue-500" onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Saturation: {config.saturation ?? 1}</label>
            <input type="range" min={0} max={3} step={0.01} value={config.saturation ?? 1}
              onChange={(e) => updateConfig({ saturation: parseFloat(e.target.value) })}
              className="w-full accent-blue-500" onClick={(e) => e.stopPropagation()} />
          </div>
        </>
      );
    case 'speed':
      return (
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Speed: {config.speed ?? 1}x</label>
          <input type="range" min={0.25} max={4} step={0.25} value={config.speed ?? 1}
            onChange={(e) => updateConfig({ speed: parseFloat(e.target.value) })}
            className="w-full accent-blue-500" onClick={(e) => e.stopPropagation()} />
        </div>
      );
    case 'rotate':
      return (
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Angle</label>
          <select value={config.angle ?? 90}
            onChange={(e) => updateConfig({ angle: parseInt(e.target.value) })}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            onClick={(e) => e.stopPropagation()}>
            <option value={90}>90° Clockwise</option>
            <option value={180}>180°</option>
            <option value={270}>90° Counter-clockwise</option>
          </select>
        </div>
      );
    case 'flip':
      return (
        <div className="space-y-1">
          <label className="text-[10px] text-slate-500">Direction</label>
          <select value={config.direction || 'horizontal'}
            onChange={(e) => updateConfig({ direction: e.target.value })}
            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            onClick={(e) => e.stopPropagation()}>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </div>
      );
    default:
      return <div className="text-[10px] text-slate-500">No configurable options</div>;
  }
}

import { Handle, Position } from '@xyflow/react';

const nodeTypes: NodeTypes = {
  fileInput: InputNode,
  fileOutput: OutputNode,
  trim: TrimNode,
  crop: CropNode,
  resize: ResizeNode,
  transcode: TranscodeNode,
  filter: makeBaseNodeComponent('filter'),
  speed: makeBaseNodeComponent('speed'),
  rotate: makeBaseNodeComponent('rotate'),
  flip: makeBaseNodeComponent('flip'),
  concat: makeBaseNodeComponent('concat'),
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

export default function NodeCanvas({ sessionId, files, onFileUpload }: NodeCanvasProps) {
  const store = useNodeGraphStore();

  const storeNodes = store.nodes;
  const storeEdges = store.edges;

  const rfNodes: Node[] = useMemo(
    () =>
      storeNodes.map((n) => {
        let fileId = n.data.config.fileId;
        
        if (!fileId && n.type !== 'fileInput') {
          const inputEdge = storeEdges.find(
            (e) => e.target === n.id && e.targetHandle === 'video'
          );
          if (inputEdge) {
            const sourceNode = storeNodes.find(
              (src) => src.id === inputEdge.source
            );
            if (sourceNode?.data?.config?.fileId) {
              fileId = sourceNode.data.config.fileId;
            }
            if (sourceNode?.data?.outputId) {
              fileId = sourceNode.data.outputId;
            }
          }
        }

        return {
          id: n.id,
          type: n.type,
          position: n.position,
          ...(n.width && n.height ? { width: n.width, height: n.height } : {}),
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              fileId,
            },
            files,
            onFileUpload,
          },
        };
      }),
    [storeNodes, storeEdges, files, onFileUpload]
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
      const newEdge: GraphEdge = {
        id: `${params.source}-${params.target}-${params.sourceHandle}-${params.targetHandle}`,
        source: params.source!,
        target: params.target!,
        sourceHandle: params.sourceHandle!,
        targetHandle: params.targetHandle!,
        type: 'video',
      };
      store.addEdge(newEdge);
      setEdges((eds) => addEdge(
        { ...params, animated: true, style: { stroke: '#60a5fa', strokeWidth: 2 } },
        eds
      ));
    },
    [store, setEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      store.selectNode(node.id);
    },
    [store]
  );

  const onPaneClick = useCallback(() => {
    store.selectNode(null);
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

  const onNodeResize = useCallback(
    (_event: any, node: Node) => {
      if (node.width && node.height) {
        store.updateNodeSize(node.id, { width: node.width, height: node.height });
      }
    },
    [store]
  );

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={['Backspace', 'Delete']}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
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
    </div>
  );
}
