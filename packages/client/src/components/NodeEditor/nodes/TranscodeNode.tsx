import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useState } from 'react';
import { useNodeGraphStore } from '../../../stores/nodeGraph.js';

export function TranscodeNode({ id, data, selected }: NodeProps) {
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
        <span className="text-lg">🔄</span>
        <span className="font-semibold text-sm flex-1">Transcode</span>
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
            <span>{config.codec || 'libx264'} · CRF {config.crf ?? 23}</span>
          )}
        </div>
      )}

      {showConfig && (
        <div className="nodrag cursor-default px-3 py-2 space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Codec</label>
            <select
              value={config.codec || 'libx264'}
              onChange={(e) => updateConfig({ codec: e.target.value })}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="libx264">H.264</option>
              <option value="libx265">H.265</option>
              <option value="libvpx-vp9">VP9</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">CRF: {config.crf ?? 23}</label>
            <input
              type="range"
              min={0}
              max={51}
              value={config.crf ?? 23}
              onChange={(e) => updateConfig({ crf: parseInt(e.target.value) })}
              className="w-full accent-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500">Preset</label>
            <select
              value={config.preset || 'medium'}
              onChange={(e) => updateConfig({ preset: e.target.value })}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="ultrafast">Ultrafast</option>
              <option value="fast">Fast</option>
              <option value="medium">Medium</option>
              <option value="slow">Slow</option>
              <option value="veryslow">Very Slow</option>
            </select>
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
