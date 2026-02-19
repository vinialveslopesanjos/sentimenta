from datetime import datetime, timezone
import uuid

from app.core.config import settings
from app.models.analysis import CommentAnalysis
from app.models.comment import Comment
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.services import analysis_service
from app.services.instagram_ingest_service import ingest_instagram_profile


def _create_instagram_connection(db, user_id):
    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user_id,
        platform="instagram",
        username="test_profile",
        display_name="Test Profile",
        status="active",
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def test_instagram_ingest_is_incremental(db, test_user, monkeypatch):
    user, _ = test_user
    connection = _create_instagram_connection(db, user.id)

    posts_round_1 = [
        {
            "platform_post_id": "ABC123",
            "post_type": "image",
            "caption": "Primeiro post",
            "media_url": "https://img/1.jpg",
            "permalink": "https://instagram.com/p/ABC123/",
            "timestamp": "2026-02-18T10:00:00+00:00",
            "like_count": 10,
            "comment_count": 2,
            "view_count": 0,
        }
    ]
    comments_round_1 = [
        {
            "platform_comment_id": "C1",
            "text": "bom",
            "username": "u1",
            "timestamp": "2026-02-18T10:01:00+00:00",
            "like_count": 1,
        },
        {
            "platform_comment_id": "C2",
            "text": "legal",
            "username": "u2",
            "timestamp": "2026-02-18T10:02:00+00:00",
            "like_count": 2,
        },
    ]

    monkeypatch.setattr(
        "app.services.instagram_ingest_service.fetch_recent_posts",
        lambda username, max_posts, since_date: posts_round_1,
    )
    monkeypatch.setattr(
        "app.services.instagram_ingest_service.fetch_post_comments",
        lambda shortcode, max_comments: comments_round_1,
    )

    first_stats = ingest_instagram_profile(db, connection, max_posts=50, max_comments_per_post=100)
    assert first_stats["posts_fetched"] == 1
    assert first_stats["comments_fetched"] == 2
    assert db.query(Post).filter(Post.connection_id == connection.id).count() == 1
    assert db.query(Comment).filter(Comment.connection_id == connection.id).count() == 2

    posts_round_2 = [
        {
            "platform_post_id": "ABC123",
            "post_type": "image",
            "caption": "Primeiro post atualizado",
            "media_url": "https://img/1.jpg",
            "permalink": "https://instagram.com/p/ABC123/",
            "timestamp": "2026-02-18T10:00:00+00:00",
            "like_count": 22,
            "comment_count": 3,
            "view_count": 0,
        }
    ]
    comments_round_2 = [
        {
            "platform_comment_id": "C1",
            "text": "bom demais",
            "username": "u1",
            "timestamp": "2026-02-18T10:01:00+00:00",
            "like_count": 7,
        },
        {
            "platform_comment_id": "C2",
            "text": "legal",
            "username": "u2",
            "timestamp": "2026-02-18T10:02:00+00:00",
            "like_count": 3,
        },
        {
            "platform_comment_id": "C3",
            "text": "novo comentario",
            "username": "u3",
            "timestamp": "2026-02-18T10:03:00+00:00",
            "like_count": 0,
        },
    ]

    monkeypatch.setattr(
        "app.services.instagram_ingest_service.fetch_recent_posts",
        lambda username, max_posts, since_date: posts_round_2,
    )
    monkeypatch.setattr(
        "app.services.instagram_ingest_service.fetch_post_comments",
        lambda shortcode, max_comments: comments_round_2,
    )

    second_stats = ingest_instagram_profile(db, connection, max_posts=50, max_comments_per_post=100)
    assert second_stats["posts_fetched"] == 0
    assert second_stats["posts_updated"] == 1
    assert second_stats["comments_fetched"] == 1
    assert second_stats["comments_updated"] == 2

    assert db.query(Post).filter(Post.connection_id == connection.id).count() == 1
    assert db.query(Comment).filter(Comment.connection_id == connection.id).count() == 3

    post = db.query(Post).filter(Post.connection_id == connection.id).first()
    assert post.like_count == 22

    comment_c1 = db.query(Comment).filter(Comment.platform_comment_id == "C1").first()
    assert comment_c1.like_count == 7
    assert comment_c1.text_original == "bom demais"


def test_analyze_post_comments_skips_existing_analysis(db, test_connection, monkeypatch):
    post = Post(
        id=uuid.uuid4(),
        connection_id=test_connection.id,
        platform="youtube",
        platform_post_id="video_1",
        post_type="video",
        content_text="Video",
        content_clean="video",
        like_count=0,
        comment_count=2,
        published_at=datetime.now(timezone.utc),
    )
    db.add(post)
    db.flush()

    comment_with_analysis = Comment(
        id=uuid.uuid4(),
        post_id=post.id,
        connection_id=test_connection.id,
        platform="youtube",
        platform_comment_id="a1",
        text_original="ja analisado",
        text_clean="ja analisado",
        status="pending",
    )
    comment_new = Comment(
        id=uuid.uuid4(),
        post_id=post.id,
        connection_id=test_connection.id,
        platform="youtube",
        platform_comment_id="a2",
        text_original="novo",
        text_clean="novo",
        status="pending",
    )
    db.add(comment_with_analysis)
    db.add(comment_new)
    db.flush()

    existing = CommentAnalysis(
        comment_id=comment_with_analysis.id,
        model=settings.GEMINI_MODEL,
        prompt_version="v1",
        score_0_10=5.0,
        confidence=0.9,
    )
    db.add(existing)
    db.commit()

    captured_comment_ids = []

    class DummyLLM:
        def __init__(self, api_key: str, model: str):
            self.api_key = api_key
            self.model = model

        def analyze_comments(self, comments_payload, prompt_version):
            for item in comments_payload:
                captured_comment_ids.append(item["comment_id"])
                yield {
                    "comment_id": item["comment_id"],
                    "model": settings.GEMINI_MODEL,
                    "prompt_version": "v1",
                    "score_0_10": 8.0,
                    "polarity": 0.8,
                    "intensity": 0.7,
                    "emotions": ["alegria"],
                    "topics": ["produto"],
                    "sarcasm": False,
                    "summary_pt": "ok",
                    "confidence": 0.95,
                }

    monkeypatch.setattr(analysis_service, "LLMClient", DummyLLM)

    stats = analysis_service.analyze_post_comments(
        db,
        post.id,
        batch_size=10,
        prompt_version="v1",
    )

    assert stats["analyzed"] == 1
    assert stats["errors"] == 0
    assert stats["llm_calls"] == 1
    assert captured_comment_ids == [str(comment_new.id)]

    db.refresh(comment_with_analysis)
    db.refresh(comment_new)
    assert comment_with_analysis.status == "processed"
    assert comment_new.status == "processed"

    analyses_for_existing = (
        db.query(CommentAnalysis)
        .filter(
            CommentAnalysis.comment_id == comment_with_analysis.id,
            CommentAnalysis.model == settings.GEMINI_MODEL,
            CommentAnalysis.prompt_version == "v1",
        )
        .count()
    )
    assert analyses_for_existing == 1
