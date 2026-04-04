import { create } from 'zustand';
import type { NodeType, NodeDefinition } from '../types/nodeGraph.js';

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
    cachePath?: string;
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

export interface NodeGraphState {
  sessionId: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isPaletteOpen: boolean;
  isPropsOpen: boolean;
  executionId: string | null;
  pipelineProgress: Record<string, { status: string; progress: number }>;
  autoSave: () => void;

  setSessionId: (id: string) => void;
  addNode: (node: GraphNode) => void;
  removeNode: (id: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  updateNodeConfig: (id: string, config: Record<string, any>) => void;
  updateNodeStatus: (id: string, status: string, outputId?: string, error?: string, cachePath?: string) => void;
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

export const useNodeGraphStore = create<NodeGraphState>((set, get) => {
  const saveGraph = (sessionId: string | null, nodes: GraphNode[], edges: GraphEdge[]) => {
    if (!sessionId) return;
    const nodesToSave = (nodes as any[]).map(n => ({
      ...n,
      position: n.position || { x: 100, y: 100 },
      config: n.data?.config,
    }));
    const connectionsToSave = edges.map(e => ({
      id: e.id,
      fromNode: e.source,
      fromPort: e.sourceHandle,
      toNode: e.target,
      toPort: e.targetHandle,
    }));
    fetch(`/api/pipelines/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, nodes: nodesToSave, connections: connectionsToSave, viewport: '{}' })
    }).catch(err => console.error('Auto-save failed:', err));
  };

  return {
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

    autoSave: () => {
      const state = get();
      saveGraph(state.sessionId, state.nodes, state.edges);
    },

    addNode: (node) =>
      set((state) => {
        const newNodes = [...state.nodes, node];
        setTimeout(() => saveGraph(state.sessionId, newNodes, state.edges), 100);
        return { nodes: newNodes, selectedNodeId: node.id };
      }),

    removeNode: (id) =>
      set((state) => {
        const newNodes = state.nodes.filter((n) => n.id !== id);
        const newEdges = state.edges.filter((e) => e.source !== id && e.target !== id);
        setTimeout(() => saveGraph(state.sessionId, newNodes, newEdges), 100);
        return { nodes: newNodes, edges: newEdges, selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId };
      }),

    updateNodePosition: (id, position) =>
      set((state) => {
        const newNodes = state.nodes.map((n) => (n.id === id ? { ...n, position } : n));
        setTimeout(() => saveGraph(state.sessionId, newNodes, state.edges), 100);
        return { nodes: newNodes };
      }),

    updateNodeConfig: (id, config) =>
      set((state) => {
        const newNodes = state.nodes.map((n) =>
          n.id === id
            ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } }
            : n
        );
        setTimeout(() => saveGraph(state.sessionId, newNodes, state.edges), 100);
        return { nodes: newNodes };
      }),

    updateNodeSize: (id, dimensions) =>
      set((state) => {
        const newNodes = state.nodes.map((n) =>
          n.id === id ? { ...n, width: dimensions.width, height: dimensions.height } : n
        );
        setTimeout(() => saveGraph(state.sessionId, newNodes, state.edges), 100);
        return { nodes: newNodes };
      }),

    updateNodeStatus: (id, status, outputId?, error?, cachePath?) =>
      set((state) => {
        const newNodes = state.nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: status as any,
                  outputId,
                  cachePath,
                  error,
                },
              }
            : n
        );
        setTimeout(() => saveGraph(state.sessionId, newNodes, state.edges), 100);
        return { nodes: newNodes };
      }),

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
        const newEdges = [...state.edges, edge];
        setTimeout(() => saveGraph(state.sessionId, state.nodes, newEdges), 100);
        return { edges: newEdges, selectedEdgeId: edge.id };
      }),

    removeEdge: (id) =>
      set((state) => {
        const newEdges = state.edges.filter((e) => e.id !== id);
        setTimeout(() => saveGraph(state.sessionId, state.nodes, newEdges), 100);
        return { edges: newEdges, selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId };
      }),

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

    setNodes: (nodes) => {
      const valid = (nodes as any[]).map(n => ({
        ...n,
        position: n.position || { x: 100, y: 100 },
        data: n.data || { config: n.config || {}, status: 'idle' as const }
      }));
      set({ nodes: valid });
    },
    setEdges: (edges) => {
      const normalized = (edges as any[]).map(e => ({
        id: e.id,
        source: e.fromNode || e.source,
        target: e.toNode || e.target,
        sourceHandle: e.fromPort || e.sourceHandle,
        targetHandle: e.toPort || e.targetHandle,
        type: e.type || 'video',
      }));
      set({ edges: normalized });
    },
  };
});
