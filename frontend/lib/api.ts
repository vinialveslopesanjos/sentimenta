import type {
  PipelineRun,
  PipelineStatus,
  DashboardSummary,
  ConnectionDashboard,
  TrendResponse,
  HealthReport,
  CommentListResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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

  const res = await fetch(`${API_URL}${path}`, { headers, ...rest });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
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
      }>
    >("/connections", { token }),

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

  getInstagramAuthUrl: (token: string) =>
    apiFetch<{ auth_url: string }>("/connections/instagram/auth-url", { token }),

  sync: (token: string, connectionId: string) =>
    apiFetch<{ connection_id: string; task_id: string; message: string }>(
      `/connections/${connectionId}/sync`,
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

  healthReport: (token: string) =>
    apiFetch<HealthReport>("/dashboard/health-report", { token }),
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
