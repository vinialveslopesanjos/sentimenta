import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import auth, connections, posts, dashboard, pipeline, comments, billing, support, demographics

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


@app.get("/health")
def health():
    return {"status": "ok"}
