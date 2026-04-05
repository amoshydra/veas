export interface Session {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  fileCount: number;
  totalSize: number;
}

export interface FileProbe {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  bitrate: number;
}

export interface Job {
  id: string;
  sessionId: string;
  operation: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  inputFiles: string[];
  outputFile?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PipelineNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export interface PipelineConnection {
  id: string;
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
}

export interface PipelineExecuteRequest {
  sessionId: string;
  nodes: PipelineNode[];
  connections: PipelineConnection[];
}

export interface PipelineExecuteResponse {
  pipelineId: string;
}

export interface PipelineSaveRequest {
  sessionId: string;
  nodes?: PipelineNode[];
  connections?: PipelineConnection[];
  viewport?: { x: number; y: number; zoom: number };
  name?: string;
}

export interface PipelineGraph {
  id: string;
  sessionId: string;
  nodes: PipelineNode[];
  connections: PipelineConnection[];
  viewport: { x: number; y: number; zoom: number };
}

export interface SSEProgressEvent {
  nodeId: string;
  status: "queued" | "processing" | "completed" | "error";
  progress: number;
  outputId?: string;
  error?: string;
}

export interface ApiClient {
  listSessions: () => Promise<Session[]>;
  createSession: (data: { name?: string }) => Promise<Session>;
  getSession: (id: string) => Promise<Session>;
  updateSession: (id: string, data: Record<string, unknown>) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  getSessionSummary: (id: string) => Promise<SessionSummary>;

  uploadFile: (sessionId: string, file: File) => Promise<{ id: string }>;
  listFiles: (sessionId: string) => Promise<FileProbe[]>;
  getFileProbe: (fileId: string) => Promise<FileProbe>;
  deleteFile: (fileId: string) => Promise<void>;
  getFileSprite: (fileId: string) => Promise<string>;

  listJobs: (sessionId: string) => Promise<Job[]>;
  createJob: (data: {
    sessionId: string;
    operation: string;
    inputFiles: string[];
    params: Record<string, unknown>;
  }) => Promise<Job>;

  runOperation: (
    operation: string,
    data: {
      sessionId: string;
      inputFiles: string[];
      params: Record<string, unknown>;
    },
  ) => Promise<Job>;

  subscribeToJob: (jobId: string) => EventSource;
  subscribeToPipeline: (pipelineId: string) => EventSource;

  executePipeline: (
    sessionId: string,
    nodes: PipelineNode[],
    connections: PipelineConnection[],
  ) => Promise<PipelineExecuteResponse>;

  saveNodeGraph: (sessionId: string, data: PipelineSaveRequest) => Promise<void>;

  getNodeGraph: (sessionId: string) => Promise<PipelineGraph>;

  testConnection: (serverUrl: string) => Promise<boolean>;
}

export type ApiMode = "real" | "mock";

export interface ApiConfig {
  mode: ApiMode;
  serverUrl?: string;
}
