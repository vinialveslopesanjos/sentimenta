"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Bell, AlertTriangle, TrendingDown, MessageCircle, CheckCircle, Shield, Zap, Clock, Settings2, X as XIcon } from "lucide-react";
import { dashboardApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { relativeTime } from "@/lib/helpers";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { Section } from "@/components/ds/Section";
import type { SnapshotReference } from "@sentimenta/types";

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
  snapshot: SnapshotReference | null;
  days: number;
  total_alerts: number;
  alerts: Alert[];
  evaluation: {
    status: "alerts_found" | "no_alerts_valid_coverage" | "unable_to_evaluate";
    reason_code: string;
    coverage: { status: string; ratio: number | null; reason_code: string; [key: string]: unknown };
    evaluated_count: number;
    min_analyzed_per_profile: number;
  };
  generated_at: string;
};

type AlertProductState = "alerts_found" | "clear" | "no_coverage" | "monitoring_interrupted";

function alertProductState(data: AlertsData): AlertProductState {
  if (data.evaluation.status === "alerts_found") return "alerts_found";
  if (data.evaluation.status === "no_alerts_valid_coverage") return "clear";
  if (data.snapshot && ["degraded", "stale", "failed"].includes(data.snapshot.health)) {
    return "monitoring_interrupted";
  }
  return "no_coverage";
}

function AlertEvaluationNotice({ data }: { data: AlertsData }) {
  const t = useTranslations("alerts.evaluation");
  const snapshotActions = useTranslations("snapshot.actions");
  const locale = useLocale();
  const productState = alertProductState(data);
  const isFound = productState === "alerts_found";
  const isVerifiedEmpty = productState === "clear";
  const isInterrupted = productState === "monitoring_interrupted";
  const Icon = isFound || isInterrupted ? AlertTriangle : isVerifiedEmpty ? CheckCircle : Shield;
  const color = isFound
    ? "var(--sentiment-negative)"
    : isVerifiedEmpty
      ? "var(--sentiment-positive)"
      : isInterrupted
        ? "var(--accent)"
        : "var(--secondary)";
  const background = isFound
    ? "var(--sentiment-negative-bg)"
    : isVerifiedEmpty
      ? "var(--sentiment-positive-bg)"
      : isInterrupted
        ? "var(--accent-bg)"
        : "var(--secondary-bg)";
  const title = isFound
    ? t("foundTitle")
    : isVerifiedEmpty
      ? t("noneTitle")
      : isInterrupted
        ? t("interruptedTitle")
        : t("noCoverageTitle");
  const description = isFound
    ? t("foundSub", { count: data.total_alerts })
    : isVerifiedEmpty
      ? t("noneSub", { count: data.evaluation.evaluated_count, days: data.days })
      : isInterrupted
        ? t("interruptedSub")
        : t(`reasons.${data.evaluation.reason_code}`);
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const observedPeriod = data.snapshot?.period_start && data.snapshot.period_end
    ? t("observedPeriod", {
        start: formatter.format(new Date(data.snapshot.period_start)),
        end: formatter.format(new Date(data.snapshot.period_end)),
      })
    : t("observedPeriodUnknown");
  const snapshotAction = data.snapshot?.language_policy.next_action;
  const noCoverageNeedsActiveReview = productState === "no_coverage" && snapshotAction?.code === "keep_monitoring";
  const action = isVerifiedEmpty
    ? { href: "/dashboard", label: t("continueMonitoring") }
    : noCoverageNeedsActiveReview
      ? { href: "/dashboard/connect", label: snapshotActions("review_coverage") }
    : !isFound && snapshotAction
      ? { href: snapshotAction.href, label: snapshotActions(snapshotAction.code) }
      : !isFound
        ? { href: "/dashboard/connect", label: t("restoreMonitoring") }
        : null;

  return (
    <section
      data-testid="alerts-evaluation"
      data-evaluation-status={data.evaluation.status}
      data-evaluation-reason={data.evaluation.reason_code}
      data-product-state={productState}
      data-evidence-state={data.snapshot?.language_policy.mode ?? "unavailable"}
      data-snapshot-health={data.snapshot?.health ?? "unknown"}
      data-snapshot-valid-count={data.snapshot?.valid_count ?? "unknown"}
      data-snapshot-saved-count={data.snapshot?.saved_count ?? "unknown"}
      role={isFound ? "alert" : "status"}
      aria-label={title}
      className="rounded-2xl p-5 flex items-start gap-4"
      style={{ backgroundColor: background, border: `1px solid color-mix(in srgb, ${color} 35%, var(--border))` }}
      aria-live="polite"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-card)" }}>
        <Icon aria-hidden="true" className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 data-contrast-role="critical-state" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 700 }}>{title}</h2>
        <p className="mt-1" style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>{description}</p>
        <dl data-testid="alerts-evidence-window" data-contrast-scope="alerts-evidence" className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <dt data-contrast-role="critical-label" className="text-[0.7rem] font-bold uppercase tracking-[0.055em]" style={{ color: "var(--text-muted)" }}>
              {isVerifiedEmpty ? t("evaluatedWindowLabel") : t("requestedWindowLabel")}
            </dt>
            <dd data-contrast-role="critical-value" className="mt-1 text-[0.8125rem] font-semibold leading-5" style={{ color: "var(--text-primary)" }}>
              {t("requestedWindow", { days: data.days })}
            </dd>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <dt data-contrast-role="critical-label" className="text-[0.7rem] font-bold uppercase tracking-[0.055em]" style={{ color: "var(--text-muted)" }}>{t("observedPeriodLabel")}</dt>
            <dd data-contrast-role="critical-value" className="mt-1 text-[0.8125rem] font-semibold leading-5" style={{ color: "var(--text-primary)" }}>{observedPeriod}</dd>
          </div>
        </dl>
        {action && (
          <Link
            href={action.href}
            className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
          >
            {action.label}
          </Link>
        )}
      </div>
    </section>
  );
}

