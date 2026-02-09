"""Tests for SQLAlchemy models and relationships."""

import uuid
from datetime import datetime, timezone

from app.models import (
    User,
    SocialConnection,
    Post,
    Comment,
    CommentAnalysis,
    PostAnalysisSummary,
    PipelineRun,
)


def test_create_user(db):
    user = User(email="model@test.com", name="Model Test")
    db.add(user)
    db.commit()
    db.refresh(user)

    assert user.id is not None
    assert user.email == "model@test.com"
    assert user.plan == "free"
    assert user.created_at is not None


def test_user_connection_relationship(db, test_user, test_connection):
    user, _ = test_user
    db.refresh(user)
    assert len(user.connections) == 1
    assert user.connections[0].platform == "youtube"


def test_connection_posts_relationship(db, test_connection, test_post):
    db.refresh(test_connection)
    assert len(test_connection.posts) == 1
    assert test_connection.posts[0].platform_post_id == "test_video_123"


def test_post_comments_relationship(db, test_post, test_comments):
    db.refresh(test_post)
    assert len(test_post.comments) == 5


def test_comment_analysis_relationship(db, test_comments):
    comment = test_comments[0]
    analysis = CommentAnalysis(
        comment_id=comment.id,
        model="gemini-2.0-flash",
        prompt_version="v1",
        score_0_10=7.5,
        polarity=0.6,
        intensity=0.4,
        emotions=["alegria"],
        topics=["produto"],
        sarcasm=False,
        summary_pt="Comentário positivo sobre produto",
        confidence=0.9,
    )
    db.add(analysis)
    db.commit()

    db.refresh(comment)
    assert len(comment.analyses) == 1
    assert comment.analyses[0].score_0_10 == 7.5


def test_post_analysis_summary(db, test_post):
    summary = PostAnalysisSummary(
        post_id=test_post.id,
        total_comments=50,
        total_analyzed=45,
        avg_score=6.8,
        avg_polarity=0.3,
        sentiment_distribution={"negative": 5, "neutral": 15, "positive": 25},
    )
    db.add(summary)
    db.commit()

    db.refresh(test_post)
    assert test_post.analysis_summary is not None
    assert test_post.analysis_summary.avg_score == 6.8


def test_pipeline_run(db, test_user, test_connection):
    user, _ = test_user
    run = PipelineRun(
        user_id=user.id,
        connection_id=test_connection.id,
        run_type="full",
        status="running",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    assert run.id is not None
    assert run.status == "running"
    assert run.posts_fetched == 0


def test_cascade_delete_user(db, test_user, test_connection, test_post, test_comments):
    """Deleting a user should cascade to connections, posts, comments."""
    user, _ = test_user
    db.delete(user)
    db.commit()

    assert db.query(SocialConnection).count() == 0
    assert db.query(Post).count() == 0
    assert db.query(Comment).count() == 0


def test_unique_constraint_post(db, test_connection):
    """Duplicate (connection_id, platform_post_id) should fail."""
    post1 = Post(
        connection_id=test_connection.id,
        platform="youtube",
        platform_post_id="same_id",
        content_text="Post 1",
        content_clean="post 1",
    )
    db.add(post1)
    db.commit()

    post2 = Post(
        connection_id=test_connection.id,
        platform="youtube",
        platform_post_id="same_id",
        content_text="Post 2",
        content_clean="post 2",
    )
    db.add(post2)
    try:
        db.commit()
        assert False, "Should have raised IntegrityError"
    except Exception:
        db.rollback()
