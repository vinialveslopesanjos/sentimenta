"""
Configuração do Social Media Sentiment MVP.
Todas as configurações podem ser sobrescritas via variáveis de ambiente.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Carrega .env se existir
load_dotenv()

# Diretórios
BASE_DIR = Path(__file__).parent.parent
OUTPUT_DIR = BASE_DIR / "output"
DB_DIR = BASE_DIR / "db"

# Garante que diretórios existam
OUTPUT_DIR.mkdir(exist_ok=True)

# Banco de dados
DB_PATH = os.getenv("DB_PATH", str(OUTPUT_DIR / "social_media_sentiment.db"))
SCHEMA_PATH = os.getenv("SCHEMA_PATH", str(DB_DIR / "schema.sql"))

# YouTube (opcional - só se quiser usar API oficial)
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

# Google Gemini (único provider suportado)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")

# Pipeline
DEFAULT_MAX_COMMENTS = int(os.getenv("DEFAULT_MAX_COMMENTS", "500"))
DEFAULT_BATCH_SIZE = int(os.getenv("DEFAULT_BATCH_SIZE", "10"))
PROMPT_VERSION = os.getenv("PROMPT_VERSION", "v1")
DEFAULT_INGEST_MODE = os.getenv("DEFAULT_INGEST_MODE", "scrape")

# Reprocessamento
SKIP_EXISTING_VIDEOS = os.getenv("SKIP_EXISTING_VIDEOS", "true").lower() == "true"

# Rate limiting
YOUTUBE_API_DELAY = float(os.getenv("YOUTUBE_API_DELAY", "0.1"))
SCRAPE_DELAY = float(os.getenv("SCRAPE_DELAY", "1.0"))

# Retry config
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_DELAY = float(os.getenv("RETRY_DELAY", "2.0"))


def validate_config(require_llm: bool = True) -> list[str]:
    """
    Valida configurações necessárias.
    Retorna lista de erros (vazia se tudo OK).
    """
    errors = []
    
    if require_llm and not GEMINI_API_KEY:
        errors.append("GEMINI_API_KEY não configurada (obrigatório para análise)")
    
    return errors


def get_db_connection_string() -> str:
    """Retorna connection string do SQLite."""
    return f"sqlite:///{DB_PATH}"
