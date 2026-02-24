// ─── Posts ─────────────────────────────────────────────────────────

import type { SentimentDistribution } from "./dashboard";

export interface PostSummary {
    id: string;
    platform: string;
    platform_post_id: string;
    post_type: string | null;
    content_text: string | null;
    like_count: number;
    comment_count: number;
    view_count?: number;
    published_at: string | null;
    post_url: string | null;
    thumbnail_url?: string | null;
    summary?: {
        avg_score: number | null;
        sentiment_distribution: SentimentDistribution | null;
        total_analyzed: number;
    } | null;
}
