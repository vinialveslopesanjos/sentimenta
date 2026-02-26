import React, { useState } from "react";
import { StatusBar } from "./StatusBar";
import { DreamCard } from "./DreamCard";
import { connections } from "./mockData";
import {
  BarChart3,
  Instagram,
  Youtube,
  ArrowUpDown,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const compareData = [
  { metric: "Score", profile1: 6.8, profile2: 7.5 },
  { metric: "Positivo %", profile1: 63, profile2: 72 },
  { metric: "Negativo %", profile1: 8, profile2: 5 },
  { metric: "Engajamento", profile1: 55, profile2: 68 },
  { metric: "Polaridade", profile1: 46, profile2: 62 },
];

export function CompareScreen() {
  const [profile1, setProfile1] = useState(0);
  const [profile2, setProfile2] = useState(1);

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
          <DreamCard className="p-4">
            <p className="text-slate-300 mb-2" style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase" }}>
              Perfil A
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                <Instagram size={14} className="text-white" />
              </div>
              <div>
                <p className="text-slate-700" style={{ fontSize: "12px", fontWeight: 500 }}>
                  {connections[0].username}
                </p>
                <p className="text-slate-400" style={{ fontSize: "10px" }}>Instagram</p>
              </div>
            </div>
          </DreamCard>

          <DreamCard className="p-4">
            <p className="text-slate-300 mb-2" style={{ fontSize: "10px", fontWeight: 500, textTransform: "uppercase" }}>
              Perfil B
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                <Youtube size={14} className="text-white" />
              </div>
              <div>
                <p className="text-slate-700" style={{ fontSize: "12px", fontWeight: 500 }}>
                  {connections[1].username}
                </p>
                <p className="text-slate-400" style={{ fontSize: "10px" }}>YouTube</p>
              </div>
            </div>
          </DreamCard>
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <button className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center text-violet-500 active:scale-95 transition-transform">
            <ArrowUpDown size={18} />
          </button>
        </div>

        {/* Comparison Chart */}
        <DreamCard className="p-5">
          <p
            style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 500, color: "#334155" }}
            className="mb-4"
          >
            Metricas Lado a Lado
          </p>
          <div className="h-[200px]">
            <ResponsiveContainer width="99%" height="100%">
              <BarChart data={compareData} layout="vertical">
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
                <Bar dataKey="profile1" name={connections[0].username} fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="profile2" name={connections[1].username} fill="#22D3EE" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-violet-500" />
              <span className="text-slate-400" style={{ fontSize: "10px" }}>{connections[0].username}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm bg-cyan-400" />
              <span className="text-slate-400" style={{ fontSize: "10px" }}>{connections[1].username}</span>
            </div>
          </div>
        </DreamCard>

        {/* Detail comparison cards */}
        <div className="space-y-3">
          {[
            { label: "Score Medio", a: "6.8", b: "7.5", winner: "b" },
            { label: "Taxa Positiva", a: "63%", b: "72%", winner: "b" },
            { label: "Taxa Negativa", a: "8%", b: "5%", winner: "b" },
            { label: "Comentarios", a: "330", b: "1.240", winner: "b" },
            { label: "Posts Analisados", a: "58", b: "23", winner: "a" },
            { label: "Polaridade", a: "0.46", b: "0.62", winner: "b" },
          ].map((item) => (
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

        {/* Export */}
        <button
          className="w-full py-3.5 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{ fontSize: "14px", fontWeight: 500 }}
        >
          <Download size={16} />
          Exportar comparativo
        </button>
      </div>
    </div>
  );
}