"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, FileCode2, LoaderCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PipelineRunSummaryStatement } from "@sentimenta/types";
import type { PipelineRun } from "@/lib/types";
import { getPipelineRunHumanSummary } from "@/lib/executionSummary";

const HAPPENED_CODES = new Set([
  "execution_running",
  "execution_cancelled",
  "collected_without_valid_analysis",
  "execution_failed_after_collection",
  "execution_failed_before_collection",
  "analysis_includes_backlog",
  "partial_analysis",
  "no_new_comments",
  "analysis_completed",
  "collection_completed",
  "execution_state_unknown",
]);

const IMPACT_CODES = new Set([
  "data_pending",
  "historical_data_preserved",
  "evaluation_unavailable",
  "collected_data_unusable",
  "backlog_scope_explained",
  "partial_basis",
  "no_new_evidence",
  "valid_data_available",
  "evaluation_unconfirmed",
]);

const ACTION_CODES = new Set([
  "wait_for_completion",
  "retry_sync",
  "review_partial_run",
  "review_collection",
  "keep_monitoring",
  "review_coverage",
  "sync_now",
  "start_first_sync",
  "run_analysis",
]);

const toneConfig = {
  running: { color: "var(--primary)", icon: LoaderCircle },
  success: { color: "var(--sentiment-positive)", icon: CheckCircle2 },
  attention: { color: "var(--sentiment-neutral)", icon: CircleAlert },
  failed: { color: "var(--sentiment-negative)", icon: XCircle },
  cancelled: { color: "var(--text-muted)", icon: Clock3 },
} as const;

function safeCode(statement: PipelineRunSummaryStatement, allowed: Set<string>, fallback: string) {
  return allowed.has(statement.code) ? statement.code : fallback;
}

function translationParameters(parameters: PipelineRunSummaryStatement["parameters"]): Record<string, string | number | Date> {
  return Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => [
      key,
      typeof value === "number" || typeof value === "string" ? value : String(value ?? ""),
    ]),
  );
}

interface ExecutionHumanSummaryProps {
  run: PipelineRun;
  technicalLogExpanded: boolean;
  onToggleTechnicalLog: () => void;
}

export function ExecutionHumanSummary({ run, technicalLogExpanded, onToggleTechnicalLog }: ExecutionHumanSummaryProps) {
  const t = useTranslations("logs.humanSummary");
  const summary = getPipelineRunHumanSummary(run);
  const tone = toneConfig[summary.effective_status];
  const SummaryIcon = tone.icon;
  const happenedCode = safeCode(summary.happened, HAPPENED_CODES, "execution_state_unknown");
  const impactCode = safeCode(summary.impact, IMPACT_CODES, "evaluation_unconfirmed");
  const actionCode = ACTION_CODES.has(summary.next_action.code) ? summary.next_action.code : "review_partial_run";
  const headingId = `execution-summary-title-${run.id}`;
  const technicalLogId = `technical-log-${run.id}`;

  return (
    <section
      aria-labelledby={headingId}
      data-testid={`execution-human-summary-${run.id}`}
      data-raw-status={run.status}
      data-effective-status={summary.effective_status}
      data-summary-reason={summary.reason_code}
      className="rounded-2xl p-4 md:p-5"
      style={{
        backgroundColor: `color-mix(in srgb, ${tone.color} 6%, var(--bg-subtle))`,
        border: `1px solid color-mix(in srgb, ${tone.color} 28%, var(--border))`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "var(--bg-card)", color: tone.color }}
          >
            <SummaryIcon aria-hidden="true" className={`h-4 w-4 ${summary.effective_status === "running" ? "animate-spin" : ""}`} />
          </span>
          <div>
            <p style={{ color: tone.color, fontSize: "0.66rem", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {t("eyebrow")}
            </p>
            <h3 id={headingId} className="mt-1" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 750 }}>
              {t("title")}
            </h3>
          </div>
        </div>
        <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: "var(--bg-card)", color: tone.color, fontSize: "0.68rem", fontWeight: 800 }}>
          {t(`effectiveStatus.${summary.effective_status}`)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-faint)", fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t("sections.happened")}
          </p>
          <p className="mt-2" style={{ color: "var(--text-primary)", fontSize: "0.8rem", lineHeight: 1.55 }}>
            {t(`happened.${happenedCode}`, translationParameters(summary.happened.parameters))}
          </p>
        </div>
        <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-faint)", fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t("sections.impact")}
          </p>
          <p className="mt-2" style={{ color: "var(--text-primary)", fontSize: "0.8rem", lineHeight: 1.55 }}>
            {t(`impact.${impactCode}`, translationParameters(summary.impact.parameters))}
          </p>
        </div>
        <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--text-faint)", fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {t("sections.next")}
          </p>
          <p className="mt-2" style={{ color: "var(--text-primary)", fontSize: "0.8rem", lineHeight: 1.55 }}>
            {t(`actionDescriptions.${actionCode}`)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {summary.next_action.target === "page" && summary.next_action.href && (
          <Link
            data-testid={`execution-next-action-${run.id}`}
            href={summary.next_action.href}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: tone.color, color: "white" }}
          >
            {t(`actions.${actionCode}`)}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
        {summary.next_action.target === "technical_log" && (
          <button
            data-testid={`execution-next-action-${run.id}`}
            type="button"
            aria-expanded={technicalLogExpanded}
            aria-controls={technicalLogId}
            onClick={onToggleTechnicalLog}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: tone.color, color: "white" }}
          >
            <FileCode2 aria-hidden="true" className="h-4 w-4" />
            {technicalLogExpanded ? t("technicalLog.close") : t(`actions.${actionCode}`)}
          </button>
        )}
        {summary.next_action.target === "none" && (
          <span data-testid={`execution-next-action-${run.id}`} style={{ color: "var(--text-muted)", fontSize: "0.76rem", fontWeight: 700 }}>
            {t(`actions.${actionCode}`)}
          </span>
        )}
        {summary.technical_log_available && summary.next_action.target !== "technical_log" && (
          <button
            type="button"
            aria-expanded={technicalLogExpanded}
            aria-controls={technicalLogId}
            onClick={onToggleTechnicalLog}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ color: "var(--text-muted)", fontSize: "0.75rem", fontWeight: 700 }}
          >
            <FileCode2 aria-hidden="true" className="h-4 w-4" />
            {technicalLogExpanded ? t("technicalLog.close") : t("technicalLog.open")}
          </button>
        )}
      </div>
    </section>
  );
}
