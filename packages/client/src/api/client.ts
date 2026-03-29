const API_BASE = "/api";

const ownerId = (() => {
  let id = localStorage.getItem("veas_owner_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("veas_owner_id", id);
  }
  return id;
})();

const headers = {
  "x-owner-id": ownerId,
  "Content-Type": "application/json",
};

export const api = {
  // Sessions
  listSessions: () =>
    fetch(`${API_BASE}/sessions?ownerId=${ownerId}`).then((r) => r.json()),

  createSession: (data: { name?: string }) =>
    fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...data, ownerId }),
    }).then((r) => r.json()),

  getSession: (id: string) =>
    fetch(`${API_BASE}/sessions/${id}`, { headers }).then((r) => r.json()),

  updateSession: (id: string, data: Record<string, unknown>) =>
    fetch(`${API_BASE}/sessions/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  deleteSession: (id: string) =>
    fetch(`${API_BASE}/sessions/${id}`, {
      method: "DELETE",
      headers,
    }).then((r) => r.json()),

  // Files
  uploadFile: (sessionId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", sessionId);
    return fetch(`${API_BASE}/files/upload`, {
      method: "POST",
      body: formData,
    }).then((r) => r.json());
  },

  listFiles: (sessionId: string) =>
    fetch(`${API_BASE}/files?sessionId=${sessionId}`, { headers }).then((r) =>
      r.json()
    ),

  getFileProbe: (fileId: string) =>
    fetch(`${API_BASE}/files/${fileId}/probe`, { headers }).then((r) => r.json()),

  // Jobs
  listJobs: (sessionId: string) =>
    fetch(`${API_BASE}/jobs?sessionId=${sessionId}`, { headers }).then((r) =>
      r.json()
    ),

  createJob: (data: {
    sessionId: string;
    operation: string;
    inputFiles: string[];
    params: Record<string, unknown>;
  }) =>
    fetch(`${API_BASE}/jobs`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // Operations
  runOperation: (
    operation: string,
    data: {
      sessionId: string;
      inputFiles: string[];
      params: Record<string, unknown>;
    }
  ) =>
    fetch(`${API_BASE}/operations/${operation}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  // SSE
  subscribeToJob: (jobId: string) =>
    new EventSource(`${API_BASE}/jobs/${jobId}/stream`),
};
