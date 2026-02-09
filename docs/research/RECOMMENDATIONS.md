# Prioritized Recommendations

> Last updated: February 2026 | SentimentIQ R&D
>
> Synthesized from: [EMERGING_TECH.md](./EMERGING_TECH.md) | [NEW_DATA_SOURCES.md](./NEW_DATA_SOURCES.md) | [ADVANCED_ANALYSIS.md](./ADVANCED_ANALYSIS.md) | [INNOVATIVE_EXPERIENCES.md](./INNOVATIVE_EXPERIENCES.md)

---

## Executive Summary

This document synthesizes all research findings into a prioritized roadmap for SentimentIQ. Recommendations are organized by implementation timeline and ranked by the combination of user impact, implementation effort, and revenue potential.

**Key Takeaways:**
1. **Migrate from Gemini 2.0 Flash immediately** -- it is being deprecated in June 2026
2. **Enrich the analysis pipeline** (emotions, ABSA, bot detection) with minimal infrastructure change
3. **Add pgvector** to existing PostgreSQL for the foundation of many future features
4. **Threads is the easiest new platform** to add (same Meta auth)
5. **Proactive alerts** are the highest-impact feature for user retention
6. **AI Copilot** is the ultimate long-term differentiator

---

## Quick Wins (1-2 Weeks Each)

These require minimal infrastructure changes and deliver immediate user value.

### QW-1: Migrate to Gemini 2.5 Flash (URGENT)

| Aspect | Details |
|--------|---------|
| **Why** | Gemini 2.0 Flash is being deprecated June 2026; Gemini 2.5 Flash offers better reasoning at similar cost |
| **Effort** | 1-2 days |
| **Impact** | Critical -- prevents service disruption |
| **Cost Change** | ~2x token cost ($0.075 -> $0.15/1M input) but better quality |
| **How** | Update model name in `backend/app/core/config.py` and test prompt outputs |

```python
# config.py change
GEMINI_MODEL = "gemini-2.5-flash"  # was "gemini-2.0-flash"
```

### QW-2: Add Emotion Detection to Analysis Prompt

| Aspect | Details |
|--------|---------|
| **Why** | Goes beyond positive/neutral/negative; users get actionable emotion insights |
| **Effort** | 3-5 days (prompt + schema + frontend display) |
| **Impact** | High -- immediate product differentiation |
| **Cost Change** | +5-10% more tokens per analysis (larger prompt/response) |
| **How** | Extend Gemini prompt to output Plutchik emotions; add columns to Analysis model; add EmotionChart to dashboard |

**Database changes:**
```sql
ALTER TABLE analyses ADD COLUMN primary_emotion VARCHAR(20);
ALTER TABLE analyses ADD COLUMN emotion_intensity VARCHAR(10);
ALTER TABLE analyses ADD COLUMN secondary_emotion VARCHAR(20);
```

### QW-3: Add Bot Detection (Heuristic + LLM)

| Aspect | Details |
|--------|---------|
| **Why** | Bots distort sentiment accuracy by 10-20%; filtering them improves data quality |
| **Effort** | 3-5 days |
| **Impact** | High -- improves core product accuracy |
| **Cost Change** | Minimal (add one field to existing LLM prompt) |
| **How** | Add heuristic rules for obvious bots; extend LLM prompt for bot probability; filter flagged comments from aggregations |

**Database changes:**
```sql
ALTER TABLE comments ADD COLUMN bot_probability FLOAT DEFAULT 0.0;
ALTER TABLE comments ADD COLUMN is_filtered BOOLEAN DEFAULT FALSE;
```

### QW-4: Add Threads (Meta) Integration

| Aspect | Details |
|--------|---------|
| **Why** | Leverages existing Meta Developer App and Instagram OAuth; essentially free to add |
| **Effort** | 1 week |
| **Impact** | Medium -- adds new platform with zero infrastructure cost |
| **Cost Change** | None (free API) |
| **How** | Extend Instagram OAuth scope; create ThreadsService reusing Instagram patterns; add to frontend connection flow |

