import { Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useState, useEffect, useRef } from "react";
import { useNodeGraphStore } from "../../../stores/nodeGraph.js";
import { useContextMenu } from "./useContextMenu.js";
import { NodeContextMenu } from "./NodeContextMenu.js";
import { ConnectionHandle } from "./ConnectionHandle.js";

const ROTATION_ANGLES = [0, 90, 180, 270];

export function RotateNode({ id, data, selected }: NodeProps) {
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

  const angle = config.angle ?? 0;
  const rotationIndex = ROTATION_ANGLES.indexOf(angle);
  const nextAngle = ROTATION_ANGLES[(rotationIndex + 1) % ROTATION_ANGLES.length];

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

  const handleRotate = () => {
    store.updateNodeConfig(id, { angle: nextAngle });
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
        <span className="text-lg">🔃</span>
        <span className="font-semibold text-sm flex-1">Rotate</span>
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
                transform: `rotate(${angle}deg)`,
                transition: "transform 0.2s ease",
              }}
              playsInline
              muted
              loop
              autoPlay
            />
          </div>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRotate();
          }}
          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 hover:bg-slate-600 transition-colors"
        >
          Rotate {angle}° → {nextAngle}°
        </button>

        {hasFile && (
          <div className="text-[10px] text-slate-500 text-center">
            {angle}°
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