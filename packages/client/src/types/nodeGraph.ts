export interface NodeGraph {
  id: string;
  sessionId: string;
  nodes: Node[];
  connections: Connection[];
  viewport: ViewportState;
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  config: Record<string, any>;
  status: "idle" | "queued" | "processing" | "completed" | "error";
  error?: string;
  outputId?: string;
  cachePath?: string;
}

export interface Connection {
  id: string;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export type NodeType =
  | "fileInput"
  | "fileOutput"
  | "trim"
  | "crop"
  | "resize"
  | "transcode"
  | "filter"
  | "speed"
  | "rotate"
  | "flip"
  | "concat"
  | "watermark"
  | "pip"
  | "audioExtract"
  | "gif"
  | "reverse"
  | "loop"
  | "subtitle";

export interface NodeDefinition {
  type: NodeType;
  label: string;
  icon: string;
  category: NodeCategory;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  defaultConfig: Record<string, any>;
  implemented?: boolean;
}

export interface PortDefinition {
  id: string;
  type: "video" | "audio" | "image";
  label: string;
}

export type NodeCategory = "input-output" | "transform" | "filter" | "audio" | "advanced";

export const NODE_CATEGORIES: Record<NodeCategory, string> = {
  "input-output": "Input / Output",
  transform: "Transform",
  filter: "Filter",
  audio: "Audio",
  advanced: "Advanced",
};

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  fileInput: {
    type: "fileInput",
    label: "Input",
    icon: "📁",
    category: "input-output",
    inputs: [],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { fileId: "" },
    implemented: true,
  },
  fileOutput: {
    type: "fileOutput",
    label: "Output",
    icon: "💾",
    category: "input-output",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [],
    defaultConfig: { format: "mp4", quality: 23 },
    implemented: true,
  },
  trim: {
    type: "trim",
    label: "Trim",
    icon: "✂️",
    category: "transform",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { start: 0, end: 10 },
    implemented: true,
  },
  crop: {
    type: "crop",
    label: "Crop",
    icon: "⬜",
    category: "transform",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { x: 0, y: 0, width: 1280, height: 720 },
    implemented: true,
  },
  resize: {
    type: "resize",
    label: "Resize",
    icon: "📐",
    category: "transform",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { width: 1280, height: 720 },
    implemented: true,
  },
  transcode: {
    type: "transcode",
    label: "Transcode",
    icon: "🔄",
    category: "transform",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { codec: "libx264", crf: 23, preset: "medium" },
    implemented: true,
  },
  filter: {
    type: "filter",
    label: "Filter",
    icon: "🎨",
    category: "filter",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { brightness: 0, contrast: 1, saturation: 1 },
  },
  speed: {
    type: "speed",
    label: "Speed",
    icon: "⚡",
    category: "transform",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { speed: 1 },
  },
  rotate: {
    type: "rotate",
    label: "Rotate",
    icon: "🔃",
    category: "transform",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { angle: 90 },
  },
  flip: {
    type: "flip",
    label: "Flip",
    icon: "↔️",
    category: "transform",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { direction: "horizontal" },
  },
  concat: {
    type: "concat",
    label: "Concat",
    icon: "🔗",
    category: "advanced",
    inputs: [
      { id: "video1", type: "video", label: "Video 1" },
      { id: "video2", type: "video", label: "Video 2" },
    ],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: {},
    implemented: true,
  },
  watermark: {
    type: "watermark",
    label: "Watermark",
    icon: "💧",
    category: "advanced",
    inputs: [
      { id: "video", type: "video", label: "Video" },
      { id: "image", type: "image", label: "Image" },
    ],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { position: "bottom-right", opacity: 1 },
  },
  pip: {
    type: "pip",
    label: "Picture-in-Picture",
    icon: "🖼️",
    category: "advanced",
    inputs: [
      { id: "main", type: "video", label: "Main" },
      { id: "overlay", type: "video", label: "Overlay" },
    ],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { x: 10, y: 10, width: 320 },
  },
  audioExtract: {
    type: "audioExtract",
    label: "Audio Extract",
    icon: "🎵",
    category: "audio",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "audio", type: "audio", label: "Audio" }],
    defaultConfig: { audioCodec: "libmp3lame", quality: 2 },
  },
  gif: {
    type: "gif",
    label: "GIF",
    icon: "🎞️",
    category: "advanced",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "image", type: "image", label: "GIF" }],
    defaultConfig: { fps: 10, width: 480 },
  },
  reverse: {
    type: "reverse",
    label: "Reverse",
    icon: "⏪",
    category: "transform",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { videoOnly: false },
  },
  loop: {
    type: "loop",
    label: "Loop",
    icon: "🔁",
    category: "advanced",
    inputs: [{ id: "video", type: "video", label: "Video" }],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { count: 2 },
  },
  subtitle: {
    type: "subtitle",
    label: "Subtitle",
    icon: "💬",
    category: "advanced",
    inputs: [
      { id: "video", type: "video", label: "Video" },
      { id: "srt", type: "image", label: "SRT File" },
    ],
    outputs: [{ id: "video", type: "video", label: "Video" }],
    defaultConfig: { subtitlePath: "" },
  },
};
