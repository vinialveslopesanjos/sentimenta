import type {
  PipelineRun,
  PipelineStatus,
  DashboardSummary,
  ConnectionDashboard,
  TrendResponse,
  TrendsDetailedResponse,
  HealthReport,
  CommentListResponse,
} from "./types";
import type { ApiBlogSettings, BlogCategory, BlogPersona, BlogPost, BlogSettings } from "./blog";
import { normalizeBlogPost, normalizeBlogSettings } from "./blog";

const API_URL = "/api/v1";

interface FetchOptions extends RequestInit {
  token?: string;
  _retried?: boolean;
}

function formatApiErrorDetail(detail: unknown, fallback: string): string {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const entry = item as Record<string, unknown>;
          const msg = entry.msg ?? entry.message ?? entry.error;
          const loc = Array.isArray(entry.loc) ? entry.loc.filter(Boolean).join(".") : "";
          if (typeof msg === "string") return loc ? `${loc}: ${msg}` : msg;
        }
        return "";
      })
      .filter(Boolean);
    return messages.length > 0 ? messages.join(" ") : fallback;
  }

  if (typeof detail === "object") {
    const entry = detail as Record<string, unknown>;
    const msg = entry.msg ?? entry.message ?? entry.error;
    if (typeof msg === "string") return msg;
  }

  return fallback;
}

async function tryRefreshToken(): Promise<string | null> {
  const { getRefreshToken, setTokens, clearTokens } = await import("./auth");
  const refreshToken = getRefreshToken();

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, _retried, ...rest } = options;
  const { COOKIE_AUTH_SENTINEL } = await import("./auth");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token && token !== COOKIE_AUTH_SENTINEL) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { credentials: "include", headers, ...rest });
  } catch (error) {
    // Retry once for transient backend reload/network blips in local dev.
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      res = await fetch(`${API_URL}${path}`, { credentials: "include", headers, ...rest });
    } catch {
      const message = error instanceof Error ? error.message : "Failed to fetch";
      throw new Error(`Falha de conexão com API (${API_URL}). ${message}`);
    }
  }

  // Auto-refresh: on 401, try to get a new access token and retry once
  if (res.status === 401 && token && !_retried) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      return apiFetch<T>(path, { ...options, token: newToken, _retried: true });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));

    // Intercept email_not_verified — redirect to verification page
    if (res.status === 403 && error.detail === "email_not_verified") {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/verify-email")) {
        window.location.href = "/verify-email";
      }
      throw new Error("email_not_verified");
    }

    throw new Error(formatApiErrorDetail(error.detail, `API error: ${res.status}`));
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null as any;
  }

  return res.json();
}

