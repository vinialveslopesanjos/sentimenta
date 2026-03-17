"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, BarChart3, Trash2, ChevronDown, Settings2 } from "lucide-react";
import { connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  DEFAULT_SYNC_SETTINGS,
  loadSyncSettings,
  saveSyncSettings,
  toSyncPayload,
  type SyncSettings,
} from "@/lib/syncSettings";
import { relativeTime } from "@/lib/helpers";
import { track } from "@/lib/tracking";
import { Button } from "@/components/ds/Button";
import { Badge } from "@/components/ds/Badge";
import { GlassSocialIcon } from "@/components/GlassSocialIcons";

type Connection = {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  followers_count: number;
  status: string;
  connected_at: string;
  last_sync_at: string | null;
  auto_sync: boolean;
};

type PlatformId = "instagram" | "youtube" | "twitter" | "tiktok";

export default function ConnectPage() {
  const t = useTranslations("connect");
  const tc = useTranslations("common");
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
  }, [loadConnections]);

  const updateSyncParams = useCallback((next: SyncSettings) => {
    const saved = saveSyncSettings(next);
    setSyncParams(saved);
  }, []);

  const handleCheck = async (platformId: PlatformId) => {
    const handle = inputs[platformId]?.trim();
    if (!handle) {
      setErrors(e => ({ ...e, [platformId]: t("enterUserOrUrl") }));
      return;
    }
    if (platformId !== "instagram") {
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

  const handleSync = async (connId: string) => {
    const token = getToken()!;
    setSyncing(s => ({ ...s, [connId]: true }));
    track("sync_triggered", { connection_id: connId });
    try {
      await connectionsApi.sync(token, connId, toSyncPayload(syncParams));
    } finally {
      setTimeout(() => setSyncing(s => ({ ...s, [connId]: false })), 2500);
    }
  };

  const handleSyncAll = async () => {
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

  const platforms = [
    { id: "instagram" as PlatformId, name: t("platforms.instagram.name"), desc: t("platforms.instagram.desc"), placeholder: t("platforms.instagram.placeholder"), hasInput: true, buttonText: t("platforms.instagram.button"), secondaryButton: t("platforms.instagram.oauthButton") },
    { id: "youtube" as PlatformId, name: t("platforms.youtube.name"), desc: t("platforms.youtube.desc"), placeholder: t("platforms.youtube.placeholder"), hasInput: true, buttonText: t("platforms.youtube.button") },
    { id: "twitter" as PlatformId, name: t("platforms.twitter.name"), desc: t("platforms.twitter.desc"), placeholder: t("platforms.twitter.placeholder"), hasInput: true, buttonText: t("platforms.twitter.button") },
    { id: "tiktok" as PlatformId, name: t("platforms.tiktok.name"), desc: t("platforms.tiktok.desc"), placeholder: "", hasInput: false, buttonText: t("platforms.tiktok.button"), oauthOnly: true },
  ];

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
            <div key={p.id} className="rounded-2xl p-5 transition-all" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="mb-4">
                <GlassSocialIcon platform={p.id} size={44} />
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{p.name}</h3>
              <p className="mb-4" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{p.desc}</p>

              {errors[p.id] && <p className="text-xs mb-2" style={{ color: "var(--sentiment-negative)" }}>{errors[p.id]}</p>}
              {success[p.id] && <p className="text-xs mb-2" style={{ color: "var(--sentiment-positive)" }}>{success[p.id]}</p>}

              {p.oauthOnly ? (
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => handleOAuthConnect(p.id as "tiktok")}
                  disabled={connecting[p.id]}
                >
                  {connecting[p.id] ? t("connecting") : p.buttonText}
                </Button>
              ) : (
                <>
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

                  {p.secondaryButton && p.id === "instagram" && (
                    <button
                      onClick={() => handleOAuthConnect("instagram")}
                      disabled={connecting[p.id]}
                      className="w-full mt-2 py-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCAF45] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
                      style={{ fontSize: "0.78rem", fontWeight: 500 }}
                    >
                      {connecting["instagram"] ? t("connecting") : p.secondaryButton}
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Config accordion */}
      {!loading && connections.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <button onClick={() => setConfigOpen(!configOpen)} className="w-full flex items-center justify-between p-4 md:p-5 transition-colors">
            <div className="flex items-center gap-3">
              <Settings2 className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{t("analysisSettings")}</span>
              <span className="hidden sm:inline" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t("analysisSettingsSub")}</span>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${configOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
          </button>
          {configOpen && (
            <div className="px-4 md:px-5 pb-5 space-y-5" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <p className="mb-2" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("postsToAnalyze")}</p>
                  <div className="flex gap-2 flex-wrap">
                    {[{ label: t("lastOptions.last10"), value: 10 }, { label: t("lastOptions.last50"), value: 50 }, { label: t("lastOptions.all200"), value: 200 }].map(opt => (
                      <button key={opt.value} onClick={() => updateSyncParams({ ...syncParams, max_posts: opt.value })} className="px-3 py-2 rounded-xl transition-all" style={{ fontSize: "0.78rem", fontWeight: 500, backgroundColor: syncParams.max_posts === opt.value ? "var(--primary-bg)" : "var(--bg-subtle)", color: syncParams.max_posts === opt.value ? "var(--primary)" : "var(--text-muted)", border: syncParams.max_posts === opt.value ? "1px solid var(--primary)" : "1px solid var(--border)" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("commentsPerPost")}</p>
                  <div className="flex gap-2 flex-wrap">
                    {[{ label: t("commentsOptions.50"), value: 50 }, { label: t("commentsOptions.200"), value: 200 }, { label: tc("all"), value: 10000 }].map(opt => (
                      <button key={opt.value} onClick={() => updateSyncParams({ ...syncParams, max_comments_per_post: opt.value })} className="px-3 py-2 rounded-xl transition-all" style={{ fontSize: "0.78rem", fontWeight: 500, backgroundColor: syncParams.max_comments_per_post === opt.value ? "var(--primary-bg)" : "var(--bg-subtle)", color: syncParams.max_comments_per_post === opt.value ? "var(--primary)" : "var(--text-muted)", border: syncParams.max_comments_per_post === opt.value ? "1px solid var(--primary)" : "1px solid var(--border)" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {syncParams.comment_sample_mode === "sample" && syncParams.max_comments_per_post < 10000 && (
                    <p className="mt-2" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{t("sampleRecommendation")}</p>
                  )}
                </div>
                <div>
                  <p className="mb-2" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("since")}</p>
                  <input type="date" value={syncParams.since_date} onChange={e => updateSyncParams({ ...syncParams, since_date: e.target.value })} className="w-full px-3 py-2 rounded-xl transition-all" style={{ fontSize: "0.78rem", border: "1px solid var(--border)", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <p className="mb-2" style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.05em" }}>{t("collectionMode")}</p>
                  <div className="flex gap-2 flex-wrap">
                    {[{ label: t("collectionFull"), value: "all" as const }, { label: t("collectionSample"), value: "sample" as const }].map(opt => (
                      <button key={opt.value} onClick={() => updateSyncParams({ ...syncParams, comment_sample_mode: opt.value })} className="px-3 py-2 rounded-xl transition-all" style={{ fontSize: "0.78rem", fontWeight: 500, backgroundColor: syncParams.comment_sample_mode === opt.value ? "var(--primary-bg)" : "var(--bg-subtle)", color: syncParams.comment_sample_mode === opt.value ? "var(--primary)" : "var(--text-muted)", border: syncParams.comment_sample_mode === opt.value ? "1px solid var(--primary)" : "1px solid var(--border)" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {syncParams.comment_sample_mode === "sample" && (
                    <p className="mt-2" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{t("sampleDesc")}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="primary" size="sm" onClick={handleSyncAll}>{t("addNewData")}</Button>
              </div>
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
            <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {[t("table.profile"), t("table.followers"), t("table.lastSync"), t("table.status"), t("table.autoSync"), t("table.actions")].map(h => (
                    <th key={h} className="px-5 py-3 text-left" style={{ fontSize: "0.6rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {connections.map(conn => (
                  <tr key={conn.id} className="transition-colors" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <GlassSocialIcon platform={conn.platform} size={32} />
                        <div>
                          <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--text-primary)" }}>{conn.username.startsWith("@") ? conn.username : `@${conn.username}`}</p>
                          {conn.display_name && <p style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{conn.display_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4" style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>
                      {conn.followers_count > 0 ? conn.followers_count.toLocaleString("pt-BR") : "\u2014"}
                    </td>
                    <td className="px-5 py-4" style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{relativeTime(conn.last_sync_at)}</td>
                    <td className="px-5 py-4">
                      {syncing[conn.id] ? (
                        <Badge variant="primary" dot>{t("statusLabels.sync")}</Badge>
                      ) : conn.status === "active" ? (
                        <Badge variant="positive" dot>{t("statusLabels.active")}</Badge>
                      ) : (
                        <Badge variant="negative" dot>{t("statusLabels.error")}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleAutoSync(conn.id, conn.auto_sync)}
                        disabled={togglingSync[conn.id]}
                        className="w-10 rounded-full relative transition-colors disabled:opacity-50"
                        style={{ height: 22, backgroundColor: conn.auto_sync ? "var(--primary)" : "var(--bg-subtle)", border: conn.auto_sync ? "none" : "1px solid var(--border)" }}
                      >
                        <div className={`absolute top-0.5 w-[18px] h-[18px] rounded-full transition-all ${conn.auto_sync ? "left-[20px]" : "left-0.5"}`} style={{ backgroundColor: "var(--bg-card)" }} />
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <Link href={`/profile/${conn.id}`} className="p-1.5 rounded-lg transition-colors">
                          <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        </Link>
                        <button onClick={() => handleSync(conn.id)} disabled={syncing[conn.id]} className="p-1.5 rounded-lg transition-colors disabled:opacity-50">
                          <RefreshCw className={`w-3.5 h-3.5 ${syncing[conn.id] ? "animate-spin" : ""}`} style={{ color: "var(--text-muted)" }} />
                        </button>
                        <button onClick={() => setConfirmDelete(conn.id)} className="p-1.5 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
