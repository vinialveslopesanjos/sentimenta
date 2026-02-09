"use client";

interface Props {
  topics: Record<string, number> | null;
}

export default function TopicsChart({ topics }: Props) {
  if (!topics || Object.keys(topics).length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        Sem dados de tópicos
      </div>
    );
  }

  const sorted = Object.entries(topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const max = sorted[0]?.[1] || 1;

  return (
    <div className="space-y-2">
      {sorted.map(([topic, count]) => (
        <div key={topic} className="flex items-center gap-2">
          <span className="text-xs text-text-secondary w-24 truncate text-right">
            {topic}
          </span>
          <div className="flex-1 h-5 bg-surface rounded-sm overflow-hidden">
            <div
              className="h-full bg-accent rounded-sm transition-all"
              style={{ width: `${(count / max) * 100}%`, opacity: 0.7 + (count / max) * 0.3 }}
            />
          </div>
          <span className="text-xs text-text-muted w-8 text-right">{count}</span>
        </div>
      ))}
    </div>
  );
}
