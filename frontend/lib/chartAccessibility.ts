export interface TrendFact {
  start: string;
  end: string;
  from: number;
  to: number;
  delta: number;
  direction: "up" | "down" | "stable";
}

export function getTrendFact<T>(
  rows: T[],
  period: (row: T) => string,
  value: (row: T) => number | null | undefined,
): TrendFact | null {
  const valid = rows
    .map((row) => ({ period: period(row), value: value(row) }))
    .filter((point): point is { period: string; value: number } => Number.isFinite(point.value));

  if (valid.length === 0) return null;
  const first = valid[0];
  const last = valid[valid.length - 1];
  const delta = Number((last.value - first.value).toFixed(2));

  return {
    start: first.period,
    end: last.period,
    from: first.value,
    to: last.value,
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "stable",
  };
}

export function getPeakFact<T>(
  rows: T[],
  period: (row: T) => string,
  value: (row: T) => number | null | undefined,
): { period: string; value: number } | null {
  return rows.reduce<{ period: string; value: number } | null>((peak, row) => {
    const nextValue = value(row);
    if (!Number.isFinite(nextValue)) return peak;
    if (!peak || Number(nextValue) > peak.value) {
      return { period: period(row), value: Number(nextValue) };
    }
    return peak;
  }, null);
}

export function formatChartNumber(value: number, locale: string, maximumFractionDigits = 1) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

export function getPeriodRange<T>(rows: T[], period: (row: T) => string, fallback: string) {
  if (rows.length === 0) return fallback;
  const start = period(rows[0]);
  const end = period(rows[rows.length - 1]);
  return start === end ? start : `${start} — ${end}`;
}
