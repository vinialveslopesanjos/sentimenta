"use client";

import Link from "next/link";
import { Clock3, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SnapshotReference, TrustLanguageMode } from "@sentimenta/types";

interface SurfaceEvidenceNoticeProps {
  snapshot: SnapshotReference | null;
  surface: "profile" | "comparison";
  legacyEvidence?: {
    validCount: number;
    savedCount: number;
  };
}

function evidenceMode(
  snapshot: SnapshotReference | null,
  legacyEvidence?: SurfaceEvidenceNoticeProps["legacyEvidence"],
): TrustLanguageMode {
  if (snapshot) return snapshot.language_policy.mode;
  return legacyEvidence && legacyEvidence.validCount > 0 ? "historical" : "unavailable";
}

export function SurfaceEvidenceNotice({ snapshot, surface, legacyEvidence }: SurfaceEvidenceNoticeProps) {
  const t = useTranslations("snapshot");
  const mode = evidenceMode(snapshot, legacyEvidence);

  if (mode === "current") return null;

  const hasHistoricalEvidence = mode === "historical" || mode === "qualified";
  const Icon = hasHistoricalEvidence ? Clock3 : ShieldAlert;
  const tone = hasHistoricalEvidence ? "var(--accent)" : "var(--sentiment-negative)";
  const title = mode === "historical"
    ? t("surface.historicalTitle")
    : mode === "qualified"
      ? t("surface.qualifiedTitle")
      : t("surface.unavailableTitle");
  const policyMessage = snapshot
    ? t(`language.${snapshot.language_policy.message_key}`)
    : legacyEvidence
      ? t("surface.legacyHistoricalDescription")
      : t("global.noSnapshotDescription");
  const denominators = snapshot?.valid_count != null && snapshot.saved_count != null
    ? t("surface.denominators", { valid: snapshot.valid_count, saved: snapshot.saved_count })
    : legacyEvidence
      ? t("surface.legacyDenominators", { valid: legacyEvidence.validCount, saved: legacyEvidence.savedCount })
      : t("denominatorsUnknown");
  const action = snapshot?.language_policy.next_action;

  return (
    <section
      data-testid={`${surface}-evidence-status`}
      data-evidence-state={mode}
      data-snapshot-health={snapshot?.health ?? (legacyEvidence ? "legacy_unverified" : "never_synced")}
      data-snapshot-reason={snapshot?.reason_code ?? (legacyEvidence ? "legacy_without_snapshot" : "no_snapshot")}
      data-snapshot-valid-count={snapshot?.valid_count ?? legacyEvidence?.validCount ?? "unknown"}
      data-snapshot-saved-count={snapshot?.saved_count ?? legacyEvidence?.savedCount ?? "unknown"}
      role="status"
      aria-label={title}
      className="rounded-2xl p-4 md:p-5"
      style={{
        backgroundColor: `color-mix(in srgb, ${tone} 8%, var(--bg-card))`,
        border: `1px solid color-mix(in srgb, ${tone} 30%, var(--border))`,
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--bg-card)" }}
          >
            <Icon aria-hidden="true" className="h-5 w-5" style={{ color: tone }} />
          </div>
          <div>
            <h2 style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "0.98rem", fontWeight: 750 }}>
              {title}
            </h2>
            <p className="mt-1" style={{ color: "var(--text-secondary)", fontSize: "0.8rem", lineHeight: 1.6 }}>
              {policyMessage}
            </p>
            <p className="mt-2" style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontWeight: 650 }}>
              {denominators}
            </p>
          </div>
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {t(`actions.${action.code}`)}
          </Link>
        )}
      </div>
    </section>
  );
}
