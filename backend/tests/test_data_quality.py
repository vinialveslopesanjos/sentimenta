"""Regression tests for user-visible data quality.

These tests protect the dashboard contract with a deterministic dataset. They
avoid external providers and LLM calls, but still exercise the API aggregation
path that users see.
"""

from datetime import datetime, timedelta, timezone

from app.models.analysis import CommentAnalysis, PostAnalysisSummary
from app.models.comment import Comment
from app.models.pipeline_run import PipelineRun
from app.tasks.pipeline_tasks import _mark_stale_running_runs


def _attach_analysis(db, comment: Comment, score: float, polarity: float, emotions: list[str], topics: list[str]):
    comment.status = "processed"
    db.add(
        CommentAnalysis(
            comment_id=comment.id,
            model="test-model",
            prompt_version="v1",
            score_0_10=score,
            polarity=polarity,
            intensity=abs(polarity),
            emotions=emotions,
            topics=topics,
            sarcasm=False,
            confidence=0.95,
        )
    )


def test_dashboard_summary_matches_deterministic_analysis(client, auth_headers, db, test_post, test_comments):
    scores = [9.0, 5.0, 2.0, 8.0, 1.0]
    polarities = [0.9, 0.0, -0.8, 0.7, -0.9]
    for idx, comment in enumerate(test_comments):
        _attach_analysis(
            db,
            comment,
            score=scores[idx],
            polarity=polarities[idx],
            emotions=["joy"] if scores[idx] > 6 else ["anger"] if scores[idx] < 4 else ["neutral"],
            topics=["produto"] if idx < 2 else ["qualidade"],
        )

    db.add(
        PostAnalysisSummary(
            post_id=test_post.id,
            total_comments=5,
            total_analyzed=5,
            avg_score=5.0,
            avg_polarity=-0.02,
            avg_intensity=0.66,
            weighted_score=5.0,
            emotions_distribution={"joy": 2, "neutral": 1, "anger": 2},
            topics_frequency={"produto": 2, "qualidade": 3},
            sentiment_distribution={"positive": 2, "neutral": 1, "negative": 2},
        )
    )
    db.commit()

    res = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_connections"] == 1
    assert data["total_posts"] == 1
    assert data["total_comments"] == 5
    assert data["total_analyzed"] == 5
    assert data["avg_score"] == 5.0
    assert data["sentiment_distribution"] == {
        "positive": 2,
        "neutral": 1,
        "negative": 2,
    }
    assert data["emotions_distribution"] == {"joy": 2, "anger": 2, "neutral": 1}
    assert data["topics_frequency"] == {"qualidade": 3, "produto": 2}


def test_dashboard_summary_does_not_invent_scores_for_unprocessed_comments(client, auth_headers, test_post, test_comments):
    res = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_comments"] == 5
    assert data["total_analyzed"] == 0
    assert data["avg_score"] is None
    assert data["sentiment_distribution"] is None
    assert data["emotions_distribution"] is None
    assert data["topics_frequency"] is None


def test_dashboard_summary_ignores_invalid_analysis_rows(client, auth_headers, db, test_comments):
    comment = test_comments[0]
    comment.status = "processed"
    db.add(
        CommentAnalysis(
            comment_id=comment.id,
            model="test-model",
            prompt_version="v1",
            score_0_10=None,
            polarity=None,
            intensity=None,
            emotions=[],
            topics=[],
            sarcasm=False,
            confidence=0.0,
            summary_pt="Erro na analise",
        )
    )
    db.commit()

    res = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["total_comments"] == 5
    assert data["total_analyzed"] == 0
    assert data["avg_score"] is None
    assert data["sentiment_distribution"] is None


def test_stale_running_pipeline_runs_are_reconciled(db, test_user, test_connection):
    user, _ = test_user
    run = PipelineRun(
        user_id=user.id,
        connection_id=test_connection.id,
        run_type="sync",
        status="running",
        started_at=datetime.now(timezone.utc) - timedelta(hours=7),
        celery_task_id="stale-task",
    )
    db.add(run)
    db.commit()

    reconciled = _mark_stale_running_runs(db, max_age_hours=6)
    db.refresh(run)

    assert reconciled == 1
    assert run.status == "failed"
    assert run.ended_at is not None
    assert "reconciliada" in (run.notes or "")
