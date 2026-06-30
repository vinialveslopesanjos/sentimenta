"""Public and admin blog endpoints."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.blog_post import BlogPost
from app.models.blog_settings import BlogSettings
from app.models.user import User
from app.schemas.blog import (
    DEFAULT_BLOG_SETTINGS,
    BlogPostCreate,
    BlogPostListResponse,
    BlogPostResponse,
    BlogPostUpdate,
    BlogSettingsResponse,
    BlogSettingsUpdate,
)

public_router = APIRouter(prefix="/blog", tags=["blog"])
admin_router = APIRouter(prefix="/admin/blog", tags=["admin-blog"])


def _serialize(post: BlogPost) -> BlogPostResponse:
    return BlogPostResponse(
        id=post.id,
        slug=post.slug,
        title=post.title,
        excerpt=post.excerpt,
        body_markdown=post.body_markdown,
        status=post.status,  # type: ignore[arg-type]
        category=post.category,
        persona=post.persona,
        tags=post.tags or [],
        cover_image_url=post.cover_image_url,
        cover_image_alt=post.cover_image_alt,
        seo_title=post.seo_title,
        seo_description=post.seo_description,
        cta={"label": post.cta_label, "href": post.cta_href},
        read_time_minutes=post.read_time_minutes,
        author_name=post.author_name,
        published_at=post.published_at,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def _serialize_settings(settings: BlogSettings | None) -> BlogSettingsResponse:
    if not settings:
        return BlogSettingsResponse(**DEFAULT_BLOG_SETTINGS, updated_at=None)
    return BlogSettingsResponse(
        nav_pricing_label=settings.nav_pricing_label,
        nav_cta_label=settings.nav_cta_label,
        nav_cta_href=settings.nav_cta_href,
        hero_eyebrow=settings.hero_eyebrow,
        hero_title=settings.hero_title,
        hero_description=settings.hero_description,
        search_placeholder=settings.search_placeholder,
        hero_cta_label=settings.hero_cta_label,
        hero_cta_href=settings.hero_cta_href,
        sidebar_title=settings.sidebar_title,
        sidebar_description=settings.sidebar_description,
        sidebar_cta_label=settings.sidebar_cta_label,
        sidebar_cta_href=settings.sidebar_cta_href,
        all_category_label=settings.all_category_label,
        categories=settings.categories or [],
        empty_state_text=settings.empty_state_text,
        article_nav_cta_label=settings.article_nav_cta_label,
        article_nav_cta_href=settings.article_nav_cta_href,
        article_cta_title=settings.article_cta_title,
        article_cta_description=settings.article_cta_description,
        updated_at=settings.updated_at,
    )


def _get_settings(db: Session) -> BlogSettings | None:
    return db.query(BlogSettings).filter(BlogSettings.id == 1).first()


def _get_or_create_settings(db: Session) -> BlogSettings:
    settings = _get_settings(db)
    if settings:
        return settings
    settings = BlogSettings(id=1, **DEFAULT_BLOG_SETTINGS)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.plan != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_required")
    return current_user


def _get_post_or_404(db: Session, post_id: str) -> BlogPost:
    try:
        parsed_id = uuid.UUID(post_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post = db.query(BlogPost).filter(BlogPost.id == parsed_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return post


def _ensure_slug_available(db: Session, slug: str, post_id: str | None = None) -> None:
    query = db.query(BlogPost).filter(BlogPost.slug == slug)
    if post_id:
        query = query.filter(BlogPost.id != uuid.UUID(post_id))
    if query.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")


@public_router.get("/posts", response_model=BlogPostListResponse)
def list_published_posts(
    q: str | None = Query(default=None, max_length=120),
    category: str | None = Query(default=None, max_length=80),
    db: Session = Depends(get_db),
):
    query = db.query(BlogPost).filter(BlogPost.status == "published")
    if category:
        query = query.filter(BlogPost.category == category)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                BlogPost.title.ilike(term),
                BlogPost.excerpt.ilike(term),
                BlogPost.body_markdown.ilike(term),
            )
        )

    posts = query.order_by(BlogPost.published_at.desc(), BlogPost.updated_at.desc()).all()
    return {"posts": [_serialize(post) for post in posts]}


@public_router.get("/settings", response_model=BlogSettingsResponse)
def get_public_blog_settings(db: Session = Depends(get_db)):
    return _serialize_settings(_get_settings(db))


@public_router.get("/posts/{slug}", response_model=BlogPostResponse)
def get_published_post(slug: str, db: Session = Depends(get_db)):
    post = (
        db.query(BlogPost)
        .filter(BlogPost.slug == slug, BlogPost.status == "published")
        .first()
    )
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return _serialize(post)


@admin_router.get("/posts", response_model=BlogPostListResponse)
def list_admin_posts(
    status_filter: str | None = Query(default=None, alias="status", max_length=32),
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    query = db.query(BlogPost)
    if status_filter:
        query = query.filter(BlogPost.status == status_filter)
    posts = query.order_by(BlogPost.updated_at.desc()).all()
    return {"posts": [_serialize(post) for post in posts]}


@admin_router.get("/settings", response_model=BlogSettingsResponse)
def get_admin_blog_settings(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return _serialize_settings(_get_or_create_settings(db))


@admin_router.patch("/settings", response_model=BlogSettingsResponse)
def update_admin_blog_settings(
    payload: BlogSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    settings = _get_or_create_settings(db)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(settings, field, value)
    settings.updated_by = current_user.id
    settings.updated_at = datetime.now(timezone.utc)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return _serialize_settings(settings)


@admin_router.post("/posts", response_model=BlogPostResponse, status_code=status.HTTP_201_CREATED)
def create_admin_post(
    payload: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_admin),
):
    _ensure_slug_available(db, payload.slug)
    post = BlogPost(
        slug=payload.slug,
        title=payload.title.strip(),
        excerpt=payload.excerpt.strip(),
        body_markdown=payload.body_markdown.strip(),
        status="draft",
        category=payload.category,
        persona=payload.persona,
        tags=payload.tags,
        cover_image_url=payload.cover_image_url.strip(),
        cover_image_alt=payload.cover_image_alt.strip(),
        seo_title=payload.seo_title.strip() if payload.seo_title else None,
        seo_description=payload.seo_description.strip() if payload.seo_description else None,
        cta_label=payload.cta_label.strip(),
        cta_href=payload.cta_href.strip(),
        read_time_minutes=payload.read_time_minutes,
        created_by=current_user.id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize(post)


@admin_router.patch("/posts/{post_id}", response_model=BlogPostResponse)
def update_admin_post(
    post_id: str,
    payload: BlogPostUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    post = _get_post_or_404(db, post_id)
    data = payload.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"] != post.slug:
        _ensure_slug_available(db, data["slug"], post_id=post_id)

    direct_fields = [
        "slug",
        "title",
        "excerpt",
        "body_markdown",
        "category",
        "persona",
        "tags",
        "cover_image_url",
        "cover_image_alt",
        "seo_title",
        "seo_description",
        "read_time_minutes",
    ]
    for field in direct_fields:
        if field in data:
            value = data[field]
            if isinstance(value, str):
                value = value.strip()
            setattr(post, field, value)
    if "cta_label" in data:
        post.cta_label = data["cta_label"].strip()
    if "cta_href" in data:
        post.cta_href = data["cta_href"].strip()

    post.updated_at = datetime.now(timezone.utc)
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize(post)


@admin_router.post("/posts/{post_id}/publish", response_model=BlogPostResponse)
def publish_admin_post(
    post_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    post = _get_post_or_404(db, post_id)
    now = datetime.now(timezone.utc)
    post.status = "published"
    post.published_at = post.published_at or now
    post.updated_at = now
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize(post)


@admin_router.post("/posts/{post_id}/unpublish", response_model=BlogPostResponse)
def unpublish_admin_post(
    post_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
):
    post = _get_post_or_404(db, post_id)
    post.status = "draft"
    post.updated_at = datetime.now(timezone.utc)
    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize(post)
