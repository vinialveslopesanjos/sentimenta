"""Honest, read-only forecasts for a manual collection.

The preview never calls a social provider. It combines the latest counts already
stored by Sentimenta with the user's requested limits. Unknown data stays
unknown and is represented as a range instead of being invented.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models.credits import CreditBalance
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.services.plan_service import get_plan_limits


FORECAST_MODEL_VERSION = "2026-08-28"
ENGAGEMENT_PRIORITY_MAX_PER_POST = 200

# Variable-cost ranges in BRL. They are intentionally conservative and exclude
# fixed infrastructure and the monthly Apify subscription. See the canonical
# assumptions and source links in docs/produto/UNIT_ECONOMICS.md.
LLM_COST_BRL_PER_COMMENT = (0.0005, 0.0020)
PROVIDER_COST_BRL_PER_COMMENT = {
    "instagram_public": (0.0030, 0.0140),
    "instagram_oauth": (0.0, 0.0),
    "tiktok": (0.0030, 0.0080),
    "youtube": (0.0, 0.0),
    "twitter": (0.0, 0.0),
}
PROVIDER_COST_BRL_PER_POST_MAX = {
    "instagram_public": 0.014,
    "instagram_oauth": 0.0,
    "tiktok": 0.019,
    "youtube": 0.0,
    "twitter": 0.0,
}


def normalize_comment_selection_mode(value: str | None) -> str:
    """Map the legacy misleading value to the explicit product contract."""
    if value == "sample":
        return "engagement"
    return "engagement" if value == "engagement" else "all"


def engagement_priority_limit(candidate_count: int, configured_limit: int) -> int:
    """Return the maximum comments analyzed after engagement prioritization."""
    return max(
        0,
        min(candidate_count, configured_limit, ENGAGEMENT_PRIORITY_MAX_PER_POST),
    )


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _source_key(connection: SocialConnection) -> str:
    if connection.platform == "instagram":
        return "instagram_oauth" if connection.has_oauth_token else "instagram_public"
    return connection.platform


def _engagement_mode_applies(connection: SocialConnection, mode: str) -> bool:
    return (
        mode == "engagement"
        and connection.platform == "instagram"
        and not connection.has_oauth_token
    )


def _available_credits(db: Session, user_id, plan: str) -> int:
    balance = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .first()
    )
    if balance is not None:
        return max(0, balance.plan_credits + balance.pack_credits)
    return max(0, int(get_plan_limits(plan).get("credits_per_month", 0)))


def _posts_in_scope(
    db: Session,
    connection: SocialConnection,
    *,
    max_posts: int,
    since_date: date | None,
) -> list[Post]:
    posts = (
        db.query(Post)
        .filter(Post.connection_id == connection.id)
        .all()
    )
    if since_date is not None and connection.platform == "instagram":
        posts = [
            post
            for post in posts
            if _as_utc(post.published_at) is not None
            and _as_utc(post.published_at).date() >= since_date
        ]
    posts.sort(
        key=lambda post: _as_utc(post.published_at)
        or _as_utc(post.fetched_at)
        or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return posts[:max_posts]


def build_collection_preview(
    db: Session,
    *,
    user_id,
    plan: str,
    connections: list[SocialConnection],
    max_posts: int,
    max_comments_per_post: int,
    since_date: date | None,
    selection_mode: str,
) -> dict:
    """Build a forecast using only local observations and declared assumptions."""
    mode = normalize_comment_selection_mode(selection_mode)
    target_profiles = len(connections)
    request_comment_ceiling = target_profiles * max_posts * max_comments_per_post

    observed_posts = 0
    requested_post_slots = 0
    posts_with_known_counts = 0
    found_known_comments = 0
    candidate_known_comments = 0
    candidate_max_comments = 0
    selected_known_comments = 0
    selected_max_comments = 0
    selection_applies_to_profiles = 0
    observed_at_values: list[datetime] = []
    operational_cost_min = 0.0
    operational_cost_max = 0.0

    for connection in connections:
        posts = _posts_in_scope(
            db,
            connection,
            max_posts=max_posts,
            since_date=since_date,
        )
        observed_posts += len(posts)

        # media_count is useful only without a date filter. With a date filter,
        # the number of posts inside the requested period is not known until the
        # provider is consulted.
        if since_date is None or connection.platform != "instagram":
            declared_slots = min(max_posts, max(0, connection.media_count or 0))
            connection_slots = max(len(posts), declared_slots)
        else:
            connection_slots = max_posts
        requested_post_slots += connection_slots

        engagement_applies = _engagement_mode_applies(connection, mode)
        if engagement_applies:
            selection_applies_to_profiles += 1

        connection_candidate_known = 0
        connection_candidate_max = 0
        connection_selected_known = 0
        connection_selected_max = 0

        for post in posts:
            fetched_at = _as_utc(post.fetched_at)
            if fetched_at is not None:
                observed_at_values.append(fetched_at)

            if post.comment_count_api is None:
                candidate_upper = max_comments_per_post
                selected_upper = (
                    engagement_priority_limit(candidate_upper, max_comments_per_post)
                    if engagement_applies
                    else candidate_upper
                )
                connection_candidate_max += candidate_upper
                connection_selected_max += selected_upper
                continue

            known_count = max(0, int(post.comment_count_api))
            posts_with_known_counts += 1
            found_known_comments += known_count
            candidate_count = min(known_count, max_comments_per_post)
            selected_count = (
                engagement_priority_limit(candidate_count, max_comments_per_post)
                if engagement_applies
                else candidate_count
            )
            connection_candidate_known += candidate_count
            connection_candidate_max += candidate_count
            connection_selected_known += selected_count
            connection_selected_max += selected_count

        unknown_slots = max(0, connection_slots - len(posts))
        if unknown_slots:
            unknown_candidate_upper = unknown_slots * max_comments_per_post
            unknown_selected_upper = unknown_slots * (
                engagement_priority_limit(max_comments_per_post, max_comments_per_post)
                if engagement_applies
                else max_comments_per_post
            )
            connection_candidate_max += unknown_candidate_upper
            connection_selected_max += unknown_selected_upper

        candidate_known_comments += connection_candidate_known
        candidate_max_comments += connection_candidate_max
        selected_known_comments += connection_selected_known
        selected_max_comments += connection_selected_max

        source_key = _source_key(connection)
        provider_low, provider_high = PROVIDER_COST_BRL_PER_COMMENT.get(
            source_key,
            (0.0, 0.0),
        )
        post_cost_high = PROVIDER_COST_BRL_PER_POST_MAX.get(source_key, 0.0)
        operational_cost_min += connection_candidate_known * provider_low
        operational_cost_max += (
            connection_candidate_max * provider_high
            + connection_slots * post_cost_high
        )
        operational_cost_min += connection_selected_known * LLM_COST_BRL_PER_COMMENT[0]
        operational_cost_max += connection_selected_max * LLM_COST_BRL_PER_COMMENT[1]

    found_status = "unknown"
    if requested_post_slots > 0 and posts_with_known_counts > 0:
        found_status = (
            "complete"
            if observed_posts == requested_post_slots
            and posts_with_known_counts == requested_post_slots
            else "partial"
        )

    estimated_coverage_pct = None
    if found_status == "complete" and found_known_comments > 0:
        estimated_coverage_pct = round(
            min(1.0, selected_known_comments / found_known_comments) * 100,
            1,
        )

    credits_available = _available_credits(db, user_id, plan)
    estimated_analyzed_max = min(selected_max_comments, credits_available)

    # This is an operational planning model, not an SLA. It intentionally has
    # a wide upper bound because provider retries and queueing dominate small
    # runs, while LLM work dominates large runs.
    base_minutes = (
        target_profiles * 0.75
        + requested_post_slots * 0.08
        + candidate_max_comments / 6_000
        + estimated_analyzed_max / 500
    )
    duration_min = max(1, math.ceil(base_minutes * 0.7)) if target_profiles else 0
    duration_max = max(3, math.ceil(base_minutes * 2.5)) if target_profiles else 0

    observed_at = max(observed_at_values) if observed_at_values else None
    confidence = "low"
    if found_status == "complete" and observed_at is not None:
        age_hours = max(
            0.0,
            (datetime.now(timezone.utc) - observed_at).total_seconds() / 3600,
        )
        confidence = "medium" if age_hours <= 24 else "low"

    explanation_codes = [
        "last_observed_not_live",
        "source_can_return_less",
        "deduplication_can_reduce_analysis",
        "fixed_costs_excluded",
        "duration_is_not_sla",
    ]
    if since_date is not None:
        explanation_codes.append("period_applies_to_instagram_only")
    if mode == "engagement":
        explanation_codes.extend(
            [
                "engagement_is_biased",
                "engagement_limited_to_public_instagram",
                "engagement_does_not_reduce_candidate_fetch",
            ]
        )
    if estimated_analyzed_max < selected_max_comments:
        explanation_codes.append("credits_cap_analysis")

    return {
        "model_version": FORECAST_MODEL_VERSION,
        "selection_mode": mode,
        "engagement_priority_max_per_post": ENGAGEMENT_PRIORITY_MAX_PER_POST,
        "target_profiles": target_profiles,
        "selection_applies_to_profiles": selection_applies_to_profiles,
        "requested_posts_per_profile": max_posts,
        "requested_comments_per_post": max_comments_per_post,
        "request_comment_ceiling": request_comment_ceiling,
        "observed_posts": observed_posts,
        "requested_post_slots": requested_post_slots,
        "posts_with_known_counts": posts_with_known_counts,
        "found_status": found_status,
        "found_known_comments": found_known_comments,
        "last_observed_at": observed_at,
        "estimated_candidate_comments_known": candidate_known_comments,
        "estimated_candidate_comments_max": candidate_max_comments,
        "estimated_selected_comments_known": selected_known_comments,
        "estimated_selected_comments_max": selected_max_comments,
        "estimated_analyzed_comments_max": estimated_analyzed_max,
        "estimated_coverage_pct": estimated_coverage_pct,
        "available_credits": credits_available,
        "operational_cost_brl_min": round(operational_cost_min, 2),
        "operational_cost_brl_max": round(operational_cost_max, 2),
        "duration_minutes_min": duration_min,
        "duration_minutes_max": duration_max,
        "forecast_confidence": confidence,
        "fixed_costs_included": False,
        "explanation_codes": explanation_codes,
    }
