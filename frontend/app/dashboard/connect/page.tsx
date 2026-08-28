"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  BarChart3,
  Trash2,
  ChevronDown,
  Settings2,
  X,
  Info,
  CircleCheck,
  TriangleAlert,
  Clock3,
  CircleX,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";
import type { Connection, ConnectionHealthState } from "@sentimenta/types";
import { connectionsApi, authApi, creditsApi, type CollectionPreview } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  constrainSyncSettings,
  DEFAULT_SYNC_SETTINGS,
  loadSyncSettings,
  saveSyncSettings,
  toSyncPayload,
  type CollectionLimits,
  type SyncSettings,
} from "@/lib/syncSettings";
import { track } from "@/lib/tracking";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";
import {
  PlatformCapabilityBadge,
  PlatformCapabilityMatrix,
} from "@/components/PlatformCapabilityMatrix";
import { PLATFORM_CAPABILITIES } from "@/lib/platformCapabilities";

type BadgeVariant = "primary" | "positive" | "warning" | "negative" | "muted";

const HEALTH_VISUALS: Record<
  ConnectionHealthState,
  {
    variant: BadgeVariant;
    icon: LucideIcon;
    labelKey:
      | "health.states.healthy.label"
      | "health.states.degraded.label"
      | "health.states.stale.label"
      | "health.states.failed.label"
      | "health.states.never_synced.label";
    actionKey:
      | "health.actions.viewData"
      | "health.actions.reviewAndSync"
      | "health.actions.syncNow"
      | "health.actions.tryAgain"
      | "health.actions.firstSync";
  }
> = {
  healthy: {
    variant: "positive",
    icon: CircleCheck,
    labelKey: "health.states.healthy.label",
    actionKey: "health.actions.viewData",
  },
  degraded: {
    variant: "warning",
    icon: TriangleAlert,
    labelKey: "health.states.degraded.label",
    actionKey: "health.actions.reviewAndSync",
  },
  stale: {
    variant: "muted",
    icon: Clock3,
    labelKey: "health.states.stale.label",
    actionKey: "health.actions.syncNow",
  },
  failed: {
    variant: "negative",
    icon: CircleX,
    labelKey: "health.states.failed.label",
    actionKey: "health.actions.tryAgain",
  },
  never_synced: {
    variant: "primary",
    icon: CircleDashed,
    labelKey: "health.states.never_synced.label",
    actionKey: "health.actions.firstSync",
  },
};

const HEALTH_REASON_KEYS: Record<string, string> = {
  healthy: "health.reasons.healthy",
  connection_not_active: "health.reasons.connection_not_active",
  auto_sync_disabled: "health.reasons.auto_sync_disabled",
  latest_attempt_failed: "health.reasons.latest_attempt_failed",
  latest_attempt_partial: "health.reasons.latest_attempt_partial",
  sync_stuck: "health.reasons.sync_stuck",
  zero_valid_analyses: "health.reasons.zero_valid_analyses",
  last_success_outside_sla: "health.reasons.last_success_outside_sla",
  legacy_sync_unverified: "health.reasons.legacy_sync_unverified",
  first_sync_in_progress: "health.reasons.first_sync_in_progress",
  never_synced: "health.reasons.never_synced",
};

const ATTEMPT_STATUS_KEYS: Record<string, string> = {
  completed: "health.attemptStatuses.completed",
  partial: "health.attemptStatuses.partial",
  failed: "health.attemptStatuses.failed",
  cancelled: "health.attemptStatuses.cancelled",
  running: "health.attemptStatuses.running",
};

function formatExecutionDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelativeExecution(value: string, locale: string): string {
  const deltaMs = new Date(value).getTime() - Date.now();
  const absoluteMs = Math.abs(deltaMs);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (absoluteMs >= 86_400_000) return formatter.format(Math.round(deltaMs / 86_400_000), "day");
  if (absoluteMs >= 3_600_000) return formatter.format(Math.round(deltaMs / 3_600_000), "hour");
  return formatter.format(Math.round(deltaMs / 60_000), "minute");
}

type PlatformId = "instagram" | "youtube" | "twitter" | "tiktok";

function hasValidCollectionLimits(value: unknown): value is CollectionLimits {
  if (!value || typeof value !== "object") return false;
  const limits = value as Partial<CollectionLimits>;
  return Number.isFinite(limits.max_posts_per_sync)
    && Number(limits.max_posts_per_sync) >= 1
    && Number.isFinite(limits.max_comments_per_post)
    && Number(limits.max_comments_per_post) >= 10
    && typeof limits.sync_frequency === "string"
    && limits.sync_frequency.length > 0;
}

