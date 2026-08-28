"""
Prévia Mágica — análise pública anônima (sem conta).

Um visitante cola um @ e recebe o sentimento real dos últimos posts, sem login.
É topo de funil de aquisição: amostra minúscula, efêmera, sem histórico nem
monitoramento (o produto pago segue atrás do trial). Reaproveita o pipeline
existente (_do_ingest + analyze_post_comments) sob um usuário-sistema, com
conexões auto_sync=False para o beat noturno nunca re-scrapear preview.

Custo controlado por: amostra pequena, cache Redis 24h por @, rate-limit por IP
no router, e os tetos de Apify do P2 ($2/run, 2000 comentários).
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.cache import get_redis
from app.models.analysis import CommentAnalysis
from app.models.comment import Comment
from app.models.post import Post
from app.models.social_connection import SocialConnection
from app.models.user import User

logger = logging.getLogger(__name__)

PREVIEW_SYSTEM_EMAIL = "preview-system@sentimenta.internal"
PREVIEW_MAX_POSTS = 2
PREVIEW_COMMENTS_PER_POST = 25
PREVIEW_CACHE_TTL = 60 * 60 * 24  # 24h
SUPPORTED_PLATFORMS = ("youtube", "instagram")


class PreviewError(Exception):
    """Erro de negócio da prévia (perfil privado, não encontrado, etc.)."""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def _cache_key(platform: str, handle: str) -> str:
    return f"preview:v1:{platform}:{handle.lower().lstrip('@')}"


def get_cached_preview(platform: str, handle: str) -> dict | None:
    r = get_redis()
    if not r:
        return None
    try:
        raw = r.get(_cache_key(platform, handle))
        return json.loads(raw) if raw else None
    except Exception as exc:
        logger.debug("preview cache read failed: %s", exc)
        return None


def _set_cached_preview(platform: str, handle: str, payload: dict) -> None:
    r = get_redis()
    if not r:
        return
    try:
        r.setex(_cache_key(platform, handle), PREVIEW_CACHE_TTL, json.dumps(payload))
    except Exception as exc:
        logger.debug("preview cache write failed: %s", exc)


def _get_preview_user(db: Session) -> User:
    user = db.query(User).filter(User.email == PREVIEW_SYSTEM_EMAIL).first()
    if user is None:
        user = User(
            email=PREVIEW_SYSTEM_EMAIL,
            name="Preview System",
            plan="admin",  # sem limites; a prévia não passa pelo gate de créditos
            email_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _normalize_handle(platform: str, handle: str) -> str:
    norm = handle.strip().lstrip("@")
    if platform == "youtube":
        return f"@{norm}"
    return norm


def _get_or_create_preview_connection(db: Session, platform: str, handle: str) -> SocialConnection:
    user = _get_preview_user(db)
    username = _normalize_handle(platform, handle)

    conn = (
        db.query(SocialConnection)
        .filter(
            SocialConnection.user_id == user.id,
            SocialConnection.platform == platform,
            SocialConnection.username == username,
        )
        .first()
    )
    if conn:
        return conn

    if platform == "youtube":
        from app.services.youtube_service import discover_channel_info

        info = discover_channel_info(username)
        if not info:
            raise PreviewError("not_found", "Canal não encontrado.")
        conn = SocialConnection(
            user_id=user.id,
            platform="youtube",
            platform_user_id=info.get("channel_id"),
            username=username,
            display_name=info.get("channel_title") or info.get("title") or username,
            profile_url=f"https://youtube.com/{username}",
            profile_image_url=info.get("thumbnail_url"),
            followers_count=info.get("subscriber_count", 0) or 0,
            status="active",
            auto_sync=False,  # nunca entra no beat noturno
        )
    elif platform == "instagram":
        from app.services.apify_service import fetch_profile_apify

        prof = fetch_profile_apify(username)
        if not prof:
            raise PreviewError("not_found", "Perfil não encontrado.")
        if prof.get("private"):
            raise PreviewError("private", "Perfil privado — não dá para analisar comentários.")
        conn = SocialConnection(
            user_id=user.id,
            platform="instagram",
            platform_user_id=prof.get("id"),
            username=username,
            display_name=prof.get("fullName") or username,
            profile_url=f"https://instagram.com/{username}",
            profile_image_url=prof.get("profilePicUrlHD") or prof.get("profilePicUrl"),
            followers_count=prof.get("followersCount", 0) or 0,
            status="active",
            auto_sync=False,
        )
    else:
        raise PreviewError("unsupported", f"Plataforma não suportada: {platform}")

    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


def _build_response(db: Session, conn: SocialConnection) -> dict:
    """Monta a resposta da prévia a partir dos posts já analisados."""
    posts = (
        db.query(Post)
        .filter(Post.connection_id == conn.id)
        .order_by(Post.published_at.desc().nullslast())
        .limit(PREVIEW_MAX_POSTS)
        .all()
    )

    posts_out = []
    all_scores: list[float] = []
    for post in posts:
        analyses = (
            db.query(CommentAnalysis)
            .join(Comment, Comment.id == CommentAnalysis.comment_id)
            .filter(
                Comment.post_id == post.id,
                CommentAnalysis.score_0_10.isnot(None),
            )
            .all()
        )
        if not analyses:
            continue

        scores = [a.score_0_10 for a in analyses if a.score_0_10 is not None]
        emotion_counter: dict[str, int] = {}
        pos = neu = neg = 0
        for a in analyses:
            if a.score_0_10 is not None:
                if a.score_0_10 > 6:
                    pos += 1
                elif a.score_0_10 >= 4:
                    neu += 1
                else:
                    neg += 1
            for emo in (a.emotions or []):
                emotion_counter[emo] = emotion_counter.get(emo, 0) + 1

        total = len(scores) or 1
        avg = round(sum(scores) / total, 1)
        all_scores.extend(scores)
        top_emotion = max(emotion_counter, key=emotion_counter.get) if emotion_counter else None

        media = post.media_urls if isinstance(post.media_urls, dict) else {}
        posts_out.append({
            "caption": (post.content_text or "")[:140],
            "thumbnail_url": media.get("thumbnail_url") or media.get("url"),
            "analyzed_comments": total,
            "avg_score": avg,
            "top_emotion": top_emotion,
            "sentiment_split": {"positive": pos, "neutral": neu, "negative": neg},
        })

    overall = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

    return {
        "platform": conn.platform,
        "handle": conn.username,
        "profile": {
            "display_name": conn.display_name,
            "profile_image_url": conn.profile_image_url,
            "followers_count": conn.followers_count,
        },
        "overall_score": overall,
        "posts": posts_out,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def run_preview(db: Session, platform: str, handle: str) -> dict:
    """Executa a prévia completa: cache → ingest amostra → análise → resposta."""
    from app.tasks.pipeline_tasks import _do_ingest
    from app.services.analysis_service import analyze_post_comments, generate_post_summary

    platform = platform.lower()
    if platform not in SUPPORTED_PLATFORMS:
        raise PreviewError("unsupported", "Por enquanto a prévia funciona com YouTube e Instagram.")

    cached = get_cached_preview(platform, handle)
    if cached:
        cached["cached"] = True
        return cached

    conn = _get_or_create_preview_connection(db, platform, handle)

    _do_ingest(
        db, conn,
        max_posts=PREVIEW_MAX_POSTS,
        max_comments_per_post=PREVIEW_COMMENTS_PER_POST,
        mode="preview",
        comment_sample_mode="all",
    )

    posts = (
        db.query(Post)
        .filter(Post.connection_id == conn.id)
        .order_by(Post.published_at.desc().nullslast())
        .limit(PREVIEW_MAX_POSTS)
        .all()
    )
    for post in posts:
        analyze_post_comments(
            db, post.id,
            batch_size=PREVIEW_COMMENTS_PER_POST,
            skip_vision=True,
        )
        generate_post_summary(db, post.id)

    response = _build_response(db, conn)
    if not response["posts"]:
        raise PreviewError("no_comments", "Não encontramos comentários recentes para analisar.")

    response["cached"] = False
    _set_cached_preview(platform, handle, response)
    return response
