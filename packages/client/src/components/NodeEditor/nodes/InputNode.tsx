import { Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useRef, useState, useEffect } from "react";
import { useNodeGraphStore } from "../../../stores/nodeGraph.js";
import { NodeContextMenu } from "./NodeContextMenu.js";
import { useContextMenu } from "./useContextMenu.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { ConnectionHandle } from "./ConnectionHandle.js";
import type { FileProbe } from "../../../api/types.js";

interface FfprobeResult {
  format: {
    filename: string;
    duration: string;
    size: string;
    bit_rate: string;
    format_name: string;
  };
  streams: Array<{
    index: number;
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    bit_rate?: string;
    duration?: string;
  }>;
}

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
  const onFileUpload = data.onFileUpload as ((file: File, onProgress?: (p: number) => void) => Promise<any>) | undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const store = useNodeGraphStore();
  const [probe, setProbe] = useState<FileProbe | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const infoExpanded = config.infoExpanded !== false;

  useEffect(() => {
    if (!config.fileId) {
      setProbe(null);
      return;
    }
    fetch(`/api/files/${config.fileId}/probe`)
      .then((res) => res.json())
      .then((data: FfprobeResult) => {
        const videoStream = data.streams.find((s) => s.codec_type === "video");
        const audioStream = data.streams.find((s) => s.codec_type === "audio");
        const fpsStr = videoStream?.r_frame_rate;
        let fps = 0;
        if (fpsStr && fpsStr.includes("/")) {
          const [num, den] = fpsStr.split("/").map(Number);
          fps = den ? num / den : 0;
        } else if (fpsStr) {
          fps = parseFloat(fpsStr);
        }
        setProbe({
          id: config.fileId,
          filename: data.format.filename,
          size: parseInt(data.format.size, 10) || 0,
          mimeType: "",
          duration: parseFloat(data.format.duration) || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          fps,
          videoCodec: videoStream?.codec_name || "",
          audioCodec: audioStream?.codec_name || "",
          bitrate: parseInt(data.format.bit_rate, 10) || 0,
        });
      })
      .catch(() => setProbe(null));
  }, [config.fileId]);

  function parseFps(fpsStr: string | null | undefined): string {
    if (!fpsStr) return "N/A";
    if (fpsStr.includes("/")) {
      const [num, den] = fpsStr.split("/").map(Number);
      return den ? (num / den).toFixed(2) : "N/A";
    }
    return parseFloat(fpsStr).toFixed(2);
  }

  function formatBitrate(bps: number | null | undefined): string {
    if (!bps) return "N/A";
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
    if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
    return `${bps} bps`;
  }

  function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes) return "N/A";
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  const statusBorder =
    status === "completed"
      ? "border-green-500"
      : status === "processing"
        ? "border-blue-500"
        : status === "error"
          ? "border-red-500"
          : "border-slate-600";

  const hasFile = !!config.fileId;

  const handleFileSelect = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    store.updateNodeConfig(id, {
      fileId,
      filename: file?.filename || "Unknown",
    });
    setUploadError(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("[InputNode] Upload started:", file?.name, file?.size);
    if (file && onFileUpload) {
      setUploadError(null);
      setUploadProgress(0);
      try {
        console.log("[InputNode] Calling onFileUpload...");
        const uploaded = await onFileUpload(file, (p) => {
          console.log("[InputNode] Progress:", p);
          setUploadProgress(p);
        });
        console.log("[InputNode] Upload result:", uploaded);
        setUploadProgress(null);
        if (uploaded?.id) {
          store.updateNodeConfig(id, {
            fileId: uploaded.id,
            filename: file.name,
          });
        } else {
          console.warn("[InputNode] No id in upload result:", uploaded);
        }
      } catch (err) {
        console.error("[InputNode] Upload error:", err);
        setUploadProgress(null);
        setUploadError("Upload failed. Please try again.");
      }
    }
  };

  const {
    isOpen: menuOpen,
    toggle: toggleMenu,
    close: closeMenu,
    menuRef: contextMenuRef,
  } = useContextMenu();

  return (
    <div
      ref={contextMenuRef}
      className={`rounded-lg border-2 ${statusBorder} bg-slate-800 shadow-lg min-w-[220px] relative ${
        selected ? "ring-2 ring-blue-400" : ""
      }`}
      style={{ touchAction: "none" }}
    >
      <ResizeHandle
        minWidth={220}
        selected={selected}
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <span className="text-lg">📁</span>
        <span className="font-semibold text-sm flex-1">Input</span>
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

      {uploadError && <div className="px-3 py-2 text-xs text-red-400">{uploadError}</div>}

      <div className="nodrag cursor-default px-3 py-2 space-y-2">
        {hasFile && (
          <video
            src={`/api/files/${config.fileId}`}
            className="w-full rounded bg-black"
            controls
            playsInline
            preload="metadata"
          />
        )}

        {hasFile && probe && (
          <details
            open={infoExpanded}
            className="text-[10px] text-slate-400"
            onToggle={(e) => {
              const isOpen = (e.target as HTMLDetailsElement).open;
              store.updateNodeConfig(id, { infoExpanded: isOpen });
            }}
          >
            <summary className="cursor-pointer hover:text-slate-300 select-none">ℹ️ Info</summary>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1 ml-1">
              {probe.width && probe.height && (
                <>
                  <span>Resolution:</span>
                  <span>{probe.width}×{probe.height}</span>
                </>
              )}
              {probe.fps > 0 && (
                <>
                  <span>Frame rate:</span>
                  <span>{parseFps(probe.fps.toString())} fps</span>
                </>
              )}
              {probe.videoCodec && (
                <>
                  <span>Video:</span>
                  <span>{probe.videoCodec}</span>
                </>
              )}
              {probe.audioCodec && (
                <>
                  <span>Audio:</span>
                  <span>{probe.audioCodec}</span>
                </>
              )}
              {probe.bitrate > 0 && (
                <>
                  <span>Bitrate:</span>
                  <span>{formatBitrate(probe.bitrate)}</span>
                </>
              )}
              {probe.duration > 0 && (
                <>
                  <span>Duration:</span>
                  <span>{probe.duration.toFixed(2)}s</span>
                </>
              )}
              {probe.size > 0 && (
                <>
                  <span>Size:</span>
                  <span>{formatFileSize(probe.size)}</span>
                </>
              )}
            </div>
          </details>
        )}

        <select
          value={config.fileId || ""}
          onChange={(e) => handleFileSelect(e.target.value)}
          className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">Select a file...</option>
          {files.map((f) => (
            <option
              key={f.id}
              value={f.id}
            >
              {f.filename} {f.duration ? `(${f.duration.toFixed(1)}s)` : ""}
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

        {uploadProgress !== null ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-slate-800 px-2 text-slate-500">or</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="w-full px-2 py-1.5 border border-dashed border-slate-600 rounded text-xs text-slate-400 hover:border-slate-500 hover:bg-slate-700/50 transition-colors"
            >
              📁 Upload new file
            </button>
          </>
        )}

        {hasFile && (
          <div className="text-[10px] text-slate-500 truncate">
            {config.filename || "File selected"}
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
