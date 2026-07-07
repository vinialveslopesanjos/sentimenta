"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Clock, Coins, FileText, MessageCircle, DollarSign, Trash2, ChevronDown, ChevronUp, Ban } from "lucide-react";
import { pipelineApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { PipelineRun } from "@/lib/types";
import { fmt, fmtDatetime } from "@/lib/helpers";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";

const USD_TO_BRL = Number(process.env.NEXT_PUBLIC_USD_BRL ?? "5.00");
const USD_PER_COMMENT_APIFY = 0.50 / 1000;

function estimateRunCostUsd(run: PipelineRun) {
  // Custo real medido (LLM + Apify) a partir do P2.1 jul/2026;
  // heurística por comentário só para runs antigas sem medição.
  const real = (run.total_cost_usd ?? 0) + (run.apify_cost_usd ?? 0);
  if (real > 0) return real;
  const baseComments = run.comments_analyzed || run.comments_fetched || 0;
  return baseComments * USD_PER_COMMENT_APIFY;
}

function fmtCostBRL(usd: number) {
  const brl = usd * USD_TO_BRL;
  return brl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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

type LogStatus = "completed" | "partial" | "cancelled" | "failed" | "running";

const statusConfig: Record<string, { variant: "positive" | "warning" | "negative" | "muted" | "primary"; icon: React.ElementType; labelKey: string }> = {
  completed: { variant: "positive", icon: CheckCircle, labelKey: "status.completed" },
  partial: { variant: "warning", icon: AlertTriangle, labelKey: "status.partial" },
  cancelled: { variant: "muted", icon: Ban, labelKey: "status.cancelled" },
  failed: { variant: "negative", icon: XCircle, labelKey: "status.failed" },
  running: { variant: "primary", icon: RefreshCw, labelKey: "status.running" },
};

const RUN_TYPE_FILTERS = [
  { key: "all", labelKey: "filterAll" },
  { key: "full", labelKey: "filterFull" },
  { key: "ingest", labelKey: "filterIngest" },
  { key: "daily_sync", labelKey: "filterDaily" },
] as const;

type RunTypeFilter = (typeof RUN_TYPE_FILTERS)[number]["key"];

export default function LogsPage() {
  const t = useTranslations("logs");
  const tc = useTranslations("common");
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RunTypeFilter>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleLog = (id: string) => {
    setExpandedLogs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

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

  useEffect(() => { loadRuns(); }, [loadRuns]);

  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === "running");
    if (hasRunning) {
      intervalRef.current = setInterval(loadRuns, 5000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runs, loadRuns]);

  const handleCancel = async (runId: string) => {
    const token = getToken();
    if (!token) return;
    await pipelineApi.cancelRun(token, runId);
    loadRuns();
  };

  const handleDelete = async (runId: string) => {
    const token = getToken();
    if (!token) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    await pipelineApi.deleteRun(token, runId);
    loadRuns();
  };

  const filteredRuns = typeFilter === "all" ? runs : runs.filter((r) => r.run_type === typeFilter);
  const totalRuns = runs.length;
  const completed = runs.filter((r) => r.status === "completed").length;
  const totalCostUsd = runs.reduce((sum, run) => sum + estimateRunCostUsd(run), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("title")}</h1>
          <p className="mt-1" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={loadRuns}>{t("refresh")}</Button>
      </div>

      {!loading && runs.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="primary">{t("totalRuns")} {totalRuns}</Badge>
            <Badge variant="positive" dot>{t("completed")} {completed}</Badge>
            <Badge variant="warning">{t("totalCost")} {fmtCostBRL(totalCostUsd)}</Badge>
          </div>
          <p style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{t("recentScopeNote")}</p>
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="mr-2" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t("typeLabel")}</span>
          {RUN_TYPE_FILTERS.map(ft => (
            <button key={ft.key} onClick={() => setTypeFilter(ft.key)} className="px-3 py-1.5 rounded-lg transition-all" style={{ fontSize: "0.75rem", fontWeight: typeFilter === ft.key ? 500 : 400, backgroundColor: typeFilter === ft.key ? "var(--primary)" : "transparent", color: typeFilter === ft.key ? "white" : "var(--text-muted)" }}>
              {t(ft.labelKey)}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl p-6 animate-pulse" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: "var(--bg-subtle)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
                  <div className="h-3 w-20 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && runs.length === 0 && (
        <div className="rounded-2xl p-16 flex flex-col items-center text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)", marginBottom: 8 }}>{t("emptyTitle")}</p>
          <p style={{ fontSize: "0.82rem", color: "var(--text-faint)" }}>{t("emptySubtitle")}</p>
        </div>
      )}

      {!loading && filteredRuns.length > 0 && (
        <div className="space-y-3">
          {filteredRuns.map(run => {
            const sc = statusConfig[run.status] || statusConfig.partial;
            const StatusIcon = sc.icon;
            const isExpanded = expandedLogs.has(run.id);
            const duration = calcDuration(run.started_at, run.ended_at);
            const runCostUsd = estimateRunCostUsd(run);
            const notesData = (() => { if (!run.notes) return null; try { return JSON.parse(run.notes); } catch { return null; } })();
            const steps: { msg: string; ts: string }[] = notesData?.steps ?? [];

            return (
              <div key={run.id} className="rounded-2xl overflow-hidden transition-all" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="p-4 md:p-5">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      {run.platform && <GlassSocialIcon platform={run.platform} size={32} />}
                      <div>
                        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
                          {run.connection_username ? (run.connection_username.startsWith("@") ? run.connection_username : `@${run.connection_username}`) : t("pipeline")}
                        </p>
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{run.platform ?? t("system")} &middot; {run.run_type}</p>
                      </div>
                    </div>
                    <Badge variant={sc.variant}><StatusIcon className="w-3 h-3" /> {t(sc.labelKey)}</Badge>
                  </div>

                  {steps.length > 0 && (
                    <button onClick={() => toggleLog(run.id)} className="flex items-center gap-1 transition-colors mb-4" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} {t("viewLog")}
                    </button>
                  )}

                  {isExpanded && steps.length > 0 && (
                    <div className="mb-4 rounded-xl p-4 font-mono text-xs overflow-auto max-h-48 space-y-1" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      {steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span style={{ color: "var(--sentiment-positive)" }}>$</span>
                          <span style={{ color: "var(--text-muted)" }}>{step.msg}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    {[
                      { icon: FileText, label: t("stats.posts"), value: `${fmt(run.posts_fetched)}/${run.target_posts != null ? fmt(run.target_posts) : "\u2014"}` },
                      { icon: MessageCircle, label: t("stats.comments"), value: `${fmt(run.comments_fetched)}/${run.target_comments != null ? fmt(run.target_comments) : "\u2014"}` },
                      // comments_analyzed conta apenas an\u00e1lises com score v\u00e1lido;
                      // ratio vs. fetched enganava (backlog antigo gerava >100%)
                      { icon: CheckCircle, label: t("stats.analyzed"), value: fmt(run.comments_analyzed) },
                      { icon: Clock, label: t("stats.duration"), value: duration ?? "\u2014" },
                      { icon: DollarSign, label: t("stats.cost"), value: fmtCostBRL(runCostUsd) },
                      { icon: Coins, label: t("stats.credits"), value: run.credits_consumed ? fmt(run.credits_consumed) : "—" },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-xl p-3" style={{ backgroundColor: "var(--bg-subtle)" }}>
                        <div className="flex items-center gap-1 mb-1">
                          <stat.icon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                          <span style={{ fontSize: "0.55rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{stat.label}</span>
                        </div>
                        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {run.comments_analyzed > run.comments_fetched && run.comments_fetched > 0 && (
                    <div className="mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2" style={{ backgroundColor: "var(--bg-subtle)" }}>
                      <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {t("backlogNote", { count: fmt(run.comments_analyzed - run.comments_fetched) })}
                      </span>
                    </div>
                  )}

                  {run.errors_count > 0 && (
                    <div className="mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2" style={{ backgroundColor: "var(--sentiment-negative-bg)" }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: "var(--sentiment-negative)" }} />
                      <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--sentiment-negative)" }}>{run.errors_count} {run.errors_count > 1 ? t("errors") : t("error")}</span>
                    </div>
                  )}

                  {Array.isArray(notesData?.skipped_reasons) && notesData.skipped_reasons.length > 0 && (
                    <div className="mt-3 px-4 py-2.5 rounded-xl flex items-center gap-2" style={{ backgroundColor: "var(--secondary-bg)" }}>
                      <Clock className="w-4 h-4" style={{ color: "var(--secondary)" }} />
                      <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--secondary)" }}>
                        {t("pendingAnalysis")}: {notesData.skipped_reasons.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-4 md:px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex gap-4" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    <span>{t("start")}: {fmtDatetime(run.started_at)}</span>
                    {run.ended_at && <span>{t("end")}: {fmtDatetime(run.ended_at)}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "0.6rem", color: "var(--text-faint)" }}>#{run.id.slice(0, 8)}</span>
                    {run.status === "running" && (
                      <Button variant="danger" size="sm" onClick={() => handleCancel(run.id)}>{t("cancel")}</Button>
                    )}
                    <button onClick={() => handleDelete(run.id)} className="p-1 rounded-lg transition-colors">
                      <Trash2 className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
