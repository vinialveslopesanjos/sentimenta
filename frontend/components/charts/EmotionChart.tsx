"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const EMOTION_COLORS: Record<string, string> = {
  alegria: "#3fb950",
  raiva: "#f85149",
  tristeza: "#58a6ff",
  surpresa: "#d2a8ff",
  medo: "#d29922",
  nojo: "#f0883e",
  neutro: "#8b949e",
};

interface Props {
  distribution: Record<string, number> | null;
}

export default function EmotionChart({ distribution }: Props) {
  if (!distribution || Object.keys(distribution).length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        Sem dados de emoções
      </div>
    );
  }

  const data = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: EMOTION_COLORS[name.toLowerCase()] || "#7c3aed",
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10 }}>
        <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 11 }} stroke="#30363d" />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#e6edf3", fontSize: 12 }}
          stroke="none"
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "8px",
            color: "#e6edf3",
            fontSize: "13px",
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
