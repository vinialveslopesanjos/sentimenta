import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


BlogStatus = Literal["draft", "published"]
BlogPersona = Literal["agencias", "social-media", "criadores", "fundadores"]


DEFAULT_BLOG_SETTINGS = {
    "nav_pricing_label": "Preços",
    "nav_cta_label": "Comece grátis",
    "nav_cta_href": "/login?utm_source=blog&utm_medium=nav&utm_campaign=start-free",
    "hero_eyebrow": "Conteúdo para transformar comentários em decisão",
    "hero_title": "Reputação digital sem ler comentário por comentário",
    "hero_description": "Guias curtos para social medias, agências e fundadores entenderem sentimento, temas e sinais de crise antes que a conversa vire ruído.",
    "search_placeholder": "Buscar por dor, canal ou assunto",
    "hero_cta_label": "Diagnóstico gratuito",
    "hero_cta_href": "/diagnostico?utm_source=blog&utm_medium=hero&utm_campaign=diagnostico",
    "sidebar_title": "Veja isso com comentários reais",
    "sidebar_description": "Conecte um perfil público e veja sentimento, emoções, temas e sinais de crise em poucos minutos.",
    "sidebar_cta_label": "Testar com um perfil",
    "sidebar_cta_href": "/diagnostico?utm_source=blog&utm_medium=sidebar&utm_campaign=diagnostico",
    "all_category_label": "Todos",
    "categories": ["Análise de Sentimento", "Gestão de Reputação"],
    "empty_state_text": "Nenhum artigo encontrado para essa busca.",
    "article_nav_cta_label": "Comece grátis",
    "article_nav_cta_href": "/login?utm_source=blog&utm_medium=article_nav&utm_campaign=start-free",
    "article_cta_title": "Quer ver isso com comentários reais?",
    "article_cta_description": "O caminho mais rápido é analisar um perfil ou post público e transformar comentários em score, temas, emoções e riscos claros.",
}


class BlogPostBase(BaseModel):
    slug: str = Field(min_length=3, max_length=220)
    title: str = Field(min_length=3, max_length=255)
    excerpt: str = Field(min_length=20, max_length=700)
    body_markdown: str = Field(min_length=80)
    category: str = Field(min_length=2, max_length=80)
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

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str) -> str:
        return value.strip()


class BlogPostCreate(BlogPostBase):
    pass


class BlogPostUpdate(BaseModel):
    slug: str | None = Field(default=None, min_length=3, max_length=220)
    title: str | None = Field(default=None, min_length=3, max_length=255)
    excerpt: str | None = Field(default=None, min_length=20, max_length=700)
    body_markdown: str | None = Field(default=None, min_length=80)
    category: str | None = Field(default=None, min_length=2, max_length=80)
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

    @field_validator("category")
    @classmethod
    def normalize_category(cls, value: str | None) -> str | None:
        return value.strip() if value else value


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


class BlogSettingsBase(BaseModel):
    nav_pricing_label: str = Field(min_length=2, max_length=80)
    nav_cta_label: str = Field(min_length=2, max_length=120)
    nav_cta_href: str = Field(min_length=1, max_length=2000)
    hero_eyebrow: str = Field(min_length=2, max_length=180)
    hero_title: str = Field(min_length=2, max_length=255)
    hero_description: str = Field(min_length=20, max_length=1000)
    search_placeholder: str = Field(min_length=2, max_length=180)
    hero_cta_label: str = Field(min_length=2, max_length=120)
    hero_cta_href: str = Field(min_length=1, max_length=2000)
    sidebar_title: str = Field(min_length=2, max_length=180)
    sidebar_description: str = Field(min_length=20, max_length=1000)
    sidebar_cta_label: str = Field(min_length=2, max_length=120)
    sidebar_cta_href: str = Field(min_length=1, max_length=2000)
    all_category_label: str = Field(min_length=2, max_length=80)
    categories: list[str] = Field(default_factory=list, max_length=12)
    empty_state_text: str = Field(min_length=2, max_length=255)
    article_nav_cta_label: str = Field(min_length=2, max_length=120)
    article_nav_cta_href: str = Field(min_length=1, max_length=2000)
    article_cta_title: str = Field(min_length=2, max_length=180)
    article_cta_description: str = Field(min_length=20, max_length=1000)

    @field_validator("categories")
    @classmethod
    def normalize_categories(cls, value: list[str]) -> list[str]:
        categories: list[str] = []
        for category in value:
            cleaned = category.strip()
            if cleaned and cleaned not in categories:
                categories.append(cleaned[:80])
        return categories


class BlogSettingsUpdate(BaseModel):
    nav_pricing_label: str | None = Field(default=None, min_length=2, max_length=80)
    nav_cta_label: str | None = Field(default=None, min_length=2, max_length=120)
    nav_cta_href: str | None = Field(default=None, min_length=1, max_length=2000)
    hero_eyebrow: str | None = Field(default=None, min_length=2, max_length=180)
    hero_title: str | None = Field(default=None, min_length=2, max_length=255)
    hero_description: str | None = Field(default=None, min_length=20, max_length=1000)
    search_placeholder: str | None = Field(default=None, min_length=2, max_length=180)
    hero_cta_label: str | None = Field(default=None, min_length=2, max_length=120)
    hero_cta_href: str | None = Field(default=None, min_length=1, max_length=2000)
    sidebar_title: str | None = Field(default=None, min_length=2, max_length=180)
    sidebar_description: str | None = Field(default=None, min_length=20, max_length=1000)
    sidebar_cta_label: str | None = Field(default=None, min_length=2, max_length=120)
    sidebar_cta_href: str | None = Field(default=None, min_length=1, max_length=2000)
    all_category_label: str | None = Field(default=None, min_length=2, max_length=80)
    categories: list[str] | None = Field(default=None, max_length=12)
    empty_state_text: str | None = Field(default=None, min_length=2, max_length=255)
    article_nav_cta_label: str | None = Field(default=None, min_length=2, max_length=120)
    article_nav_cta_href: str | None = Field(default=None, min_length=1, max_length=2000)
    article_cta_title: str | None = Field(default=None, min_length=2, max_length=180)
    article_cta_description: str | None = Field(default=None, min_length=20, max_length=1000)

    @field_validator("categories")
    @classmethod
    def normalize_categories(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return BlogSettingsBase.normalize_categories(value)


class BlogSettingsResponse(BlogSettingsBase):
    updated_at: datetime | None = None
