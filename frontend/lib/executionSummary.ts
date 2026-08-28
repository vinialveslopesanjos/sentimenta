import type {
  PipelineRunHumanSummary,
  PipelineRunSummaryAction,
  SnapshotReference,
} from "@sentimenta/types";
import type { PipelineRun } from "@/lib/types";

const EFFECTIVE_STATUSES = new Set(["running", "success", "attention", "failed", "cancelled"]);

function count(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(Math.trunc(parsed), 0) : 0;
}

function validServerSummary(value: PipelineRunHumanSummary | undefined): value is PipelineRunHumanSummary {
  return Boolean(
    value
    && value.contract_version >= 1
    && EFFECTIVE_STATUSES.has(value.effective_status)
    && value.happened?.code
    && value.impact?.code
    && value.next_action?.code,
  );
}

function pageAction(code: string, href: string, priority: "low" | "medium" | "high" = "high"): PipelineRunSummaryAction {
  return { code, href, priority, target: "page" };
}

function technicalLogAction(runId: string): PipelineRunSummaryAction {
  return {
    code: "review_partial_run",
    href: `#technical-log-${runId}`,
    priority: "high",
    target: "technical_log",
  };
}

function snapshotAction(
  snapshot: SnapshotReference | null | undefined,
  fallback: PipelineRunSummaryAction,
): PipelineRunSummaryAction {
  const candidate = snapshot?.language_policy?.next_action;
  if (!candidate?.code || !candidate.href?.startsWith("/dashboard")) return fallback;
  return { ...candidate, target: "page" };
}

export function getPipelineRunHumanSummary(run: PipelineRun): PipelineRunHumanSummary {
  if (validServerSummary(run.human_summary)) return run.human_summary;

  const rawStatus = String(run.status || "unknown").toLowerCase();
  const savedCount = count(run.comments_fetched);
  const validCount = count(run.comments_analyzed);
  const remainingCount = Math.max(savedCount - validCount, 0);
  const historicalValidCount = count(run.snapshot?.valid_count);
  const hasHistoricalData = historicalValidCount > 0 && run.snapshot?.language_policy?.mode === "historical";
  const parameters = {
    saved_count: savedCount,
    valid_count: validCount,
    remaining_count: remainingCount,
    errors_count: count(run.errors_count),
    historical_valid_count: historicalValidCount,
  };

  let effectiveStatus: PipelineRunHumanSummary["effective_status"];
  let reasonCode: string;
  let happenedCode: string;
  let impactCode: string;
  let nextAction: PipelineRunSummaryAction;

  if (rawStatus === "running") {
    effectiveStatus = "running";
    reasonCode = happenedCode = "execution_running";
    impactCode = "data_pending";
    nextAction = { code: "wait_for_completion", href: null, priority: "low", target: "none" };
  } else if (rawStatus === "cancelled") {
    effectiveStatus = "cancelled";
    reasonCode = happenedCode = "execution_cancelled";
    impactCode = hasHistoricalData ? "historical_data_preserved" : "evaluation_unavailable";
    nextAction = snapshotAction(run.snapshot, pageAction("retry_sync", "/dashboard/connect"));
  } else if (savedCount > 0 && validCount === 0) {
    effectiveStatus = "failed";
    reasonCode = "zero_valid_analyses";
    happenedCode = "collected_without_valid_analysis";
    impactCode = hasHistoricalData ? "historical_data_preserved" : "collected_data_unusable";
    nextAction = snapshotAction(run.snapshot, pageAction("retry_sync", "/dashboard/connect"));
  } else if (rawStatus === "failed") {
    effectiveStatus = "failed";
    reasonCode = happenedCode = savedCount || validCount
      ? "execution_failed_after_collection"
      : "execution_failed_before_collection";
    impactCode = hasHistoricalData ? "historical_data_preserved" : "evaluation_unavailable";
    nextAction = snapshotAction(run.snapshot, pageAction("retry_sync", "/dashboard/connect"));
  } else if (rawStatus === "partial" || (savedCount > 0 && validCount < savedCount)) {
    effectiveStatus = "attention";
    reasonCode = happenedCode = "partial_analysis";
    impactCode = "partial_basis";
    nextAction = technicalLogAction(run.id);
  } else if (rawStatus === "completed" && savedCount === 0 && validCount === 0) {
    effectiveStatus = "attention";
    reasonCode = happenedCode = "no_new_comments";
    impactCode = "no_new_evidence";
    nextAction = pageAction("review_collection", "/dashboard/connect", "medium");
  } else if (rawStatus === "completed") {
    effectiveStatus = "success";
    reasonCode = happenedCode = run.run_type === "analyze" ? "analysis_completed" : "collection_completed";
    impactCode = "valid_data_available";
    nextAction = snapshotAction(run.snapshot, pageAction("keep_monitoring", "/dashboard", "low"));
  } else {
    effectiveStatus = "attention";
    reasonCode = happenedCode = "execution_state_unknown";
    impactCode = "evaluation_unconfirmed";
    nextAction = technicalLogAction(run.id);
  }

  return {
    contract_version: 1,
    effective_status: effectiveStatus,
    reason_code: reasonCode,
    happened: { code: happenedCode, parameters },
    impact: { code: impactCode, parameters },
    next_action: nextAction,
    technical_log_available: true,
  };
}
