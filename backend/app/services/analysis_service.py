"""
Sentiment analysis service.

Adapts the existing LLMClient from src/analysis/llm_client.py
to work with PostgreSQL models.
"""

import math
import sys
import uuid
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
from app.models.analysis import CommentAnalysis, PostAnalysisSummary
from app.models.comment import Comment

logger = logging.getLogger(__name__)


def _analysis_exists_expression(
    db: Session,
    prompt_version: str,
):
    return (
        db.query(CommentAnalysis.id)
        .filter(
            CommentAnalysis.comment_id == Comment.id,
            CommentAnalysis.model == settings.GEMINI_MODEL,
            CommentAnalysis.prompt_version == prompt_version,
        )
        .exists()
    )


def analyze_post_comments(
    db: Session,
    post_id: uuid.UUID,
    batch_size: int = 30,
    prompt_version: str = "v1",
) -> dict:
    """Analyze pending comments for a post, skipping already-analyzed rows."""
    analysis_exists = _analysis_exists_expression(db, prompt_version)

    # Repair stale pending rows: if analysis exists, mark processed.
    stale_pending = (
        db.query(Comment)
        .filter(
            Comment.post_id == post_id,
            Comment.status == "pending",
            analysis_exists,
        )
        .all()
    )
    for comment in stale_pending:
        comment.status = "processed"
        comment.last_error = None

    pending = (
        db.query(Comment)
        .filter(
            Comment.post_id == post_id,
            Comment.status == "pending",
            ~analysis_exists,
        )
        .order_by(Comment.like_count.desc())
        .all()
    )

    if not pending:
        db.commit()
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

        comments_payload = [
            {"comment_id": str(comment.id), "text_clean": comment.text_clean}
            for comment in batch
        ]

        try:
            results = list(llm.analyze_comments(comments_payload, prompt_version))
            stats["llm_calls"] += 1

            for result in results:
                comment_uuid = uuid.UUID(result["comment_id"])
                confidence = result.get("confidence")
                is_error = confidence in (None, 0)

                existing_analysis = (
                    db.query(CommentAnalysis)
                    .filter(
                        CommentAnalysis.comment_id == comment_uuid,
                        CommentAnalysis.model == settings.GEMINI_MODEL,
                        CommentAnalysis.prompt_version == prompt_version,
                    )
                    .first()
                )

                if existing_analysis:
                    analysis = existing_analysis
                else:
                    analysis = CommentAnalysis(
                        comment_id=comment_uuid,
                        model=settings.GEMINI_MODEL,
                        prompt_version=prompt_version,
                    )
                    db.add(analysis)

                analysis.score_0_10 = result.get("score_0_10")
                analysis.polarity = result.get("polarity")
                analysis.intensity = result.get("intensity")
                analysis.emotions = result.get("emotions")
                analysis.topics = result.get("topics")
                analysis.sarcasm = result.get("sarcasm", False)
                analysis.summary_pt = result.get("summary_pt")
                analysis.confidence = confidence
                analysis.tokens_in = result.get("tokens_in")
                analysis.tokens_out = result.get("tokens_out")
                analysis.cost_estimate_usd = result.get("cost_estimate_usd")
                analysis.raw_llm_response = result.get("raw_llm_response")
                analysis.analyzed_at = datetime.now(timezone.utc)

                comment = db.get(Comment, comment_uuid)
                if comment:
                    comment.status = "error" if is_error else "processed"
                    comment.last_error = (
                        (result.get("summary_pt") or "")[:200] if is_error else None
                    )

                stats["analyzed"] += 1
                if is_error:
                    stats["errors"] += 1

        except Exception as exc:
            logger.error("Batch %d failed: %s", batch_num, exc)
            for comment in batch:
                comment.status = "error"
                comment.last_error = str(exc)[:200]
            stats["errors"] += len(batch)

    db.commit()
    return stats


def generate_post_summary(
    db: Session,
    post_id: uuid.UUID,
    prompt_version: str = "v1",
) -> PostAnalysisSummary | None:
    """Calculate and store aggregated analysis for one post."""
    analyses = (
        db.query(CommentAnalysis)
        .join(Comment, Comment.id == CommentAnalysis.comment_id)
        .filter(
            Comment.post_id == post_id,
            CommentAnalysis.model == settings.GEMINI_MODEL,
            CommentAnalysis.prompt_version == prompt_version,
        )
        .all()
    )

    if not analyses:
        return None

    total_comments = (
        db.query(func.count(Comment.id))
        .filter(Comment.post_id == post_id)
        .scalar()
        or 0
    )

    scores = [a.score_0_10 for a in analyses if a.score_0_10 is not None]
    polarities = [a.polarity for a in analyses if a.polarity is not None]
    intensities = [a.intensity for a in analyses if a.intensity is not None]
    confidences = [a.confidence for a in analyses if a.confidence is not None]

    avg_score = sum(scores) / len(scores) if scores else None
    avg_polarity = sum(polarities) / len(polarities) if polarities else None
    avg_intensity = sum(intensities) / len(intensities) if intensities else None
    avg_confidence = sum(confidences) / len(confidences) if confidences else None

    weighted_score = None
    if scores:
        weighted_pairs = []
        for analysis in analyses:
            if analysis.score_0_10 is None:
                continue
            comment = db.get(Comment, analysis.comment_id)
            likes = comment.like_count if comment else 0
            weight = math.log2(likes + 2)
            weighted_pairs.append((analysis.score_0_10, weight))
        if weighted_pairs:
            total_weight = sum(weight for _, weight in weighted_pairs)
            weighted_score = (
                sum(score * weight for score, weight in weighted_pairs) / total_weight
            )

    emotion_counter = Counter()
    for analysis in analyses:
        if analysis.emotions:
            for emotion in analysis.emotions:
                emotion_counter[emotion] += 1

    topic_counter = Counter()
    for analysis in analyses:
        if analysis.topics:
            for topic in analysis.topics:
                topic_counter[topic] += 1

    negative = sum(1 for score in scores if score < 4)
    neutral = sum(1 for score in scores if 4 <= score <= 6)
    positive = sum(1 for score in scores if score > 6)

    summary = (
        db.query(PostAnalysisSummary)
        .filter(PostAnalysisSummary.post_id == post_id)
        .first()
    )

    if not summary:
        summary = PostAnalysisSummary(post_id=post_id)
        db.add(summary)

    summary.total_comments = total_comments
    summary.total_analyzed = len(analyses)
    summary.avg_score = round(avg_score, 2) if avg_score is not None else None
    summary.avg_polarity = round(avg_polarity, 2) if avg_polarity is not None else None
    summary.avg_intensity = round(avg_intensity, 2) if avg_intensity is not None else None
    summary.avg_confidence = (
        round(avg_confidence, 2) if avg_confidence is not None else None
    )
    summary.weighted_score = (
        round(weighted_score, 2) if weighted_score is not None else None
    )
    summary.emotions_distribution = dict(emotion_counter.most_common(10))
    summary.topics_frequency = dict(topic_counter.most_common(15))
    summary.sentiment_distribution = {
        "negative": negative,
        "neutral": neutral,
        "positive": positive,
    }
    summary.generated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(summary)
    return summary
