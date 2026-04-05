interface Props {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export default function BottomSheet({ children, isOpen, onClose, title }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-slate-800 rounded-t-2xl max-h-[60vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-slate-800 flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
