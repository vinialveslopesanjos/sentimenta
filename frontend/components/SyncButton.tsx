"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { connectionsApi, pipelineApi, billingApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { loadSyncSettings, toSyncPayload } from "@/lib/syncSettings";
import type { PreflightResponse, PreflightBlocker } from "@/lib/types";
import PersonaEditor from "@/components/PersonaEditor";
import { Button } from "@/components/ds/Button";
import { AlertTriangle, CreditCard, Clock, Zap, X } from "lucide-react";

const API_URL = "/api/v1";

interface Props {
  connectionId: string;
  onComplete?: () => void;
}

type SyncState = "idle" | "preflight" | "confirming" | "syncing" | "done" | "error";

// Map blocker codes to user-friendly messages and actions
function getBlockerInfo(blocker: PreflightBlocker) {
  switch (blocker.code) {
    case "missing_persona":
      return {
        title: "Persona nao preenchida",
        description: "Preencha a descricao do seu negocio para que a IA entenda o contexto dos seus comentarios.",
        actionLabel: "Preencher persona",
        actionType: "persona" as const,
      };
    case "insufficient_credits":
      return {
        title: "Creditos insuficientes",
        description: blocker.message || "Voce nao tem creditos suficientes para esta analise.",
        actionLabel: "Ver planos",
        actionType: "billing" as const,
      };
    case "budget_guardrail":
      return {
        title: "Orcamento mensal atingido",
        description: blocker.message || "O limite de gastos do seu plano foi atingido este mes.",
        actionLabel: "Fazer upgrade",
        actionType: "billing" as const,
      };
    case "already_running":
      return {
        title: "Analise em andamento",
        description: blocker.message || "Ja existe uma analise rodando para este perfil. Aguarde a conclusao.",
        actionLabel: "",
        actionType: "disabled" as const,
      };
    default:
      return {
        title: "Bloqueio",
        description: blocker.message,
        actionLabel: "",
        actionType: "disabled" as const,
      };
  }
}