### QW-5: Install pgvector Extension

| Aspect | Details |
|--------|---------|
| **Why** | Foundation for similarity search, deduplication, RAG, topic clustering, and AI Copilot |
| **Effort** | 2-3 days (install extension, add embedding column, create index) |
| **Impact** | Foundation -- enables 5+ future features |
| **Cost Change** | None (extension on existing PostgreSQL) |
| **How** | Add pgvector to Docker Compose PostgreSQL; create migration; add embedding column to comments table |

```sql
CREATE EXTENSION vector;
ALTER TABLE comments ADD COLUMN embedding vector(768);
CREATE INDEX ON comments USING hnsw (embedding vector_cosine_ops);
```

### QW-6: Onboarding Checklist

| Aspect | Details |
|--------|---------|
| **Why** | Proven SaaS tactic: users who complete onboarding are 3x more likely to retain |
| **Effort** | 3-5 days (frontend only) |
| **Impact** | High -- improves activation rate |
| **Cost Change** | None |
| **How** | Add progress tracker component; track: account created, first connection, first sync, viewed dashboard, explored post detail |

---

## Medium-Term (1-3 Months)

These require more development effort but are clearly valuable.

### MT-1: Aspect-Based Sentiment Analysis (ABSA)

| Aspect | Details |
|--------|---------|
| **Why** | Transforms product from "is it positive?" to "what specifically is positive/negative?" |
| **Effort** | 2-4 weeks |
| **Impact** | Very High -- major product upgrade |
| **Revenue** | Justifies premium tier pricing |
| **How** | Extend LLM prompt for aspect extraction; new `aspect_sentiments` table; aggregation queries; aspect dashboard section |

**This is the single highest-value advanced feature.** Users can see that "video quality" is trending positive but "audio quality" is declining, enabling specific action.

### MT-2: Proactive Alert System

| Aspect | Details |
|--------|---------|
| **Why** | Transforms product from passive dashboard to active monitoring tool; highest retention impact |
| **Effort** | 3-4 weeks |
| **Impact** | Very High -- biggest retention driver |
| **Revenue** | Core feature for paid tiers |
| **Dependencies** | Celery Beat (already have), email service (SendGrid/Resend) |
| **How** | Alerts model + preferences; Celery Beat hourly check task; statistical anomaly detection; in-app notification UI; email alerts |

### MT-3: Topic Clustering with BERTopic

| Aspect | Details |
|--------|---------|
| **Why** | Automatic topic discovery from comments; tracks conversation evolution |
| **Effort** | 2-3 weeks |
| **Impact** | High -- unique insight layer |
| **Dependencies** | Embedding pipeline (QW-5) |
| **How** | Install BERTopic + sentence-transformers; run clustering per connection; LLM-generated topic labels; topic evolution chart |

**Synergy:** Embeddings generated for BERTopic are the same ones stored in pgvector -- build once, use everywhere.

### MT-4: Automated Report Generation

| Aspect | Details |
|--------|---------|
| **Why** | Direct revenue from agency tier; clear monetization path |
| **Effort** | 4-6 weeks |
| **Impact** | High -- unlocks agency use case |
| **Revenue** | Agency tier at $79/month |
| **How** | WeasyPrint for PDF generation; LLM executive summaries; Celery Beat scheduling; email delivery; white-label branding |

### MT-5: TikTok Integration

| Aspect | Details |
|--------|---------|
| **Why** | Most requested platform; huge user demand; major differentiator |
| **Effort** | 2-3 weeks (using third-party data provider) |
| **Impact** | Very High -- expands addressable market by ~40% |
| **Revenue** | Premium add-on ($10-20/month extra) |
| **Cost** | $50-200/month for data provider (SociaVault, Bright Data) |
| **How** | Integrate with third-party TikTok data API; create TikTokService; process comments through existing pipeline |

