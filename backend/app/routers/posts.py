import uuid
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Query, Request
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
from app.routers.dashboard import _compute_word_frequency
from app.schemas.post import (
    AnalysisResponse,
    CommentResponse,
    PostDetailResponse,
    PostResponse,
)
from app.utils.queries import latest_analysis_subquery as _latest_analysis_subquery

router = APIRouter(prefix="/posts", tags=["posts"])


@router.get("/thumbnail")
def get_thumbnail_proxy(
    request: Request,
    url: str = Query("", min_length=0),
    post_id: str = Query("", description="Optional shortcode for stable cache lookup"),
):
    from app.services.media_cache_service import CACHE_DIR, _find_existing_file
    from app.middleware.rate_limiter import rate_limiter

    client_ip = request.client.host if request.client else "unknown"
    cache_target = post_id or hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
    rate_limiter.check(f"thumbnail:ip:{client_ip}", max_requests=240, window_seconds=300)
    if cache_target:
        rate_limiter.check(f"thumbnail:target:{cache_target}", max_requests=600, window_seconds=3600)

    # 1. Try stable cache by post shortcode (never expires)
    if post_id:
        stable_key = f"post_{post_id}"
        stable = _find_existing_file(stable_key)
        if stable and stable.exists():
            return FileResponse(
                stable,
                media_type="image/*",
                headers={"Cache-Control": "public, max-age=2592000"},
            )

    # 2. Try URL-based cache or download
    if not url:
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    cached = cache_remote_image(url)
    if not cached or not cached.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(
        cached,
        media_type="image/*",
        headers={"Cache-Control": "public, max-age=604800"},
    )


@router.get("", response_model=list[PostResponse])
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
    # Word frequency from comment texts for this post
    post_comment_texts = [
        (c.text_clean or c.text_original)
        for c in comments
        if c.status == "processed" and (c.text_clean or c.text_original)
    ]
    word_frequency = _compute_word_frequency(post_comment_texts, limit=25)

    summary = None
    if summary_row:
        has_valid_summary = (summary_row.total_analyzed or 0) > 0

        def positive_counts(values):
            if not has_valid_summary or not isinstance(values, dict):
                return None
            filtered = {
                str(key): value
                for key, value in values.items()
                if isinstance(value, (int, float)) and value > 0
            }
            return filtered or None

        summary = {
            "total_comments": summary_row.total_comments,
            "total_analyzed": summary_row.total_analyzed,
            "avg_score": summary_row.avg_score if has_valid_summary else None,
            "avg_polarity": summary_row.avg_polarity if has_valid_summary else None,
            "avg_intensity": summary_row.avg_intensity if has_valid_summary else None,
            "weighted_score": summary_row.weighted_score if has_valid_summary else None,
            "emotions_distribution": positive_counts(summary_row.emotions_distribution),
            "topics_frequency": positive_counts(summary_row.topics_frequency),
            "sentiment_distribution": positive_counts(summary_row.sentiment_distribution),
            "word_frequency": word_frequency if has_valid_summary else None,
        }

    return PostDetailResponse(
        post=post,
        comments=comments,
        analysis=analyses,
        summary=summary,
    )
