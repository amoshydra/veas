import { getFile, saveFile, type MockFileRecord } from "./storage.js";

type MockEventListener = (e: MessageEvent) => void;

class MockEventSource {
  onerror: ((this: MockEventSource, ev: Event) => any) | null = null;
  onmessage: ((this: MockEventSource, ev: MessageEvent) => any) | null = null;
  onopen: ((this: MockEventSource, ev: Event) => any) | null = null;
  readonly CLOSED = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readyState: number = 1;
  readonly url: string;
  readonly withCredentials = false;

  dispatchEvent(event: Event): boolean {
    return true;
  }

  private _interval: ReturnType<typeof setInterval> | null = null;
  private _listeners: Map<string, Set<MockEventListener>> = new Map();
  private _pipelineNodes: Array<{ id: string; type: string; config: Record<string, unknown> }>;
  private _sessionId: string = "";
  private _inputFileId: string = "";

  constructor(
    url: string,
    pipelineNodes?: Array<{ id: string; type: string; config: Record<string, unknown> }>,
    sessionId?: string,
    inputFileId?: string,
  ) {
    this.url = url;
    this._pipelineNodes = pipelineNodes || [];
    this._sessionId = sessionId || "";
    this._inputFileId = inputFileId || "";
    this._simulateProgress();
  }

  private _dispatchEvent(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    const listeners = this._listeners.get(type);
    if (listeners) {
      listeners.forEach((fn) => fn(event));
    }
    if (this.onmessage && type === "message") {
      this.onmessage.call(this, event);
    }

    // Also dispatch nodeComplete when status is completed
    if (type === "status" && typeof data === "object" && data !== null) {
      const d = data as Record<string, unknown>;
      if (d.status === "completed") {
        const nodeCompleteEvent = new MessageEvent("nodeComplete", { data: JSON.stringify(d) });
        const nodeCompleteListeners = this._listeners.get("nodeComplete");
        if (nodeCompleteListeners) {
          nodeCompleteListeners.forEach((fn) => fn(nodeCompleteEvent));
        }
      }
    }
  }

  private async _createOutputFile(nodeId: string, nodeType: string): Promise<string> {
    const outputId = `demo-output-${nodeId}-${Date.now()}`;

    let inputBlob: Blob | null = null;

    if (this._inputFileId) {
      const inputFile = await getFile(this._inputFileId);
      if (inputFile) {
        inputBlob = inputFile.blob;
      }
    }

    if (!inputBlob) {
      inputBlob = new Blob(["dummy video content"], { type: "video/mp4" });
    }

    let mimeType = "video/mp4";
    let filename = "output.mp4";

    switch (nodeType) {
      case "transcode":
        mimeType = "video/mp4";
        filename = "output-transcoded.mp4";
        break;
      case "filter":
        mimeType = "video/mp4";
        filename = "output-filtered.mp4";
        break;
      case "trim":
        mimeType = "video/mp4";
        filename = "output-trimmed.mp4";
        break;
      default:
        filename = "output.mp4";
    }

    const outputFile: MockFileRecord = {
      id: outputId,
      sessionId: this._sessionId,
      filename,
      size: inputBlob.size,
      mimeType,
      blob: inputBlob,
      duration: 30,
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: "h264",
      audioCodec: "aac",
      bitrate: 8000000,
      isInput: false,
    };

    await saveFile(outputFile);
    return outputId;
  }

  private async _simulateProgress() {
    const nodes = this._pipelineNodes;
    if (nodes.length === 0) {
      this._dispatchEvent("complete", { message: "Pipeline complete" });
      return;
    }

    let nodeIndex = 0;
    let progress = 0;

    this._dispatchEvent("status", {
      nodeId: nodes[0].id,
      status: "queued",
      progress: 0,
    });

    this._interval = setInterval(async () => {
      if (nodeIndex >= nodes.length) {
        if (this._interval) clearInterval(this._interval);
        this._dispatchEvent("complete", { message: "Pipeline complete" });
        this.readyState = 2;
        return;
      }

      const currentNode = nodes[nodeIndex];

      if (progress === 0) {
        this._dispatchEvent("status", {
          nodeId: currentNode.id,
          status: "processing",
          progress: 0,
        });
      }

      progress += 10;
      this._dispatchEvent("progress", {
        nodeId: currentNode.id,
        status: "processing",
        progress,
      });

      if (progress >= 100) {
        const outputId = await this._createOutputFile(currentNode.id, currentNode.type);

        this._dispatchEvent("status", {
          nodeId: currentNode.id,
          status: "completed",
          progress: 100,
          outputId,
        });

        nodeIndex++;
        progress = 0;

        if (nodeIndex < nodes.length) {
          this._dispatchEvent("status", {
            nodeId: nodes[nodeIndex].id,
            status: "queued",
            progress: 0,
          });
        }
      }
    }, 100);
  }

  addEventListener(type: string, listener: MockEventListener): void {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: MockEventListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  close(): void {
    if (this._interval) clearInterval(this._interval);
    this.readyState = 2;
  }
}

let lastPipelineNodes: Array<{ id: string; type: string; config: Record<string, unknown> }> = [];
let lastSessionId: string = "";
let lastInputFileId: string = "";

export function createMockEventSource(url: string): MockEventSource {
  return new MockEventSource(url, lastPipelineNodes, lastSessionId, lastInputFileId);
}

export function setMockPipelineNodes(
  nodes: Array<{ id: string; type: string; config: Record<string, unknown> }>,
  sessionId?: string,
  inputFileId?: string,
) {
  lastPipelineNodes = nodes;
  lastSessionId = sessionId || "";
  lastInputFileId = inputFileId || "";
}
