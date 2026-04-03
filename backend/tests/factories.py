"""Test factories para criacao rapida de dados de teste."""
import uuid
from datetime import datetime, timedelta, timezone

from app.models.user import User
from app.models.social_connection import SocialConnection
from app.models.post import Post
from app.models.comment import Comment
from app.models.pipeline_run import PipelineRun
from app.models.credits import CreditBalance, CreditTransaction
from app.models.analysis import CommentAnalysis, PostAnalysisSummary
from app.services.plan_service import PLAN_LIMITS


def create_user(db, plan="free", email=None, password_hash="hashed_test", name="Test User"):
    """Cria user com CreditBalance inicializado."""
    user = User(
        id=uuid.uuid4(),
        email=email or f"test-{uuid.uuid4().hex[:8]}@test.com",
        password_hash=password_hash,
        name=name,
        plan=plan,
        email_verified=True,
    )
    db.add(user)
    db.flush()

    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    balance = CreditBalance(
        id=uuid.uuid4(),
        user_id=user.id,
        plan_credits=limits["credits_per_month"],
        pack_credits=0,
        cycle_start=datetime.now(timezone.utc),
        cycle_end=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(balance)
    db.commit()
    return user


def create_connection(db, user, platform="instagram", username=None, auto_sync=True):
    """Cria SocialConnection."""
    conn = SocialConnection(
        id=uuid.uuid4(),
        user_id=user.id,
        platform=platform,
        username=username or f"test_user_{uuid.uuid4().hex[:6]}",
        display_name="Test Account",
        status="active",
        auto_sync=auto_sync,
        connected_at=datetime.now(timezone.utc),
    )
    db.add(conn)
    db.commit()
    return conn


def create_pipeline_run(db, user, connection, run_type="full", status="completed", **kwargs):
    """Cria PipelineRun."""
    now = datetime.now(timezone.utc)
    run = PipelineRun(
        id=uuid.uuid4(),
        user_id=user.id,
        connection_id=connection.id,
        run_type=run_type,
        status=status,
        started_at=now,
        ended_at=now if status != "running" else None,
        **kwargs,
    )
    db.add(run)
    db.commit()
    return run


def create_post_with_comments(db, connection, num_comments=10, comment_status="pending",
                              platform=None, content_text="Test post caption"):
    """Cria Post com N comments."""
    plat = platform or connection.platform
    post = Post(
        id=uuid.uuid4(),
        connection_id=connection.id,
        platform=plat,
        platform_post_id=f"post_{uuid.uuid4().hex[:8]}",
        post_type="image",
        content_text=content_text,
        content_clean=content_text.lower(),
        comment_count=num_comments,
        like_count=100,
        published_at=datetime.now(timezone.utc),
        fetched_at=datetime.now(timezone.utc),
    )
    db.add(post)
    db.flush()

    comments = []
    for i in range(num_comments):
        comment = Comment(
            id=uuid.uuid4(),
            post_id=post.id,
            connection_id=connection.id,
            platform=plat,
            platform_comment_id=f"comment_{uuid.uuid4().hex[:8]}",
            source_type="comment",
            author_name=f"Commenter {i}",
            author_username=f"commenter_{i}",
            text_original=f"Test comment {i} about the post",
            text_clean=f"test comment {i} about the post",
            text_hash=f"hash_{uuid.uuid4().hex[:16]}",
            status=comment_status,
            like_count=i,
            published_at=datetime.now(timezone.utc),
        )
        comments.append(comment)
        db.add(comment)

    db.commit()
    return post, comments


def create_comment_analyses(db, comments, cost_per=0.001, score=7.5):
    """Cria CommentAnalysis para uma lista de comments."""
    analyses = []
    for comment in comments:
        analysis = CommentAnalysis(
            id=uuid.uuid4(),
            comment_id=comment.id,
            model="gemini-2.0-flash",
            prompt_version="v1",
            score_0_10=score,
            polarity=0.7,
            intensity=0.6,
            emotions=["alegria"],
            topics=["produto"],
            sarcasm=False,
            summary_pt="Comentario positivo sobre o produto",
            confidence=0.85,
            tokens_in=50,
            tokens_out=100,
            cost_estimate_usd=cost_per,
            analyzed_at=datetime.now(timezone.utc),
        )
        analyses.append(analysis)
        db.add(analysis)
        comment.status = "processed"

    db.commit()
    return analyses


class DummyLLM:
    """Mock de LLMClient configuravel para testes."""

    def __init__(self, cost_per_comment=0.001, score=7.5, fail_indices=None):
        self.cost_per_comment = cost_per_comment
        self.score = score
        self.fail_indices = fail_indices or []
        self.calls = []

    def analyze_comments(self, comments_payload, prompt_version="v1", context=None):
        self.calls.append({
            "comments": len(comments_payload),
            "prompt_version": prompt_version,
        })
        for i, item in enumerate(comments_payload):
            if i in self.fail_indices:
                yield {
                    "comment_id": item["comment_id"],
                    "error": "Simulated LLM failure",
                }
                continue
            yield {
                "comment_id": item["comment_id"],
                "score_0_10": self.score,
                "polarity": 0.7,
                "intensity": 0.6,
                "emotions": ["alegria"],
                "topics": ["produto"],
                "sarcasm": False,
                "summary_pt": f"Analise do comentario {item['comment_id']}",
                "confidence": 0.85,
                "tokens_in": 50,
                "tokens_out": 100,
                "cost_estimate_usd": self.cost_per_comment,
            }

    def analyze_image(self, image_url):
        return "Test image description"
