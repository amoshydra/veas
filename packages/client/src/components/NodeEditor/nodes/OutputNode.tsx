import { Handle, Position, NodeResizeControl } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useNodeGraphStore } from '../../../stores/nodeGraph.js';
import { useContextMenu } from './useContextMenu.js';
import { NodeContextMenu } from './NodeContextMenu.js';
import { ResizeHandle } from './ResizeHandle.js';

export function OutputNode({ id, data, selected }: NodeProps) {
  const config = data.config as Record<string, any>;
  const status = data.status as string;
  const error = data.error as string | undefined;
  const outputId = data.outputId as string | undefined;
  const store = useNodeGraphStore();

  const statusBorder =
    status === 'completed' ? 'border-green-500' :
    status === 'processing' ? 'border-blue-500' :
    status === 'error' ? 'border-red-500' :
    'border-slate-600';

  const hasOutput = status === 'completed' && outputId;

  const updateConfig = (updates: Record<string, any>) => {
    store.updateNodeConfig(id, updates);
  };

  const { isOpen: menuOpen, toggle: toggleMenu, close: closeMenu, menuRef } = useContextMenu();

  return (
    <div
      ref={menuRef}
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[220px] relative ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      <ResizeHandle minWidth={220} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        id="video"
        className="!w-3 !h-3 !rounded-full bg-blue-400 !border-2 !border-slate-900"
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">💾</span>
        <span className="font-semibold text-sm flex-1">Output</span>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); toggleMenu(); }}
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
            title="More options"
          >
            <span className="text-xs">⋮</span>
          </button>
          {menuOpen && (
            <NodeContextMenu
              nodeId={id}
              onDelete={(nodeId) => { store.removeNode(nodeId); closeMenu(); }}
              onClose={closeMenu}
            />
          )}
        </div>
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
        {hasOutput ? (
          <video
            src={`/api/files/${outputId}`}
            className="w-full rounded bg-black"
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Format</label>
              <select
                value={config.format || 'mp4'}
                onChange={(e) => updateConfig({ format: e.target.value })}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
                <option value="avi">AVI</option>
                <option value="mov">MOV</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Quality: CRF {config.quality ?? 23}</label>
              <input
                type="range"
                min={0}
                max={51}
                value={config.quality ?? 23}
                onChange={(e) => updateConfig({ quality: parseInt(e.target.value) })}
                className="w-full accent-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </>
        )}

        {hasOutput && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              {(config.format || 'mp4').toUpperCase()}
            </span>
            <a
              href={`/api/files/${outputId}`}
              download
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white"
            >
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
