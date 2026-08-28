"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { DataSnapshot, SnapshotHealthState } from "@sentimenta/types";

type LoadState = "loading" | "ready" | "error";

interface GlobalDataStatusProps {
  snapshot: DataSnapshot | null;
  loadState: LoadState;
  onRetry: () => void;
}

type Tone = {
  icon: LucideIcon;
  foreground: string;
  background: string;
  border: string;
};

const TONES: Record<SnapshotHealthState | "error", Tone> = {
  healthy: {
    icon: CheckCircle2,
    foreground: "var(--sentiment-positive)",
    background: "var(--sentiment-positive-bg)",
    border: "color-mix(in srgb, var(--sentiment-positive) 38%, var(--border))",
  },
  degraded: {
    icon: AlertTriangle,
    foreground: "var(--accent)",
    background: "var(--accent-bg)",
    border: "color-mix(in srgb, var(--accent) 42%, var(--border))",
  },
  stale: {
    icon: Clock3,
    foreground: "var(--accent)",
    background: "var(--accent-bg)",
    border: "color-mix(in srgb, var(--accent) 42%, var(--border))",
  },
  failed: {
    icon: XCircle,
    foreground: "var(--sentiment-negative)",
    background: "var(--sentiment-negative-bg)",
    border: "color-mix(in srgb, var(--sentiment-negative) 42%, var(--border))",
  },
  never_synced: {
    icon: Database,
    foreground: "var(--primary)",
    background: "var(--primary-bg)",
    border: "color-mix(in srgb, var(--primary) 34%, var(--border))",
  },
  error: {
    icon: XCircle,
    foreground: "var(--sentiment-negative)",
    background: "var(--sentiment-negative-bg)",
    border: "color-mix(in srgb, var(--sentiment-negative) 42%, var(--border))",
  },
};

