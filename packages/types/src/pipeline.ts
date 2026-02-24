// ─── Pipeline ─────────────────────────────────────────────────────

export interface PipelineRun {
    id: string;
    connection_id: string | null;
    platform: string | null;
    connection_username: string | null;
    run_type: string;
    status: "running" | "completed" | "failed" | "partial";
    posts_fetched: number;
    comments_fetched: number;
    comments_analyzed: number;
    llm_calls: number;
    errors_count: number;
    total_cost_usd: number;
    started_at: string;
    ended_at: string | null;
    notes: string | null;
}

export interface PipelineStatus {
    status: string;
    posts_fetched: number;
    comments_fetched: number;
    comments_analyzed: number;
    errors_count: number;
}
