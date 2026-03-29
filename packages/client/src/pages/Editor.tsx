import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../api/client.js";
import OperationToolbar from "../components/OperationToolbar.js";
import Timeline from "../components/Timeline/Timeline.js";
import type { SpriteMetadata } from "../components/Timeline/types.js";
import TrimPanel from "../components/panels/TrimPanel.js";
import TranscodePanel from "../components/panels/TranscodePanel.js";

const PANEL_MAP: Record<string, React.ComponentType<{
  sessionId: string;
  fileId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  trimStart?: number;
  trimEnd?: number;
  onTrimChange?: (start: number, end: number) => void;
}>> = {
  trim: TrimPanel,
  transcode: TranscodePanel,
};

interface Job {
  id: string;
  operation: string;
  status: string;
  progress: number;
  outputFile: string | null;
  error: string | null;
}

interface FileItem {
  id: string;
  filename: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  size: number;
}

export default function Editor() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FileItem | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Timeline state
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(50);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [spriteMeta, setSpriteMeta] = useState<SpriteMetadata | null>(null);
  const [spriteImage, setSpriteImage] = useState<HTMLImageElement | null>(null);

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["files", sessionId],
    queryFn: () => api.listFiles(sessionId!),
    enabled: !!sessionId,
  });

  const files = (filesData || []) as FileItem[];

  const { data: jobs } = useQuery({
    queryKey: ["jobs", sessionId],
    queryFn: () => api.listJobs(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 2000,
  });

  const selectedFile = files.find((f) => f.id === selectedFileId);
  const hasFiles = files.length > 0;

  // Auto-select first file
  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id);
    }
  }, [files, selectedFileId]);

  // Load sprite when file is selected
  useEffect(() => {
    if (!selectedFileId) return;
    setSpriteMeta(null);
    setSpriteImage(null);

    api.getFileSprite(selectedFileId).then((meta) => {
      if (meta.error) return;
      setSpriteMeta(meta);
      const img = new Image();
      img.src = meta.spriteUrl;
      img.onload = () => setSpriteImage(img);
    });
  }, [selectedFileId]);

  // Set trim end from file duration
  useEffect(() => {
    if (selectedFile?.duration) {
      setTrimEnd(selectedFile.duration);
    }
  }, [selectedFile?.id]);

  // Video time sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setCurrentTime(video.currentTime);
    video.addEventListener("timeupdate", update);
    video.addEventListener("seeked", update);
    return () => {
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("seeked", update);
    };
  }, [selectedFileId]);

  const handleTimeChange = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  const handleTrimChange = useCallback((start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  }, []);

  const PanelComponent = activePanel ? PANEL_MAP[activePanel] : null;

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between p-3 border-b border-slate-700">
        <a href="/" className="text-slate-400 text-sm">Back</a>
        <h1 className="font-bold">Editor</h1>
        <span className="text-xs text-slate-500">{sessionId?.slice(0, 8)}</span>
      </header>

      {/* Video Preview */}
      <div className="flex-1 flex items-center justify-center bg-black min-h-[200px] relative">
        {hasFiles && selectedFile ? (
          <>
            <video
              ref={videoRef}
              src={`/api/files/${selectedFile.id}`}
              className="max-w-full max-h-full"
              controls
              playsInline
            />
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-xs text-slate-300 bg-black/60 px-2 py-1 rounded">
              <span className="truncate">{selectedFile.filename}</span>
              <span className="shrink-0 ml-2">
                {selectedFile.duration ? `${selectedFile.duration.toFixed(1)}s` : ""}
                {" "}
                {selectedFile.width && selectedFile.height
                  ? `${selectedFile.width}×${selectedFile.height}`
                  : ""}
              </span>
            </div>
          </>
        ) : (
          <div className="text-slate-500 text-center">
            <div className="text-4xl mb-2">🎬</div>
            <div className="text-sm">Upload a video to begin</div>
          </div>
        )}
      </div>

      {/* Timeline */}
      {hasFiles && selectedFile && (
        <Timeline
          currentTime={currentTime}
          duration={selectedFile.duration || 30}
          trimStart={trimStart}
          trimEnd={trimEnd}
          pixelsPerSecond={pixelsPerSecond}
          scrollOffset={scrollOffset}
          spriteMeta={spriteMeta}
          spriteImage={spriteImage}
          onTimeChange={handleTimeChange}
          onTrimChange={handleTrimChange}
          onZoomChange={setPixelsPerSecond}
          onScrollChange={setScrollOffset}
        />
      )}

      {/* Operation Toolbar — only when files exist */}
      {hasFiles && (
        <OperationToolbar
          active={activePanel}
          onSelect={setActivePanel}
        />
      )}

      {/* Active Operation Panel */}
      {PanelComponent && sessionId && selectedFileId && (
        <div className="border-t border-slate-700 p-4 max-h-[40vh] overflow-y-auto bg-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold capitalize">{activePanel}</h2>
            <button
              onClick={() => setActivePanel(null)}
              className="text-slate-400 text-sm"
            >
              Close
            </button>
          </div>
          <PanelComponent sessionId={sessionId} fileId={selectedFileId} videoRef={videoRef} trimStart={trimStart} trimEnd={trimEnd} onTrimChange={handleTrimChange} />
        </div>
      )}

      {/* Files List */}
      {!activePanel && (
        <div className="border-t border-slate-700 p-4 max-h-[40vh] overflow-y-auto">
          <h2 className="font-semibold mb-2">Files</h2>
          {filesLoading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : !hasFiles ? (
            <div>
              <label className="block w-full py-3 px-4 border-2 border-dashed border-slate-600 rounded-lg text-center text-slate-400 cursor-pointer hover:border-slate-500 transition-colors">
                <input
                  type="file"
                  accept="video/*,audio/*,image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && sessionId) {
                      const uploaded = await api.uploadFile(sessionId, file);
                      queryClient.invalidateQueries({ queryKey: ["files", sessionId] });
                      setSelectedFileId(uploaded.id);
                    }
                  }}
                />
                Tap to upload a file
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div
                  key={f.id}
                  className={`flex items-center gap-2 p-2 rounded text-sm transition-colors ${
                    f.id === selectedFileId
                      ? "bg-blue-900 border border-blue-600"
                      : "bg-slate-800 border border-transparent"
                  }`}
                >
                  <button
                    onClick={() => setSelectedFileId(f.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-medium truncate">{f.filename}</div>
                    <div className="text-xs text-slate-400">
                      {f.duration ? `${f.duration.toFixed(1)}s` : ""}{" "}
                      {f.width && f.height ? `${f.width}×${f.height}` : ""}
                      {" "}{(f.size / 1024 / 1024).toFixed(1)}MB
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(f);
                    }}
                    className="shrink-0 px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded text-xs"
                    title="Delete file"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <label className="block w-full py-2 px-4 border border-dashed border-slate-600 rounded text-center text-slate-400 text-sm cursor-pointer hover:border-slate-500">
                <input
                  type="file"
                  accept="video/*,audio/*,image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && sessionId) {
                      const uploaded = await api.uploadFile(sessionId, file);
                      queryClient.invalidateQueries({ queryKey: ["files", sessionId] });
                      setSelectedFileId(uploaded.id);
                    }
                  }}
                />
                + Add another file
              </label>
            </div>
          )}

          {/* Jobs */}
          {jobs && jobs.length > 0 && (
            <div className="mt-4">
              <h2 className="font-semibold mb-2">Jobs</h2>
              <div className="space-y-1">
                {(jobs as Job[]).map((j) => {
                  const isCompleted = j.status === "completed" && j.outputFile;
                  const isFailed = j.status === "failed";
                  return (
                    <button
                      key={j.id}
                      onClick={() => {
                        if (isCompleted) {
                          setSelectedFileId(j.outputFile);
                          setActivePanel(null);
                          queryClient.invalidateQueries({ queryKey: ["files", sessionId] });
                        }
                      }}
                      disabled={!isCompleted}
                      className={`w-full flex items-center justify-between p-2 rounded text-sm transition-colors ${
                        isCompleted
                          ? "bg-slate-800 hover:bg-slate-700 cursor-pointer"
                          : "bg-slate-800 cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="capitalize">{j.operation}</span>
                        {isCompleted && (
                          <span className="text-xs text-green-400">tap to view</span>
                        )}
                        {isFailed && j.error && (
                          <span className="text-xs text-red-400 truncate max-w-[150px]">{j.error}</span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        isCompleted ? "bg-green-900 text-green-300" :
                        isFailed ? "bg-red-900 text-red-300" :
                        j.status === "processing" ? "bg-blue-900 text-blue-300" :
                        "bg-slate-700 text-slate-300"
                      }`}>
                        {j.status === "processing" ? `${j.progress}%` : j.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete file confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-slate-800 rounded-xl p-5 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold">Delete File</h2>
            <p className="text-sm text-slate-300">
              Delete <strong>"{deleteConfirm.filename}"</strong>?
              {deleteConfirm.duration && (
                <span className="text-slate-400">
                  {" "}({deleteConfirm.duration.toFixed(1)}s, {(deleteConfirm.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              )}
            </p>
            <p className="text-sm text-slate-400">
              This will permanently remove the file from disk.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await api.deleteFile(deleteConfirm.id);
                  if (selectedFileId === deleteConfirm.id) {
                    setSelectedFileId(null);
                  }
                  queryClient.invalidateQueries({ queryKey: ["files", sessionId] });
                  setDeleteConfirm(null);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded font-medium text-sm transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
