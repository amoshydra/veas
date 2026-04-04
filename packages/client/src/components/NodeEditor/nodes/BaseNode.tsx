import { Handle, Position } from '@xyflow/react';
import type { NodeDefinition, PortDefinition } from '../../../types/nodeGraph.js';
import { NODE_DEFINITIONS } from '../../../types/nodeGraph.js';

interface BaseNodeProps {
  id: string;
  type: keyof typeof NODE_DEFINITIONS;
  selected: boolean;
  data: {
    config: Record<string, any>;
    status: 'idle' | 'queued' | 'processing' | 'completed' | 'error';
    error?: string;
    definition: NodeDefinition;
  };
  onConfigChange?: (id: string, config: Record<string, any>) => void;
}

const statusColors = {
  idle: 'border-slate-600',
  queued: 'border-yellow-500',
  processing: 'border-blue-500',
  completed: 'border-green-500',
  error: 'border-red-500',
};

const statusBg = {
  idle: 'bg-slate-800',
  queued: 'bg-yellow-900/20',
  processing: 'bg-blue-900/20',
  completed: 'bg-green-900/20',
  error: 'bg-red-900/20',
};

function PortHandle({ port, type }: { port: PortDefinition; type: 'source' | 'target' }) {
  const color = port.type === 'video' ? 'bg-blue-400' : port.type === 'audio' ? 'bg-purple-400' : 'bg-green-400';
  return (
    <Handle
      type={type}
      position={type === 'target' ? Position.Left : Position.Right}
      id={port.id}
      className={`!w-3 !h-3 !rounded-full ${color} !border-2 !border-slate-900`}
    />
  );
}

export function BaseNode({ id, type, selected, data, onConfigChange }: BaseNodeProps) {
  const definition = NODE_DEFINITIONS[type];
  const { config, status, error } = data;

  const borderClass = statusColors[status] || statusColors.idle;
  const bgClass = statusBg[status] || statusBg.idle;

  return (
    <div
      className={`rounded-lg border-2 ${borderClass} ${bgClass} shadow-lg min-w-[180px] max-w-[240px] ${
        selected ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">{definition.icon}</span>
        <span className="font-semibold text-sm flex-1 truncate">
          {definition.label}
        </span>
        {status === 'processing' && (
          <span className="text-xs text-blue-400 animate-pulse">●</span>
        )}
        {status === 'completed' && (
          <span className="text-xs text-green-400">✓</span>
        )}
        {status === 'error' && (
          <span className="text-xs text-red-400">✗</span>
        )}
      </div>

      <div className="px-3 py-2 text-xs text-slate-400">
        {error ? (
          <div className="text-red-400 truncate">{error}</div>
        ) : (
          <ConfigSummary type={type} config={config} />
        )}
      </div>

      {definition.inputs.map((port) => (
        <PortHandle key={port.id} port={port} type="target" />
      ))}
      {definition.outputs.map((port) => (
        <PortHandle key={port.id} port={port} type="source" />
      ))}
    </div>
  );
}

function ConfigSummary({
  type,
  config,
}: {
  type: keyof typeof NODE_DEFINITIONS;
  config: Record<string, any>;
}) {
  switch (type) {
    case 'input':
      return config.fileId ? (
        <span>File selected</span>
      ) : (
        <span className="text-yellow-400">Select file</span>
      );
    case 'output':
      return (
        <span>
          {config.format || 'mp4'} · CRF {config.quality ?? 23}
        </span>
      );
    case 'trim':
      return (
        <span>
          {config.start ?? 0}s → {config.end ?? 10}s
        </span>
      );
    case 'crop':
      return (
        <span>
          {config.width ?? 1280}×{config.height ?? 720}
        </span>
      );
    case 'resize':
      return (
        <span>
          {config.width ?? 'auto'}×{config.height ?? 'auto'}
        </span>
      );
    case 'transcode':
      return (
        <span>
          {config.codec || 'libx264'} · CRF {config.crf ?? 23}
        </span>
      );
    case 'filter':
      return <span>Adjustments</span>;
    case 'speed':
      return <span>{config.speed ?? 1}x</span>;
    case 'rotate':
      return <span>{config.angle ?? 90}°</span>;
    case 'flip':
      return <span>{config.direction || 'horizontal'}</span>;
    case 'concat':
      return <span>Join videos</span>;
    case 'watermark':
      return <span>{config.position || 'bottom-right'}</span>;
    case 'pip':
      return <span>PiP overlay</span>;
    case 'audioExtract':
      return <span>{config.audioCodec || 'mp3'}</span>;
    case 'gif':
      return (
        <span>
          {config.fps ?? 10}fps · {config.width ?? 480}px
        </span>
      );
    case 'reverse':
      return <span>{config.videoOnly ? 'Video only' : 'Video+Audio'}</span>;
    case 'loop':
      return <span>{config.count ?? 2}× loop</span>;
    case 'subtitle':
      return <span>Burn subtitles</span>;
    default:
      return <span>Configure</span>;
  }
}
