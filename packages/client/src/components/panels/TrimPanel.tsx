import { useState } from "react";
import { api } from "../../api/client.js";
import ProgressIndicator from "../../components/ui/ProgressIndicator.js";
import { useSSE } from "../../hooks/useSSE.js";

interface Props {
  sessionId: string;
  fileId: string;
}

export default function TrimPanel({ sessionId, fileId }: Props) {
  const [start, setStart] = useState("00:00:00");
  const [end, setEnd] = useState("00:00:10");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { progress, status } = useSSE(activeJobId);

  const handleTrim = async () => {
    const result = await api.runOperation("trim", {
      sessionId,
      inputFiles: [fileId],
      params: { start, end, format: "mp4" },
    });
    setActiveJobId(result.id);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Start</label>
          <input
            type="text"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="00:00:00"
            className="w-full p-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">End</label>
          <input
            type="text"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="00:00:10"
            className="w-full p-2 bg-slate-700 rounded text-sm border border-slate-600 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <ProgressIndicator percent={progress} status={status} />

      <button
        onClick={handleTrim}
        disabled={status === "processing" || status === "connecting"}
        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded font-medium text-sm transition-colors"
      >
        {status === "processing" ? `Trimming... ${Math.round(progress)}%` : "Trim Video"}
      </button>
    </div>
  );
}