### MT-6: Trend Forecasting with Prophet

| Aspect | Details |
|--------|---------|
| **Why** | Predictive insights; powers the anomaly detection in the alert system |
| **Effort** | 2-3 weeks |
| **Impact** | Medium-High |
| **Dependencies** | 30+ days of historical data per connection; Alert system (MT-2) |
| **How** | Install Prophet; daily Celery task for forecast generation; integrate with alert thresholds; forecast visualization in dashboard |

### MT-7: Reddit Integration

| Aspect | Details |
|--------|---------|
| **Why** | High-quality, long-form comments ideal for sentiment analysis; easy implementation |
| **Effort** | 1-2 weeks |
| **Impact** | Medium -- niche but valuable |
| **Cost** | Free tier sufficient for initial launch |
| **How** | PRAW Python library; subreddit monitoring; process through existing pipeline |

---

## Long-Term (3-6 Months)

These are strategic investments for differentiation.

### LT-1: AI Copilot (Chat with Your Data)

| Aspect | Details |
|--------|---------|
| **Why** | Ultimate premium differentiator; transforms data into conversational insights |
| **Effort** | 3-6 months |
| **Impact** | Very High -- game-changing feature |
| **Revenue** | Premium feature ($20-50/month add-on) |
| **Dependencies** | pgvector, RAG infrastructure, embeddings pipeline, enriched data (ABSA, topics, emotions) |
| **How** | Text-to-SQL + RAG pipeline; chat UI with streaming; context-aware responses; suggested questions |
| **Recommended LLM** | Claude Sonnet 4.5 ($3/$15 per 1M tokens) |

### LT-2: Multi-Model Strategy

| Aspect | Details |
|--------|---------|
| **Why** | Optimize cost and quality by routing tasks to the best-fit model |
| **Effort** | 2-4 weeks (after initial setup) |
| **Impact** | Medium -- cost optimization + quality improvement |
| **How** | Route bulk analysis to cheap models (Gemini Flash, DeepSeek); complex tasks to premium models (Claude Sonnet); A/B test quality |

**Example routing:**
| Task | Model | Cost/1M tokens |
|------|-------|----------------|
| Basic sentiment (1-10 + pos/neg/neutral) | Gemini 3 Flash | $0.20/$0.80 |
| ABSA + Emotion detection | Claude Haiku 4.5 | $1/$5 |
| AI Copilot conversations | Claude Sonnet 4.5 | $3/$15 |
| Report executive summaries | Claude Sonnet 4.5 | $3/$15 |

### LT-3: RAG for Brand-Specific Context

| Aspect | Details |
|--------|---------|
| **Why** | Enables domain-specific accuracy; powers copilot with historical context |
| **Effort** | 2-3 weeks (with pgvector already in place) |
| **Impact** | High -- quality improvement for all analysis |
| **Dependencies** | pgvector (QW-5), embedding pipeline |
| **How** | Store brand context documents; retrieve relevant context before analysis; augment LLM prompts |

### LT-4: Competitive Benchmarking

| Aspect | Details |
|--------|---------|
| **Why** | Most requested analytics feature; provides context for sentiment numbers |
| **Effort** | 2-4 weeks |
| **Impact** | Medium-High |
| **How** | Phase 1: industry benchmarks from published data; Phase 2: anonymous internal benchmarks; Phase 3: opt-in competitor tracking |

### LT-5: Predictive Analytics

| Aspect | Details |
|--------|---------|
| **Why** | Forward-looking insights; content strategy recommendations |
| **Effort** | 2-3 months |
| **Impact** | High |
| **Dependencies** | 90+ days of historical data; ABSA; topic clustering; trend forecasting |
| **How** | Correlation analysis (sentiment vs engagement); LLM-generated predictions; content strategy recommendations |

