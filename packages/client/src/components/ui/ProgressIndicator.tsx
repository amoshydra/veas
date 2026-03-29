interface Props {
  percent: number;
  status: string;
}

export default function ProgressIndicator({ percent, status }: Props) {
  if (status === "idle" || status === "completed") return null;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span className="capitalize">{status}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
