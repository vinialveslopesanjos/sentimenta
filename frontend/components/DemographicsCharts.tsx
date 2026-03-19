"use client";

import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ComposedChart, Line,
} from "recharts";
import { useTranslations } from "next-intl";
import { Section } from "./ds/Section";
import { Badge } from "./ds/Badge";
import { useTheme } from "./ThemeContext";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DemographicsOverviewProps {
  genderDist: Record<string, number>;
  ageDist: Record<string, number>;
  topLocations: Array<{ country: string; country_code: string; count: number }>;
  coverage: { total_commenters: number; enriched: number; coverage_pct: number };
}

const GENDER_COLORS: Record<string, string> = { male: '#4F8CF7', female: '#E95FBD', business: '#8B5CF6' };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #1 — DemographicsOverview
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function DemographicsOverview({ genderDist, ageDist, topLocations, coverage }: DemographicsOverviewProps) {
  const { t } = useTheme();
  const td = useTranslations("demographics");

  const genderData = Object.entries(genderDist).map(([name, value]) => ({ name, value }));
  const ageData = Object.entries(ageDist).map(([name, value]) => ({ name, value }));
  const locationData = topLocations.slice(0, 5).map(l => ({ name: l.country, value: l.count }));

  return (
    <Section title={td("overview.title")} subtitle={td("overview.subtitle")}>
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="primary">{td("insightLabel")}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gender donut */}
        <div className="text-center">
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{td("overview.gender")}</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={genderData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                {genderData.map((entry, i) => (
                  <Cell key={entry.name} fill={GENDER_COLORS[entry.name] || t.chart[i % t.chart.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.75rem", backgroundColor: t.bgCard }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-3 flex-wrap mt-1">
            {genderData.map((g, i) => (
              <span key={g.name} className="flex items-center gap-1" style={{ fontSize: "0.65rem" }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GENDER_COLORS[g.name] || t.chart[i % t.chart.length] }} />
                <span style={{ color: "var(--text-muted)" }}>{td(`genders.${g.name}`)}</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{g.value}</span>
              </span>
            ))}
          </div>
        </div>
        {/* Age donut */}
        <div className="text-center">
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{td("overview.age")}</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={ageData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                {ageData.map((_, i) => (
                  <Cell key={i} fill={t.chart[i % t.chart.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.75rem", backgroundColor: t.bgCard }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
            {ageData.map((a, i) => (
              <span key={a.name} className="flex items-center gap-1" style={{ fontSize: "0.62rem" }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.chart[i % t.chart.length] }} />
                <span style={{ color: "var(--text-muted)" }}>{a.name}</span>
              </span>
            ))}
          </div>
        </div>
        {/* Locations donut */}
        <div className="text-center">
          <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>{td("overview.locations")}</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={locationData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                {locationData.map((_, i) => (
                  <Cell key={i} fill={t.chart[i % t.chart.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.75rem", backgroundColor: t.bgCard }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
            {locationData.map((l, i) => (
              <span key={l.name} className="flex items-center gap-1" style={{ fontSize: "0.62rem" }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.chart[i % t.chart.length] }} />
                <span style={{ color: "var(--text-muted)" }}>{l.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Coverage bar */}
      <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--text-muted)" }}>{td("overview.coverage")}</span>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-primary)" }}>{coverage.coverage_pct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: "var(--border)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(coverage.coverage_pct, 100)}%`, backgroundColor: "var(--primary)" }} />
        </div>
        <p className="mt-1" style={{ fontSize: "0.62rem", color: "var(--text-faint)" }}>
          {coverage.enriched} / {coverage.total_commenters} {td("overview.commentersEnriched")}
        </p>
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #2 — SentimentByAge (ComposedChart: stacked bar + line)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SentimentByAgeProps {
  data: Array<{ band: string; positive: number; neutral: number; negative: number; avg_score: number; count: number }>;
}

export function SentimentByAge({ data }: SentimentByAgeProps) {
  const { t } = useTheme();
  const td = useTranslations("demographics");

  return (
    <Section title={td("sentimentByAge.title")} subtitle={td("sentimentByAge.subtitle")}>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false} />
          <XAxis dataKey="band" tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} />
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
          <Bar yAxisId="left" dataKey="positive" name={td("positive")} fill={t.sentimentPositive} stackId="sent" radius={[0, 0, 0, 0]} />
          <Bar yAxisId="left" dataKey="neutral" name={td("neutral")} fill={t.sentimentNeutral} stackId="sent" radius={[0, 0, 0, 0]} />
          <Bar yAxisId="left" dataKey="negative" name={td("negative")} fill={t.sentimentNegative} stackId="sent" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="avg_score" name="Score" stroke={t.primary} strokeWidth={2.5} dot={{ r: 3, fill: t.primary, strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #3 — SentimentByGender (horizontal 100% stacked bar)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function SentimentByGender({ data }: { data: Array<{ gender: string; positive: number; neutral: number; negative: number; avg_score: number; count: number }> }) {
  const { t } = useTheme();
  const td = useTranslations("demographics");

  const chartData = data.map(d => {
    const total = d.positive + d.neutral + d.negative || 1;
    return {
      gender: td(`genders.${d.gender}`),
      positive: Math.round((d.positive / total) * 100),
      neutral: Math.round((d.neutral / total) * 100),
      negative: Math.round((d.negative / total) * 100),
      avg_score: d.avg_score,
      count: d.count,
    };
  });

  return (
    <Section title={td("sentimentByGender.title")} subtitle={td("sentimentByGender.subtitle")}>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 50 + 40)}>
        <BarChart data={chartData} layout="vertical" barSize={24}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.border} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: t.textFaint }} axisLine={false} tickLine={false} unit="%" />
          <YAxis type="category" dataKey="gender" tick={{ fontSize: 11, fill: t.textPrimary, fontWeight: 500 }} axisLine={false} tickLine={false} width={80} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.78rem", backgroundColor: t.bgCard }} formatter={(value: number) => `${value}%`} />
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
          <Bar dataKey="positive" name={td("positive")} fill={t.sentimentPositive} stackId="sent" radius={[0, 0, 0, 0]} />
          <Bar dataKey="neutral" name={td("neutral")} fill={t.sentimentNeutral} stackId="sent" radius={[0, 0, 0, 0]} />
          <Bar dataKey="negative" name={td("negative")} fill={t.sentimentNegative} stackId="sent" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      {/* Score badges */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {data.map(d => (
          <span key={d.gender} className="flex items-center gap-1.5" style={{ fontSize: "0.68rem" }}>
            <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>{td(`genders.${d.gender}`)}</span>
            <span className="px-1.5 py-0.5 rounded" style={{ fontWeight: 700, fontSize: "0.65rem", color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>
              {d.avg_score.toFixed(1)}
            </span>
            <span style={{ color: "var(--text-faint)" }}>({d.count})</span>
          </span>
        ))}
      </div>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #4 — EmotionsByGender (RadarChart)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function EmotionsByGender({ data }: { data: Array<{ gender: string; emotions: Record<string, number> }> }) {
  const { t } = useTheme();
  const td = useTranslations("demographics");

  const allEmotions = Array.from(new Set(data.flatMap(d => Object.keys(d.emotions))));

  const radarData = allEmotions.map(emotion => {
    const point: Record<string, string | number> = { emotion };
    data.forEach(d => {
      const total = Object.values(d.emotions).reduce((a, b) => a + b, 0) || 1;
      point[d.gender] = Math.round((d.emotions[emotion] || 0) / total * 100);
    });
    return point;
  });

  return (
    <Section title={td("emotionsByGender.title")} subtitle={td("emotionsByGender.subtitle")}>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="emotion" tick={{ fontSize: 9, fill: "var(--text-muted)" }} />
          {data.map((d, i) => (
            <Radar
              key={d.gender}
              dataKey={d.gender}
              name={td(`genders.${d.gender}`)}
              stroke={GENDER_COLORS[d.gender] || t.chart[i]}
              fill={GENDER_COLORS[d.gender] || t.chart[i]}
              fillOpacity={0.1}
              strokeWidth={2}
            />
          ))}
          <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: "0.72rem" }} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: "0.75rem", backgroundColor: t.bgCard }} />
        </RadarChart>
      </ResponsiveContainer>
    </Section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #5 — DemographicsSummary (compact for main dashboard)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function DemographicsSummary({ genderDist, ageDist, topLocations, coverage }: DemographicsOverviewProps) {
  const { t } = useTheme();
  const td = useTranslations("demographics");

  const genderData = Object.entries(genderDist).map(([name, value]) => ({ name, value }));
  const ageData = Object.entries(ageDist).map(([name, value]) => ({ name, value }));
  const topGender = genderData.length > 0 ? genderData.reduce((a, b) => a.value > b.value ? a : b) : null;
  const topAge = ageData.length > 0 ? ageData.reduce((a, b) => a.value > b.value ? a : b) : null;
  const topCountry = topLocations.length > 0 ? topLocations[0] : null;

  return (
    <Section title={td("summary.title")} subtitle={td("summary.subtitle")}>
      <div className="grid grid-cols-3 gap-3">
        {/* Gender */}
        <div className="text-center p-3 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)" }}>
          <ResponsiveContainer width="100%" height={80}>
            <PieChart>
              <Pie data={genderData} cx="50%" cy="50%" innerRadius={22} outerRadius={34} dataKey="value" paddingAngle={2}>
                {genderData.map((entry, i) => (
                  <Cell key={entry.name} fill={GENDER_COLORS[entry.name] || t.chart[i % t.chart.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
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
            {topCountry ? topCountry.country : "-"}
          </p>
          <p style={{ fontSize: "0.58rem", color: "var(--text-faint)" }}>{td("summary.topCountry")}</p>
        </div>
      </div>
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
