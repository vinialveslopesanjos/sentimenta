"""Deterministic safeguards for user-declared collection limits."""

from unittest.mock import patch

from app.services.apify_service import (
    fetch_comments_apify,
    prioritize_comments_by_engagement,
)


def test_engagement_mode_fetches_only_the_user_declared_candidate_limit():
    post_url = "https://www.instagram.com/p/synthetic/"

    with (
        patch("app.services.apify_service._get_token", return_value="test-token"),
        patch("app.services.apify_service.is_limit_reached", return_value=False),
        patch(
            "app.services.apify_service._fetch_comments_for_post",
            return_value=[],
        ) as fetch_one,
    ):
        result = fetch_comments_apify(
            post_urls=[post_url],
            max_per_post=50,
            sample_mode="engagement",
            comment_counts={post_url: 10_000},
        )

    assert result == {post_url: []}
    fetch_one.assert_called_once_with(post_url, 50, "test-token")


def test_engagement_priority_is_deterministic_and_not_random_sampling():
    comments = [
        {"platform_comment_id": "low", "like_count": 1, "timestamp": "2026-08-01"},
        {"platform_comment_id": "top-b", "like_count": 50, "timestamp": "2026-08-03"},
        {"platform_comment_id": "top-a", "like_count": 50, "timestamp": "2026-08-02"},
        {"platform_comment_id": "middle", "like_count": 10, "timestamp": "2026-08-01"},
    ]

    selected = prioritize_comments_by_engagement(comments, max_items=3)

    assert [comment["platform_comment_id"] for comment in selected] == [
        "top-a",
        "top-b",
        "middle",
    ]
