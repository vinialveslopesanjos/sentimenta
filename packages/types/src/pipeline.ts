// ─── Pipeline ─────────────────────────────────────────────────────

import type { SnapshotReference } from "./data-snapshot";

export type PipelineRunEffectiveStatus = "running" | "success" | "attention" | "failed" | "cancelled";

export interface PipelineRunSummaryStatement {
    code: string;
    parameters: Record<string, number | string | boolean | null>;
}

export interface PipelineRunSummaryAction {
    code: string;
    href: string | null;
    priority: "low" | "medium" | "high";
    target: "page" | "technical_log" | "none";
}

export interface PipelineRunHumanSummary {
    contract_version: number;
    effective_status: PipelineRunEffectiveStatus;
    reason_code: string;
    happened: PipelineRunSummaryStatement;
    impact: PipelineRunSummaryStatement;
    next_action: PipelineRunSummaryAction;
    technical_log_available: boolean;
}

export interface PipelineRun {
    id: string;
    connection_id: string | null;
    platform: string | null;
    connection_username: string | null;
    run_type: string;
    status: "running" | "completed" | "failed" | "partial" | "cancelled";
    posts_fetched: number;
    comments_fetched: number;
    comments_analyzed: number;
    llm_calls: number;
    errors_count: number;
    total_cost_usd: number;
    started_at: string;
    ended_at: string | null;
    notes: string | null;
    target_posts?: number | null;
    target_comments?: number | null;
    snapshot?: SnapshotReference | null;
    human_summary?: PipelineRunHumanSummary;
}

export interface PipelineStatus {
    status: string;
    posts_fetched: number;
    comments_fetched: number;
    comments_analyzed: number;
    errors_count: number;
}
