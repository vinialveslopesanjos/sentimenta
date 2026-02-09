"use client";

import {
  AreaChart,
  Area,
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

export default function SentimentTrendChart({ data, granularity }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        Sem dados de tendência
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
        <Legend
          wrapperStyle={{ fontSize: "12px", color: "#8b949e" }}
        />
        <Area
          type="monotone"
          dataKey="positive"
          stackId="1"
          stroke="#3fb950"
          fill="#3fb950"
          fillOpacity={0.6}
          name="Positivo"
        />
        <Area
          type="monotone"
          dataKey="neutral"
          stackId="1"
          stroke="#d29922"
          fill="#d29922"
          fillOpacity={0.6}
          name="Neutro"
        />
        <Area
          type="monotone"
          dataKey="negative"
          stackId="1"
          stroke="#f85149"
          fill="#f85149"
          fillOpacity={0.6}
          name="Negativo"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
