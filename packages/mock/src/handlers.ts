import { http, HttpResponse } from "msw";
import { DEMO_SESSION_ID, DEMO_SESSIONS, DEMO_FILES, DEMO_NODE_GRAPH } from "./demo-data.js";
import {
  getFile,
  saveFile,
  getFilesBySession,
  getAllFiles,
  deleteFile as deleteFileFromDB,
  type MockFileRecord,
} from "./storage.js";

const API_BASE = "/api";

let sessions: Array<{
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}> = [];
let jobs: Array<{
  id: string;
  sessionId: string;
  operation: string;
  status: string;
  progress: number;
  inputFiles: string[];
  params: Record<string, unknown>;
  createdAt: string;
}> = [];

function getOwnerId(headers: Headers) {
  return headers.get("x-owner-id") || "demo-owner";
}

function generateFakeProbe(file: File): Omit<MockFileRecord, "id" | "sessionId" | "blob"> {
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");

  return {
    filename: file.name,
    size: file.size,
    mimeType: file.type,
    duration: isVideo || isAudio ? Math.random() * 60 + 10 : 0,
    width: isVideo ? 1920 : 0,
    height: isVideo ? 1080 : 0,
    fps: isVideo ? 30 : 0,
    videoCodec: isVideo ? "h264" : "",
    audioCodec: isAudio ? "aac" : "",
    bitrate: isVideo ? 8000000 : 0,
    isInput: true,
  };
}

function getParamId(params: Record<string, unknown>): string {
  const id = params.id;
  if (Array.isArray(id)) return id[0] as string;
  if (typeof id === "string") return id;
  return "";
}

function getSessionIdParam(params: Record<string, unknown>): string {
  const id = params.sessionId;
  if (Array.isArray(id)) return id[0] as string;
  if (typeof id === "string") return id;
  return "";
}

