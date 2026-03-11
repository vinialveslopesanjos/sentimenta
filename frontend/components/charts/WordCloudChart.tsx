"use client";

import { useState, useEffect, useMemo } from "react";

// Stopwords PT-BR + common connectors
const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "na", "no",
  "nas", "nos", "um", "uma", "uns", "umas", "para", "por", "com", "sem",
  "que", "se", "mais", "menos", "muito", "pouco", "bem", "mal", "ja", "ainda",
  "tambem", "como", "mas", "ou", "nem", "nao", "sim", "ao", "aos", "pela",
  "pelo", "pelas", "pelos", "entre", "sobre", "ate", "isso", "isto", "esse",
  "essa", "este", "esta", "esses", "essas", "estes", "estas", "aquele", "aquela",
  "ele", "ela", "eles", "elas", "eu", "tu", "voce", "nos", "vos", "meu", "minha",
  "seu", "sua", "nosso", "nossa", "ter", "ser", "estar", "fazer", "ir", "ver",
  "the", "and", "or", "is", "are", "was", "were", "in", "on", "at", "to", "for",
  "of", "with", "from", "by", "it", "this", "that", "these", "those", "a", "an",
]);

const PALETTE = [
  "#8B5CF6", "#06B6D4", "#10B981", "#F59E0B",
  "#EC4899", "#3B82F6", "#EF4444", "#14B8A6",
  "#A855F7", "#0EA5E9", "#22C55E", "#F97316",
  "#E879F9", "#38BDF8", "#4ADE80", "#FB923C",
  "#C084FC", "#67E8F9", "#6EE7B7", "#FCD34D",
];

interface WordItem {
  text: string;
  value: number;
}

interface PlacedWord {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  value: number;
  color: string;
}

function buildWordCloud(words: WordItem[], width: number, height: number): PlacedWord[] {
  const placed: PlacedWord[] = [];
  if (words.length === 0) return placed;

  const maxFreq = Math.max(...words.map((w) => w.value));
  const minSize = 11;
  const maxSize = 42;

  const spiral = (t: number): [number, number] => {
    const a = 2.5;
    return [a * t * Math.cos(t), a * t * Math.sin(t) * 0.65];
  };

  const overlaps = (r1: PlacedWord, r2: PlacedWord) => {
    const pad = 4;
    return !(
      r1.x + r1.w / 2 + pad < r2.x - r2.w / 2 ||
      r1.x - r1.w / 2 - pad > r2.x + r2.w / 2 ||
      r1.y + r1.h / 2 + pad < r2.y - r2.h / 2 ||
      r1.y - r1.h / 2 - pad > r2.y + r2.h / 2
    );
  };

  const measureText = (text: string, fontSize: number) => ({
    w: text.length * fontSize * 0.58,
    h: fontSize * 1.2,
  });

  const sorted = [...words].sort((a, b) => b.value - a.value);

  for (let i = 0; i < sorted.length; i++) {
    const word = sorted[i];
    const fontSize = Math.round(
      minSize + Math.pow(word.value / maxFreq, 0.7) * (maxSize - minSize)
    );
    const { w, h } = measureText(word.text, fontSize);
    const color = PALETTE[i % PALETTE.length];
    let wasPlaced = false;

    for (let t = 0; t < 200; t += 0.15) {
      const [sx, sy] = spiral(t);
      const cx = width / 2 + sx;
      const cy = height / 2 + sy;
      const candidate: PlacedWord = { x: cx, y: cy, w, h, text: word.text, fontSize, value: word.value, color };

      const margin = 20;
      if (
        cx - w / 2 < margin || cx + w / 2 > width - margin ||
        cy - h / 2 < margin || cy + h / 2 > height - margin
      ) continue;

      if (!placed.some((p) => overlaps(p, candidate))) {
        placed.push(candidate);
        wasPlaced = true;
        break;
      }
    }

    if (!wasPlaced) {
      placed.push({
        x: 20 + Math.random() * (width - 40),
        y: 20 + Math.random() * (height - 40),
        w, h,
        text: word.text,
        fontSize: minSize,
        value: word.value,
        color,
      });
    }
  }

  return placed;
}

interface Props {
  topics: Record<string, number> | null;
  maxWords?: number;
  height?: number;
  filterStopwords?: boolean;
}

export default function WordCloudChart({
  topics,
  maxWords = 20,
  height = 280,
  filterStopwords = true,
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 520;
  const H = height;

  const words = useMemo(() => {
    if (!topics || Object.keys(topics).length === 0) return [];

    return Object.entries(topics)
      .filter(([text]) => {
        if (!filterStopwords) return true;
        return !STOPWORDS.has(text.toLowerCase()) && text.length > 1;
      })
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxWords)
      .map(([text, value]) => ({ text, value }));
  }, [topics, maxWords, filterStopwords]);

  const placed = useMemo(() => buildWordCloud(words, W, H), [words, W, H]);

  if (!topics || Object.keys(topics).length === 0 || placed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-200 gap-2" style={{ height }}>
        <span className="material-symbols-outlined text-[36px]">cloud</span>
        <p className="text-sm font-light">Sem dados de palavras</p>
      </div>
    );
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block select-none">
      <defs>
        <filter id="wordGlow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {placed.map((w, i) => (
        <text
          key={`${w.text}-${i}`}
          x={w.x}
          y={w.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={w.fontSize}
          fill={w.color}
          fontFamily="Outfit, sans-serif"
          fontWeight={w.fontSize > 28 ? 700 : 500}
          filter={hovered === i ? "url(#wordGlow)" : "none"}
          opacity={hovered !== null && hovered !== i ? 0.3 : 1}
          style={{ cursor: "pointer", transition: "opacity 0.2s, filter 0.2s" }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          {w.text}
        </text>
      ))}
      {hovered !== null && placed[hovered] && (
        <g>
          <rect
            x={placed[hovered].x - 28}
            y={placed[hovered].y - placed[hovered].fontSize - 18}
            width={56}
            height={18}
            rx={6}
            fill="rgba(30,41,59,0.9)"
          />
          <text
            x={placed[hovered].x}
            y={placed[hovered].y - placed[hovered].fontSize - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fill="#fff"
            fontFamily="Outfit, sans-serif"
          >
            {placed[hovered].value}x
          </text>
        </g>
      )}
    </svg>
  );
}
