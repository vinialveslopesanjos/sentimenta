from datetime import date, datetime, timezone
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

    monkeypatch.setattr("app.services.apify_service.fetch_posts_apify", lambda username, max_posts, step_callback=None: posts_round_1)
    monkeypatch.setattr(
        "app.services.apify_service.fetch_comments_apify",
        lambda post_urls, max_per_post, per_post_limits=None, sample_mode="all", comment_counts=None, step_callback=None: {
            "https://instagram.com/p/ABC123/": comments_round_1
        },
    )
    monkeypatch.setattr("app.services.instagram_ingest_service.cache_remote_image", lambda url: None)

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

    monkeypatch.setattr("app.services.apify_service.fetch_posts_apify", lambda username, max_posts, step_callback=None: posts_round_2)
    monkeypatch.setattr(
        "app.services.apify_service.fetch_comments_apify",
        lambda post_urls, max_per_post, per_post_limits=None, sample_mode="all", comment_counts=None, step_callback=None: {
            "https://instagram.com/p/ABC123/": comments_round_2
        },
    )

    second_stats = ingest_instagram_profile(
        db,
        connection,
        max_posts=50,
        max_comments_per_post=100,
        is_incremental=True,
    )
    assert second_stats["posts_fetched"] == 0
    assert second_stats["posts_updated"] == 1
    assert second_stats["comments_fetched"] == 1
    assert second_stats["comments_updated"] == 0

    assert db.query(Post).filter(Post.connection_id == connection.id).count() == 1
    assert db.query(Comment).filter(Comment.connection_id == connection.id).count() == 3

    post = db.query(Post).filter(Post.connection_id == connection.id).first()
    assert post.like_count == 22

    comment_c1 = db.query(Comment).filter(Comment.platform_comment_id == "C1").first()
    assert comment_c1.like_count == 1
    assert comment_c1.text_original == "bom"


def test_instagram_public_ingest_respects_manual_start_date(
    db,
    test_user,
    monkeypatch,
):
    user, _ = test_user
    connection = _create_instagram_connection(db, user.id)
    posts = [
        {
            "platform_post_id": "NEW",
            "post_type": "image",
            "caption": "Dentro do período",
            "permalink": "https://instagram.com/p/NEW/",
            "timestamp": "2026-08-10T10:00:00+00:00",
            "comment_count": 1,
        },
        {
            "platform_post_id": "OLD",
            "post_type": "image",
            "caption": "Fora do período",
            "permalink": "https://instagram.com/p/OLD/",
            "timestamp": "2026-07-31T23:59:59+00:00",
            "comment_count": 1,
        },
        {
            "platform_post_id": "UNKNOWN_DATE",
            "post_type": "image",
            "caption": "Sem data comprovável",
            "permalink": "https://instagram.com/p/UNKNOWN_DATE/",
            "timestamp": None,
            "comment_count": 1,
        },
    ]
    requested_urls: list[str] = []

    monkeypatch.setattr(
        "app.services.apify_service.fetch_posts_apify",
        lambda username, max_posts, step_callback=None: posts,
    )

    def fake_fetch_comments(
        post_urls,
        max_per_post,
        per_post_limits=None,
        sample_mode="all",
        comment_counts=None,
        step_callback=None,
    ):
        requested_urls.extend(post_urls)
        return {url: [] for url in post_urls}

    monkeypatch.setattr(
        "app.services.apify_service.fetch_comments_apify",
        fake_fetch_comments,
    )
    monkeypatch.setattr(
        "app.services.instagram_ingest_service.cache_image_stable",
        lambda url, key: None,
    )

    stats = ingest_instagram_profile(
        db,
        connection,
        max_posts=10,
        max_comments_per_post=50,
        since_date=date(2026, 8, 1),
    )

    saved_ids = {
        row[0]
        for row in db.query(Post.platform_post_id)
        .filter(Post.connection_id == connection.id)
        .all()
    }
    assert stats["posts_fetched"] == 1
    assert saved_ids == {"NEW"}
    assert requested_urls == ["https://instagram.com/p/NEW/"]


def test_analyze_post_comments_skips_existing_analysis(db, test_connection, monkeypatch):
    test_connection.ignore_author_comments = False
    db.commit()

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
        model=settings.LLM_MODEL,
        prompt_version="v1",
        score_0_10=5.0,
        confidence=0.9,
    )
    db.add(existing)
    db.commit()

    captured_comment_ids = []

    class DummyLLM:
        def __init__(self):
            pass

        def analyze_comments(self, comments_payload, prompt_version, context=None):
            for item in comments_payload:
                captured_comment_ids.append(item["comment_id"])
                yield {
                    "comment_id": item["comment_id"],
                    "model": settings.LLM_MODEL,
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
            CommentAnalysis.model == settings.LLM_MODEL,
            CommentAnalysis.prompt_version == "v1",
        )
        .count()
    )
    assert analyses_for_existing == 1


