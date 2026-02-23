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

// Mock unread state for UI fidelity (in production this would come from the API)
const MOCK_UNREAD_IDS = new Set<string>();

function alertIcon(severity: string) {
  if (severity === "critical") return { icon: "warning", bg: "bg-rose-100 text-rose-500" };
  if (severity === "high") return { icon: "warning", bg: "bg-amber-100 text-amber-500" };
  if (severity === "medium") return { icon: "info", bg: "bg-cyan-100 text-cyan-600" };
  return { icon: "check_circle", bg: "bg-emerald-100 text-emerald-600" };
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Agora";
  if (h < 24) return `Há ${h}h`;
  const d = Math.floor(h / 24);
  return `Há ${d}d`;
}

export default function AlertsPage() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

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

  const allAlerts = (data?.alerts || []).filter((a) => !dismissedIds.has(a.connection_id));
  const unreadAlerts = allAlerts.filter((a) => !readIds.has(a.connection_id));
  const visibleAlerts = tab === "unread" ? unreadAlerts : allAlerts;

  const markRead = (id: string) => setReadIds((prev) => new Set(Array.from(prev).concat(id)));

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-white/60 px-6 md:px-8 py-5 flex items-center justify-between shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-sans font-bold text-slate-800 tracking-tight">Alertas</h1>
            {unreadAlerts.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                {unreadAlerts.length} novos
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 font-light mt-0.5">Sinais de risco e oportunidades.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Days filter */}
          <div className="flex items-center gap-1 bg-white/80 border border-slate-100 rounded-xl shadow-sm text-sm overflow-hidden">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3.5 py-2 font-semibold transition-all ${days === d ? "bg-brand-lilacDark text-white" : "text-slate-400 hover:text-slate-600"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => loadAlerts(days)}
            className="w-9 h-9 rounded-xl bg-white/80 border border-slate-100 text-slate-400 hover:text-brand-lilacDark hover:border-brand-lilac flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>
      </header>

      <main className="p-6 md:p-8 max-w-4xl mx-auto space-y-5">

        {/* Tab filter */}
        {!loading && !error && (
          <div className="dream-card p-1.5 flex gap-1">
            <button
              onClick={() => setTab("all")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${tab === "all" ? "bg-white shadow-sm text-brand-lilacDark" : "text-slate-400 hover:text-slate-600"
                }`}
            >
              Todos
            </button>
            <button
              onClick={() => setTab("unread")}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${tab === "unread" ? "bg-white shadow-sm text-brand-lilacDark" : "text-slate-400 hover:text-slate-600"
                }`}
            >
              Não lidos
              {unreadAlerts.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "unread" ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"}`}>
                  {unreadAlerts.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="dream-card p-5 flex gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-2xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-slate-100 rounded" />
                  <div className="h-3 w-64 bg-slate-50 rounded" />
                  <div className="h-3 w-20 bg-slate-50 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="dream-card p-8 text-center">
            <span className="material-symbols-outlined text-[32px] text-rose-400 mb-2 block">error</span>
            <p className="text-slate-500 text-sm">{error}</p>
            <button onClick={() => loadAlerts(days)} className="mt-4 px-4 py-2 bg-brand-lilacDark text-white text-sm rounded-xl hover:opacity-90">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && visibleAlerts.length === 0 && (
          <div className="dream-card p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px] text-emerald-500">check_circle</span>
            </div>
            <h3 className="text-xl font-sans font-bold text-slate-700 mb-2">
              {tab === "unread" ? "Nenhum alerta não lido!" : "Tudo certo!"}
            </h3>
            <p className="text-slate-400 text-sm font-light max-w-xs mx-auto">
              {tab === "unread"
                ? "Você está em dia com todos os alertas."
                : `Nenhum alerta encontrado nos últimos ${days} dias.`}
            </p>
          </div>
        )}

        {/* Alert cards list */}
        {!loading && !error && visibleAlerts.length > 0 && (
          <div className="space-y-3">
            {visibleAlerts.map((alert, idx) => {
              const { icon: alertIconName, bg: alertBg } = alertIcon(alert.severity);
              const isUnread = !readIds.has(alert.connection_id);
              const cardTint = alert.severity === "critical"
                ? "dream-card-rose"
                : alert.severity === "high"
                  ? "dream-card-amber"
                  : alert.severity === "medium"
                    ? "dream-card-cyan"
                    : "";

              return (
                <div
                  key={alert.connection_id}
                  className={`dream-card ${cardTint} p-5 transition-all duration-300 hover:-translate-y-0.5`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  onClick={() => markRead(alert.connection_id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-2xl ${alertBg} flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-[20px]">{alertIconName}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {alert.message.split(":")[0] || `Alerta @${alert.username}`}
                        </p>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-brand-lilacDark shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500 font-light leading-relaxed mb-2">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-slate-400">
                          {relativeTime(data?.generated_at ?? new Date().toISOString())}
                        </p>
                        <span className="text-slate-200">·</span>
                        <span className="text-xs text-slate-400 capitalize">@{alert.username}</span>
                        {alert.avg_score !== null && (
                          <>
                            <span className="text-slate-200">·</span>
                            <span className="text-xs font-bold text-slate-500">
                              Score: {alert.avg_score.toFixed(1)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDismissedIds((prev) => new Set(Array.from(prev).concat(alert.connection_id)));
                      }}
                      className="w-7 h-7 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-white/60 flex items-center justify-center transition-colors shrink-0"
                      title="Ignorar"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>

                  {/* CTA */}
                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/dashboard/connection/${alert.connection_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-center py-2.5 rounded-xl bg-gradient-to-r from-brand-lilacDark to-brand-cyanDark text-white text-xs font-bold shadow-sm hover:shadow-md hover:shadow-violet-200 transition-all hover:-translate-y-px"
                    >
                      Ver análise completa →
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDismissedIds((prev) => new Set(Array.from(prev).concat(alert.connection_id)));
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-colors border border-slate-100/60"
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
