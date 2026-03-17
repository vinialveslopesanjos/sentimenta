import { Section } from "./ds/Section";
import { getScoreStyle } from "./ds/tokens";
import { useTheme } from "./ThemeContext";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
const heatmapHours = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"];

interface HeatmapProps { data: number[][]; title?: string; }

export function Heatmap({ data, title }: HeatmapProps) {
  const { t } = useTheme();
  const tc = useTranslations("charts");
  const heatmapDays = tc.raw("heatmap.days") as string[];
  const displayTitle = title ?? tc("heatmap.title");
  function getHeatColor(value: number) {
    if (value >= 40) return t.primary;
    if (value >= 30) return t.primaryMuted;
    if (value >= 20) return t.primaryFaint;
    if (value >= 10) return t.textXfaint;
    return t.primaryBg;
  }
  return (
    <Section title={displayTitle} subtitle={tc("heatmap.subtitle")}>
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="flex gap-1 mb-1 pl-10">
            {heatmapHours.map(h => <div key={h} className="flex-1 text-center" style={{ fontSize: "0.62rem", color: "var(--text-faint)", fontWeight: 500 }}>{h}h</div>)}
          </div>
          {heatmapDays.map((day, di) => (
            <div key={day} className="flex gap-1 mb-1 items-center">
              <span className="w-8 shrink-0 text-right pr-2" style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 500 }}>{day}</span>
              {data[di].map((val, hi) => (
                <div key={hi} className="flex-1 rounded-md transition-all hover:scale-110 cursor-default" style={{ height: 28, backgroundColor: getHeatColor(val) }} title={`${day} ${heatmapHours[hi]}h — ${val} com.`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

interface FeaturedComment { user: string; text: string; emotion: string; score: number; }

export function FeaturedComments({ comments }: { comments: FeaturedComment[] }) {
  const tc = useTranslations("charts");
  return (
    <Section title={tc("featuredComments.title")} subtitle={tc("featuredComments.subtitle")}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {comments.map((c, i) => {
          const ss = getScoreStyle(c.score);
          return (
            <div key={i} className="rounded-xl p-4 transition-colors cursor-pointer" style={{ backgroundColor: "var(--bg-subtle)" }}>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "0.68rem", fontWeight: 600, color: ss.color, backgroundColor: ss.bg }}>{c.score.toFixed(1)}</span>
                <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>@{c.user}</span>
                <span className="ml-auto px-2 py-0.5 rounded-md" style={{ fontSize: "0.62rem", fontWeight: 600, color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>{c.emotion}</span>
              </div>
              <p style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "var(--text-muted)" }}>"{c.text}"</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Comments Table ───────────────────────
export interface CommentRow {
  user: string;
  text: string;
  emotion: string;
  score: number;
  date: string;
  post: string;
  sentiment: "Positivo" | "Neutro" | "Negativo";
}

// Emotion color coding helper
const POSITIVE_EMOTIONS = ["alegria", "amor", "surpresa"];
const NEGATIVE_EMOTIONS = ["tristeza", "raiva", "nojo", "medo"];

function getEmotionColor(emotion: string): { color: string; bg: string } {
  const lower = emotion.toLowerCase();
  if (POSITIVE_EMOTIONS.includes(lower)) {
    return { color: "var(--sentiment-positive)", bg: "var(--sentiment-positive-bg, rgba(34,197,94,0.12))" };
  }
  if (NEGATIVE_EMOTIONS.includes(lower)) {
    return { color: "var(--sentiment-negative)", bg: "var(--sentiment-negative-bg, rgba(239,68,68,0.12))" };
  }
  // Neutro or unknown
  return { color: "var(--text-muted)", bg: "var(--bg-subtle)" };
}

export function CommentsTable({ comments, platformName }: { comments: CommentRow[]; platformName: string }) {
  const tc = useTranslations("charts");
  const [filter, setFilter] = useState("Todos");
  const [emotionFilter, setEmotionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  const filtered = comments.filter(c => {
    if (filter !== "Todos" && c.sentiment !== filter) return false;
    if (emotionFilter && c.emotion.toLowerCase() !== emotionFilter.toLowerCase()) return false;
    if (search && !c.text.toLowerCase().includes(search.toLowerCase()) && !c.user.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const visibleRows = filtered.slice(0, visibleCount);

  return (
    <Section title={tc("commentsTable.title", { platform: platformName })} subtitle={tc("commentsTable.subtitle")} action={
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
          <Search className="w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="bg-transparent focus:outline-none w-28" style={{ fontSize: "0.78rem", color: "var(--text-primary)" }} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.78rem", border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
          <option>Todos</option><option>Positivo</option><option>Neutro</option><option>Negativo</option>
        </select>
        <select value={emotionFilter} onChange={e => setEmotionFilter(e.target.value)} className="px-3 py-1.5 rounded-xl focus:outline-none transition-all duration-200 cursor-pointer hover:opacity-80" style={{ fontSize: "0.78rem", border: "0.5px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-card) 60%, transparent)", backdropFilter: "blur(12px)", color: "var(--text-primary)", boxShadow: "0 2px 8px -2px rgba(0,0,0,0.05)" }}>
          <option value="">Todas emoções</option>
          {["Alegria", "Tristeza", "Raiva", "Surpresa", "Nojo", "Medo", "Amor"].map(em => (
            <option key={em} value={em}>{em}</option>
          ))}
        </select>
      </div>
    }>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: "0.78rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="text-left py-2.5 px-3" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{tc("commentsTable.headerScore")}</th>
              <th className="text-left py-2.5 px-3" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{tc("commentsTable.headerUser")}</th>
              <th className="text-left py-2.5 px-3" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{tc("commentsTable.headerComment")}</th>
              <th className="text-left py-2.5 px-3 hidden md:table-cell" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{tc("commentsTable.headerEmotion")}</th>
              <th className="text-left py-2.5 px-3 hidden md:table-cell" style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.68rem", letterSpacing: "0.05em" }}>{tc("commentsTable.headerDate")}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((c, i) => {
              const ss = getScoreStyle(c.score);
              const emotionStyle = getEmotionColor(c.emotion);
              return (
                <tr key={i} className="transition-colors" style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "0.68rem", fontWeight: 600, color: ss.color, backgroundColor: ss.bg }}>{c.score.toFixed(1)}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>@{c.user}</span>
                  </td>
                  <td className="py-2.5 px-3 max-w-[300px]">
                    <p className="truncate" style={{ color: "var(--text-muted)" }}>{c.text}</p>
                  </td>
                  <td className="py-2.5 px-3 hidden md:table-cell">
                    <span className="px-2 py-0.5 rounded-md" style={{ fontSize: "0.62rem", fontWeight: 600, color: emotionStyle.color, backgroundColor: emotionStyle.bg }}>{c.emotion}</span>
                  </td>
                  <td className="py-2.5 px-3 hidden md:table-cell">
                    <span style={{ color: "var(--text-faint)", fontSize: "0.72rem" }}>{c.date}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between mt-3 px-3">
          <span style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>
            {tc("commentsTable.showing", { visible: visibleRows.length, total: filtered.length })}
          </span>
          {visibleCount < filtered.length && (
            <button
              onClick={() => setVisibleCount(prev => prev + 20)}
              className="px-4 py-1.5 rounded-xl transition-all duration-200 hover:opacity-80"
              style={{
                fontSize: "0.78rem",
                fontWeight: 500,
                color: "var(--primary)",
                backgroundColor: "var(--primary-bg)",
                border: "1px solid var(--primary)",
              }}
            >
              {tc("commentsTable.showMore")}
            </button>
          )}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8" style={{ color: "var(--text-faint)", fontSize: "0.82rem" }}>{tc("commentsTable.noCommentFound")}</div>
        )}
      </div>
    </Section>
  );
}