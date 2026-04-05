import { useState, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import { api } from "../../api/client.js";
import ProgressIndicator from "../../components/ui/ProgressIndicator.js";
import { useSSE } from "../../hooks/useSSE.js";

interface Props {
  sessionId: string;
  fileId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  trimStart?: number;
  trimEnd?: number;
  onTrimChange?: (start: number, end: number) => void;
}

function formatTime(secs: number): string {
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
  }
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

function parseTime(time: string): number {
  if (/^\d+(\.\d+)?$/.test(time)) return parseFloat(time);
  if (/^\d{1,2}:\d{1,2}(\.\d+)?$/.test(time)) {
    const [m, s] = time.split(":");
    return parseInt(m) * 60 + parseFloat(s);
  }
  const match = time.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (match) {
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
  }
  return 0;
}

const FRAME_STEP = 1 / 30; // ~30fps default

export default function TrimPanel({
  sessionId,
  fileId,
  videoRef,
  trimStart,
  trimEnd,
  onTrimChange,
}: Props) {
  const [start, setStart] = useState(trimStart != null ? formatTime(trimStart) : "00:00.000");
  const [end, setEnd] = useState(trimEnd != null ? formatTime(trimEnd) : "00:10.000");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Sync from parent (timeline drag)
  useEffect(() => {
    if (trimStart != null) setStart(formatTime(trimStart));
  }, [trimStart]);

  useEffect(() => {
    if (trimEnd != null) setEnd(formatTime(trimEnd));
  }, [trimEnd]);
  const [currentTime, setCurrentTime] = useState("00:00.000");

  const { progress, status } = useSSE(activeJobId);

  // Poll video currentTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => setCurrentTime(formatTime(video.currentTime));
    video.addEventListener("timeupdate", update);
    video.addEventListener("seeked", update);
    update();

    return () => {
      video.removeEventListener("timeupdate", update);
      video.removeEventListener("seeked", update);
    };
  }, [videoRef]);

  const useCurrentAsStart = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setStart(formatTime(video.currentTime));
      onTrimChange?.(video.currentTime, parseTime(end));
    }
  }, [videoRef, end, onTrimChange]);

  const useCurrentAsEnd = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setEnd(formatTime(video.currentTime));
      onTrimChange?.(parseTime(start), video.currentTime);
    }
  }, [videoRef, start, onTrimChange]);

  const stepFrame = useCallback(
    (direction: 1 | -1) => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      video.currentTime = Math.max(0, video.currentTime + FRAME_STEP * direction);
    },
    [videoRef],
  );

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
      {/* Frame step controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => stepFrame(-1)}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          title="Previous frame"
        >
          ◀
        </button>
        <span className="text-sm font-mono text-slate-300 min-w-[90px] text-center">
          {currentTime}
        </span>
        <button
          onClick={() => stepFrame(1)}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          title="Next frame"
        >
          ▶
        </button>
      </div>

      {/* Start / End inputs with "use current" buttons */}
      <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Start</label>
          <input
            type="text"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="00:00.000"
            className="w-full p-2 bg-slate-700 rounded text-sm font-mono border border-slate-600 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={useCurrentAsStart}
          className="px-2 py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs whitespace-nowrap"
          title="Set start to current position"
        >
          Set
        </button>
        <div>
          <label className="block text-xs text-slate-400 mb-1">End</label>
          <input
            type="text"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="00:10.000"
            className="w-full p-2 bg-slate-700 rounded text-sm font-mono border border-slate-600 focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={useCurrentAsEnd}
          className="px-2 py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs whitespace-nowrap"
          title="Set end to current position"
        >
          Set
        </button>
      </div>

      <p className="text-xs text-slate-500">Format: MM:SS.mmm or HH:MM:SS.mmm</p>

      <ProgressIndicator
        percent={progress}
        status={status}
      />

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
