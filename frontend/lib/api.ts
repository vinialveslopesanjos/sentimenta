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

const API_URL = "/api/v1";

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers, ...rest });
  } catch (error) {
    // Retry once for transient backend reload/network blips in local dev.
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      res = await fetch(`${API_URL}${path}`, { headers, ...rest });
    } catch {
      const message = error instanceof Error ? error.message : "Failed to fetch";
      throw new Error(`Falha de conexão com API (${API_URL}). ${message}`);
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null as any;
  }

  return res.json();
}

// Auth
export const authApi = {
  register: (email: string, password: string, name?: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: (token: string) =>
    apiFetch<{ message: string }>("/auth/logout", { method: "POST", token }),

  googleLogin: (googleToken: string) =>
    apiFetch<{ access_token: string; refresh_token: string }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ token: googleToken }),
    }),

  me: (token: string) =>
    apiFetch<{
      id: string;
      email: string;
      name: string | null;
      avatar_url: string | null;
      plan: string;
    }>("/auth/me", { token }),

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
      }>
    >("/connections", { token }),

  updateConnection: (token: string, connectionId: string, params: { persona?: string | null, ignore_author_comments?: boolean }) =>
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

  getInstagramAuthUrl: (token: string) =>
    apiFetch<{ auth_url: string }>("/connections/instagram/auth-url", { token }),

  checkProfile: (token: string, platform: string, username: string) =>
    apiFetch<any>(`/connections/check-profile?platform=${platform}&username=${username}`, { token }),

  sync: (
    token: string,
    connectionId: string,
    params?: { max_posts?: number; max_comments_per_post?: number; since_date?: string }
  ) =>
    apiFetch<{ connection_id: string; task_id: string; message: string }>(
      `/connections/${connectionId}/sync`,
      { method: "POST", token, body: params ? JSON.stringify(params) : undefined }
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
    if (params.days) query.set("days", String(params.days));
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
    if (params.days) query.set("days", String(params.days));
    const qs = query.toString();
    return apiFetch<TrendsDetailedResponse>(
      `/dashboard/trends-detailed${qs ? `?${qs}` : ""}`,
      { token }
    );
  },

  healthReport: (token: string) =>
    apiFetch<HealthReport>("/dashboard/health-report", { token }),

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

// Pipeline
export const pipelineApi = {
  listRuns: (token: string) =>
    apiFetch<PipelineRun[]>("/pipeline/runs", { token }),

  getRunStatus: (token: string, runId: string) =>
    apiFetch<PipelineStatus>(`/pipeline/runs/${runId}/status`, { token }),
};

// Comments
export const commentsApi = {
  list: (
    token: string,
    params: {
      connection_id?: string;
      post_id?: string;
      sentiment?: string;
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
