import type { TrendDataPoint } from "@sentimenta/types";

export type ComparisonTimelinePoint = {
  period: string;
  profileA: number | null;
  profileB: number | null;
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function validUtcPeriod(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return new Date(timestamp).toISOString().slice(0, 10) === value;
}

function scoreMap(points: TrendDataPoint[]): Map<string, number | null> {
  const candidates = new Map<string, Set<string>>();

  for (const point of points) {
    if (!validUtcPeriod(point.period)) continue;
    const score = typeof point.avg_score === "number" && Number.isFinite(point.avg_score)
      ? String(point.avg_score)
      : "null";
    const values = candidates.get(point.period) ?? new Set<string>();
    values.add(score);
    candidates.set(point.period, values);
  }

  return new Map(
    Array.from(candidates.entries()).map(([period, values]) => {
      if (values.size !== 1) return [period, null];
      const [value] = Array.from(values);
      return [period, value === "null" ? null : Number(value)];
    }),
  );
}

/**
 * Builds one shared categorical axis for Recharts. Duplicate equal points are
 * collapsed; conflicting duplicates become unknown instead of picking a value
 * based on arrival order.
 */
export function buildComparisonTimeline(
  profileA: TrendDataPoint[],
  profileB: TrendDataPoint[],
): ComparisonTimelinePoint[] {
  const scoresA = scoreMap(profileA);
  const scoresB = scoreMap(profileB);
  const periods = Array.from(new Set(
    Array.from(scoresA.keys()).concat(Array.from(scoresB.keys())),
  )).sort();

  return periods.map(period => ({
    period,
    profileA: scoresA.get(period) ?? null,
    profileB: scoresB.get(period) ?? null,
  }));
}

export function formatUtcPeriod(
  period: string,
  locale: string,
  dateStyle: "short" | "medium" = "short",
): string {
  const match = ISO_DATE.exec(period);
  if (!match || !validUtcPeriod(period)) return period;
  const [, year, month, day] = match;
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: dateStyle === "short" ? "2-digit" : "short",
    year: dateStyle === "medium" ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(value);
}
