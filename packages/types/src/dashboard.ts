// ─── Dashboard ────────────────────────────────────────────────────

import type { Connection } from "./connection";
import type { PostSummary } from "./post";

export interface SentimentDistribution {
    negative: number;
    neutral: number;
    positive: number;
}

export interface DashboardSummary {
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
}

// ─── Health Report ────────────────────────────────────────────────

export interface HealthReport {
    report_text: string;
    generated_at: string;
    data_summary: Record<string, unknown>;
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

export interface AlertsResponse {
    days: number;
    total_alerts: number;
    alerts: Alert[];
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
    days: number;
    platforms: PlatformComparison[];
    generated_at: string;
}
