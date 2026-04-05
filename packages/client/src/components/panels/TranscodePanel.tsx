import { useState } from "react";
import type { RefObject } from "react";
import { api } from "../../api/client.js";
import ProgressIndicator from "../../components/ui/ProgressIndicator.js";
import { useSSE } from "../../hooks/useSSE.js";

interface Props {
  sessionId: string;
  fileId: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const CODECS = [
  { value: "libx264", label: "H.264 (MP4)" },
  { value: "libx265", label: "H.265 (HEVC)" },
  { value: "libvpx-vp9", label: "VP9 (WebM)" },
];

const PRESETS = ["ultrafast", "fast", "medium", "slow", "veryslow"];

export default function TranscodePanel({ sessionId, fileId }: Props) {
  const [codec, setCodec] = useState("libx264");
  const [crf, setCrf] = useState(23);
  const [preset, setPreset] = useState("medium");
  const [format, _setFormat] = useState("mp4");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const { progress, status } = useSSE(activeJobId);

  const handleTranscode = async () => {
    const result = await api.runOperation("transcode", {
      sessionId,
      inputFiles: [fileId],
      params: { codec, crf, preset, format },
    });
    setActiveJobId(result.id);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Codec</label>
        <select
          value={codec}
          onChange={(e) => setCodec(e.target.value)}
          className="w-full p-2 bg-slate-700 rounded text-sm border border-slate-600"
        >
          {CODECS.map((c) => (
            <option
              key={c.value}
              value={c.value}
            >
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Quality (CRF): {crf}</label>
          <input
            type="range"
            min="18"
            max="35"
            value={crf}
            onChange={(e) => setCrf(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Speed</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="w-full p-2 bg-slate-700 rounded text-sm border border-slate-600"
          >
            {PRESETS.map((p) => (
              <option
                key={p}
                value={p}
              >
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ProgressIndicator
        percent={progress}
        status={status}
      />

      <button
        onClick={handleTranscode}
        disabled={status === "processing" || status === "connecting"}
        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded font-medium text-sm transition-colors"
      >
        {status === "processing" ? `Converting... ${Math.round(progress)}%` : "Transcode"}
      </button>
    </div>
  );
}
