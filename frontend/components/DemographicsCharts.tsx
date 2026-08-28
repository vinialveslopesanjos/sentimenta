"use client";

import {
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { Section } from "./ds/Section";
import { useTheme } from "./ThemeContext";
import { ChartTextAlternative } from "./charts/ChartTextAlternative";
import { formatChartNumber } from "@/lib/chartAccessibility";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DemographicsOverviewProps {
  genderDist: Record<string, number>;
  ageDist: Record<string, number>;
  topLocations: Array<{ country: string; country_code: string; count: number }>;
  stateDistribution?: Array<{ state: string; count: number }>;
  coverage: { total_commenters: number; enriched: number; coverage_pct: number };
}

const GENDER_COLORS: Record<string, string> = { male: "var(--primary)", female: "var(--secondary-light)", business: "var(--accent)" };
const VALID_GENDERS = new Set(['male', 'female', 'business']);
const AGE_BANDS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];
const AGE_BAND_COLORS: Record<string, string> = {
  '13-17': 'var(--accent)',
  '18-24': 'var(--chart-6)',
  '25-34': 'var(--chart-5)',
  '35-44': 'var(--primary)',
  '45-54': 'var(--primary-faint)',
  '55+': 'var(--sentiment-neutral)',
};

const SENTIMENT_COLORS = {
  positive: "var(--sentiment-positive)",
  neutral: "var(--sentiment-neutral)",
  negative: "var(--sentiment-negative)",
  score: "var(--primary)",
};

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
const FALLBACK_EMOTION_COLORS = ["var(--emotion-joy)", "var(--emotion-sadness)", "var(--emotion-anger)", "var(--emotion-support)", "var(--emotion-applause)", "var(--emotion-neutral)"];

const BRAZIL_STATE_GRID = [
  { uf: 'RR', col: 4, row: 1 }, { uf: 'AP', col: 6, row: 1 },
  { uf: 'AM', col: 3, row: 2 }, { uf: 'PA', col: 5, row: 2 }, { uf: 'MA', col: 7, row: 2 }, { uf: 'CE', col: 8, row: 2 }, { uf: 'RN', col: 9, row: 2 },
  { uf: 'AC', col: 2, row: 3 }, { uf: 'RO', col: 3, row: 3 }, { uf: 'TO', col: 5, row: 3 }, { uf: 'PI', col: 7, row: 3 }, { uf: 'PE', col: 8, row: 3 }, { uf: 'PB', col: 9, row: 3 },
  { uf: 'MT', col: 4, row: 4 }, { uf: 'BA', col: 7, row: 4 }, { uf: 'SE', col: 8, row: 4 }, { uf: 'AL', col: 9, row: 4 },
  { uf: 'MS', col: 4, row: 5 }, { uf: 'GO', col: 5, row: 5 }, { uf: 'DF', col: 6, row: 5 }, { uf: 'MG', col: 7, row: 5 }, { uf: 'ES', col: 8, row: 5 },
  { uf: 'SP', col: 6, row: 6 }, { uf: 'RJ', col: 7, row: 6 },
  { uf: 'PR', col: 6, row: 7 }, { uf: 'SC', col: 6, row: 8 }, { uf: 'RS', col: 6, row: 9 },
] as const;

const normalizeCountry = (name: string) => {
  const upper = (name || '').toUpperCase().trim();
  if (upper === 'BR' || upper === 'BRAZIL') return 'Brasil';
  return name;
};

const pctOf = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
const clampPct = (value: number) => Math.max(0, Math.min(100, value));

const sortAgeBand = (a: string, b: string) => {
  const ai = AGE_BANDS.indexOf(a);
  const bi = AGE_BANDS.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
};

