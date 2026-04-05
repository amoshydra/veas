const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

let _worker: ReturnType<typeof import("msw/browser").setupWorker> | null = null;
let _mockMode = false;

async function startMockWorker() {
  if (_mockMode) return;
  const { setupWorker } = await import("msw/browser");
  const { handlers } = await import("./handlers.js");
  _worker = setupWorker(...handlers);
  await _worker.start({
    onUnhandledRequest: "bypass",
  });
  _mockMode = true;
}

export function getApiMode(): "mock" {
  return "mock";
}

export async function createMockEventSource(url: string): Promise<unknown> {
  const mod = await import("./sse.js");
  return mod.createMockEventSource(url);
}

export function setMockPipelineNodes(
  nodes: Array<{ id: string; type: string; config: Record<string, unknown> }>,
  sessionId?: string,
  inputFileId?: string,
) {
  import("./sse.js").then((mod) => mod.setMockPipelineNodes(nodes, sessionId, inputFileId));
}

if (IS_DEMO_MODE) {
  startMockWorker();
}
