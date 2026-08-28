"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { SnapshotReference } from "@sentimenta/types";

function snapshotScore(snapshot: SnapshotReference): number | null {
  const global = snapshot.metrics.global;
  if (!global || typeof global !== "object") return null;
  const score = (global as Record<string, unknown>).avg_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function SnapshotStamp({ snapshot }: { snapshot: SnapshotReference | null }) {
  const locale = useLocale();
  const t = useTranslations("snapshot");

  if (!snapshot) return null;

  const formatter = new Intl.DateTimeFormat(locale, {
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
        start: formatter.format(new Date(snapshot.period_start)),
        end: formatter.format(new Date(snapshot.period_end)),
      })
    : t("periodUnknown");
  const denominators = snapshot.valid_count != null && snapshot.saved_count != null
    ? t("denominators", { valid: snapshot.valid_count, saved: snapshot.saved_count })
    : t("denominatorsUnknown");
  const score = snapshotScore(snapshot);
  const lastSuccess = snapshot.last_success_at
    ? dateTimeFormatter.format(new Date(snapshot.last_success_at))
    : t("global.lastSuccessNever");
  const shortId = snapshot.id.slice(0, 8);
  const languagePolicy = snapshot.language_policy;
  const nextAction = languagePolicy.next_action;

  return (
    <section
      aria-label={t("ariaLabel")}
      className="flex flex-col gap-3 rounded-xl px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
      style={{
        backgroundColor: "var(--bg-subtle)",
        border: "1px solid var(--border)",
      }}
      data-testid="snapshot-stamp"
      data-snapshot-id={snapshot.id}
      data-snapshot-score={score ?? "unknown"}
      data-snapshot-valid-count={snapshot.valid_count ?? "unknown"}
      data-snapshot-saved-count={snapshot.saved_count ?? "unknown"}
      data-snapshot-health={snapshot.health}
      data-snapshot-coverage={languagePolicy.coverage_status}
      data-language-mode={languagePolicy.mode}
      data-language-message={languagePolicy.message_key}
      data-next-action={nextAction?.code ?? "unknown"}
      data-last-success-at={snapshot.last_success_at ?? "never"}
    >
      <div className="min-w-0 flex-1">
        <p style={{ color: "var(--text-muted)", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {t("basis")}
        </p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-3">
          <div data-testid="snapshot-stamp-freshness" data-contrast-scope="freshness" className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <dt data-contrast-role="critical-label" style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t("global.lastSuccessLabel")}</dt>
            <dd data-contrast-role="critical-value" className="mt-1" style={{ color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 750, lineHeight: 1.45 }}>{lastSuccess}</dd>
          </div>
          <div className="px-1 py-2">
            <dt data-contrast-role="critical-label" style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t("global.periodLabel")}</dt>
            <dd data-contrast-role="critical-value" className="mt-1" style={{ color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 650, lineHeight: 1.45 }}>{period}</dd>
          </div>
          <div className="px-1 py-2">
            <dt data-contrast-role="critical-label" style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t("global.basisLabel")}</dt>
            <dd data-contrast-role="critical-value" className="mt-1" style={{ color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 650, lineHeight: 1.45 }}>{denominators}</dd>
          </div>
        </dl>
        <p data-testid="trust-language" className="mt-2" style={{ color: "var(--text-muted)", fontSize: "0.8125rem", lineHeight: 1.5 }}>
          {t(`language.${languagePolicy.message_key}`)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
        <p style={{ color: "var(--text-primary)", fontSize: "0.8rem" }}>
          {t("score")} <strong>{score == null ? "—" : `${score.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}/10`}</strong>
        </p>
        <code style={{ color: "var(--text-faint)", fontSize: "0.7rem" }} title={snapshot.id}>
          {t("id", { id: shortId })}
        </code>
        {nextAction && (
          <Link
            href={nextAction.href}
            className="rounded-lg px-2.5 py-1.5"
            style={{ backgroundColor: "var(--primary-bg)", color: "var(--primary)", fontSize: "0.72rem", fontWeight: 700 }}
          >
            {t(`actions.${nextAction.code}`)}
          </Link>
        )}
      </div>
    </section>
  );
}
