import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { api } from "../../lib/api";
import type { Connection } from "@sentimenta/types";
import {
  ChevronDown,
  ChevronUp,
  BarChart3,
  RefreshCw,
  Trash2,
  Clock,
  Settings2,
  Zap,
  Loader2,
} from "lucide-react";

function formatSyncTime(iso: string | null): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

function statusBadge(status: string, platform?: string) {
  if (platform === "twitter") {
    // Coleta do Twitter está desligada no pipeline (twitter_disabled)
    return {
      bg: "bg-slate-50",
      dot: "bg-slate-400",
      text: "text-slate-500",
      label: "Indisponível",
    };
  }
  if (status === "active") {
    return {
      bg: "bg-emerald-50",
      dot: "bg-emerald-400",
      text: "text-emerald-600",
      label: "Ativo",
    };
  }
  if (status === "syncing") {
    return {
      bg: "bg-amber-50",
      dot: "bg-amber-400",
      text: "text-amber-600",
      label: "Sincronizando",
    };
  }
  return {
    bg: "bg-slate-50",
    dot: "bg-slate-400",
    text: "text-slate-500",
    label: status,
  };
}

export function ConnectScreen() {
  const navigate = useNavigate();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [igUsername, setIgUsername] = useState("");
  const [ytHandle, setYtHandle] = useState("");
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [postsOption, setPostsOption] = useState("Todos");
  const [commentsOption, setCommentsOption] = useState("Todos");

  const fetchConnections = async () => {
    try {
      const data = await api.connections.list();
      setConnections(data);
    } catch {
      // silently fail, list will be empty
    } finally {
      setLoadingConns(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  // Auto-clear feedback after 4s
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleConnectInstagram = async () => {
    const username = igUsername.trim().replace(/^@/, "");
    if (!username) return;
    try {
      setConnectingPlatform("instagram");
      await api.connections.connectInstagram(username);
      setIgUsername("");
      setFeedback({ type: "success", msg: `@${username} conectado!` });
      await fetchConnections();
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Erro ao conectar Instagram" });
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleConnectYoutube = async () => {
    const handle = ytHandle.trim().replace(/^@/, "");
    if (!handle) return;
    try {
      setConnectingPlatform("youtube");
      await api.connections.connectYoutube(handle);
      setYtHandle("");
      setFeedback({ type: "success", msg: `@${handle} conectado!` });
      await fetchConnections();
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Erro ao conectar YouTube" });
    } finally {
      setConnectingPlatform(null);
    }
  };

  const handleSync = async (connId: string) => {
    try {
      setSyncingId(connId);
      await api.connections.sync(connId);
      setFeedback({ type: "success", msg: "Sincronização iniciada!" });
      await fetchConnections();
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Erro ao sincronizar" });
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (conn: Connection) => {
    if (!window.confirm(`Remover @${conn.username}? Todos os dados serao perdidos.`)) return;
    try {
      await api.connections.delete(conn.id);
      setFeedback({ type: "success", msg: `@${conn.username} removido.` });
      setConnections((prev) => prev.filter((c) => c.id !== conn.id));
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Erro ao remover" });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`mx-5 mt-2 px-4 py-2.5 rounded-2xl ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-600"
          }`}
          style={{ fontSize: "13px" }}
        >
          {feedback.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "26px",
            fontWeight: 500,
            color: "#334155",
            lineHeight: 1.2,
          }}
        >
          Conectar Perfis
        </h1>
        <p className="text-slate-400 mt-1" style={{ fontSize: "13px" }}>
          Conecte suas fontes de dados para análise.
        </p>
      </div>

      <div className="px-5 mt-4 space-y-5">
        {/* Sync badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 rounded-2xl">
          <Zap size={14} className="text-cyan-500" />
          <span className="text-cyan-700" style={{ fontSize: "12px", fontWeight: 500 }}>
            Sincronização automática ativa
          </span>
        </div>

        {/* Add platforms */}
        <div>
          <p
            className="text-slate-300 mb-3"
            style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em" }}
          >
            Adicionar Perfil
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Instagram */}
            <DreamCard className="p-5 flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-50 shadow-sm flex items-center justify-center mb-3 overflow-hidden flex-shrink-0">
                <img src="/icons/instagram.svg" alt="Instagram" className="w-7 h-7" />
              </div>
              <span
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 500, color: "#334155" }}
              >
                Instagram
              </span>
              <p className="text-slate-400 text-center mt-1" style={{ fontSize: "10px" }}>
                Perfil público buscável sem login
              </p>
              <input
                placeholder="@usuario"
                value={igUsername}
                onChange={(e) => setIgUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnectInstagram()}
                className="w-full mt-3 px-3 py-2 bg-slate-50 rounded-xl text-center text-slate-600 placeholder-slate-300 border border-transparent focus:border-violet-200 focus:outline-none"
                style={{ fontSize: "12px" }}
              />
              <button
                onClick={handleConnectInstagram}
                disabled={connectingPlatform === "instagram" || !igUsername.trim()}
                className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-white active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ fontSize: "13px", fontWeight: 500 }}
              >
                {connectingPlatform === "instagram" ? "Conectando..." : "Conectar"}
              </button>
            </DreamCard>

            {/* YouTube */}
            <DreamCard className="p-5 flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-50 shadow-sm flex items-center justify-center mb-3 overflow-hidden flex-shrink-0">
                <img src="/icons/youtube.svg" alt="YouTube" className="w-7 h-7" />
              </div>
              <span
                style={{ fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 500, color: "#334155" }}
              >
                YouTube
              </span>
              <p className="text-slate-400 text-center mt-1" style={{ fontSize: "10px" }}>
                Análise de comentários em vídeos
              </p>
              <input
                placeholder="@canal ou URL"
                value={ytHandle}
                onChange={(e) => setYtHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnectYoutube()}
                className="w-full mt-3 px-3 py-2 bg-slate-50 rounded-xl text-center text-slate-600 placeholder-slate-300 border border-transparent focus:border-violet-200 focus:outline-none"
                style={{ fontSize: "12px" }}
              />
              <button
                onClick={handleConnectYoutube}
                disabled={connectingPlatform === "youtube" || !ytHandle.trim()}
                className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-white active:scale-[0.98] transition-transform disabled:opacity-50"
                style={{ fontSize: "13px", fontWeight: 500 }}
              >
                {connectingPlatform === "youtube" ? "Conectando..." : "Conectar"}
              </button>
            </DreamCard>
          </div>

          {/* TikTok coming soon */}
          <DreamCard className="mt-3 p-4 flex items-center gap-3 opacity-50">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
              <img src="/icons/tiktok.svg" alt="TikTok" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-slate-500" style={{ fontSize: "13px", fontWeight: 500 }}>TikTok</span>
              <p className="text-slate-300" style={{ fontSize: "11px" }}>Em breve</p>
            </div>
          </DreamCard>
        </div>

        {/* Analysis Config */}
        <DreamCard className="overflow-hidden">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={16} className="text-violet-500" />
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#334155" }}>
                Configuracoes de Analise
              </span>
            </div>
            {showConfig ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </button>

          {showConfig && (
            <div className="px-4 pb-4 space-y-4">
              <div>
                <p className="text-slate-400 mb-2" style={{ fontSize: "11px", fontWeight: 500 }}>
                  Posts a analisar
                </p>
                <div className="flex gap-2">
                  {["10", "50", "Todos"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPostsOption(opt)}
                      className={`px-3 py-1.5 rounded-xl transition-colors ${
                        postsOption === opt
                          ? "bg-violet-500 text-white"
                          : "bg-slate-50 text-slate-500"
                      }`}
                      style={{ fontSize: "11px", fontWeight: 500 }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-slate-400 mb-2" style={{ fontSize: "11px", fontWeight: 500 }}>
                  Comentários por post
                </p>
                <div className="flex gap-2">
                  {["10", "100", "Todos"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setCommentsOption(opt)}
                      className={`px-3 py-1.5 rounded-xl transition-colors ${
                        commentsOption === opt
                          ? "bg-cyan-500 text-white"
                          : "bg-slate-50 text-slate-500"
                      }`}
                      style={{ fontSize: "11px", fontWeight: 500 }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-slate-400 mb-2" style={{ fontSize: "11px", fontWeight: 500 }}>
                  A partir de
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="dd/mm/aaaa"
                    className="flex-1 px-3 py-2 bg-slate-50 rounded-xl text-slate-600 placeholder-slate-300 border border-transparent focus:border-violet-200 focus:outline-none"
                    style={{ fontSize: "12px" }}
                  />
                  <Clock size={16} className="text-slate-300" />
                </div>
              </div>

              <button
                className="w-full py-3 rounded-xl bg-emerald-500 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                style={{ fontSize: "13px", fontWeight: 500 }}
              >
                <Zap size={14} />
                Adicionar novos dados
              </button>
            </div>
          )}
        </DreamCard>

        {/* Connected Profiles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p
              className="text-slate-300"
              style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em" }}
            >
              Perfis Conectados
            </p>
            <span className="text-slate-400" style={{ fontSize: "11px" }}>
              {loadingConns ? "..." : `${connections.length} perfil(is)`}
            </span>
          </div>

          {loadingConns ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="text-violet-400 animate-spin" />
            </div>
          ) : connections.length === 0 ? (
            <DreamCard className="p-6 text-center">
              <p className="text-slate-400" style={{ fontSize: "13px" }}>
                Nenhum perfil conectado ainda.
              </p>
            </DreamCard>
          ) : (
            <div className="space-y-3">
              {connections.map((conn) => {
                const badge = statusBadge(conn.status, conn.platform);
                return (
                  <DreamCard key={conn.id} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-slate-50 shadow-sm overflow-hidden flex-shrink-0">
                        {conn.profile_image_url ? (
                          <img
                            src={conn.profile_image_url}
                            alt={conn.username}
                            className="w-10 h-10 rounded-xl object-cover"
                          />
                        ) : (
                          <img
                            src={`/icons/${conn.platform === "twitter" ? "twitter-x" : conn.platform}.svg`}
                            alt={conn.platform}
                            className="w-6 h-6"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 truncate" style={{ fontSize: "14px", fontWeight: 500 }}>
                          @{conn.username}
                        </p>
                        <p className="text-slate-400" style={{ fontSize: "11px" }}>
                          {conn.followers_count.toLocaleString("pt-BR")} seguidores
                        </p>
                      </div>
                      <div className={`flex items-center gap-1 px-2 py-0.5 ${badge.bg} rounded-full`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span className={badge.text} style={{ fontSize: "10px", fontWeight: 500 }}>
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 mb-3" style={{ fontSize: "11px" }}>
                      <Clock size={12} />
                      Ultimo sync: {formatSyncTime(conn.last_sync_at)}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/dashboard/connection/${conn.id}`)}
                        className="flex-1 py-2 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
                        style={{ fontSize: "12px", fontWeight: 500 }}
                      >
                        <BarChart3 size={14} /> Analise
                      </button>
                      <button
                        onClick={() => handleSync(conn.id)}
                        disabled={syncingId === conn.id}
                        className="py-2 px-3 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center active:scale-[0.98] transition-transform disabled:opacity-50"
                      >
                        <RefreshCw
                          size={14}
                          className={syncingId === conn.id ? "animate-spin" : ""}
                        />
                      </button>
                      <button
                        onClick={() => handleDelete(conn)}
                        className="py-2 px-3 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center active:scale-[0.98] transition-transform"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </DreamCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
