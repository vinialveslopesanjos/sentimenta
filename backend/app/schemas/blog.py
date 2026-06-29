import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


BlogStatus = Literal["draft", "published"]
BlogCategory = Literal["Analise de Sentimento", "Gestao de Reputacao", "Aquisicao e Ads"]
BlogPersona = Literal["agencias", "social-media", "criadores", "fundadores"]


class BlogPostBase(BaseModel):
    slug: str = Field(min_length=3, max_length=220)
    title: str = Field(min_length=3, max_length=255)
    excerpt: str = Field(min_length=20, max_length=700)
    body_markdown: str = Field(min_length=80)
    category: BlogCategory
    persona: BlogPersona
    tags: list[str] = Field(default_factory=list, max_length=12)
    cover_image_url: str = Field(min_length=1, max_length=2000)
    cover_image_alt: str = Field(min_length=5, max_length=500)
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    cta_label: str = Field(min_length=2, max_length=120)
    cta_href: str = Field(min_length=1, max_length=2000)
    read_time_minutes: int = Field(default=5, ge=1, le=60)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if cleaned != value.strip():
            return cleaned
        return value.strip()

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str]) -> list[str]:
        tags: list[str] = []
        for tag in value:
            cleaned = tag.strip().lower()
            if cleaned and cleaned not in tags:
                tags.append(cleaned[:40])
        return tags


class BlogPostCreate(BlogPostBase):
    pass


class BlogPostUpdate(BaseModel):
    slug: str | None = Field(default=None, min_length=3, max_length=220)
    title: str | None = Field(default=None, min_length=3, max_length=255)
    excerpt: str | None = Field(default=None, min_length=20, max_length=700)
    body_markdown: str | None = Field(default=None, min_length=80)
    category: BlogCategory | None = None
    persona: BlogPersona | None = None
    tags: list[str] | None = Field(default=None, max_length=12)
    cover_image_url: str | None = Field(default=None, min_length=1, max_length=2000)
    cover_image_alt: str | None = Field(default=None, min_length=5, max_length=500)
    seo_title: str | None = Field(default=None, max_length=255)
    seo_description: str | None = Field(default=None, max_length=500)
    cta_label: str | None = Field(default=None, min_length=2, max_length=120)
    cta_href: str | None = Field(default=None, min_length=1, max_length=2000)
    read_time_minutes: int | None = Field(default=None, ge=1, le=60)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str | None) -> str | None:
        return value.strip().lower() if value else value

    @field_validator("tags")
    @classmethod
    def normalize_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        tags: list[str] = []
        for tag in value:
            cleaned = tag.strip().lower()
            if cleaned and cleaned not in tags:
                tags.append(cleaned[:40])
        return tags


class BlogCta(BaseModel):
    label: str
    href: str


class BlogPostResponse(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    excerpt: str
    body_markdown: str
    status: BlogStatus
    category: str
    persona: str
    tags: list[str]
    cover_image_url: str
    cover_image_alt: str
    seo_title: str | None
    seo_description: str | None
    cta: BlogCta
    read_time_minutes: int
    author_name: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class BlogPostListResponse(BaseModel):
    posts: list[BlogPostResponse]
