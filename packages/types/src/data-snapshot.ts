export type SnapshotHealthState =
    | "healthy"
    | "degraded"
    | "stale"
    | "failed"
    | "never_synced";

export type TrustLanguageMode = "current" | "qualified" | "historical" | "unavailable";

export interface TrustLanguagePolicy {
    policy_version: number;
    mode: TrustLanguageMode;
    message_key: string;
    health: SnapshotHealthState;
    reason_code: string;
    coverage_status: string;
    pipeline_status: string | null;
    present_tense_allowed: boolean;
    current_trend_allowed: boolean;
    no_alerts_claim_allowed: boolean;
    crisis_claim_allowed: boolean;
    action_mode: "current_if_supported" | "exploratory_only" | "restore_data_first" | "connect_or_restore_data";
    required_qualifier: string | null;
    forbidden_claims: string[];
    next_action: {
        code: "keep_monitoring" | "review_coverage" | "review_partial_run" | "sync_now" | "retry_sync" | "start_first_sync" | "run_analysis";
        href: string;
        priority: "low" | "medium" | "high";
    };
}

export interface SnapshotReference {
    id: string;
    schema_version: number;
    source_platforms: string[];
    profiles: Array<Record<string, unknown>>;
    period_start: string | null;
    period_end: string | null;
    last_attempt_at: string | null;
    last_success_at: string | null;
    found_count: number | null;
    eligible_count: number | null;
    collected_count: number | null;
    saved_count: number | null;
    analyzed_count: number | null;
    valid_count: number | null;
    ignored_count: number | null;
    coverage: Record<string, unknown>;
    health: SnapshotHealthState;
    reason_code: string;
    metrics: Record<string, unknown>;
    content_hash: string;
    created_at: string;
    language_policy: TrustLanguagePolicy;
}

export interface DataSnapshot extends SnapshotReference {
    user_id: string;
    trigger_run_id: string | null;
}
