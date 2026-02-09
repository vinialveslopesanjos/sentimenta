"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";

interface SSEOptions {
  onMessage?: (event: string, data: any) => void;
  onError?: (error: Event) => void;
  onComplete?: (data: any) => void;
}

export function useSSE(url: string | null, options: SSEOptions = {}) {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "complete">("idle");
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!url) return;

    setStatus("connecting");

    const token = getToken();
    const separator = url.includes("?") ? "&" : "?";
    const fullUrl = `${url}${separator}token=${token}`;

    const es = new EventSource(fullUrl);
    eventSourceRef.current = es;

    es.onopen = () => setStatus("connected");

    es.addEventListener("progress", (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data);
        setData(parsed);
        options.onMessage?.("progress", parsed);
      } catch {}
    });

    es.addEventListener("complete", (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data);
        setData(parsed);
        setStatus("complete");
        options.onComplete?.(parsed);
      } catch {}
      es.close();
    });

    es.addEventListener("error", (e) => {
      // Check if it's a real error or just SSE reconnection
      if (es.readyState === EventSource.CLOSED) {
        setStatus("error");
        options.onError?.(e);
      }
    });

    es.onerror = (e) => {
      setStatus("error");
      options.onError?.(e);
      es.close();
    };
  }, [url]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return { data, status, connect, disconnect };
}
