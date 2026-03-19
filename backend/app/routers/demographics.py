"""Demographics router — audience demographic insights."""

import uuid
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.comment import Comment
from app.models.demographics import UserEnrichment
from app.models.social_connection import SocialConnection
from app.models.user import User
from app.utils.queries import latest_analysis_subquery

router = APIRouter(prefix="/dashboard/demographics", tags=["demographics"])


def _get_connection_or_404(connection_id, current_user, db):
    conn = db.query(SocialConnection).filter(
        SocialConnection.id == connection_id,
        SocialConnection.user_id == current_user.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    return conn


# ---------------------------------------------------------------------------
# 1. Overview (per connection)
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/overview")
def get_demographics_overview(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)
    la = latest_analysis_subquery()

    # --- Gender distribution ---
    gender_rows = (
        db.query(
            UserEnrichment.gender_label,
            func.count(func.distinct(UserEnrichment.username)),
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            UserEnrichment.gender_confidence >= 0.5,
        )
        .group_by(UserEnrichment.gender_label)
        .all()
    )
    gender_distribution = {row[0]: row[1] for row in gender_rows if row[0]}

    # --- Age distribution ---
    age_rows = (
        db.query(
            UserEnrichment.age_band,
            func.count(func.distinct(UserEnrichment.username)),
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            UserEnrichment.age_confidence >= 0.5,
        )
        .group_by(UserEnrichment.age_band)
        .all()
    )
    age_distribution = {row[0]: row[1] for row in age_rows if row[0]}

    # --- Top locations ---
    loc_rows = (
        db.query(
            UserEnrichment.location_country,
            UserEnrichment.location_country_code,
            func.count(func.distinct(UserEnrichment.username)),
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            UserEnrichment.location_country_confidence >= 0.5,
        )
        .group_by(UserEnrichment.location_country, UserEnrichment.location_country_code)
        .order_by(func.count(func.distinct(UserEnrichment.username)).desc())
        .limit(10)
        .all()
    )
    top_locations = [
        {"country": row[0], "country_code": row[1], "count": row[2]}
        for row in loc_rows if row[0]
    ]

    # --- Enrichment coverage ---
    total_commenters = (
        db.query(func.count(func.distinct(Comment.author_username)))
        .join(la, la.c.comment_id == Comment.id)
        .filter(Comment.connection_id == connection_id)
        .scalar()
    ) or 0

    enriched = (
        db.query(func.count(func.distinct(Comment.author_username)))
        .join(la, la.c.comment_id == Comment.id)
        .join(UserEnrichment, UserEnrichment.username == Comment.author_username)
        .filter(Comment.connection_id == connection_id)
        .scalar()
    ) or 0

    coverage_pct = round((enriched / total_commenters * 100), 1) if total_commenters > 0 else 0.0

    return {
        "gender_distribution": gender_distribution,
        "age_distribution": age_distribution,
        "top_locations": top_locations,
        "enrichment_coverage": {
            "total_commenters": total_commenters,
            "enriched": enriched,
            "coverage_pct": coverage_pct,
        },
    }


# ---------------------------------------------------------------------------
# 2. Sentiment by age
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/sentiment-by-age")
def get_sentiment_by_age(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)
    la = latest_analysis_subquery()
    rows = (
        db.query(
            UserEnrichment.age_band,
            la.c.score_0_10,
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            UserEnrichment.age_confidence >= 0.5,
            la.c.score_0_10.isnot(None),
        )
        .all()
    )

    bands: dict[str, dict] = {}
    for age_band, score in rows:
        if not age_band:
            continue
        if age_band not in bands:
            bands[age_band] = {"positive": 0, "neutral": 0, "negative": 0, "total_score": 0.0, "count": 0}
        score_f = float(score)
        if score_f >= 7:
            bands[age_band]["positive"] += 1
        elif score_f >= 4:
            bands[age_band]["neutral"] += 1
        else:
            bands[age_band]["negative"] += 1
        bands[age_band]["total_score"] += score_f
        bands[age_band]["count"] += 1

    result = []
    for band, stats in sorted(bands.items()):
        avg = round(stats["total_score"] / stats["count"], 1) if stats["count"] else 0
        result.append({
            "band": band,
            "positive": stats["positive"],
            "neutral": stats["neutral"],
            "negative": stats["negative"],
            "avg_score": avg,
            "count": stats["count"],
        })
    return result


# ---------------------------------------------------------------------------
# 3. Sentiment by gender
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/sentiment-by-gender")
def get_sentiment_by_gender(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)
    la = latest_analysis_subquery()

    rows = (
        db.query(
            UserEnrichment.gender_label,
            la.c.score_0_10,
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            UserEnrichment.gender_confidence >= 0.5,
            la.c.score_0_10.isnot(None),
        )
        .all()
    )

    genders: dict[str, dict] = {}
    for gender, score in rows:
        if not gender:
            continue
        if gender not in genders:
            genders[gender] = {"positive": 0, "neutral": 0, "negative": 0, "total_score": 0.0, "count": 0}
        score_f = float(score)
        if score_f >= 7:
            genders[gender]["positive"] += 1
        elif score_f >= 4:
            genders[gender]["neutral"] += 1
        else:
            genders[gender]["negative"] += 1
        genders[gender]["total_score"] += score_f
        genders[gender]["count"] += 1

    result = []
    for gender, stats in sorted(genders.items()):
        avg = round(stats["total_score"] / stats["count"], 1) if stats["count"] else 0
        result.append({
            "gender": gender,
            "positive": stats["positive"],
            "neutral": stats["neutral"],
            "negative": stats["negative"],
            "avg_score": avg,
            "count": stats["count"],
        })
    return result


# ---------------------------------------------------------------------------
# 4. Emotions by gender
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/emotions-by-gender")
def get_emotions_by_gender(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)
    la = latest_analysis_subquery()

    rows = (
        db.query(
            UserEnrichment.gender_label,
            la.c.emotions,
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            UserEnrichment.gender_confidence >= 0.5,
            la.c.emotions.isnot(None),
        )
        .all()
    )

    gender_emotions: dict[str, Counter] = {}
    for gender, emotions in rows:
        if not gender or not emotions:
            continue
        if gender not in gender_emotions:
            gender_emotions[gender] = Counter()
        if isinstance(emotions, list):
            for e in emotions:
                gender_emotions[gender][str(e)] += 1

    result = []
    for gender, counter in sorted(gender_emotions.items()):
        result.append({
            "gender": gender,
            "emotions": dict(counter),
        })
    return result


# ---------------------------------------------------------------------------
# 5. Sentiment by location (state)
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/sentiment-by-location")
def get_sentiment_by_location(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)
    la = latest_analysis_subquery()

    rows = (
        db.query(
            UserEnrichment.location_state,
            la.c.score_0_10,
            la.c.emotions,
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            UserEnrichment.location_state_confidence >= 0.5,
            la.c.score_0_10.isnot(None),
        )
        .all()
    )

    states: dict[str, dict] = {}
    for state, score, emotions in rows:
        if not state:
            continue
        if state not in states:
            states[state] = {"total_score": 0.0, "count": 0, "emotions": Counter()}
        states[state]["total_score"] += float(score)
        states[state]["count"] += 1
        if emotions and isinstance(emotions, list):
            for e in emotions:
                states[state]["emotions"][str(e)] += 1

    # Top 10 by count
    sorted_states = sorted(states.items(), key=lambda x: x[1]["count"], reverse=True)[:10]

    result = []
    for state, stats in sorted_states:
        avg = round(stats["total_score"] / stats["count"], 1) if stats["count"] else 0
        dominant = stats["emotions"].most_common(1)[0][0] if stats["emotions"] else None
        result.append({
            "state": state,
            "count": stats["count"],
            "avg_score": avg,
            "dominant_emotion": dominant,
        })
    return result


# ---------------------------------------------------------------------------
# 6. Age-emotion matrix
# ---------------------------------------------------------------------------
@router.get("/connection/{connection_id}/age-emotion-matrix")
def get_age_emotion_matrix(
    connection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_connection_or_404(connection_id, current_user, db)
    la = latest_analysis_subquery()

    rows = (
        db.query(
            UserEnrichment.age_band,
            la.c.emotions,
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id == connection_id,
            UserEnrichment.age_confidence >= 0.5,
            la.c.emotions.isnot(None),
        )
        .all()
    )

    age_bands_order = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"]
    emotions_order = ["alegria", "tristeza", "raiva", "surpresa", "nojo", "medo", "amor"]

    cross: dict[str, Counter] = {band: Counter() for band in age_bands_order}
    for age_band, emotions in rows:
        if not age_band or age_band not in cross:
            continue
        if isinstance(emotions, list):
            for e in emotions:
                cross[age_band][str(e)] += 1

    matrix = []
    for band in age_bands_order:
        matrix.append([cross[band].get(emo, 0) for emo in emotions_order])

    return {
        "age_bands": age_bands_order,
        "emotions": emotions_order,
        "matrix": matrix,
    }


# ---------------------------------------------------------------------------
# 7. Global overview (all connections for current user)
# ---------------------------------------------------------------------------
@router.get("/overview")
def get_demographics_overview_global(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get all connection IDs for the user
    conn_ids = [
        c.id for c in db.query(SocialConnection.id).filter(
            SocialConnection.user_id == current_user.id,
        ).all()
    ]

    if not conn_ids:
        return {
            "gender_distribution": {},
            "age_distribution": {},
            "top_locations": [],
            "enrichment_coverage": {
                "total_commenters": 0,
                "enriched": 0,
                "coverage_pct": 0.0,
            },
        }

    la = latest_analysis_subquery()

    # --- Gender distribution ---
    gender_rows = (
        db.query(
            UserEnrichment.gender_label,
            func.count(func.distinct(UserEnrichment.username)),
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id.in_(conn_ids),
            UserEnrichment.gender_confidence >= 0.5,
        )
        .group_by(UserEnrichment.gender_label)
        .all()
    )
    gender_distribution = {row[0]: row[1] for row in gender_rows if row[0]}

    # --- Age distribution ---
    age_rows = (
        db.query(
            UserEnrichment.age_band,
            func.count(func.distinct(UserEnrichment.username)),
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id.in_(conn_ids),
            UserEnrichment.age_confidence >= 0.5,
        )
        .group_by(UserEnrichment.age_band)
        .all()
    )
    age_distribution = {row[0]: row[1] for row in age_rows if row[0]}

    # --- Top locations ---
    loc_rows = (
        db.query(
            UserEnrichment.location_country,
            UserEnrichment.location_country_code,
            func.count(func.distinct(UserEnrichment.username)),
        )
        .join(Comment, Comment.author_username == UserEnrichment.username)
        .join(la, la.c.comment_id == Comment.id)
        .filter(
            Comment.connection_id.in_(conn_ids),
            UserEnrichment.location_country_confidence >= 0.5,
        )
        .group_by(UserEnrichment.location_country, UserEnrichment.location_country_code)
        .order_by(func.count(func.distinct(UserEnrichment.username)).desc())
        .limit(10)
        .all()
    )
    top_locations = [
        {"country": row[0], "country_code": row[1], "count": row[2]}
        for row in loc_rows if row[0]
    ]

    # --- Enrichment coverage ---
    total_commenters = (
        db.query(func.count(func.distinct(Comment.author_username)))
        .join(la, la.c.comment_id == Comment.id)
        .filter(Comment.connection_id.in_(conn_ids))
        .scalar()
    ) or 0

    enriched = (
        db.query(func.count(func.distinct(Comment.author_username)))
        .join(la, la.c.comment_id == Comment.id)
        .join(UserEnrichment, UserEnrichment.username == Comment.author_username)
        .filter(Comment.connection_id.in_(conn_ids))
        .scalar()
    ) or 0

    coverage_pct = round((enriched / total_commenters * 100), 1) if total_commenters > 0 else 0.0

    return {
        "gender_distribution": gender_distribution,
        "age_distribution": age_distribution,
        "top_locations": top_locations,
        "enrichment_coverage": {
            "total_commenters": total_commenters,
            "enriched": enriched,
            "coverage_pct": coverage_pct,
        },
    }
