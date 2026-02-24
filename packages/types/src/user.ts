// ─── User & Auth ───────────────────────────────────────────────────

export type PlanSlug = "free" | "creator" | "pro" | "agency";

export interface User {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    plan: PlanSlug;
    stripe_customer_id?: string | null;
    created_at?: string;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
}

export interface UserProfile extends User {
    usage?: UserUsage;
}

export interface UserUsage {
    syncs_used_this_month: number;
    syncs_limit: number;
    connections_used: number;
    connections_limit: number;
    apify_credits_used_brl: number;
    apify_credits_limit_brl: number;
    billing_period_start: string;
    billing_period_end: string;
}
