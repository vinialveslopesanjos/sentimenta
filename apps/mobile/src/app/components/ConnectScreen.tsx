import React, { useState } from "react";
import { useNavigate } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { connections } from "./mockData";
import {
  Instagram,
  Youtube,
  ChevronDown,
  ChevronUp,
  BarChart3,
  RefreshCw,
  Trash2,
  Clock,
  Settings2,
  Zap,
} from "lucide-react";

export function ConnectScreen() {
  const navigate = useNavigate();
  const [showConfig, setShowConfig] = useState(false);
  const [postsOption, setPostsOption] = useState("Todos (1200)");
  const [commentsOption, setCommentsOption] = useState("Todos (5000)");
  const [connecting, setConnecting] = useState(false);

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

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
          Conecte suas fontes de dados para analise.
        </p>
      </div>

      <div className="px-5 mt-4 space-y-5">
        {/* Sync badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 rounded-2xl">
          <Zap size={14} className="text-cyan-500" />
          <span className="text-cyan-700" style={{ fontSize: "12px", fontWeight: 500 }}>
            Sincronizacao automatica ativa
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
                Perfil publico buscavel sem login
              </p>
              <input
                placeholder="@usuario"
                className="w-full mt-3 px-3 py-2 bg-slate-50 rounded-xl text-center text-slate-600 placeholder-slate-300 border border-transparent focus:border-violet-200 focus:outline-none"
                style={{ fontSize: "12px" }}
              />
              <button
                onClick={() => {
                  setConnecting(true);
                  setTimeout(() => setConnecting(false), 2000);
                }}
                className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-white active:scale-[0.98] transition-transform"
                style={{ fontSize: "13px", fontWeight: 500 }}
              >
                {connecting ? "Conectando..." : "Conectar"}
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
                Analise de comentarios em videos
              </p>
              <input
                placeholder="@canal ou URL"
                className="w-full mt-3 px-3 py-2 bg-slate-50 rounded-xl text-center text-slate-600 placeholder-slate-300 border border-transparent focus:border-violet-200 focus:outline-none"
                style={{ fontSize: "12px" }}
              />
              <button
                className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 text-white active:scale-[0.98] transition-transform"
                style={{ fontSize: "13px", fontWeight: 500 }}
              >
                Conectar
              </button>
            </DreamCard>
          </div>

          {/* TikTok coming soon */}
          <DreamCard className="mt-3 p-4 flex items-center gap-3 opacity-50">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <span style={{ fontSize: "16px" }}>🎵</span>
            </div>
            <div>
              <span className="text-slate-500" style={{ fontSize: "13px", fontWeight: 500 }}>TikTok</span>
              <p className="text-slate-300" style={{ fontSize: "11px" }}>Em Breve</p>
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
                  {["Ultimos 10", "Ultimos 50", "Todos (1200)"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPostsOption(opt)}
                      className={`px-3 py-1.5 rounded-xl transition-colors ${postsOption === opt
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
                  Comentarios por post
                </p>
                <div className="flex gap-2">
                  {["10", "100", "Todos (5000)"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setCommentsOption(opt)}
                      className={`px-3 py-1.5 rounded-xl transition-colors ${commentsOption === opt
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
              {connections.length} perfil(is)
            </span>
          </div>

          <div className="space-y-3">
            {connections.map((conn) => (
              <DreamCard key={conn.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-slate-50 shadow-sm overflow-hidden flex-shrink-0">
                    <img src={`/icons/${conn.platform === "twitter" ? "twitter-x" : conn.platform}.svg`} alt={conn.platform} className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-700" style={{ fontSize: "14px", fontWeight: 500 }}>
                      {conn.username}
                    </p>
                    <p className="text-slate-400" style={{ fontSize: "11px" }}>
                      {conn.followers.toLocaleString()} seguidores
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-emerald-600" style={{ fontSize: "10px", fontWeight: 500 }}>Ativo</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-400 mb-3" style={{ fontSize: "11px" }}>
                  <Clock size={12} />
                  Ultimo sync: {conn.lastSync}
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
                    className="py-2 px-3 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center active:scale-[0.98] transition-transform"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="py-2 px-3 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center active:scale-[0.98] transition-transform"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </DreamCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}