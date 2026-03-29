const OPERATIONS = [
  { id: "trim", label: "Trim", icon: "✂️" },
  { id: "crop", label: "Crop", icon: "🔲" },
  { id: "concat", label: "Join", icon: "🔗" },
  { id: "transcode", label: "Convert", icon: "🔄" },
  { id: "resize", label: "Resize", icon: "📐" },
  { id: "filter", label: "Filter", icon: "🎨" },
  { id: "gif", label: "GIF", icon: "🖼️" },
  { id: "speed", label: "Speed", icon: "⚡" },
  { id: "audio-extract", label: "Audio", icon: "🎵" },
  { id: "watermark", label: "Mark", icon: "💧" },
  { id: "rotate", label: "Rotate", icon: "🔄" },
  { id: "flip", label: "Flip", icon: "↔️" },
  { id: "thumbnail", label: "Thumb", icon: "📸" },
];

interface Props {
  active: string | null;
  onSelect: (id: string | null) => void;
}

export default function OperationToolbar({ active, onSelect }: Props) {
  return (
    <div className="flex overflow-x-auto gap-1 p-2 border-t border-slate-700 bg-slate-900 scrollbar-hide">
      {OPERATIONS.map((op) => (
        <button
          key={op.id}
          onClick={() => onSelect(active === op.id ? null : op.id)}
          className={`flex flex-col items-center min-w-[60px] px-2 py-2 rounded-lg text-xs transition-colors ${
            active === op.id
              ? "bg-blue-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <span className="text-lg mb-0.5">{op.icon}</span>
          {op.label}
        </button>
      ))}
    </div>
  );
}
