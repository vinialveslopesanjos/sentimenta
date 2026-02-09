"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TrendDataPoint } from "@/lib/types";

interface Props {
  data: TrendDataPoint[];
  granularity: string;
}

function formatDate(dateStr: string, granularity: string) {
  const d = new Date(dateStr + "T00:00:00");
  if (granularity === "month") {
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function EngagementChart({ data, granularity }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        Sem dados de engajamento
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
        <XAxis
          dataKey="period"
          tickFormatter={(v) => formatDate(v, granularity)}
          tick={{ fill: "#8b949e", fontSize: 11 }}
          stroke="#30363d"
        />
        <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} stroke="#30363d" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "8px",
            color: "#e6edf3",
            fontSize: "13px",
          }}
          labelFormatter={(v) => formatDate(String(v), granularity)}
        />
        <Legend wrapperStyle={{ fontSize: "12px", color: "#8b949e" }} />
        <Line
          type="monotone"
          dataKey="total_comments"
          stroke="#58a6ff"
          strokeWidth={2}
          dot={false}
          name="Comentários"
        />
        <Line
          type="monotone"
          dataKey="total_likes"
          stroke="#d2a8ff"
          strokeWidth={2}
          dot={false}
          name="Likes"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
