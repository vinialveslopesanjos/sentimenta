"use client";

import { useEffect, useState } from "react";
import { dashboardApi, connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { ResponsiveContainer, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const EMOTION_EMOJI: Record<string, string> = {
  joy: "😊", happiness: "😊", sadness: "😢", anger: "😡", surprise: "😮",
  fear: "😰", disgust: "🤢", love: "❤️", trust: "🤝", gratitude: "🙏",
  frustration: "😤", excitement: "🎉", disappointment: "😞", humor: "😂",
  sarcasm: "😏", admiration: "🌟", curiosity: "🧐", hope: "🌈",
  enthusiasm: "🔥", amusement: "😄", concern: "😟", pride: "💪",
  confusion: "😕", inspiration: "✨", relief: "😌", anxiety: "😟",
};

type ConnectionOption = {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_image_url: string | null;
  status: string;
};

type CompareConnection = {
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
};

function scoreColor(score: number | null) {
  if (score === null) return "text-slate-300";
  if (score >= 7) return "text-emerald-500";
  if (score >= 4) return "text-amber-500";
  return "text-rose-500";
}

function EmotionBars({ emotions, label }: { emotions: Record<string, number>; label: string }) {
  const entries = Object.entries(emotions).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = entries.length > 0 ? entries[0][1] : 1;
  if (entries.length === 0) return <p className="text-sm text-slate-300">Sem dados</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400 font-medium mb-3">{label}</p>
      {entries.map(([emo, count]) => (
        <div key={emo} className="flex items-center gap-2">
          <span className="text-xs w-32 truncate text-slate-500">{EMOTION_EMOJI[emo] || "📊"} {emo}</span>
          <div className="flex-1 h-5 bg-slate-50 rounded-lg overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-lilac to-violet-300 rounded-lg transition-all"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}

function SentimentBar({ dist }: { dist: { positive: number; neutral: number; negative: number } }) {
  const total = dist.positive + dist.neutral + dist.negative;
  if (total === 0) return null;
  const pct = (v: number) => `${((v / total) * 100).toFixed(0)}%`;
  return (
    <div className="space-y-1">
      <div className="h-8 w-full rounded-xl overflow-hidden flex">
        {dist.positive > 0 && (
          <div className="h-full bg-emerald-400 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: pct(dist.positive) }}>
            😊 {pct(dist.positive)}
          </div>
        )}
        {dist.neutral > 0 && (
          <div className="h-full bg-slate-300 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: pct(dist.neutral) }}>
            😐 {pct(dist.neutral)}
          </div>
        )}
        {dist.negative > 0 && (
          <div className="h-full bg-rose-400 flex items-center justify-center text-[10px] text-white font-medium" style={{ width: pct(dist.negative) }}>
            😡 {pct(dist.negative)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [selectedA, setSelectedA] = useState("");
  const [selectedB, setSelectedB] = useState("");
  const [days, setDays] = useState(3650);
  const [data, setData] = useState<CompareConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSentiment, setShowSentiment] = useState(true);
  const [showEmotions, setShowEmotions] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [trendsA, setTrendsA] = useState<{data_points: any[]}>({ data_points: [] });
  const [trendsB, setTrendsB] = useState<{data_points: any[]}>({ data_points: [] });

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    connectionsApi.list(token).then((list) => {
      setConnections(list.filter((c) => c.status === "active"));
    });
  }, []);

  useEffect(() => {
    const ids = [selectedA, selectedB].filter(Boolean);
    if (ids.length === 0) { setData([]); return; }
    const token = getToken();
    if (!token) return;
    setLoading(true);
    dashboardApi.compareConnections(token, ids, days)
      .then((res) => setData(res.connections))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedA, selectedB, days]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (selectedA) {
      dashboardApi.trends(token, { connection_id: selectedA, granularity: "week", days }).then(setTrendsA).catch(() => {});
    } else {
      setTrendsA({ data_points: [] });
    }
    if (selectedB) {
      dashboardApi.trends(token, { connection_id: selectedB, granularity: "week", days }).then(setTrendsB).catch(() => {});
    } else {
      setTrendsB({ data_points: [] });
    }
  }, [selectedA, selectedB, days]);

  const connA = data.find((d) => d.connection_id === selectedA);
  const connB = data.find((d) => d.connection_id === selectedB);
  const activeConns = [connA, connB].filter(Boolean) as CompareConnection[];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-sans font-bold text-slate-800">Análise Comparativa</h1>
        <p className="text-sm text-slate-400 mt-1">Compare sentimentos e emoções entre perfis</p>
      </div>

      {/* Selectors */}
      <div className="dream-card p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">Perfil A</label>
            <select
              value={selectedA}
              onChange={(e) => setSelectedA(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:border-brand-lilac focus:ring-1 focus:ring-brand-lilac outline-none"
            >
              <option value="">Selecione um perfil...</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === selectedB}>
                  @{c.username} ({c.platform})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">Perfil B (opcional)</label>
            <select
              value={selectedB}
              onChange={(e) => setSelectedB(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:border-brand-lilac focus:ring-1 focus:ring-brand-lilac outline-none"
            >
              <option value="">Nenhum (mostrar só A)</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id} disabled={c.id === selectedA}>
                  @{c.username} ({c.platform})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Period + Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-100 overflow-hidden text-sm">
            {[
              { label: "30d", value: 30 },
              { label: "90d", value: 90 },
              { label: "1a", value: 365 },
              { label: "Tudo", value: 3650 },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setDays(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === p.value ? "bg-brand-lilac text-white" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {[
            { key: "sentiment", label: "Sentimento", state: showSentiment, set: setShowSentiment },
            { key: "emotions", label: "Emoções", state: showEmotions, set: setShowEmotions },
            { key: "volume", label: "Volume", state: showVolume, set: setShowVolume },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => t.set(!t.state)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                t.state ? "bg-violet-50 border-brand-lilac/30 text-brand-lilacDark" : "border-slate-200 text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-brand-lilac border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && activeConns.length === 0 && (
        <div className="dream-card p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-slate-200 mb-4 block">compare_arrows</span>
          <h3 className="text-lg font-medium text-slate-500">Selecione pelo menos um perfil</h3>
          <p className="text-sm text-slate-400 mt-1">Escolha perfis acima para visualizar a comparação de sentimentos</p>
        </div>
      )}

      {/* Comparison content */}
      {!loading && activeConns.length > 0 && (
        <div className="space-y-6">
          {/* Score Cards */}
          {showSentiment && (
            <div className={`grid gap-6 ${activeConns.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-lg"}`}>
              {activeConns.map((c) => (
                <div key={c.connection_id} className="dream-card p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    {c.profile_image_url && (
                      <img src={c.profile_image_url} alt="" className="w-10 h-10 rounded-full" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-700">@{c.username}</p>
                      <p className="text-xs text-slate-400">{c.platform}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400">Score Médio</p>
                      <p className={`text-3xl font-bold ${scoreColor(c.avg_score)}`}>
                        {c.avg_score?.toFixed(1) ?? "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Polaridade</p>
                      <p className="text-3xl font-bold text-slate-700">
                        {c.avg_polarity?.toFixed(2) ?? "—"}
                      </p>
                    </div>
                  </div>
                  <SentimentBar dist={c.sentiment_distribution} />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>😊 {c.positive_rate.toFixed(0)}% positivo</span>
                    <span>😡 {c.negative_rate.toFixed(0)}% negativo</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trend Chart */}
          {activeConns.length > 0 && (
            <div className="dream-card p-6">
              <h3 className="text-base font-medium text-slate-700 mb-4">Tendência de Score ao Longo do Tempo</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <defs>
                      <linearGradient id="compareGradA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="compareGradB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="period"
                      type="category"
                      allowDuplicatedCategory={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                      }}
                    />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                      formatter={(value: number, name: string) => [value?.toFixed(1), name]}
                      labelFormatter={(label: string) => {
                        const d = new Date(label);
                        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
                      }}
                    />
                    {trendsA.data_points.length > 0 && (
                      <Area
                        data={trendsA.data_points}
                        type="monotone"
                        dataKey="avg_score"
                        stroke="none"
                        fill="url(#compareGradA)"
                        isAnimationActive={false}
                      />
                    )}
                    {trendsA.data_points.length > 0 && (
                      <Line
                        data={trendsA.data_points}
                        type="monotone"
                        dataKey="avg_score"
                        name={connA ? `@${connA.username}` : "Perfil A"}
                        stroke="#8b5cf6"
                        strokeWidth={2.2}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                        connectNulls
                      />
                    )}
                    {trendsB.data_points.length > 0 && (
                      <Area
                        data={trendsB.data_points}
                        type="monotone"
                        dataKey="avg_score"
                        stroke="none"
                        fill="url(#compareGradB)"
                        isAnimationActive={false}
                      />
                    )}
                    {trendsB.data_points.length > 0 && (
                      <Line
                        data={trendsB.data_points}
                        type="monotone"
                        dataKey="avg_score"
                        name={connB ? `@${connB.username}` : "Perfil B"}
                        stroke="#fb7185"
                        strokeWidth={2.2}
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                        connectNulls
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Emotions */}
          {showEmotions && (
            <div className={`grid gap-6 ${activeConns.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-lg"}`}>
              {activeConns.map((c) => (
                <div key={c.connection_id} className="dream-card p-6">
                  <EmotionBars emotions={c.emotions_distribution} label={`Emoções — @${c.username}`} />
                </div>
              ))}
            </div>
          )}

          {/* Volume */}
          {showVolume && (
            <div className={`grid gap-6 ${activeConns.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-lg"}`}>
              {activeConns.map((c) => (
                <div key={c.connection_id} className="dream-card p-6">
                  <p className="text-xs text-slate-400 font-medium mb-4">Volume — @{c.username}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold text-slate-700">{c.total_comments.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-slate-400">comentários coletados</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-brand-lilacDark">{c.total_analyzed.toLocaleString("pt-BR")}</p>
                      <p className="text-xs text-slate-400">analisados</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
