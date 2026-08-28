"use client";

import { useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CalendarDays, Clock3, Database, Layers3, Radio, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { SnapshotReference } from "@sentimenta/types";
import { CountFunnel } from "@/components/data/CountFunnel";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  twitter: "X / Twitter",
};

const COLLECTION_MODES = new Set(["all", "engagement", "sample", "incremental", "analysis_only", "not_recorded"]);
const COVERAGE_STATUSES = new Set(["complete", "partial", "unknown", "none"]);
const COVERAGE_REASONS = new Set([
  "complete_window",
  "analysis_incomplete",
  "latest_attempt_failed",
  "no_saved_items",
  "expected_window_not_recorded",
]);

export function ProvenanceDrawer({
  snapshot,
  open,
  onClose,
}: {
  snapshot: SnapshotReference | null;
  open: boolean;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("snapshot.provenance");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  if (!open || !snapshot) return null;

  const scoreAvailable = (snapshot.valid_count ?? 0) > 0;

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
  const formatDateTime = (value: string | null) => value
    ? dateTimeFormatter.format(new Date(value))
    : t("notRecorded");
  const period = snapshot.period_start && snapshot.period_end
    ? t("periodValue", {
        start: dateFormatter.format(new Date(snapshot.period_start)),
        end: dateFormatter.format(new Date(snapshot.period_end)),
      })
    : t("notRecorded");

  const metrics = asRecord(snapshot.metrics);
  const collection = asRecord(metrics.collection);
  const rawCollectionMode = asText(collection.mode) ?? "not_recorded";
  const collectionMode = COLLECTION_MODES.has(rawCollectionMode) ? rawCollectionMode : "not_recorded";
  const maxPosts = asNumber(collection.max_posts);
  const maxComments = asNumber(collection.max_comments_per_post);
  const sinceDate = asText(collection.since_date);

  const coverage = asRecord(snapshot.coverage);
  const rawCoverageStatus = asText(coverage.status) ?? "unknown";
  const coverageStatus = COVERAGE_STATUSES.has(rawCoverageStatus) ? rawCoverageStatus : "unknown";
  const rawCoverageReason = asText(coverage.reason_code) ?? "expected_window_not_recorded";
  const coverageReason = COVERAGE_REASONS.has(rawCoverageReason) ? rawCoverageReason : "expected_window_not_recorded";
  const coverageRatio = asNumber(coverage.ratio);
  const expectedProfiles = asNumber(coverage.expected_profiles);
  const evaluatedProfiles = asNumber(coverage.evaluated_profiles);

  const profiles = snapshot.profiles.map((profile) => {
    const platform = asText(profile.platform) ?? t("unknownSource");
    const username = asText(profile.username) ?? t("unknownProfile");
    return {
      platform,
      platformLabel: PLATFORM_LABELS[platform.toLowerCase()] ?? platform,
      username: username.startsWith("@") ? username : `@${username}`,
    };
  });
  const platforms = snapshot.source_platforms.map((platform) => PLATFORM_LABELS[platform.toLowerCase()] ?? platform);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-testid="provenance-overlay"
          className="fixed inset-0"
          style={{ zIndex: 119, backgroundColor: "rgba(7, 25, 32, 0.42)", backdropFilter: "blur(4px)" }}
        />
        <DialogPrimitive.Content
          asChild
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
        >
      <aside
        aria-modal="true"
        data-testid="provenance-drawer"
        data-snapshot-id={snapshot.id}
        data-score-available={scoreAvailable ? "true" : "false"}
        data-coverage-status={coverageStatus}
        data-collection-mode={collectionMode}
        className="fixed inset-y-0 right-0 z-[120] h-full w-full overflow-y-auto p-4 sm:max-w-[760px] sm:p-6"
        style={{ backgroundColor: "var(--bg-main)", boxShadow: "-22px 0 55px rgba(7, 25, 32, 0.18)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p style={{ color: "var(--primary)", fontSize: "0.66rem", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {t("eyebrow")}
            </p>
            <DialogPrimitive.Title asChild>
              <h2 className="mt-1" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "1.45rem", fontWeight: 850 }}>
                {t(scoreAvailable ? "title" : "titleUnavailable")}
              </h2>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description asChild>
              <p className="mt-2 max-w-[620px]" style={{ color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.6 }}>
                {t(scoreAvailable ? "description" : "descriptionUnavailable")}
              </p>
            </DialogPrimitive.Description>
          </div>
          <DialogPrimitive.Close asChild>
            <button
              ref={closeButtonRef}
              type="button"
              aria-label={t("close")}
              data-testid="provenance-close"
              className="rounded-xl p-2 transition-colors"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </DialogPrimitive.Close>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--primary)" }}>
              <CalendarDays className="h-4 w-4" />
              <h3 style={{ fontSize: "0.72rem", fontWeight: 850, letterSpacing: "0.055em", textTransform: "uppercase" }}>{t("period")}</h3>
            </div>
            <p className="mt-3" style={{ color: "var(--text-primary)", fontSize: "0.88rem", fontWeight: 750 }}>{period}</p>
            <p className="mt-1" style={{ color: "var(--text-muted)", fontSize: "0.72rem", lineHeight: 1.45 }}>{t("periodHelp")}</p>
          </article>

          <article data-testid="provenance-freshness" data-contrast-scope="provenance-freshness" className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--primary)" }}>
              <Clock3 className="h-4 w-4" />
              <h3 style={{ fontSize: "0.72rem", fontWeight: 850, letterSpacing: "0.055em", textTransform: "uppercase" }}>{t("freshness")}</h3>
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-3 rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--bg-subtle)" }}><dt data-contrast-role="critical-label" style={{ color: "var(--text-muted)", fontWeight: 700 }}>{t("lastSuccess")}</dt><dd data-contrast-role="critical-value" className="text-right" style={{ color: "var(--text-primary)", fontWeight: 750 }}>{formatDateTime(snapshot.last_success_at)}</dd></div>
              <div className="flex justify-between gap-3 px-2"><dt data-contrast-role="critical-label" style={{ color: "var(--text-muted)" }}>{t("lastAttempt")}</dt><dd data-contrast-role="critical-value" className="text-right" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{formatDateTime(snapshot.last_attempt_at)}</dd></div>
            </dl>
          </article>

          <article className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--primary)" }}>
              <Radio className="h-4 w-4" />
              <h3 style={{ fontSize: "0.72rem", fontWeight: 850, letterSpacing: "0.055em", textTransform: "uppercase" }}>{t("origin")}</h3>
            </div>
            <p className="mt-3" style={{ color: "var(--text-primary)", fontSize: "0.82rem", fontWeight: 750 }}>
              {platforms.length ? platforms.join(" · ") : t("unknownSource")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profiles.length ? profiles.map((profile) => (
                <span key={`${profile.platform}:${profile.username}`} className="rounded-full px-2.5 py-1" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: "0.69rem" }}>
                  {profile.platformLabel} · {profile.username}
                </span>
              )) : <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>{t("unknownProfile")}</span>}
            </div>
          </article>

          <article className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2" style={{ color: "var(--primary)" }}>
              <Layers3 className="h-4 w-4" />
              <h3 style={{ fontSize: "0.72rem", fontWeight: 850, letterSpacing: "0.055em", textTransform: "uppercase" }}>{t("collectionMode")}</h3>
            </div>
            <p className="mt-3" style={{ color: "var(--text-primary)", fontSize: "0.88rem", fontWeight: 800 }}>{t(`collection.${collectionMode}.label`)}</p>
            <p className="mt-1" style={{ color: "var(--text-muted)", fontSize: "0.72rem", lineHeight: 1.45 }}>{t(`collection.${collectionMode}.description`)}</p>
            {(maxPosts != null || maxComments != null || sinceDate) && (
              <p className="mt-2" style={{ color: "var(--text-faint)", fontSize: "0.68rem" }}>
                {t("collectionLimits", {
                  posts: maxPosts ?? t("notRecorded"),
                  comments: maxComments ?? t("notRecorded"),
                  since: sinceDate ?? t("notRecorded"),
                })}
              </p>
            )}
          </article>
        </div>

        <article data-testid="provenance-coverage" data-contrast-scope="provenance-coverage" className="mt-3 rounded-2xl p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2" style={{ color: "var(--primary)" }}>
            <Database className="h-4 w-4" />
            <h3 style={{ fontSize: "0.72rem", fontWeight: 850, letterSpacing: "0.055em", textTransform: "uppercase" }}>{t("coverage")}</h3>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div><p data-contrast-role="critical-label" style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700 }}>{t("coverageStatus")}</p><p data-contrast-role="critical-value" className="mt-1" style={{ color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 750 }}>{t(`coverageStates.${coverageStatus}`)}</p></div>
            <div><p data-contrast-role="critical-label" style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700 }}>{t("coverageRatio")}</p><p data-contrast-role="critical-value" className="mt-1" style={{ color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 750 }}>{coverageRatio == null ? t("notRecorded") : `${Math.round(coverageRatio * 100)}%`}</p></div>
            <div><p data-contrast-role="critical-label" style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700 }}>{t("profilesEvaluated")}</p><p data-contrast-role="critical-value" className="mt-1" style={{ color: "var(--text-primary)", fontSize: "0.8125rem", fontWeight: 750 }}>{expectedProfiles == null || evaluatedProfiles == null ? t("notRecorded") : `${evaluatedProfiles} / ${expectedProfiles}`}</p></div>
          </div>
          <p className="mt-3 rounded-xl px-3 py-2" style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: "0.72rem" }}>
            {t(`coverageReasons.${coverageReason}`)}
          </p>
        </article>

        <div className="mt-3">
          <CountFunnel snapshot={snapshot} surface="provenance" />
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.68rem", fontWeight: 750 }}>{t("technicalReference")}</p>
            <code title={snapshot.id} style={{ color: "var(--text-primary)", fontSize: "0.72rem" }}>snapshot {snapshot.id.slice(0, 8)} · hash {snapshot.content_hash.slice(0, 10)}</code>
          </div>
          <DialogPrimitive.Close asChild>
            <button type="button" className="rounded-xl px-4 py-2" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontSize: "0.76rem", fontWeight: 800 }}>
              {t(scoreAvailable ? "backToScore" : "backToData")}
            </button>
          </DialogPrimitive.Close>
        </div>
      </aside>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
