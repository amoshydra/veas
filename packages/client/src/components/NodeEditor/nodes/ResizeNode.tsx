import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useState } from 'react';
import { useNodeGraphStore } from '../../../stores/nodeGraph.js';

export function ResizeNode({ id, data, selected }: NodeProps) {
  const config = data.config as Record<string, any>;
  const status = data.status as string;
  const error = data.error as string | undefined;
  const [showConfig, setShowConfig] = useState(false);
  const store = useNodeGraphStore();

  const statusBorder =
    status === 'completed' ? 'border-green-500' :
    status === 'processing' ? 'border-blue-500' :
    status === 'error' ? 'border-red-500' :
    'border-slate-600';

  const updateConfig = (updates: Record<string, any>) => {
    store.updateNodeConfig(id, updates);
  };

  return (
    <div
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[200px] ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <NodeResizer
        minWidth={200}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="bg-blue-400 w-2 h-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        className="!w-3 !h-3 !rounded-full bg-blue-400 !border-2 !border-slate-900"
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">📐</span>
        <span className="font-semibold text-sm flex-1">Resize</span>
        <button
          onClick={(e) => { e.stopPropagation(); setShowConfig(!showConfig); }}
          className="text-xs text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-700"
        >
          {showConfig ? '▲' : '▼'}
        </button>
        {status === 'completed' && <span className="text-xs text-green-400">✓</span>}
        {status === 'processing' && <span className="text-xs text-blue-400 animate-pulse">●</span>}
        {status === 'error' && <span className="text-xs text-red-400">✗</span>}
      </div>

      {!showConfig && (
        <div className="px-3 py-2 text-xs text-slate-400 cursor-default">
          {error ? (
            <div className="text-red-400 truncate">{error}</div>
          ) : (
            <span>{config.width ?? 'auto'}×{config.height ?? 'auto'}</span>
          )}
        </div>
      )}

      {showConfig && (
        <div className="nodrag cursor-default px-3 py-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Width</label>
              <input
                type="number"
                min={1}
                value={config.width ?? 1280}
                onChange={(e) => updateConfig({ width: parseInt(e.target.value) || 1 })}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Height</label>
              <input
                type="number"
                min={1}
                value={config.height ?? 720}
                onChange={(e) => updateConfig({ height: parseInt(e.target.value) || 1 })}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="video"
        className="!w-3 !h-3 !rounded-full bg-blue-400 !border-2 !border-slate-900"
      />
    </div>
  );
}
