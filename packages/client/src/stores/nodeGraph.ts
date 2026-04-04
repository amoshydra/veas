import { create } from 'zustand';
import type {
  NodeType,
  NodeDefinition,
  NodeCategory,
} from '../types/nodeGraph.js';

// React Flow node/edge types
export interface GraphNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  data: {
    config: Record<string, any>;
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'error';
    error?: string;
    outputId?: string;
    definition: NodeDefinition;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  type: 'video' | 'audio' | 'image';
}

interface NodeGraphState {
  sessionId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isPaletteOpen: boolean;
  isPropsOpen: boolean;
  executionId: string | null;
  pipelineProgress: Record<string, { status: string; progress: number }>;

  setSessionId: (id: string) => void;
  addNode: (node: GraphNode) => void;
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  updateNodeConfig: (id: string, config: Record<string, any>) => void;
  updateNodeStatus: (id: string, status: string, outputId?: string, error?: string) => void;
  updateNodeSize: (id: string, dimensions: { width: number; height: number }) => void;
  addEdge: (edge: GraphEdge) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  togglePalette: () => void;
  toggleProps: () => void;
  setExecutionId: (id: string | null) => void;
  setPipelineProgress: (nodeId: string, progress: { status: string; progress: number }) => void;
  clearGraph: () => void;
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
}

export const useNodeGraphStore = create<NodeGraphState>((set) => ({
  sessionId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  isPaletteOpen: true,
  isPropsOpen: true,
  executionId: null,
  pipelineProgress: {},

  setSessionId: (id) => set({ sessionId: id }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      selectedNodeId: node.id,
    })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId:
        state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  updateNodePosition: (id, position) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, position } : n
      ),
    })),

  updateNodeConfig: (id, config) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } }
          : n
      ),
    })),

  updateNodeSize: (id, dimensions) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, width: dimensions.width, height: dimensions.height } : n
      ),
    })),

  updateNodeStatus: (id, status, outputId, error) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                status: status as any,
                outputId,
                error,
              },
            }
          : n
      ),
    })),

  addEdge: (edge) =>
    set((state) => {
      const exists = state.edges.some(
        (e) =>
          e.source === edge.source &&
          e.target === edge.target &&
          e.sourceHandle === edge.sourceHandle &&
          e.targetHandle === edge.targetHandle
      );
      if (exists) return state;
      return {
        edges: [...state.edges, edge],
        selectedEdgeId: edge.id,
      };
    }),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      selectedEdgeId:
        state.selectedEdgeId === id ? null : state.selectedEdgeId,
    })),

  selectNode: (id) =>
    set({
      selectedNodeId: id,
      selectedEdgeId: id === null ? null : undefined,
      isPropsOpen: id !== null ? true : undefined,
    }),

  selectEdge: (id) =>
    set({
      selectedEdgeId: id,
      selectedNodeId: id === null ? null : undefined,
    }),

  togglePalette: () =>
    set((state) => ({ isPaletteOpen: !state.isPaletteOpen })),

  toggleProps: () => set((state) => ({ isPropsOpen: !state.isPropsOpen })),

  setExecutionId: (id) => set({ executionId: id }),

  setPipelineProgress: (nodeId, progress) =>
    set((state) => ({
      pipelineProgress: { ...state.pipelineProgress, [nodeId]: progress },
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                status: progress.status as any,
              },
            }
          : n
      ),
    })),

  clearGraph: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      executionId: null,
      pipelineProgress: {},
    }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}));
