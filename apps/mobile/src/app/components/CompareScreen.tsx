import React, { useState, useEffect, useMemo } from "react";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { api } from "../../lib/api";
import type { Connection, ConnectionComparison, CompareConnectionsResponse } from "@sentimenta/types";
import {
  ArrowUpDown,
  Download,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

function platformIcon(platform: string): string {
  if (platform === "twitter") return "/icons/twitter-x.svg";
  return `/icons/${platform}.svg`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function CompareScreen() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareData, setCompareData] = useState<ConnectionComparison[]>([]);
  const [comparing, setComparing] = useState(false);
  const [idx1, setIdx1] = useState(0);
  const [idx2, setIdx2] = useState(1);
  const [showPicker, setShowPicker] = useState<"a" | "b" | null>(null);

  // Fetch connections on mount
  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const data = await api.connections.list();
        setConnections(data);
      } catch {
        // will show empty state
      } finally {
        setLoading(false);
      }
    };
    fetchConnections();
  }, []);

  // Fetch comparison when connections or selection changes
  useEffect(() => {
    if (connections.length < 2) return;
    const safeIdx1 = Math.min(idx1, connections.length - 1);
    const safeIdx2 = Math.min(idx2, connections.length - 1);
    if (safeIdx1 === safeIdx2) return;

    const ids = [connections[safeIdx1].id, connections[safeIdx2].id];
    setComparing(true);
    api.dashboard
      .compareConnections(ids)
      .then((res: CompareConnectionsResponse) => {
        setCompareData(res.connections);
      })
      .catch(() => {
        setCompareData([]);
      })
      .finally(() => {
        setComparing(false);
      });
  }, [connections, idx1, idx2]);

  const safeIdx1 = Math.min(idx1, Math.max(connections.length - 1, 0));
  const safeIdx2 = Math.min(idx2, Math.max(connections.length - 1, 0));

  const connA = connections[safeIdx1] ?? null;
  const connB = connections[safeIdx2] ?? null;

  const compA = compareData.find((c) => c.connection_id === connA?.id) ?? null;
  const compB = compareData.find((c) => c.connection_id === connB?.id) ?? null;

  const chartData = useMemo(() => {
    if (!compA || !compB) return [];
    return [
      { metric: "Score", profile1: compA.avg_score ?? 0, profile2: compB.avg_score ?? 0 },
      { metric: "Positivo %", profile1: compA.positive_rate, profile2: compB.positive_rate },
      { metric: "Negativo %", profile1: compA.negative_rate, profile2: compB.negative_rate },
      { metric: "Comentarios", profile1: compA.total_comments, profile2: compB.total_comments },
      { metric: "Polaridade", profile1: (compA.avg_polarity || 0) * 100, profile2: (compB.avg_polarity || 0) * 100 },
    ];
  }, [compA, compB]);

  const detailCards = useMemo(() => {
    if (!compA || !compB) return [];
    const rows = [
      {
        label: "Score Medio",
        a: compA.avg_score != null ? compA.avg_score.toFixed(1) : "--",
        b: compB.avg_score != null ? compB.avg_score.toFixed(1) : "--",
        aVal: compA.avg_score ?? 0,
        bVal: compB.avg_score ?? 0,
      },
      {
        label: "Taxa Positiva",
        a: `${compA.positive_rate.toFixed(0)}%`,
        b: `${compB.positive_rate.toFixed(0)}%`,
        aVal: compA.positive_rate,
        bVal: compB.positive_rate,
      },
      {
        label: "Taxa Negativa",
        a: `${compA.negative_rate.toFixed(0)}%`,
        b: `${compB.negative_rate.toFixed(0)}%`,
        aVal: compA.negative_rate,
        bVal: compB.negative_rate,
      },
      {
        label: "Comentarios",
        a: formatNumber(compA.total_comments),
        b: formatNumber(compB.total_comments),
        aVal: compA.total_comments,
        bVal: compB.total_comments,
      },
      {
        label: "Analisados",
        a: formatNumber(compA.total_analyzed),
        b: formatNumber(compB.total_analyzed),
        aVal: compA.total_analyzed,
        bVal: compB.total_analyzed,
      },
      {
        label: "Polaridade",
        a: compA.avg_polarity != null ? compA.avg_polarity.toFixed(2) : "--",
        b: compB.avg_polarity != null ? compB.avg_polarity.toFixed(2) : "--",
        aVal: compA.avg_polarity ?? 0,
        bVal: compB.avg_polarity ?? 0,
      },
    ];
    return rows.map((r) => ({
      ...r,
      winner:
        r.label === "Taxa Negativa"
          ? r.aVal < r.bVal
            ? "a"
            : r.aVal > r.bVal
              ? "b"
              : "tie"
          : r.aVal > r.bVal
            ? "a"
            : r.aVal < r.bVal
              ? "b"
              : "tie",
    }));
  }, [compA, compB]);

  const handleSwap = () => {
    setIdx1(idx2);
    setIdx2(idx1);
  };

  const handlePickProfile = (target: "a" | "b", connIndex: number) => {
    if (target === "a") {
      if (connIndex === idx2) {
        // swap to avoid duplicates
        setIdx2(idx1);
      }
      setIdx1(connIndex);
    } else {
      if (connIndex === idx1) {
        setIdx1(idx2);
      }
      setIdx2(connIndex);
    }
    setShowPicker(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBFF] pb-28">
        <StatusBar />
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="text-violet-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Not enough connections
  if (connections.length < 2) {
    return (
      <div className="min-h-screen bg-[#FDFBFF] pb-28">
        <StatusBar />
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
            Comparativo
          </h1>
          <p className="text-slate-400 mt-1" style={{ fontSize: "13px" }}>
            Compare desempenho entre perfis.
          </p>
        </div>
        <div className="px-5 mt-8">
          <DreamCard className="p-8 text-center">
            <p className="text-slate-400" style={{ fontSize: "14px" }}>
              Conecte pelo menos 2 perfis para usar o comparativo.
            </p>
            <p className="text-slate-300 mt-2" style={{ fontSize: "12px" }}>
              {connections.length === 0
                ? "Nenhum perfil conectado."
                : "Apenas 1 perfil conectado."}
            </p>
          </DreamCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBFF] pb-28">
      <StatusBar />

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
          Comparativo
        </h1>
        <p className="text-slate-400 mt-1" style={{ fontSize: "13px" }}>
          Compare desempenho entre perfis.
        </p>
      </div>

      <div className="px-5 mt-4 space-y-5">
        {/* Profile Selectors */}
        <div className="grid grid-cols-2 gap-3">
          {/* Profile A */}
          <DreamCard className="p-4 relative">
            <p className="text-slate-300 mb-2" style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase" }}>
              Perfil A
            </p>
            <button
              onClick={() => setShowPicker(showPicker === "a" ? null : "a")}
              className="flex items-center gap-2 w-full"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-50 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
                {connA?.profile_image_url ? (
                  <img src={connA.profile_image_url} alt={connA.username} className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <img src={platformIcon(connA?.platform ?? "instagram")} alt={connA?.platform ?? ""} className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-slate-700 truncate" style={{ fontSize: "12px", fontWeight: 500 }}>
                  @{connA?.username}
                </p>
                <p className="text-slate-400" style={{ fontSize: "10px" }}>{connA?.platform}</p>
              </div>
              <ChevronDown size={12} className="text-slate-300 flex-shrink-0" />
            </button>

            {showPicker === "a" && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-2xl shadow-lg border border-slate-100 max-h-48 overflow-y-auto">
                {connections.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => handlePickProfile("a", i)}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                      i === safeIdx1 ? "bg-violet-50" : ""
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md overflow-hidden flex items-center justify-center bg-slate-50 flex-shrink-0">
                      {c.profile_image_url ? (
                        <img src={c.profile_image_url} alt={c.username} className="w-6 h-6 rounded-md object-cover" />
                      ) : (
                        <img src={platformIcon(c.platform)} alt={c.platform} className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-slate-600 truncate" style={{ fontSize: "12px" }}>@{c.username}</span>
                    <span className="text-slate-300 ml-auto" style={{ fontSize: "10px" }}>{c.platform}</span>
                  </button>
                ))}
              </div>
            )}
          </DreamCard>

          {/* Profile B */}
          <DreamCard className="p-4 relative">
            <p className="text-slate-300 mb-2" style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase" }}>
              Perfil B
            </p>
            <button
              onClick={() => setShowPicker(showPicker === "b" ? null : "b")}
              className="flex items-center gap-2 w-full"
            >
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-50 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
                {connB?.profile_image_url ? (
                  <img src={connB.profile_image_url} alt={connB.username} className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <img src={platformIcon(connB?.platform ?? "instagram")} alt={connB?.platform ?? ""} className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-slate-700 truncate" style={{ fontSize: "12px", fontWeight: 500 }}>
                  @{connB?.username}
                </p>
                <p className="text-slate-400" style={{ fontSize: "10px" }}>{connB?.platform}</p>
              </div>
              <ChevronDown size={12} className="text-slate-300 flex-shrink-0" />
            </button>

            {showPicker === "b" && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white rounded-2xl shadow-lg border border-slate-100 max-h-48 overflow-y-auto">
                {connections.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => handlePickProfile("b", i)}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                      i === safeIdx2 ? "bg-cyan-50" : ""
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md overflow-hidden flex items-center justify-center bg-slate-50 flex-shrink-0">
                      {c.profile_image_url ? (
                        <img src={c.profile_image_url} alt={c.username} className="w-6 h-6 rounded-md object-cover" />
                      ) : (
                        <img src={platformIcon(c.platform)} alt={c.platform} className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-slate-600 truncate" style={{ fontSize: "12px" }}>@{c.username}</span>
                    <span className="text-slate-300 ml-auto" style={{ fontSize: "10px" }}>{c.platform}</span>
                  </button>
                ))}
              </div>
            )}
          </DreamCard>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button
            onClick={handleSwap}
            className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-500 active:scale-95 transition-transform"
          >
            <ArrowUpDown size={18} />
          </button>
        </div>

        {/* Loading comparison */}
        {comparing && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="text-violet-400 animate-spin" />
          </div>
        )}

        {/* Comparison Chart */}
        {!comparing && chartData.length > 0 && (
          <DreamCard className="p-5">
            <p
              style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
              className="mb-4"
            >
              Metricas Lado a Lado
            </p>
            <div className="h-[200px]">
              <ResponsiveContainer width="99%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94A3B8" }} />
                  <YAxis
                    type="category"
                    dataKey="metric"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: "#94A3B8" }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "none",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      fontSize: "11px",
                    }}
                  />
                  <Bar dataKey="profile1" name={connA?.username ?? "Perfil A"} fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="profile2" name={connB?.username ?? "Perfil B"} fill="#22D3EE" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
                <span className="text-slate-400" style={{ fontSize: "10px" }}>@{connA?.username}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
                <span className="text-slate-400" style={{ fontSize: "10px" }}>@{connB?.username}</span>
              </div>
            </div>
          </DreamCard>
        )}

        {/* No comparison data */}
        {!comparing && chartData.length === 0 && (
          <DreamCard className="p-6 text-center">
            <p className="text-slate-400" style={{ fontSize: "13px" }}>
              Sem dados de comparacao para os perfis selecionados.
            </p>
          </DreamCard>
        )}

        {/* Detail comparison cards */}
        {!comparing && detailCards.length > 0 && (
          <div className="space-y-3">
            {detailCards.map((item) => (
              <DreamCard key={item.label} className="p-4">
                <p className="text-slate-400 mb-2" style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase" }}>
                  {item.label}
                </p>
                <div className="flex items-center justify-between">
                  <span
                    className={item.winner === "a" ? "text-violet-500" : "text-slate-600"}
                    style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500 }}
                  >
                    {item.a}
                  </span>
                  <span className="text-slate-300" style={{ fontSize: "12px" }}>vs</span>
                  <span
                    className={item.winner === "b" ? "text-cyan-500" : "text-slate-600"}
                    style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 500 }}
                  >
                    {item.b}
                  </span>
                </div>
              </DreamCard>
            ))}
          </div>
        )}

        {/* Export */}
        <button
          className="w-full py-3.5 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          <Download size={16} />
          Exportar comparativo
        </button>
      </div>

      {/* Close picker overlay */}
      {showPicker && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowPicker(null)}
        />
      )}
    </div>
  );
}