export default function SyncButton({ connectionId, onComplete }: Props) {
  const [state, setState] = useState<SyncState>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("");
  const [progress, setProgress] = useState(0);
  const [etaText, setEtaText] = useState("");
  const [currentStep, setCurrentStep] = useState("");

  const [mounted, setMounted] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [showPersonaEditor, setShowPersonaEditor] = useState(false);
  const [showBlockerModal, setShowBlockerModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [lowCreditsWarning, setLowCreditsWarning] = useState(false);

  // Credit info for warning banner
  const [creditInfo, setCreditInfo] = useState<{
    used: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    // Check credit levels on mount
    const token = getToken();
    if (token) {
      billingApi.usage(token).then((data) => {
        const used = data.usage.comments_used_this_month;
        const total = data.usage.comments_included;
        setCreditInfo({ used, total });
        const remaining = total - used;
        if (total > 0 && remaining / total < 0.2) {
          setLowCreditsWarning(true);
        }
      }).catch(() => {});
    }
  }, []);

  // Polling for run status with ETA
  const pollStatus = useCallback(
    async (runId: string) => {
      const token = getToken();
      if (!token) return false;
      try {
        const run = await pipelineApi.getRunStatus(token, runId);
        if (!run) return true;

        // Update ETA and step from status endpoint
        if (run.eta_min !== undefined && run.eta_max !== undefined) {
          if (run.eta_min > 0 || run.eta_max > 0) {
            setEtaText(`~${run.eta_min}-${run.eta_max} min restantes`);
          }
        }
        if (run.current_step) {
          setCurrentStep(run.current_step);
        }
        if (run.progress_pct !== undefined && run.progress_pct > 0) {
          setProgress(Math.min(95, run.progress_pct));
        }

        // Update status text from fetched/analyzed counts
        if (run.comments_fetched > 0) {
          const remaining = run.comments_fetched - (run.comments_analyzed || 0);
          const mins = Math.ceil((remaining * 1.5) / 60);
          setStatusText(
            `Puxando ${run.comments_fetched} comentarios de ${run.posts_fetched} posts. Tempo para finalizar: ~${mins} min.`
          );
          const pct = Math.min(
            95,
            Math.round(
              (run.comments_analyzed / Math.max(run.comments_fetched, 1)) * 100
            )
          );
          if (pct > progress) setProgress(pct);
        } else if (run.posts_fetched > 0) {
          setStatusText(
            `Obtendo comentarios... ${run.posts_fetched} posts encontrados.`
          );
          if (progress < 10) setProgress(10);
        }

        if (run.status === "running") return true;

        if (run.status === "completed") {
          setState("done");
          setStatusText("Concluido!");
          setProgress(100);
          setEtaText("");
          toast.success("Analise concluida!", {
            description: `${run.comments_analyzed || 0} comentarios analisados.`,
          });
          onComplete?.();
          return false;
        }

        if (run.status === "failed" || run.status === "partial") {
          setState("error");
          setStatusText("Erro na analise");
          setEtaText("");
          toast.error("Falha na analise", {
            description: "Ocorreu um erro durante a analise.",
          });
          return false;
        }

        return true;
      } catch {
        return true;
      }
    },
    [onComplete, progress]
  );

  // Start polling when syncing
  useEffect(() => {
    if (state !== "syncing" || !taskId) return;

    let active = true;
    const tick = async () => {
      if (!active) return;
      const keepPolling = await pollStatus(taskId);
      if (keepPolling && active) {
        setTimeout(tick, 4000);
      }
    };
    tick();

    return () => {
      active = false;
    };
  }, [state, taskId, pollStatus]);

  async function handlePreflightCheck() {
    const token = getToken();
    if (!token) return;

    setState("preflight");
    try {
      const data = await connectionsApi.preflight(token, connectionId);
      setPreflight(data);

      if (!data.can_sync && data.blockers.length > 0) {
        // Show blocker modal
        const firstBlocker = data.blockers[0];
        if (firstBlocker.code === "missing_persona") {
          setShowPersonaEditor(true);
        } else {
          setShowBlockerModal(true);
        }
        setState("idle");
        return;
      }

      if (data.warnings.length > 0 || data.estimated_credits_total > 0) {
        // Show confirmation dialog
        setShowConfirmDialog(true);
        setState("confirming");
        return;
      }

      // No blockers, no warnings: proceed directly
      await startSync(token);
    } catch (err) {
      // If preflight endpoint not available (404), fall back to direct sync
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404") || msg.includes("Not Found")) {
        const token2 = getToken();
        if (token2) await startSync(token2);
        return;
      }
      setState("error");
      const message = err instanceof Error ? err.message : "Erro no preflight";
      setStatusText(message);
      toast.error("Erro ao verificar", { description: message });
    }
  }

  async function startSync(token: string) {
    setState("syncing");
    setStatusText("Iniciando analise...");
    setProgress(0);
    setEtaText("");
    setCurrentStep("");
    toast.info("Iniciando analise de sentimento...", {
      description: "Analisando comentarios existentes.",
    });
    try {
      const res = await connectionsApi.analyze(token, connectionId);
      setTaskId(res.run_id || res.task_id);
    } catch (err: unknown) {
      setState("error");
      const message = err instanceof Error ? err.message : "Erro ao iniciar";
      setStatusText(message);
      toast.error("Erro ao iniciar analise", { description: message });
    }
  }

  function handleConfirmSync() {
    setShowConfirmDialog(false);
    const token = getToken();
    if (token) startSync(token);
  }

  function handleCancelConfirm() {
    setShowConfirmDialog(false);
    setState("idle");
  }

  function handlePersonaSaved() {
    setShowPersonaEditor(false);
    toast.success("Persona salva! Agora voce pode iniciar a analise.");
  }

  function handleBlockerAction(actionType: string) {
    setShowBlockerModal(false);
    if (actionType === "billing") {
      window.location.href = "/dashboard/settings";
    }
  }

  const isLoading = state === "preflight" || state === "syncing";

  return (
    <>
      <div className="flex flex-col gap-1 items-end">
        {/* Low credits warning banner */}
        {lowCreditsWarning && creditInfo && state === "idle" && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg mb-1"
            style={{
              backgroundColor: "var(--sentiment-negative-bg, #fde8ef)",
              fontSize: "0.72rem",
              color: "var(--sentiment-negative, #ef4382)",
            }}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>
              Creditos baixos: {creditInfo.total - creditInfo.used} restantes
            </span>
          </div>
        )}

        <button
          onClick={handlePreflightCheck}
          disabled={isLoading || state === "done"}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium shadow-sm transition-all disabled:opacity-60 relative overflow-hidden ${
            state === "error"
              ? "bg-rose-500 hover:bg-rose-600"
              : "bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark hover:shadow-float"
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
            {(state === "syncing" || state === "preflight") && (
              <motion.svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="opacity-75"
                />
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
                    <span className="material-symbols-outlined text-[18px]">
                      sync
                    </span>
                    Analisar
                  </>
                )}
                {state === "preflight" && "Verificando..."}
                {state === "confirming" && "Analisar"}
                {state === "syncing" && "Analisando..."}
                {state === "done" && (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      check_circle
                    </span>
                    Concluido
                  </>
                )}
                {state === "error" && "Tentar novamente"}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
      </div>

      {/* Portaled overlays */}
      {mounted &&
        createPortal(
          <>
            {/* ── Syncing progress overlay ── */}
            <AnimatePresence>
              {state === "syncing" && (
                <motion.div
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 50, scale: 0.95 }}
                  className="fixed bottom-6 right-6 z-[99999] bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-[calc(100vw-3rem)] sm:w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center overflow-hidden"
                  style={{ position: "fixed" }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-cyanLight to-transparent rounded-bl-full opacity-50" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-brand-lilacLight to-transparent rounded-tr-full opacity-50" />

                  <div className="relative z-10 w-full">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-brand-lilac to-brand-cyan p-0.5 mb-6">
                      <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="material-symbols-outlined text-[28px] text-brand-cyanDark"
                        >
                          sync
                        </motion.span>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold font-sans text-slate-800 mb-2">
                      Processando Analise
                    </h3>

                    {/* ETA display */}
                    {(etaText || currentStep) && (
                      <div className="flex items-center justify-center gap-2 mb-3">
                        {etaText && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {etaText}
                          </span>
                        )}
                        {currentStep && (
                          <span className="text-xs text-brand-cyanDark font-medium">
                            {currentStep}
                          </span>
                        )}
                      </div>
                    )}

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
                        <span className="text-slate-400 uppercase tracking-wider">
                          Progresso
                        </span>
                        <span className="text-brand-cyanDark">{progress}%</span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm text-slate-500 font-medium">
                      {statusText ||
                        "Iniciando a coleta de dados e processamento..."}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Blocker modal ── */}
            <AnimatePresence>
              {showBlockerModal && preflight && preflight.blockers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 flex items-center justify-center z-[70] p-4"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.4)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="rounded-2xl p-6 max-w-sm w-full relative"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18)",
                    }}
                  >
                    <button
                      onClick={() => setShowBlockerModal(false)}
                      className="absolute top-4 right-4 p-1 rounded-lg"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {preflight.blockers.map((blocker, i) => {
                      const info = getBlockerInfo(blocker);
                      return (
                        <div key={i}>
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle
                              className="w-5 h-5"
                              style={{ color: "var(--sentiment-negative)" }}
                            />
                            <h3
                              style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: "1.05rem",
                                fontWeight: 700,
                                color: "var(--text-primary)",
                              }}
                            >
                              {info.title}
                            </h3>
                          </div>
                          <p
                            style={{
                              fontSize: "0.82rem",
                              color: "var(--text-muted)",
                              marginBottom: 16,
                              lineHeight: 1.6,
                            }}
                          >
                            {info.description}
                          </p>
                          {info.actionLabel && info.actionType !== "disabled" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() =>
                                handleBlockerAction(info.actionType)
                              }
                            >
                              {info.actionLabel}
                            </Button>
                          )}
                          {info.actionType === "disabled" && (
                            <Button variant="ghost" size="sm" disabled>
                              Aguarde a conclusao
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Confirmation dialog ── */}
            <AnimatePresence>
              {showConfirmDialog && preflight && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 flex items-center justify-center z-[70] p-4"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.4)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="rounded-2xl p-6 max-w-sm w-full relative"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18)",
                    }}
                  >
                    <button
                      onClick={handleCancelConfirm}
                      className="absolute top-4 right-4 p-1 rounded-lg"
                      style={{ color: "var(--text-faint)" }}
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-2 mb-4">
                      <Zap
                        className="w-5 h-5"
                        style={{ color: "var(--primary)" }}
                      />
                      <h3
                        style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        Confirmar analise
                      </h3>
                    </div>

                    {/* Credits breakdown */}
                    <div
                      className="rounded-xl p-4 space-y-2 mb-4"
                      style={{
                        backgroundColor: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          Creditos para comentarios
                        </span>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          ~{preflight.estimated_credits_comments}
                        </span>
                      </div>
                      {preflight.estimated_credits_demographics > 0 && (
                        <div className="flex items-center justify-between">
                          <span
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            Creditos para demograficos
                          </span>
                          <span
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            ~{preflight.estimated_credits_demographics}
                          </span>
                        </div>
                      )}
                      <div
                        className="flex items-center justify-between pt-2"
                        style={{
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          Total estimado
                        </span>
                        <span
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            color: "var(--primary)",
                          }}
                        >
                          ~{preflight.estimated_credits_total} creditos
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-faint)",
                          }}
                        >
                          Disponivel
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            color: "var(--text-muted)",
                          }}
                        >
                          {preflight.credits_available} creditos
                        </span>
                      </div>
                    </div>

                    {/* Cost and ETA */}
                    <div className="flex items-center gap-4 mb-4">
                      {preflight.estimated_cost_brl > 0 && (
                        <div className="flex items-center gap-1.5">
                          <CreditCard
                            className="w-3.5 h-3.5"
                            style={{ color: "var(--text-faint)" }}
                          />
                          <span
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            Custo est.: R$
                            {preflight.estimated_cost_brl.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {(preflight.eta_min > 0 || preflight.eta_max > 0) && (
                        <div className="flex items-center gap-1.5">
                          <Clock
                            className="w-3.5 h-3.5"
                            style={{ color: "var(--text-faint)" }}
                          />
                          <span
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            ~{preflight.eta_min}-{preflight.eta_max} min
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Warnings */}
                    {preflight.warnings.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {preflight.warnings.map((w, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-lg p-2.5"
                            style={{
                              backgroundColor:
                                "var(--sentiment-negative-bg, #fde8ef)",
                            }}
                          >
                            <AlertTriangle
                              className="w-3.5 h-3.5 shrink-0 mt-0.5"
                              style={{
                                color: "var(--sentiment-negative, #ef4382)",
                              }}
                            />
                            <span
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--sentiment-negative, #ef4382)",
                                lineHeight: 1.5,
                              }}
                            >
                              {w.code === "posts_missing_context" &&
                              preflight.known_posts_missing_context > 0
                                ? `${preflight.known_posts_missing_context} posts podem ser ignorados por falta de contexto`
                                : w.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelConfirm}
                      >
                        Cancelar
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleConfirmSync}
                      >
                        Iniciar analise
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Persona editor modal ── */}
            {showPersonaEditor && (
              <PersonaEditor
                connectionId={connectionId}
                onSave={handlePersonaSaved}
                onClose={() => setShowPersonaEditor(false)}
              />
            )}
          </>,
          document.body
        )}
    </>
  );
}