// Auth
export const authApi = {
  register: (email: string, password: string, name?: string, acceptedTerms = true) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, accepted_terms: acceptedTerms }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: (token: string, refreshToken?: string | null) =>
    apiFetch<{ message: string }>("/auth/logout", {
      method: "POST",
      token,
      body: JSON.stringify({ refresh_token: refreshToken || null }),
    }),

  googleLogin: (googleToken: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ token: googleToken }),
    }),

  instagramAuthUrl: () =>
    apiFetch<{ auth_url: string }>("/auth/instagram/auth-url"),

  tiktokAuthUrl: () =>
    apiFetch<{ auth_url: string }>("/auth/tiktok/auth-url"),

  exchangeOAuthCode: (code: string) =>
    apiFetch<{
      access_token: string;
      refresh_token: string;
      provider?: string;
      pipeline_started?: boolean;
    }>("/auth/exchange-code", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  me: (token: string) =>
    apiFetch<{
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
      plan: string;
      subscription_status: string | null;
      plan_changed_at: string | null;
      email_verified: boolean;
      onboarding_data: Record<string, string> | null;
    }>("/auth/me", { token }),

  sendVerification: (token: string) =>
    apiFetch<{ message: string }>("/auth/send-verification", { method: "POST", token }),

  saveOnboarding: (
    token: string,
    payload: { profile_type: string; main_goal: string; description: string }
  ) =>
    apiFetch<{ id: string; onboarding_data: Record<string, string> | null }>("/auth/onboarding", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    }),

  updateMe: (
    token: string,
    payload: { name?: string | null; avatar_url?: string | null }
  ) =>
    apiFetch<{
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
      plan: string;
    }>("/auth/me", {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/change-password", {
      method: "POST",
      token,
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),

  deleteAccount: (token: string, confirmationText: string, password?: string) =>
    apiFetch<void>("/auth/me", {
      method: "DELETE",
      token,
      body: JSON.stringify({
        confirmation_text: confirmationText,
        password: password || null,
      }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiFetch<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),
};

// Connections
export const connectionsApi = {
  list: (token: string) =>
    apiFetch<
      Array<{
        id: string;
        platform: string;
        username: string;
        display_name: string | null;
        profile_image_url: string | null;
        followers_count: number;
        status: string;
        connected_at: string;
        last_sync_at: string | null;
        persona: string | null;
        auto_sync: boolean;
        has_oauth_token: boolean;
      }>
    >("/connections", { token }),

  updateConnection: (token: string, connectionId: string, params: { persona?: string | null, ignore_author_comments?: boolean, auto_sync?: boolean }) =>
    apiFetch(`/connections/${connectionId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(params),
    }),

  connectYoutube: (token: string, channelHandle: string) =>
    apiFetch("/connections/youtube", {
      method: "POST",
      token,
      body: JSON.stringify({ channel_handle: channelHandle }),
    }),

  connectInstagram: (token: string, username: string) =>
    apiFetch("/connections/instagram", {
      method: "POST",
      token,
      body: JSON.stringify({ channel_handle: username }), // Reuses same schema
    }),

  connectTwitter: (token: string, username: string) =>
    apiFetch("/connections/twitter", {
      method: "POST",
      token,
      body: JSON.stringify({ channel_handle: username }),
    }),

  connectTiktok: (token: string, username: string) =>
    apiFetch("/connections/tiktok", {
      method: "POST",
      token,
      body: JSON.stringify({ channel_handle: username }),
    }),

  getInstagramAuthUrl: (token: string) =>
    apiFetch<{ auth_url: string }>("/connections/instagram/auth-url", { token }),

  getTiktokAuthUrl: (token: string) =>
    apiFetch<{ auth_url: string }>("/connections/tiktok/auth-url", { token }),

  checkProfile: (token: string, platform: string, username: string) =>
    apiFetch<any>(`/connections/check-profile?platform=${platform}&username=${username}`, { token }),

  sync: (
    token: string,
    connectionId: string,
    params?: { max_posts?: number; max_comments_per_post?: number; since_date?: string; use_apify_comments?: boolean; comment_sample_mode?: string; include_demographics?: boolean }
  ) =>
    apiFetch<{ connection_id: string; task_id: string; run_id?: string; message: string }>(
      `/connections/${connectionId}/sync`,
      { method: "POST", token, body: params ? JSON.stringify(params) : undefined }
    ),

  preflight: (
    token: string,
    connectionId: string,
    mode: "sync" | "analyze",
    params?: { max_posts?: number; max_comments_per_post?: number; since_date?: string; use_apify_comments?: boolean; comment_sample_mode?: string; include_demographics?: boolean }
  ) =>
    apiFetch<import("./types").PreflightEstimate>(
      `/connections/${connectionId}/preflight?mode=${mode}`,
      { method: "POST", token, body: params ? JSON.stringify(params) : undefined }
    ),

  analyze: (token: string, connectionId: string) =>
    apiFetch<{ connection_id: string; task_id: string; run_id?: string; message: string }>(
      `/connections/${connectionId}/analyze`,
      { method: "POST", token }
    ),

  delete: (token: string, connectionId: string) =>
    apiFetch(`/connections/${connectionId}`, { method: "DELETE", token }),
};

// Posts
export const postsApi = {
  list: (token: string, params?: { connection_id?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.connection_id) query.set("connection_id", params.connection_id);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiFetch<
      Array<{
        id: string;
        platform: string;
        platform_post_id: string;
        post_type: string | null;
        content_text: string | null;
        like_count: number;
        comment_count: number;
        published_at: string | null;
        post_url: string | null;
        thumbnail_url: string | null;
      }>
    >(`/posts${qs ? `?${qs}` : ""}`, { token });
  },

  detail: (token: string, postId: string) =>
    apiFetch<{
      post: Record<string, unknown>;
      comments: Array<Record<string, unknown>>;
      analysis: Array<Record<string, unknown>>;
      summary: Record<string, unknown> | null;
    }>(`/posts/${postId}`, { token }),
};

// Dashboard
export const dashboardApi = {
  summary: (token: string) =>
    apiFetch<DashboardSummary>("/dashboard/summary", { token }),

  connectionDashboard: (token: string, connectionId: string) =>
    apiFetch<ConnectionDashboard>(`/dashboard/connection/${connectionId}`, { token }),

  trends: (
    token: string,
    params: { connection_id?: string; granularity?: string; days?: number } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.connection_id) query.set("connection_id", params.connection_id);
    if (params.granularity) query.set("granularity", params.granularity);
    if (params.days !== undefined) query.set("days", String(params.days));
    const qs = query.toString();
    return apiFetch<TrendResponse>(
      `/dashboard/trends${qs ? `?${qs}` : ""}`,
      { token }
    );
  },

  trendsDetailed: (
    token: string,
    params: { connection_id?: string; granularity?: string; days?: number } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.connection_id) query.set("connection_id", params.connection_id);
    if (params.granularity) query.set("granularity", params.granularity);
    if (params.days !== undefined) query.set("days", String(params.days));
    const qs = query.toString();
    return apiFetch<TrendsDetailedResponse>(
      `/dashboard/trends-detailed${qs ? `?${qs}` : ""}`,
      { token }
    );
  },

  healthReport: (token: string) =>
    apiFetch<HealthReport>("/dashboard/health-report", { token }),

  healthReportWithPrompt: (token: string, customPrompt?: string) =>
    apiFetch<HealthReport>("/dashboard/health-report", {
      method: "POST",
      token,
      body: JSON.stringify({ custom_prompt: customPrompt || null }),
    }),

  getHealthPrompt: (token: string) =>
    apiFetch<{ prompt: string }>("/dashboard/health-report/prompt", { token }),

  compare: (token: string, days = 30) =>
    apiFetch<{
      days: number;
      platforms: Array<{
        platform: string;
        total_comments: number;
        total_analyzed: number;
        avg_score: number | null;
        sentiment_distribution: { positive: number; neutral: number; negative: number };
        positive_rate: number;
        negative_rate: number;
      }>;
      generated_at: string;
    }>(`/dashboard/compare?days=${days}`, { token }),

  compareConnections: (token: string, connectionIds: string[], days = 3650) =>
    apiFetch<{
      days: number;
      connections: Array<{
        connection_id: string;
        platform: string;
        username: string;
        display_name: string | null;
        profile_image_url: string | null;
        total_comments: number;
        total_analyzed: number;
        avg_score: number | null;
        avg_polarity: number | null;
        sentiment_distribution: { positive: number; neutral: number; negative: number };
        positive_rate: number;
        negative_rate: number;
        emotions_distribution: Record<string, number>;
      }>;
      generated_at: string;
    }>(`/dashboard/compare-connections?connection_ids=${connectionIds.join(",")}&days=${days}`, { token }),

  engagementHeatmap: (token: string, connectionId?: string) => {
    const qs = connectionId ? `?connection_id=${connectionId}` : "";
    return apiFetch<{ data: number[][] }>(`/dashboard/engagement-heatmap${qs}`, { token });
  },

  engagementPeaks: (token: string) =>
    apiFetch<{ hours: Array<{ hour: number; volume: number }> }>("/dashboard/engagement-peaks", { token }),

  trendsByPlatform: (token: string, params: { days?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.days !== undefined) query.set("days", String(params.days));
    const qs = query.toString();
    return apiFetch<{
      platforms: Record<string, Array<{ date: string; score: number }>>;
    }>(`/dashboard/trends-by-platform${qs ? `?${qs}` : ""}`, { token });
  },

  gapAnalysis: (token: string, connectionId: string) =>
    apiFetch<{
      posts: Array<{ id: string; title: string; engagement: number; sentiment: number; comments: number }>;
    }>(`/dashboard/connection/${connectionId}/gap-analysis`, { token }),

  ambassadorsDetractors: (token: string, connectionId: string) =>
    apiFetch<{
      ambassadors: Array<{ username: string; count: number; avg_score: number; dominant_emotion: string; gender?: string; age_band?: string; location_state?: string }>;
      detractors: Array<{ username: string; count: number; avg_score: number; dominant_emotion: string; gender?: string; age_band?: string; location_state?: string }>;
    }>(`/dashboard/connection/${connectionId}/ambassadors-detractors`, { token }),

  topicEmotionMatrix: (token: string, connectionId: string) =>
    apiFetch<{
      topics: string[];
      emotions: string[];
      matrix: number[][];
    }>(`/dashboard/connection/${connectionId}/topic-emotion-matrix`, { token }),

  postLifecycle: (token: string, connectionId: string, postId: string) =>
    apiFetch<{
      post_id: string;
      datapoints: Array<{ hours_after: number; avg_score: number; volume: number }>;
    }>(`/dashboard/connection/${connectionId}/post-lifecycle?post_id=${postId}`, { token }),

  interactionTypes: (token: string, connectionId: string) =>
    apiFetch<{
      weeks: Array<{ date: string; comments: number; shares: number; likes: number }>;
    }>(`/dashboard/connection/${connectionId}/interaction-types`, { token }),

  compareRadar: (token: string, connectionIds: string[], days = 90) =>
    apiFetch<{
      connections: Array<{
        connection_id: string;
        username: string;
        axes: { score: number; engagement: number; positivity: number; volume: number; consistency: number; growth: number };
      }>;
    }>(`/dashboard/compare-radar?connection_ids=${connectionIds.join(",")}&days=${days}`, { token }),

  insights: (token: string, connectionIds: string[]) =>
    apiFetch<{
      advantage: { title: string; description: string };
      opportunity: { title: string; description: string };
      risk: { title: string; description: string };
    }>(`/dashboard/insights?connection_ids=${connectionIds.join(",")}`, { token }),

  youtubeStats: (token: string, connectionId: string) =>
    apiFetch<{
      channel_stats: {
        subscribers: number;
        total_views: number;
        total_videos: number;
        avg_views_per_video: number;
        avg_engagement_rate: number;
      };
      growth: Array<{ date: string; subscribers: number; views: number }>;
      top_videos: Array<{
        title: string;
        views: number;
        likes: number;
        comments: number;
        engagement_rate: number;
        published_at: string | null;
      }>;
    }>(`/dashboard/connection/${connectionId}/youtube-stats`, { token }),

  alerts: (
    token: string,
    params: { days?: number; min_analyzed?: number; negative_threshold?: number } = {}
  ) => {
    const query = new URLSearchParams();
    if (params.days !== undefined) query.set("days", String(params.days));
    if (params.min_analyzed !== undefined) query.set("min_analyzed", String(params.min_analyzed));
    if (params.negative_threshold !== undefined) {
      query.set("negative_threshold", String(params.negative_threshold));
    }
    const qs = query.toString();
    return apiFetch<{
      days: number;
      total_alerts: number;
      alerts: Array<{
        connection_id: string;
        platform: string;
        username: string;
        severity: string;
        negative_rate: number;
        sarcasm_rate: number;
        total_analyzed: number;
        avg_score: number | null;
        message: string;
      }>;
      generated_at: string;
    }>(`/dashboard/alerts${qs ? `?${qs}` : ""}`, { token });
  },
};

// Demographics
export const demographicsApi = {
  overview: (token: string, connectionId: string) =>
    apiFetch<{
      gender_distribution: Record<string, number>;
      age_distribution: Record<string, number>;
      top_locations: Array<{ country: string; country_code: string; count: number }>;
      state_distribution: Array<{ state: string; count: number }>;
      enrichment_coverage: { total_commenters: number; enriched: number; coverage_pct: number };
    }>(`/dashboard/demographics/connection/${connectionId}/overview`, { token }),

  sentimentByAge: (token: string, connectionId: string) =>
    apiFetch<Array<{ band: string; positive: number; neutral: number; negative: number; avg_score: number; count: number }>>(
      `/dashboard/demographics/connection/${connectionId}/sentiment-by-age`, { token }
    ),

  sentimentByGender: (token: string, connectionId: string) =>
    apiFetch<Array<{ gender: string; positive: number; neutral: number; negative: number; avg_score: number; count: number }>>(
      `/dashboard/demographics/connection/${connectionId}/sentiment-by-gender`, { token }
    ),

  emotionsByGender: (token: string, connectionId: string) =>
    apiFetch<Array<{ gender: string; emotions: Record<string, number> }>>(
      `/dashboard/demographics/connection/${connectionId}/emotions-by-gender`, { token }
    ),

  sentimentByLocation: (token: string, connectionId: string) =>
    apiFetch<Array<{ state: string; count: number; avg_score: number; dominant_emotion: string }>>(
      `/dashboard/demographics/connection/${connectionId}/sentiment-by-location`, { token }
    ),

  globalOverview: (token: string) =>
    apiFetch<{
      gender_distribution: Record<string, number>;
      age_distribution: Record<string, number>;
      top_locations: Array<{ country: string; country_code: string; count: number }>;
      state_distribution: Array<{ state: string; count: number }>;
      enrichment_coverage: { total_commenters: number; enriched: number; coverage_pct: number };
    }>(`/dashboard/demographics/overview`, { token }),
};

// Billing
export const billingApi = {
  plans: (token: string) =>
    apiFetch<{
      plans: Array<{
        slug: string;
        name: string;
        price_brl: number;
        description: string;
        highlight?: boolean;
        limits: Record<string, unknown>;
      }>;
    }>("/billing/plans", { token }),

  usage: (token: string) =>
    apiFetch<{
      plan: string;
      subscription_status?: string | null;
      usage: {
        syncs_used_this_month: number;
        syncs_limit: number;
        connections_used: number;
        connections_limit: number;
        comments_used_this_month: number;
        comments_included: number;
        overage_comments: number;
        overage_cost_brl: number;
        overage_price_per_comment: number;
        overage_allowed: boolean;
        apify_credits_used_brl: number;
        apify_credits_limit_brl: number;
        billing_period_start: string;
        billing_period_end: string;
      };
    }>("/billing/usage", { token }),

  createCheckoutSession: (token: string, planSlug: string) =>
    apiFetch<{ url: string }>("/billing/checkout-session", {
      method: "POST",
      token,
      body: JSON.stringify({ plan_slug: planSlug }),
    }),

  createPortalSession: (token: string) =>
    apiFetch<{ url: string }>("/billing/portal-session", {
      method: "POST",
      token,
    }),
};

// Credits
export const creditsApi = {
  getCredits: (token: string) =>
    apiFetch<{
      plan_credits: number;
      pack_credits: number;
      total: number;
      cycle_start: string;
      cycle_end: string | null;
      plan: string;
      plan_allocation: number;
      demographic_cost: number;
      packs: Array<{ id: string; credits: number; price_brl: number }>;
    }>("/billing/credits", { token }),

  getHistory: (token: string) =>
    apiFetch<
      Array<{
        id: string;
        type: string;
        amount: number;
        balance_after: number;
        description: string;
        created_at: string;
      }>
    >("/billing/credits/history", { token }),

  buyCredits: (token: string, pack: string) =>
    apiFetch<{ url: string }>("/billing/credits/buy", {
      method: "POST",
      token,
      body: JSON.stringify({ pack }),
    }),
};

// Pipeline
export const pipelineApi = {
  listRuns: (token: string) =>
    apiFetch<PipelineRun[]>("/pipeline/runs", { token }),

  getRunStatus: (token: string, runId: string) =>
    apiFetch<PipelineStatus>(`/pipeline/runs/${runId}/status`, { token }),

  cancelRun: (token: string, runId: string) =>
    apiFetch<{ status: string; id: string }>(`/pipeline/runs/${runId}/cancel`, { method: "POST", token }),

  deleteRun: (token: string, runId: string) =>
    apiFetch<void>(`/pipeline/runs/${runId}`, { method: "DELETE", token }),
};

// Comments
export const commentsApi = {
  top: (token: string, params: { connection_id?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.connection_id) query.set("connection_id", params.connection_id);
    if (params.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiFetch<{
      most_positive: Array<Record<string, unknown>>;
      most_negative: Array<Record<string, unknown>>;
    }>(`/comments/top${qs ? `?${qs}` : ""}`, { token });
  },

  list: (
    token: string,
    params: {
      connection_id?: string;
      post_id?: string;
      sentiment?: string;
      emotion?: string;
      search?: string;
      sort?: string;
      order?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) query.set(key, String(val));
    });
    const qs = query.toString();
    return apiFetch<CommentListResponse>(
      `/comments${qs ? `?${qs}` : ""}`,
      { token }
    );
  },
};

type ApiBlogPost = Parameters<typeof normalizeBlogPost>[0];
type ApiBlogSettingsResponse = Parameters<typeof normalizeBlogSettings>[0];

export type BlogPostInput = {
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  category: BlogCategory;
  persona: BlogPersona;
  tags: string[];
  cover_image_url: string;
  cover_image_alt: string;
  seo_title?: string | null;
  seo_description?: string | null;
  cta_label: string;
  cta_href: string;
  read_time_minutes: number;
};

export type BlogSettingsInput = Partial<{
  nav_pricing_label: string;
  nav_cta_label: string;
  nav_cta_href: string;
  hero_eyebrow: string;
  hero_title: string;
  hero_description: string;
  search_placeholder: string;
  hero_cta_label: string;
  hero_cta_href: string;
  sidebar_title: string;
  sidebar_description: string;
  sidebar_cta_label: string;
  sidebar_cta_href: string;
  all_category_label: string;
  categories: string[];
  empty_state_text: string;
  article_nav_cta_label: string;
  article_nav_cta_href: string;
  article_cta_title: string;
  article_cta_description: string;
}>;

export type BlogMediaUploadResponse = {
  filename: string;
  url: string;
  content_type: string;
  size_bytes: number;
};

export const blogAdminApi = {
  getSettings: async (token: string): Promise<BlogSettings> => {
    const settings = await apiFetch<ApiBlogSettingsResponse>("/admin/blog/settings", { token });
    return normalizeBlogSettings(settings);
  },

  updateSettings: async (token: string, payload: BlogSettingsInput): Promise<BlogSettings> => {
    const settings = await apiFetch<ApiBlogSettings>("/admin/blog/settings", {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
    return normalizeBlogSettings(settings);
  },

  list: async (token: string, status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await apiFetch<{ posts: ApiBlogPost[] }>(`/admin/blog/posts${qs}`, { token });
    return data.posts.map(normalizeBlogPost);
  },

  create: async (token: string, payload: BlogPostInput): Promise<BlogPost> => {
    const post = await apiFetch<ApiBlogPost>("/admin/blog/posts", {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
    return normalizeBlogPost(post);
  },

  update: async (token: string, postId: string, payload: Partial<BlogPostInput>): Promise<BlogPost> => {
    const post = await apiFetch<ApiBlogPost>(`/admin/blog/posts/${postId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    });
    return normalizeBlogPost(post);
  },

  publish: async (token: string, postId: string): Promise<BlogPost> => {
    const post = await apiFetch<ApiBlogPost>(`/admin/blog/posts/${postId}/publish`, {
      method: "POST",
      token,
    });
    return normalizeBlogPost(post);
  },

  unpublish: async (token: string, postId: string): Promise<BlogPost> => {
    const post = await apiFetch<ApiBlogPost>(`/admin/blog/posts/${postId}/unpublish`, {
      method: "POST",
      token,
    });
    return normalizeBlogPost(post);
  },

  uploadMedia: async (token: string, file: File): Promise<BlogMediaUploadResponse> => {
    const { COOKIE_AUTH_SENTINEL } = await import("./auth");
    const headers: Record<string, string> = {};
    if (token && token !== COOKIE_AUTH_SENTINEL) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const body = new FormData();
    body.append("file", file);

    const response = await fetch(`${API_URL}/admin/blog/media`, {
      method: "POST",
      credentials: "include",
      headers,
      body,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(formatApiErrorDetail(error.detail, `API error: ${response.status}`));
    }
    return response.json();
  },
};

export const publicApi = {
  preview: (platform: "youtube" | "instagram", handle: string) =>
    apiFetch<import("./types").PreviewResult>("/public/preview", {
      method: "POST",
      body: JSON.stringify({ platform, handle }),
    }),
};
