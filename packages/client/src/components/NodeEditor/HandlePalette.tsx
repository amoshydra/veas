import { useEffect, useRef } from "react";
import { NODE_DEFINITIONS } from "../../types/nodeGraph.js";
import type { NodeType, NodeDefinition } from "../../types/nodeGraph.js";

interface HandlePaletteProps {
  position: { x: number; y: number };
  portType: "video" | "audio" | "image";
  direction: "source" | "target";
  currentNodeType?: string;
  onSelect: (nodeType: NodeType) => void;
  onClose: () => void;
}

const RELEVANCE_MAP: Record<string, NodeType[]> = {
  fileInput: ["trim", "crop", "resize", "transcode"],
  fileOutput: [],
  trim: ["concat", "filter", "resize", "transcode", "fileOutput"],
  crop: ["resize", "concat", "filter", "transcode", "fileOutput"],
  resize: ["transcode", "concat", "filter", "fileOutput"],
  transcode: ["fileOutput", "trim", "crop", "resize"],
  filter: ["transcode", "concat", "fileOutput"],
  concat: ["fileOutput"],
  speed: ["transcode", "fileOutput"],
  rotate: ["resize", "fileOutput"],
  flip: ["resize", "fileOutput"],
  watermark: ["fileOutput"],
  pip: ["fileOutput"],
  audioExtract: ["fileOutput"],
  gif: [],
  reverse: ["concat", "fileOutput"],
  loop: ["concat", "fileOutput"],
  subtitle: ["fileOutput"],
};

function getCategoryPriority(nodeType: NodeType): number {
  const categoryOrder: Record<string, number> = {
    "input-output": 1,
    transform: 2,
    filter: 3,
    audio: 4,
    advanced: 5,
  };
  const def = NODE_DEFINITIONS[nodeType];
  return def ? categoryOrder[def.category] : 999;
}

export function HandlePalette({
  position,
  portType,
  direction,
  currentNodeType,
  onSelect,
  onClose,
}: HandlePaletteProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const relevantNodes = RELEVANCE_MAP[currentNodeType || ""] || [];

  const allNodes = Object.values(NODE_DEFINITIONS)
    .filter((def): def is NodeDefinition => def.implemented === true)
    .filter((def) => {
      if (direction === "source") {
        return def.inputs.some((p) => p.type === portType);
      } else {
        return def.outputs.some((p) => p.type === portType);
      }
    })
    .map((def) => def.type)
    .sort((a, b) => {
      const aRelevant = relevantNodes.indexOf(a);
      const bRelevant = relevantNodes.indexOf(b);
      if (aRelevant !== -1 && bRelevant === -1) return -1;
      if (aRelevant === -1 && bRelevant !== -1) return 1;
      if (aRelevant !== -1 && bRelevant !== -1) return aRelevant - bRelevant;
      const aCategory = getCategoryPriority(a);
      const bCategory = getCategoryPriority(b);
      if (aCategory !== bCategory) return aCategory - bCategory;
      return 0;
    });

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
    >
      <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase border-b border-slate-700">
        Add {portType} node
      </div>
      {allNodes.map((type) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="w-full px-3 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
        >
          <span>{NODE_DEFINITIONS[type].icon}</span>
          <span>{NODE_DEFINITIONS[type].label}</span>
        </button>
      ))}
    </div>
  );
}
