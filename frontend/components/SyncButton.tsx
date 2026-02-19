"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { connectionsApi, pipelineApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useSSE } from "@/components/hooks/useSSE";
import { loadSyncSettings, toSyncPayload } from "@/lib/syncSettings";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Props {
  connectionId: string;
  onComplete?: () => void;
}

export default function SyncButton({ connectionId, onComplete }: Props) {
  const [state, setState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [progress, setProgress] = useState(0);

  const sseUrl = taskId ? `${API_URL}/pipeline/runs/${taskId}/stream` : null;

  const { data: sseData, status: sseStatus, connect: sseConnect } = useSSE(sseUrl, {
    onMessage: (_event, data) => {
      if (data.posts_fetched !== undefined) {
        setStatusText(
          `Posts: ${data.posts_fetched} | Comentários: ${data.comments_fetched} | Analisados: ${data.comments_analyzed}`
        );
        // Estimate progress
        if (data.comments_fetched > 0) {
          const pct = Math.min(95, Math.round((data.comments_analyzed / Math.max(data.comments_fetched, 1)) * 100));
          setProgress(pct);
        }
      }
    },
    onComplete: (data) => {
      setState("done");
      setStatusText("Concluido!");
      setProgress(100);
      toast.success("Analise concluida!", {
        description: `${data?.comments_analyzed || 0} comentarios analisados.`,
      });
      onComplete?.();
    },
    onError: () => {
      // SSE failed, fall back to polling
      if (taskId) {
        startPolling(taskId);
      }
    },
  });

  const pollStatus = useCallback(async (tid: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const runs = await pipelineApi.listRuns(token);
      const run = runs.find((r) => r.connection_id === connectionId && r.status === "running");
      if (run) {
        setStatusText(
          `Posts: ${run.posts_fetched} | Comentarios: ${run.comments_fetched} | Analisados: ${run.comments_analyzed}`
        );
        if (run.comments_fetched > 0) {
          const pct = Math.min(95, Math.round((run.comments_analyzed / Math.max(run.comments_fetched, 1)) * 100));
          setProgress(pct);
        }
        if (run.status === "running") return true;
      }
      const completedRun = runs.find(
        (r) => r.connection_id === connectionId && r.status !== "running"
      );
      if (completedRun && completedRun.status === "completed") {
        setState("done");
        setStatusText("Concluido!");
        setProgress(100);
        toast.success("Analise concluida!", {
          description: `Sincronizacao finalizada com sucesso.`,
        });
        onComplete?.();
        return false;
      }
      if (completedRun && (completedRun.status === "failed" || completedRun.status === "partial")) {
        setState("error");
        setStatusText(completedRun.notes || "Erro na analise");
        toast.error("Falha na analise", {
          description: completedRun.notes || "Ocorreu um erro durante a analise.",
        });
        return false;
      }
      return true;
    } catch {
      return true;
    }
  }, [connectionId, onComplete]);

  function startPolling(tid: string) {
    let active = true;
    const interval = setInterval(async () => {
      if (!active) return;
      const keepPolling = await pollStatus(tid);
      if (!keepPolling) {
        active = false;
        clearInterval(interval);
      }
    }, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }

  useEffect(() => {
    if (state !== "syncing" || !taskId) return;

    // Try SSE first
    sseConnect();

    // Fallback: start polling after a delay in case SSE doesn't connect
    const fallbackTimeout = setTimeout(() => {
      if (sseStatus !== "connected") {
        const cleanup = startPolling(taskId);
        return cleanup;
      }
    }, 5000);

    return () => {
      clearTimeout(fallbackTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, taskId]);

  async function handleSync() {
    const token = getToken();
    if (!token) return;
    setState("syncing");
    setStatusText("Iniciando...");
    setProgress(0);
    toast.info("Iniciando analise...", {
      description: "Buscando posts e comentarios.",
    });
    try {
      const res = await connectionsApi.sync(
        token,
        connectionId,
        toSyncPayload(loadSyncSettings())
      );
      setTaskId(res.task_id);
    } catch (err: unknown) {
      setState("error");
      const message = err instanceof Error ? err.message : "Erro ao iniciar";
      setStatusText(message);
      toast.error("Erro ao iniciar analise", { description: message });
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant={state === "error" ? "danger" : "primary"}
        onClick={handleSync}
        disabled={state === "syncing"}
        className="gap-2 relative overflow-hidden"
      >
        {/* Progress bar background */}
        {state === "syncing" && progress > 0 && (
          <motion.div
            className="absolute inset-0 bg-accent/20"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
        <span className="relative flex items-center gap-2">
          {state === "syncing" && (
            <motion.svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </motion.svg>
          )}
          <AnimatePresence mode="wait">
            <motion.span
              key={state}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {state === "idle" && "Analisar"}
              {state === "syncing" && (progress > 0 ? `${progress}%` : "Analisando...")}
              {state === "done" && "Concluido"}
              {state === "error" && "Tentar novamente"}
            </motion.span>
          </AnimatePresence>
        </span>
      </Button>
      <AnimatePresence>
        {statusText && (
          <motion.span
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`text-xs ${state === "error" ? "text-negative" : "text-text-muted"}`}
          >
            {statusText}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
