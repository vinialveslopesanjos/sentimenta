// ─── Social Connections ────────────────────────────────────────────

export type Platform = "instagram" | "youtube" | "tiktok" | "twitter";

export type ConnectionHealthState =
    | "healthy"
    | "degraded"
    | "stale"
    | "failed"
    | "never_synced";

export interface ConnectionHealth {
    state: ConnectionHealthState;
    reason_code: string;
    reason_codes: string[];
    freshness_sla_hours: number;
    last_attempt_at: string | null;
    last_attempt_status: string | null;
    last_attempt_saved_count: number | null;
    last_attempt_valid_count: number | null;
    last_success_at: string | null;
    fresh_until: string | null;
    data_age_hours: number | null;
    is_syncing: boolean;
    sync_frequency: "daily" | "weekly" | "none";
    next_scheduled_at: string | null;
}

export interface Connection {
    id: string;
    platform: Platform;
    username: string;
    display_name: string | null;
    profile_url: string | null;
    profile_image_url: string | null;
    followers_count: number;
    following_count: number;
    media_count: number;
    status: string;
    connected_at: string;
    last_sync_at: string | null;
    persona: string | null;
    ignore_author_comments: boolean;
    auto_sync: boolean;
    has_oauth_token: boolean;
    health?: ConnectionHealth | null;
    total_posts?: number;
    total_analyzed?: number;
}
