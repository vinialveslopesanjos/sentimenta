import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.cache import get_redis
from app.core.config import settings
from app.db.session import SessionLocal
from app.middleware.read_only import read_only_guard
from app.middleware.operational_telemetry import capture_product_telemetry
from app.routers import analytics, auth, blog, billing, comments, connections, dashboard, data_snapshots, demographics, internal_analysis, leads, meta_compliance, ops, pipeline, posts, public, security_reports, support

# httpx loga a URL completa das requests (incluindo ?token=...) no nível INFO.
# WARNING evita vazar o token do Apify nos logs do worker/api.
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration(), CeleryIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not set. Set it in .env before starting the app.")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    redirect_slashes=False,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(read_only_guard)
app.middleware("http")(capture_product_telemetry)

# Routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(connections.router, prefix=settings.API_PREFIX)
app.include_router(posts.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(pipeline.router, prefix=settings.API_PREFIX)
app.include_router(comments.router, prefix=settings.API_PREFIX)
app.include_router(billing.router, prefix=settings.API_PREFIX)
app.include_router(support.router, prefix=settings.API_PREFIX)
app.include_router(demographics.router, prefix=settings.API_PREFIX)
app.include_router(leads.router, prefix=settings.API_PREFIX)
app.include_router(analytics.router, prefix=settings.API_PREFIX)
app.include_router(blog.public_router, prefix=settings.API_PREFIX)
app.include_router(blog.admin_router, prefix=settings.API_PREFIX)
app.include_router(ops.router, prefix=settings.API_PREFIX)
app.include_router(security_reports.router, prefix=settings.API_PREFIX)
app.include_router(data_snapshots.router, prefix=settings.API_PREFIX)
app.include_router(public.router, prefix=settings.API_PREFIX)
app.include_router(meta_compliance.router, prefix=settings.API_PREFIX)
app.include_router(internal_analysis.router, prefix=settings.API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/ready")
def readiness(response: Response):
    checks = {"database": False, "redis": False}
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
            checks["database"] = True
        finally:
            db.close()
    except Exception:
        checks["database"] = False

    try:
        redis_client = get_redis()
        checks["redis"] = bool(redis_client and redis_client.ping())
    except Exception:
        checks["redis"] = False

    ok = all(checks.values())
    if not ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if ok else "degraded", "checks": checks}
