"use client";

import { useLocale, useTranslations } from "next-intl";
import { ChartTextAlternative } from "@/components/charts/ChartTextAlternative";
import { formatChartNumber } from "@/lib/chartAccessibility";

interface EmotionPoint {
  emotion: string;
  value: number;
}

interface EmotionRadarCardProps {
  title: string;
  data: EmotionPoint[];
  compact?: boolean;
  chartId?: string;
}

const EMOTION_COLORS: Record<string, string> = {
  alegria: "var(--emotion-joy)",
  joy: "var(--emotion-joy)",
  felicidade: "var(--emotion-joy)",
  descontentamento: "var(--emotion-sadness)",
  tristeza: "var(--emotion-sadness)",
  sadness: "var(--emotion-sadness)",
  raiva: "var(--emotion-anger)",
  anger: "var(--emotion-anger)",
  apoio: "var(--emotion-support)",
  amor: "var(--emotion-support)",
  love: "var(--emotion-support)",
  aplausos: "var(--emotion-applause)",
  surpresa: "var(--emotion-applause)",
  surprise: "var(--emotion-applause)",
  neutro: "var(--emotion-neutral)",
  neutral: "var(--emotion-neutral)",
  medo: "var(--emotion-fear)",
  fear: "var(--emotion-fear)",
  nojo: "var(--emotion-disgust)",
  disgust: "var(--emotion-disgust)",
};

const FALLBACK_COLORS = ["var(--emotion-joy)", "var(--emotion-sadness)", "var(--emotion-anger)", "var(--emotion-support)", "var(--emotion-applause)", "var(--emotion-neutral)"];

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeSector(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", outerStart.x, outerStart.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, outerEnd.x, outerEnd.y,
    "L", innerStart.x, innerStart.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, innerEnd.x, innerEnd.y,
    "Z",
  ].join(" ");
}

function formatEmotion(raw: string) {
  const normalized = raw.replace(/_/g, " ").toLocaleLowerCase("pt-BR");
  return normalized.charAt(0).toLocaleUpperCase("pt-BR") + normalized.slice(1);
}

function formatNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return value.toLocaleString("pt-BR");
  return String(value);
}

export default function EmotionRadarCard({ title, data, compact = false, chartId = "emotion-radar" }: EmotionRadarCardProps) {
  const locale = useLocale();
  const ta = useTranslations("charts.accessibility");
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const ranked = [...data]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, compact ? 5 : 6)
    .map((item, index) => {
      const key = item.emotion.toLowerCase();
      return {
        ...item,
        label: formatEmotion(item.emotion),
        pct: total > 0 ? Math.round((item.value / total) * 100) : 0,
        color: EMOTION_COLORS[key] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
      };
    });

  const maxPct = Math.max(...ranked.map((item) => item.pct), 1);
  const cx = 170;
  const cy = 170;
  const innerRadius = 52;
  const maxRadius = 142;
  const sectorSize = 42;

  return (
    <section
      className={`rounded-2xl ui-reveal ${compact ? "p-5 md:p-6 h-full" : "p-6 md:p-8"}`}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 18px -8px rgba(0,0,0,0.12)",
      }}
    >
      <h3
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: compact ? "1.16rem" : "1.55rem",
          fontWeight: 850,
          color: "var(--text-primary)",
          lineHeight: 1.1,
        }}
      >
        {title}
      </h3>

      <div className={compact ? "grid grid-cols-1 gap-5 items-center mt-5" : "grid grid-cols-1 lg:grid-cols-[minmax(320px,0.9fr)_minmax(340px,1fr)] gap-8 md:gap-12 items-center mt-7"}>
        <div data-chart-visual={chartId} className="flex justify-center">
          <svg viewBox="0 0 340 340" className={`w-full ${compact ? "max-w-[260px]" : "max-w-[360px]"}`} aria-hidden="true" focusable="false">
            {[70, 105, 140].map((radius) => (
              <circle
                key={radius}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="color-mix(in srgb, var(--accent) 26%, transparent)"
                strokeWidth="1"
                strokeDasharray="3 9"
              />
            ))}

            {ranked.map((item, index) => {
              const start = -85 + index * 55;
              const end = start + sectorSize;
              const outerRadius = innerRadius + 20 + (item.pct / maxPct) * (maxRadius - innerRadius - 20);
              return (
                <path
                  key={item.emotion}
                  d={describeSector(cx, cy, innerRadius, outerRadius, start, end)}
                  fill={item.color}
                  opacity={0.88}
                />
              );
            })}

            <circle cx={cx} cy={cy} r="58" fill="var(--bg-card)" stroke="color-mix(in srgb, var(--accent) 32%, var(--border))" strokeWidth="3" />
            <circle cx={cx} cy={cy} r="44" fill="none" stroke="color-mix(in srgb, var(--border) 72%, transparent)" strokeWidth="1" />
            <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 18, fill: "var(--text-muted)", fontFamily: "Inter, sans-serif" }}>
              total
            </text>
            <text x={cx} y={cy + 26} textAnchor="middle" style={{ fontSize: 28, fontWeight: 850, fill: "var(--text-primary)", fontFamily: "Outfit, sans-serif" }}>
              {formatNumber(total)}
            </text>
          </svg>
        </div>

        <div className={compact ? "space-y-2.5" : "space-y-3"}>
          {ranked.map((item, index) => (
            <div
              key={item.emotion}
              className={`${compact ? "grid-cols-[2.1rem_0.9rem_minmax(0,1fr)_2.7rem] px-3 py-2.5" : "grid-cols-[2.5rem_1rem_minmax(0,1fr)_3rem] px-4 py-3"} grid items-center gap-3 rounded-xl`}
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent-bg) 48%, var(--bg-card))",
                border: "1px solid color-mix(in srgb, var(--accent) 24%, var(--border))",
              }}
            >
              <span style={{ fontSize: compact ? "0.76rem" : "0.88rem", fontWeight: 850, color: "var(--text-faint)" }}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
              <span className="truncate" style={{ fontSize: compact ? "0.82rem" : "1rem", fontWeight: 850, color: "var(--text-primary)" }}>
                {item.label}
              </span>
              <span style={{ fontSize: compact ? "0.84rem" : "1rem", fontWeight: 850, color: "var(--text-primary)", textAlign: "right" }}>
                {item.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {ranked.length > 0 && (
        <ChartTextAlternative
          chartId={chartId}
          title={title}
          summary={ta("dominantPercent", {
            category: ranked[0].label,
            value: ranked[0].pct,
          })}
          period={ta("currentSlice")}
          unit={ta("units.occurrencesAndPercentage")}
          columns={[
            { key: "emotion", label: ta("columns.emotion") },
            { key: "occurrences", label: ta("columns.occurrences"), numeric: true },
            { key: "percentage", label: ta("columns.percentage"), numeric: true },
          ]}
          rows={ranked.map(item => ({
            emotion: item.label,
            occurrences: formatChartNumber(item.value, locale, 0),
            percentage: `${item.pct}%`,
          }))}
        />
      )}
    </section>
  );
}
