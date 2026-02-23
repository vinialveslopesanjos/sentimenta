/**
 * Universal API client for Sentimenta.
 *
 * Works in both browser (Next.js) and React Native environments.
 * The `fetchFn` parameter allows injecting platform-specific fetch if needed.
 */

import type {
    AuthTokens,
    UserProfile,
    Connection,
    DashboardSummary,
    ConnectionDashboard,
    TrendResponse,
    TrendsDetailedResponse,
    HealthReport,
    CommentListResponse,
    PipelineRun,
    PipelineStatus,
    AlertsResponse,
    CompareResponse,
} from "@sentimenta/types";

import { SentimentaApiError } from "./errors";

// ─── Types ────────────────────────────────────────────────────────

interface ClientConfig {
    baseUrl: string;
    getToken: () => string | null | Promise<string | null>;
    fetchFn?: typeof fetch;
    onUnauthorized?: () => void;
}

interface FetchOptions extends RequestInit {
    skipAuth?: boolean;
}

// ─── Client factory ───────────────────────────────────────────────

export function createApiClient(config: ClientConfig) {
    const { baseUrl, getToken, onUnauthorized } = config;
    const fetchFn = config.fetchFn || fetch;

    // ── Core fetch wrapper ────────────────────────────────────────

    async function apiFetch<T>(
        path: string,
        options: FetchOptions = {}
    ): Promise<T> {
        const { skipAuth, headers: customHeaders, ...rest } = options;

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...((customHeaders as Record<string, string>) || {}),
        };

        if (!skipAuth) {
            const token = await getToken();
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
        }

        let res: Response;
        try {
            res = await fetchFn(`${baseUrl}${path}`, { headers, ...rest });
        } catch (error) {
            // Retry once for transient errors
            try {
                await new Promise((resolve) => setTimeout(resolve, 300));
                res = await fetchFn(`${baseUrl}${path}`, { headers, ...rest });
            } catch {
                const message =
                    error instanceof Error ? error.message : "Failed to fetch";
                throw new SentimentaApiError(0, `Falha de conexão com API. ${message}`);
            }
        }

        if (res.status === 401) {
            onUnauthorized?.();
            throw new SentimentaApiError(401, "Sessão expirada. Faça login novamente.");
        }

        if (!res.ok) {
            const body = await res.json().catch(() => ({ detail: res.statusText }));
            throw new SentimentaApiError(
                res.status,
                body.detail || `API error: ${res.status}`,
                body.code
            );
        }

        return res.json();
    }

    // ── API namespaces ────────────────────────────────────────────

    const auth = {
        register: (email: string, password: string, name?: string) =>
            apiFetch<AuthTokens>("/auth/register", {
                method: "POST",
                body: JSON.stringify({ email, password, name }),
                skipAuth: true,
            }),

        login: (email: string, password: string) =>
            apiFetch<AuthTokens>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
                skipAuth: true,
            }),

        googleLogin: (googleToken: string) =>
            apiFetch<AuthTokens>("/auth/google", {
                method: "POST",
                body: JSON.stringify({ token: googleToken }),
                skipAuth: true,
            }),

        logout: () => apiFetch<{ message: string }>("/auth/logout", { method: "POST" }),

        me: () => apiFetch<UserProfile>("/auth/me"),

        updateMe: (payload: { name?: string | null; avatar_url?: string | null }) =>
            apiFetch<UserProfile>("/auth/me", {
                method: "PATCH",
                body: JSON.stringify(payload),
            }),
    };

    const connections = {
        list: () => apiFetch<Connection[]>("/connections"),

        connectInstagram: (username: string) =>
            apiFetch<Connection>("/connections/instagram", {
                method: "POST",
                body: JSON.stringify({ channel_handle: username }),
            }),

        connectYoutube: (channelHandle: string) =>
            apiFetch<Connection>("/connections/youtube", {
                method: "POST",
                body: JSON.stringify({ channel_handle: channelHandle }),
            }),

        sync: (
            connectionId: string,
            params?: {
                max_posts?: number;
                max_comments_per_post?: number;
                since_date?: string;
            }
        ) =>
            apiFetch<{ connection_id: string; task_id: string; message: string }>(
                `/connections/${connectionId}/sync`,
                {
                    method: "POST",
                    body: params ? JSON.stringify(params) : undefined,
                }
            ),

        delete: (connectionId: string) =>
            apiFetch(`/connections/${connectionId}`, { method: "DELETE" }),
    };

    const dashboard = {
        summary: () => apiFetch<DashboardSummary>("/dashboard/summary"),

        connectionDashboard: (connectionId: string) =>
            apiFetch<ConnectionDashboard>(`/dashboard/connection/${connectionId}`),

        trends: (params: {
            connection_id?: string;
            granularity?: string;
            days?: number;
        } = {}) => {
            const qs = new URLSearchParams(
                Object.fromEntries(
                    Object.entries(params)
                        .filter(([, v]) => v !== undefined)
                        .map(([k, v]) => [k, String(v)])
                )
            ).toString();
            return apiFetch<TrendResponse>(`/dashboard/trends${qs ? `?${qs}` : ""}`);
        },

        trendsDetailed: (params: {
            connection_id?: string;
            granularity?: string;
            days?: number;
        } = {}) => {
            const qs = new URLSearchParams(
                Object.fromEntries(
                    Object.entries(params)
                        .filter(([, v]) => v !== undefined)
                        .map(([k, v]) => [k, String(v)])
                )
            ).toString();
            return apiFetch<TrendsDetailedResponse>(
                `/dashboard/trends-detailed${qs ? `?${qs}` : ""}`
            );
        },

        healthReport: () => apiFetch<HealthReport>("/dashboard/health-report"),

        compare: (days = 30) => apiFetch<CompareResponse>(`/dashboard/compare?days=${days}`),

        alerts: (params: {
            days?: number;
            min_analyzed?: number;
            negative_threshold?: number;
        } = {}) => {
            const qs = new URLSearchParams(
                Object.fromEntries(
                    Object.entries(params)
                        .filter(([, v]) => v !== undefined)
                        .map(([k, v]) => [k, String(v)])
                )
            ).toString();
            return apiFetch<AlertsResponse>(`/dashboard/alerts${qs ? `?${qs}` : ""}`);
        },
    };

    const pipeline = {
        listRuns: () => apiFetch<PipelineRun[]>("/pipeline/runs"),
        getRunStatus: (runId: string) =>
            apiFetch<PipelineStatus>(`/pipeline/runs/${runId}/status`),
    };

    const comments = {
        list: (params: {
            connection_id?: string;
            post_id?: string;
            sentiment?: string;
            search?: string;
            sort?: string;
            order?: string;
            limit?: number;
            offset?: number;
        } = {}) => {
            const qs = new URLSearchParams(
                Object.fromEntries(
                    Object.entries(params)
                        .filter(([, v]) => v !== undefined && v !== null)
                        .map(([k, v]) => [k, String(v)])
                )
            ).toString();
            return apiFetch<CommentListResponse>(
                `/comments${qs ? `?${qs}` : ""}`
            );
        },
    };

    return { auth, connections, dashboard, pipeline, comments, apiFetch };
}

export type ApiClient = ReturnType<typeof createApiClient>;
