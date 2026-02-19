"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { dashboardApi } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Alert = {
  connection_id: string;
  platform: string;
  username: string;
  severity: string;
  negative_rate: number;
  sarcasm_rate: number;
  total_analyzed: number;
  avg_score: number | null;
  message: string;
};

type AlertsData = {
  days: number;
  total_alerts: number;
  alerts: Alert[];
  generated_at: string;
};

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    critical: { label: "Crítico", cls: "bg-red-50 text-red-600 border-red-100" },
    high: { label: "Alto", cls: "bg-orange-50 text-orange-600 border-orange-100" },
    medium: { label: "Médio", cls: "bg-amber-50 text-amber-600 border-amber-100" },
    low: { label: "Baixo", cls: "bg-yellow-50 text-yellow-600 border-yellow-100" },
  };
  const s = map[severity] || map.medium;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border uppercase tracking-wide ${s.cls}`}>
      {s.label}
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const isInstagram = platform === "instagram";
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm ${isInstagram ? "bg-gradient-to-tr from-brand-lilac to-violet-400" : "bg-gradient-to-tr from-rose-300 to-red-400"}`}>
      <span className="material-symbols-outlined text-[18px]">
        {isInstagram ? "camera_alt" : "play_arrow"}
      </span>
    </div>
  );
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  async function loadAlerts(d: number) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.alerts(token, { days: d });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar alertas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAlerts(days); }, [days]);

  const visibleAlerts = (data?.alerts || []).filter((a) => !dismissedIds.has(a.connection_id));

  return (
    <div className="flex-1 p-6 md:p-10 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-sans font-light text-brand-heading">Alertas de Crise</h1>
          <p className="text-brand-text text-sm font-light mt-1">
            Conexões com sentimento negativo acima do limiar detectado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-xl shadow-sm text-sm overflow-hidden">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 font-medium transition-all ${days === d ? "bg-brand-lilacDark text-white" : "text-slate-500 hover:text-brand-heading"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => loadAlerts(days)}
            className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-brand-lilacDark hover:border-brand-lilac flex items-center justify-center transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="dream-card p-6 flex gap-4">
              <div className="w-9 h-9 bg-slate-100 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 bg-slate-100 rounded" />
                <div className="h-3 w-56 bg-slate-50 rounded" />
                <div className="h-3 w-48 bg-slate-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="dream-card p-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-red-400 mb-2 block">error</span>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={() => loadAlerts(days)} className="mt-4 px-4 py-2 bg-brand-lilacDark text-white text-sm rounded-xl hover:opacity-90">
            Tentar novamente
          </button>
        </div>
      )}

      {/* No alerts */}
      {!loading && !error && visibleAlerts.length === 0 && (
        <div className="dream-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[32px] text-green-500">check_circle</span>
          </div>
          <h3 className="text-xl font-sans font-medium text-brand-heading mb-2">Tudo certo!</h3>
          <p className="text-slate-400 text-sm font-light max-w-xs mx-auto">
            Nenhum alerta de reputação encontrado nos últimos {days} dias.
          </p>
        </div>
      )}

      {/* Alert cards */}
      {!loading && !error && visibleAlerts.length > 0 && (
        <>
          {/* Summary strip */}
          <div className="flex items-center gap-3 mb-5 p-4 bg-red-50/60 border border-red-100 rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </div>
            <div>
              <p className="text-sm font-medium text-red-700">
                {data!.total_alerts} alerta{data!.total_alerts !== 1 ? "s" : ""} de reputação encontrado{data!.total_alerts !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-red-400 font-light">Nos últimos {days} dias</p>
            </div>
          </div>

          <div className="space-y-4">
            {visibleAlerts.map((alert) => {
              const isCritical = alert.severity === "critical";
              const isHigh = alert.severity === "high";

              return (
                <div
                  key={alert.connection_id}
                  className={`dream-card p-6 relative overflow-hidden ${isCritical ? "border-red-100" : isHigh ? "border-orange-100" : ""}`}
                >
                  {/* Blob */}
                  <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-40 pointer-events-none ${isCritical ? "bg-red-100" : isHigh ? "bg-orange-100" : "bg-amber-50"}`} />

                  <div className="relative z-10">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3">
                        <PlatformIcon platform={alert.platform} />
                        <div>
                          <p className="text-sm font-semibold text-brand-heading">@{alert.username}</p>
                          <p className="text-xs text-slate-400 capitalize">{alert.platform}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        <button
                          onClick={() => setDismissedIds((prev) => new Set(Array.from(prev).concat(alert.connection_id)))}
                          className="w-7 h-7 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-50 flex items-center justify-center transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    </div>

                    {/* Alert message */}
                    <p className="text-sm text-slate-600 font-light mb-5">{alert.message}</p>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <div className="text-center p-3 rounded-xl bg-red-50/70 border border-red-100">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-red-400">trending_down</span>
                          <span className="text-xs font-bold text-red-500 uppercase tracking-wide">Negativo</span>
                        </div>
                        <p className="text-xl font-sans font-medium text-red-600">
                          {(alert.negative_rate * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-amber-500">sentiment_dissatisfied</span>
                          <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Sarcasmo</span>
                        </div>
                        <p className="text-xl font-sans font-medium text-amber-600">
                          {(alert.sarcasm_rate * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="material-symbols-outlined text-[14px] text-slate-400">forum</span>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Analisados</span>
                        </div>
                        <p className="text-xl font-sans font-medium text-brand-heading">
                          {alert.total_analyzed.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    {/* Score drop visualization */}
                    {alert.avg_score !== null && (
                      <div className="flex items-center gap-3 mb-5 px-4 py-3 bg-slate-50 rounded-xl">
                        <span className="text-slate-400 text-sm font-medium">Score médio:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-sans font-medium text-brand-heading">
                            {alert.avg_score.toFixed(1)}
                          </span>
                          {alert.avg_score < 5 && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg border border-red-100">
                              <span className="material-symbols-outlined text-red-400 text-[14px]">trending_down</span>
                              <span className="text-xs font-medium text-red-600">Abaixo do normal</span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => setDismissedIds((prev) => new Set(Array.from(prev).concat(alert.connection_id)))}
                        className="py-2.5 px-4 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors border border-slate-100"
                      >
                        Ignorar
                      </button>
                      <Link
                        href={`/dashboard/connection/${alert.connection_id}`}
                        className="col-span-2 py-2.5 px-4 rounded-xl bg-brand-lilacDark text-white text-sm font-medium shadow-lg shadow-violet-200 hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                      >
                        Ver análise completa
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