export const handlers = [
  // Health check
  http.get(`${API_BASE}/health`, () => {
    return HttpResponse.json({ status: "ok", mode: "demo" });
  }),

  // Sessions
  http.get(`${API_BASE}/sessions`, ({ request }) => {
    const headers = new Headers(request.headers);
    const ownerId = getOwnerId(headers);
    const url = new URL(request.url);
    const filterOwnerId = url.searchParams.get("ownerId");
    const filtered = filterOwnerId
      ? sessions.filter((s) => s.ownerId === filterOwnerId || s.ownerId === "demo-owner")
      : sessions;
    return HttpResponse.json(filtered);
  }),

  http.post(`${API_BASE}/sessions`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const session = {
      id: crypto.randomUUID(),
      name: (body.name as string) || "New Project",
      ownerId: (body.ownerId as string) || "demo-owner",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessions = [...sessions, session];
    return HttpResponse.json(session, { status: 201 });
  }),

  http.get(`${API_BASE}/sessions/:id`, ({ params }) => {
    const id = getParamId(params);
    const session = sessions.find((s) => s.id === id);
    if (!session) return HttpResponse.json({ error: "Session not found" }, { status: 404 });
    return HttpResponse.json(session);
  }),

  http.put(`${API_BASE}/sessions/:id`, async ({ params, request }) => {
    const id = getParamId(params);
    const body = (await request.json()) as Record<string, unknown>;
    sessions = sessions.map((s) =>
      s.id === id ? { ...s, ...body, updatedAt: new Date().toISOString() } : s,
    );
    const updated = sessions.find((s) => s.id === id)!;
    return HttpResponse.json(updated);
  }),

  http.delete(`${API_BASE}/sessions/:id`, ({ params }) => {
    const id = getParamId(params);
    sessions = sessions.filter((s) => s.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API_BASE}/sessions/:id/summary`, async ({ params }) => {
    const id = getParamId(params);
    const sessionFiles = await getFilesBySession(id);
    return HttpResponse.json({
      fileCount: sessionFiles.length,
      totalSize: sessionFiles.reduce((sum, f) => sum + f.size, 0),
    });
  }),

  // Files - upload
  http.post(`${API_BASE}/files/upload`, async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string;

    if (!file) {
      return HttpResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileId = crypto.randomUUID();
    const probeData = generateFakeProbe(file);

    const mockFile: MockFileRecord = {
      id: fileId,
      sessionId,
      blob: file,
      ...probeData,
    };

    await saveFile(mockFile);

    return HttpResponse.json({ id: fileId, ...probeData }, { status: 201 });
  }),

  // Files - list
  http.get(`${API_BASE}/files`, async ({ request }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    let files = await getAllFiles();

    if (sessionId) {
      files = files.filter((f) => f.sessionId === sessionId);
    }

    // Filter out cached/processed output files (created during pipeline execution)
    files = files.filter((f) => f.isInput === true);

    const probes = files.map(({ blob, isInput, ...rest }) => rest);
    return HttpResponse.json(probes);
  }),

  // Files - get actual file data
  http.get(`${API_BASE}/files/:id`, async ({ params }) => {
    const id = getParamId(params);
    const file = await getFile(id);
    if (!file) {
      return HttpResponse.json({ error: "File not found" }, { status: 404 });
    }
    return new HttpResponse(file.blob, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.filename}"`,
      },
    });
  }),

  // Files - get probe data
  http.get(`${API_BASE}/files/:id/probe`, async ({ params }) => {
    const id = getParamId(params);
    const file = await getFile(id);
    if (!file) {
      const demoFile = DEMO_FILES.find((f) => f.id === id);
      if (demoFile) {
        return HttpResponse.json(demoFile);
      }
      return HttpResponse.json({ error: "File not found" }, { status: 404 });
    }
    const { blob, ...probe } = file;
    return HttpResponse.json(probe);
  }),

  // Files - delete
  http.delete(`${API_BASE}/files/:id`, async ({ params }) => {
    const id = getParamId(params);
    await deleteFileFromDB(id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Files - sprite (placeholder for demo)
  http.get(`${API_BASE}/files/:id/sprite`, () => {
    return HttpResponse.json({ url: null, frames: [] });
  }),

  // Files - cache for processed outputs
  http.get(`${API_BASE}/files/cache/:sessionId/:id`, async ({ params }) => {
    const id = getParamId(params);
    const file = await getFile(id);
    if (!file) {
      return HttpResponse.json({ error: "File not found" }, { status: 404 });
    }
    return new HttpResponse(file.blob, {
      headers: {
        "Content-Type": file.mimeType,
      },
    });
  }),

  // Jobs
  http.get(`${API_BASE}/jobs`, ({ request }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const filtered = sessionId ? jobs.filter((j) => j.sessionId === sessionId) : jobs;
    return HttpResponse.json(filtered);
  }),

  http.post(`${API_BASE}/jobs`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const job = {
      id: crypto.randomUUID(),
      sessionId: body.sessionId as string,
      operation: body.operation as string,
      status: "queued",
      progress: 0,
      inputFiles: body.inputFiles as string[],
      params: (body.params as Record<string, unknown>) || {},
      createdAt: new Date().toISOString(),
    };
    jobs = [...jobs, job];
    return HttpResponse.json(job, { status: 201 });
  }),

  // Operations
  http.post(`${API_BASE}/operations/:operation`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const job = {
      id: crypto.randomUUID(),
      sessionId: body.sessionId as string,
      operation: params.operation as string,
      status: "queued",
      progress: 0,
      inputFiles: body.inputFiles as string[],
      params: (body.params as Record<string, unknown>) || {},
      createdAt: new Date().toISOString(),
    };
    jobs = [...jobs, job];
    return HttpResponse.json(job, { status: 201 });
  }),

  // Pipelines
  http.post(`${API_BASE}/pipelines/execute`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      pipelineId: crypto.randomUUID(),
      sessionId: body.sessionId,
    });
  }),

  http.post(`${API_BASE}/pipelines/save`, async () => {
    return HttpResponse.json({ saved: true });
  }),

  http.get(`${API_BASE}/pipelines/:sessionId`, () => {
    return HttpResponse.json(DEMO_NODE_GRAPH);
  }),
];
