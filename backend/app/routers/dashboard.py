import uuid
from collections import Counter
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, case, cast, Date, select, extract, Integer as SAInteger
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.cache import cached, invalidate_pattern, get_redis
from app.db.session import get_db
from app.models.comment import Comment
from app.models.analysis import CommentAnalysis, PostAnalysisSummary
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.models.follower_snapshot import FollowerSnapshot
from app.models.user import User
from app.models.demographics import UserEnrichment
from app.services.report_service import generate_health_report, DEFAULT_HEALTH_PROMPT
from app.utils.queries import latest_analysis_subquery as _latest_analysis_subquery
from app.services.plan_service import enforce_feature_access, PlanLimitError, get_user_monthly_usage, PLATFORM_COSTS_USD

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

import re

_STOPWORDS_PT = frozenset({
    "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "na", "no",
    "nas", "nos", "um", "uma", "uns", "umas", "para", "por", "com", "sem",
    "que", "se", "mais", "menos", "muito", "pouco", "bem", "mal", "ja", "ainda",
    "tambem", "como", "mas", "ou", "nem", "nao", "sim", "ao", "aos", "pela",
    "pelo", "pelas", "pelos", "entre", "sobre", "ate", "isso", "isto", "esse",
    "essa", "este", "esta", "esses", "essas", "estes", "estas", "aquele", "aquela",
    "ele", "ela", "eles", "elas", "eu", "tu", "voce", "nos", "vos", "meu", "minha",
    "seu", "sua", "nosso", "nossa", "ter", "ser", "estar", "fazer", "ir", "ver",
    "vai", "vou", "foi", "sao", "tem", "tao", "tava", "era", "sou", "eh",
    "pra", "pro", "vc", "vcs", "tb", "tbm", "q", "ne", "hj", "ai", "la",
    "aqui", "ali", "assim", "depois", "antes", "agora", "onde", "quando",
    "porque", "pq", "so", "todo", "toda", "todos", "todas", "cada", "outro",
    "outra", "outros", "outras", "mesmo", "mesma", "nada", "tudo", "algo",
    "gente", "coisa", "dia", "vez", "tipo", "acho", "pode", "quem", "ja",
    "the", "and", "or", "is", "are", "was", "were", "in", "on", "at", "to", "for",
    "of", "with", "from", "by", "it", "this", "that", "these", "those", "an",
    "you", "your", "my", "me", "we", "they", "them", "he", "she", "his", "her",
    "not", "but", "so", "if", "be", "has", "have", "had", "will", "can", "do",
    "did", "would", "should", "could", "just", "very", "really", "too", "also",
    "been", "being", "get", "got", "its", "than", "then", "when", "what", "how",
    "all", "any", "each", "some", "no", "about", "up", "out", "into",
})

_WORD_RE = re.compile(r'[a-záàâãéèêíïóôõúüçñ]{3,}', re.IGNORECASE)


def _compute_word_frequency(texts: list[str], limit: int = 30) -> dict[str, int] | None:
    """Tokenize comment texts and return top word frequencies, filtering stopwords."""
    if not texts:
        return None
    counter: Counter = Counter()
    for text in texts:
        words = _WORD_RE.findall(text.lower())
        for w in words:
            if w not in _STOPWORDS_PT and len(w) >= 3:
                counter[w] += 1
    if not counter:
        return None
    return dict(counter.most_common(limit))


def _clean_post_text(text: str | None, max_len: int = 100) -> str | None:
    """Remove generic CTA prefixes and hashtags, return meaningful first sentence."""
    if not text or text.strip().lower() == "null":
        return None
    # Normalize escaped newlines to real newlines
    t = text.replace("\\n", "\n")
    # Remove common CTA prefix patterns (e.g. "➡️Coloca pra me seguir...")
    t = re.sub(
        r'^[➡️▶️👉🔔]*\s*(coloca pra me seguir|me segue|segue a[ií]|siga)[^\n]*\n*',
        '', t, flags=re.IGNORECASE
    )
    # Remove leading whitespace/newlines
    t = t.lstrip('\n \t')
    # Remove leading emoji clusters
    t = re.sub(r'^[\U0001F300-\U0001FAFF\U00002702-\U000027B0\U0000FE00-\U0000FE0F\u200d\s]+', '', t)
    # Remove trailing hashtags block
    t = re.sub(r'\s*#\w+(\s+#\w+)*\s*$', '', t)
    t = t.strip()
    if not t:
        return (text[:max_len] + "...") if len(text) > max_len else text
    if len(t) > max_len:
        return t[:max_len] + "..."
    return t



# _latest_analysis_subquery is imported from app.utils.queries


