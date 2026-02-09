"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const OPTIONS = [
  { label: "Dia", value: "day" },
  { label: "Semana", value: "week" },
  { label: "Mês", value: "month" },
];

export default function GranularitySelector({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-accent text-white"
              : "bg-surface text-text-secondary hover:bg-surface-hover"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
