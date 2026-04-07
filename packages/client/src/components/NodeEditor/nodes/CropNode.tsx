import { Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useNodeGraphStore } from "../../../stores/nodeGraph.js";
import { useContextMenu } from "./useContextMenu.js";
import { NodeContextMenu } from "./NodeContextMenu.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { ConnectionHandle } from "./ConnectionHandle.js";
import { CropOverlay } from "./CropOverlay.js";
import { resolvePreviewSource } from "../../../utils/preview.js";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ASPECT_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Free", value: null },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "9:16", value: 9 / 16 },
  { label: "3:4", value: 3 / 4 },
];

export function CropNode({ id, data, selected }: NodeProps) {
  const config = data.config as Record<string, any>;
  const status = data.status as string;
  const error = data.error as string | undefined;
  const store = useNodeGraphStore();

  const { fileId, isReady } = resolvePreviewSource(id, store.nodes, store.edges);
  const hasFile = isReady && !!fileId;

  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [aspectLock, setAspectLock] = useState<number | null>(config.aspectRatio ?? null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const crop: CropRect = {
    x: config.x ?? 0,
    y: config.y ?? 0,
    width: config.width ?? 1280,
    height: config.height ?? 720,
  };

  const statusBorder =
    status === "completed"
      ? "border-green-500"
      : status === "processing"
        ? "border-blue-500"
        : status === "error"
          ? "border-red-500"
          : "border-slate-600";

  const updateConfig = useCallback(
    (updates: Record<string, any>) => {
      store.updateNodeConfig(id, updates);
    },
    [store, id],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasFile) return;

    const handleLoadedMetadata = () => {
      setVideoWidth(video.videoWidth);
      setVideoHeight(video.videoHeight);

      if (config.width == null || config.height == null) {
        updateConfig({
          x: 0,
          y: 0,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", handleLoadedMetadata);
  }, [hasFile, config.width, config.height, updateConfig]);

  useEffect(() => {
    const container = videoContainerRef.current;
    if (!container || !videoWidth || !videoHeight) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const aspect = videoWidth / videoHeight;
        setDisplaySize({ width, height: width / aspect });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [videoWidth, videoHeight]);

  const handleCropChange = useCallback(
    (newCrop: CropRect) => {
      updateConfig({
        x: Math.round(newCrop.x),
        y: Math.round(newCrop.y),
        width: Math.round(newCrop.width),
        height: Math.round(newCrop.height),
      });
    },
    [updateConfig],
  );

  const handleFitToVideo = useCallback(() => {
    if (!videoWidth || !videoHeight) return;
    updateConfig({ x: 0, y: 0, width: videoWidth, height: videoHeight });
  }, [videoWidth, videoHeight, updateConfig]);

  const handleCoordChange = useCallback(
    (key: string, value: string) => {
      const num = parseInt(value) || 0;
      if (key === "x") {
        updateConfig({ x: Math.max(0, Math.min(num, videoWidth - 10)) });
      } else if (key === "y") {
        updateConfig({ y: Math.max(0, Math.min(num, videoHeight - 10)) });
      }
    },
    [updateConfig, videoWidth, videoHeight],
  );

  const handleSizeChange = useCallback(
    (key: string, value: string) => {
      const num = parseInt(value) || 10;
      if (key === "width") {
        const w = Math.max(10, Math.min(num, videoWidth - crop.x));
        if (aspectLock) {
          const h = Math.round(w / aspectLock);
          updateConfig({ width: w, height: Math.max(10, Math.min(h, videoHeight - crop.y)) });
        } else {
          updateConfig({ width: w });
        }
      } else if (key === "height") {
        const h = Math.max(10, Math.min(num, videoHeight - crop.y));
        if (aspectLock) {
          const w = Math.round(h * aspectLock);
          updateConfig({ height: h, width: Math.max(10, Math.min(w, videoWidth - crop.x)) });
        } else {
          updateConfig({ height: h });
        }
      }
    },
    [updateConfig, videoWidth, videoHeight, crop.x, crop.y, aspectLock],
  );

  const handleAspectChange = useCallback(
    (value: number | null) => {
      setAspectLock(value);
      if (value) {
        const h = Math.round(crop.width / value);
        updateConfig({
          aspectRatio: value,
          height: Math.max(10, Math.min(h, videoHeight - crop.y)),
        });
      } else {
        updateConfig({ aspectRatio: null });
      }
    },
    [updateConfig, crop.width, crop.y, videoHeight],
  );

  const { isOpen: menuOpen, toggle: toggleMenu, close: closeMenu, menuRef } = useContextMenu();

  return (
    <div
      ref={menuRef}
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[240px] relative ${
        selected ? "ring-2 ring-blue-400" : ""
      }`}
      style={{ touchAction: "none" }}
    >
      <ResizeHandle
        minWidth={240}
        selected={selected}
      />
      <ConnectionHandle
        type="target"
        position={Position.Left}
        id="video"
        portType="video"
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">⬜</span>
        <span className="font-semibold text-sm flex-1">Crop</span>
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

      {!hasFile && (
        <div className="px-3 py-2 text-xs text-slate-400 cursor-default">
          <span>Connect an input to crop</span>
        </div>
      )}

      {hasFile && (
        <div className="nodrag cursor-default px-3 py-2 space-y-3">
          {/* Video preview with crop overlay */}
          <div
            ref={videoContainerRef}
            className="relative w-full"
          >
            <video
              ref={videoRef}
              src={`/api/files/${fileId}`}
              className="w-full rounded bg-black"
              playsInline
              preload="metadata"
              muted
            />
            {videoWidth > 0 && displaySize.width > 0 && (
              <CropOverlay
                videoWidth={videoWidth}
                videoHeight={videoHeight}
                displayWidth={displaySize.width}
                displayHeight={displaySize.height}
                crop={crop}
                onCropChange={handleCropChange}
                aspectRatio={aspectLock}
              />
            )}
          </div>

          {/* Aspect ratio selector */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500 w-14">Aspect</label>
            <select
              value={aspectLock != null ? aspectLock.toFixed(4) : "free"}
              onChange={(e) => {
                const v = e.target.value;
                handleAspectChange(v === "free" ? null : parseFloat(v));
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              {ASPECT_OPTIONS.map((opt) => (
                <option
                  key={opt.label}
                  value={opt.value != null ? opt.value.toFixed(4) : "free"}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Source video size info */}
          {videoWidth > 0 && (
            <div className="text-[10px] text-slate-500 text-center">
              Source: {videoWidth}×{videoHeight}
            </div>
          )}

          {/* X, Y, Width, Height inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">X</label>
              <input
                type="number"
                value={Math.round(crop.x)}
                onChange={(e) => handleCoordChange("x", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                min={0}
                max={videoWidth}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Y</label>
              <input
                type="number"
                value={Math.round(crop.y)}
                onChange={(e) => handleCoordChange("y", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                min={0}
                max={videoHeight}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Width</label>
              <input
                type="number"
                value={Math.round(crop.width)}
                onChange={(e) => handleSizeChange("width", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                min={10}
                max={videoWidth}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500">Height</label>
              <input
                type="number"
                value={Math.round(crop.height)}
                onChange={(e) => handleSizeChange("height", e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 font-mono focus:border-blue-500 focus:outline-none"
                min={10}
                max={videoHeight}
              />
            </div>
          </div>

          {/* Fit to video button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFitToVideo();
            }}
            className="w-full px-2 py-1.5 text-xs text-blue-300 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            title="Set crop to full video dimensions"
          >
            Fit to Video
          </button>
        </div>
      )}

      <ConnectionHandle
        type="source"
        position={Position.Right}
        id="video"
        portType="video"
      />
    </div>
  );
}
