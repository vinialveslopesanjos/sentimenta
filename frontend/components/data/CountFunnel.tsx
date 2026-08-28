"use client";

import { Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { SnapshotReference } from "@sentimenta/types";

type CountKey =
  | "found_count"
  | "eligible_count"
  | "collected_count"
  | "saved_count"
  | "analyzed_count"
  | "valid_count"
  | "ignored_count";

type CountSurface = "dashboard" | "profile" | "comparison" | "logs" | "provenance";

const STAGES: Array<{ key: CountKey; translationKey: string; branch?: boolean }> = [
  { key: "found_count", translationKey: "found" },
  { key: "eligible_count", translationKey: "eligible" },
  { key: "collected_count", translationKey: "collected" },
  { key: "saved_count", translationKey: "saved" },
  { key: "analyzed_count", translationKey: "analyzed" },
  { key: "valid_count", translationKey: "valid" },
  { key: "ignored_count", translationKey: "ignored", branch: true },
];

const SEQUENTIAL_KEYS: CountKey[] = [
  "found_count",
  "eligible_count",
  "collected_count",
  "saved_count",
  "analyzed_count",
  "valid_count",
];

function isKnown(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function reconciliationState(snapshot: SnapshotReference): "complete" | "partial" | "invalid" {
  let invalid = false;
  for (let index = 1; index < SEQUENTIAL_KEYS.length; index += 1) {
    const previous = snapshot[SEQUENTIAL_KEYS[index - 1]];
    const current = snapshot[SEQUENTIAL_KEYS[index]];
    if (isKnown(previous) && isKnown(current) && current > previous) invalid = true;
  }

  if (
    isKnown(snapshot.found_count)
    && isKnown(snapshot.eligible_count)
    && isKnown(snapshot.ignored_count)
    && snapshot.ignored_count !== snapshot.found_count - snapshot.eligible_count
  ) {
    invalid = true;
  }

  if (invalid) return "invalid";
  return STAGES.every(({ key }) => isKnown(snapshot[key])) ? "complete" : "partial";
}

export function CountFunnel({
  snapshot,
  surface,
}: {
  snapshot: SnapshotReference | null;
  surface: CountSurface;
}) {
  const locale = useLocale();
  const t = useTranslations("snapshot.funnel");

  if (!snapshot) return null;

  const formatter = new Intl.NumberFormat(locale);
  const state = reconciliationState(snapshot);
  const hasUnknown = STAGES.some(({ key }) => !isKnown(snapshot[key]));
  const differences: string[] = [];

  const addDifference = (from: CountKey, to: CountKey, key: string) => {
    const fromValue = snapshot[from];
    const toValue = snapshot[to];
    if (isKnown(fromValue) && isKnown(toValue) && fromValue > toValue) {
      differences.push(t(`differences.${key}`, { count: formatter.format(fromValue - toValue) }));
    }
  };

  addDifference("found_count", "eligible_count", "foundEligible");
  addDifference("eligible_count", "collected_count", "eligibleCollected");
  addDifference("collected_count", "saved_count", "collectedSaved");
  addDifference("saved_count", "analyzed_count", "savedAnalyzed");
  addDifference("analyzed_count", "valid_count", "analyzedValid");

  const statusLabel = state === "invalid"
    ? t("status.invalid")
    : state === "complete"
      ? t("status.complete")
      : t("status.partial");

  return (
    <section
      data-testid={`count-funnel-${surface}`}
      data-snapshot-id={snapshot.id}
      data-count-reconciled={state === "invalid" ? "false" : state === "complete" ? "true" : "partial"}
      data-count-found={snapshot.found_count ?? "unknown"}
      data-count-eligible={snapshot.eligible_count ?? "unknown"}
      data-count-collected={snapshot.collected_count ?? "unknown"}
      data-count-saved={snapshot.saved_count ?? "unknown"}
      data-count-analyzed={snapshot.analyzed_count ?? "unknown"}
      data-count-valid={snapshot.valid_count ?? "unknown"}
      data-count-ignored={snapshot.ignored_count ?? "unknown"}
      aria-label={t("ariaLabel")}
      className="rounded-2xl p-4 md:p-5"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p style={{ color: "var(--primary)", fontSize: "0.65rem", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("eyebrow")}
          </p>
          <h2 className="mt-1" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 800 }}>
            {t("title")}
          </h2>
          <p className="mt-1" style={{ color: "var(--text-muted)", fontSize: "0.75rem", lineHeight: 1.5 }}>
            {t("scope", { id: snapshot.id.slice(0, 8) })}
          </p>
        </div>
        <div
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{
            backgroundColor: state === "invalid" ? "var(--sentiment-negative-bg)" : "var(--primary-bg)",
            color: state === "invalid" ? "var(--sentiment-negative)" : "var(--primary)",
            fontSize: "0.68rem",
            fontWeight: 750,
          }}
        >
          {state === "invalid" ? <TriangleAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {statusLabel}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {STAGES.map(({ key, translationKey, branch }) => {
          const value = snapshot[key];
          const definition = t(`stages.${translationKey}.definition`);
          return (
            <div
              key={key}
              data-count-stage={translationKey}
              title={definition}
              className="min-w-0 rounded-xl p-3"
              style={{
                backgroundColor: branch ? "var(--warning-bg, var(--bg-subtle))" : "var(--bg-subtle)",
                border: `1px solid ${branch ? "color-mix(in srgb, var(--warning) 28%, var(--border))" : "var(--border)"}`,
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <p style={{ color: "var(--text-muted)", fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.055em", textTransform: "uppercase" }}>
                  {t(`stages.${translationKey}.label`)}
                </p>
                <Info aria-hidden="true" className="h-3 w-3 shrink-0" style={{ color: "var(--text-faint)" }} />
              </div>
              <p className="mt-2" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "1.35rem", fontWeight: 850 }}>
                {isKnown(value) ? formatter.format(value) : t("notAvailable")}
              </p>
              <p className="mt-1 line-clamp-2" style={{ color: "var(--text-faint)", fontSize: "0.61rem", lineHeight: 1.35 }}>
                {definition}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className="mt-3 rounded-xl px-3 py-2.5"
        style={{
          backgroundColor: state === "invalid" ? "var(--sentiment-negative-bg)" : "var(--bg-subtle)",
          color: state === "invalid" ? "var(--sentiment-negative)" : "var(--text-muted)",
          fontSize: "0.72rem",
          lineHeight: 1.5,
        }}
      >
        {state === "invalid"
          ? t("invalidExplanation")
          : differences.length > 0
            ? differences.join(" ")
            : t("noDifferences")}
        {hasUnknown && <span> {t("unknownExplanation")}</span>}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer select-none" style={{ color: "var(--primary)", fontSize: "0.7rem", fontWeight: 750 }}>
          {t("detailsLabel")}
        </summary>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2" style={{ color: "var(--text-muted)", fontSize: "0.7rem", lineHeight: 1.5 }}>
          {STAGES.map(({ key, translationKey }) => (
            <li key={key}>
              <strong style={{ color: "var(--text-primary)" }}>{t(`stages.${translationKey}.label`)}:</strong>{" "}
              {t(`stages.${translationKey}.definition`)}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
