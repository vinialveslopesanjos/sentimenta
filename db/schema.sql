-- Schema do banco de dados social_media_sentiment
-- SQLite

-- Vídeos analisados
CREATE TABLE IF NOT EXISTS videos (
    video_id TEXT PRIMARY KEY,
    title TEXT,
    channel_title TEXT,
    channel_id TEXT,
    published_at TEXT,
    fetched_at TEXT DEFAULT CURRENT_TIMESTAMP,
    source_url TEXT
);

-- Comentários (raw + normalizado)
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id TEXT UNIQUE NOT NULL,
    video_id TEXT NOT NULL,
    parent_comment_id TEXT NULL,
    author_name TEXT,
    author_channel_id TEXT,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    published_at TEXT,
    updated_at TEXT,
    language TEXT,
    text_original TEXT NOT NULL,
    text_clean TEXT NOT NULL,
    text_hash TEXT,
    ingest_mode TEXT CHECK(ingest_mode IN ('api', 'scrape')),
    raw_payload_json TEXT,
    status TEXT CHECK(status IN ('pending', 'processed', 'error')) DEFAULT 'pending',
    last_error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at_local TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(video_id)
);

-- Índices para comentários
CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_text_hash ON comments(text_hash);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

-- Análises de sentimento (versionadas)
CREATE TABLE IF NOT EXISTS comment_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    score_0_10 REAL,
    polarity REAL,
    intensity REAL,
    emotions_json TEXT,
    topics_json TEXT,
    sarcasm INTEGER CHECK(sarcasm IN (0, 1)),
    summary_pt TEXT,
    confidence REAL,
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_estimate_usd REAL,
    raw_llm_response TEXT,
    analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, model, prompt_version)
);

-- Índices para análises
CREATE INDEX IF NOT EXISTS idx_analysis_comment_id ON comment_analysis(comment_id);
CREATE INDEX IF NOT EXISTS idx_analysis_model ON comment_analysis(model, prompt_version);

-- Runs/Execuções do pipeline
CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    started_at TEXT DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    video_id TEXT,
    ingest_mode TEXT,
    max_comments INTEGER,
    batch_size INTEGER,
    comments_fetched INTEGER DEFAULT 0,
    comments_analyzed INTEGER DEFAULT 0,
    llm_calls INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('success', 'partial', 'failed')) DEFAULT 'success',
    notes TEXT,
    FOREIGN KEY (video_id) REFERENCES videos(video_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_video_id ON runs(video_id);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at);
