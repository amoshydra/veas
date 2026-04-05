import { Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useNodeGraphStore } from "../../../stores/nodeGraph.js";
import { useContextMenu } from "./useContextMenu.js";
import { NodeContextMenu } from "./NodeContextMenu.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { ConnectionHandle } from "./ConnectionHandle.js";

export function ResizeNode({ id, data, selected }: NodeProps) {
  const config = data.config as Record<string, any>;
  const status = data.status as string;
  const error = data.error as string | undefined;
  const store = useNodeGraphStore();

  const statusBorder =
    status === "completed"
      ? "border-green-500"
      : status === "processing"
        ? "border-blue-500"
        : status === "error"
          ? "border-red-500"
          : "border-slate-600";

  const { isOpen: menuOpen, toggle: toggleMenu, close: closeMenu, menuRef } = useContextMenu();

  return (
    <div
      ref={menuRef}
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[200px] relative ${
        selected ? "ring-2 ring-blue-400" : ""
      }`}
      style={{ touchAction: "none" }}
    >
      <ResizeHandle
        minWidth={200}
        selected={selected}
      />
      <ConnectionHandle
        type="target"
        position={Position.Left}
        id="video"
        portType="video"
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">📐</span>
        <span className="font-semibold text-sm flex-1">Resize</span>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu();
            }}
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
            title="More options"
          >
            <span className="text-xs">⋮</span>
          </button>
          {menuOpen && (
            <NodeContextMenu
              nodeId={id}
              onDelete={(nodeId) => {
                store.removeNode(nodeId);
                closeMenu();
              }}
              onClose={closeMenu}
            />
          )}
        </div>
        {status === "completed" && <span className="text-xs text-green-400">✓</span>}
        {status === "processing" && <span className="text-xs text-blue-400 animate-pulse">●</span>}
        {status === "error" && <span className="text-xs text-red-400">✗</span>}
      </div>

      <div className="nodrag cursor-default px-3 py-2 space-y-2">
        {error ? (
          <div className="text-red-400 text-xs truncate">{error}</div>
        ) : (
          <div className="text-xs text-slate-400">
            {config.width ?? "auto"}×{config.height ?? "auto"}
          </div>
        )}
      </div>

      <ConnectionHandle
        type="source"
        position={Position.Right}
        id="video"
        portType="video"
      />
    </div>
  );
}