function snapshotScore(snapshot: DataSnapshot): number | null {
  const global = snapshot.metrics.global;
  if (!global || typeof global !== "object") return null;
  const score = (global as Record<string, unknown>).avg_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function stateLabelKey(snapshot: DataSnapshot): string {
  if (snapshot.reason_code === "latest_attempt_partial") return "partial";
  if (snapshot.reason_code === "latest_attempt_failed") return "failedAttempt";
  if (snapshot.health === "healthy" && (snapshot.valid_count ?? 0) === 0) return "healthyNoAnalysis";
  return snapshot.health;
}

export function GlobalDataStatus({ snapshot, loadState, onRetry }: GlobalDataStatusProps) {
  const locale = useLocale();
  const t = useTranslations("snapshot");

  if (loadState === "loading") {
    return (
      <section
        aria-label={t("global.ariaLabel")}
        aria-busy="true"
        className="border-b"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        data-testid="global-data-status-loading"
      >
        <div className="mx-auto flex min-h-[84px] max-w-[1320px] items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: "var(--bg-hover)" }} />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-28 animate-pulse rounded" style={{ backgroundColor: "var(--border)" }} />
            <div className="mt-2 h-4 w-full max-w-xl animate-pulse rounded" style={{ backgroundColor: "var(--bg-hover)" }} />
          </div>
        </div>
      </section>
    );
  }

  if (loadState === "error") {
    const tone = TONES.error;
    const Icon = tone.icon;
    return (
      <section
        aria-label={t("global.ariaLabel")}
        role="alert"
        className="border-b"
        style={{ backgroundColor: tone.background, borderColor: tone.border }}
        data-testid="global-data-status-error"
      >
        <div className="mx-auto flex min-h-[84px] max-w-[1320px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center md:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: tone.foreground }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{t("global.errorTitle")}</p>
              <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--text-muted)" }}>{t("global.errorDescription")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: tone.foreground, border: `1px solid ${tone.border}`, backgroundColor: "var(--bg-card)" }}
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            {t("global.retry")}
          </button>
        </div>
      </section>
    );
  }

  if (!snapshot) {
    const tone = TONES.never_synced;
    const Icon = tone.icon;
    return (
      <section
        aria-label={t("global.ariaLabel")}
        role="status"
        className="border-b"
        style={{ backgroundColor: tone.background, borderColor: tone.border }}
        data-testid="global-data-status"
        data-snapshot-health="never_synced"
        data-status-state="no_snapshot"
      >
        <div className="mx-auto flex min-h-[84px] max-w-[1320px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center md:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: tone.foreground }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{t("global.noSnapshotTitle")}</p>
              <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--text-muted)" }}>{t("global.noSnapshotDescription")}</p>
            </div>
          </div>
          <Link
            href="/dashboard/connect"
            className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
          >
            {t("global.noSnapshotAction")}
          </Link>
        </div>
      </section>
    );
  }

  const tone = TONES[snapshot.health];
  const Icon = tone.icon;
  const score = snapshotScore(snapshot);
  const nextAction = snapshot.language_policy.next_action;
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  const period = snapshot.period_start && snapshot.period_end
    ? t("period", {
        start: dateFormatter.format(new Date(snapshot.period_start)),
        end: dateFormatter.format(new Date(snapshot.period_end)),
      })
    : t("periodUnknown");
  const lastSuccess = snapshot.last_success_at
    ? dateTimeFormatter.format(new Date(snapshot.last_success_at))
    : t("global.lastSuccessNever");
  const denominators = snapshot.valid_count != null && snapshot.saved_count != null
    ? t("denominators", { valid: snapshot.valid_count, saved: snapshot.saved_count })
    : t("denominatorsUnknown");

  return (
    <section
      aria-label={t("global.ariaLabel")}
      role="status"
      aria-live="polite"
      className="border-b"
      style={{ backgroundColor: tone.background, borderColor: tone.border }}
      data-testid="global-data-status"
      data-snapshot-id={snapshot.id}
      data-snapshot-score={score ?? "unknown"}
      data-snapshot-valid-count={snapshot.valid_count ?? "unknown"}
      data-snapshot-saved-count={snapshot.saved_count ?? "unknown"}
      data-snapshot-health={snapshot.health}
      data-snapshot-reason={snapshot.reason_code}
      data-snapshot-coverage={snapshot.language_policy.coverage_status}
      data-language-mode={snapshot.language_policy.mode}
      data-language-message={snapshot.language_policy.message_key}
      data-next-action={nextAction.code}
      data-last-success-at={snapshot.last_success_at ?? "never"}
    >
      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-4 py-3 md:px-6 lg:px-8 2xl:flex-row 2xl:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{ color: tone.foreground, backgroundColor: "var(--bg-card)", border: `1px solid ${tone.border}` }}
          >
            <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em]" style={{ color: tone.foreground }}>
                {t("global.eyebrow")}
              </p>
              <p data-contrast-role="critical-state" className="text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>
                {t(`global.states.${stateLabelKey(snapshot)}`)}
              </p>
            </div>
            <p data-testid="trust-language" className="mt-0.5 max-w-[70ch] text-[0.8125rem] leading-5" style={{ color: "var(--text-muted)" }}>
              {t(`language.${snapshot.language_policy.message_key}`)}
            </p>
          </div>
        </div>

        <dl data-testid="global-data-evidence" className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 xl:flex xl:items-center">
          <div
            data-testid="global-data-freshness"
            data-contrast-scope="freshness"
            className="col-span-2 min-w-0 rounded-xl px-3 py-2 sm:col-span-1 xl:w-[184px]"
            style={{ backgroundColor: "var(--bg-card)", border: `1px solid ${tone.border}` }}
          >
            <dt data-contrast-role="critical-label" className="flex items-center gap-1.5 text-[0.7rem] font-extrabold uppercase tracking-[0.055em]" style={{ color: "var(--text-muted)" }}>
              <Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {t("global.lastSuccessLabel")}
            </dt>
            <dd data-contrast-role="critical-value" className="mt-1 text-[0.8125rem] font-bold leading-5" style={{ color: "var(--text-primary)" }} title={lastSuccess}>{lastSuccess}</dd>
          </div>
          <div data-testid="global-data-period" className="min-w-0 py-2 xl:w-[176px]">
            <dt data-contrast-role="critical-label" className="text-[0.7rem] font-bold uppercase tracking-[0.055em]" style={{ color: "var(--text-muted)" }}>{t("global.periodLabel")}</dt>
            <dd data-contrast-role="critical-value" className="mt-1 text-[0.8125rem] font-semibold leading-5" style={{ color: "var(--text-primary)" }} title={period}>{period}</dd>
          </div>
          <div data-testid="global-data-basis" className="min-w-0 py-2 xl:w-[140px]">
            <dt data-contrast-role="critical-label" className="text-[0.7rem] font-bold uppercase tracking-[0.055em]" style={{ color: "var(--text-muted)" }}>{t("global.basisLabel")}</dt>
            <dd data-contrast-role="critical-value" className="mt-1 text-[0.8125rem] font-semibold leading-5" style={{ color: "var(--text-primary)" }} title={denominators}>{denominators}</dd>
          </div>
          <div data-testid="global-data-score" className="min-w-0 py-2 xl:w-[88px]">
            <dt data-contrast-role="critical-label" className="text-[0.7rem] font-bold uppercase tracking-[0.055em]" style={{ color: "var(--text-muted)" }}>{t("global.scoreLabel")}</dt>
            <dd data-contrast-role="critical-value" className="mt-1 text-[0.8125rem] font-semibold leading-5" style={{ color: "var(--text-primary)" }}>
              {score == null ? t("global.notAvailable") : `${score.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}/10`}
            </dd>
          </div>
        </dl>

        <div className="flex shrink-0 items-center justify-between gap-3 2xl:justify-end">
          <code className="text-[0.65rem]" style={{ color: "var(--text-faint)" }} title={snapshot.id}>
            {t("global.snapshotId", { id: snapshot.id.slice(0, 8) })}
          </code>
          <Link
            href={nextAction.href}
            className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-center text-xs font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
          >
            {t(`actions.${nextAction.code}`)}
          </Link>
        </div>
      </div>
    </section>
  );
}