function AlertLoadError({ days, onRetry }: { days: number; onRetry: () => void }) {
  const t = useTranslations("alerts.evaluation");
  return (
    <section
      data-testid="alerts-load-error"
      data-product-state="error"
      role="alert"
      className="rounded-2xl p-5 flex items-start gap-4"
      style={{ backgroundColor: "var(--sentiment-negative-bg)", border: "1px solid color-mix(in srgb, var(--sentiment-negative) 35%, var(--border))" }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-card)" }}>
        <AlertTriangle aria-hidden="true" className="w-5 h-5" style={{ color: "var(--sentiment-negative)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 data-contrast-role="critical-state" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 700 }}>{t("errorTitle")}</h2>
        <p className="mt-1" style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>{t("errorSub")}</p>
        <dl data-testid="alerts-error-window" data-contrast-scope="alerts-error" className="mt-3 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <dt data-contrast-role="critical-label" className="text-[0.7rem] font-bold uppercase tracking-[0.055em]" style={{ color: "var(--text-muted)" }}>{t("requestedWindowLabel")}</dt>
          <dd data-contrast-role="critical-value" className="mt-1 text-[0.8125rem] font-semibold leading-5" style={{ color: "var(--text-primary)" }}>{t("requestedWindow", { days })}</dd>
        </dl>
        <Button variant="primary" size="sm" className="mt-3" onClick={onRetry}>{t("retry")}</Button>
      </div>
    </section>
  );
}

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

function formatAlertMessage(message: string, days?: number) {
  const withAccents = message
    .replace(/\bcomentarios\b/gi, "comentários")
    .replace(/\bestao\b/gi, "estão")
    .replace(/\bultimos\b/gi, "últimos")
    .replace(/\banalisados\b/gi, "analisados")
    .replace(/\bnegativos\b/gi, "negativos");

  if (!days || /últim|ultim|dias|24h|janela|período|periodo/i.test(withAccents)) return withAccents;
  return `${withAccents} nos últimos ${days} dias.`;
}

function Slider({ value, onChange, min = 0, max = 100, unit = "%", label, displayValue }: { value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string; label: string; displayValue?: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
        <span className="px-2.5 py-0.5 rounded-lg" style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>{displayValue ?? `${value}${unit}`}</span>
      </div>

      <div className="relative h-2 rounded-full cursor-pointer" style={{ backgroundColor: "var(--bg-subtle)" }} onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); onChange(Math.round(min + x * (max - min))); }}>
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, var(--primary), var(--secondary))` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 shadow-md" style={{ left: `calc(${pct}% - 8px)`, backgroundColor: "var(--bg-card)", borderColor: "var(--primary)" }} />
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const t = useTranslations("alerts");
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState<"history" | "config">("history");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Config state
  const [scoreThreshold, setScoreThreshold] = useState(50);
  const [negativeThreshold, setNegativeThreshold] = useState(40);
  const [emotionThreshold, setEmotionThreshold] = useState(30);
  const [wordThreshold, setWordThreshold] = useState(15);
  const [keywords, setKeywords] = useState(["vergonha", "mentira", "fraude", "roubo"]);
  const [newKeyword, setNewKeyword] = useState("");

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

  const allAlerts = (data?.alerts || []).filter(a => !dismissedIds.has(a.connection_id));
  const unreadAlerts = allAlerts.filter(a => !readIds.has(a.connection_id));

  const filtered = filter === "all"
    ? allAlerts
    : filter === "unread"
      ? unreadAlerts
      : filter === "crisis"
        ? allAlerts.filter(a => a.severity === "critical")
        : allAlerts.filter(a => a.severity === "high");

  const markRead = (id: string) => setReadIds(prev => new Set(Array.from(prev).concat(id)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.7rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("title")}</h1>
          <p className="mt-1" style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>{t("subtitle")}</p>
        </div>
        {!loading && !error && unreadAlerts.length > 0 && (
          <Badge variant="negative" dot>{t("unread", { count: unreadAlerts.length })}</Badge>
        )}
      </div>


      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl p-1" style={{ backgroundColor: "var(--bg-subtle)" }}>
        {[{ k: "history" as const, l: t("tabs.history"), icon: Bell }, { k: "config" as const, l: t("tabs.config"), icon: Settings2 }].map(tb => (
          <button key={tb.k} onClick={() => setTab(tb.k)} className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all" style={{ fontSize: "0.82rem", fontWeight: 500, backgroundColor: tab === tb.k ? "var(--bg-card)" : "transparent", color: tab === tb.k ? "var(--text-primary)" : "var(--text-muted)", boxShadow: tab === tb.k ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>
            <tb.icon className="w-4 h-4" />
            {tb.l}
          </button>
        ))}
      </div>

      {tab === "history" && (
        <>
          {!loading && !error && allAlerts.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-xl p-1" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              {[{ key: "all", label: t("filters.all") }, { key: "unread", label: t("filters.unread") }, { key: "crisis", label: t("filters.crisis") }, { key: "warning", label: t("filters.warning") }].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} className="px-3.5 py-2 rounded-lg transition-all" style={{ fontSize: "0.82rem", fontWeight: 500, backgroundColor: filter === f.key ? "var(--primary-bg)" : "transparent", color: filter === f.key ? "var(--primary)" : "var(--text-muted)" }}>
                  {f.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" icon={<Clock className="w-3.5 h-3.5" />} onClick={() => setReadIds(new Set(allAlerts.map(a => a.connection_id)))}>
              {t("markAllRead")}
            </Button>
          </div>
          )}

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
            <AlertLoadError days={days} onRetry={() => loadAlerts(days)} />
          )}

          {!loading && !error && data && <AlertEvaluationNotice data={data} />}

          {!loading && !error && filtered.length === 0 && allAlerts.length > 0 && (
            <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <Bell className="w-8 h-8" style={{ color: "var(--text-faint)" }} />
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                {t("filterEmpty.title")}
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {t("filterEmpty.sub")}
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((alert, i) => {
                const alertType = alertTypeFromSeverity(alert.severity);
                const AlertIcon = alertIconFromSeverity(alert.severity);
                const isUnread = !readIds.has(alert.connection_id);
                const displayMessage = formatAlertMessage(alert.message, data?.days);
                return (
                  <div
                    key={alert.connection_id}
                    onClick={() => markRead(alert.connection_id)}
                    className="rounded-2xl p-5 flex items-start gap-4 transition-all cursor-pointer"
                    style={{
                      backgroundColor: isUnread ? "color-mix(in srgb, var(--primary-bg) 42%, var(--bg-card))" : "var(--bg-card)",
                      border: `1px solid ${isUnread ? "var(--primary)" : "var(--border)"}`,
                      boxShadow: isUnread ? "0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent)" : "none",
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: alertType === "danger" ? "var(--sentiment-negative-bg)" : alertType === "warning" ? "var(--secondary-bg)" : "var(--primary-bg)" }}>
                      <AlertIcon className="w-5 h-5" style={{ color: alertType === "danger" ? "var(--sentiment-negative)" : alertType === "warning" ? "var(--secondary)" : "var(--primary)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-2">
                          <h3 style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-primary)" }}>
                            {displayMessage.split(":")[0] || `Alerta @${alert.username}`}
                          </h3>
                          {isUnread && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />}
                        </div>
                        <span className="shrink-0" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>
                          {relativeTime(data?.generated_at ?? new Date().toISOString())}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--text-muted)" }}>{displayMessage}</p>
                      {alert.avg_score !== null && (
                        <p className="mt-1" style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
                          Score: {alert.avg_score.toFixed(1)}/10 &middot; @{alert.username}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <Link href={`/dashboard/profile/${alert.connection_id}`} onClick={e => e.stopPropagation()}>
                          <Button variant="primary" size="sm">{t("viewDetails")}</Button>
                        </Link>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDismissedIds(prev => new Set(Array.from(prev).concat(alert.connection_id))); }}>
                          {t("dismiss")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "config" && (
        <div className="space-y-5">
          <Section title={t("config.scoreThreshold")} subtitle={t("config.scoreThresholdSub")}>
            <Slider value={scoreThreshold} onChange={setScoreThreshold} min={0} max={100} unit="/10" displayValue={`${(scoreThreshold / 10).toFixed(1)}/10`} label={t("config.scoreThresholdLabel", { value: (scoreThreshold / 10).toFixed(1) })} />
            <p className="mt-3" style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>{t("config.currentlySet", { value: (scoreThreshold / 10).toFixed(1) })}</p>
          </Section>

          <Section title={t("config.negativeComments")} subtitle={t("config.negativeCommentsSub")}>
            <Slider value={negativeThreshold} onChange={setNegativeThreshold} min={0} max={100} unit="%" label={t("config.negativeLabel", { value: negativeThreshold })} />
          </Section>

          <Section title={t("config.riskEmotions")} subtitle={t("config.riskEmotionsSub")}>
            <Slider value={emotionThreshold} onChange={setEmotionThreshold} min={0} max={100} unit="%" label={t("config.riskLabel", { value: emotionThreshold })} />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {["Raiva", "Nojo", "Tristeza"].map(e => (
                <span key={e} className="px-2.5 py-1 rounded-lg" style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--sentiment-negative)", backgroundColor: "var(--sentiment-negative-bg)" }}>{e}</span>
              ))}
            </div>
          </Section>

          <Section title={t("config.monitoredKeywords")} subtitle={t("config.monitoredKeywordsSub")}>
            <Slider value={wordThreshold} onChange={setWordThreshold} min={0} max={50} unit="%" label={t("config.keywordLabel", { value: wordThreshold })} />
            <div className="mt-4">
              <p className="mb-2" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("config.monitoredWords")}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {keywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg" style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>
                    {kw}
                    <button type="button" aria-label={t("config.removeKeyword", { keyword: kw })} onClick={() => setKeywords(keywords.filter(k => k !== kw))} className="hover:opacity-70"><XIcon className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t("config.addKeywordPlaceholder")}
                  value={newKeyword}
                  onChange={e => setNewKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newKeyword.trim()) { setKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); } }}
                  className="flex-1 px-3 py-2 rounded-xl transition-all"
                  style={{ fontSize: "0.82rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                />
                <Button variant="primary" size="sm" onClick={() => { if (newKeyword.trim()) { setKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); } }}>{t("config.addButton")}</Button>
              </div>
            </div>
          </Section>

          <div className="flex justify-end">
            <Button variant="primary">{t("config.saveSettings")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