export default function ConnectPage() {
  const t = useTranslations("connect");
  const tc = useTranslations("common");
  const tp = useTranslations("platformCapabilities");
  const locale = useLocale();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState<Record<string, string>>({ instagram: "", youtube: "", twitter: "", tiktok: "" });
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [potentials, setPotentials] = useState<Record<string, any>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [togglingSync, setTogglingSync] = useState<Record<string, boolean>>({});
  const [configOpen, setConfigOpen] = useState(false);
  const [syncParams, setSyncParams] = useState<SyncSettings>(DEFAULT_SYNC_SETTINGS);
  const [syncEstimate, setSyncEstimate] = useState<{ show: boolean; minMinutes: number; maxMinutes: number; username: string }>({ show: false, minMinutes: 0, maxMinutes: 0, username: "" });
  const [userPlan, setUserPlan] = useState("free");
  const [creditBalance, setCreditBalance] = useState<{ total: number; plan_credits: number; plan_allocation: number } | null>(null);
  const [collectionLimits, setCollectionLimits] = useState<CollectionLimits | null>(null);
  const [limitsStatus, setLimitsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [preparedConnectionId, setPreparedConnectionId] = useState<string | "all">("all");
  const [collectionPreview, setCollectionPreview] = useState<CollectionPreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadConnections = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await connectionsApi.list(token);
      setConnections(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    setSyncParams(loadSyncSettings());
    const token = getToken();
    if (token) {
      authApi.me(token).then(u => setUserPlan(u.plan || "free")).catch(() => {});
      creditsApi.getCredits(token).then(c => {
        setUserPlan(c.plan || "free");
        setCreditBalance({ total: c.total, plan_credits: c.plan_credits, plan_allocation: c.plan_allocation });
        if (!hasValidCollectionLimits(c.collection_limits)) {
          setCollectionLimits(null);
          setLimitsStatus("error");
          return;
        }
        setCollectionLimits(c.collection_limits);
        setLimitsStatus("ready");
        setSyncParams(current => saveSyncSettings(constrainSyncSettings(current, c.collection_limits)));
      }).catch(() => {
        setCollectionLimits(null);
        setLimitsStatus("error");
      });
    }
  }, [loadConnections]);

  useEffect(() => {
    if (!configOpen || limitsStatus !== "ready" || !collectionLimits) {
      setCollectionPreview(null);
      setPreviewStatus("idle");
      return;
    }

    const token = getToken();
    if (!token) return;
    let cancelled = false;
    setPreviewStatus("loading");

    const timer = window.setTimeout(async () => {
      try {
        const preview = await connectionsApi.previewCollection(token, {
          connection_id: preparedConnectionId === "all" ? undefined : preparedConnectionId,
          max_posts: syncParams.max_posts,
          max_comments_per_post: syncParams.max_comments_per_post,
          since_date: syncParams.since_date || undefined,
          comment_selection_mode: syncParams.comment_sample_mode,
        });
        if (cancelled) return;
        setCollectionPreview(preview);
        setPreviewStatus("ready");
      } catch {
        if (cancelled) return;
        setCollectionPreview(null);
        setPreviewStatus("error");
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    collectionLimits,
    configOpen,
    limitsStatus,
    preparedConnectionId,
    syncParams.comment_sample_mode,
    syncParams.max_comments_per_post,
    syncParams.max_posts,
    syncParams.since_date,
  ]);

  const updateSyncParams = useCallback((next: SyncSettings) => {
    const saved = saveSyncSettings(
      collectionLimits ? constrainSyncSettings(next, collectionLimits) : next,
    );
    setSyncParams(saved);
  }, [collectionLimits]);

  const openSyncConfiguration = useCallback((connectionId: string | "all") => {
    setPreparedConnectionId(connectionId);
    setConfigOpen(true);
    window.setTimeout(() => {
      document.getElementById("collection-settings")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }, []);

  const handleCheck = async (platformId: PlatformId) => {
    const handle = inputs[platformId]?.trim();
    if (!handle) {
      setErrors(e => ({ ...e, [platformId]: t("enterUserOrUrl") }));
      return;
    }
    if (platformId !== "instagram" && platformId !== "tiktok") {
      return handleConnect(platformId);
    }
    setErrors(e => ({ ...e, [platformId]: "" }));
    setChecking(c => ({ ...c, [platformId]: true }));
    try {
      const token = getToken()!;
      const data = await connectionsApi.checkProfile(token, platformId, handle.replace("@", ""));
      setPotentials(p => ({ ...p, [platformId]: data }));
    } catch (err) {
      setErrors(e => ({ ...e, [platformId]: err instanceof Error ? err.message : t("checkProfileError") }));
    } finally {
      setChecking(c => ({ ...c, [platformId]: false }));
    }
  };

  const handleConnect = async (platformId: PlatformId) => {
    const handle = inputs[platformId]?.trim();
    if (!handle) return;
    setErrors(e => ({ ...e, [platformId]: "" }));
    setConnecting(c => ({ ...c, [platformId]: true }));
    try {
      const token = getToken()!;
      if (platformId === "instagram") {
        await connectionsApi.connectInstagram(token, handle.replace("@", ""));
      } else if (platformId === "twitter") {
        await connectionsApi.connectTwitter(token, handle.replace("@", ""));
      } else if (platformId === "tiktok") {
        await connectionsApi.connectTiktok(token, handle.replace("@", ""));
      } else {
        await connectionsApi.connectYoutube(token, handle);
      }
      setInputs(i => ({ ...i, [platformId]: "" }));
      setPotentials(p => ({ ...p, [platformId]: null }));
      track("profile_connected", { platform: platformId });
      setSuccess(s => ({ ...s, [platformId]: t("profileConnected") }));
      setTimeout(() => setSuccess(s => ({ ...s, [platformId]: "" })), 3000);
      await loadConnections();
    } catch (err) {
      setErrors(e => ({ ...e, [platformId]: err instanceof Error ? err.message : t("connectError") }));
    } finally {
      setConnecting(c => ({ ...c, [platformId]: false }));
    }
  };

  const estimateSyncTime = useCallback((params: SyncSettings) => {
    const posts = Math.min(params.max_posts || 10, 200);
    const commentsPerPost = params.max_comments_per_post || 50;
    const prioritizesEngagement = params.comment_sample_mode === "engagement";
    // Realistic: Apify scrapes ~10 posts/min, LLM analyzes ~500 comments/min (batched)
    // Demographics adds ~1min overhead for scrape + LLM inference
    const effectiveCommentsPerPost = prioritizesEngagement ? Math.min(commentsPerPost, 200) : Math.min(commentsPerPost, 300);
    const totalComments = posts * effectiveCommentsPerPost;
    const scrapeMinutes = posts * 0.1; // ~6s per post via Apify
    const analysisMinutes = totalComments / 500; // ~500 comments/min batched LLM
    const demographicsMinutes = Math.min(totalComments / 1000, 3) + 0.5; // cap at 3.5min
    const baseMinutes = scrapeMinutes + analysisMinutes + demographicsMinutes;
    return {
      minMinutes: Math.max(1, Math.ceil(baseMinutes * 0.8)),
      maxMinutes: Math.max(2, Math.ceil(baseMinutes * 2)),
    };
  }, []);

  const handleSync = async (connId: string) => {
    if (!collectionLimits) {
      openSyncConfiguration(connId);
      return;
    }
    const token = getToken()!;
    setSyncing(s => ({ ...s, [connId]: true }));
    setErrors(e => ({ ...e, [connId]: "" }));
    track("sync_triggered", { connection_id: connId });
    try {
      await connectionsApi.sync(token, connId, toSyncPayload(syncParams));
      const conn = connections.find(c => c.id === connId);
      const est = estimateSyncTime(syncParams);
      setSyncEstimate({ show: true, ...est, username: conn?.username || "" });
    } catch (err) {
      setErrors(e => ({ ...e, [connId]: err instanceof Error ? err.message : t("syncError") }));
    } finally {
      setTimeout(() => setSyncing(s => ({ ...s, [connId]: false })), 2500);
    }
  };

  const handleSyncAll = async () => {
    if (!collectionLimits) {
      openSyncConfiguration("all");
      return;
    }
    const token = getToken();
    if (!token || connections.length === 0) return;
    track("sync_all_triggered", { count: connections.length });
    const payload = toSyncPayload(syncParams);
    for (const conn of connections) {
      setSyncing(s => ({ ...s, [conn.id]: true }));
      try {
        await connectionsApi.sync(token, conn.id, payload);
      } finally {
        setTimeout(() => setSyncing(s => ({ ...s, [conn.id]: false })), 2500);
      }
    }
    const est = estimateSyncTime(syncParams);
    const factor = connections.length > 1 ? 1.3 : 1; // slightly longer for multiple
    setSyncEstimate({
      show: true,
      minMinutes: Math.ceil(est.minMinutes * factor),
      maxMinutes: Math.ceil(est.maxMinutes * factor),
      username: connections.length === 1 ? connections[0].username : t("multipleProfiles", { count: connections.length }),
    });
  };

  const handlePreparedSync = async () => {
    if (limitsStatus !== "ready" || !collectionLimits) return;
    if (preparedConnectionId === "all") {
      await handleSyncAll();
      return;
    }
    await handleSync(preparedConnectionId);
  };

  const handleDelete = async (connId: string) => {
    const token = getToken()!;
    track("profile_deleted", { connection_id: connId });
    try {
      await connectionsApi.delete(token, connId);
      setConnections(c => c.filter(x => x.id !== connId));
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleToggleAutoSync = async (connId: string, current: boolean) => {
    const token = getToken();
    if (!token) return;
    setTogglingSync(s => ({ ...s, [connId]: true }));
    try {
      await connectionsApi.updateConnection(token, connId, { auto_sync: !current });
      setConnections(c => c.map(x => x.id === connId ? { ...x, auto_sync: !current } : x));
    } finally {
      setTogglingSync(s => ({ ...s, [connId]: false }));
    }
  };

  const handleOAuthConnect = async (platformId: "instagram" | "tiktok") => {
    const token = getToken();
    if (!token) return;
    setConnecting(c => ({ ...c, [platformId]: true }));
    setErrors(e => ({ ...e, [platformId]: "" }));
    try {
      const res = platformId === "instagram"
        ? await connectionsApi.getInstagramAuthUrl(token)
        : await connectionsApi.getTiktokAuthUrl(token);
      window.location.href = res.auth_url;
    } catch (err) {
      setErrors(e => ({ ...e, [platformId]: err instanceof Error ? err.message : t("oauthError") }));
      setConnecting(c => ({ ...c, [platformId]: false }));
    }
  };

  const platforms = ([
    { id: "instagram" as PlatformId, name: t("platforms.instagram.name"), desc: t("platforms.instagram.desc"), placeholder: t("platforms.instagram.placeholder"), hasInput: true, buttonText: t("platforms.instagram.button"), secondaryButton: t("platforms.instagram.oauthButton") },
    { id: "youtube" as PlatformId, name: t("platforms.youtube.name"), desc: t("platforms.youtube.desc"), placeholder: t("platforms.youtube.placeholder"), hasInput: true, buttonText: t("platforms.youtube.button") },
    { id: "tiktok" as PlatformId, name: t("platforms.tiktok.name"), desc: t("platforms.tiktok.desc"), placeholder: t("platforms.tiktok.placeholder"), hasInput: true, buttonText: t("platforms.tiktok.button") },
    { id: "twitter" as PlatformId, name: t("platforms.twitter.name"), desc: t("platforms.twitter.desc"), placeholder: t("platforms.twitter.placeholder"), hasInput: true, buttonText: t("platforms.twitter.button") },
  ]).map(platform => ({
    ...platform,
    capability: PLATFORM_CAPABILITIES[platform.id],
    disabled: !PLATFORM_CAPABILITIES[platform.id].connectable,
  }));

  const numberFormatter = new Intl.NumberFormat(locale);
  const postOptions = collectionLimits
    ? Array.from(new Set([1, 10, 20, 50, 100, collectionLimits.max_posts_per_sync]))
        .filter(value => value <= collectionLimits.max_posts_per_sync)
        .sort((a, b) => a - b)
    : [];
  const commentOptions = collectionLimits
    ? Array.from(new Set([10, 50, 200, collectionLimits.max_comments_per_post]))
        .filter(value => value <= collectionLimits.max_comments_per_post)
        .sort((a, b) => a - b)
    : [];
  const preparedConnection = preparedConnectionId === "all"
    ? null
    : connections.find(connection => connection.id === preparedConnectionId) ?? null;
  const targetLabel = preparedConnection
    ? t("scope.oneProfile", { username: preparedConnection.username })
    : t("scope.allProfiles", { count: connections.length });
  const collectionModeLabel = syncParams.comment_sample_mode === "all"
    ? t("collectionFull")
    : t("collectionEngagement");
  const periodLabel = syncParams.since_date
    ? t("scope.sinceDate", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
          new Date(`${syncParams.since_date}T12:00:00`),
        ),
      })
    : t("scope.noStartDate");
  const frequencyLabel = collectionLimits?.sync_frequency === "daily"
    ? t("frequencies.daily")
    : collectionLimits?.sync_frequency === "weekly"
      ? t("frequencies.weekly")
      : t("frequencies.notDeclared");
  const targetCount = preparedConnection ? 1 : connections.length;
  const theoreticalComments = syncParams.max_posts
    * syncParams.max_comments_per_post
    * targetCount;
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const previewCost = collectionPreview
    ? collectionPreview.operational_cost_brl_min === collectionPreview.operational_cost_brl_max
      ? currencyFormatter.format(collectionPreview.operational_cost_brl_max)
      : `${currencyFormatter.format(collectionPreview.operational_cost_brl_min)}–${currencyFormatter.format(collectionPreview.operational_cost_brl_max)}`
    : null;
  const preparedSyncing = preparedConnectionId === "all"
    ? connections.some(connection => syncing[connection.id])
    : Boolean(syncing[preparedConnectionId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("title")}</h1>
        <p className="mt-1" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t("subtitle")}</p>
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="primary" dot>{t("autoSyncActive")}</Badge>
        </div>
      </div>

      {/* Platforms */}
      <div>
        <p className="tracking-widest mb-4" style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.12em" }}>{t("addProfile")}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {platforms.map(p => (
            <div
              key={p.id}
              data-testid={`connect-platform-${p.id}`}
              data-status={p.capability.status}
              className="rounded-2xl p-5 transition-all"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", opacity: p.disabled ? 0.72 : 1 }}
            >
              <div className="mb-4 flex items-center gap-2">
                <GlassSocialIcon platform={p.id} size={44} />
                <PlatformCapabilityBadge platform={p.id} />
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{p.name}</h3>
              <p className="mb-4" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{p.desc}</p>

              {errors[p.id] && <p className="text-xs mb-2" style={{ color: "var(--sentiment-negative)" }}>{errors[p.id]}</p>}
              {success[p.id] && <p className="text-xs mb-2" style={{ color: "var(--sentiment-positive)" }}>{success[p.id]}</p>}

              {p.disabled ? (
                <Button variant="secondary" size="sm" fullWidth disabled>{tp(`statuses.${p.capability.status}`)}</Button>
              ) : <>
                  {p.hasInput && (
                    <input
                      type="text"
                      value={inputs[p.id] ?? ""}
                      onChange={(e) => {
                        setInputs(i => ({ ...i, [p.id]: e.target.value }));
                        if (potentials[p.id]) setPotentials(pt => ({ ...pt, [p.id]: null }));
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCheck(p.id); }}
                      placeholder={p.placeholder}
                      disabled={connecting[p.id] || checking[p.id]}
                      className="w-full px-3 py-2 rounded-xl transition-all mb-3"
                      style={{ fontSize: "0.78rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                    />
                  )}

                  {/* Profile preview */}
                  {potentials[p.id] && (
                    <div className="rounded-xl p-3 mb-3 space-y-2" style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center gap-2">
                        {potentials[p.id].profile_pic_url ? (
                          <img src={`/api/v1/posts/thumbnail?url=${encodeURIComponent(potentials[p.id].profile_pic_url)}`} className="w-8 h-8 rounded-full" alt="Foto" />
                        ) : (
                          <div className="w-8 h-8 rounded-full" style={{ backgroundColor: "var(--bg-hover)" }} />
                        )}
                        <div className="min-w-0">
                          <p className="truncate" style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>{potentials[p.id].fullName || potentials[p.id].username}</p>
                          <p style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>@{potentials[p.id].username}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{tc("followers")}</p>
                          <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>{potentials[p.id].followers_count?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>{tc("posts")}</p>
                          <p style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-primary)" }}>{potentials[p.id].media_count?.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!potentials[p.id] ? (
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={() => handleCheck(p.id)}
                      disabled={checking[p.id]}
                    >
                      {checking[p.id] ? t("verifying") : p.buttonText}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={() => handleConnect(p.id)}
                      disabled={connecting[p.id]}
                    >
                      {connecting[p.id] ? t("connecting") : t("confirmConnection")}
                    </Button>
                  )}

                  {p.secondaryButton && p.id === "instagram" && !potentials[p.id] && (
                    <button
                      onClick={() => handleOAuthConnect("instagram")}
                      disabled={connecting[p.id] || checking[p.id]}
                      className="w-full mt-2 py-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
                      style={{ fontSize: "0.78rem", fontWeight: 500 }}
                    >
                      {connecting["instagram"] ? t("connecting") : p.secondaryButton}
                    </button>
                  )}
                </>}
            </div>
          ))}
        </div>
        <div className="mt-5">
          <PlatformCapabilityMatrix surface="profiles" />
        </div>
      </div>

      {/* Config accordion */}
      {!loading && connections.length > 0 && (
        <div
          id="collection-settings"
          data-testid="collection-settings"
          className="scroll-mt-6 rounded-2xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="px-4 md:px-5 pt-4">
            <div
              data-testid="collection-plan-limits"
              className="px-4 py-3 rounded-xl flex items-start gap-3"
              style={{
                backgroundColor: limitsStatus === "error" ? "var(--sentiment-negative-bg)" : "var(--primary-bg)",
                border: `1px solid ${limitsStatus === "error" ? "var(--sentiment-negative)" : "color-mix(in srgb, var(--primary) 20%, transparent)"}`,
              }}
            >
              {limitsStatus === "error" ? (
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--sentiment-negative)" }} aria-hidden="true" />
              ) : (
                <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} aria-hidden="true" />
              )}
              <div style={{ fontSize: "0.75rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                {limitsStatus === "loading" && <p>{t("limits.loading")}</p>}
                {limitsStatus === "error" && (
                  <>
                    <p style={{ fontWeight: 600 }}>{t("limits.errorTitle")}</p>
                    <p style={{ color: "var(--text-muted)" }}>{t("limits.errorDescription")}</p>
                  </>
                )}
                {limitsStatus === "ready" && creditBalance && collectionLimits && (
                  <>
                    <p>
                      <span style={{ fontWeight: 600 }}>
                        {t("planCredits", { credits: numberFormatter.format(creditBalance.plan_allocation) })}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {t("remainingCredits", { credits: numberFormatter.format(creditBalance.total) })}
                      </span>
                    </p>
                    <p>{t("creditRule")}</p>
                    {["pro", "business", "admin", "enterprise"].includes(userPlan) && <p>{t("demographicRule")}</p>}
                    <p style={{ fontWeight: 600 }}>
                      {t("planCollectionLimits", {
                        posts: numberFormatter.format(collectionLimits.max_posts_per_sync),
                        comments: numberFormatter.format(collectionLimits.max_comments_per_post),
                        frequency: frequencyLabel,
                      })}
                    </p>
                    <p>
                      <Link href="/dashboard/settings?tab=billing" style={{ color: "var(--primary)", fontWeight: 500 }}>
                        {userPlan === "free" ? t("upgradePlan") : t("manageCredits")}
                      </Link>
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="collection-settings-toggle"
            aria-expanded={configOpen}
            aria-controls="collection-settings-panel"
            onClick={() => {
              if (!configOpen) setPreparedConnectionId("all");
              setConfigOpen(!configOpen);
            }}
            className="w-full flex items-center justify-between p-4 md:p-5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings2 className="w-4 h-4" style={{ color: "var(--primary)" }} aria-hidden="true" />
              <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{t("analysisSettings")}</span>
              <span className="hidden sm:inline" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t("analysisSettingsSub")}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${configOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
          </button>
          {configOpen && (
            <div id="collection-settings-panel" data-testid="collection-settings-panel" className="px-4 md:px-5 pb-5 space-y-5" style={{ borderTop: "1px solid var(--border)" }}>
              {limitsStatus === "ready" && collectionLimits ? (
                <>
                  <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="collection-post-limit" className="mb-2 block" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("postsToAnalyze")}</label>
                      <select
                        id="collection-post-limit"
                        data-testid="collection-post-limit"
                        value={syncParams.max_posts}
                        onChange={e => updateSyncParams({ ...syncParams, max_posts: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl transition-all"
                        style={{ fontSize: "0.78rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                      >
                        {postOptions.map(value => (
                          <option key={value} value={value}>
                            {value === collectionLimits.max_posts_per_sync
                              ? t("postsPlanLimit", { count: numberFormatter.format(value) })
                              : value === 1
                                ? t("postsOptions.1")
                                : t("postsOption", { count: numberFormatter.format(value) })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-2" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("commentsPerPost")}</p>
                      <div className="flex gap-2 flex-wrap" role="group" aria-label={t("commentsPerPost")}>
                        {commentOptions.map(value => (
                          <button
                            key={value}
                            type="button"
                            data-testid={value === collectionLimits.max_comments_per_post ? "collection-comment-limit-plan" : `collection-comment-limit-${value}`}
                            aria-pressed={syncParams.max_comments_per_post === value}
                            onClick={() => updateSyncParams({ ...syncParams, max_comments_per_post: value })}
                            className="px-3 py-2 rounded-xl transition-all"
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 500,
                              backgroundColor: syncParams.max_comments_per_post === value ? "var(--primary-bg)" : "var(--bg-subtle)",
                              color: syncParams.max_comments_per_post === value ? "var(--primary)" : "var(--text-muted)",
                              border: syncParams.max_comments_per_post === value ? "1px solid var(--primary)" : "1px solid var(--border)",
                            }}
                          >
                            {value === collectionLimits.max_comments_per_post
                              ? t("commentsPlanLimit", { count: numberFormatter.format(value) })
                              : numberFormatter.format(value)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="collection-since-date" className="mb-2 block" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("since")}</label>
                      <input
                        id="collection-since-date"
                        data-testid="collection-since-date"
                        type="date"
                        value={syncParams.since_date}
                        onChange={e => updateSyncParams({ ...syncParams, since_date: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl transition-all"
                        style={{ fontSize: "0.78rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }}
                      />
                      <p className="mt-2" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{t("sinceDescription")}</p>
                    </div>
                    <div>
                      <p className="mb-2" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("collectionMode")}</p>
                      <div className="flex gap-2 flex-wrap" role="group" aria-label={t("collectionMode")}>
                        {([
                          { label: t("collectionFull"), value: "all" as const },
                          { label: t("collectionEngagement"), value: "engagement" as const },
                        ]).map(option => (
                          <button
                            key={option.value}
                            type="button"
                            data-testid={`collection-mode-${option.value}`}
                            aria-pressed={syncParams.comment_sample_mode === option.value}
                            onClick={() => updateSyncParams({ ...syncParams, comment_sample_mode: option.value })}
                            className="px-3 py-2 rounded-xl transition-all"
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 500,
                              backgroundColor: syncParams.comment_sample_mode === option.value ? "var(--primary-bg)" : "var(--bg-subtle)",
                              color: syncParams.comment_sample_mode === option.value ? "var(--primary)" : "var(--text-muted)",
                              border: syncParams.comment_sample_mode === option.value ? "1px solid var(--primary)" : "1px solid var(--border)",
                            }}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p data-testid="collection-mode-description" className="mt-2" style={{ fontSize: "0.68rem", lineHeight: 1.5, color: "var(--text-faint)" }}>
                        {syncParams.comment_sample_mode === "all" ? t("collectionFullDesc") : t("collectionEngagementDesc")}
                      </p>
                    </div>
                  </div>

                  <section
                    data-testid="collection-scope-summary"
                    aria-labelledby="collection-scope-title"
                    className="rounded-2xl p-4 md:p-5"
                    style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start gap-3">
                      <CircleCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <h3 id="collection-scope-title" style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("scope.title")}</h3>
                        <p className="mt-1" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{t("scope.subtitle")}</p>
                        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {[
                            [t("scope.targetLabel"), targetLabel],
                            [t("scope.postsLabel"), t("scope.upToPosts", { count: numberFormatter.format(syncParams.max_posts) })],
                            [t("scope.commentsLabel"), t("scope.upToComments", { count: numberFormatter.format(syncParams.max_comments_per_post) })],
                            [t("scope.periodLabel"), periodLabel],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-faint)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</dt>
                              <dd className="mt-1" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>{value}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="mt-4" style={{ fontSize: "0.72rem", color: "var(--text-primary)", lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 700 }}>{t("scope.modeLabel")}: {collectionModeLabel}.</span>{" "}
                          <span data-testid="collection-volume-prediction">
                            {t("scope.maximum", { count: numberFormatter.format(theoreticalComments) })}
                          </span>
                        </p>
                        <p className="mt-1" style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                          {syncParams.comment_sample_mode === "all" ? t("scope.allOutcome") : t("scope.engagementOutcome")}
                        </p>

                        <div
                          data-testid="collection-forecast"
                          data-forecast-version={collectionPreview?.model_version ?? "unavailable"}
                          className="mt-5 pt-4"
                          style={{ borderTop: "1px solid var(--border)" }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                              {t("forecast.title")}
                            </h4>
                            {collectionPreview && (
                              <span style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>
                                {t(`forecast.confidence.${collectionPreview.forecast_confidence}`)}
                              </span>
                            )}
                          </div>

                          {previewStatus === "loading" && (
                            <p data-testid="collection-forecast-loading" className="mt-3" role="status" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                              {t("forecast.loading")}
                            </p>
                          )}
                          {previewStatus === "error" && (
                            <p data-testid="collection-forecast-error" className="mt-3" role="status" style={{ fontSize: "0.7rem", color: "var(--sentiment-negative)" }}>
                              {t("forecast.error")}
                            </p>
                          )}
                          {previewStatus === "ready" && collectionPreview && (
                            <>
                              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                <div data-testid="forecast-found">
                                  <dt style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("forecast.foundLabel")}</dt>
                                  <dd className="mt-1" style={{ fontSize: "0.75rem", fontWeight: 650, color: "var(--text-primary)", lineHeight: 1.4 }}>
                                    {collectionPreview.found_status === "unknown"
                                      ? t("forecast.foundUnknown")
                                      : t(`forecast.found.${collectionPreview.found_status}`, {
                                          comments: numberFormatter.format(collectionPreview.found_known_comments),
                                          knownPosts: numberFormatter.format(collectionPreview.posts_with_known_counts),
                                          posts: numberFormatter.format(collectionPreview.requested_post_slots),
                                        })}
                                  </dd>
                                </div>
                                <div data-testid="forecast-candidates">
                                  <dt style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("forecast.candidatesLabel")}</dt>
                                  <dd className="mt-1" style={{ fontSize: "0.75rem", fontWeight: 650, color: "var(--text-primary)", lineHeight: 1.4 }}>
                                    {t("forecast.upToComments", { count: numberFormatter.format(collectionPreview.estimated_candidate_comments_max) })}
                                  </dd>
                                </div>
                                <div data-testid="forecast-analyzed">
                                  <dt style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("forecast.analyzedLabel")}</dt>
                                  <dd className="mt-1" style={{ fontSize: "0.75rem", fontWeight: 650, color: "var(--text-primary)", lineHeight: 1.4 }}>
                                    {t("forecast.upToComments", { count: numberFormatter.format(collectionPreview.estimated_analyzed_comments_max) })}
                                  </dd>
                                </div>
                                <div data-testid="forecast-coverage">
                                  <dt style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("forecast.coverageLabel")}</dt>
                                  <dd className="mt-1" style={{ fontSize: "0.75rem", fontWeight: 650, color: "var(--text-primary)", lineHeight: 1.4 }}>
                                    {collectionPreview.estimated_coverage_pct === null
                                      ? t("forecast.coverageUnknown")
                                      : t("forecast.coverageValue", { value: collectionPreview.estimated_coverage_pct })}
                                  </dd>
                                </div>
                                <div data-testid="forecast-cost">
                                  <dt style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("forecast.costLabel")}</dt>
                                  <dd className="mt-1" style={{ fontSize: "0.75rem", fontWeight: 650, color: "var(--text-primary)", lineHeight: 1.4 }}>
                                    {previewCost}
                                  </dd>
                                </div>
                                <div data-testid="forecast-duration">
                                  <dt style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("forecast.durationLabel")}</dt>
                                  <dd className="mt-1" style={{ fontSize: "0.75rem", fontWeight: 650, color: "var(--text-primary)", lineHeight: 1.4 }}>
                                    {t("forecast.durationValue", {
                                      min: collectionPreview.duration_minutes_min,
                                      max: collectionPreview.duration_minutes_max,
                                    })}
                                  </dd>
                                </div>
                              </dl>

                              <div data-testid="forecast-explanation" className="mt-4 space-y-1.5" style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                                <p>
                                  {syncParams.comment_sample_mode === "engagement"
                                    ? collectionPreview.selection_applies_to_profiles > 0
                                      ? t("forecast.engagementApplied", {
                                          count: collectionPreview.selection_applies_to_profiles,
                                          limit: collectionPreview.engagement_priority_max_per_post,
                                        })
                                      : t("forecast.engagementNotApplied")
                                    : t("forecast.allApplied")}
                                </p>
                                <p>{syncParams.since_date ? t("forecast.periodApplied") : t("forecast.periodOpen")}</p>
                                <p>{t("forecast.costDisclosure")}</p>
                                <p>{t("forecast.unknownDisclosure")}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{t("scope.confirmation")}</p>
                    <Button
                      data-testid="collection-start"
                      variant="primary"
                      size="sm"
                      onClick={handlePreparedSync}
                      disabled={preparedSyncing}
                    >
                      {preparedSyncing ? t("startingCollection") : t("startCollection")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="pt-5" role="status">
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {limitsStatus === "loading" ? t("limits.loading") : t("limits.blocked")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Connected table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="tracking-widest" style={{ fontSize: "0.65rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.12em" }}>{t("connectedProfiles")}</p>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t("profileCount", { count: connections.length })}</span>
        </div>

        {loading ? (
          <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--bg-subtle)" }} />)}
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-2xl p-16 flex flex-col items-center text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t("noProfilesYet")}</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-x-auto" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <table aria-label={t("table.ariaLabel")} className="w-full min-w-[1120px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {[t("table.profile"), t("table.followers"), t("table.executions"), t("table.status"), t("table.autoSync"), t("table.actions")].map(h => (
                    <th key={h} className="px-5 py-3 text-left" style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {connections.map(conn => {
                  const healthState = conn.health?.state ?? "never_synced";
                  const healthVisual = HEALTH_VISUALS[healthState];
                  const healthyWithoutAnalysis = healthState === "healthy" && conn.health?.last_attempt_valid_count === 0;
                  const HealthIcon = healthyWithoutAnalysis ? TriangleAlert : healthVisual.icon;
                  const healthLabelKey = healthyWithoutAnalysis ? "health.states.healthyWithoutAnalysis.label" : healthVisual.labelKey;
                  const reasonKey = healthyWithoutAnalysis
                    ? "health.reasons.healthy_without_analysis"
                    : HEALTH_REASON_KEYS[conn.health?.reason_code ?? "never_synced"] ?? HEALTH_REASON_KEYS.never_synced;
                  const isSyncing = Boolean(syncing[conn.id] || conn.health?.is_syncing);
                  const lastSuccessAt = conn.health?.last_success_at ?? conn.last_sync_at;
                  const lastAttemptAt = conn.health?.last_attempt_at ?? null;
                  const lastAttemptStatus = conn.health?.last_attempt_status ?? null;
                  const attemptStatusKey = lastAttemptStatus ? ATTEMPT_STATUS_KEYS[lastAttemptStatus] : null;
                  const nextScheduledAt = conn.health?.next_scheduled_at ?? null;

                  return (
                  <tr
                    key={conn.id}
                    data-testid={`connection-health-row-${conn.id}`}
                    data-registration-status={conn.status}
                    data-health-state={healthState}
                    data-last-attempt-at={lastAttemptAt ?? "never"}
                    data-last-success-at={lastSuccessAt ?? "never"}
                    data-next-scheduled-at={nextScheduledAt ?? "not_scheduled"}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <GlassSocialIcon platform={conn.platform} size={32} />
                        <div>
                          <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{conn.username.startsWith("@") ? conn.username : `@${conn.username}`}</p>
                          {conn.display_name && <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{conn.display_name}</p>}
                          <p style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                            {conn.status === "active" ? t("registration.connected") : t("registration.needsAttention")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4" style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>
                      {conn.followers_count > 0 ? conn.followers_count.toLocaleString("pt-BR") : "\u2014"}
                    </td>
                    <td className="px-5 py-4">
                      <dl
                        data-testid={`connection-freshness-${conn.id}`}
                        data-contrast-scope="connection-freshness"
                        className="min-w-[250px] space-y-2.5"
                        aria-label={t("health.freshnessSummary", { username: conn.username })}
                      >
                        <div
                          data-testid={`connection-last-success-${conn.id}`}
                          className="rounded-xl px-3 py-2"
                          style={{
                            backgroundColor: lastSuccessAt ? "var(--bg-subtle)" : "var(--sentiment-negative-bg)",
                            border: `1px solid ${lastSuccessAt ? "var(--border)" : "color-mix(in srgb, var(--sentiment-negative) 30%, var(--border))"}`,
                          }}
                        >
                          <dt data-contrast-role="critical-label" style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-muted)", letterSpacing: "0.055em", textTransform: "uppercase" }}>
                            {t("health.freshnessLastSuccess")}
                          </dt>
                          <dd data-contrast-role="critical-value" className="mt-1" style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.45 }}>
                            {lastSuccessAt ? formatExecutionDate(lastSuccessAt, locale) : t("health.noSuccessfulSync")}
                          </dd>
                          {lastSuccessAt && (
                            <dd style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.45 }}>{formatRelativeExecution(lastSuccessAt, locale)}</dd>
                          )}
                        </div>
                        <div className="px-3">
                          <dt data-contrast-role="critical-label" style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.055em", textTransform: "uppercase" }}>
                            {t("health.lastAttempt")}
                          </dt>
                          <dd data-contrast-role="critical-value" className="mt-1" style={{ fontSize: "0.8125rem", color: "var(--text-primary)", lineHeight: 1.45 }}>
                            {lastAttemptAt ? formatExecutionDate(lastAttemptAt, locale) : t("health.noAttempt")}
                            {attemptStatusKey && (
                              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}> · {t(attemptStatusKey)}</span>
                            )}
                          </dd>
                          {lastAttemptAt && (
                            <dd style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.45 }}>{formatRelativeExecution(lastAttemptAt, locale)}</dd>
                          )}
                        </div>
                        <div className="px-3">
                          <dt data-contrast-role="critical-label" style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.055em", textTransform: "uppercase" }}>
                            {t("health.nextExecution")}
                          </dt>
                          <dd data-contrast-role="critical-value" className="mt-1" style={{ fontSize: "0.8125rem", color: "var(--text-primary)", lineHeight: 1.45 }}>
                            {nextScheduledAt ? formatExecutionDate(nextScheduledAt, locale) : t("health.notScheduled")}
                          </dd>
                          {nextScheduledAt && (
                            <dd style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.45 }}>{formatRelativeExecution(nextScheduledAt, locale)}</dd>
                          )}
                        </div>
                      </dl>
                    </td>
                    <td className="px-5 py-4">
                      <div
                        className="flex max-w-[290px] flex-col items-start gap-1.5"
                        role="status"
                        aria-label={`${t(healthLabelKey)}. ${t(reasonKey)}`}
                      >
                        <Badge variant={isSyncing ? "primary" : healthyWithoutAnalysis ? "warning" : healthVisual.variant}>
                          {isSyncing ? (
                            <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <HealthIcon className="h-3 w-3" aria-hidden="true" />
                          )}
                          {isSyncing ? t("health.syncing") : t(healthLabelKey)}
                        </Badge>
                        <p data-contrast-role="critical-value" style={{ fontSize: "0.75rem", lineHeight: 1.5, color: "var(--text-muted)" }}>
                          {t(reasonKey)}
                        </p>
                        {healthState === "healthy" && !healthyWithoutAnalysis ? (
                          <Link
                            href={`/dashboard/profile/${conn.id}`}
                            className="rounded underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2"
                            style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)" }}
                          >
                            {t(healthVisual.actionKey)}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openSyncConfiguration(conn.id)}
                            disabled={isSyncing}
                            className="rounded text-left underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 disabled:opacity-60"
                            style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)" }}
                          >
                            {isSyncing ? t("health.syncing") : t("configureCollection")}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={conn.auto_sync}
                        onClick={() => handleToggleAutoSync(conn.id, conn.auto_sync)}
                        disabled={togglingSync[conn.id]}
                        aria-label={conn.auto_sync ? `Pausar sync automática de @${conn.username}` : `Ativar sync automática de @${conn.username}`}
                        title={conn.auto_sync ? "Pausar sync automática" : "Ativar sync automática"}
                        className="w-10 rounded-full relative transition-colors disabled:opacity-50"
                        style={{ height: 22, backgroundColor: conn.auto_sync ? "var(--primary)" : "var(--bg-subtle)", border: conn.auto_sync ? "none" : "1px solid var(--border)" }}
                      >
                        <div className={`absolute top-0.5 w-[18px] h-[18px] rounded-full transition-all ${conn.auto_sync ? "left-[20px]" : "left-0.5"}`} style={{ backgroundColor: "var(--bg-card)" }} />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/profile/${conn.id}`} className="p-1.5 rounded-lg transition-colors" aria-label={`Ver análise de @${conn.username}`} title="Ver análise">
                          <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => openSyncConfiguration(conn.id)}
                          disabled={syncing[conn.id]}
                          className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
                          aria-label={t("configureCollectionFor", { username: conn.username })}
                          title={t("configureCollection")}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncing[conn.id] ? "animate-spin" : ""}`} style={{ color: "var(--text-muted)" }} />
                        </button>
                        <button onClick={() => setConfirmDelete(conn.id)} className="p-1.5 rounded-lg transition-colors" aria-label={`Remover @${conn.username}`} title="Remover perfil">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync estimate banner */}
      {syncEstimate.show && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 max-w-md w-full text-center relative" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 20px 60px -15px rgba(0,0,0,0.2)" }}>
            <button
              type="button"
              onClick={() => setSyncEstimate(e => ({ ...e, show: false }))}
              aria-label={tc("close")}
              className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
              style={{ color: "var(--text-faint)" }}
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--primary-bg)" }}>
              <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
            </div>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
              {t("syncEstimate.title")}
            </h3>
            <p className="mb-4" style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              {t("syncEstimate.description", { username: syncEstimate.username })}
            </p>
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl mb-4" style={{ backgroundColor: "var(--primary-bg)" }}>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.3rem", fontWeight: 700, color: "var(--primary)" }}>
                {syncEstimate.minMinutes === syncEstimate.maxMinutes
                  ? `~${syncEstimate.minMinutes} min`
                  : `${syncEstimate.minMinutes}-${syncEstimate.maxMinutes} min`}
              </span>
            </div>
            <p className="mb-5" style={{ fontSize: "0.72rem", color: "var(--text-faint)", lineHeight: 1.5 }}>
              {t("syncEstimate.steps")}
            </p>
            <Button variant="primary" size="sm" onClick={() => setSyncEstimate(e => ({ ...e, show: false }))}>
              {t("syncEstimate.ok")}
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-2xl p-8 max-w-sm w-full" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>{t("removeProfile")}</h3>
            <p className="mb-6" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{t("removeWarning")}</p>
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(null)}>{tc("cancel")}</Button>
              <Button variant="danger" fullWidth onClick={() => handleDelete(confirmDelete)}>{t("remove")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
