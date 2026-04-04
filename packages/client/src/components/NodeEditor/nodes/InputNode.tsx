import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useState, useRef } from 'react';
import { useNodeGraphStore } from '../../../stores/nodeGraph.js';

interface FileItem {
  id: string;
  filename: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  size: number;
}

export function InputNode({ id, data, selected }: NodeProps) {
  const config = data.config as Record<string, any>;
  const status = data.status as string;
  const error = data.error as string | undefined;
  const files = (data.files || []) as FileItem[];
  const onFileUpload = data.onFileUpload as ((file: File) => Promise<any>) | undefined;
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const store = useNodeGraphStore();

  const statusBorder =
    status === 'completed' ? 'border-green-500' :
    status === 'processing' ? 'border-blue-500' :
    status === 'error' ? 'border-red-500' :
    'border-slate-600';

  const hasFile = !!config.fileId;

  const handleFileSelect = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    store.updateNodeConfig(id, {
      fileId,
      filename: file?.filename || 'Unknown',
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      const uploaded = await onFileUpload(file);
      if (uploaded?.id) {
        store.updateNodeConfig(id, {
          fileId: uploaded.id,
          filename: file.name,
        });
      }
    }
  };

  return (
    <div
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[220px] ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <NodeResizer
        minWidth={220}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-blue-400"
        handleClassName="bg-blue-400 w-2 h-2"
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">📁</span>
        <span className="font-semibold text-sm flex-1">Input</span>
        {hasFile && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview); }}
            className="text-xs text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-700"
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? '▲' : '▼'}
          </button>
        )}
        {status === 'completed' && <span className="text-xs text-green-400">✓</span>}
        {status === 'processing' && <span className="text-xs text-blue-400 animate-pulse">●</span>}
        {status === 'error' && <span className="text-xs text-red-400">✗</span>}
      </div>

      <div className="nodrag cursor-default px-3 py-2 space-y-2">
        {error ? (
          <div className="text-red-400 text-xs truncate">{error}</div>
        ) : (
          <>
            <select
              value={config.fileId || ''}
              onChange={(e) => handleFileSelect(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Select a file...</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.filename} {f.duration ? `(${f.duration.toFixed(1)}s)` : ''}
                </option>
              ))}
            </select>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-slate-800 px-2 text-slate-500">or</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*,image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="w-full px-2 py-1.5 border border-dashed border-slate-600 rounded text-xs text-slate-400 hover:border-slate-500 hover:bg-slate-700/50 transition-colors"
            >
              📁 Upload new file
            </button>

            {hasFile && (
              <div className="text-[10px] text-slate-500 truncate">
                {config.filename || 'File selected'}
              </div>
            )}
          </>
        )}
      </div>

      {hasFile && showPreview && (
        <div
          className="px-2 pb-2"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <video
            src={`/api/files/${config.fileId}`}
            className="w-full rounded bg-black"
            controls
            playsInline
            preload="metadata"
            style={{ maxHeight: '150px' }}
          />
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
