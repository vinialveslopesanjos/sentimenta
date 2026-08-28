"""Tests for non-Stripe billing metadata used by collection setup."""


def test_credits_exposes_authoritative_collection_limits(
    client,
    auth_headers,
    test_user,
    db,
):
    user, _ = test_user
    user.plan = "pro"
    db.commit()

    response = client.get("/api/v1/billing/credits", headers=auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert payload["plan"] == "pro"
    assert payload["collection_limits"] == {
        "max_posts_per_sync": 60,
        "max_comments_per_post": 2000,
        "sync_frequency": "daily",
    }
