"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
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
    <>
      <div className="flex flex-col gap-1 items-end">
        <button
          onClick={handleSync}
          disabled={state === "syncing"}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium shadow-sm transition-all disabled:opacity-60 relative overflow-hidden ${state === "error" ? "bg-rose-500 hover:bg-rose-600" : "bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark hover:shadow-float"
            }`}
        >
          {/* Progress bar background */}
          {state === "syncing" && progress > 0 && (
            <motion.div
              className="absolute inset-0 bg-white/20"
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
                className="flex items-center gap-1.5"
              >
                {state === "idle" && (
                  <>
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                    Analisar
                  </>
                )}
                {state === "syncing" && "Analisando..."}
                {state === "done" && (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    Concluído
                  </>
                )}
                {state === "error" && "Tentar novamente"}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
      </div>

      <AnimatePresence>
        {state === "syncing" && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-cyanLight to-transparent rounded-bl-full opacity-50" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-brand-lilacLight to-transparent rounded-tr-full opacity-50" />

              <div className="relative z-10 w-full">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-brand-lilac to-brand-cyan p-0.5 mb-6">
                  <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="material-symbols-outlined text-[28px] text-brand-cyanDark"
                    >
                      sync
                    </motion.span>
                  </div>
                </div>

                <h3 className="text-xl font-bold font-sans text-slate-800 mb-2">
                  Processando Análise
                </h3>

                <div className="my-6 space-y-2">
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    <motion.div
                      className="h-full bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400 uppercase tracking-wider">Progresso</span>
                    <span className="text-brand-cyanDark">{progress}%</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm text-slate-500 font-medium">
                  {statusText || "Iniciando a coleta de dados e processamento..."}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
