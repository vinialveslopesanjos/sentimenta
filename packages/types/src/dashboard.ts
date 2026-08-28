// ─── Dashboard ────────────────────────────────────────────────────

import type { Connection, ConnectionHealth } from "./connection";
import type { SnapshotHealthState, SnapshotReference, TrustLanguageMode } from "./data-snapshot";
import type { PostSummary } from "./post";

export interface SentimentDistribution {
    negative: number;
    neutral: number;
    positive: number;
}

export interface DashboardSummary {
    snapshot: SnapshotReference | null;
    total_connections: number;
    total_posts: number;
    total_comments: number;
    total_analyzed: number;
    avg_score: number | null;
    avg_polarity: number | null;
    sentiment_distribution: SentimentDistribution | null;
    recent_posts: PostSummary[];
    connections: Connection[];
}

export interface ConnectionDashboard {
    snapshot: SnapshotReference | null;
    connection: Connection;
    total_posts: number;
    total_comments: number;
    total_analyzed: number;
    avg_score: number | null;
    avg_polarity: number | null;
    weighted_avg_score: number | null;
    sentiment_distribution: SentimentDistribution | null;
    emotions_distribution: Record<string, number> | null;
    topics_frequency: Record<string, number> | null;
    posts: PostSummary[];
    engagement_totals: {
        total_likes: number;
        total_comments: number;
        total_views: number;
    };
}

// ─── Trends ───────────────────────────────────────────────────────

export interface TrendDataPoint {
    period: string;
    positive: number;
    neutral: number;
    negative: number;
    total_comments: number;
    avg_score: number | null;
    total_likes: number;
}

export interface TrendResponse {
    data_points: TrendDataPoint[];
    granularity: string;
    timezone: string;
}

export interface TrendsDetailedPeriod {
    period: string;
    total_comments: number;
    positive: number;
    neutral: number;
    negative: number;
    emotions: Record<string, number>;
    topics: Record<string, number>;
}

export interface TrendsDetailedResponse {
    data_points: TrendsDetailedPeriod[];
    granularity: string;
    timezone: string;
}

// ─── Health Report ────────────────────────────────────────────────

export interface HealthReportBasis {
    contract_version: number;
    snapshot_id: string | null;
    period_start: string | null;
    period_end: string | null;
    coverage_status: string;
    coverage_ratio: number | null;
    health: SnapshotHealthState;
    language_mode: TrustLanguageMode;
    recommendation_mode: "current" | "historical_only" | "blocked";
    reason_code: string;
    generated_at: string | null;
    source: "none" | "llm" | "llm_qualified" | "snapshot_fallback" | "legacy_llm";
}

export interface HealthReport {
    snapshot: SnapshotReference | null;
    report_basis: HealthReportBasis;
    report_text: string | null;
    generated_at: string | null;
    data_summary: Record<string, unknown>;
    has_new_data: boolean;
}

// ─── Alerts ───────────────────────────────────────────────────────

export interface Alert {
    connection_id: string;
    platform: string;
    username: string;
    severity: string;
    negative_rate: number;
    sarcasm_rate: number;
    total_analyzed: number;
    avg_score: number | null;
    message: string;
}

export type AlertEvaluationStatus =
    | "alerts_found"
    | "no_alerts_valid_coverage"
    | "unable_to_evaluate";

export interface AlertEvaluation {
    status: AlertEvaluationStatus;
    reason_code: string;
    coverage: {
        status: string;
        ratio: number | null;
        temporal_ratio?: number | null;
        profile_ratio?: number | null;
        analysis_ratio?: number | null;
        requested_period_start?: string;
        requested_period_end?: string;
        reason_code: string;
        [key: string]: unknown;
    };
    evaluated_count: number;
    min_analyzed_per_profile: number;
}

export interface AlertsResponse {
    snapshot: SnapshotReference | null;
    days: number;
    total_alerts: number;
    alerts: Alert[];
    evaluation: AlertEvaluation;
    generated_at: string;
}

// ─── Compare ──────────────────────────────────────────────────────

export interface PlatformComparison {
    platform: string;
    total_comments: number;
    total_analyzed: number;
    avg_score: number | null;
    sentiment_distribution: SentimentDistribution;
    positive_rate: number;
    negative_rate: number;
}

export interface CompareResponse {
    snapshot: SnapshotReference | null;
    days: number;
    platforms: PlatformComparison[];
    generated_at: string;
}

// ── Compare Connections ──────────────────────────────────────────

export interface ConnectionComparison {
    connection_id: string;
    platform: string;
    username: string;
    display_name: string | null;
    profile_image_url: string | null;
    total_comments: number;
    total_analyzed: number;
    saved_count: number;
    valid_count: number;
    observed_period_start: string | null;
    observed_period_end: string | null;
    avg_score: number | null;
    avg_polarity: number | null;
    sentiment_distribution: SentimentDistribution;
    positive_rate: number;
    negative_rate: number;
    emotions_distribution: Record<string, number>;
    health: ConnectionHealth | null;
}

export interface CompareConnectionsResponse {
    snapshot: SnapshotReference | null;
    days: number;
    connections: ConnectionComparison[];
    generated_at: string;
}
