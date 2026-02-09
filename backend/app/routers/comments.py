import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, asc
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.comment import Comment
from app.models.analysis import CommentAnalysis
from app.models.social_connection import SocialConnection
from app.models.user import User

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("/")
def list_comments(
    connection_id: uuid.UUID | None = Query(None),
    post_id: uuid.UUID | None = Query(None),
    sentiment: str | None = Query(None, regex="^(positive|neutral|negative)$"),
    search: str | None = Query(None),
    sort: str = Query("date", regex="^(score|likes|date)$"),
    order: str = Query("desc", regex="^(asc|desc)$"),
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
    query = (
        db.query(Comment, CommentAnalysis)
        .outerjoin(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(Comment.connection_id.in_(conn_ids))
    )

    if post_id:
        query = query.filter(Comment.post_id == post_id)

    # Sentiment filter
    if sentiment == "positive":
        query = query.filter(CommentAnalysis.score_0_10 > 6)
    elif sentiment == "neutral":
        query = query.filter(CommentAnalysis.score_0_10.between(4, 6))
    elif sentiment == "negative":
        query = query.filter(CommentAnalysis.score_0_10 < 4)

    # Text search
    if search:
        query = query.filter(Comment.text_original.ilike(f"%{search}%"))

    # Count total before pagination
    total = query.count()

    # Sorting
    order_fn = desc if order == "desc" else asc
    if sort == "score":
        query = query.order_by(order_fn(CommentAnalysis.score_0_10).nullslast())
    elif sort == "likes":
        query = query.order_by(order_fn(Comment.like_count))
    else:  # date
        query = query.order_by(order_fn(Comment.published_at).nullslast())

    results = query.offset(offset).limit(limit).all()

    items = []
    for comment, analysis in results:
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
        if analysis:
            item["analysis"] = {
                "score_0_10": analysis.score_0_10,
                "polarity": analysis.polarity,
                "intensity": analysis.intensity,
                "emotions": analysis.emotions,
                "topics": analysis.topics,
                "sarcasm": analysis.sarcasm,
                "summary_pt": analysis.summary_pt,
                "confidence": analysis.confidence,
            }
        items.append(item)

    return {"items": items, "total": total, "limit": limit, "offset": offset}