@cached(prefix="dashboard_summary", ttl=300)
def _build_dashboard_summary(user_id: str, db: Session) -> dict:
    """Build dashboard summary data (cached for 5 minutes)."""
    user_uuid = uuid.UUID(user_id)
    connections = (
        db.query(SocialConnection)
        .filter(SocialConnection.user_id == user_uuid)
        .all()
    )
    conn_ids = [c.id for c in connections]

    if not conn_ids:
        return {
            "total_connections": 0,
            "total_posts": 0,
            "total_comments": 0,
            "total_analyzed": 0,
            "avg_score": None,
            "avg_polarity": None,
            "sentiment_distribution": None,
            "emotions_distribution": None,
            "topics_frequency": None,
            "word_frequency": None,
            "recent_posts": [],
            "connections": [],
        }

    total_posts = db.query(func.count(Post.id)).filter(
        Post.connection_id.in_(conn_ids)
    ).scalar() or 0

    total_comments = db.query(func.count(Comment.id)).filter(
        Comment.connection_id.in_(conn_ids)
    ).scalar() or 0

    latest_analysis = _latest_analysis_subquery()

    total_analyzed = (
        db.query(func.count(latest_analysis.c.id))
        .join(Comment, Comment.id == latest_analysis.c.comment_id)
        .filter(Comment.connection_id.in_(conn_ids))
        .scalar()
        or 0
    )

    post_counts = {
        row[0]: row[1]
        for row in db.query(Post.connection_id, func.count(Post.id))
        .filter(Post.connection_id.in_(conn_ids))
        .group_by(Post.connection_id).all()
    }

    analyzed_counts = {
        row[0]: row[1]
        for row in (
            db.query(Comment.connection_id, func.count(latest_analysis.c.id))
            .join(latest_analysis, latest_analysis.c.comment_id == Comment.id)
            .filter(Comment.connection_id.in_(conn_ids))
            .group_by(Comment.connection_id)
            .all()
        )
    }

    avg_stats = (
        db.query(
            func.avg(latest_analysis.c.score_0_10),
            func.avg(latest_analysis.c.polarity),
        )
        .join(Comment, Comment.id == latest_analysis.c.comment_id)
        .filter(Comment.connection_id.in_(conn_ids))
        .first()
    )

    avg_score = round(avg_stats[0], 2) if avg_stats[0] else None
    avg_polarity = round(avg_stats[1], 2) if avg_stats[1] else None

    sentiment_distribution = None
    if total_analyzed > 0:
        negative = (
            db.query(func.count(latest_analysis.c.id))
            .join(Comment, Comment.id == latest_analysis.c.comment_id)
            .filter(
                Comment.connection_id.in_(conn_ids),
                latest_analysis.c.score_0_10 < 4,
            )
            .scalar()
            or 0
        )
        neutral = (
            db.query(func.count(latest_analysis.c.id))
            .join(Comment, Comment.id == latest_analysis.c.comment_id)
            .filter(
                Comment.connection_id.in_(conn_ids),
                latest_analysis.c.score_0_10.between(4, 6),
            )
            .scalar()
            or 0
        )
        positive = (
            db.query(func.count(latest_analysis.c.id))
            .join(Comment, Comment.id == latest_analysis.c.comment_id)
            .filter(
                Comment.connection_id.in_(conn_ids),
                latest_analysis.c.score_0_10 > 6,
            )
            .scalar()
            or 0
        )
        sentiment_distribution = {
            "negative": negative,
            "neutral": neutral,
            "positive": positive,
        }

    # Aggregate emotions & topics from PostAnalysisSummary
    post_ids = [
        row[0]
        for row in db.query(Post.id).filter(Post.connection_id.in_(conn_ids)).all()
    ]
    emotions_agg = Counter()
    topics_agg = Counter()
    if post_ids:
        summaries = (
            db.query(PostAnalysisSummary)
            .filter(PostAnalysisSummary.post_id.in_(post_ids))
            .all()
        )
        for s in summaries:
            if s.emotions_distribution:
                for emo, cnt in s.emotions_distribution.items():
                    emotions_agg[emo] += cnt
            if s.topics_frequency:
                for topic, cnt in s.topics_frequency.items():
                    topics_agg[topic] += cnt

    # Word frequency from comment texts
    comment_texts = [
        row[0]
        for row in db.query(
            func.coalesce(Comment.text_clean, Comment.text_original)
        ).filter(
            Comment.connection_id.in_(conn_ids),
            Comment.status == "processed",
        ).all()
        if row[0]
    ]
    word_frequency = _compute_word_frequency(comment_texts, limit=30)

    # Prioritize posts with comments and text content; fallback to recent
    recent_posts = (
        db.query(Post)
        .filter(
            Post.connection_id.in_(conn_ids),
            Post.comment_count > 0,
        )
        .order_by(Post.published_at.desc().nullslast())
        .limit(10)
        .all()
    )
    # If fewer than 5 with comments, fill with remaining recent posts
    if len(recent_posts) < 5:
        existing_ids = {p.id for p in recent_posts}
        filler = (
            db.query(Post)
            .filter(
                Post.connection_id.in_(conn_ids),
                Post.id.notin_(existing_ids) if existing_ids else True,
            )
            .order_by(Post.published_at.desc().nullslast())
            .limit(10 - len(recent_posts))
            .all()
        )
        recent_posts.extend(filler)

    return {
        "total_connections": len(connections),
        "total_posts": total_posts,
        "total_comments": total_comments,
        "total_analyzed": total_analyzed,
        "avg_score": avg_score,
        "avg_polarity": avg_polarity,
        "sentiment_distribution": sentiment_distribution,
        "emotions_distribution": dict(emotions_agg.most_common(10)) if emotions_agg else None,
        "topics_frequency": dict(topics_agg.most_common(20)) if topics_agg else None,
        "word_frequency": word_frequency,
        "recent_posts": [
            {
                "id": str(p.id),
                "platform": p.platform,
                "platform_post_id": p.platform_post_id,
                "post_type": p.post_type,
                "content_text": _clean_post_text(p.content_text, 100),
                "like_count": p.like_count,
                "comment_count": p.comment_count_api if p.comment_count_api else p.comment_count,
                "published_at": p.published_at.isoformat() if p.published_at else None,
                "post_url": p.post_url,
                "thumbnail_url": (
                    p.media_urls.get("thumbnail_url")
                    or p.media_urls.get("url")
                ) if isinstance(p.media_urls, dict) else None,
            }
            for p in recent_posts
        ],
        "connections": [
            {
                "id": str(c.id),
                "platform": c.platform,
                "username": c.username,
                "display_name": c.display_name,
                "profile_image_url": c.profile_image_url,
                "followers_count": c.followers_count,
                "status": c.status,
                "persona": c.persona,
                "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
                "total_posts": post_counts.get(c.id, 0),
                "total_analyzed": analyzed_counts.get(c.id, 0),
            }
            for c in connections
        ],
    }


@router.get("/summary")
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_dashboard_summary(str(current_user.id), db)


