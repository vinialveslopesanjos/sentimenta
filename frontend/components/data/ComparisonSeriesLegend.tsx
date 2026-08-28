"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ConnectionComparison } from "@sentimenta/types";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";
import { Badge } from "@/components/ds/Badge";

export type ComparisonLegendItem = {
  role: "A" | "B";
  label: string;
  color: string;
  dashed: boolean;
  series: ConnectionComparison;
};

const healthVariants = {
  healthy: "positive",
  degraded: "warning",
  stale: "muted",
  failed: "negative",
  never_synced: "muted",
} as const;

function formatUtcDateTime(value: string | null, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatUtcDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function ComparisonSeriesLegend({ items }: { items: ComparisonLegendItem[] }) {
  const locale = useLocale();
  const t = useTranslations("analysis");
  const basesDiffer = items.length > 1 && new Set(
    items.map(item => `${item.series.valid_count}/${item.series.saved_count}`),
  ).size > 1;

  return (
    <div data-testid="comparison-series-legend" className="mb-4 space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map(item => {
          const { series } = item;
          const lastSuccess = formatUtcDateTime(series.health?.last_success_at ?? null, locale);
          const observedStart = formatUtcDate(series.observed_period_start, locale);
          const observedEnd = formatUtcDate(series.observed_period_end, locale);
          return (
            <div
              key={series.connection_id}
              data-testid={`comparison-series-${series.connection_id}`}
              data-platform={series.platform}
              data-username={series.username}
              data-saved-count={series.saved_count}
              data-valid-count={series.valid_count}
              data-health-state={series.health?.state ?? "unknown"}
              data-last-success-at={series.health?.last_success_at ?? ""}
              className="rounded-xl p-3.5"
              style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: item.color, color: "white", fontSize: "0.72rem", fontWeight: 750 }}>
                    {item.role}
                  </span>
                  <GlassSocialIcon platform={series.platform} size={28} />
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      {item.label}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span aria-hidden="true" className="inline-block w-8" style={{ borderTop: `2.5px ${item.dashed ? "dashed" : "solid"} ${item.color}` }} />
                      <span style={{ fontSize: "0.66rem", color: "var(--text-faint)" }}>{t("series.line", { role: item.role })}</span>
                    </div>
                  </div>
                </div>
                {series.health ? (
                  <Badge variant={healthVariants[series.health.state]}>{t(`series.health.${series.health.state}`)}</Badge>
                ) : (
                  <Badge variant="muted">{t("series.health.unknown")}</Badge>
                )}
              </div>

              <div className="mt-3 space-y-2" style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "var(--text-muted)" }}>
                <p
                  data-testid={`comparison-series-freshness-${series.connection_id}`}
                  data-contrast-role="critical-value"
                  className="rounded-lg px-2.5 py-2"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 700 }}
                >
                  {!series.health
                    ? t("series.freshnessUnknown")
                    : lastSuccess
                    ? t("series.lastSuccess", { date: lastSuccess })
                    : t("series.lastSuccessNever")}
                </p>
                <p data-contrast-role="critical-value">
                  {observedStart && observedEnd
                    ? t("series.observedPeriod", { start: observedStart, end: observedEnd })
                    : t("series.observedPeriodUnknown")}
                </p>
                <p data-contrast-role="critical-value">{t("series.denominator", { valid: series.valid_count, saved: series.saved_count })}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "var(--text-muted)" }}>
        {t("series.scoreDefinition")}
      </p>
      {basesDiffer && (
        <p
          data-testid="comparison-series-denominator-note"
          className="rounded-lg px-3 py-2"
          style={{ fontSize: "0.7rem", lineHeight: 1.5, color: "var(--text-muted)", backgroundColor: "var(--secondary-bg)", border: "1px solid color-mix(in srgb, var(--secondary) 25%, transparent)" }}
        >
          {t("series.differentBases")}
        </p>
      )}
    </div>
  );
}
