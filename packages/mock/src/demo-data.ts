export const DEMO_SESSION_ID = "demo-session-001";
export const DEMO_FILE_ID = "demo-file-001";

export const DEMO_SESSIONS = [
  {
    id: DEMO_SESSION_ID,
    name: "Demo Project — Nature Clip",
    ownerId: "demo-owner",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T12:30:00Z",
  },
];

export const DEMO_FILES = [
  {
    id: DEMO_FILE_ID,
    sessionId: DEMO_SESSION_ID,
    filename: "nature_clip_4k.mp4",
    size: 52_428_800,
    mimeType: "video/mp4",
    duration: 30.5,
    width: 3840,
    height: 2160,
    fps: 30,
    videoCodec: "h264",
    audioCodec: "aac",
    bitrate: 13_740_000,
  },
];

export const DEMO_NODE_GRAPH = {
  id: "demo-graph-001",
  sessionId: DEMO_SESSION_ID,
  nodes: [
    {
      id: "node-input-1",
      type: "fileInput",
      position: { x: -353.46, y: 194.85 },
      config: {},
    },
    {
      id: "node-trim-1",
      type: "trim",
      position: { x: 22.47, y: 193.13 },
      config: { start: 2.5, end: 12 },
    },
    {
      id: "node-filter-1",
      type: "filter",
      position: { x: 499.7, y: 194.85 },
      config: { brightness: 0.1, contrast: 1.2, saturation: 1.1 },
    },
    {
      id: "node-transcode-1",
      type: "transcode",
      position: { x: 736.57, y: 191.42 },
      config: { codec: "libx264", crf: 23, preset: "medium" },
    },
    {
      id: "node-output-1",
      type: "fileOutput",
      position: { x: 970.57, y: 187.41 },
      config: { format: "mp4", quality: 23 },
    },
  ],
  connections: [
    {
      id: "edge-1",
      fromNode: "node-input-1",
      fromPort: "video",
      toNode: "node-trim-1",
      toPort: "video",
    },
    {
      id: "edge-2",
      fromNode: "node-trim-1",
      fromPort: "video",
      toNode: "node-filter-1",
      toPort: "video",
    },
    {
      id: "edge-3",
      fromNode: "node-filter-1",
      fromPort: "video",
      toNode: "node-transcode-1",
      toPort: "video",
    },
    {
      id: "edge-4",
      fromNode: "node-transcode-1",
      fromPort: "video",
      toNode: "node-output-1",
      toPort: "video",
    },
  ],
  viewport: { x: -100, y: 0, zoom: 0.8 },
};