function formatEmotion(raw: string) {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function SentimentLegend({ td }: { td: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
      {[
        { key: "positive", label: td("positive"), color: SENTIMENT_COLORS.positive },
        { key: "neutral", label: td("neutral"), color: SENTIMENT_COLORS.neutral },
        { key: "negative", label: td("negative"), color: SENTIMENT_COLORS.negative },
      ].map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function SentimentStack({ positive, neutral, negative, height = 12 }: { positive: number; neutral: number; negative: number; height?: number }) {
  const segments = [
    { key: "positive", value: clampPct(positive), color: SENTIMENT_COLORS.positive },
    { key: "neutral", value: clampPct(neutral), color: SENTIMENT_COLORS.neutral },
    { key: "negative", value: clampPct(negative), color: SENTIMENT_COLORS.negative },
  ];

  return (
    <div
      className="flex w-full overflow-hidden rounded-full"
      style={{ height, backgroundColor: "color-mix(in srgb, var(--accent-bg) 46%, var(--bg-subtle))" }}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          title={`${segment.value}%`}
          style={{
            width: `${segment.value}%`,
            backgroundColor: segment.color,
            transition: "width 520ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      ))}
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className="inline-flex items-baseline justify-center gap-0.5 rounded-full px-2.5 py-1"
      style={{
        minWidth: "4.2rem",
        backgroundColor: "color-mix(in srgb, var(--primary-bg) 72%, var(--bg-card))",
        color: "var(--primary)",
        border: "1px solid color-mix(in srgb, var(--primary) 22%, var(--border))",
        fontFamily: "'Outfit', sans-serif",
        fontWeight: 850,
        fontSize: "0.85rem",
      }}
    >
      {score.toFixed(1)}
      <span style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>/10</span>
    </span>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #1 — DemographicsOverview
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function DemographicsOverview({ genderDist, ageDist, topLocations, stateDistribution, coverage }: DemographicsOverviewProps) {
  const td = useTranslations("demographics");

  const genderDataRaw = ['business', 'female', 'male']
    .map(name => ({ name, value: genderDist[name] ?? 0 }))
    .filter(g => VALID_GENDERS.has(g.name));
  const genderTotal = genderDataRaw.reduce((s, g) => s + g.value, 0) || 1;
  const genderData = genderDataRaw.map(g => ({ name: g.name, value: g.value, pct: Math.round((g.value / genderTotal) * 100) }));
  const ageDataRaw = AGE_BANDS.map(name => ({ name, value: ageDist[name] ?? 0 }));
  const ageTotal = ageDataRaw.reduce((s, a) => s + a.value, 0) || 1;
  const ageData = ageDataRaw.map(a => ({ name: a.name, value: a.value, pct: Math.round((a.value / ageTotal) * 100) }));
  const stateMap = new Map((stateDistribution ?? []).map(st => [st.state.toUpperCase(), st.count]));
  const stateValues = BRAZIL_STATE_GRID.map(st => stateMap.get(st.uf) ?? 0);
  const maxStateCount = Math.max(...stateValues, 1);
  const activeStates = stateValues.filter(Boolean).length;
  const topState = BRAZIL_STATE_GRID.reduce(
    (best, state) => ((stateMap.get(state.uf) ?? 0) > best.count ? { uf: state.uf, count: stateMap.get(state.uf) ?? 0 } : best),
    { uf: "", count: 0 }
  );
  const topLocationText = topLocations.slice(0, 3).map(l => `${normalizeCountry(l.country)} ${l.count}`).join(" · ");

  const AudienceBar = ({ label, pct, color }: { label: string; pct: number; color: string }) => (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)_2.5rem] items-center gap-3">
      <span className="truncate" style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-secondary)" }}>{label}</span>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--accent-bg) 62%, var(--bg-subtle))" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(Math.max(pct, 0), 100)}%`,
            backgroundColor: color,
            transition: "width 520ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
      <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-muted)", textAlign: "right" }}>{pct}%</span>
    </div>
  );

  return (
    <Section title={td("overview.title")} subtitle={td("overview.subtitle")} className="ui-reveal">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,0.95fr)_minmax(280px,1fr)_minmax(300px,1.1fr)] gap-8">
        <div>
          <div className="mb-5">
            <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.98rem", fontWeight: 800, color: "var(--text-primary)" }}>{td("overview.geographicConcentration")}</h4>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
              {td("overview.statesPresent", { count: activeStates })}
            </p>
          </div>
          <div className="overflow-x-auto pb-1">
            <div
              className="grid gap-0.5"
              style={{
                gridTemplateColumns: "repeat(9, 1.9rem)",
                gridTemplateRows: "repeat(9, 1.9rem)",
                width: "max-content",
              }}
            >
              {BRAZIL_STATE_GRID.map((state) => {
                const count = stateMap.get(state.uf) ?? 0;
                const active = count > 0;
                const top = state.uf === topState.uf && topState.count > 0;
                const ratio = count / maxStateCount;
                return (
                  <div
                    key={state.uf}
                    className="rounded-xl flex flex-col items-center justify-center"
                    title={active ? `${state.uf}: ${count}` : state.uf}
                    style={{
                      gridColumn: state.col,
                      gridRow: state.row,
                      minWidth: "1.9rem",
                      minHeight: "1.9rem",
                      border: top ? "2px solid var(--accent)" : active ? "1px solid color-mix(in srgb, var(--accent) 36%, var(--border))" : "1px dashed color-mix(in srgb, var(--accent) 28%, var(--border))",
                      backgroundColor: active
                        ? `color-mix(in srgb, var(--accent-bg) ${70 + Math.round(ratio * 18)}%, var(--bg-card))`
                        : "transparent",
                      boxShadow: top ? "0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "0.6rem", fontWeight: 800, color: active ? "var(--text-secondary)" : "var(--text-muted)" }}>{state.uf}</span>
                    {active && (
                      <span style={{ fontSize: "0.56rem", fontWeight: 800, color: top ? "var(--accent)" : "var(--text-muted)", lineHeight: 1.1 }}>{count}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {topLocationText && (
            <p className="mt-3" style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{topLocationText}</p>
          )}
        </div>

        <div>
          <div className="mb-5">
            <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.98rem", fontWeight: 800, color: "var(--text-primary)" }}>{td("overview.gender")}</h4>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{td("overview.genderModel")}</p>
          </div>
          <div className="space-y-5">
            {genderData.map((g) => (
              <AudienceBar key={g.name} label={td(`genders.${g.name}`)} pct={g.pct} color={GENDER_COLORS[g.name]} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-5">
            <h4 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.98rem", fontWeight: 800, color: "var(--text-primary)" }}>{td("overview.age")}</h4>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{td("overview.ageModel")}</p>
          </div>
          <div className="space-y-4">
            {ageData.map((a) => (
              <AudienceBar key={a.name} label={a.name} pct={a.pct} color={AGE_BAND_COLORS[a.name] || "var(--accent)"} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-7 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-2 gap-3">
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)" }}>{td("overview.coverage")}</span>
          <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--text-primary)" }}>{coverage.coverage_pct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <div className="h-full rounded-full progress-shimmer" style={{ width: `${Math.min(coverage.coverage_pct, 100)}%` }} />
        </div>
        <p className="mt-2" style={{ fontSize: "0.66rem", color: "var(--text-faint)" }}>
          {coverage.enriched} / {coverage.total_commenters} {td("overview.commentersEnriched")} · {td("overview.profilesAnalyzed", { count: coverage.enriched })}
        </p>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #2 — SentimentByAge (guided stacked comparison)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SentimentByAgeProps {
  data: Array<{ band: string; positive: number; neutral: number; negative: number; avg_score: number; count: number }>;
}

export function SentimentByAge({ data }: SentimentByAgeProps) {
  const td = useTranslations("demographics");

  const rows = [...data]
    .filter((d) => d.count > 0 || d.positive + d.neutral + d.negative > 0)
    .sort((a, b) => sortAgeBand(a.band, b.band))
    .map((d) => {
      const total = d.positive + d.neutral + d.negative || 1;
      return {
        label: d.band,
        positive: pctOf(d.positive, total),
        neutral: pctOf(d.neutral, total),
        negative: pctOf(d.negative, total),
        avg_score: d.avg_score,
        count: d.count,
      };
    });
  const totalComments = rows.reduce((sum, row) => sum + row.count, 0);
  const best = rows.length > 0 ? rows.reduce((a, b) => (b.avg_score > a.avg_score ? b : a)) : null;
  const risk = rows.length > 0 ? rows.reduce((a, b) => (b.negative > a.negative ? b : a)) : null;

  return (
    <Section title={td("sentimentByAge.title")} subtitle={td("sentimentByAge.subtitle")} className="ui-reveal h-full">
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {best && (
            <div
              className="rounded-xl px-4 py-3"
              style={{
                backgroundColor: "color-mix(in srgb, var(--sentiment-positive-bg) 76%, var(--bg-card))",
                border: "1px solid color-mix(in srgb, var(--sentiment-positive) 22%, var(--border))",
              }}
            >
              <p style={{ fontSize: "0.63rem", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{td("strongestSignal")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <strong style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", color: "var(--text-primary)" }}>{best.label}</strong>
                <ScorePill score={best.avg_score} />
              </div>
            </div>
          )}
          {risk && (
            <div
              className="rounded-xl px-4 py-3"
              style={{
                backgroundColor: "color-mix(in srgb, var(--sentiment-negative-bg) 68%, var(--bg-card))",
                border: "1px solid color-mix(in srgb, var(--sentiment-negative) 20%, var(--border))",
              }}
            >
              <p style={{ fontSize: "0.63rem", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{td("sensitivePoint")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <strong style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", color: "var(--text-primary)" }}>{risk.label}</strong>
                <span style={{ fontSize: "0.85rem", fontWeight: 850, color: "var(--sentiment-negative)" }}>{risk.negative}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-xl px-4 py-3"
            style={{
              backgroundColor: "color-mix(in srgb, var(--bg-subtle) 64%, var(--bg-card))",
              border: "1px solid color-mix(in srgb, var(--border) 74%, transparent)",
            }}
          >
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.3rem] items-center gap-3">
              <div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", fontWeight: 850, color: "var(--text-primary)", lineHeight: 1 }}>{row.label}</p>
                <p style={{ fontSize: "0.62rem", color: "var(--text-faint)", marginTop: 4 }}>{td("commentsCount", { count: row.count })}</p>
              </div>
              <div>
                <SentimentStack positive={row.positive} neutral={row.neutral} negative={row.negative} />
                <div className="mt-2 flex items-center justify-between gap-2" style={{ fontSize: "0.66rem", color: "var(--text-muted)" }}>
                  <span>{row.positive}%</span>
                  {row.neutral > 0 && <span>{row.neutral}%</span>}
                  <span>{row.negative}%</span>
                </div>
              </div>
              <ScorePill score={row.avg_score} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <SentimentLegend td={td} />
        <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", textAlign: "center" }}>
          {td("commentsAnalyzed", { count: totalComments })}
        </p>
      </div>
    </Section>
  );
}

// #3 — SentimentByGender (guided stacked comparison)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SentimentByGenderDatum = { gender: string; positive: number; neutral: number; negative: number; avg_score: number; count: number };

export function SentimentByGender({ data }: { data: SentimentByGenderDatum[] }) {
  const td = useTranslations("demographics");

  const order = ["business", "female", "male"];
  const rows = [...data]
    .filter((d) => d.count > 0 || d.positive + d.neutral + d.negative > 0)
    .sort((a, b) => {
      const ai = order.indexOf(a.gender);
      const bi = order.indexOf(b.gender);
      if (ai === -1 && bi === -1) return a.gender.localeCompare(b.gender);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map((d) => {
      const total = d.positive + d.neutral + d.negative || 1;
      return {
        key: d.gender,
        label: td(`genders.${d.gender}`),
        positive: pctOf(d.positive, total),
        neutral: pctOf(d.neutral, total),
        negative: pctOf(d.negative, total),
        avg_score: d.avg_score,
        count: d.count,
      };
    });
  const totalComments = rows.reduce((sum, row) => sum + row.count, 0);
  const largest = rows.length > 0 ? rows.reduce((a, b) => (b.count > a.count ? b : a)) : null;
  const best = rows.length > 0 ? rows.reduce((a, b) => (b.avg_score > a.avg_score ? b : a)) : null;

  return (
    <Section title={td("sentimentByGender.title")} subtitle={td("sentimentByGender.subtitle")} className="ui-reveal h-full">
      {(largest || best) && (
        <div
          className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl p-3"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-bg) 38%, var(--bg-card))",
            border: "1px solid color-mix(in srgb, var(--accent) 18%, var(--border))",
          }}
        >
          {largest && (
            <div>
              <p style={{ fontSize: "0.63rem", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{td("largestSample")}</p>
              <p className="mt-1" style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 850, color: "var(--text-primary)" }}>{largest.label}</p>
              <p style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{td("commentsCount", { count: largest.count })}</p>
            </div>
          )}
          {best && (
            <div>
              <p style={{ fontSize: "0.63rem", fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{td("bestScore")}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1rem", fontWeight: 850, color: "var(--text-primary)" }}>{best.label}</p>
                <ScorePill score={best.avg_score} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.3rem] items-center gap-3">
            <div>
              <p style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.84rem" }}>{row.label}</p>
              <p style={{ fontSize: "0.62rem", color: "var(--text-faint)", marginTop: 2 }}>{td("commentsCount", { count: row.count })}</p>
            </div>
            <div>
              <SentimentStack positive={row.positive} neutral={row.neutral} negative={row.negative} height={14} />
              <div className="mt-1.5 grid grid-cols-3 gap-2" style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>
                <span>{row.positive}%</span>
                <span className="text-center">{row.neutral}%</span>
                <span className="text-right">{row.negative}%</span>
              </div>
            </div>
            <ScorePill score={row.avg_score} />
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <SentimentLegend td={td} />
        <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", textAlign: "center" }}>
          {td("commentsAnalyzed", { count: totalComments })}
        </p>
      </div>
    </Section>
  );
}

// #4 — EmotionsByGender (compact group comparison)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type EmotionsByGenderDatum = { gender: string; emotions: Record<string, number> };

export function EmotionsByGender({ data }: { data: EmotionsByGenderDatum[] }) {
  const td = useTranslations("demographics");

  const emotionTotals = new Map<string, number>();
  data.forEach((group) => {
    Object.entries(group.emotions).forEach(([emotion, value]) => {
      emotionTotals.set(emotion, (emotionTotals.get(emotion) ?? 0) + value);
    });
  });
  const topEmotions = Array.from(emotionTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emotion], index) => ({
      emotion,
      label: formatEmotion(emotion),
      color: EMOTION_COLORS[emotion.toLowerCase()] ?? FALLBACK_EMOTION_COLORS[index % FALLBACK_EMOTION_COLORS.length],
    }));
  const rows = data.map((group) => {
    const total = Object.values(group.emotions).reduce((a, b) => a + b, 0);
    const ranked = Object.entries(group.emotions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion, value], index) => ({
        emotion,
        label: formatEmotion(emotion),
        value,
        pct: pctOf(value, total || 1),
        color: EMOTION_COLORS[emotion.toLowerCase()] ?? FALLBACK_EMOTION_COLORS[index % FALLBACK_EMOTION_COLORS.length],
      }));
    return {
      gender: group.gender,
      label: td(`genders.${group.gender}`),
      total,
      ranked,
    };
  });
  const totalComments = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <Section title={td("emotionsByGender.title")} subtitle={td("emotionsByGender.subtitle")} className="ui-reveal h-full">
      <div className="space-y-4">
        {rows.map((row) => (
          <div
            key={row.gender}
            className="rounded-xl p-4"
            style={{
              backgroundColor: "color-mix(in srgb, var(--bg-subtle) 62%, var(--bg-card))",
              border: "1px solid color-mix(in srgb, var(--border) 72%, transparent)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: GENDER_COLORS[row.gender] || "var(--primary)" }} />
                <strong style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.98rem", color: "var(--text-primary)" }}>{row.label}</strong>
              </div>
              <span style={{ fontSize: "0.68rem", color: "var(--text-faint)" }}>{td("commentsCount", { count: row.total })}</span>
            </div>

            <div className="mt-3 flex h-3 overflow-hidden rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--accent-bg) 42%, var(--bg-card))" }}>
              {topEmotions.map((emotion) => {
                const value = row.ranked.find((item) => item.emotion === emotion.emotion)?.value ?? 0;
                return (
                  <div
                    key={emotion.emotion}
                    title={`${emotion.label}: ${pctOf(value, row.total || 1)}%`}
                    style={{ width: `${pctOf(value, row.total || 1)}%`, backgroundColor: emotion.color }}
                  />
                );
              })}
            </div>

            <div className="mt-3 space-y-2">
              {row.ranked.map((emotion) => (
                <div key={emotion.emotion} className="grid grid-cols-[1rem_minmax(0,1fr)_2.7rem] items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: emotion.color }} />
                  <span className="truncate" style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)" }}>{emotion.label}</span>
                  <span style={{ fontSize: "0.72rem", fontWeight: 850, color: "var(--text-primary)", textAlign: "right" }}>{emotion.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
        {topEmotions.slice(0, 4).map((emotion) => (
          <span key={emotion.emotion} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: emotion.color }} />
            {emotion.label}
          </span>
        ))}
      </div>
      <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", textAlign: "center", marginTop: 10 }}>
        {td("commentsAnalyzed", { count: totalComments })}
      </p>
    </Section>
  );
}

// #5 — DemographicsSummary (compact for main dashboard)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function DemographicsSummary({ genderDist, ageDist, topLocations, coverage }: DemographicsOverviewProps) {
  const { t } = useTheme();
  const td = useTranslations("demographics");
  const ta = useTranslations("charts.accessibility");
  const locale = useLocale();
  const genderChartColors: Record<string, string> = { male: t.primary, female: t.secondaryLight, business: t.accent };

  const genderData = Object.entries(genderDist).filter(([name]) => VALID_GENDERS.has(name)).map(([name, value]) => ({ name, value }));
  const ageData = Object.entries(ageDist).filter(([name]) => name in AGE_BAND_COLORS).map(([name, value]) => ({ name, value }));
  const topGender = genderData.length > 0 ? genderData.reduce((a, b) => a.value > b.value ? a : b) : null;
  const topAge = ageData.length > 0 ? ageData.reduce((a, b) => a.value > b.value ? a : b) : null;
  const topCountry = topLocations.length > 0 ? topLocations[0] : null;

  return (
    <Section title={td("summary.title")} subtitle={td("summary.subtitle")}>
      <div className="grid grid-cols-3 gap-3">
        {/* Gender */}
        <div className="text-center p-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <div data-chart-visual="dashboard-demographics-gender" aria-hidden="true">
            <ResponsiveContainer width="100%" height={80}>
              <PieChart accessibilityLayer={false}>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={22} outerRadius={34} dataKey="value" paddingAngle={2} isAnimationActive={false}>
                  {genderData.map((entry, i) => (
                    <Cell key={entry.name} fill={genderChartColors[entry.name] || t.chart[i % t.chart.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {topGender ? td(`genders.${topGender.name}`) : "-"}
          </p>
          <p style={{ fontSize: "0.58rem", color: "var(--text-faint)" }}>{td("summary.dominantGender")}</p>
        </div>
        {/* Age */}
        <div className="text-center p-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <div className="flex items-center justify-center h-[80px]">
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)" }}>
              {topAge ? topAge.name : "-"}
            </span>
          </div>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {td("summary.dominantAge")}
          </p>
          <p style={{ fontSize: "0.58rem", color: "var(--text-faint)" }}>{td("summary.ageRange")}</p>
        </div>
        {/* Country */}
        <div className="text-center p-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <div className="flex items-center justify-center h-[80px]">
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.4rem", fontWeight: 700, color: "var(--secondary)" }}>
              {topCountry ? topCountry.country_code : "-"}
            </span>
          </div>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {topCountry ? normalizeCountry(topCountry.country) : "-"}
          </p>
          <p style={{ fontSize: "0.58rem", color: "var(--text-faint)" }}>{td("summary.topCountry")}</p>
        </div>
      </div>
      {topGender && (
        <ChartTextAlternative
          chartId="dashboard-demographics-gender"
          title={td("summary.dominantGender")}
          summary={ta("dominant", {
            category: td(`genders.${topGender.name}`),
            value: formatChartNumber(topGender.value, locale, 0),
            unit: ta("units.occurrences"),
          })}
          period={ta("currentSlice")}
          unit={ta("units.occurrences")}
          columns={[
            { key: "category", label: ta("columns.series") },
            { key: "occurrences", label: ta("columns.occurrences"), numeric: true },
          ]}
          rows={genderData.map(item => ({
            category: td(`genders.${item.name}`),
            occurrences: formatChartNumber(item.value, locale, 0),
          }))}
        />
      )}
      {/* Coverage mini bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "var(--border)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(coverage.coverage_pct, 100)}%`, backgroundColor: "var(--primary)" }} />
        </div>
        <span style={{ fontSize: "0.62rem", fontWeight: 500, color: "var(--text-muted)" }}>{coverage.coverage_pct.toFixed(0)}% {td("overview.coverage").toLowerCase()}</span>
      </div>
    </Section>
  );
}
