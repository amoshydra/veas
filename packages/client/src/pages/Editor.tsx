import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client.js";
import OperationToolbar from "../components/OperationToolbar.js";
import TrimPanel from "../components/panels/TrimPanel.js";
import TranscodePanel from "../components/panels/TranscodePanel.js";

const PANEL_MAP: Record<string, React.ComponentType<{ sessionId: string }>> = {
  trim: TrimPanel,
  transcode: TranscodePanel,
};

interface Job {
  id: string;
  operation: string;
  status: string;
  progress: number;
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

  const PanelComponent = activePanel ? PANEL_MAP[activePanel] : null;

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between p-3 border-b border-slate-700">
        <a href="/" className="text-slate-400 text-sm">Back</a>
        <h1 className="font-bold">Editor</h1>
        <span className="text-xs text-slate-500">{sessionId?.slice(0, 8)}</span>
      </header>

      {/* Video Preview Placeholder */}
      <div className="flex-1 flex items-center justify-center bg-black min-h-[200px]">
        <div className="text-slate-500 text-center">
          <div className="text-4xl mb-2">🎬</div>
          <div className="text-sm">Upload a video to begin</div>
        </div>
      </div>

      {/* Operation Toolbar */}
      <OperationToolbar
        active={activePanel}
        onSelect={setActivePanel}
      />

      {/* Active Operation Panel */}
      {PanelComponent && sessionId && (
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
          <PanelComponent sessionId={sessionId} />
        </div>
      )}

      {/* Files List */}
      {!activePanel && (
        <div className="border-t border-slate-700 p-4 max-h-[40vh] overflow-y-auto">
          <h2 className="font-semibold mb-2">Files</h2>
          {filesLoading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : files?.length === 0 ? (
            <div>
              <label className="block w-full py-3 px-4 border-2 border-dashed border-slate-600 rounded-lg text-center text-slate-400 cursor-pointer hover:border-slate-500 transition-colors">
                <input
                  type="file"
                  accept="video/*,audio/*,image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && sessionId) {
                      await api.uploadFile(sessionId, file);
                      queryClient.invalidateQueries({ queryKey: ["files", sessionId] });
                    }
                  }}
                />
                Tap to upload a file
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              {files?.map((f) => (
                <div key={f.id} className="p-2 bg-slate-800 rounded text-sm">
                  <div className="font-medium truncate">{f.filename}</div>
                  <div className="text-xs text-slate-400">
                    {f.duration ? `${f.duration.toFixed(1)}s` : ""}{" "}
                    {f.width && f.height ? `${f.width}×${f.height}` : ""}
                    {" "}{(f.size / 1024 / 1024).toFixed(1)}MB
                  </div>
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
                      await api.uploadFile(sessionId, file);
                      queryClient.invalidateQueries({ queryKey: ["files", sessionId] });
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
                {(jobs as Job[]).map((j) => (
                  <div key={j.id} className="flex items-center justify-between p-2 bg-slate-800 rounded text-sm">
                    <span className="capitalize">{j.operation}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      j.status === "completed" ? "bg-green-900 text-green-300" :
                      j.status === "failed" ? "bg-red-900 text-red-300" :
                      j.status === "processing" ? "bg-blue-900 text-blue-300" :
                      "bg-slate-700 text-slate-300"
                    }`}>
                      {j.status === "processing" ? `${j.progress}%` : j.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