def test_analyze_post_comments_retries_existing_error_analysis(db, test_connection, monkeypatch):
    test_connection.ignore_author_comments = False
    db.commit()

    post = Post(
        id=uuid.uuid4(),
        connection_id=test_connection.id,
        platform="youtube",
        platform_post_id="video_error_retry",
        post_type="video",
        content_text="Video with enough context",
        content_clean="video with enough context",
        like_count=0,
        comment_count=1,
        published_at=datetime.now(timezone.utc),
    )
    db.add(post)
    db.flush()

    comment = Comment(
        id=uuid.uuid4(),
        post_id=post.id,
        connection_id=test_connection.id,
        platform="youtube",
        platform_comment_id="retry-1",
        text_original="comentario que falhou antes",
        text_clean="comentario que falhou antes",
        status="pending",
    )
    db.add(comment)
    db.flush()

    existing_error = CommentAnalysis(
        comment_id=comment.id,
        model=settings.LLM_MODEL,
        prompt_version="v1",
        score_0_10=None,
        summary_pt="Erro na analise anterior",
        confidence=0.0,
    )
    db.add(existing_error)
    db.commit()

    captured_comment_ids = []

    class DummyLLM:
        def __init__(self):
            pass

        def analyze_comments(self, comments_payload, prompt_version, context=None):
            for item in comments_payload:
                captured_comment_ids.append(item["comment_id"])
                yield {
                    "comment_id": item["comment_id"],
                    "model": settings.LLM_MODEL,
                    "prompt_version": "v1",
                    "score_0_10": 7.0,
                    "polarity": 0.4,
                    "intensity": 0.6,
                    "emotions": ["alegria"],
                    "topics": ["conteudo"],
                    "sarcasm": False,
                    "summary_pt": "comentario recuperado",
                    "confidence": 0.9,
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
    assert captured_comment_ids == [str(comment.id)]

    db.refresh(comment)
    db.refresh(existing_error)
    assert comment.status == "processed"
    assert comment.last_error is None
    assert existing_error.score_0_10 == 7.0
    assert existing_error.summary_pt == "comentario recuperado"


def test_analyze_post_comments_does_not_count_llm_error_as_analyzed(db, test_connection, monkeypatch):
    test_connection.ignore_author_comments = False
    db.commit()

    post = Post(
        id=uuid.uuid4(),
        connection_id=test_connection.id,
        platform="youtube",
        platform_post_id="video_llm_error",
        post_type="video",
        content_text="Video with enough context",
        content_clean="video with enough context",
        like_count=0,
        comment_count=1,
        published_at=datetime.now(timezone.utc),
    )
    db.add(post)
    db.flush()

    comment = Comment(
        id=uuid.uuid4(),
        post_id=post.id,
        connection_id=test_connection.id,
        platform="youtube",
        platform_comment_id="error-1",
        text_original="comentario que vai falhar",
        text_clean="comentario que vai falhar",
        status="pending",
    )
    db.add(comment)
    db.commit()

    class DummyLLM:
        def __init__(self):
            pass

        def analyze_comments(self, comments_payload, prompt_version, context=None):
            for item in comments_payload:
                yield {
                    "comment_id": item["comment_id"],
                    "model": settings.LLM_MODEL,
                    "prompt_version": "v1",
                    "score_0_10": None,
                    "polarity": None,
                    "intensity": None,
                    "emotions": [],
                    "topics": [],
                    "sarcasm": False,
                    "summary_pt": "Erro na analise",
                    "confidence": 0.0,
                }

    monkeypatch.setattr(analysis_service, "LLMClient", DummyLLM)

    stats = analysis_service.analyze_post_comments(
        db,
        post.id,
        batch_size=10,
        prompt_version="v1",
    )

    assert stats["attempted"] == 1
    assert stats["analyzed"] == 0
    assert stats["errors"] == 1

    db.refresh(comment)
    assert comment.status == "error"
    assert comment.last_error == "Erro na analise"


def test_generate_post_summary_counts_only_valid_analyses(db, test_connection):
    test_connection.ignore_author_comments = False
    db.commit()

    post = Post(
        id=uuid.uuid4(),
        connection_id=test_connection.id,
        platform="youtube",
        platform_post_id="video_summary_valid_only",
        post_type="video",
        content_text="Video with enough context",
        content_clean="video with enough context",
        like_count=0,
        comment_count=2,
        published_at=datetime.now(timezone.utc),
    )
    db.add(post)
    db.flush()

    valid_comment = Comment(
        id=uuid.uuid4(),
        post_id=post.id,
        connection_id=test_connection.id,
        platform="youtube",
        platform_comment_id="valid-1",
        text_original="comentario valido",
        text_clean="comentario valido",
        status="processed",
    )
    invalid_comment = Comment(
        id=uuid.uuid4(),
        post_id=post.id,
        connection_id=test_connection.id,
        platform="youtube",
        platform_comment_id="invalid-1",
        text_original="comentario com erro",
        text_clean="comentario com erro",
        status="error",
    )
    db.add_all([valid_comment, invalid_comment])
    db.flush()

    db.add(
        CommentAnalysis(
            comment_id=valid_comment.id,
            model=settings.LLM_MODEL,
            prompt_version="v1",
            score_0_10=8.0,
            polarity=0.7,
            intensity=0.8,
            emotions=["alegria"],
            topics=["conteudo"],
            confidence=0.9,
        )
    )
    db.add(
        CommentAnalysis(
            comment_id=invalid_comment.id,
            model=settings.LLM_MODEL,
            prompt_version="v1",
            score_0_10=None,
            summary_pt="Erro na analise",
            confidence=0.0,
        )
    )
    db.commit()

    summary = analysis_service.generate_post_summary(db, post.id, prompt_version="v1")

    assert summary is not None
    assert summary.total_comments == 2
    assert summary.total_analyzed == 1
    assert summary.avg_score == 8.0
    assert summary.sentiment_distribution == {
        "negative": 0,
        "neutral": 0,
        "positive": 1,
    }
