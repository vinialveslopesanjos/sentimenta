import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.comment import Comment
from app.models.analysis import CommentAnalysis, PostAnalysisSummary
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.services.media_cache_service import cache_remote_image
from app.schemas.post import (
    AnalysisResponse,
    CommentResponse,
    PostDetailResponse,
    PostResponse,
)

router = APIRouter(prefix="/posts", tags=["posts"])


def _latest_analysis_subquery():
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
        ).subquery()
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


@router.get("/thumbnail")
def get_thumbnail_proxy(url: str = Query(..., min_length=5)):
    cached = cache_remote_image(url)
    if not cached or not cached.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(
        cached,
        media_type="image/*",
        headers={"Cache-Control": "public, max-age=604800"},
    )


@router.get("/", response_model=list[PostResponse])
def list_posts(
    connection_id: uuid.UUID | None = Query(None),
    platform: str | None = Query(None),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get user's connection IDs
    conn_query = db.query(SocialConnection.id).filter(
        SocialConnection.user_id == current_user.id
    )
    if connection_id:
        conn_query = conn_query.filter(SocialConnection.id == connection_id)

    user_conn_ids = [c.id for c in conn_query.all()]
    if not user_conn_ids:
        return []

    query = db.query(Post).filter(Post.connection_id.in_(user_conn_ids))
    if platform:
        query = query.filter(Post.platform == platform)

    posts = (
        query.order_by(Post.published_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return posts


@router.get("/{post_id}", response_model=PostDetailResponse)
def get_post_detail(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Verify ownership
    conn = db.query(SocialConnection).filter(
        SocialConnection.id == post.connection_id,
        SocialConnection.user_id == current_user.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = (
        db.query(Comment)
        .filter(Comment.post_id == post_id)
        .order_by(Comment.like_count.desc())
        .all()
    )

    comment_ids = [c.id for c in comments]
    analyses = []
    if comment_ids:
        latest_analysis = _latest_analysis_subquery()
        rows = (
            db.query(latest_analysis)
            .filter(latest_analysis.c.comment_id.in_(comment_ids))
            .all()
        )
        analyses = [
            {
                "comment_id": row.comment_id,
                "score_0_10": row.score_0_10,
                "polarity": row.polarity,
                "intensity": row.intensity,
                "emotions": row.emotions,
                "topics": row.topics,
                "sarcasm": row.sarcasm,
                "summary_pt": row.summary_pt,
                "confidence": row.confidence,
            }
            for row in rows
        ]

    summary_row = (
        db.query(PostAnalysisSummary)
        .filter(PostAnalysisSummary.post_id == post_id)
        .first()
    )
    summary = None
    if summary_row:
        summary = {
            "total_comments": summary_row.total_comments,
            "total_analyzed": summary_row.total_analyzed,
            "avg_score": summary_row.avg_score,
            "avg_polarity": summary_row.avg_polarity,
            "avg_intensity": summary_row.avg_intensity,
            "weighted_score": summary_row.weighted_score,
            "emotions_distribution": summary_row.emotions_distribution,
            "topics_frequency": summary_row.topics_frequency,
            "sentiment_distribution": summary_row.sentiment_distribution,
        }

    return PostDetailResponse(
        post=post,
        comments=comments,
        analysis=analyses,
        summary=summary,
    )
