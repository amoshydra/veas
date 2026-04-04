import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { useNodeGraphStore } from '../../stores/nodeGraph.js';
import NodeCanvas from './NodeCanvas.js';
import NodePalette from './NodePalette.js';
import { v4 as uuidv4 } from 'uuid';

interface FileItem {
  id: string;
  filename: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  size: number;
}

export default function NodeEditor() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const store = useNodeGraphStore();
  const [isExecuting, setIsExecuting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      store.setSessionId(sessionId);
      api.getNodeGraph(sessionId).then((graph) => {
        if (graph.nodes && graph.nodes.length > 0) {
          store.setNodes(graph.nodes);
          store.setEdges(graph.connections || []);
        }
      }).catch(err => console.error('[NodeEditor] Error loading graph:', err));
    }
  }, [sessionId]);

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['files', sessionId],
    queryFn: () => api.listFiles(sessionId!),
    enabled: !!sessionId,
  });

  const files = (filesData || []) as FileItem[];

  const handleExecuteAll = useCallback(async () => {
    if (!sessionId || store.nodes.length === 0) return;

    // Validate graph
    const inputNodes = store.nodes.filter((n) => n.type === 'fileInput');
    const outputNodes = store.nodes.filter((n) => n.type === 'fileOutput');

    if (inputNodes.length === 0) {
      setExecutionError('Add an Input node with a video file');
      return;
    }

    // Output node is optional - can preview intermediate results
    // if (outputNodes.length === 0) {
    //   setExecutionError('Add an Output node to save the result');
    //   return;
    // }

    const missingFile = inputNodes.find((n) => !n.data.config.fileId);
    if (missingFile) {
      setExecutionError('Select a video file in the Input node');
      return;
    }

    if (store.edges.length === 0) {
      setExecutionError('Connect nodes by dragging from output ports to input ports');
      return;
    }

    setExecutionError(null);
    setIsExecuting(true);
    try {
      const nodes = store.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        config: n.data.config,
      }));
      const connections = store.edges.map((e) => ({
        id: e.id,
        fromNode: e.source,
        fromPort: e.sourceHandle,
        toNode: e.target,
        toPort: e.targetHandle,
      }));

      for (const node of nodes) {
        store.updateNodeStatus(node.id, 'queued');
      }

      const result = await api.executePipeline(sessionId, nodes, connections);

      if (result.error) {
        setExecutionError(result.error);
        setIsExecuting(false);
      } else {
        const pipelineId = result.pipelineId;
        const eventSource = new EventSource(`/api/pipelines/stream/${pipelineId}`);
        let completedCount = 0;
        const totalNodes = nodes.length;

        const finishExecution = () => {
          eventSource.close();
          setIsExecuting(false);
          queryClient.invalidateQueries({ queryKey: ['files', sessionId] });
          queryClient.invalidateQueries({ queryKey: ['jobs', sessionId] });
        };

        eventSource.addEventListener('nodeComplete', (e) => {
          const data = JSON.parse(e.data);
          store.updateNodeStatus(data.nodeId, data.status, data.outputFile, undefined, data.cachePath);
          completedCount++;
          if (completedCount >= totalNodes) {
            finishExecution();
          }
        });

        eventSource.addEventListener('nodeError', (e) => {
          const data = JSON.parse(e.data);
          store.updateNodeStatus(data.nodeId, 'error', undefined, data.error);
          setExecutionError(data.error);
          finishExecution();
        });

        eventSource.addEventListener('error', () => {
          eventSource.close();
          setIsExecuting(false);
        });
      }
    } catch (err: any) {
      setExecutionError(err.message || 'Pipeline execution failed');
      console.error('Pipeline execution failed:', err);
      setIsExecuting(false);
    }
  }, [sessionId, store, queryClient]);

  const handleSaveGraph = useCallback(async () => {
    if (!sessionId) return;
    const nodesWithPosition = (store.nodes as any[]).map(n => ({
      ...n,
      position: n.position || { x: 100, y: 100 },
      config: n.data?.config || n.config,
      data: n.data || { config: {}, status: 'idle' as const }
    }));
    const connectionsWithLegacy = store.edges.map(e => ({
      id: e.id,
      fromNode: e.source,
      fromPort: e.sourceHandle,
      toNode: e.target,
      toPort: e.targetHandle,
    }));
    await api.saveNodeGraph(sessionId, {
      nodes: nodesWithPosition,
      connections: connectionsWithLegacy,
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  }, [sessionId, store]);

  const handleClearGraph = useCallback(() => {
    store.clearGraph();
    setDeleteConfirm(null);
  }, [store]);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-3">
          <a href="/" className="text-slate-400 text-sm hover:text-slate-300">
            Back
          </a>
          <h1 className="font-bold text-sm">Node Editor</h1>
          <span className="text-xs text-slate-500">
            {sessionId?.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {store.nodes.length > 0 && (
            <button
              onClick={() => setDeleteConfirm('graph')}
              className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/30 rounded transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleExecuteAll}
            disabled={isExecuting || store.nodes.length === 0}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded font-medium transition-colors"
          >
            {isExecuting ? 'Executing...' : 'Execute All'}
          </button>
        </div>
      </header>

      {executionError && (
        <div className="px-3 py-2 bg-red-900/50 border-b border-red-700 text-red-300 text-xs flex items-center justify-between">
          <span>{executionError}</span>
          <button onClick={() => setExecutionError(null)} className="text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <NodePalette />

        <NodeCanvas
          sessionId={sessionId!}
          files={files}
          onFileUpload={async (file: File) => {
            if (sessionId) {
              const uploaded = await api.uploadFile(sessionId, file);
              queryClient.invalidateQueries({ queryKey: ['files', sessionId] });
              return uploaded;
            }
          }}
        />
      </div>

      {/* Upload area when no files */}
      {files.length === 0 && !filesLoading && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <label className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-slate-500 transition-colors shadow-lg">
            <input
              type="file"
              accept="video/*,audio/*,image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file && sessionId) {
                  await api.uploadFile(sessionId, file);
                  queryClient.invalidateQueries({ queryKey: ['files', sessionId] });
                }
              }}
            />
            <span className="text-slate-400 text-sm">📁 Upload a file to get started</span>
          </label>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-slate-800 rounded-xl p-5 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold">Clear Graph</h2>
            <p className="text-sm text-slate-300">
              Remove all nodes and connections? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearGraph}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded font-medium text-sm transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
