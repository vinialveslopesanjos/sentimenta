"use client";

import { useEffect, useState } from "react";
import { dashboardApi } from "@/lib/api";
import { getToken } from "@/lib/auth";

type PlatformData = {
  platform: string;
  total_comments: number;
  total_analyzed: number;
  avg_score: number | null;
  sentiment_distribution: { positive: number; neutral: number; negative: number };
  positive_rate: number;
  negative_rate: number;
};

type CompareData = {
  days: number;
  platforms: PlatformData[];
  generated_at: string;
};

function PlatformChip({ platform, active, onRemove }: { platform: string; active?: boolean; onRemove?: () => void }) {
  const isInstagram = platform === "instagram";
  return (
    <div className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border min-w-max ${isInstagram ? "bg-violet-50/60 border-brand-lilac/30" : "bg-rose-50/60 border-rose-200/40"}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] ${isInstagram ? "bg-gradient-to-tr from-brand-lilac to-violet-400" : "bg-gradient-to-tr from-rose-300 to-red-400"}`}>
        <span className="material-symbols-outlined text-[14px]">{isInstagram ? "camera_alt" : "play_arrow"}</span>
      </div>
      <span className={`text-sm font-medium capitalize ${isInstagram ? "text-brand-lilacDark" : "text-rose-700"}`}>
        {platform}
      </span>
      {onRemove && (
        <button onClick={onRemove} className={`${isInstagram ? "text-brand-lilacDark/50 hover:text-brand-lilacDark" : "text-rose-400 hover:text-rose-600"}`}>
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
}

function DistributionBar({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
  return (
    <div className="h-10 w-full rounded-xl overflow-hidden flex relative group cursor-pointer">
      {positive > 0 && (
        <div className="h-full bg-brand-cyan flex items-center justify-center text-[10px] text-brand-heading font-medium transition-all hover:brightness-95" style={{ width: pct(positive) }}>
          {pct(positive)}
        </div>
      )}
      {neutral > 0 && (
        <div className="h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-medium transition-all hover:brightness-95" style={{ width: pct(neutral) }}>
          {pct(neutral)}
        </div>
      )}
      {negative > 0 && (
        <div className="h-full bg-rose-300 flex items-center justify-center text-[10px] text-white font-medium transition-all hover:brightness-95" style={{ width: pct(negative) }}>
          {pct(negative)}
        </div>
      )}
    </div>
  );
}

// Simple SVG comparative trend - generates mock path based on platform data
function TrendChart({ platforms }: { platforms: PlatformData[] }) {
  const colors = ["#8B5CF6", "#E11D48"];
  const dashes = ["", "6 6"];

  // Generate simple smooth paths based on score
  const makePath = (idx: number) => {
    const score = platforms[idx]?.avg_score ?? 7;
    const base = 250 - (score / 10) * 200;
    // Slightly different curves per platform
    const offset = idx * 40;
    return `M0,${base + offset} C50,${base + offset - 20} 100,${base - offset + 30} 150,${base - offset} C200,${base - offset - 30} 250,${base - offset - 50} 300,${base - offset - 40} C350,${base - offset - 30} 400,${base - offset - 60} 450,${base - offset - 70} C500,${base - offset - 80} 550,${base - offset - 40} 600,${base - offset - 50} C650,${base - offset - 60} 700,${base - offset - 80} 800,${base - offset - 60}`;
  };

  return (
    <div className="relative h-[280px] w-full">
      {/* Grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        {[...Array(5)].map((_, i) => <div key={i} className="border-t border-slate-100 w-full h-0" />)}
      </div>
      <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 300">
        {platforms.map((p, i) => (
          <g key={p.platform}>
            <path
              d={makePath(i)}
              fill="none"
              stroke={colors[i] || "#8B5CF6"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={dashes[i] || ""}
              vectorEffect="non-scaling-stroke"
            />
            {/* Animated dot at end */}
            <circle
              cx="750"
              cy={250 - ((p.avg_score ?? 7) / 10) * 200 - i * 40}
              r="5"
              fill={colors[i] || "#8B5CF6"}
              stroke="white"
              strokeWidth="2"
              className="animate-pulse"
            />
          </g>
        ))}
      </svg>

      {/* Tooltip hint */}
      {platforms.length > 0 && (
        <div className="absolute right-[10%] top-[10%] bg-white p-3 rounded-xl shadow-lg border border-slate-100 z-10 pointer-events-none">
          <p className="text-[10px] text-slate-400 mb-1">Período</p>
          {platforms.map((p, i) => (
            <div key={p.platform} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: colors[i] }} />
              <span className="text-xs font-bold text-slate-700 capitalize">
                {p.platform}: {p.avg_score?.toFixed(1) ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function loadCompare(d: number) {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.compare(token, d);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar comparativo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCompare(days); }, [days]);

  const platforms = data?.platforms || [];

  // KPI: total engagement (sum of comments), avg sentiment score, best positive rate, top platform
  const totalComments = platforms.reduce((s, p) => s + p.total_comments, 0);
  const avgScore = platforms.length
    ? platforms.reduce((s, p) => s + (p.avg_score ?? 0), 0) / platforms.length
    : null;
  const bestPositive = platforms.reduce((best, p) => Math.max(best, p.positive_rate), 0);
  const topPlatform = platforms.slice().sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))[0];

  const platformColors = ["#8B5CF6", "#E11D48"];
  const platformBg = ["from-brand-lilac to-violet-400", "from-rose-300 to-red-400"];

  return (
    <div className="flex-1 p-6 md:p-10 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-sans font-light text-brand-heading">Análise Comparativa</h1>
          <p className="text-brand-text text-sm font-light mt-1">
            Compare a performance de sentimento entre plataformas.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Platform chips */}
          {platforms.map((p) => (
            <PlatformChip key={p.platform} platform={p.platform} />
          ))}

          {/* Date range */}
          <div className="flex items-center gap-1 bg-white border border-slate-100 rounded-xl shadow-sm text-sm overflow-hidden">
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-2 font-medium transition-all ${days === d ? "bg-brand-lilacDark text-white" : "text-slate-500 hover:text-brand-heading"}`}
              >
                {d}d
              </button>
            ))}
          </div>

          <button className="px-4 py-2 bg-brand-heading text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-slate-200">
            Exportar Relatório
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="dream-card h-36" />)}
          </div>
          <div className="dream-card h-80" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="dream-card p-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-red-400 mb-2 block">error</span>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={() => loadCompare(days)} className="mt-4 px-4 py-2 bg-brand-lilacDark text-white text-sm rounded-xl hover:opacity-90">
            Tentar novamente
          </button>
        </div>
      )}

      {/* No data */}
      {!loading && !error && platforms.length === 0 && (
        <div className="dream-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[32px] text-slate-400">compare_arrows</span>
          </div>
          <h3 className="text-xl font-sans font-medium text-brand-heading mb-2">Sem dados para comparar</h3>
          <p className="text-slate-400 text-sm font-light max-w-xs mx-auto">
            Conecte pelo menos uma plataforma e processe comentários para ver o comparativo.
          </p>
        </div>
      )}

      {!loading && !error && platforms.length > 0 && (
        <div className="space-y-6">
          {/* KPI cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total engagement */}
            <div className="dream-card p-5 flex flex-col justify-between h-36 relative overflow-hidden group hover:shadow-dream transition-shadow">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand-lilac/20 rounded-full blur-2xl group-hover:bg-brand-lilac/30 transition-colors" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Comentários Total</p>
                <h3 className="text-3xl font-sans font-medium text-brand-heading">
                  {totalComments >= 1000 ? `${(totalComments / 1000).toFixed(1)}k` : totalComments.toLocaleString("pt-BR")}
                </h3>
              </div>
              <div className="space-y-1.5">
                {platforms.map((p, i) => (
                  <div key={p.platform} className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-1 text-slate-500">
                      <div className="w-2 h-2 rounded-full" style={{ background: platformColors[i] }} />
                      <span className="capitalize">{p.platform}</span>
                    </span>
                    <span className="font-medium text-brand-heading">{p.total_comments.toLocaleString("pt-BR")}</span>
                  </div>
                ))}
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex mt-1">
                  {platforms.map((p, i) => (
                    <div
                      key={p.platform}
                      className="h-full"
                      style={{
                        background: platformColors[i],
                        width: `${totalComments ? (p.total_comments / totalComments) * 100 : 0}%`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Avg score */}
            <div className="dream-card p-5 flex flex-col justify-between h-36 relative overflow-hidden group hover:shadow-dream transition-shadow">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand-cyan/20 rounded-full blur-2xl group-hover:bg-brand-cyan/30 transition-colors" />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Score de Sentimento</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-sans font-medium text-brand-heading">{avgScore?.toFixed(1) ?? "—"}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">+0.2</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {platforms.map((p, i) => (
                  <div
                    key={p.platform}
                    className={`text-center p-1.5 rounded-xl border ${i === 0 ? "bg-violet-50/40 border-violet-100/40" : "bg-rose-50/40 border-rose-100/40"}`}
                  >
                    <p className="text-[10px] font-bold uppercase capitalize" style={{ color: platformColors[i] }}>{p.platform.slice(0, 5)}</p>
                    <p className="text-lg font-sans font-medium" style={{ color: platformColors[i] }}>{p.avg_score?.toFixed(1) ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Best positive rate */}
            <div className="dream-card p-5 flex flex-col justify-between h-36 relative overflow-hidden group hover:shadow-dream transition-shadow">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Menções Positivas</p>
                <h3 className="text-3xl font-sans font-medium text-brand-heading">{(bestPositive * 100).toFixed(0)}%</h3>
              </div>
              <div className="flex items-end justify-between gap-2 h-14 mt-2 pb-1">
                {platforms.map((p, i) => (
                  <div key={p.platform} className={`flex gap-0.5 items-end h-full ${i > 0 ? "border-l border-slate-100 pl-2" : ""} w-full justify-center`}>
                    <div className="w-2 rounded-t-sm" style={{ height: `${p.positive_rate * 50}%`, background: platformColors[i], opacity: 0.4 }} />
                    <div className="w-2 rounded-t-sm" style={{ height: `${p.positive_rate * 75}%`, background: platformColors[i], opacity: 0.7 }} />
                    <div className="w-2 rounded-t-sm shadow-[0_0_8px_rgba(139,92,246,0.3)]" style={{ height: `${p.positive_rate * 100}%`, background: platformColors[i] }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Top platform */}
            <div className="dream-card p-5 flex flex-col justify-between h-36 relative overflow-hidden group hover:shadow-dream transition-shadow">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">Melhor Plataforma</p>
                <h3 className="text-2xl font-sans font-medium text-brand-heading capitalize">
                  {topPlatform?.platform || "—"}
                </h3>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="relative w-14 h-14">
                  <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#F1F5F9" strokeWidth="4" />
                    {platforms.map((p, i) => {
                      const share = totalComments ? p.total_comments / totalComments : 0;
                      const offset = i === 0 ? 0 : (platforms[0] ? (platforms[0].total_comments / totalComments) * 100 : 0);
                      return (
                        <path
                          key={p.platform}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 11.0 27.0"
                          fill="none"
                          stroke={platformColors[i]}
                          strokeDasharray={`${(share * 100).toFixed(0)}, 100`}
                          strokeWidth="4"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] text-slate-400 font-medium">MIX</div>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  {platforms.map((p, i) => (
                    <div key={p.platform} className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2 h-2 rounded-full" style={{ background: platformColors[i] }} />
                      <span className="capitalize">{p.platform}: {totalComments ? ((p.total_comments / totalComments) * 100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Chart + Distribution */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trend chart */}
            <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[32px] shadow-card border border-slate-50 relative">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                  <h3 className="text-lg font-sans font-medium text-brand-heading">Tendência de Sentimento</h3>
                  <p className="text-sm text-slate-400 font-light">Evolução comparativa ao longo do período</p>
                </div>
                <div className="flex items-center gap-4">
                  {platforms.map((p, i) => (
                    <div key={p.platform} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ background: platformColors[i] }} />
                      <span className="text-xs text-slate-500 font-medium capitalize">{p.platform}</span>
                    </div>
                  ))}
                </div>
              </div>
              <TrendChart platforms={platforms} />
              <div className="flex justify-between text-xs text-slate-400 mt-4 px-2 font-light">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (days - Math.round((i / 6) * days)));
                  return <span key={i}>{d.getDate()}/{d.getMonth() + 1}</span>;
                })}
              </div>
            </div>

            {/* Distribution */}
            <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-card border border-slate-50 flex flex-col">
              <div className="mb-5">
                <h3 className="text-lg font-sans font-medium text-brand-heading">Distribuição</h3>
                <p className="text-sm text-slate-400 font-light">Por tipo de sentimento</p>
              </div>
              <div className="flex-1 flex flex-col justify-center space-y-6">
                {platforms.map((p, i) => (
                  <div key={p.platform} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white bg-gradient-to-tr ${platformBg[i]}`}>
                          <span className="material-symbols-outlined text-[14px]">{p.platform === "instagram" ? "camera_alt" : "play_arrow"}</span>
                        </div>
                        <span className="font-medium text-slate-600 capitalize">{p.platform}</span>
                      </div>
                      <span className="text-slate-400 font-light text-xs">
                        {p.total_comments >= 1000 ? `${(p.total_comments / 1000).toFixed(1)}k` : p.total_comments} total
                      </span>
                    </div>
                    <DistributionBar
                      positive={p.sentiment_distribution.positive}
                      neutral={p.sentiment_distribution.neutral}
                      negative={p.sentiment_distribution.negative}
                    />
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-50 mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-brand-cyan" />
                  <span className="text-xs text-slate-500">Positivo</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-100 border border-slate-200" />
                  <span className="text-xs text-slate-500">Neutro</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-300" />
                  <span className="text-xs text-slate-500">Negativo</span>
                </div>
              </div>
            </div>
          </section>

          {/* Platform detail cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platforms.map((p, i) => (
              <div key={p.platform} className="dream-card p-6 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-30 pointer-events-none" style={{ background: platformColors[i] }} />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr flex items-center justify-center text-white shadow-sm ${platformBg[i]}`}>
                      <span className="material-symbols-outlined text-[20px]">{p.platform === "instagram" ? "camera_alt" : "play_arrow"}</span>
                    </div>
                    <div>
                      <h4 className="font-sans font-medium text-brand-heading capitalize">{p.platform}</h4>
                      <p className="text-xs text-slate-400">Últimos {days} dias</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-400 mb-1">Score</p>
                      <p className="text-2xl font-sans font-medium text-brand-heading">{p.avg_score?.toFixed(1) ?? "—"}</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-green-50">
                      <p className="text-xs text-green-600 mb-1">Positivo</p>
                      <p className="text-2xl font-sans font-medium text-green-700">{(p.positive_rate * 100).toFixed(0)}%</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-red-50">
                      <p className="text-xs text-red-500 mb-1">Negativo</p>
                      <p className="text-2xl font-sans font-medium text-red-600">{(p.negative_rate * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 text-center">
                    {p.total_analyzed.toLocaleString("pt-BR")} de {p.total_comments.toLocaleString("pt-BR")} comentários analisados
                  </p>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
