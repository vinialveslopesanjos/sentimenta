"""
Sentiment analysis service.

Adapts the existing LLMClient from src/analysis/llm_client.py
to work with PostgreSQL models.
"""

import sys
import uuid
import math
import logging
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

# Allow importing from src/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent / "src"))
from analysis.llm_client import LLMClient

from app.core.config import settings
from app.models.comment import Comment
from app.models.analysis import CommentAnalysis, PostAnalysisSummary

logger = logging.getLogger(__name__)


def analyze_post_comments(
    db: Session,
    post_id: uuid.UUID,
    batch_size: int = 30,
    prompt_version: str = "v1",
) -> dict:
    """Analyze all pending comments for a post.

    Fetches comments with status='pending', processes them in batches
    through the Gemini LLM, and saves results.

    Returns:
        Dict with stats: {analyzed, errors, llm_calls}
    """
    pending = (
        db.query(Comment)
        .filter(Comment.post_id == post_id, Comment.status == "pending")
        .order_by(Comment.like_count.desc())
        .all()
    )

    if not pending:
        return {"analyzed": 0, "errors": 0, "llm_calls": 0}

    llm = LLMClient(
        api_key=settings.GEMINI_API_KEY,
        model=settings.GEMINI_MODEL,
    )

    stats = {"analyzed": 0, "errors": 0, "llm_calls": 0}

    for i in range(0, len(pending), batch_size):
        batch = pending[i : i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = math.ceil(len(pending) / batch_size)

        logger.info(
            "Processing batch %d/%d (%d comments)",
            batch_num,
            total_batches,
            len(batch),
        )

        # Prepare payload for LLM
        comments_payload = [
            {"comment_id": str(c.id), "text_clean": c.text_clean}
            for c in batch
        ]

        try:
            results = list(llm.analyze_comments(comments_payload, prompt_version))
            stats["llm_calls"] += 1

            for result in results:
                comment_uuid = uuid.UUID(result["comment_id"])
                is_error = result.get("confidence", 0) == 0

                analysis = CommentAnalysis(
                    comment_id=comment_uuid,
                    model=result.get("model", settings.GEMINI_MODEL),
                    prompt_version=result.get("prompt_version", prompt_version),
                    score_0_10=result.get("score_0_10"),
                    polarity=result.get("polarity"),
                    intensity=result.get("intensity"),
                    emotions=result.get("emotions"),
                    topics=result.get("topics"),
                    sarcasm=result.get("sarcasm", False),
                    summary_pt=result.get("summary_pt"),
                    confidence=result.get("confidence"),
                    tokens_in=result.get("tokens_in"),
                    tokens_out=result.get("tokens_out"),
                    cost_estimate_usd=result.get("cost_estimate_usd"),
                    raw_llm_response=result.get("raw_llm_response"),
                )
                db.merge(analysis)

                # Update comment status
                comment = db.get(Comment, comment_uuid)
                if comment:
                    comment.status = "error" if is_error else "processed"
                    if is_error:
                        comment.last_error = result.get("summary_pt", "")[:200]

                stats["analyzed"] += 1
                if is_error:
                    stats["errors"] += 1

        except Exception as e:
            logger.error("Batch %d failed: %s", batch_num, e)
            for c in batch:
                c.status = "error"
                c.last_error = str(e)[:200]
            stats["errors"] += len(batch)

    db.commit()
    return stats


def generate_post_summary(db: Session, post_id: uuid.UUID) -> PostAnalysisSummary | None:
    """Calculate and store aggregated analysis for a post.

    Returns:
        The created/updated PostAnalysisSummary, or None if no analyses exist.
    """
    # Get all analyses for comments on this post
    analyses = (
        db.query(CommentAnalysis)
        .join(Comment, Comment.id == CommentAnalysis.comment_id)
        .filter(Comment.post_id == post_id)
        .all()
    )

    if not analyses:
        return None

    total_comments = (
        db.query(func.count(Comment.id))
        .filter(Comment.post_id == post_id)
        .scalar() or 0
    )

    # Compute averages (ignoring None values)
    scores = [a.score_0_10 for a in analyses if a.score_0_10 is not None]
    polarities = [a.polarity for a in analyses if a.polarity is not None]
    intensities = [a.intensity for a in analyses if a.intensity is not None]
    confidences = [a.confidence for a in analyses if a.confidence is not None]

    avg_score = sum(scores) / len(scores) if scores else None
    avg_polarity = sum(polarities) / len(polarities) if polarities else None
    avg_intensity = sum(intensities) / len(intensities) if intensities else None
    avg_confidence = sum(confidences) / len(confidences) if confidences else None

    # Weighted score (by like_count, logarithmic)
    weighted_score = None
    if scores:
        weighted_pairs = []
        for a in analyses:
            if a.score_0_10 is not None:
                comment = db.get(Comment, a.comment_id)
                likes = comment.like_count if comment else 0
                weight = math.log2(likes + 2)
                weighted_pairs.append((a.score_0_10, weight))
        if weighted_pairs:
            total_weight = sum(w for _, w in weighted_pairs)
            weighted_score = sum(s * w for s, w in weighted_pairs) / total_weight

    # Emotion distribution
    emotion_counter = Counter()
    for a in analyses:
        if a.emotions:
            for emotion in a.emotions:
                emotion_counter[emotion] += 1

    # Topic frequency
    topic_counter = Counter()
    for a in analyses:
        if a.topics:
            for topic in a.topics:
                topic_counter[topic] += 1

    # Sentiment distribution
    negative = sum(1 for s in scores if s < 4)
    neutral = sum(1 for s in scores if 4 <= s <= 6)
    positive = sum(1 for s in scores if s > 6)

    # Create or update summary
    summary = db.query(PostAnalysisSummary).filter(
        PostAnalysisSummary.post_id == post_id
    ).first()

    if summary:
        summary.total_comments = total_comments
        summary.total_analyzed = len(analyses)
        summary.avg_score = round(avg_score, 2) if avg_score else None
        summary.avg_polarity = round(avg_polarity, 2) if avg_polarity else None
        summary.avg_intensity = round(avg_intensity, 2) if avg_intensity else None
        summary.avg_confidence = round(avg_confidence, 2) if avg_confidence else None
        summary.weighted_score = round(weighted_score, 2) if weighted_score else None
        summary.emotions_distribution = dict(emotion_counter.most_common(10))
        summary.topics_frequency = dict(topic_counter.most_common(15))
        summary.sentiment_distribution = {
            "negative": negative,
            "neutral": neutral,
            "positive": positive,
        }
        summary.generated_at = datetime.now(timezone.utc)
    else:
        summary = PostAnalysisSummary(
            post_id=post_id,
            total_comments=total_comments,
            total_analyzed=len(analyses),
            avg_score=round(avg_score, 2) if avg_score else None,
            avg_polarity=round(avg_polarity, 2) if avg_polarity else None,
            avg_intensity=round(avg_intensity, 2) if avg_intensity else None,
            avg_confidence=round(avg_confidence, 2) if avg_confidence else None,
            weighted_score=round(weighted_score, 2) if weighted_score else None,
            emotions_distribution=dict(emotion_counter.most_common(10)),
            topics_frequency=dict(topic_counter.most_common(15)),
            sentiment_distribution={
                "negative": negative,
                "neutral": neutral,
                "positive": positive,
            },
        )
        db.add(summary)

    db.commit()
    db.refresh(summary)
    return summary
