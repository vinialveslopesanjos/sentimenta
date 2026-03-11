"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { pipelineApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { PipelineRun } from "@/lib/types";
import { fmt, fmtDatetime, platformIcon } from "@/lib/helpers";

const USD_TO_BRL = Number(process.env.NEXT_PUBLIC_USD_BRL ?? "5.00");
const USD_PER_COMMENT_APIFY = 0.50 / 1000; // $0.50 per 1K comments (Apify pricing)

function calcDuration(started: string, ended: string | null) {
  if (!ended) return null;
  const ms = new Date(ended).getTime() - new Date(started).getTime();
  if (ms < 0) return null;
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function estimateRunCostUsd(run: PipelineRun) {
  const explicit = run.total_cost_usd ?? 0;
  if (explicit > 0) return explicit;
  const baseComments = run.comments_analyzed || run.comments_fetched || 0;
  return baseComments * USD_PER_COMMENT_APIFY;
}

function fmtCostBRL(usd: number) {
  const brl = usd * USD_TO_BRL;
  return brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_CONFIG = {
  running: { border: "border-violet-200", bg: "bg-violet-50/30", badgeBg: "bg-violet-100", badgeText: "text-violet-700", badgeBorder: "border-violet-200", dot: "bg-violet-400", pulse: true, label: "RODANDO" },
  completed: { border: "border-emerald-100", bg: "bg-white", badgeBg: "bg-emerald-50", badgeText: "text-emerald-700", badgeBorder: "border-emerald-100", dot: "bg-emerald-400", pulse: false, label: "CONCLUÍDO" },
  failed: { border: "border-rose-100", bg: "bg-white", badgeBg: "bg-rose-50", badgeText: "text-rose-600", badgeBorder: "border-rose-100", dot: "bg-rose-400", pulse: false, label: "FALHOU" },
  partial: { border: "border-amber-100", bg: "bg-white", badgeBg: "bg-amber-50", badgeText: "text-amber-700", badgeBorder: "border-amber-100", dot: "bg-amber-400", pulse: false, label: "PARCIAL" },
  cancelled: { border: "border-slate-200", bg: "bg-white", badgeBg: "bg-slate-100", badgeText: "text-slate-500", badgeBorder: "border-slate-200", dot: "bg-slate-400", pulse: false, label: "CANCELADO" },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as StatusKey] ?? STATUS_CONFIG.partial;
}

function StatPill({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl min-w-0">
      <span className="material-symbols-outlined text-[16px] text-slate-300 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-300 uppercase tracking-wide font-medium truncate">{label}</p>
        <p className="text-sm font-sans font-semibold text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}

function RunCard({ run, onRefresh }: { run: PipelineRun; onRefresh: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);
  const cfg = getStatusConfig(run.status);
  const duration = calcDuration(run.started_at, run.ended_at);
  const runCostUsd = estimateRunCostUsd(run);

  const handleCancel = async () => {
    const token = getToken();
    if (!token) return;
    await pipelineApi.cancelRun(token, run.id);
    onRefresh();
  };

  const handleDelete = async () => {
    const token = getToken();
    if (!token) return;
    await pipelineApi.deleteRun(token, run.id);
    onRefresh();
  };

  const notesData = (() => {
    if (!run.notes) return null;
    try { return JSON.parse(run.notes); } catch { return null; }
  })();
  const steps: { msg: string; ts: string }[] = notesData?.steps ?? [];
  const currentStep = notesData?.current_step ?? null;

  const platformColors: Record<string, string> = {
    instagram: "from-orange-100 to-pink-100 text-pink-500",
    youtube: "from-red-50 to-red-100 text-red-500",
  };
  const ptColor = platformColors[run.platform?.toLowerCase() ?? ""] ?? "from-violet-50 to-violet-100 text-violet-500";

  return (
    <div className={`dream-card border ${cfg.border} ${cfg.bg} p-6 transition-all duration-300 hover:shadow-float`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          {run.platform && (
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${ptColor} flex items-center justify-center shrink-0`}>
              {platformIcon(run.platform)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{run.connection_username ? (run.connection_username.startsWith('@') ? run.connection_username : `@${run.connection_username}`) : "Pipeline"}</p>
            <p className="text-xs text-slate-400 font-light capitalize">{run.platform ?? "Sistema"} · {run.run_type}</p>
          </div>
        </div>

        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border shrink-0 ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""} shrink-0`} />
          {cfg.label}
        </span>
      </div>

      {run.status === "running" && (
        <div className="h-1.5 rounded-full overflow-hidden bg-violet-100 mb-4">
          <div className="h-full progress-shimmer rounded-full" style={{ width: "60%" }} />
        </div>
      )}

      {run.status === "running" && steps.length > 0 && (
        <div className="mb-4 bg-slate-900 rounded-xl p-4 font-mono text-xs overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-slate-500 text-[10px]">sentimenta pipeline</span>
            <button
              onClick={() => setLogExpanded((p) => !p)}
              className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
              title={logExpanded ? "Recolher" : "Expandir"}
            >
              <span className="material-symbols-outlined text-[14px]">{logExpanded ? "unfold_less" : "unfold_more"}</span>
            </button>
          </div>
          <div className={`${logExpanded ? "max-h-96" : "max-h-32"} overflow-y-auto space-y-1 scrollbar-thin transition-all duration-300`}>
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-emerald-400 shrink-0">$</span>
                <span className={i === steps.length - 1 ? "text-white" : "text-slate-400"}>{step.msg}</span>
              </div>
            ))}
            {currentStep && (
              <div className="flex items-center gap-2 text-brand-cyan">
                <span className="animate-pulse">&rsaquo;</span>
                <span className="animate-pulse">{currentStep}</span>
                <span className="inline-block w-1.5 h-3.5 bg-brand-cyan animate-blink" />
              </div>
            )}
          </div>
        </div>
      )}

      {run.status !== "running" && steps.length > 0 && (
        <details className="mb-4">
          <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600 transition-colors font-medium">
            Ver log de execução
          </summary>
          <div className="mt-2 bg-slate-900 rounded-xl p-4 font-mono text-xs">
            <div className={`${logExpanded ? "max-h-96" : "max-h-32"} overflow-y-auto space-y-1 transition-all duration-300`}>
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-400 shrink-0">$</span>
                  <span className="text-slate-400">{step.msg}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLogExpanded((p) => !p)}
              className="mt-2 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              {logExpanded ? "Recolher" : "Expandir log"}
            </button>
          </div>
        </details>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-4">
        <StatPill icon="article" label="Posts" value={`${fmt(run.posts_fetched)}/${run.target_posts != null ? fmt(run.target_posts) : '\u2014'}`} />
        <StatPill icon="forum" label="Comentários" value={`${fmt(run.comments_fetched)}/${run.target_comments != null ? fmt(run.target_comments) : '\u2014'}`} />
        <StatPill icon="check_circle" label="Analisados" value={run.comments_fetched > 0 ? `${fmt(run.comments_analyzed)}/${fmt(run.comments_fetched)} (${Math.round(run.comments_analyzed / run.comments_fetched * 100)}%)` : fmt(run.comments_analyzed)} />
        {run.status === "running" ? (
          <StatPill icon="bolt" label="LLM Calls" value={fmt(run.llm_calls)} />
        ) : (
          <>
            <StatPill icon="timer" label="Duração" value={duration ?? "—"} />
            <StatPill icon="payments" label="Custo" value={fmtCostBRL(runCostUsd)} />
          </>
        )}
      </div>

      {run.errors_count > 0 && (
        <div className="flex items-center gap-2 text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 mb-4">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{run.errors_count} erro{run.errors_count > 1 ? "s" : ""} registrado{run.errors_count > 1 ? "s" : ""}</span>
        </div>
      )}

      {run.notes && !notesData?.steps && (
        <p className="text-xs text-slate-400 font-light italic bg-slate-50 rounded-xl px-3 py-2 mb-4">{run.notes}</p>
      )}

      <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-300 font-light border-t border-slate-50 pt-3">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">play_arrow</span>
          Início: {fmtDatetime(run.started_at)}
        </span>
        {run.ended_at && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">stop</span>
            Fim: {fmtDatetime(run.ended_at)}
          </span>
        )}
        <span className="ml-auto font-mono text-[9px] text-slate-200 truncate max-w-[120px]">#{run.id.slice(0, 8)}</span>
        <div className="flex items-center gap-2 ml-2">
          {run.status === "running" && (
            <button
              onClick={handleCancel}
              className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => {
              if (confirmDelete) {
                handleDelete();
              } else {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 3000);
              }
            }}
            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg transition-colors ${confirmDelete ? "text-rose-600 bg-rose-50 border border-rose-200" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            {confirmDelete ? "Confirmar?" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRun() {
  return (
    <div className="dream-card p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
        <div className="w-20 h-6 bg-slate-100 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="h-14 bg-slate-50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

const RUN_TYPE_FILTERS = [
  { key: "all", label: "Todos" },
  { key: "full", label: "Full" },
  { key: "ingest", label: "Ingest" },
  { key: "daily_sync", label: "Daily" },
] as const;

type RunTypeFilter = (typeof RUN_TYPE_FILTERS)[number]["key"];

export default function LogsPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RunTypeFilter>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRuns = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await pipelineApi.listRuns(token);
      const sorted = [...data].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
      setRuns(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === "running");
    if (hasRunning) {
      intervalRef.current = setInterval(loadRuns, 5000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runs, loadRuns]);

  const hasRunning = runs.some((r) => r.status === "running");
  const filteredRuns = typeFilter === "all" ? runs : runs.filter((r) => r.run_type === typeFilter);
  const isEmpty = !loading && runs.length === 0;

  const totalRuns = runs.length;
  const completed = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const totalCostUsd = runs.reduce((sum, run) => sum + estimateRunCostUsd(run), 0);

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 md:px-8 py-3 sm:py-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-sans font-medium text-slate-800">Logs de Pipeline</h1>
          <p className="text-xs sm:text-sm text-slate-400 font-light mt-0.5">Histórico de execuções de análise</p>
        </div>
        <div className="flex items-center gap-3">
          {hasRunning && (
            <div className="flex items-center gap-2 text-xs text-violet-600 bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              Auto-atualizando
            </div>
          )}
          <button
            onClick={loadRuns}
            className="w-10 h-10 rounded-full bg-white border border-slate-100 text-slate-400 hover:text-brand-lilacDark hover:border-brand-lilac transition-all flex items-center justify-center shadow-sm"
            title="Atualizar"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </header>

      <main className="p-6 md:p-8 space-y-6 max-w-screen-xl mx-auto animate-fade-in">
        {!loading && runs.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {[
              { icon: "list", label: "Execuções", value: totalRuns, color: "bg-slate-50 text-slate-600 border-slate-100" },
              { icon: "check_circle", label: "Concluídas", value: completed, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
              { icon: "cancel", label: "Falharam", value: failed, color: "bg-rose-50 text-rose-600 border-rose-100" },
              { icon: "payments", label: "Custo total", value: fmtCostBRL(totalCostUsd), color: "bg-amber-50 text-amber-700 border-amber-100" },
            ].map((s) => (
              <div key={s.label} className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-sm font-medium ${s.color}`}>
                <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                <span className="font-light text-xs mr-1 opacity-70">{s.label}</span>
                <span className="font-sans font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && runs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-light mr-1">Tipo:</span>
            {RUN_TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                  typeFilter === f.key
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : "bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-50 to-cyan-50 flex items-center justify-center shadow-dream">
                <span className="material-symbols-outlined text-[44px] text-slate-200">terminal</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-lilac to-brand-cyan flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[16px] text-white">bolt</span>
              </div>
            </div>
            <h2 className="text-xl font-sans font-medium text-slate-700 mb-2">Nenhuma execução ainda</h2>
            <p className="text-sm text-slate-400 font-light max-w-sm leading-relaxed">
              Conecte um perfil e clique em <span className="font-medium text-brand-lilacDark">Analisar</span> para iniciar o pipeline de análise de sentimentos.
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => <SkeletonRun key={i} />)}
          </div>
        )}

        {!loading && runs.length > 0 && (
          <div className="space-y-4">
            {filteredRuns.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-400 font-light">
                Nenhuma execução do tipo &ldquo;{typeFilter}&rdquo; encontrada.
              </div>
            ) : (
              filteredRuns.map((run) => (
                <RunCard key={run.id} run={run} onRefresh={loadRuns} />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
