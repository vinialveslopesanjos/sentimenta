"""Create deterministic data for Playwright smoke tests.

The script uses the configured DATABASE_URL. CI runs it against SQLite before
starting the API; local developers can point it at any throwaway database.
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("DATABASE_URL", "sqlite:///./e2e.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-e2e")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "test-token-encryption-key-for-e2e")
os.environ.setdefault("DEBUG", "true")

from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.models import BlogPost, Comment, CommentAnalysis, Post, PostAnalysisSummary, SocialConnection, User  # noqa: E402

E2E_EMAIL = os.getenv("E2E_EMAIL", "e2e-seed@example.com")
E2E_PASSWORD = os.getenv("E2E_PASSWORD", "SeedPassword123!")
E2E_ADMIN_EMAIL = os.getenv("E2E_ADMIN_EMAIL", "e2e-admin@example.com")
E2E_ADMIN_PASSWORD = os.getenv("E2E_ADMIN_PASSWORD", "AdminPassword123!")


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == E2E_EMAIL).first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                email=E2E_EMAIL,
                password_hash=hash_password(E2E_PASSWORD),
                name="E2E Seed User",
                plan="pro",
                email_verified=True,
                onboarding_data={
                    "profile_type": "criador",
                    "main_goal": "monitorar_sentimento",
                    "description": "Perfil deterministico para smoke tests.",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        admin_user = db.query(User).filter(User.email == E2E_ADMIN_EMAIL).first()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                email=E2E_ADMIN_EMAIL,
                password_hash=hash_password(E2E_ADMIN_PASSWORD),
                name="E2E Admin User",
                plan="admin",
                email_verified=True,
                onboarding_data={
                    "profile_type": "agencia",
                    "main_goal": "conteudo",
                    "description": "Admin deterministico para validar editor de blog.",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)

        conn = (
            db.query(SocialConnection)
            .filter(SocialConnection.user_id == user.id, SocialConnection.platform == "youtube")
            .first()
        )
        if not conn:
            conn = SocialConnection(
                id=uuid.uuid4(),
                user_id=user.id,
                platform="youtube",
                platform_user_id="e2e-channel",
                username="@e2e-seed",
                display_name="E2E Seed Channel",
                followers_count=1000,
                status="active",
                persona="Perfil deterministico para smoke tests.",
                last_sync_at=datetime.now(timezone.utc),
            )
            db.add(conn)
            db.commit()
            db.refresh(conn)

        post = (
            db.query(Post)
            .filter(Post.connection_id == conn.id, Post.platform_post_id == "e2e-post-1")
            .first()
        )
        if not post:
            post = Post(
                id=uuid.uuid4(),
                connection_id=conn.id,
                platform="youtube",
                platform_post_id="e2e-post-1",
                post_type="video",
                content_text="Video deterministico para validar o dashboard",
                content_clean="video deterministico para validar o dashboard",
                like_count=100,
                comment_count=3,
                published_at=datetime.now(timezone.utc),
                post_url="https://youtube.com/watch?v=e2e-post-1",
            )
            db.add(post)
            db.commit()
            db.refresh(post)

        comments = []
        fixtures = [
            ("e2e-comment-positive", "Excelente analise, ajudou muito", 9.0, 0.9, ["joy"], ["produto"]),
            ("e2e-comment-neutral", "Entendi o ponto, faltou contexto", 5.0, 0.0, ["neutral"], ["contexto"]),
            ("e2e-comment-negative", "Nao gostei do resultado", 2.0, -0.8, ["anger"], ["qualidade"]),
        ]
        for platform_comment_id, text, score, polarity, emotions, topics in fixtures:
            comment = (
                db.query(Comment)
                .filter(Comment.post_id == post.id, Comment.platform_comment_id == platform_comment_id)
                .first()
            )
            if not comment:
                comment = Comment(
                    id=uuid.uuid4(),
                    post_id=post.id,
                    connection_id=conn.id,
                    platform="youtube",
                    platform_comment_id=platform_comment_id,
                    author_name="E2E",
                    author_username=platform_comment_id,
                    text_original=text,
                    text_clean=text.lower(),
                    text_hash=platform_comment_id,
                    status="processed",
                    published_at=datetime.now(timezone.utc),
                )
                db.add(comment)
                db.commit()
                db.refresh(comment)
            comments.append((comment, score, polarity, emotions, topics))

            analysis = (
                db.query(CommentAnalysis)
                .filter(
                    CommentAnalysis.comment_id == comment.id,
                    CommentAnalysis.model == "gemini-2.0-flash",
                    CommentAnalysis.prompt_version == "v1",
                )
                .first()
            )
            if not analysis:
                db.add(
                    CommentAnalysis(
                        comment_id=comment.id,
                        model="gemini-2.0-flash",
                        prompt_version="v1",
                        score_0_10=score,
                        polarity=polarity,
                        intensity=abs(polarity),
                        emotions=emotions,
                        topics=topics,
                        confidence=0.95,
                    )
                )

        summary = db.query(PostAnalysisSummary).filter(PostAnalysisSummary.post_id == post.id).first()
        if not summary:
            summary = PostAnalysisSummary(post_id=post.id)
            db.add(summary)
        summary.total_comments = 3
        summary.total_analyzed = 3
        summary.avg_score = 5.33
        summary.avg_polarity = 0.03
        summary.avg_intensity = 0.57
        summary.weighted_score = 5.33
        summary.emotions_distribution = {"joy": 1, "neutral": 1, "anger": 1}
        summary.topics_frequency = {"produto": 1, "contexto": 1, "qualidade": 1}
        summary.sentiment_distribution = {"positive": 1, "neutral": 1, "negative": 1}

        blog_post = (
            db.query(BlogPost)
            .filter(BlogPost.slug == "como-saber-se-os-comentarios-do-instagram-estao-virando-risco")
            .first()
        )
        if not blog_post:
            db.add(
                BlogPost(
                    id=uuid.uuid4(),
                    slug="como-saber-se-os-comentarios-do-instagram-estao-virando-risco",
                    title="Como saber se os comentarios do Instagram estao virando risco",
                    excerpt="Um guia direto para identificar sinais de crise antes de depender apenas de curtidas.",
                    body_markdown="\n\n".join(
                        [
                            "Curtidas e alcance dizem se um post circulou. Comentarios dizem como ele foi recebido.",
                            "O primeiro sinal costuma ser mudanca de tom, nao volume.",
                            "O Sentimenta transforma comentarios em score, temas, emocoes e sinais de risco rastreaveis.",
                        ]
                    ),
                    status="published",
                    category="Gestao de Reputacao",
                    persona="social-media",
                    tags=["instagram", "crise", "reputacao"],
                    cover_image_url="/blog/risco-comentarios-instagram.png",
                    cover_image_alt="Capa editorial sobre comentarios e risco reputacional",
                    cta_label="Fazer um diagnostico gratuito",
                    cta_href="/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=e2e",
                    read_time_minutes=5,
                    author_name="Sentimenta",
                    published_at=datetime.now(timezone.utc),
                )
            )
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
