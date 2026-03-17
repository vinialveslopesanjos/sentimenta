import { sentiment } from "./tokens";

interface SentimentBarProps {
  positive: number;
  neutral: number;
  negative: number;
  height?: number;
  showLabels?: boolean;
}

export function SentimentBar({ positive, neutral, negative, height = 8, showLabels = false }: SentimentBarProps) {
  const total = positive + neutral + negative;
  const pPct = Math.round((positive / total) * 100);
  const nPct = Math.round((neutral / total) * 100);
  const negPct = 100 - pPct - nPct;

  return (
    <div>
      <div className="flex overflow-hidden" style={{ height, borderRadius: height / 2 }}>
        <div style={{ width: `${pPct}%`, backgroundColor: sentiment.positive.color }} className="transition-all duration-500" />
        <div style={{ width: `${nPct}%`, backgroundColor: sentiment.neutral.color }} className="transition-all duration-500" />
        <div style={{ width: `${negPct}%`, backgroundColor: sentiment.negative.color }} className="transition-all duration-500" />
      </div>
      {showLabels && (
        <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
          {[
            { ...sentiment.positive, pct: pPct },
            { ...sentiment.neutral, pct: nPct },
            { ...sentiment.negative, pct: negPct },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
                {s.pct}% {s.label.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
