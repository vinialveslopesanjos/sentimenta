"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CheckCircle, Shield, TrendingDown, Zap } from "lucide-react";
import { dashboardApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { relativeTime } from "@/lib/helpers";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";

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

function alertTypeFromSeverity(severity: string): "danger" | "warning" | "info" {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  return "info";
}

function alertIconFromSeverity(severity: string) {
  if (severity === "critical") return Shield;
  if (severity === "high") return TrendingDown;
  return Zap;
}

export default function AlertsPage() {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState("all");

  async function loadAlerts(d: number) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.alerts(token, { days: d });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorLoading"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAlerts(days); }, [days]);

  const allAlerts = data?.alerts || [];

  const filtered = filter === "all"
    ? allAlerts
    : filter === "crisis"
      ? allAlerts.filter(a => a.severity === "critical")
      : allAlerts.filter(a => a.severity === "high");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.7rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("title")}</h1>
          <p className="mt-1" style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>{t("subtitle")}</p>
        </div>
        <Badge variant="negative" dot>{t("activeCount", { count: allAlerts.length })}</Badge>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {[{ key: "all", label: t("filters.all") }, { key: "crisis", label: t("filters.crisis") }, { key: "warning", label: t("filters.warning") }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className="px-3.5 py-2 rounded-lg transition-all" style={{ fontSize: "0.82rem", fontWeight: 500, backgroundColor: filter === f.key ? "var(--primary-bg)" : "transparent", color: filter === f.key ? "var(--primary)" : "var(--text-muted)" }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
                  <div className="h-3 w-64 rounded" style={{ backgroundColor: "var(--bg-subtle)" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: "0.82rem", color: "var(--sentiment-negative)" }}>{error}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => loadAlerts(days)}>{tc("retry")}</Button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--sentiment-positive-bg)" }}>
            <CheckCircle className="w-8 h-8" style={{ color: "var(--sentiment-positive)" }} />
          </div>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
            {t("allClear.allTitle")}
          </h3>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            {t("allClear.allSub", { days })}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(alert => {
            const alertType = alertTypeFromSeverity(alert.severity);
            const AlertIcon = alertIconFromSeverity(alert.severity);
            return (
              <div
                key={alert.connection_id}
                className="rounded-2xl p-5 flex items-start gap-4 transition-all"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: alertType === "danger" ? "var(--sentiment-negative-bg)" : alertType === "warning" ? "var(--secondary-bg)" : "var(--primary-bg)" }}>
                  <AlertIcon className="w-5 h-5" style={{ color: alertType === "danger" ? "var(--sentiment-negative)" : alertType === "warning" ? "var(--secondary)" : "var(--primary)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                    <h3 style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
                      {alert.message.split(":")[0] || `Alerta @${alert.username}`}
                    </h3>
                    <span className="shrink-0" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>
                      {relativeTime(data?.generated_at ?? new Date().toISOString())}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--text-muted)" }}>{alert.message}</p>
                  {alert.avg_score !== null && (
                    <p className="mt-1" style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
                      Score: {alert.avg_score.toFixed(1)}/10 &middot; @{alert.username}
                    </p>
                  )}
                  <div className="mt-3">
                    <Link href={`/dashboard/profile/${alert.connection_id}`}>
                      <Button variant="primary" size="sm">{t("viewDetails")}</Button>
                    </Link>
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
