import { useState, useEffect, useRef, useCallback } from "react";

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

  useEffect(() => {
    if (!jobId) {
      cleanup();
      setStatus("idle");
      setProgress(0);
      return;
    }

    setStatus("connecting");
    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    esRef.current = es;

    es.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setStatus(data.status);
      setProgress(data.progress || 0);
    });

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.percent || 0);
      options.onMessage?.(data);
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setStatus("completed");
      setProgress(100);
      setResult(data);
      options.onComplete?.(data);
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
      options.onError?.(e.data);
      cleanup();
    });

    es.onerror = () => {
      // SSE auto-reconnects, no action needed
    };

    return cleanup;
  }, [jobId]);

  return { progress, status, result, error };
}
