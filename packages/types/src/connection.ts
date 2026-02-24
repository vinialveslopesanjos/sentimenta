// ─── Social Connections ────────────────────────────────────────────

export type Platform = "instagram" | "youtube" | "tiktok";

export interface Connection {
    id: string;
    platform: Platform;
    username: string;
    display_name: string | null;
    profile_url: string | null;
    profile_image_url: string | null;
    followers_count: number;
    following_count?: number;
    media_count?: number;
    status: string;
    connected_at?: string;
    last_sync_at: string | null;
    persona?: string | null;
    ignore_author_comments?: boolean;
}
