import { useCallback, useEffect, useRef, useState } from "react";

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

interface UseSSEOptions {
  onMessage?: (data: unknown) => void;
  onComplete?: (data: unknown) => void;
  onError?: (data: unknown) => void;
}

export function useSSE(jobId: string | null, options: UseSSEOptions = {}) {
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>("idle");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (!jobId) {
      cleanup();
      setStatus("idle");
      setProgress(0);
      return;
    }

    setStatus("connecting");

    async function setup() {
      if (IS_DEMO_MODE) {
        const mod = await import("@veas/mock");
        if (mod.getApiMode() === "mock") {
          const mockEs = await mod.createMockEventSource(`/api/jobs/${jobId}/stream`);
          setupEventSource(mockEs as unknown as EventSource);
          return;
        }
      }

      const es = new EventSource(`/api/jobs/${jobId}/stream`);
      setupEventSource(es);
    }

    setup();

    function setupEventSource(es: EventSource) {
      esRef.current = es;

      es.addEventListener("status", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setStatus(data.status);
        setProgress(data.progress || 0);
      });

      es.addEventListener("progress", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setProgress(data.percent || 0);
        optionsRef.current.onMessage?.(data);
      });

      es.addEventListener("complete", (e) => {
        const data = JSON.parse((e as MessageEvent).data);
        setStatus("completed");
        setProgress(100);
        setResult(data);
        optionsRef.current.onComplete?.(data);
        cleanup();
      });

      es.addEventListener("error", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setError(data.error);
        } catch {
          setError("Connection error");
        }
        setStatus("failed");
        optionsRef.current.onError?.(e.data);
        cleanup();
      });

      es.onerror = () => {
        // SSE auto-reconnects, no action needed
      };
    }

    return cleanup;
  }, [jobId, cleanup]);

  return { progress, status, result, error };
}
