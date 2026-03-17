import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, asc, and_, or_, select, func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.comment import Comment
from app.models.analysis import CommentAnalysis
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.utils.queries import latest_analysis_subquery as _latest_analysis_subquery
import sqlalchemy.types as types

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("")
def list_comments(
    connection_id: uuid.UUID | None = Query(None),
    post_id: uuid.UUID | None = Query(None),
    sentiment: str | None = Query(None, pattern="^(positive|neutral|negative)$"),
    search: str | None = Query(None),
    sort: str = Query("date", pattern="^(score|likes|date)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get user's connection IDs
    conn_query = db.query(SocialConnection.id).filter(
        SocialConnection.user_id == current_user.id
    )
    if connection_id:
        conn_query = conn_query.filter(SocialConnection.id == connection_id)
    conn_ids = [c.id for c in conn_query.all()]

    if not conn_ids:
        return {"items": [], "total": 0, "limit": limit, "offset": offset}

    # Base query: comments with analysis LEFT JOIN
    latest_analysis = _latest_analysis_subquery()
    query = (
        db.query(
            Comment,
            latest_analysis.c.id.label("analysis_id"),
            latest_analysis.c.score_0_10.label("analysis_score_0_10"),
            latest_analysis.c.polarity.label("analysis_polarity"),
            latest_analysis.c.intensity.label("analysis_intensity"),
            latest_analysis.c.emotions.label("analysis_emotions"),
            latest_analysis.c.topics.label("analysis_topics"),
            latest_analysis.c.sarcasm.label("analysis_sarcasm"),
            latest_analysis.c.summary_pt.label("analysis_summary_pt"),
            latest_analysis.c.confidence.label("analysis_confidence"),
        )
        .outerjoin(
            latest_analysis,
            and_(
                latest_analysis.c.comment_id == Comment.id,
            ),
        )
        .join(SocialConnection, Comment.connection_id == SocialConnection.id)
        .filter(Comment.connection_id.in_(conn_ids))
        .filter(
            or_(
                SocialConnection.ignore_author_comments == False,
                func.lower(Comment.author_username) != func.lower(SocialConnection.username),
                Comment.author_username == None
            )
        )
    )

    if post_id:
        query = query.filter(Comment.post_id == post_id)

    # Sentiment filter
    if sentiment == "positive":
        query = query.filter(latest_analysis.c.score_0_10 > 6)
    elif sentiment == "neutral":
        query = query.filter(latest_analysis.c.score_0_10.between(4, 6))
    elif sentiment == "negative":
        query = query.filter(latest_analysis.c.score_0_10 < 4)

    # Text search
    if search:
        search_lower = search.lower()
        sentiment_conds = []
        if "positiv" in search_lower:
            sentiment_conds.append(latest_analysis.c.score_0_10 > 6)
        if "neutro" in search_lower or "neutra" in search_lower:
            sentiment_conds.append(latest_analysis.c.score_0_10.between(4, 6))
        if "negativ" in search_lower:
            sentiment_conds.append(latest_analysis.c.score_0_10 < 4)
            
        from sqlalchemy.sql.expression import cast
        query = query.filter(
            or_(
                Comment.text_original.ilike(f"%{search}%"),
                cast(latest_analysis.c.emotions, types.String).ilike(f"%{search}%"),
                cast(latest_analysis.c.topics, types.String).ilike(f"%{search}%"),
                *sentiment_conds
            )
        )

    # Count total before pagination
    total = query.count()

    # Sorting
    order_fn = desc if order == "desc" else asc
    if sort == "score":
        score_sort = func.coalesce(latest_analysis.c.score_0_10, -1)
        query = query.order_by(order_fn(score_sort))
    elif sort == "likes":
        query = query.order_by(order_fn(Comment.like_count))
    else:  # date
        query = query.order_by(order_fn(Comment.published_at).nullslast())

    results = query.offset(offset).limit(limit).all()

    items = []
    for (
        comment,
        analysis_id,
        analysis_score_0_10,
        analysis_polarity,
        analysis_intensity,
        analysis_emotions,
        analysis_topics,
        analysis_sarcasm,
        analysis_summary_pt,
        analysis_confidence,
    ) in results:
        item = {
            "id": str(comment.id),
            "author_name": comment.author_name,
            "author_username": comment.author_username,
            "text_original": comment.text_original,
            "like_count": comment.like_count,
            "reply_count": comment.reply_count,
            "published_at": comment.published_at.isoformat() if comment.published_at else None,
            "platform": comment.platform,
            "status": comment.status,
            "analysis": None,
        }
        if analysis_id is not None:
            item["analysis"] = {
                "score_0_10": analysis_score_0_10,
                "polarity": analysis_polarity,
                "intensity": analysis_intensity,
                "emotions": analysis_emotions,
                "topics": analysis_topics,
                "sarcasm": analysis_sarcasm,
                "summary_pt": analysis_summary_pt,
                "confidence": analysis_confidence,
            }
        items.append(item)

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/top")
def top_comments(
    connection_id: uuid.UUID | None = Query(None),
    limit: int = Query(5, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return top N most positive and most negative comments by score."""
    conn_query = db.query(SocialConnection.id).filter(
        SocialConnection.user_id == current_user.id
    )
    if connection_id:
        conn_query = conn_query.filter(SocialConnection.id == connection_id)
    conn_ids = [c.id for c in conn_query.all()]

    if not conn_ids:
        return {"most_positive": [], "most_negative": []}

    latest_analysis = _latest_analysis_subquery()

    def _query_top(order_fn):
        rows = (
            db.query(
                Comment,
                latest_analysis.c.score_0_10.label("score"),
                latest_analysis.c.polarity.label("polarity"),
                latest_analysis.c.emotions.label("emotions"),
                latest_analysis.c.topics.label("topics"),
                latest_analysis.c.summary_pt.label("summary_pt"),
            )
            .join(latest_analysis, latest_analysis.c.comment_id == Comment.id)
            .join(SocialConnection, Comment.connection_id == SocialConnection.id)
            .filter(
                Comment.connection_id.in_(conn_ids),
                latest_analysis.c.score_0_10.isnot(None),
            )
            .filter(
                or_(
                    SocialConnection.ignore_author_comments == False,
                    func.lower(Comment.author_username) != func.lower(SocialConnection.username),
                    Comment.author_username == None
                )
            )
            .order_by(order_fn(latest_analysis.c.score_0_10))
            .limit(limit)
            .all()
        )
        return [
            {
                "id": str(comment.id),
                "author_name": comment.author_name,
                "author_username": comment.author_username,
                "text_original": comment.text_original,
                "like_count": comment.like_count,
                "published_at": comment.published_at.isoformat() if comment.published_at else None,
                "platform": comment.platform,
                "score": score,
                "polarity": polarity,
                "emotions": emotions,
                "topics": topics,
                "summary_pt": summary_pt,
            }
            for comment, score, polarity, emotions, topics, summary_pt in rows
        ]

    most_positive = _query_top(desc)
    most_negative = _query_top(asc)

    return {"most_positive": most_positive, "most_negative": most_negative}
