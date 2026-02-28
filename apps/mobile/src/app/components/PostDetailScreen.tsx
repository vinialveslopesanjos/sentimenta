import React from "react";
import { useNavigate, useParams } from "react-router";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { postDetail, postComments, recentPosts } from "./mockData";
import {
  ArrowLeft,
  Heart,
  BarChart3,
  MessageSquare,
  TrendingDown,
  ExternalLink,
  Instagram,
  Search,
  Filter,
  ChevronDown,
} from "lucide-react";

export function PostDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const post = recentPosts.find((p) => p.id === id) || recentPosts[0];

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

      {/* Header */}
      <div className="px-5 pt-2 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-slate-400"
            style={{ fontSize: "13px" }}
          >
            <ArrowLeft size={16} />
            Voltar ao perfil
          </button>
          <span className="text-slate-300 mx-1">·</span>
          <span
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
          >
            Post
          </span>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* Post Header Card */}
        <DreamCard className="p-5 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-gradient-to-br from-cyan-50 to-violet-50 rounded-full blur-2xl opacity-60" />

          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
              <Instagram size={14} className="text-white" />
            </div>
            <div>
              <span className="text-slate-600" style={{ fontSize: "12px", fontWeight: 500 }}>
                {postDetail.platform} · {postDetail.type}
              </span>
            </div>
            <span className="text-slate-300 ml-auto" style={{ fontSize: "11px" }}>
              {postDetail.date}
            </span>
          </div>

          <p
            className="relative z-10"
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500, color: "#334155" }}
          >
            {post.title}
          </p>

          <div className="flex items-center gap-4 mt-3 relative z-10">
            <div className="flex items-center gap-1 text-slate-400">
              <Heart size={14} className="text-rose-400" />
              <span style={{ fontSize: "12px" }}>{postDetail.likes}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <MessageSquare size={14} className="text-cyan-400" />
              <span style={{ fontSize: "12px" }}>{postDetail.commentsCount} comentarios</span>
            </div>
          </div>

          <button className="flex items-center gap-1 mt-3 text-violet-500 relative z-10" style={{ fontSize: "12px", fontWeight: 500 }}>
            <ExternalLink size={13} />
            Ver no Instagram
          </button>
        </DreamCard>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <DreamCard className="p-4">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center mb-2">
              <Heart size={14} className="text-violet-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 500, color: "#06B6D4" }}>
              {postDetail.scoreMedio}
            </p>
            <p className="text-slate-400" style={{ fontSize: "10px" }}>Score medio</p>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center mb-2">
              <BarChart3 size={14} className="text-amber-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500, color: "#334155" }}>
              —
            </p>
            <p className="text-slate-400" style={{ fontSize: "10px" }}>Score predominante</p>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center mb-2">
              <MessageSquare size={14} className="text-emerald-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 500, color: "#334155" }}>
              {postDetail.comentariosAnalisados}
            </p>
            <p className="text-slate-400" style={{ fontSize: "10px" }}>Analisados</p>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center mb-2">
              <TrendingDown size={14} className="text-cyan-500" />
            </div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 500, color: "#334155" }}>
              {postDetail.polaridade}
            </p>
            <p className="text-slate-400" style={{ fontSize: "10px" }}>Polaridade</p>
          </DreamCard>
        </div>

        {/* Sentiment Distribution */}
        <DreamCard className="p-5">
          <p
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
            className="mb-3"
          >
            Distribuicao de Sentimento
          </p>
          <div className="flex rounded-xl overflow-hidden h-4 mb-3">
            <div
              className="bg-emerald-400 transition-all"
              style={{ width: `${postDetail.sentimentDist.positivo.percent}%` }}
            />
            <div
              className="bg-amber-400 transition-all"
              style={{ width: `${postDetail.sentimentDist.neutro.percent}%` }}
            />
            <div
              className="bg-rose-400 transition-all"
              style={{ width: `${postDetail.sentimentDist.negativo.percent}%` }}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-slate-500" style={{ fontSize: "11px" }}>
                Positivo <span className="text-emerald-500" style={{ fontWeight: 600 }}>{postDetail.sentimentDist.positivo.percent}%</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-slate-500" style={{ fontSize: "11px" }}>
                Neutro <span className="text-amber-500" style={{ fontWeight: 600 }}>{postDetail.sentimentDist.neutro.percent}%</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-slate-500" style={{ fontSize: "11px" }}>
                Negativo <span className="text-rose-500" style={{ fontWeight: 600 }}>{postDetail.sentimentDist.negativo.percent}%</span>
              </span>
            </div>
          </div>
        </DreamCard>

        {/* Emotions & Topics */}
        <div className="grid grid-cols-2 gap-3">
          <DreamCard className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span style={{ fontSize: "14px" }}>😊</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "#334155" }}>
                Emocoes
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {postDetail.emotions.map((e) => (
                <span
                  key={e}
                  className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-600"
                  style={{ fontSize: "11px", fontWeight: 500 }}
                >
                  {e}
                </span>
              ))}
            </div>
          </DreamCard>

          <DreamCard className="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span style={{ fontSize: "14px" }}>🏷️</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "#334155" }}>
                Topicos
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {postDetail.topics.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-600"
                  style={{ fontSize: "11px", fontWeight: 500 }}
                >
                  {t}
                </span>
              ))}
            </div>
          </DreamCard>
        </div>

        {/* Comments */}
        <div>
          <p
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "17px", fontWeight: 500, color: "#334155" }}
            className="mb-3"
          >
            Comentarios
          </p>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
              <Search size={14} className="text-slate-300" />
              <input
                placeholder="Buscar comentarios..."
                className="flex-1 bg-transparent text-slate-600 placeholder-slate-300 outline-none"
                style={{ fontSize: "12px" }}
              />
            </div>
            <button className="px-3 py-2 bg-slate-50 rounded-xl flex items-center gap-1 text-slate-500">
              <span style={{ fontSize: "11px" }}>Todos</span>
              <ChevronDown size={12} />
            </button>
          </div>

          <div className="space-y-2">
            {postComments.slice(0, 6).map((c) => (
              <DreamCard key={c.id} className="p-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex-shrink-0 mt-0.5 ${c.score >= 9
                        ? "text-emerald-500"
                        : c.score >= 7
                          ? "text-cyan-500"
                          : "text-amber-500"
                      }`}
                    style={{ fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 600 }}
                  >
                    {c.score.toFixed(1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-slate-600 truncate" style={{ fontSize: "12px", fontWeight: 500 }}>
                        {c.author}
                      </span>
                      {c.likes > 0 && (
                        <span className="flex items-center gap-0.5 text-slate-300" style={{ fontSize: "10px" }}>
                          <Heart size={10} /> {c.likes}
                        </span>
                      )}
                      <span className="text-slate-300 ml-auto" style={{ fontSize: "10px" }}>{c.date}</span>
                    </div>
                    <p className="text-slate-600 mb-1" style={{ fontSize: "12px" }}>
                      {c.text}
                    </p>
                    <p className="text-slate-400 mb-1.5" style={{ fontSize: "10px" }}>
                      IA: {c.aiNote}
                    </p>
                    <div className="flex gap-1">
                      <span
                        className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-600"
                        style={{ fontSize: "9px", fontWeight: 500 }}
                      >
                        {c.tag}
                      </span>
                    </div>
                  </div>
                </div>
              </DreamCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
