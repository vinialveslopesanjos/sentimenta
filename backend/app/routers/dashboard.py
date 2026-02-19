import uuid
from collections import Counter
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case, cast, Date
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.cache import cached, invalidate_pattern
from app.db.session import get_db
from app.models.comment import Comment
from app.models.analysis import CommentAnalysis, PostAnalysisSummary
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.services.report_service import generate_health_report

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


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
            "recent_posts": [],
            "connections": [],
        }

    total_posts = db.query(func.count(Post.id)).filter(
        Post.connection_id.in_(conn_ids)
    ).scalar() or 0

    total_comments = db.query(func.count(Comment.id)).filter(
        Comment.connection_id.in_(conn_ids)
    ).scalar() or 0

    total_analyzed = db.query(func.count(Comment.id)).filter(
        Comment.connection_id.in_(conn_ids),
        Comment.status == "processed",
    ).scalar() or 0

    comment_ids_subquery = (
        db.query(Comment.id)
        .filter(Comment.connection_id.in_(conn_ids))
        .subquery()
    )
    avg_stats = db.query(
        func.avg(CommentAnalysis.score_0_10),
        func.avg(CommentAnalysis.polarity),
    ).filter(
        CommentAnalysis.comment_id.in_(comment_ids_subquery)
    ).first()

    avg_score = round(avg_stats[0], 2) if avg_stats[0] else None
    avg_polarity = round(avg_stats[1], 2) if avg_stats[1] else None

    sentiment_distribution = None
    if total_analyzed > 0:
        negative = db.query(func.count(CommentAnalysis.id)).filter(
            CommentAnalysis.comment_id.in_(comment_ids_subquery),
            CommentAnalysis.score_0_10 < 4,
        ).scalar() or 0
        neutral = db.query(func.count(CommentAnalysis.id)).filter(
            CommentAnalysis.comment_id.in_(comment_ids_subquery),
            CommentAnalysis.score_0_10.between(4, 6),
        ).scalar() or 0
        positive = db.query(func.count(CommentAnalysis.id)).filter(
            CommentAnalysis.comment_id.in_(comment_ids_subquery),
            CommentAnalysis.score_0_10 > 6,
        ).scalar() or 0
        sentiment_distribution = {
            "negative": negative,
            "neutral": neutral,
            "positive": positive,
        }

    recent_posts = (
        db.query(Post)
        .filter(Post.connection_id.in_(conn_ids))
        .order_by(Post.published_at.desc().nullslast())
        .limit(10)
        .all()
    )

    return {
        "total_connections": len(connections),
        "total_posts": total_posts,
        "total_comments": total_comments,
        "total_analyzed": total_analyzed,
        "avg_score": avg_score,
        "avg_polarity": avg_polarity,
        "sentiment_distribution": sentiment_distribution,
        "recent_posts": [
            {
                "id": str(p.id),
                "platform": p.platform,
                "platform_post_id": p.platform_post_id,
                "post_type": p.post_type,
                "content_text": (p.content_text[:100] + "..." if p.content_text and len(p.content_text) > 100 else p.content_text),
                "like_count": p.like_count,
                "comment_count": p.comment_count,
                "published_at": p.published_at.isoformat() if p.published_at else None,
                "post_url": p.post_url,
                "thumbnail_url": p.media_urls.get("url") if isinstance(p.media_urls, dict) else None,
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
                "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
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
        scores = [s.avg_score for s in summaries if s.avg_score is not None]
        polarities = [s.avg_polarity for s in summaries if s.avg_polarity is not None]
        w_scores = [s.weighted_score for s in summaries if s.weighted_score is not None]

        if scores:
            avg_score = round(sum(scores) / len(scores), 2)
        if polarities:
            avg_polarity = round(sum(polarities) / len(polarities), 2)
        if w_scores:
            weighted_avg_score = round(sum(w_scores) / len(w_scores), 2)

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

    # Engagement totals
    engagement = {
        "total_likes": sum(p.like_count for p in posts),
        "total_comments": sum(p.comment_count for p in posts),
        "total_views": sum(p.view_count for p in posts),
    }

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
            "content_text": (p.content_text[:100] + "..." if p.content_text and len(p.content_text) > 100 else p.content_text),
            "like_count": p.like_count,
            "comment_count": p.comment_count,
            "view_count": p.view_count,
            "published_at": p.published_at.isoformat() if p.published_at else None,
            "post_url": p.post_url,
            "thumbnail_url": p.media_urls.get("url") if isinstance(p.media_urls, dict) else None,
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
            "status": conn.status,
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
        "posts": posts_with_summary,
        "engagement_totals": engagement,
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

    # Query comments with their analysis, grouped by date
    query = (
        db.query(
            cast(Comment.published_at, Date).label("period"),
            func.count(Comment.id).label("total_comments"),
            func.sum(Comment.like_count).label("total_likes"),
            func.avg(CommentAnalysis.score_0_10).label("avg_score"),
            func.sum(
                case((CommentAnalysis.score_0_10 > 6, 1), else_=0)
            ).label("positive"),
            func.sum(
                case(
                    (CommentAnalysis.score_0_10.between(4, 6), 1), else_=0
                )
            ).label("neutral_count"),
            func.sum(
                case((CommentAnalysis.score_0_10 < 4, 1), else_=0)
            ).label("negative"),
        )
        .outerjoin(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(
            Comment.connection_id.in_(conn_ids),
            Comment.published_at.isnot(None),
            Comment.published_at >= cutoff,
        )
        .group_by(cast(Comment.published_at, Date))
        .order_by(cast(Comment.published_at, Date))
        .all()
    )

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
            dp["_score_sum"] += float(row.avg_score) * int(row.total_comments or 1)
            dp["_score_count"] += int(row.total_comments or 1)

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
    days: int = Query(30, ge=7, le=365),
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
    days: int = Query(30, ge=7, le=365),
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

    rows = (
        db.query(
            Comment.published_at.label("published_at"),
            CommentAnalysis.score_0_10.label("score"),
            CommentAnalysis.emotions.label("emotions"),
            CommentAnalysis.topics.label("topics"),
        )
        .outerjoin(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(
            Comment.connection_id.in_(conn_ids),
            Comment.published_at.isnot(None),
            Comment.published_at >= cutoff,
        )
        .all()
    )

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


@router.get("/health-report")
def get_health_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    connections = (
        db.query(SocialConnection)
        .filter(SocialConnection.user_id == current_user.id)
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

    data_summary = {
        "platforms": platforms_data,
        "top_emotions": dict(all_emotions.most_common(7)),
        "top_topics": dict(all_topics.most_common(10)),
    }

    report_text = generate_health_report(data_summary)

    return {
        "report_text": report_text,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_summary": data_summary,
    }


@router.get("/compare")
def get_platform_compare(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(
            SocialConnection.platform.label("platform"),
            func.count(Comment.id).label("total_comments"),
            func.count(CommentAnalysis.id).label("total_analyzed"),
            func.avg(CommentAnalysis.score_0_10).label("avg_score"),
            func.sum(case((CommentAnalysis.score_0_10 > 6, 1), else_=0)).label("positive"),
            func.sum(case((CommentAnalysis.score_0_10.between(4, 6), 1), else_=0)).label("neutral"),
            func.sum(case((CommentAnalysis.score_0_10 < 4, 1), else_=0)).label("negative"),
        )
        .join(Comment, Comment.connection_id == SocialConnection.id)
        .outerjoin(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
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


@router.get("/alerts")
def get_reputation_alerts(
    days: int = Query(7, ge=1, le=30),
    min_analyzed: int = Query(20, ge=1, le=1000),
    negative_threshold: float = Query(0.35, ge=0.0, le=1.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(
            SocialConnection.id.label("connection_id"),
            SocialConnection.platform.label("platform"),
            SocialConnection.username.label("username"),
            func.count(CommentAnalysis.id).label("total_analyzed"),
            func.avg(CommentAnalysis.score_0_10).label("avg_score"),
            func.sum(case((CommentAnalysis.score_0_10 < 4, 1), else_=0)).label("negative"),
            func.sum(case((CommentAnalysis.sarcasm.is_(True), 1), else_=0)).label("sarcasm"),
        )
        .join(Comment, Comment.connection_id == SocialConnection.id)
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
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
