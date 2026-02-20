export type LandingMonthlySentiment = {
  month: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
};

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export const landingMonthlySentiment: LandingMonthlySentiment[] = (() => {
  const data: LandingMonthlySentiment[] = [];
  const startYear = 2023;
  const startMonth = 1;
  const months = 37; // 2023-01 até 2026-01

  for (let i = 0; i < months; i += 1) {
    const absoluteMonth = startMonth + i;
    const year = startYear + Math.floor((absoluteMonth - 1) / 12);
    const month = ((absoluteMonth - 1) % 12) + 1;

    const seasonal = Math.round(Math.sin(i / 3) * 180);
    const total = 9800 + i * 42 + seasonal;

    const positivePct = Math.min(0.74, 0.56 + i * 0.0038);
    const neutralPct = Math.max(0.17, 0.31 - i * 0.0025);
    const negativePct = 1 - positivePct - neutralPct;

    const positive = Math.round(total * positivePct);
    const neutral = Math.round(total * neutralPct);
    const negative = Math.max(0, total - positive - neutral);

    data.push({
      month: monthKey(year, month),
      positive,
      neutral,
      negative,
      total,
    });
  }

  return data;
})();

export const landingLatestTotals = (() => {
  const latest = landingMonthlySentiment[landingMonthlySentiment.length - 1];
  if (!latest) return { positivePct: 0, neutralPct: 0, negativePct: 0, score: 0 };
  return {
    positivePct: Math.round((latest.positive / latest.total) * 100),
    neutralPct: Math.round((latest.neutral / latest.total) * 100),
    negativePct: Math.round((latest.negative / latest.total) * 100),
    score: 8.5,
  };
})();