### LT-6: Image + Text Multimodal Analysis

| Aspect | Details |
|--------|---------|
| **Why** | Adds visual context to sentiment analysis; especially valuable for Instagram |
| **Effort** | 1-2 weeks (using existing vision LLM APIs) |
| **Impact** | Medium |
| **Cost Change** | 2-5x more tokens per post analysis |
| **How** | Send post images to Gemini Vision alongside text; merge visual and textual sentiment signals |

---

## Not Recommended

These sound interesting but are not worth pursuing at our current stage.

### NR-1: Twitter/X Integration

| Reason | Details |
|--------|---------|
| **Cost** | Pro tier at $5,000/month is unsustainable for a startup |
| **Free tier** | Write-only; cannot read tweets |
| **Basic tier** | $200/month for 15,000 tweets -- insufficient for analytics |
| **Alternative** | Wait for pay-per-use model; consider if a customer specifically requests and will cover the cost |
| **Revisit When** | Pricing drops or pay-per-use becomes broadly available |

### NR-2: LinkedIn Integration

| Reason | Details |
|--------|---------|
| **Access** | Requires official LinkedIn Partner status (long approval process) |
| **Scope** | Can only analyze comments on your own pages |
| **Volume** | LinkedIn comments are typically low volume and professionally moderated |
| **Value** | Sentiment signal is weak in professional context |
| **Revisit When** | Building an Enterprise tier specifically for B2B brands |

### NR-3: WhatsApp Business Integration

| Reason | Details |
|--------|---------|
| **Scope Mismatch** | WhatsApp is a messaging platform, not a social media platform |
| **Data Access** | Only business-managed conversations; no organic social listening |
| **Cost** | Per-conversation pricing adds up |
| **Better Fit** | This is a different product ("Customer Voice") rather than a social media tool |
| **Revisit When** | Expanding beyond social media into customer communication analytics |

### NR-4: Audio/Voice Sentiment Analysis

| Reason | Details |
|--------|---------|
| **Relevance** | Our data sources are text-based comments; voice comments are rare |
| **Complexity** | Requires speech processing pipeline (ASR + SER) |
| **Cost** | High infrastructure and processing cost |
| **ROI** | Very low for our use case |
| **Revisit When** | Adding podcast or voice note analysis as a product vertical |

### NR-5: Self-Hosting Open-Source LLMs

| Reason | Details |
|--------|---------|
| **Cost** | GPU hosting ($500-2,000/month) exceeds API costs at our volume |
| **Complexity** | Model serving, optimization, monitoring, updates |
| **Quality** | Open-source models lag frontier models for nuanced sentiment tasks |
| **Break-Even** | Only cost-effective at 1M+ comments/month |
| **Revisit When** | Processing volume exceeds 1M comments/month AND quality needs are met |

### NR-6: LangChain/LangGraph Adoption (Now)

| Reason | Details |
|--------|---------|
| **Current Pipeline** | Our Gemini-based pipeline is linear and working well |
| **Overhead** | Adds abstraction complexity, version management, learning curve |
| **Risk** | Framework lock-in; version churn can break production |
| **Revisit When** | Building multi-step agent workflows (AI Copilot) or multi-model routing |

### NR-7: Graph Database (Neo4j)

| Reason | Details |
|--------|---------|
| **Overkill** | NetworkX handles our graph analysis needs without new infrastructure |
| **Cost** | Additional database to manage and monitor |
| **Scale** | Our comment interaction graphs are not large enough to justify it |
| **Revisit When** | Processing millions of comments with complex relationship queries |

---

## Implementation Roadmap

