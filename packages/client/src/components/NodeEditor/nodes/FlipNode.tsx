import { Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useState, useEffect, useRef } from "react";
import { useNodeGraphStore } from "../../../stores/nodeGraph.js";
import { useContextMenu } from "./useContextMenu.js";
import { NodeContextMenu } from "./NodeContextMenu.js";
import { ConnectionHandle } from "./ConnectionHandle.js";

export function FlipNode({ id, data, selected }: NodeProps) {
  const config = data.config as Record<string, any>;
  const status = data.status as string;
  const error = data.error as string | undefined;
  const store = useNodeGraphStore();

  const sourceNode = store.edges
    .filter((e) => e.target === id && e.targetHandle === "video")
    .map((e) => store.nodes.find((n) => n.id === e.source))
    .find(Boolean);

  const fileId = (config.fileId ||
    sourceNode?.data?.config?.fileId ||
    sourceNode?.data?.outputId) as string | undefined;
  const hasFile = !!fileId;

  const flipH = config.flipH ?? false;
  const flipV = config.flipV ?? false;

  const statusBorder =
    status === "completed"
      ? "border-green-500"
      : status === "processing"
        ? "border-blue-500"
        : status === "error"
          ? "border-red-500"
          : "border-slate-600";

  const {
    isOpen: menuOpen,
    toggle: toggleMenu,
    close: closeMenu,
    menuRef: contextMenuRef,
  } = useContextMenu();

  const handleFlipH = () => {
    store.updateNodeConfig(id, { flipH: !flipH });
  };

  const handleFlipV = () => {
    store.updateNodeConfig(id, { flipV: !flipV });
  };

  return (
    <div
      ref={contextMenuRef}
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[200px] relative ${
        selected ? "ring-2 ring-blue-400" : ""
      }`}
      style={{ touchAction: "none" }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">↔️</span>
        <span className="font-semibold text-sm flex-1">Flip</span>
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

      {error && <div className="px-3 py-2 text-xs text-red-400">{error}</div>}

      <div className="nodrag cursor-default px-3 py-2 space-y-2">
        {hasFile && (
          <div className="relative bg-black rounded overflow-hidden">
            <video
              src={`/api/files/${fileId}`}
              className="w-full"
              style={{
                transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                transition: "transform 0.2s ease",
              }}
              playsInline
              muted
              loop
              autoPlay
            />
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFlipH();
            }}
            className={`flex-1 px-2 py-1.5 border rounded text-xs transition-colors ${
              flipH
                ? "bg-blue-600 border-blue-400 text-white"
                : "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
            }`}
          >
            ↔️ Horizontal
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFlipV();
            }}
            className={`flex-1 px-2 py-1.5 border rounded text-xs transition-colors ${
              flipV
                ? "bg-blue-600 border-blue-400 text-white"
                : "bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
            }`}
          >
            ↕️ Vertical
          </button>
        </div>

        {hasFile && (flipH || flipV) && (
          <div className="text-[10px] text-slate-500 text-center">
            {flipH && "H"}{flipH && flipV && ", "}{flipV && "V"}
          </div>
        )}
      </div>

      <ConnectionHandle
        type="target"
        position={Position.Left}
        id="video"
        portType="video"
      />
      <ConnectionHandle
        type="source"
        position={Position.Right}
        id="video"
        portType="video"
      />
    </div>
  );
}