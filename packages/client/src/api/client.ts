const getOwnerId = () => {
  let id = localStorage.getItem("veas_owner_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("veas_owner_id", id);
  }
  return id;
};

const getHeaders = () => ({
  "x-owner-id": getOwnerId(),
  "Content-Type": "application/json",
});

let _baseUrl: string = "/api";

function getApiBase() {
  return localStorage.getItem("veas_server_url") || "/api";
}

export class RealApiClient {
  constructor(baseUrl?: string) {
    _baseUrl = baseUrl || getApiBase() || "/api";
  }

  get baseUrl() {
    return _baseUrl;
  }

  async listSessions() {
    const ownerId = getOwnerId();
    const res = await fetch(`${_baseUrl}/sessions?ownerId=${ownerId}`);
    return res.json();
  }

  async createSession(data: { name?: string }) {
    const ownerId = getOwnerId();
    const res = await fetch(`${_baseUrl}/sessions`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ ...data, ownerId }),
    });
    return res.json();
  }

  async getSession(id: string) {
    const res = await fetch(`${_baseUrl}/sessions/${id}`, {
      headers: getHeaders(),
    });
    return res.json();
  }

  async updateSession(id: string, data: Record<string, unknown>) {
    const res = await fetch(`${_baseUrl}/sessions/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async deleteSession(id: string) {
    const res = await fetch(`${_baseUrl}/sessions/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return res.json();
  }

  async getSessionSummary(id: string) {
    const res = await fetch(`${_baseUrl}/sessions/${id}/summary`, {
      headers: getHeaders(),
    });
    return res.json();
  }

  async uploadFile(
    sessionId: string,
    file: File,
    onProgress?: (progress: number) => void,
  ) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${_baseUrl}/files/upload`);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", sessionId);
      xhr.send(formData);
    });
  }

  async listFiles(sessionId: string) {
    const res = await fetch(`${_baseUrl}/files?sessionId=${sessionId}`, {
      headers: getHeaders(),
    });
    return res.json();
  }

  async getFileProbe(fileId: string) {
    const res = await fetch(`${_baseUrl}/files/${fileId}/probe`, {
      headers: getHeaders(),
    });
    return res.json();
  }

  async deleteFile(fileId: string) {
    const res = await fetch(`${_baseUrl}/files/${fileId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return res.json();
  }

  async getFileSprite(fileId: string) {
    const res = await fetch(`${_baseUrl}/files/${fileId}/sprite`, {
      headers: getHeaders(),
    });
    return res.json();
  }

  async listJobs(sessionId: string) {
    const res = await fetch(`${_baseUrl}/jobs?sessionId=${sessionId}`, {
      headers: getHeaders(),
    });
    return res.json();
  }

  async createJob(data: {
    sessionId: string;
    operation: string;
    inputFiles: string[];
    params: Record<string, unknown>;
  }) {
    const res = await fetch(`${_baseUrl}/jobs`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async runOperation(
    operation: string,
    data: {
      sessionId: string;
      inputFiles: string[];
      params: Record<string, unknown>;
    },
  ) {
    const res = await fetch(`${_baseUrl}/operations/${operation}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  subscribeToJob(jobId: string) {
    return new EventSource(`${_baseUrl}/jobs/${jobId}/stream`);
  }

  subscribeToPipeline(pipelineId: string) {
    return new EventSource(`${_baseUrl}/pipelines/stream/${pipelineId}`);
  }

  async executePipeline(
    sessionId: string,
    nodes: Array<{ id: string; type: string; config: Record<string, unknown> }>,
    connections: Array<{
      id: string;
      fromNode: string;
      fromPort: string;
      toNode: string;
      toPort: string;
    }>,
  ) {
    const res = await fetch(`${_baseUrl}/pipelines/execute`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ sessionId, nodes, connections }),
    });
    return res.json();
  }

  async saveNodeGraph(
    sessionId: string,
    data: {
      nodes?: unknown[];
      connections?: unknown[];
      viewport?: { x: number; y: number; zoom: number };
      name?: string;
    },
  ) {
    const res = await fetch(`${_baseUrl}/pipelines/save`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ sessionId, ...data }),
    });
    return res.json();
  }

  async getNodeGraph(sessionId: string) {
    const res = await fetch(`${_baseUrl}/pipelines/${sessionId}`, {
      headers: getHeaders(),
    });
    return res.json();
  }

  async testConnection(serverUrl: string) {
    try {
      const res = await fetch(`${serverUrl}/api/health`, {
        method: "GET",
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const api = new RealApiClient();
