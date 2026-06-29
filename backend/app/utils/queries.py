"""Shared query helpers used across routers."""

from sqlalchemy import func, select

from app.models.analysis import CommentAnalysis


def latest_analysis_subquery():
    """Return a subquery that picks the most recent valid analysis per comment.

    The subquery exposes: id, comment_id, score_0_10, polarity, intensity,
    emotions, topics, sarcasm, summary_pt, confidence, analyzed_at.

    Error rows are kept in comment_analysis for audit/debugging, but user-facing
    analytics must be based only on rows with a real score.
    """
    ranked = (
        select(
            CommentAnalysis.id.label("id"),
            CommentAnalysis.comment_id.label("comment_id"),
            CommentAnalysis.score_0_10.label("score_0_10"),
            CommentAnalysis.polarity.label("polarity"),
            CommentAnalysis.intensity.label("intensity"),
            CommentAnalysis.emotions.label("emotions"),
            CommentAnalysis.topics.label("topics"),
            CommentAnalysis.sarcasm.label("sarcasm"),
            CommentAnalysis.summary_pt.label("summary_pt"),
            CommentAnalysis.confidence.label("confidence"),
            CommentAnalysis.analyzed_at.label("analyzed_at"),
            func.row_number()
            .over(
                partition_by=CommentAnalysis.comment_id,
                order_by=(
                    CommentAnalysis.analyzed_at.desc().nullslast(),
                    CommentAnalysis.id.desc(),
                ),
            )
            .label("rn"),
        )
        .where(CommentAnalysis.score_0_10.isnot(None))
        .subquery()
    )
    return (
        select(
            ranked.c.id,
            ranked.c.comment_id,
            ranked.c.score_0_10,
            ranked.c.polarity,
            ranked.c.intensity,
            ranked.c.emotions,
            ranked.c.topics,
            ranked.c.sarcasm,
            ranked.c.summary_pt,
            ranked.c.confidence,
            ranked.c.analyzed_at,
        )
        .where(ranked.c.rn == 1)
        .subquery()
    )