@router.get("/connection/{connection_id}")
def get_connection_dashboard(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn = db.query(SocialConnection).filter(
        SocialConnection.id == connection_id,
        SocialConnection.user_id == current_user.id,
    ).first()

    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    posts = (
        db.query(Post)
        .filter(Post.connection_id == connection_id)
        .order_by(Post.published_at.desc().nullslast())
        .all()
    )

    post_ids = [p.id for p in posts]

    total_comments = db.query(func.count(Comment.id)).filter(
        Comment.connection_id == connection_id
    ).scalar() or 0

    total_analyzed = db.query(func.count(Comment.id)).filter(
        Comment.connection_id == connection_id,
        Comment.status == "processed",
    ).scalar() or 0

    # Aggregate from PostAnalysisSummary
    summaries = (
        db.query(PostAnalysisSummary)
        .filter(PostAnalysisSummary.post_id.in_(post_ids))
        .all()
    ) if post_ids else []

    avg_score = None
    avg_polarity = None
    weighted_avg_score = None
    sentiment_distribution = None
    emotions_agg = Counter()
    topics_agg = Counter()

    if summaries:
        # Weighted averages by total_analyzed per post (not simple mean of means)
        w_score_pairs = [(s.avg_score, s.total_analyzed or 0) for s in summaries if s.avg_score is not None and s.total_analyzed]
        w_pol_pairs = [(s.avg_polarity, s.total_analyzed or 0) for s in summaries if s.avg_polarity is not None and s.total_analyzed]
        w_scores_pairs = [(s.weighted_score, s.total_analyzed or 0) for s in summaries if s.weighted_score is not None and s.total_analyzed]

        if w_score_pairs:
            total_w = sum(n for _, n in w_score_pairs)
            avg_score = round(sum(s * n for s, n in w_score_pairs) / total_w, 2) if total_w else None
        if w_pol_pairs:
            total_w = sum(n for _, n in w_pol_pairs)
            avg_polarity = round(sum(p * n for p, n in w_pol_pairs) / total_w, 2) if total_w else None
        if w_scores_pairs:
            total_w = sum(n for _, n in w_scores_pairs)
            weighted_avg_score = round(sum(s * n for s, n in w_scores_pairs) / total_w, 2) if total_w else None

        neg_total = sum(s.sentiment_distribution.get("negative", 0) for s in summaries if s.sentiment_distribution)
        neu_total = sum(s.sentiment_distribution.get("neutral", 0) for s in summaries if s.sentiment_distribution)
        pos_total = sum(s.sentiment_distribution.get("positive", 0) for s in summaries if s.sentiment_distribution)
        sentiment_distribution = {"negative": neg_total, "neutral": neu_total, "positive": pos_total}

        for s in summaries:
            if s.emotions_distribution:
                for emo, cnt in s.emotions_distribution.items():
                    emotions_agg[emo] += cnt
            if s.topics_frequency:
                for topic, cnt in s.topics_frequency.items():
                    topics_agg[topic] += cnt

    # Word frequency from comment texts
    conn_comment_texts = [
        row[0]
        for row in db.query(
            func.coalesce(Comment.text_clean, Comment.text_original)
        ).filter(
            Comment.connection_id == connection_id,
            Comment.status == "processed",
        ).all()
        if row[0]
    ]
    word_frequency = _compute_word_frequency(conn_comment_texts, limit=30)

    # Engagement totals
    total_likes = sum(p.like_count for p in posts)
    total_views = sum(p.view_count for p in posts)
    total_shares = sum(p.share_count for p in posts)
    total_post_comments = sum((p.comment_count_api or p.comment_count) for p in posts)
    engagement = {
        "total_likes": total_likes,
        "total_comments": total_post_comments,
        "total_views": total_views,
        "total_shares": total_shares,
    }

    # Engagement rate: (total_likes + total_comments) / (followers × posts_count)
    posts_count = len(posts)
    engagement_rate = None
    if conn.followers_count and conn.followers_count > 0 and posts_count > 0:
        engagement_rate = round(
            (total_likes + total_post_comments) / (conn.followers_count * posts_count), 4
        )

    # Topics with scores
    topics_with_scores = []
    if topics_agg:
        # Get avg score per topic from latest analyses
        latest_analysis = _latest_analysis_subquery()
        topic_rows = (
            db.query(
                latest_analysis.c.topics,
                latest_analysis.c.score_0_10,
            )
            .join(Comment, Comment.id == latest_analysis.c.comment_id)
            .filter(
                Comment.connection_id == connection_id,
                latest_analysis.c.topics.isnot(None),
                latest_analysis.c.score_0_10.isnot(None),
            )
            .all()
        )
        topic_scores: dict[str, list[float]] = {}
        for row in topic_rows:
            if isinstance(row.topics, list):
                for t in row.topics:
                    topic_scores.setdefault(str(t), []).append(float(row.score_0_10))
        topics_with_scores = sorted(
            [
                {
                    "topic": topic,
                    "count": topics_agg.get(topic, len(scores)),
                    "avg_score": round(sum(scores) / len(scores), 2),
                }
                for topic, scores in topic_scores.items()
                if scores
            ],
            key=lambda x: x["count"],
            reverse=True,
        )[:15]

    # Posts with their summaries
    summary_map = {str(s.post_id): s for s in summaries}
    posts_with_summary = []
    for p in posts:
        s = summary_map.get(str(p.id))
        posts_with_summary.append({
            "id": str(p.id),
            "platform": p.platform,
            "platform_post_id": p.platform_post_id,
            "post_type": p.post_type,
            "content_text": _clean_post_text(p.content_text, 100),
            "like_count": p.like_count,
            "comment_count": p.comment_count_api if p.comment_count_api else p.comment_count,
            "view_count": p.view_count,
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "post_url": p.post_url,
            "thumbnail_url": (
                p.media_urls.get("thumbnail_url")
                or p.media_urls.get("url")
            ) if isinstance(p.media_urls, dict) else None,
            "summary": {
                "avg_score": s.avg_score,
                "sentiment_distribution": s.sentiment_distribution,
                "total_analyzed": s.total_analyzed,
            } if s else None,
        })

    return {
        "connection": {
            "id": str(conn.id),
            "platform": conn.platform,
            "username": conn.username,
            "display_name": conn.display_name,
            "profile_url": conn.profile_url,
            "profile_image_url": conn.profile_image_url,
            "followers_count": conn.followers_count,
            "following_count": conn.following_count,
            "media_count": conn.media_count,
            "status": conn.status,
            "persona": conn.persona,
            "connected_at": conn.connected_at.isoformat() if conn.connected_at else None,
            "last_sync_at": conn.last_sync_at.isoformat() if conn.last_sync_at else None,
        },
        "total_posts": len(posts),
        "total_comments": total_comments,
        "total_analyzed": total_analyzed,
        "avg_score": avg_score,
        "avg_polarity": avg_polarity,
        "weighted_avg_score": weighted_avg_score,
        "sentiment_distribution": sentiment_distribution,
        "emotions_distribution": dict(emotions_agg.most_common(10)),
        "topics_frequency": dict(topics_agg.most_common(15)),
        "word_frequency": word_frequency,
        "posts": posts_with_summary,
        "engagement_totals": engagement,
        "total_likes": total_likes,
        "total_views": total_views,
        "total_shares": total_shares,
        "engagement_rate": engagement_rate,
        "topics_with_scores": topics_with_scores,
    }


@cached(prefix="dashboard_trends", ttl=300)
def _build_trends(user_id: str, connection_id_str: str | None, granularity: str, days: int, db: Session) -> dict:
    """Build trends data (cached for 5 minutes)."""
    user_uuid = uuid.UUID(user_id)

    # Get user's connection IDs
    conn_query = db.query(SocialConnection.id).filter(
        SocialConnection.user_id == user_uuid
    )
    if connection_id_str:
        conn_query = conn_query.filter(SocialConnection.id == uuid.UUID(connection_id_str))
    conn_ids = [c.id for c in conn_query.all()]

    if not conn_ids:
        return {"data_points": [], "granularity": granularity}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    latest_analysis = _latest_analysis_subquery()

    def trends_query(with_cutoff: bool):
        query = db.query(
            cast(Comment.published_at, Date).label("period"),
            func.count(Comment.id).label("total_comments"),
            func.count(latest_analysis.c.id).label("analyzed_comments"),
            func.sum(Comment.like_count).label("total_likes"),
            func.avg(latest_analysis.c.score_0_10).label("avg_score"),
            func.sum(
                case((latest_analysis.c.score_0_10 > 6, 1), else_=0)
            ).label("positive"),
            func.sum(
                case(
                    (latest_analysis.c.score_0_10.between(4, 6), 1), else_=0
                )
            ).label("neutral_count"),
            func.sum(
                case((latest_analysis.c.score_0_10 < 4, 1), else_=0)
            ).label("negative"),
        ).outerjoin(latest_analysis, latest_analysis.c.comment_id == Comment.id).filter(
            Comment.connection_id.in_(conn_ids),
            Comment.published_at.isnot(None),
        )
        if with_cutoff:
            query = query.filter(Comment.published_at >= cutoff)
        return (
            query.group_by(cast(Comment.published_at, Date))
            .order_by(cast(Comment.published_at, Date))
            .all()
        )

    # Query comments grouped by date. days=0 means all-time; otherwise fallback if empty.
    if days <= 0:
        query = trends_query(with_cutoff=False)
    else:
        query = trends_query(with_cutoff=True)
        if not query:
            query = trends_query(with_cutoff=False)

    # Aggregate by granularity
    data_points_map = {}
    for row in query:
        if row.period is None:
            continue

        if granularity == "day":
            key = row.period.isoformat()
        elif granularity == "week":
            # ISO week start (Monday)
            d = row.period
            week_start = d - timedelta(days=d.weekday())
            key = week_start.isoformat()
        else:  # month
            key = f"{row.period.year}-{row.period.month:02d}-01"

        if key not in data_points_map:
            data_points_map[key] = {
                "period": key,
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "total_comments": 0,
                "avg_score": None,
                "total_likes": 0,
                "_score_sum": 0.0,
                "_score_count": 0,
            }

        dp = data_points_map[key]
        dp["positive"] += int(row.positive or 0)
        dp["neutral"] += int(row.neutral_count or 0)
        dp["negative"] += int(row.negative or 0)
        dp["total_comments"] += int(row.total_comments or 0)
        dp["total_likes"] += int(row.total_likes or 0)
        if row.avg_score is not None:
            analyzed_count = int(row.analyzed_comments or 0)
            if analyzed_count > 0:
                dp["_score_sum"] += float(row.avg_score) * analyzed_count
                dp["_score_count"] += analyzed_count

    # Finalize avg scores
    data_points = []
    for dp in data_points_map.values():
        if dp["_score_count"] > 0:
            dp["avg_score"] = round(dp["_score_sum"] / dp["_score_count"], 2)
        del dp["_score_sum"]
        del dp["_score_count"]
        data_points.append(dp)

    return {"data_points": data_points, "granularity": granularity}


@router.get("/trends")
def get_trends(
    connection_id: uuid.UUID | None = Query(None),
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    days: int = Query(30, ge=0, le=36500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_trends(
        str(current_user.id),
        str(connection_id) if connection_id else None,
        granularity,
        days,
        db,
    )


@router.get("/trends-detailed")
def get_trends_detailed(
    connection_id: uuid.UUID | None = Query(None),
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    days: int = Query(30, ge=0, le=36500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return per-period emotion and topic distributions for temporal stacked charts."""
    user_uuid = current_user.id

    conn_query = db.query(SocialConnection.id).filter(
        SocialConnection.user_id == user_uuid
    )
    if connection_id:
        conn_query = conn_query.filter(SocialConnection.id == connection_id)
    conn_ids = [c.id for c in conn_query.all()]

    if not conn_ids:
        return {"data_points": [], "granularity": granularity}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    latest_analysis = _latest_analysis_subquery()

    def detailed_rows(with_cutoff: bool):
        query = db.query(
            Comment.published_at.label("published_at"),
            latest_analysis.c.score_0_10.label("score"),
            latest_analysis.c.emotions.label("emotions"),
            latest_analysis.c.topics.label("topics"),
        ).outerjoin(latest_analysis, latest_analysis.c.comment_id == Comment.id).filter(
            Comment.connection_id.in_(conn_ids),
            Comment.published_at.isnot(None),
        )
        if with_cutoff:
            query = query.filter(Comment.published_at >= cutoff)
        return query.all()

    if days <= 0:
        rows = detailed_rows(with_cutoff=False)
    else:
        rows = detailed_rows(with_cutoff=True)
        if not rows:
            rows = detailed_rows(with_cutoff=False)

    data_points_map: dict = {}

    for row in rows:
        period_date = row.published_at.date()

        if granularity == "day":
            key = period_date.isoformat()
        elif granularity == "week":
            week_start = period_date - timedelta(days=period_date.weekday())
            key = week_start.isoformat()
        else:  # month
            key = f"{period_date.year}-{period_date.month:02d}-01"

        if key not in data_points_map:
            data_points_map[key] = {
                "period": key,
                "total_comments": 0,
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "emotions": Counter(),
                "topics": Counter(),
            }

        dp = data_points_map[key]
        dp["total_comments"] += 1

        score = row.score
        if score is not None:
            if score > 6:
                dp["positive"] += 1
            elif score >= 4:
                dp["neutral"] += 1
            else:
                dp["negative"] += 1

        if row.emotions and isinstance(row.emotions, list):
            for e in row.emotions:
                dp["emotions"][str(e)] += 1

        if row.topics and isinstance(row.topics, list):
            for t in row.topics:
                dp["topics"][str(t)] += 1

    data_points = []
    for dp in sorted(data_points_map.values(), key=lambda x: x["period"]):
        data_points.append({
            "period": dp["period"],
            "total_comments": dp["total_comments"],
            "positive": dp["positive"],
            "neutral": dp["neutral"],
            "negative": dp["negative"],
            "emotions": dict(dp["emotions"].most_common(10)),
            "topics": dict(dp["topics"].most_common(10)),
        })

    return {"data_points": data_points, "granularity": granularity}


class HealthReportRequest(BaseModel):
    custom_prompt: str | None = None


def _build_health_report(db: Session, user_id, custom_prompt: str | None = None):
    connections = (
        db.query(SocialConnection)
        .filter(SocialConnection.user_id == user_id)
        .all()
    )

    if not connections:
        return {
            "report_text": "Nenhuma rede social conectada. Conecte suas contas para gerar o relatório.",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "data_summary": {},
        }

    # Build data summary for the LLM
    platforms_data = []
    all_emotions = Counter()
    all_topics = Counter()

    for conn in connections:
        posts = db.query(Post).filter(Post.connection_id == conn.id).all()
        post_ids = [p.id for p in posts]

        summaries = (
            db.query(PostAnalysisSummary)
            .filter(PostAnalysisSummary.post_id.in_(post_ids))
            .all()
        ) if post_ids else []

        total_comments = db.query(func.count(Comment.id)).filter(
            Comment.connection_id == conn.id
        ).scalar() or 0

        total_analyzed = db.query(func.count(Comment.id)).filter(
            Comment.connection_id == conn.id,
            Comment.status == "processed",
        ).scalar() or 0

        scores = [s.avg_score for s in summaries if s.avg_score is not None]
        avg = round(sum(scores) / len(scores), 2) if scores else None

        sent = {"negative": 0, "neutral": 0, "positive": 0}
        for s in summaries:
            if s.sentiment_distribution:
                for k, v in s.sentiment_distribution.items():
                    sent[k] = sent.get(k, 0) + v

            if s.emotions_distribution:
                for emo, cnt in s.emotions_distribution.items():
                    all_emotions[emo] += cnt
            if s.topics_frequency:
                for topic, cnt in s.topics_frequency.items():
                    all_topics[topic] += cnt

        platforms_data.append({
            "platform": conn.platform,
            "username": conn.username,
            "followers": conn.followers_count,
            "total_posts": len(posts),
            "total_comments": total_comments,
            "total_analyzed": total_analyzed,
            "avg_score": avg,
            "sentiment_distribution": sent,
        })

    # Fetch 5 sample comments per sentiment (positive, neutral, negative)
    conn_ids = [c.id for c in connections]
    sample_comments = {"positive": [], "neutral": [], "negative": []}
    sentiment_ranges = {
        "positive": (7.0, 10.0),
        "neutral": (4.0, 6.99),
        "negative": (0.0, 3.99),
    }
    for sentiment, (lo, hi) in sentiment_ranges.items():
        rows = (
            db.query(Comment.text_clean, CommentAnalysis.score_0_10)
            .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
            .filter(
                Comment.connection_id.in_(conn_ids),
                Comment.status == "processed",
                CommentAnalysis.score_0_10 >= lo,
                CommentAnalysis.score_0_10 <= hi,
            )
            .order_by(CommentAnalysis.score_0_10.desc() if sentiment == "positive" else CommentAnalysis.score_0_10.asc())
            .limit(5)
            .all()
        )
        sample_comments[sentiment] = [
            {"text": r.text_clean[:200], "score": r.score_0_10}
            for r in rows
        ]

    data_summary = {
        "platforms": platforms_data,
        "top_emotions": dict(all_emotions.most_common(7)),
        "top_topics": dict(all_topics.most_common(10)),
        "sample_comments": sample_comments,
    }

    report_text = generate_health_report(data_summary, custom_prompt=custom_prompt)

    return {
        "report_text": report_text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_summary": data_summary,
    }


HEALTH_REPORT_TTL = 86400  # 24h cache — only regenerated on demand or new data


def _count_analyzed(db: Session, user_id) -> int:
    """Count total analyzed comments for a user (used to detect new data)."""
    conn_ids = [
        c.id for c in
        db.query(SocialConnection.id).filter(SocialConnection.user_id == user_id).all()
    ]
    if not conn_ids:
        return 0
    return db.query(func.count(Comment.id)).filter(
        Comment.connection_id.in_(conn_ids),
        Comment.status == "processed",
    ).scalar() or 0


@router.get("/health-report")
def get_health_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return cached report only. Never generates a new one.
    Includes has_new_data flag so frontend knows if refresh is worthwhile."""
    import json as _json

    cache_key = f"health_report:{current_user.id}"
    r = get_redis()
    cached_report = None

    if r:
        try:
            cached_val = r.get(cache_key)
            if cached_val:
                cached_report = _json.loads(cached_val)
        except Exception:
            pass

    if cached_report:
        # Check if there's new data since last report
        cached_analyzed = 0
        for p in cached_report.get("data_summary", {}).get("platforms", []):
            cached_analyzed += p.get("total_analyzed", 0)
        current_analyzed = _count_analyzed(db, current_user.id)
        cached_report["has_new_data"] = current_analyzed > cached_analyzed
        return cached_report

    # No cache — return empty so frontend shows "Gerar relatório" button
    return {
        "report_text": None,
        "generated_at": None,
        "data_summary": {},
        "has_new_data": _count_analyzed(db, current_user.id) > 0,
    }


@router.post("/health-report")
def post_health_report(
    body: HealthReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a fresh report (user clicked 'Gerar' or 'Atualizar')."""
    try:
        enforce_feature_access(current_user, "health_report")
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    import json as _json

    result = _build_health_report(db, current_user.id, custom_prompt=body.custom_prompt)

    r = get_redis()
    if r and "indisponível" not in result.get("report_text", ""):
        try:
            cache_key = f"health_report:{current_user.id}"
            r.setex(cache_key, HEALTH_REPORT_TTL, _json.dumps(result, default=str))
        except Exception:
            pass

    result["has_new_data"] = False
    return result


@router.get("/health-report/prompt")
def get_health_report_prompt():
    return {"prompt": DEFAULT_HEALTH_PROMPT}


@router.get("/compare")
def get_platform_compare(
    days: int = Query(30, ge=0, le=36500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    latest_analysis = _latest_analysis_subquery()

    rows = (
        db.query(
            SocialConnection.platform.label("platform"),
            func.count(Comment.id).label("total_comments"),
            func.count(latest_analysis.c.id).label("total_analyzed"),
            func.avg(latest_analysis.c.score_0_10).label("avg_score"),
            func.sum(case((latest_analysis.c.score_0_10 > 6, 1), else_=0)).label("positive"),
            func.sum(case((latest_analysis.c.score_0_10.between(4, 6), 1), else_=0)).label("neutral"),
            func.sum(case((latest_analysis.c.score_0_10 < 4, 1), else_=0)).label("negative"),
        )
        .join(Comment, Comment.connection_id == SocialConnection.id)
        .outerjoin(latest_analysis, latest_analysis.c.comment_id == Comment.id)
        .filter(
            SocialConnection.user_id == current_user.id,
            Comment.published_at.isnot(None),
            Comment.published_at >= cutoff,
        )
        .group_by(SocialConnection.platform)
        .all()
    )

    platforms = []
    for row in rows:
        total_analyzed = int(row.total_analyzed or 0)
        positive = int(row.positive or 0)
        neutral = int(row.neutral or 0)
        negative = int(row.negative or 0)
        safe_total = total_analyzed if total_analyzed > 0 else 1
        platforms.append(
            {
                "platform": row.platform,
                "total_comments": int(row.total_comments or 0),
                "total_analyzed": total_analyzed,
                "avg_score": round(float(row.avg_score), 2) if row.avg_score is not None else None,
                "sentiment_distribution": {
                    "positive": positive,
                    "neutral": neutral,
                    "negative": negative,
                },
                "positive_rate": round((positive / safe_total) * 100, 2),
                "negative_rate": round((negative / safe_total) * 100, 2),
            }
        )

    platforms.sort(key=lambda p: p["positive_rate"], reverse=True)

    return {
        "days": days,
        "platforms": platforms,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/compare-connections")
def get_connections_compare(
    connection_ids: str = Query(..., description="Comma-separated connection UUIDs"),
    days: int = Query(3650, ge=7, le=3650),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Compare sentiment data between specific connections (profiles)."""
    ids = [uuid.UUID(cid.strip()) for cid in connection_ids.split(",") if cid.strip()]

    # Verify ownership
    valid_conns = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.id.in_(ids),
            SocialConnection.user_id == current_user.id,
        )
        .all()
    )
    valid_ids = [c.id for c in valid_conns]
    conn_map = {c.id: c for c in valid_conns}

    if not valid_ids:
        return {"days": days, "connections": [], "generated_at": datetime.now(timezone.utc).isoformat()}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    latest_analysis = _latest_analysis_subquery()

    rows = (
        db.query(
            Comment.connection_id.label("connection_id"),
            func.count(Comment.id).label("total_comments"),
            func.count(latest_analysis.c.id).label("total_analyzed"),
            func.avg(latest_analysis.c.score_0_10).label("avg_score"),
            func.avg(latest_analysis.c.polarity).label("avg_polarity"),
            func.sum(case((latest_analysis.c.score_0_10 > 6, 1), else_=0)).label("positive"),
            func.sum(case((latest_analysis.c.score_0_10.between(4, 6), 1), else_=0)).label("neutral"),
            func.sum(case((latest_analysis.c.score_0_10 < 4, 1), else_=0)).label("negative"),
        )
        .outerjoin(latest_analysis, latest_analysis.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id.in_(valid_ids),
            Comment.published_at.isnot(None),
            Comment.published_at >= cutoff,
        )
        .group_by(Comment.connection_id)
        .all()
    )

    # Get emotions per connection from PostAnalysisSummary
    connections_data = []
    for row in rows:
        conn = conn_map.get(row.connection_id)
        total_analyzed = int(row.total_analyzed or 0)
        positive = int(row.positive or 0)
        neutral = int(row.neutral or 0)
        negative = int(row.negative or 0)
        safe_total = total_analyzed if total_analyzed > 0 else 1

        # Get emotions from summaries
        post_ids = [p.id for p in db.query(Post.id).filter(Post.connection_id == row.connection_id).all()]
        emotions_agg = Counter()
        if post_ids:
            summaries = db.query(PostAnalysisSummary).filter(PostAnalysisSummary.post_id.in_(post_ids)).all()
            for s in summaries:
                if s.emotions_distribution:
                    for emo, cnt in s.emotions_distribution.items():
                        emotions_agg[emo] += cnt

        connections_data.append({
            "connection_id": str(row.connection_id),
            "platform": conn.platform if conn else "unknown",
            "username": conn.username if conn else "unknown",
            "display_name": conn.display_name if conn else None,
            "profile_image_url": conn.profile_image_url if conn else None,
            "total_comments": int(row.total_comments or 0),
            "total_analyzed": total_analyzed,
            "avg_score": round(float(row.avg_score), 2) if row.avg_score is not None else None,
            "avg_polarity": round(float(row.avg_polarity), 2) if row.avg_polarity is not None else None,
            "sentiment_distribution": {
                "positive": positive,
                "neutral": neutral,
                "negative": negative,
            },
            "positive_rate": round((positive / safe_total) * 100, 2),
            "negative_rate": round((negative / safe_total) * 100, 2),
            "emotions_distribution": dict(emotions_agg.most_common(10)),
        })

    connections_data.sort(key=lambda c: c["positive_rate"], reverse=True)

    return {
        "days": days,
        "connections": connections_data,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/alerts")
def get_reputation_alerts(
    days: int = Query(7, ge=1, le=30),
    min_analyzed: int = Query(20, ge=1, le=1000),
    negative_threshold: float = Query(0.35, ge=0.0, le=1.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    latest_analysis = _latest_analysis_subquery()

    rows = (
        db.query(
            SocialConnection.id.label("connection_id"),
            SocialConnection.platform.label("platform"),
            SocialConnection.username.label("username"),
            func.count(latest_analysis.c.id).label("total_analyzed"),
            func.avg(latest_analysis.c.score_0_10).label("avg_score"),
            func.sum(case((latest_analysis.c.score_0_10 < 4, 1), else_=0)).label("negative"),
            func.sum(case((latest_analysis.c.sarcasm.is_(True), 1), else_=0)).label("sarcasm"),
        )
        .join(Comment, Comment.connection_id == SocialConnection.id)
        .join(latest_analysis, latest_analysis.c.comment_id == Comment.id)
        .filter(
            SocialConnection.user_id == current_user.id,
            Comment.published_at.isnot(None),
            Comment.published_at >= cutoff,
        )
        .group_by(SocialConnection.id, SocialConnection.platform, SocialConnection.username)
        .all()
    )

    alerts = []
    for row in rows:
        total_analyzed = int(row.total_analyzed or 0)
        if total_analyzed < min_analyzed:
            continue

        negative = int(row.negative or 0)
        sarcasm = int(row.sarcasm or 0)
        negative_rate = negative / total_analyzed if total_analyzed else 0.0
        sarcasm_rate = sarcasm / total_analyzed if total_analyzed else 0.0

        if negative_rate < negative_threshold:
            continue

        severity = "high"
        if negative_rate >= 0.55:
            severity = "critical"
        elif negative_rate < 0.45:
            severity = "medium"

        alerts.append(
            {
                "connection_id": str(row.connection_id),
                "platform": row.platform,
                "username": row.username,
                "severity": severity,
                "negative_rate": round(negative_rate * 100, 2),
                "sarcasm_rate": round(sarcasm_rate * 100, 2),
                "total_analyzed": total_analyzed,
                "avg_score": round(float(row.avg_score), 2) if row.avg_score is not None else None,
                "message": (
                    f"Pico de negatividade em @{row.username}: "
                    f"{round(negative_rate * 100, 1)}% dos comentarios analisados estao negativos."
                ),
            }
        )

    alerts.sort(
        key=lambda a: (
            {"critical": 0, "high": 1, "medium": 2}.get(a["severity"], 3),
            -a["negative_rate"],
        )
    )

    return {
        "days": days,
        "total_alerts": len(alerts),
        "alerts": alerts,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Helper: verify connection ownership
# ---------------------------------------------------------------------------
def _get_connection_or_404(
    connection_id: uuid.UUID, current_user: User, db: Session
) -> SocialConnection:
    conn = db.query(SocialConnection).filter(
        SocialConnection.id == connection_id,
        SocialConnection.user_id == current_user.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


# ---------------------------------------------------------------------------
# 1. Engagement Heatmap
# ---------------------------------------------------------------------------
@router.get("/engagement-heatmap")
def get_engagement_heatmap(
    connection_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn_query = db.query(SocialConnection.id).filter(
        SocialConnection.user_id == current_user.id
    )
    if connection_id:
        conn_query = conn_query.filter(SocialConnection.id == connection_id)
    conn_ids = [c.id for c in conn_query.all()]

    if not conn_ids:
        return {"data": []}

    bucket_expr = (
        cast(extract("hour", Comment.published_at), SAInteger) / 2
    ) * 2

    rows = (
        db.query(
            extract("dow", Comment.published_at).label("day"),
            bucket_expr.label("bucket"),
            func.count(Comment.id).label("count"),
        )
        .filter(
            Comment.connection_id.in_(conn_ids),
            Comment.published_at.isnot(None),
        )
        .group_by("day", "bucket")
        .all()
    )

    # Build 7x12 matrix (Mon=0 .. Sun=6, buckets 0,2,4,...,22)
    # PostgreSQL dow: 0=Sun,1=Mon,...,6=Sat → remap to Mon=0..Sun=6
    pg_to_mono = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6}
    buckets = [h for h in range(0, 24, 2)]  # 12 slots
    bucket_index = {b: i for i, b in enumerate(buckets)}

    matrix = [[0] * 12 for _ in range(7)]
    for r in rows:
        day_idx = pg_to_mono.get(int(r.day), 0)
        b_idx = bucket_index.get(int(r.bucket), 0)
        matrix[day_idx][b_idx] = int(r.count)

    return {"data": matrix}


# ---------------------------------------------------------------------------
# 2. Engagement Peaks
# ---------------------------------------------------------------------------
@router.get("/engagement-peaks")
def get_engagement_peaks(
    connection_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn_query = db.query(SocialConnection.id).filter(
        SocialConnection.user_id == current_user.id
    )
    if connection_id:
        conn_query = conn_query.filter(SocialConnection.id == connection_id)
    conn_ids = [c.id for c in conn_query.all()]

    if not conn_ids:
        return {"hours": [{"hour": h, "volume": 0} for h in range(24)]}

    rows = (
        db.query(
            extract("hour", Comment.published_at).label("hour"),
            func.count(Comment.id).label("volume"),
        )
        .filter(
            Comment.connection_id.in_(conn_ids),
            Comment.published_at.isnot(None),
        )
        .group_by("hour")
        .order_by("hour")
        .all()
    )

    hour_map = {int(r.hour): int(r.volume) for r in rows}
    hours = [{"hour": h, "volume": hour_map.get(h, 0)} for h in range(24)]
    return {"hours": hours}


# ---------------------------------------------------------------------------
# 3. Trends by Platform
# ---------------------------------------------------------------------------
@router.get("/trends-by-platform")
def get_trends_by_platform(
    days: int = Query(30, ge=0, le=36500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conn_query = db.query(SocialConnection).filter(
        SocialConnection.user_id == current_user.id
    )
    connections = conn_query.all()
    if not connections:
        return {"platforms": {}}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days) if days > 0 else None
    latest_analysis = _latest_analysis_subquery()

    platforms: dict[str, list] = {}
    for conn in connections:
        query = (
            db.query(
                cast(Comment.published_at, Date).label("period"),
                func.avg(latest_analysis.c.score_0_10).label("avg_score"),
            )
            .outerjoin(latest_analysis, latest_analysis.c.comment_id == Comment.id)
            .filter(
                Comment.connection_id == conn.id,
                Comment.published_at.isnot(None),
            )
        )
        if cutoff:
            query = query.filter(Comment.published_at >= cutoff)

        rows = (
            query.group_by(cast(Comment.published_at, Date))
            .order_by(cast(Comment.published_at, Date))
            .all()
        )

        platform_key = conn.platform
        if platform_key not in platforms:
            platforms[platform_key] = []

        for row in rows:
            if row.period is not None:
                platforms[platform_key].append({
                    "date": row.period.isoformat(),
                    "score": round(float(row.avg_score), 2) if row.avg_score is not None else None,
                })

    return {"platforms": platforms}


# ---------------------------------------------------------------------------
# 4. Gap Analysis (Engagement vs Sentiment)
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/gap-analysis")
def get_gap_analysis(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        enforce_feature_access(current_user, "comparison")
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    _get_connection_or_404(connection_id, current_user, db)

    posts_data = (
        db.query(Post)
        .filter(Post.connection_id == connection_id)
        .all()
    )

    if not posts_data:
        return {"posts": []}

    post_ids = [p.id for p in posts_data]
    summaries = (
        db.query(PostAnalysisSummary)
        .filter(PostAnalysisSummary.post_id.in_(post_ids))
        .all()
    )
    summary_map = {s.post_id: s for s in summaries}

    result = []
    for p in posts_data:
        s = summary_map.get(p.id)
        if not s or s.avg_score is None:
            continue
        eng = p.engagement_rate if p.engagement_rate is not None else 0.0
        result.append({
            "id": str(p.id),
            "title": _clean_post_text(p.content_text, 80),
            "engagement": round(eng, 4),
            "sentiment": round(s.avg_score, 2),
            "comments": p.comment_count,
        })

    return {"posts": result}


# ---------------------------------------------------------------------------
# 5. Ambassadors & Detractors
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/ambassadors-detractors")
def get_ambassadors_detractors(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        enforce_feature_access(current_user, "comparison")
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    conn = _get_connection_or_404(connection_id, current_user, db)

    latest_analysis = _latest_analysis_subquery()

    rows = (
        db.query(
            Comment.author_username,
            latest_analysis.c.score_0_10,
            latest_analysis.c.emotions,
        )
        .join(latest_analysis, latest_analysis.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            Comment.author_username.isnot(None),
            latest_analysis.c.score_0_10.isnot(None),
        )
    ).all()

    # Aggregate per username
    user_stats: dict[str, dict] = {}
    for row in rows:
        username = row.author_username
        if not username:
            continue
        # Skip connection owner's own comments
        if conn.ignore_author_comments and username.lower() == conn.username.lower():
            continue
        if username not in user_stats:
            user_stats[username] = {"scores": [], "emotions": Counter(), "count": 0}
        user_stats[username]["scores"].append((float(row.score_0_10), 1))
        user_stats[username]["count"] += 1
        if row.emotions and isinstance(row.emotions, list):
            for e in row.emotions:
                user_stats[username]["emotions"][str(e)] += 1

    def _build_entry(username: str, stats: dict) -> dict:
        total_weight = sum(n for _, n in stats["scores"])
        avg = sum(s * n for s, n in stats["scores"]) / total_weight if total_weight else 0
        dominant_emotion = stats["emotions"].most_common(1)[0][0] if stats["emotions"] else None
        return {
            "username": username,
            "count": stats["count"],
            "avg_score": round(avg, 2),
            "dominant_emotion": dominant_emotion,
        }

    # Filter users with >= 2 comments
    qualified = {u: s for u, s in user_stats.items() if s["count"] >= 2}

    # Sort by weighted avg score
    sorted_users = sorted(
        qualified.items(),
        key=lambda x: sum(s * n for s, n in x[1]["scores"]) / max(sum(n for _, n in x[1]["scores"]), 1),
    )

    detractors = [_build_entry(u, s) for u, s in sorted_users[:5]]
    ambassadors = [_build_entry(u, s) for u, s in sorted_users[-5:][::-1]]

    # Enrich with demographics data
    all_usernames = [e["username"] for e in ambassadors + detractors]
    if all_usernames:
        enrichments = (
            db.query(UserEnrichment)
            .filter(UserEnrichment.username.in_(all_usernames))
            .all()
        )
        enrich_map = {e.username: e for e in enrichments}
        for entry in ambassadors + detractors:
            ue = enrich_map.get(entry["username"])
            entry["gender"] = ue.gender_label if ue else None
            entry["age_band"] = ue.age_band if ue else None
            entry["location_state"] = ue.location_state if ue else None

    return {"ambassadors": ambassadors, "detractors": detractors}


# ---------------------------------------------------------------------------
# 6. Topic-Emotion Matrix
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/topic-emotion-matrix")
def get_topic_emotion_matrix(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)

    latest_analysis = _latest_analysis_subquery()
    rows = (
        db.query(
            latest_analysis.c.topics,
            latest_analysis.c.emotions,
        )
        .join(Comment, Comment.id == latest_analysis.c.comment_id)
        .filter(
            Comment.connection_id == connection_id,
            latest_analysis.c.topics.isnot(None),
            latest_analysis.c.emotions.isnot(None),
        )
        .all()
    )

    # Build cross-tab
    topic_set: set[str] = set()
    emotion_set: set[str] = set()
    cross: dict[tuple[str, str], int] = Counter()

    for row in rows:
        topics = row.topics if isinstance(row.topics, list) else []
        emotions = row.emotions if isinstance(row.emotions, list) else []
        for t in topics:
            t_str = str(t)
            topic_set.add(t_str)
            for e in emotions:
                e_str = str(e)
                emotion_set.add(e_str)
                cross[(t_str, e_str)] += 1

    topics_list = sorted(topic_set)
    emotions_list = sorted(emotion_set)

    matrix = [
        [cross.get((t, e), 0) for e in emotions_list]
        for t in topics_list
    ]

    return {"topics": topics_list, "emotions": emotions_list, "matrix": matrix}


# ---------------------------------------------------------------------------
# 7. Post Lifecycle
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/post-lifecycle")
def get_post_lifecycle(
    connection_id: uuid.UUID,
    post_id: uuid.UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)

    post = db.query(Post).filter(
        Post.id == post_id,
        Post.connection_id == connection_id,
    ).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if not post.published_at:
        return {"post_id": str(post_id), "datapoints": []}

    latest_analysis = _latest_analysis_subquery()

    rows = (
        db.query(
            Comment.published_at,
            latest_analysis.c.score_0_10,
        )
        .outerjoin(latest_analysis, latest_analysis.c.comment_id == Comment.id)
        .filter(
            Comment.post_id == post_id,
            Comment.published_at.isnot(None),
        )
        .all()
    )

    if not rows:
        return {"post_id": str(post_id), "datapoints": []}

    # Group by hours after publication
    buckets: dict[int, dict] = {}
    for row in rows:
        delta = row.published_at - post.published_at
        hours_after = max(int(delta.total_seconds() / 3600), 0)
        if hours_after not in buckets:
            buckets[hours_after] = {"scores": [], "volume": 0}
        buckets[hours_after]["volume"] += 1
        if row.score_0_10 is not None:
            buckets[hours_after]["scores"].append(float(row.score_0_10))

    datapoints = sorted(
        [
            {
                "hours_after": h,
                "avg_score": round(sum(b["scores"]) / len(b["scores"]), 2) if b["scores"] else None,
                "volume": b["volume"],
            }
            for h, b in buckets.items()
        ],
        key=lambda x: x["hours_after"],
    )

    return {"post_id": str(post_id), "datapoints": datapoints}


# ---------------------------------------------------------------------------
# 10. Interaction Types (by week)
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/interaction-types")
def get_interaction_types(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)

    posts_data = (
        db.query(Post)
        .filter(
            Post.connection_id == connection_id,
            Post.published_at.isnot(None),
        )
        .order_by(Post.published_at)
        .all()
    )

    if not posts_data:
        return {"weeks": []}

    # Group by ISO week start (Monday)
    weeks_map: dict[str, dict] = {}
    for p in posts_data:
        d = p.published_at.date()
        week_start = d - timedelta(days=d.weekday())
        key = week_start.isoformat()
        if key not in weeks_map:
            weeks_map[key] = {"date": key, "comments": 0, "shares": 0, "likes": 0}
        weeks_map[key]["comments"] += p.comment_count
        weeks_map[key]["shares"] += p.share_count
        weeks_map[key]["likes"] += p.like_count

    weeks = sorted(weeks_map.values(), key=lambda w: w["date"])
    return {"weeks": weeks}


# ---------------------------------------------------------------------------
# 11. Compare Radar
# ---------------------------------------------------------------------------
@router.get("/compare-radar")
def get_compare_radar(
    connection_ids: str = Query(..., description="Comma-separated connection UUIDs (2)"),
    days: int = Query(90, ge=7, le=3650),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        enforce_feature_access(current_user, "comparison")
    except PlanLimitError as e:
        raise HTTPException(status_code=403, detail=e.message)

    ids = [uuid.UUID(cid.strip()) for cid in connection_ids.split(",") if cid.strip()]
    if len(ids) != 2:
        raise HTTPException(status_code=400, detail="Exactly 2 connection_ids required")

    valid_conns = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.id.in_(ids),
            SocialConnection.user_id == current_user.id,
        )
        .all()
    )
    if len(valid_conns) != 2:
        raise HTTPException(status_code=404, detail="One or both connections not found")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    latest_analysis = _latest_analysis_subquery()

    result = []
    for conn in valid_conns:
        # Basic stats
        stats = (
            db.query(
                func.count(Comment.id).label("total"),
                func.count(latest_analysis.c.id).label("analyzed"),
                func.avg(latest_analysis.c.score_0_10).label("avg_score"),
                func.sum(case((latest_analysis.c.score_0_10 > 6, 1), else_=0)).label("positive"),
            )
            .outerjoin(latest_analysis, latest_analysis.c.comment_id == Comment.id)
            .filter(
                Comment.connection_id == conn.id,
                Comment.published_at.isnot(None),
                Comment.published_at >= cutoff,
            )
            .first()
        )

        total = int(stats.total or 0) if stats else 0
        analyzed = int(stats.analyzed or 0) if stats else 0
        avg_score = float(stats.avg_score) if stats and stats.avg_score else 0.0
        positive = int(stats.positive or 0) if stats else 0

        # Engagement: avg engagement_rate from posts
        post_stats = (
            db.query(
                func.count(Post.id).label("post_count"),
                func.sum(Post.like_count).label("total_likes"),
                func.sum(Post.comment_count).label("total_comments"),
            )
            .filter(
                Post.connection_id == conn.id,
                Post.published_at.isnot(None),
                Post.published_at >= cutoff,
            )
            .first()
        )

        post_count = int(post_stats.post_count or 0) if post_stats else 0
        total_likes = int(post_stats.total_likes or 0) if post_stats else 0
        total_comments_posts = int(post_stats.total_comments or 0) if post_stats else 0

        engagement = 0.0
        if conn.followers_count and conn.followers_count > 0 and post_count > 0:
            engagement = round(
                (total_likes + total_comments_posts) / (conn.followers_count * post_count), 4
            )

        # Positivity rate
        positivity = round(positive / analyzed, 2) if analyzed > 0 else 0.0

        # Consistency: how many days in the period had comments vs total days
        days_with_comments = (
            db.query(func.count(func.distinct(cast(Comment.published_at, Date))))
            .filter(
                Comment.connection_id == conn.id,
                Comment.published_at.isnot(None),
                Comment.published_at >= cutoff,
            )
            .scalar() or 0
        )
        consistency = round(days_with_comments / days, 2) if days > 0 else 0.0

        # Growth: follower growth from snapshots
        snapshots = (
            db.query(FollowerSnapshot.followers_count, FollowerSnapshot.snapshot_at)
            .filter(
                FollowerSnapshot.connection_id == conn.id,
                FollowerSnapshot.snapshot_at >= cutoff,
            )
            .order_by(FollowerSnapshot.snapshot_at)
            .all()
        )
        growth = 0.0
        if len(snapshots) >= 2:
            first_val = snapshots[0].followers_count or 0
            last_val = snapshots[-1].followers_count or 0
            if first_val > 0:
                growth = round((last_val - first_val) / first_val, 4)

        result.append({
            "connection_id": str(conn.id),
            "username": conn.username,
            "axes": {
                "score": round(avg_score, 2),
                "engagement": engagement,
                "positivity": positivity,
                "volume": total,
                "consistency": min(consistency, 1.0),
                "growth": growth,
            },
        })

    return {"connections": result}


# ---------------------------------------------------------------------------
# 12. Auto-generated Insights
# ---------------------------------------------------------------------------
@router.get("/insights")
def get_insights(
    connection_ids: str = Query(..., description="Comma-separated connection UUIDs"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ids = [uuid.UUID(cid.strip()) for cid in connection_ids.split(",") if cid.strip()]

    valid_conns = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.id.in_(ids),
            SocialConnection.user_id == current_user.id,
        )
        .all()
    )
    if len(valid_conns) < 2:
        raise HTTPException(status_code=400, detail="At least 2 valid connections required")

    latest_analysis = _latest_analysis_subquery()

    conn_data = []
    for conn in valid_conns:
        stats = (
            db.query(
                func.count(Comment.id).label("total"),
                func.count(latest_analysis.c.id).label("analyzed"),
                func.avg(latest_analysis.c.score_0_10).label("avg_score"),
                func.sum(case((latest_analysis.c.score_0_10 > 6, 1), else_=0)).label("positive"),
                func.sum(case((latest_analysis.c.score_0_10 < 4, 1), else_=0)).label("negative"),
            )
            .outerjoin(latest_analysis, latest_analysis.c.comment_id == Comment.id)
            .filter(Comment.connection_id == conn.id)
            .first()
        )

        total = int(stats.total or 0) if stats else 0
        analyzed = int(stats.analyzed or 0) if stats else 0
        avg_score = float(stats.avg_score) if stats and stats.avg_score else 0.0
        positive = int(stats.positive or 0) if stats else 0
        negative = int(stats.negative or 0) if stats else 0
        positivity = positive / analyzed if analyzed > 0 else 0
        negativity = negative / analyzed if analyzed > 0 else 0

        conn_data.append({
            "conn": conn,
            "total": total,
            "analyzed": analyzed,
            "avg_score": avg_score,
            "positive": positive,
            "negative": negative,
            "positivity": positivity,
            "negativity": negativity,
        })

    # Sort by avg score descending
    conn_data.sort(key=lambda x: x["avg_score"], reverse=True)
    best = conn_data[0]
    worst = conn_data[-1]

    # Advantage: what the best connection does well
    advantage = {
        "title": f"@{best['conn'].username} lidera em sentimento",
        "description": (
            f"Com score médio de {round(best['avg_score'], 1)}/10 e "
            f"{round(best['positivity'] * 100, 1)}% de positividade, "
            f"@{best['conn'].username} tem a melhor recepção entre seus perfis."
        ),
    }

    # Opportunity: where the worst can improve
    opportunity = {
        "title": f"Oportunidade para @{worst['conn'].username}",
        "description": (
            f"@{worst['conn'].username} tem score {round(worst['avg_score'], 1)}/10. "
            f"Reduzir a taxa de negatividade ({round(worst['negativity'] * 100, 1)}%) "
            f"pode melhorar o engajamento geral."
        ),
    }

    # Risk: highest negativity
    most_negative = max(conn_data, key=lambda x: x["negativity"])
    risk = {
        "title": f"Atenção à negatividade em @{most_negative['conn'].username}",
        "description": (
            f"{round(most_negative['negativity'] * 100, 1)}% dos comentários analisados "
            f"de @{most_negative['conn'].username} são negativos "
            f"({most_negative['negative']} de {most_negative['analyzed']}). "
            f"Monitore os tópicos recorrentes para identificar a causa."
        ),
    }

    return {"advantage": advantage, "opportunity": opportunity, "risk": risk}


@router.get("/usage")
def get_platform_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retorna uso do mês atual do usuário logado, por plataforma.

    Inclui posts, comentários, perfis scrapeados e custo estimado (USD).
    """
    usage = get_user_monthly_usage(db, current_user.id)
    return {
        "user_id": str(current_user.id),
        "plan": current_user.plan,
        "platform_costs_reference": PLATFORM_COSTS_USD,
        **usage,
    }


@router.get("/connection/{connection_id}/youtube-stats")
def get_youtube_stats(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna estatísticas específicas de YouTube para uma conexão."""
    conn = db.query(SocialConnection).filter(
        SocialConnection.id == connection_id,
        SocialConnection.user_id == current_user.id,
    ).first()

    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Channel stats from connection + posts
    posts = (
        db.query(Post)
        .filter(Post.connection_id == connection_id)
        .all()
    )

    total_views = sum(p.view_count for p in posts)
    total_videos = len(posts)
    avg_views = round(total_views / total_videos) if total_videos > 0 else 0

    # Average engagement rate from posts
    engagement_rates = [p.engagement_rate for p in posts if p.engagement_rate is not None]
    avg_engagement = round(sum(engagement_rates) / len(engagement_rates), 4) if engagement_rates else 0.0

    channel_stats = {
        "subscribers": conn.followers_count or 0,
        "total_views": total_views,
        "total_videos": total_videos,
        "avg_views_per_video": avg_views,
        "avg_engagement_rate": avg_engagement,
    }

    # Growth from FollowerSnapshot
    snapshots = (
        db.query(FollowerSnapshot)
        .filter(FollowerSnapshot.connection_id == connection_id)
        .order_by(FollowerSnapshot.snapshot_at.asc())
        .all()
    )

    growth = []
    for snap in snapshots:
        # Approximate views: cumulative sum based on snapshot order
        growth.append({
            "date": snap.snapshot_at.strftime("%Y-%m-%d"),
            "subscribers": snap.followers_count,
            "views": total_views,  # snapshot-level views not tracked; use current total
        })

    # Top 5 videos by view_count
    top_posts = sorted(posts, key=lambda p: p.view_count, reverse=True)[:5]
    top_videos = []
    for p in top_posts:
        title = _clean_post_text(p.content_text, max_len=80) or p.platform_post_id
        total_interactions = p.like_count + (p.comment_count_api or p.comment_count)
        eng_rate = round(total_interactions / p.view_count, 4) if p.view_count > 0 else 0.0
        top_videos.append({
            "title": title,
            "views": p.view_count,
            "likes": p.like_count,
            "comments": p.comment_count_api or p.comment_count,
            "engagement_rate": eng_rate,
            "published_at": p.published_at.isoformat() if p.published_at else None,
        })

    return {
        "channel_stats": channel_stats,
        "growth": growth,
        "top_videos": top_videos,
    }

