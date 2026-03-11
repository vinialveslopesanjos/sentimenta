"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const EMOTION_LABELS: Record<string, string> = {
  joy: "Alegria",
  happiness: "Alegria",
  sadness: "Tristeza",
  anger: "Raiva",
  surprise: "Surpresa",
  fear: "Medo",
  disgust: "Nojo",
  love: "Amor",
  trust: "Confianca",
  anticipation: "Expectativa",
  gratitude: "Gratidao",
  frustration: "Frustracao",
  confusion: "Confusao",
  excitement: "Empolgacao",
  disappointment: "Decepcao",
  pride: "Orgulho",
  humor: "Humor",
  sarcasm: "Sarcasmo",
  admiration: "Admiracao",
  curiosity: "Curiosidade",
  hope: "Esperanca",
  nostalgia: "Nostalgia",
  empathy: "Empatia",
  relief: "Alivio",
  anxiety: "Ansiedade",
  contempt: "Desprezo",
  inspiration: "Inspiracao",
  amusement: "Diversao",
  concern: "Preocupacao",
  enthusiasm: "Entusiasmo",
  neutral: "Neutro",
  alegria: "Alegria",
  raiva: "Raiva",
  tristeza: "Tristeza",
  surpresa: "Surpresa",
  medo: "Medo",
  nojo: "Nojo",
};

interface Props {
  distribution: Record<string, number> | null;
  height?: number;
  maxItems?: number;
}

function RadarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { axis: string; count: number } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-100 rounded-xl px-3 py-2 shadow-float">
      <p className="text-xs text-slate-400 mb-0.5">{d.payload.axis}</p>
      <p className="text-sm font-semibold text-brand-lilacDark">
        {d.payload.count} <span className="text-xs font-normal text-slate-400">ocorrencias</span>
      </p>
      <p className="text-xs text-slate-300">{d.value.toFixed(0)}% do maximo</p>
    </div>
  );
}

export default function SentimentRadar({ distribution, height = 280, maxItems = 8 }: Props) {
  if (!distribution || Object.keys(distribution).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-200 gap-2" style={{ height }}>
        <span className="material-symbols-outlined text-[36px]">radar</span>
        <p className="text-sm font-light">Sem dados de emocoes</p>
      </div>
    );
  }

  const sorted = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems);

  const maxVal = Math.max(...sorted.map(([, v]) => v));

  const data = sorted.map(([key, count]) => ({
    axis: EMOTION_LABELS[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1),
    value: maxVal > 0 ? Math.round((count / maxVal) * 100) : 0,
    count,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="rgba(196, 181, 253, 0.15)" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "Outfit, sans-serif" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={false}
          axisLine={false}
          tickCount={4}
        />
        <Radar
          name="Emocoes"
          dataKey="value"
          stroke="#8B5CF6"
          fill="#8B5CF6"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ r: 3, fill: "#8B5CF6" }}
        />
        <Tooltip content={<RadarTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
