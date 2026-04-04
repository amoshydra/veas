import { NodeResizeControl } from '@xyflow/react';

interface ResizeHandleProps {
  minWidth: number;
  selected: boolean;
}

export function ResizeHandle({ minWidth, selected }: ResizeHandleProps) {
  if (!selected) return null;

  return (
    <NodeResizeControl
      minWidth={minWidth}
      resizeDirection="horizontal"
      className="react-flow__resize-control"
      style={{ touchAction: 'none' }}
    >
      <div className="w-7 h-7 flex items-center justify-center bg-transparent hover:bg-slate-700 rounded cursor-se-resize">
        <span className="text-slate-400 text-sm">↘</span>
      </div>
    </NodeResizeControl>
  );
}
