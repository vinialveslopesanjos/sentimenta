"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import { publicApi } from "@/lib/api";
import { getScoreStyle } from "@/components/ds/tokens";
import type { PreviewResult, PreviewPost } from "@/lib/types";

type Platform = "youtube" | "instagram";

const EMOTION_EMOJI: Record<string, string> = {
  alegria: "😊", joy: "😊",
  raiva: "😠", anger: "😠",
  tristeza: "😢", sadness: "😢",
  medo: "😨", fear: "😨",
  amor: "❤️", love: "❤️",
  nojo: "🤢", disgust: "🤢",
  surpresa: "😮", surprise: "😮",
  neutro: "😐", neutral: "😐",
};

function ScoreGauge({ score, size = 56 }: { score: number; size?: number }) {
  const style = getScoreStyle(score);
  const dash = (score / 10) * 240;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--bg-subtle)" strokeWidth="8" />
        <circle cx="50" cy="50" r="38" fill="none" stroke={style.color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${dash} ${240 - dash}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: "'Outfit', sans-serif", fontSize: size > 60 ? "1.2rem" : "0.95rem", fontWeight: 700, color: style.color }}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}

function PostCard({ post }: { post: PreviewPost }) {
  const total = post.sentiment_split.positive + post.sentiment_split.neutral + post.sentiment_split.negative || 1;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  const emoji = post.top_emotion ? (EMOTION_EMOJI[post.top_emotion.toLowerCase()] ?? "💬") : "💬";
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3">
        {post.thumbnail_url ? (
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: "var(--bg-subtle)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/v1/posts/thumbnail?url=${encodeURIComponent(post.thumbnail_url)}`} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-subtle)", fontSize: "1.3rem" }}>{emoji}</div>
        )}
        <p className="flex-1 min-w-0 text-sm" style={{ color: "var(--text-primary)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {post.caption || "Post"}
        </p>
        <ScoreGauge score={post.avg_score} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-lg">{emoji}</span>
        <div className="flex-1 h-2.5 rounded-full overflow-hidden flex" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <div style={{ width: pct(post.sentiment_split.positive), backgroundColor: "var(--sentiment-positive, #22c55e)" }} />
          <div style={{ width: pct(post.sentiment_split.neutral), backgroundColor: "var(--text-faint)" }} />
          <div style={{ width: pct(post.sentiment_split.negative), backgroundColor: "var(--sentiment-negative, #b6496b)" }} />
        </div>
        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{post.analyzed_comments} com.</span>
      </div>
    </div>
  );
}

interface Props {
  /** Se passado, roda a prévia direto (página compartilhável). */
  initial?: { platform: Platform; handle: string };
  /** Resultado pré-carregado (server-side na página /preview). */
  initialResult?: PreviewResult | null;
  compact?: boolean;
}

export default function SentimentPreview({ initial, initialResult, compact }: Props) {
  const [platform, setPlatform] = useState<Platform>(initial?.platform ?? "youtube");
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(initialResult ?? null);
  const [error, setError] = useState<string | null>(null);

  async function run(p: Platform, h: string) {
    const clean = h.trim().replace(/^@/, "");
    if (!clean) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await publicApi.preview(p, clean);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não conseguimos analisar esse perfil agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[560px] mx-auto">
      {/* Input */}
      <div className="rounded-2xl p-2 flex items-center gap-2" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 8px 32px -16px rgba(0,0,0,0.25)" }}>
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value as Platform)}
          className="rounded-xl px-2 py-2.5 text-sm shrink-0"
          style={{ backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "none" }}
          aria-label="Plataforma"
        >
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
        </select>
        <div className="flex-1 flex items-center gap-1">
          <span style={{ color: "var(--text-faint)", fontSize: "1rem" }}>@</span>
          <input
            value={handle}
            onChange={e => setHandle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && run(platform, handle)}
            placeholder="seu_perfil"
            className="w-full bg-transparent outline-none text-base"
            style={{ color: "var(--text-primary)" }}
            aria-label="Seu @"
          />
        </div>
        <button
          onClick={() => run(platform, handle)}
          disabled={loading || !handle.trim()}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
          style={{ backgroundColor: "var(--primary)" }}
        >
          {loading ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-4 h-4 border-2 rounded-full" style={{ borderColor: "white", borderTopColor: "transparent" }} />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Analisar</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2 py-8">
            <Sparkles className="w-6 h-6 animate-pulse" style={{ color: "var(--primary)" }} />
            <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
              Coletando os comentários e lendo o sentimento com IA... leva alguns segundos.
            </p>
          </motion.div>
        )}

        {error && !loading && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 px-4 mt-4 rounded-2xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</p>
          </motion.div>
        )}

        {result && !loading && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            {/* Cabeçalho do perfil + score geral */}
            <div className="flex items-center gap-4 mb-5 rounded-2xl p-4" style={{ background: "linear-gradient(135deg, var(--primary-bg), transparent)" }}>
              {result.profile.profile_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/v1/posts/thumbnail?url=${encodeURIComponent(result.profile.profile_image_url)}`} alt="" className="w-14 h-14 rounded-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : null}
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{result.profile.display_name || result.handle}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {result.profile.followers_count ? `${result.profile.followers_count.toLocaleString("pt-BR")} seguidores` : result.handle}
                </p>
              </div>
              {result.overall_score !== null && (
                <div className="text-center shrink-0">
                  <ScoreGauge score={result.overall_score} size={64} />
                  <p className="text-[0.6rem] mt-1" style={{ color: "var(--text-muted)" }}>REPUTAÇÃO</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {result.posts.map((post, i) => <PostCard key={i} post={post} />)}
            </div>

            {/* CTA — o gancho de conversão */}
            <div className="mt-6 text-center rounded-2xl p-5" style={{ background: "linear-gradient(135deg, #0e2325, #1d4649)" }}>
              <p className="text-white font-semibold mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Isso é só uma amostra. 👀
              </p>
              <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.7)" }}>
                Veja todos os posts, o histórico completo e receba alertas quando o clima mudar.
              </p>
              <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm" style={{ backgroundColor: "white", color: "#0e2325" }}>
                Criar minha conta <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
