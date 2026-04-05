import { Handle, Position } from "@xyflow/react";
import { useRef, useState } from "react";

interface ConnectionHandleProps {
  type: "source" | "target";
  position: Position;
  id: string;
  portType: "video" | "audio" | "image";
  onClick?: (
    info: { handleId: string; portType: string; type: "source" | "target" },
    position: { x: number; y: number },
  ) => void;
  onDragStart?: (info: { handleId: string; portType: string; type: "source" | "target" }) => void;
  style?: React.CSSProperties;
}

const colorMap = {
  video: "bg-blue-400",
  audio: "bg-purple-400",
  image: "bg-green-400",
};

export function ConnectionHandle({
  type,
  position,
  id,
  portType,
  onClick,
  onDragStart,
  style,
}: ConnectionHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      if (!isDragging) {
        onDragStart?.({ handleId: id, portType, type });
      }
      setIsDragging(true);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      onClick?.({ handleId: id, portType, type }, { x: rect.x, y: rect.y });
    }
    startRef.current = null;
    setIsDragging(false);
  };

  const translateX = position === Position.Left ? "-translate-x-1/2" : "translate-x-1/2";
  const color = colorMap[portType];

  return (
    <Handle
      type={type}
      position={position}
      id={id}
      className={`!w-7 !h-7 !rounded-full ${color} !border-2 !border-slate-900 !cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all ${translateX} flex items-center justify-center`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={style}
    >
      <span className="text-white text-sm font-bold leading-none select-none pointer-events-none">
        +
      </span>
    </Handle>
  );
}
