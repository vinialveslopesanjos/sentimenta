import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import Base, engine
import app.models  # noqa: F401 - ensure all models registered before create_all
from app.routers import auth, connections, posts, dashboard, pipeline, comments

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (in dev; use Alembic in production)
    if settings.DEBUG:
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables created successfully")
        except Exception as e:
            logger.warning(
                f"Could not create database tables: {e}. "
                "Make sure PostgreSQL is running. "
                "The API will start but database operations will fail."
            )
    yield


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
)

# CORS - em modo DEBUG libera todas as origens (facilita acesso via celular na rede local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else settings.CORS_ORIGINS,
    allow_credentials=not settings.DEBUG,
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


@app.get("/health")
def health():
    return {"status": "ok"}
