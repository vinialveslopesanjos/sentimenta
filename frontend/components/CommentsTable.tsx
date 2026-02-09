"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { commentsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import type { CommentWithAnalysis } from "@/lib/types";

interface Props {
  connectionId?: string;
  postId?: string;
}

function sentimentLabel(score: number | null) {
  if (score == null) return { text: "Pendente", color: "text-text-muted", bg: "bg-surface" };
  if (score > 6) return { text: "Positivo", color: "text-positive", bg: "bg-positive/10" };
  if (score >= 4) return { text: "Neutro", color: "text-neutral", bg: "bg-neutral/10" };
  return { text: "Negativo", color: "text-negative", bg: "bg-negative/10" };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export default function CommentsTable({ connectionId, postId }: Props) {
  const [comments, setComments] = useState<CommentWithAnalysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sentiment, setSentiment] = useState<string>("");
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 30;

  const fetchComments = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await commentsApi.list(token, {
        connection_id: connectionId,
        post_id: postId,
        sentiment: sentiment || undefined,
        search: search || undefined,
        sort,
        order,
        limit,
        offset,
      });
      setComments(res.items);
      setTotal(res.total);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [connectionId, postId, sentiment, sort, order, search, offset]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar comentários..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          className="h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent flex-1 min-w-[200px]"
        />
        <select
          value={sentiment}
          onChange={(e) => { setSentiment(e.target.value); setOffset(0); }}
          className="h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">Todos</option>
          <option value="positive">Positivo</option>
          <option value="neutral">Neutro</option>
          <option value="negative">Negativo</option>
        </select>
        <select
          value={`${sort}_${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split("_");
            setSort(s);
            setOrder(o);
            setOffset(0);
          }}
          className="h-9 px-3 text-sm bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="date_desc">Mais recentes</option>
          <option value="date_asc">Mais antigos</option>
          <option value="score_desc">Maior score</option>
          <option value="score_asc">Menor score</option>
          <option value="likes_desc">Mais likes</option>
        </select>
        <span className="text-xs text-text-muted ml-auto">
          {total} comentários
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="text-left p-3 text-text-secondary font-medium">Autor</th>
              <th className="text-left p-3 text-text-secondary font-medium">Comentário</th>
              <th className="text-center p-3 text-text-secondary font-medium w-16">Score</th>
              <th className="text-center p-3 text-text-secondary font-medium w-24">Sentimento</th>
              <th className="text-left p-3 text-text-secondary font-medium w-32">Emoções</th>
              <th className="text-right p-3 text-text-secondary font-medium w-16">Likes</th>
              <th className="text-right p-3 text-text-secondary font-medium w-24">Data</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="border-b border-border">
                  <td className="p-3"><Skeleton variant="text" className="h-3 w-16" /></td>
                  <td className="p-3"><Skeleton variant="text" className="h-3 w-full" /><Skeleton variant="text" className="h-3 w-2/3 mt-1" /></td>
                  <td className="p-3"><Skeleton variant="text" className="h-4 w-8 mx-auto" /></td>
                  <td className="p-3"><Skeleton variant="text" className="h-5 w-16 mx-auto rounded-full" /></td>
                  <td className="p-3"><Skeleton variant="text" className="h-4 w-20" /></td>
                  <td className="p-3"><Skeleton variant="text" className="h-3 w-8 ml-auto" /></td>
                  <td className="p-3"><Skeleton variant="text" className="h-3 w-16 ml-auto" /></td>
                </tr>
              ))
            ) : comments.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-muted">
                  Nenhum comentário encontrado
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {comments.map((c, index) => {
                  const s = sentimentLabel(c.analysis?.score_0_10 ?? null);
                  const isExpanded = expandedId === c.id;
                  return (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="border-b border-border hover:bg-surface-hover cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    >
                      <td className="p-3 text-text-primary text-xs whitespace-nowrap">
                        {c.author_name || c.author_username || "Anônimo"}
                      </td>
                      <td className="p-3 text-text-primary">
                        <div className={isExpanded ? "" : "line-clamp-2"}>
                          {c.text_original}
                        </div>
                        {isExpanded && c.analysis?.summary_pt && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="mt-2 text-xs text-accent italic"
                          >
                            IA: {c.analysis.summary_pt}
                          </motion.div>
                        )}
                        {isExpanded && c.analysis?.topics && c.analysis.topics.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="mt-1 flex gap-1 flex-wrap"
                          >
                            {c.analysis.topics.map((t, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-accent/10 text-accent rounded">
                                {t}
                              </span>
                            ))}
                          </motion.div>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span className={s.color}>
                          {c.analysis?.score_0_10 != null ? c.analysis.score_0_10.toFixed(1) : "-"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${s.bg} ${s.color}`}>
                          {s.text}
                        </span>
                        {c.analysis?.sarcasm && (
                          <span className="ml-1 text-[10px] text-neutral">ironia</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {c.analysis?.emotions?.map((e, i) => (
                            <span key={i} className="px-1.5 py-0.5 text-[10px] bg-surface-hover text-text-secondary rounded">
                              {e}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right text-text-secondary">{c.like_count}</td>
                      <td className="p-3 text-right text-text-muted text-xs whitespace-nowrap">
                        {formatDate(c.published_at)}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1.5 text-xs border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-hover disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-text-muted">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 text-xs border border-border rounded-lg bg-surface text-text-secondary hover:bg-surface-hover disabled:opacity-40"
          >
            Próximo
          </button>
        </div>
      )}
    </div>
  );
}