```
February 2026 (Immediate)
├── QW-1: Migrate to Gemini 2.5 Flash ────────────────── [2 days]
├── QW-5: Install pgvector extension ─────────────────── [3 days]
└── QW-2: Add emotion detection to prompt ────────────── [5 days]

March 2026
├── QW-3: Bot detection (heuristic + LLM) ───────────── [5 days]
├── QW-4: Threads integration ────────────────────────── [1 week]
├── QW-6: Onboarding checklist ───────────────────────── [5 days]
└── MT-1: ABSA (start) ──────────────────────────────── [begins]

April 2026
├── MT-1: ABSA (complete) ────────────────────────────── [2 weeks]
├── MT-2: Proactive alerts (start) ───────────────────── [begins]
└── MT-3: BERTopic clustering ────────────────────────── [2 weeks]

May 2026
├── MT-2: Proactive alerts (complete) ────────────────── [complete]
├── MT-5: TikTok integration ─────────────────────────── [2 weeks]
└── MT-4: Report generation (start) ──────────────────── [begins]

June 2026
├── MT-4: Report generation (complete) ───────────────── [complete]
├── MT-6: Trend forecasting ──────────────────────────── [2 weeks]
└── MT-7: Reddit integration ─────────────────────────── [1 week]

July-September 2026
├── LT-1: AI Copilot (start) ────────────────────────── [3-6 months]
├── LT-2: Multi-model strategy ───────────────────────── [2 weeks]
├── LT-3: RAG infrastructure ────────────────────────── [2 weeks]
└── LT-4: Competitive benchmarking ───────────────────── [2 weeks]

October-December 2026
├── LT-1: AI Copilot (complete) ──────────────────────── [complete]
├── LT-5: Predictive analytics ───────────────────────── [2 months]
└── LT-6: Multimodal analysis ───────────────────────── [2 weeks]
```

---

## Cost Projections

### Current Monthly Costs (Estimate)

| Item | Cost |
|------|------|
| Gemini 2.0 Flash API | ~$20-50 |
| PostgreSQL (Docker) | Infrastructure only |
| Redis (Docker) | Infrastructure only |
| **Total** | **~$20-50/month** |

### Projected Costs After All Implementations

| Item | Cost |
|------|------|
| Gemini 2.5/3 Flash (bulk analysis) | ~$40-100 |
| Claude Sonnet 4.5 (copilot + reports) | ~$30-80 |
| Embedding API (text-embedding-3-small) | ~$5-15 |
| TikTok data provider | ~$50-200 |
| SendGrid (email alerts + reports) | ~$15-20 |
| **Total** | **~$140-415/month** |

### Revenue to Cover Costs

| Tier | Price | Features | Users Needed to Break Even |
|------|-------|----------|---------------------------|
| **Free** | $0 | Basic analysis, 1 connection | -- |
| **Pro** | $29/month | ABSA, alerts, reports, 5 connections | 5-15 users |
| **Agency** | $79/month | White-label, TikTok, unlimited connections | 2-6 users |
| **Enterprise** | $199/month | AI Copilot, benchmarking, priority support | 1-3 users |

With just 10-20 paying users, all infrastructure costs are covered.

---

## Key Technical Decisions Summary

| Decision | Recommendation | Reasoning |
|----------|---------------|-----------|
| **Vector Database** | pgvector (extend existing PostgreSQL) | Zero new infrastructure; sufficient for our scale |
| **Primary LLM** | Gemini 2.5/3 Flash (bulk) + Claude Sonnet 4.5 (premium) | Cost-optimized multi-model approach |
| **Topic Modeling** | BERTopic | Best quality for short texts; synergy with embeddings |
| **Forecasting** | Prophet | Easy to use; handles our data patterns well |
| **PDF Reports** | WeasyPrint | Python-native; matches our backend stack |
| **Email Service** | SendGrid or Resend | Reliable; good free tier |
| **Text-to-SQL** | Custom implementation (not framework) | Full control over security and query generation |
| **Orchestration** | Keep custom code (not LangChain) | Our pipeline is simple enough; avoid unnecessary abstraction |
| **New Platform Priority** | Threads > TikTok > Reddit | Effort-to-value ratio |
