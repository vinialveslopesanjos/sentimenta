import os
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Social Media Sentiment"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    API_PREFIX: str = "/api/v1"
    BLOG_MEDIA_DIR: str = os.getenv("BLOG_MEDIA_DIR", str(BASE_DIR / "output" / "blog_media"))
    BLOG_MEDIA_MAX_BYTES: int = int(os.getenv("BLOG_MEDIA_MAX_BYTES", str(10 * 1024 * 1024)))

    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://sentiment:sentiment@localhost:5432/sentiment_db",
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    CACHE_REDIS_URL: str = os.getenv("CACHE_REDIS_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    RATE_LIMIT_REDIS_URL: str = os.getenv(
        "RATE_LIMIT_REDIS_URL",
        os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    )

    # JWT Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    SESSION_COOKIE_DOMAIN: str = os.getenv("SESSION_COOKIE_DOMAIN", "")
    SESSION_COOKIE_SECURE: bool = os.getenv(
        "SESSION_COOKIE_SECURE",
        "true" if os.getenv("APP_URL", "").startswith("https://") else "false",
    ).lower() == "true"
    SESSION_COOKIE_SAMESITE: str = os.getenv("SESSION_COOKIE_SAMESITE", "lax")

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # Instagram OAuth
    INSTAGRAM_APP_ID: str = os.getenv("INSTAGRAM_APP_ID", "")
    INSTAGRAM_APP_SECRET: str = os.getenv("INSTAGRAM_APP_SECRET", "")
    INSTAGRAM_REDIRECT_URI: str = os.getenv(
        "INSTAGRAM_REDIRECT_URI",
        "http://localhost:8000/api/v1/auth/instagram/callback",
    )
    INSTAGRAM_SCOPES: str = "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages"
    INSTAGRAM_CONNECTIONS_REDIRECT_URI: str = os.getenv(
        "INSTAGRAM_CONNECTIONS_REDIRECT_URI",
        "http://localhost:8000/api/v1/connections/instagram/callback",
    )

    # TikTok OAuth
    TIKTOK_CLIENT_KEY: str = os.getenv("TIKTOK_CLIENT_KEY", "")
    TIKTOK_CLIENT_SECRET: str = os.getenv("TIKTOK_CLIENT_SECRET", "")
    TIKTOK_REDIRECT_URI: str = os.getenv(
        "TIKTOK_REDIRECT_URI",
        "http://localhost:8000/api/v1/auth/tiktok/callback",
    )
    TIKTOK_CONNECTIONS_REDIRECT_URI: str = os.getenv(
        "TIKTOK_CONNECTIONS_REDIRECT_URI",
        "http://localhost:8000/api/v1/connections/tiktok/callback",
    )

    # Token Encryption (AES-256)
    TOKEN_ENCRYPTION_KEY: str = os.getenv("TOKEN_ENCRYPTION_KEY", "")

    # Apify (Instagram comments)
    APIFY_API_TOKEN: str = os.getenv("APIFY_API_TOKEN", "")
    APIFY_DAILY_LIMIT_USD: float = float(os.getenv("APIFY_DAILY_LIMIT_USD", "3.0"))

    # LLM (OpenRouter — OpenAI-compatible)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "google/gemini-2.5-flash")
    LLM_BASE_URL: str = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
    INTERNAL_ANALYSIS_API_KEY: str = os.getenv("INTERNAL_ANALYSIS_API_KEY", "")

    # LLM daily cost limit per user (USD)
    LLM_DAILY_LIMIT_USD: float = float(os.getenv("LLM_DAILY_LIMIT_USD", "1.0"))

    # Pipeline
    # P3.1: análise paralela entre posts (cada worker usa a própria sessão de DB).
    # 4 workers × ~25 comentários/min por worker ≈ 100/min — meta: 500 em <5 min.
    ANALYSIS_MAX_WORKERS: int = int(os.getenv("ANALYSIS_MAX_WORKERS", "4"))
    DEFAULT_MAX_COMMENTS: int = int(os.getenv("DEFAULT_MAX_COMMENTS", "500"))
    DEFAULT_BATCH_SIZE: int = int(os.getenv("DEFAULT_BATCH_SIZE", "30"))
    PROMPT_VERSION: str = os.getenv("PROMPT_VERSION", "v1")

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://sentimenta.com.br",
        "https://sentimenta.com.br",
        "http://www.sentimenta.com.br",
        "https://www.sentimenta.com.br",
        "https://app.sentimenta.com.br",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | list) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # Celery
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv(
        "CELERY_RESULT_BACKEND", "redis://localhost:6379/1"
    )

    # App URL (for email links)
    APP_URL: str = os.getenv("APP_URL", "http://localhost:3000")
    TERMS_VERSION: str = os.getenv("TERMS_VERSION", "2026-03")

    # Stripe (payments)
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRICE_STARTER: str = os.getenv("STRIPE_PRICE_STARTER", "")
    STRIPE_PRICE_PRO: str = os.getenv("STRIPE_PRICE_PRO", "")
    STRIPE_PRICE_BUSINESS: str = os.getenv("STRIPE_PRICE_BUSINESS", "")
    STRIPE_PRICE_ENTERPRISE: str = os.getenv("STRIPE_PRICE_ENTERPRISE", "")
    STRIPE_SUCCESS_URL: str = os.getenv("STRIPE_SUCCESS_URL", "http://localhost:3000/settings?payment=success")
    STRIPE_CANCEL_URL: str = os.getenv("STRIPE_CANCEL_URL", "http://localhost:3000/pricing")

    # Credit Packs (Stripe Price IDs)
    STRIPE_PRICE_PACK_2500: str = os.getenv("STRIPE_PRICE_PACK_2500", "")
    STRIPE_PRICE_PACK_5000: str = os.getenv("STRIPE_PRICE_PACK_5000", "")
    STRIPE_PRICE_PACK_10000: str = os.getenv("STRIPE_PRICE_PACK_10000", "")

    # PostHog Analytics
    POSTHOG_API_KEY: str = os.getenv("POSTHOG_API_KEY", "")
    POSTHOG_HOST: str = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")

    # Resend (transactional emails)
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@sentimenta.com.br")

    # YouTube Data API v3
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")
    YOUTUBE_USE_API: bool = os.getenv("YOUTUBE_USE_API", "true").lower() == "true"

    # Sentry (error monitoring)
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

    class Config:
        env_file = str(BASE_DIR / ".env")
        extra = "ignore"


settings = Settings()
