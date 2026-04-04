import { useState, useEffect } from 'react';
import { useNodeGraphStore } from '../../stores/nodeGraph.js';
import { NODE_DEFINITIONS } from '../../types/nodeGraph.js';
import type { NodeType } from '../../types/nodeGraph.js';

interface FileItem {
  id: string;
  filename: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  size: number;
}

interface NodePropsPanelProps {
  files: FileItem[];
  onFileUpload?: (file: File) => void;
}

export default function NodePropsPanel({ files, onFileUpload }: NodePropsPanelProps) {
  const store = useNodeGraphStore();
  const selectedNode = store.nodes.find((n) => n.id === store.selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="w-[280px] border-l border-slate-700 bg-slate-900 flex flex-col h-full">
        <div className="p-3 border-b border-slate-700">
          <h3 className="font-semibold text-sm text-slate-200">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm p-4">
          Select a node to edit its properties
        </div>
      </div>
    );
  }

  const def = NODE_DEFINITIONS[selectedNode.type];

  return (
    <div className="w-[280px] border-l border-slate-700 bg-slate-900 flex flex-col h-full">
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
          <span>{def.icon}</span>
          <span>{def.label} Properties</span>
        </h3>
        <button
          onClick={() => store.removeNode(selectedNode.id)}
          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 hover:bg-red-900/30 rounded"
        >
          Delete
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {selectedNode.type === 'input' && (
          <InputConfig
            fileId={selectedNode.data.config.fileId}
            files={files}
            onFileSelect={(fileId) =>
              store.updateNodeConfig(selectedNode.id, {
                fileId,
                filename: files.find((f) => f.id === fileId)?.filename,
              })
            }
            onFileUpload={onFileUpload}
          />
        )}
        {selectedNode.type === 'output' && (
          <OutputConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {selectedNode.type === 'trim' && (
          <TrimConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {selectedNode.type === 'crop' && (
          <CropConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {selectedNode.type === 'resize' && (
          <ResizeConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {selectedNode.type === 'transcode' && (
          <TranscodeConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {selectedNode.type === 'filter' && (
          <FilterConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {selectedNode.type === 'speed' && (
          <SpeedConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {selectedNode.type === 'rotate' && (
          <RotateConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {selectedNode.type === 'flip' && (
          <FlipConfig
            config={selectedNode.data.config}
            onChange={(config) => store.updateNodeConfig(selectedNode.id, config)}
          />
        )}
        {!['input', 'output', 'trim', 'crop', 'resize', 'transcode', 'filter', 'speed', 'rotate', 'flip'].includes(selectedNode.type) && (
          <div className="text-sm text-slate-500">
            Properties for {def.label} coming soon
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function InputConfig({
  fileId,
  files,
  onFileSelect,
  onFileUpload,
}: {
  fileId: string;
  files: FileItem[];
  onFileSelect: (fileId: string) => void;
  onFileUpload?: (file: File) => void;
}) {
  return (
    <div className="space-y-3">
      <ConfigField label="Source File">
        <select
          value={fileId}
          onChange={(e) => onFileSelect(e.target.value)}
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Select a file...</option>
          {files.map((f) => (
            <option key={f.id} value={f.id}>
              {f.filename} {f.duration ? `(${f.duration.toFixed(1)}s)` : ''}
            </option>
          ))}
        </select>
      </ConfigField>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-slate-900 px-2 text-slate-500">or</span>
        </div>
      </div>

      <label className="flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-slate-500 hover:bg-slate-800/50 transition-colors text-sm text-slate-400">
        <input
          type="file"
          accept="video/*,audio/*,image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file && onFileUpload) {
              onFileUpload(file);
            }
          }}
        />
        <span>📁</span>
        <span>Upload new file</span>
      </label>

      {fileId && files.find((f) => f.id === fileId) && (
        <div className="text-xs text-slate-500 space-y-1 pt-1">
          <div>{files.find((f) => f.id === fileId)?.filename}</div>
          <div>
            {files.find((f) => f.id === fileId)?.duration?.toFixed(1)}s
            {files.find((f) => f.id === fileId)?.width && files.find((f) => f.id === fileId)?.height
              ? ` · ${files.find((f) => f.id === fileId)?.width}×${files.find((f) => f.id === fileId)?.height}`
              : ''}
          </div>
        </div>
      )}
    </div>
  );
}

function OutputConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <>
      <ConfigField label="Format">
        <select
          value={config.format || 'mp4'}
          onChange={(e) => onChange({ format: e.target.value })}
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="mp4">MP4</option>
          <option value="webm">WebM</option>
          <option value="avi">AVI</option>
          <option value="mov">MOV</option>
        </select>
      </ConfigField>
      <ConfigField label={`Quality (CRF): ${config.quality ?? 23}`}>
        <input
          type="range"
          min={0}
          max={51}
          value={config.quality ?? 23}
          onChange={(e) => onChange({ quality: parseInt(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </ConfigField>
    </>
  );
}

function TrimConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <>
      <ConfigField label="Start Time (seconds)">
        <input
          type="number"
          min={0}
          step={0.1}
          value={config.start ?? 0}
          onChange={(e) => onChange({ start: parseFloat(e.target.value) || 0 })}
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        />
      </ConfigField>
      <ConfigField label="End Time (seconds)">
        <input
          type="number"
          min={0}
          step={0.1}
          value={config.end ?? 10}
          onChange={(e) => onChange({ end: parseFloat(e.target.value) || 0 })}
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        />
      </ConfigField>
    </>
  );
}

function CropConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <ConfigField label="X">
          <input
            type="number"
            min={0}
            value={config.x ?? 0}
            onChange={(e) => onChange({ x: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </ConfigField>
        <ConfigField label="Y">
          <input
            type="number"
            min={0}
            value={config.y ?? 0}
            onChange={(e) => onChange({ y: parseInt(e.target.value) || 0 })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </ConfigField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ConfigField label="Width">
          <input
            type="number"
            min={1}
            value={config.width ?? 1280}
            onChange={(e) => onChange({ width: parseInt(e.target.value) || 1 })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </ConfigField>
        <ConfigField label="Height">
          <input
            type="number"
            min={1}
            value={config.height ?? 720}
            onChange={(e) => onChange({ height: parseInt(e.target.value) || 1 })}
            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
          />
        </ConfigField>
      </div>
    </>
  );
}

function ResizeConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ConfigField label="Width">
        <input
          type="number"
          min={1}
          value={config.width ?? 1280}
          onChange={(e) => onChange({ width: parseInt(e.target.value) || 1 })}
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        />
      </ConfigField>
      <ConfigField label="Height">
        <input
          type="number"
          min={1}
          value={config.height ?? 720}
          onChange={(e) => onChange({ height: parseInt(e.target.value) || 1 })}
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        />
      </ConfigField>
    </div>
  );
}

function TranscodeConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <>
      <ConfigField label="Codec">
        <select
          value={config.codec || 'libx264'}
          onChange={(e) => onChange({ codec: e.target.value })}
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="libx264">H.264</option>
          <option value="libx265">H.265</option>
          <option value="libvpx-vp9">VP9</option>
        </select>
      </ConfigField>
      <ConfigField label={`CRF: ${config.crf ?? 23}`}>
        <input
          type="range"
          min={0}
          max={51}
          value={config.crf ?? 23}
          onChange={(e) => onChange({ crf: parseInt(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </ConfigField>
      <ConfigField label="Preset">
        <select
          value={config.preset || 'medium'}
          onChange={(e) => onChange({ preset: e.target.value })}
          className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
        >
          <option value="ultrafast">Ultrafast</option>
          <option value="fast">Fast</option>
          <option value="medium">Medium</option>
          <option value="slow">Slow</option>
          <option value="veryslow">Very Slow</option>
        </select>
      </ConfigField>
    </>
  );
}

function FilterConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <>
      <ConfigField label={`Brightness: ${config.brightness ?? 0}`}>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={config.brightness ?? 0}
          onChange={(e) => onChange({ brightness: parseFloat(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </ConfigField>
      <ConfigField label={`Contrast: ${config.contrast ?? 1}`}>
        <input
          type="range"
          min={0}
          max={3}
          step={0.01}
          value={config.contrast ?? 1}
          onChange={(e) => onChange({ contrast: parseFloat(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </ConfigField>
      <ConfigField label={`Saturation: ${config.saturation ?? 1}`}>
        <input
          type="range"
          min={0}
          max={3}
          step={0.01}
          value={config.saturation ?? 1}
          onChange={(e) => onChange({ saturation: parseFloat(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </ConfigField>
    </>
  );
}

function SpeedConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <ConfigField label={`Speed: ${config.speed ?? 1}x`}>
      <input
        type="range"
        min={0.25}
        max={4}
        step={0.25}
        value={config.speed ?? 1}
        onChange={(e) => onChange({ speed: parseFloat(e.target.value) })}
        className="w-full accent-blue-500"
      />
      <div className="flex justify-between text-xs text-slate-500 mt-1">
        <span>0.25x</span>
        <span>4x</span>
      </div>
    </ConfigField>
  );
}

function RotateConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <ConfigField label="Rotation Angle">
      <select
        value={config.angle ?? 90}
        onChange={(e) => onChange({ angle: parseInt(e.target.value) })}
        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
      >
        <option value={90}>90° Clockwise</option>
        <option value={180}>180°</option>
        <option value={270}>90° Counter-clockwise</option>
      </select>
    </ConfigField>
  );
}

function FlipConfig({
  config,
  onChange,
}: {
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}) {
  return (
    <ConfigField label="Direction">
      <select
        value={config.direction || 'horizontal'}
        onChange={(e) => onChange({ direction: e.target.value })}
        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
      >
        <option value="horizontal">Horizontal</option>
        <option value="vertical">Vertical</option>
      </select>
    </ConfigField>
  );
}
