"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { SentimentDistribution } from "@/lib/types";

const COLORS = {
  positive: "#3fb950",
  neutral: "#d29922",
  negative: "#f85149",
};

interface Props {
  distribution: SentimentDistribution | null;
  avgScore?: number | null;
}

export default function SentimentDonut({ distribution, avgScore }: Props) {
  if (!distribution) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        Sem dados de sentimento
      </div>
    );
  }

  const total = distribution.positive + distribution.neutral + distribution.negative;
  const data = [
    { name: "Positivo", value: distribution.positive, color: COLORS.positive },
    { name: "Neutro", value: distribution.neutral, color: COLORS.neutral },
    { name: "Negativo", value: distribution.negative, color: COLORS.negative },
  ].filter((d) => d.value > 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#161b22",
              border: "1px solid #30363d",
              borderRadius: "8px",
              color: "#e6edf3",
              fontSize: "13px",
            }}
            formatter={(value: number, name: string) => [
              `${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {avgScore != null && (
          <>
            <span className="text-2xl font-bold text-text-primary">
              {avgScore.toFixed(1)}
            </span>
            <span className="text-xs text-text-secondary">Score</span>
          </>
        )}
      </div>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            {d.name} ({total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%)
          </div>
        ))}
      </div>
    </div>
  );
}
