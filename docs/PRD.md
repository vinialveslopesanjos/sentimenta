# SentimentIQ - Product Requirements Document (PRD)

**Document Version:** 1.0
**Last Updated:** 2026-02-09
**Product Owner:** SentimentIQ Product Team
**Status:** Active

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Current Feature Set (MVP)](#4-current-feature-set-mvp)
5. [Feature Requirements (Next Phase)](#5-feature-requirements-next-phase)
6. [Technical Requirements](#6-technical-requirements)
7. [Success Metrics (KPIs)](#7-success-metrics-kpis)
8. [Pricing Strategy](#8-pricing-strategy)
9. [Risks and Mitigations](#9-risks-and-mitigations)

---

## 1. Executive Summary

### Product Vision

**SentimentIQ empowers social media professionals to understand audience sentiment at scale through AI-powered analysis.** By connecting YouTube and Instagram accounts, users gain instant, actionable insights from thousands of comments -- without reading a single one manually.

### Problem Statement (Summary)

Social media professionals are overwhelmed by the volume of audience feedback across platforms. Manual comment analysis is impractical at scale, and existing enterprise tools are prohibitively expensive for SMBs and independent creators. SentimentIQ fills this gap with an affordable, focused, AI-powered sentiment analysis platform.

### Target Market Size

The global social media analytics market is valued at approximately **$12.9-16.5 billion in 2025**, projected to reach **$77.7 billion by 2034** at a **CAGR of 18-27%** depending on the research methodology. North America accounts for 37.5% of revenue, with Asia-Pacific as the fastest-growing region at 20.85% CAGR.

SentimentIQ targets the underserved **SMB and creator segment** of this market, estimated at 15-20% of the total addressable market (TAM), representing a **$2-3 billion serviceable addressable market (SAM)**.

*Sources: [Fortune Business Insights](https://www.fortunebusinessinsights.com/social-media-analytics-market-106800), [Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/global-social-media-analytics-market), [MarketsandMarkets](https://www.marketsandmarkets.com/PressReleases/social-media-analytics.asp), [Straits Research](https://straitsresearch.com/report/social-media-analytics-market)*

### Key Value Proposition

| Differentiator | SentimentIQ | Enterprise Tools (Brandwatch, Sprout Social) |
|---|---|---|
| **Price** | $29/mo (Pro) | $199-800+/mo |
| **Setup time** | 2 minutes | Days-weeks |
| **Focus** | Sentiment-first, comment-level | Broad social listening |
| **AI depth** | Emotion, sarcasm, topics per comment | Aggregate sentiment only |
| **Language** | Portuguese, Spanish, English | Primarily English |
| **Target user** | SMBs, creators, small agencies | Enterprise brands |

---

## 2. Problem Statement

### The Challenge

Social media managers, content creators, and digital marketing agencies face a critical information gap:

1. **Volume overload.** A single viral YouTube video can generate 10,000+ comments. An active Instagram profile accumulates thousands of comments weekly. Manual reading and categorization is physically impossible at scale.

2. **Blind spots in audience perception.** Without systematic analysis, creators and brands miss emerging sentiment shifts, brewing crises, and topic trends until they become visible problems. A gradual decline in positive sentiment often goes undetected for weeks.

3. **Prohibitive cost of existing tools.** Enterprise social listening platforms like Brandwatch (custom pricing, typically $800+/mo), Sprout Social ($199/mo per user), and Hootsuite ($99+/mo per user) price out the vast majority of SMBs and independent creators. These tools also bundle extensive features that small users do not need, creating unnecessary complexity.

4. **Language and market gaps.** Most social listening tools are optimized for English-language content. The Portuguese and Spanish-speaking markets -- representing over 800 million native speakers and some of the most active social media user bases globally -- are underserved. Brazil alone is the 3rd largest social media market globally.

5. **Lack of comment-level granularity.** Most existing tools provide aggregate sentiment scores. They do not analyze individual comments for emotions (anger, joy, surprise), sarcasm detection, topic extraction, and intensity -- the granularity that drives truly actionable insights.

### The Opportunity

SentimentIQ addresses all five challenges by providing:
- **Automated AI analysis** of every comment using Google Gemini 2.0 Flash
- **Affordable pricing** starting at $29/month for professionals
- **Native multi-language support** with a focus on Portuguese, Spanish, and English
- **Comment-level granularity** including sentiment scores (0-10), emotion detection, topic extraction, sarcasm identification, and confidence scoring
- **Simple, focused UX** that delivers insights in under 2 minutes from account connection

---

## 3. Target Users

> Detailed user personas are documented in [USER_PERSONAS.md](./USER_PERSONAS.md).

### Primary Segments

| Segment | Description | Size Estimate | Willingness to Pay |
|---|---|---|---|
| **Social Media Managers** | Professionals managing brand accounts (1-10 platforms). Need to report sentiment trends to stakeholders and detect issues early. | ~2M globally | $29-99/mo |
| **Digital Marketing Agencies** | Manage 10-50+ client accounts. Need white-label reports, multi-account dashboards, and team collaboration. | ~500K agencies globally | $99-299/mo |
| **Content Creators / Influencers** | Independent creators (10K-1M+ followers) who want to understand their audience and optimize content strategy. | ~50M creators globally (1M+ with >10K followers) | $0-29/mo |

### Key Characteristics

- **Tech-savvy but time-poor**: They understand analytics but need insights pre-digested
- **Platform-native**: They live inside YouTube Studio and Instagram Insights already
- **Metrics-driven**: They report on engagement, reach, and sentiment to clients or sponsors
- **Budget-conscious**: SMBs and creators cannot justify $200+/mo for social listening
- **Multilingual**: Many operate in Portuguese, Spanish, or mixed-language environments

---

## 4. Current Feature Set (MVP)

The following table documents the current state of all implemented features, verified against the production codebase as of February 2026.

### 4.1 Authentication & User Management

| Feature | Status | Details |
|---|---|---|
| Email + password registration | DONE | JWT-based auth with bcrypt hashing |
| Email + password login | DONE | Returns access + refresh tokens |
| Google OAuth login | DONE | One-click Google sign-in via ID token |
| Token refresh | DONE | Refresh token rotation |
| User profile (`/auth/me`) | DONE | Returns id, email, name, avatar, plan |
| User plan field | DONE | `plan` column on User model (default: "free") |
| Password reset | PLANNED | Not yet implemented |
| Email verification | PLANNED | Not yet implemented |

### 4.2 Platform Connections

| Feature | Status | Details |
|---|---|---|
| YouTube channel connection | DONE | Via `@handle` input, discovers channel via yt-dlp |
| Instagram public profile connection | DONE | Via `@username` input, public scraping (no OAuth required) |
| Instagram OAuth connection | DONE | Full Meta Graph API OAuth flow with encrypted token storage |
| Connection listing | DONE | All user connections with metadata |
| Connection deletion | DONE | Cascade deletes all posts, comments, analyses |
| Connection status tracking | DONE | `active` / `error` / `revoked` states |
| Twitter/X integration | PLANNED | UI placeholder exists ("Coming soon") |
| TikTok integration | PLANNED | Not started |

### 4.3 Data Ingestion Pipeline

| Feature | Status | Details |
|---|---|---|
| YouTube video scraping | DONE | yt-dlp extracts latest videos + comments |
| YouTube comment extraction | DONE | Full comment threads with metadata |
| Instagram post scraping | DONE | Via instaloader (public profiles) |
| Instagram comment scraping | DONE | Via Graph API or instaloader |
| Celery background processing | DONE | Full async pipeline with Redis broker |
| Pipeline run tracking | DONE | PipelineRun model with status, counts, costs |
| SSE real-time progress streaming | DONE | `/pipeline/runs/{id}/stream` endpoint with live updates |
| Duplicate detection | DONE | UNIQUE constraints on (connection_id, platform_post_id) and (post_id, platform_comment_id) |
| Incremental sync | PARTIAL | Re-runs full ingestion; deduplication prevents duplicates but does not skip already-fetched content efficiently |

### 4.4 AI Sentiment Analysis

| Feature | Status | Details |
|---|---|---|
| Sentiment scoring (0-10) | DONE | Per-comment score via Gemini 2.0 Flash |
| Polarity (-1 to +1) | DONE | Continuous polarity measure |
| Intensity (0-1) | DONE | Emotional intensity measure |
| Emotion detection | DONE | Multi-label: joy, anger, sadness, surprise, fear, disgust, etc. |
| Topic extraction | DONE | Key topics per comment |
| Sarcasm detection | DONE | Boolean sarcasm flag |
| Confidence scoring | DONE | Model confidence per analysis |
| Portuguese summary | DONE | `summary_pt` field with PT-BR summary per comment |
| Token/cost tracking | DONE | `tokens_in`, `tokens_out`, `cost_estimate_usd` per analysis |
| Post-level summary aggregation | DONE | `PostAnalysisSummary` with avg scores, emotion/topic distributions |
| Batch processing | DONE | Analyzes comments in batches of 30 |
| Model versioning | DONE | `model` + `prompt_version` tracked per analysis |

### 4.5 Dashboard & Visualization

| Feature | Status | Details |
|---|---|---|
| General dashboard (Level 1) | DONE | KPIs, sentiment donut, trend chart, connected platforms, recent posts |
| Connection dashboard (Level 2) | DONE | Per-connection KPIs, sentiment donut, trends, emotions, topics, engagement, posts list, comments table |
| KPI cards | DONE | Connections, posts, comments, avg score (Level 1); Score, weighted score, polarity, comments, views, likes (Level 2) |
| Sentiment donut chart | DONE | Positive/neutral/negative distribution with avg score center |
| Sentiment trend chart | DONE | Time-series stacked area chart with granularity selector |
| Emotion distribution chart | DONE | Bar chart of detected emotions |
| Topics frequency chart | DONE | Bar chart of extracted topics |
| Engagement chart | DONE | Likes/comments/views over time |
| Granularity selector | DONE | Day / Week / Month toggle |
| AI Health Reports | DONE | Gemini-generated markdown narrative per user |
| Comment explorer | DONE | Filterable, sortable, paginated comments with analysis data |
| Post detail page | DONE | Individual post with comment breakdown and analysis |
| Loading skeletons | DONE | Skeleton cards and charts during data fetch |
| Animations | DONE | FadeIn, StaggerList, PageTransition components |

### 4.6 Infrastructure

| Feature | Status | Details |
|---|---|---|
| Docker Compose (full stack) | DONE | PostgreSQL 16, Redis 7, API, Worker, Frontend |
| PostgreSQL database | DONE | Full schema with UUIDs, JSON fields, indexes |
| Redis (Celery broker) | DONE | Message queue for background tasks |
| Redis caching layer | DONE | Dashboard summary and trends cached for 5 minutes |
| Cache invalidation | DONE | Pattern-based invalidation after pipeline completion |
| Celery worker | DONE | Concurrency of 2, handles ingest + analysis tasks |
| API versioning | DONE | `/api/v1/` prefix |
| CORS configuration | PARTIAL | Configured for localhost; needs production domains |
| Rate limiting | PLANNED | Not yet implemented |
| Automated testing | PARTIAL | pytest with SQLite test DB; limited coverage |

### 4.7 UI/UX

| Feature | Status | Details |
|---|---|---|
| Landing page | DONE | Hero, features section, platform badges |
| Login/register page | DONE | Email + Google OAuth |
| Dark theme | DONE | Custom dark palette (bg=#0d1117, surface=#161b22, accent=#7c3aed) |
| Responsive layout | PARTIAL | Grid-based; mobile experience needs polish |
| Toast notifications | DONE | Toast component for success/error messages |
| Modal component | DONE | Reusable modal |
| Badge component | DONE | Status badges |
| Tooltip component | DONE | Info tooltips |
| Select component | DONE | Styled select dropdowns |
| Onboarding flow | PLANNED | No guided setup for new users |

---

## 5. Feature Requirements (Next Phase)

Features are prioritized using the **MoSCoW method** (Must/Should/Could/Won't) with priority labels (P0-P3).

### 5.1 Must Have (P0) -- Critical for Product-Market Fit

| # | Feature | Description | Effort | Dependencies |
|---|---|---|---|---|
| P0-1 | **Multi-language UI** | Support PT-BR, ES, EN in the frontend interface. Comments are already analyzed in any language by Gemini. | Medium | i18n framework (next-intl or similar) |
| P0-2 | **Email notifications for sentiment drops** | Alert users when average sentiment drops below a configurable threshold (e.g., >20% negative in 24h). | Medium | Email service (SendGrid/Resend), threshold config |
| P0-3 | **Data export (CSV, PDF)** | Export dashboard data, comment lists, and analysis results as CSV. Generate branded PDF reports. | Medium | CSV generation, PDF library (puppeteer or react-pdf) |
| P0-4 | **Mobile-responsive improvements** | Full mobile experience: responsive charts, touch-friendly filters, collapsible sidebar. | Medium | Responsive CSS, chart responsive configs |
| P0-5 | **Onboarding flow** | Guided 3-step setup for new users: connect first account, trigger first sync, view first insights. Progress tracking with completion indicators. | Small | Frontend wizard component |
| P0-6 | **Password reset flow** | "Forgot password" with email-based reset token. | Small | Email service, token generation |
| P0-7 | **Rate limiting & abuse prevention** | API rate limiting per user/IP. Protect against scraping abuse and LLM cost overruns. | Small | FastAPI middleware (slowapi) |

### 5.2 Should Have (P1) -- High Value, Next Iteration

| # | Feature | Description | Effort | Dependencies |
|---|---|---|---|---|
| P1-1 | **TikTok integration** | Connect TikTok accounts and analyze video comments. Requires TikTok API access or scraping approach. | Large | TikTok API research, new scraping service |
| P1-2 | **Competitive benchmarking** | Compare sentiment metrics across multiple connections (e.g., your brand vs. competitor). Side-by-side dashboard. | Medium | Multi-connection query logic, comparison UI |
| P1-3 | **Custom date ranges for all charts** | Date picker allowing custom start/end dates for all dashboard charts and trends. Replace fixed 7/30/90 day windows. | Small | Date picker component, API parameter extension |
| P1-4 | **Team/workspace support** | Multi-user workspaces: invite team members, role-based access (admin, analyst, viewer), shared connections. | Large | Workspace model, invitation flow, RBAC |
| P1-5 | **White-label reports** | Agency-branded PDF/HTML reports with custom logos, colors, and client branding. | Medium | P0-3 (export), template engine |
| P1-6 | **Scheduled syncs** | Automatic periodic sync (daily/weekly) instead of manual trigger only. | Small | Celery Beat scheduler |
| P1-7 | **Sentiment alerts dashboard** | Dedicated page showing triggered alerts with timeline, severity, and affected posts. | Medium | P0-2 (notifications), alert model |

### 5.3 Could Have (P2) -- Differentiation & Delight

| # | Feature | Description | Effort | Dependencies |
|---|---|---|---|---|
| P2-1 | **Twitter/X integration** | Connect Twitter accounts and analyze tweet replies/mentions. | Large | Twitter API v2 access ($100/mo minimum) |
| P2-2 | **AI Chat (ask questions about your data)** | Natural language interface: "What are people complaining about this week?" powered by Gemini with RAG over user data. | Large | RAG pipeline, chat UI, context management |
| P2-3 | **Predictive alerts (crisis detection)** | ML-based early warning system that detects unusual negative sentiment spikes before they trend. | Large | Anomaly detection model, historical baselines |
| P2-4 | **Auto-response suggestions** | AI-generated reply suggestions for negative comments, matched to brand voice. | Medium | Response generation prompt, integration with platform reply APIs |
| P2-5 | **Advanced topic clustering** | Group related topics into clusters using NLP. Visualize as topic map/network graph. | Medium | Clustering algorithm, network visualization library |
| P2-6 | **API for developers** | Public REST API with API keys, rate limits, and documentation for third-party integrations. | Medium | API key management, OpenAPI docs, usage tracking |
| P2-7 | **Webhook integrations** | Send real-time sentiment events to Slack, Discord, Zapier, or custom webhooks. | Small | Webhook delivery service, retry logic |

### 5.4 Won't Have (This Version)

| Feature | Reason |
|---|---|
| **LinkedIn integration** | LinkedIn API is extremely restrictive; comment access requires partner-level approval that is impractical for a startup. |
| **Video/image sentiment analysis** | Analyzing visual content requires specialized multimodal models and significantly increases LLM costs. Out of scope for text-focused MVP. |
| **Custom ML model training** | Users training their own sentiment models adds complexity without proportional value for the target market. |
| **White-label SaaS (for resellers)** | Multi-tenant white-label platform is an enterprise feature that requires substantial infrastructure investment. |
| **Real-time streaming ingestion** | Continuous real-time comment ingestion (vs. periodic sync) requires webhooks/streaming APIs that most platforms restrict. |

---

## 6. Technical Requirements

### 6.1 Performance

| Metric | Target | Current State |
|---|---|---|
| Dashboard page load (cached) | < 1.5 seconds | ~2-3s (needs optimization) |
| Dashboard page load (cold) | < 3 seconds | ~4-5s (large datasets) |
| Comment analysis throughput | 1,000 comments in < 5 minutes | ~500 comments / 5 min (Gemini rate limits) |
| API response time (95th percentile) | < 500ms | Not measured |
| SSE event latency | < 3 seconds | ~2s polling interval |

### 6.2 Scale

| Metric | Target |
|---|---|
| Concurrent users | 100 |
| Total comments in database | 1,000,000 |
| Connections per user | 20 (Agency plan) |
| Comments analyzed per month (platform) | 5,000,000 |
| Database size | 50 GB |

### 6.3 Security

| Requirement | Status | Details |
|---|---|---|
| JWT authentication | DONE | Access + refresh token rotation |
| Password hashing (bcrypt) | DONE | Via passlib |
| Instagram token encryption | DONE | Fernet (AES-256) encryption at rest |
| HTTPS enforcement | PLANNED | Required for production deployment |
| OWASP Top 10 compliance | PARTIAL | SQL injection protected (ORM); XSS, CSRF, rate limiting need work |
| API rate limiting | PLANNED | Per-user and per-IP limits |
| Input validation | DONE | Pydantic schemas on all endpoints |
| Data isolation | DONE | All queries filtered by `user_id` |
| Secrets management | PARTIAL | `.env` file; needs vault/secrets manager for production |
| Audit logging | PLANNED | User action logging for compliance |

### 6.4 Availability & Reliability

| Metric | Target |
|---|---|
| Uptime | 99.5% (excludes scheduled maintenance) |
| Recovery Time Objective (RTO) | 1 hour |
| Recovery Point Objective (RPO) | 15 minutes |
| Backup frequency | Daily automated PostgreSQL backups |
| Data retention | 12 months minimum |

### 6.5 Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Backend API | FastAPI | Latest |
| Frontend | Next.js | 14.x |
| Database | PostgreSQL | 16 |
| Cache/Queue | Redis | 7 |
| Task Queue | Celery | Latest |
| AI/LLM | Google Gemini 2.0 Flash | Latest |
| YouTube Scraping | yt-dlp | Latest |
| Instagram Scraping | instaloader | Latest |
| Charts | Recharts | Latest |
| Containerization | Docker Compose | Latest |
| Authentication | JWT (PyJWT) + Google OAuth | -- |

---

## 7. Success Metrics (KPIs)

### 7.1 Acquisition Metrics

| KPI | Definition | Target (6 months) |
|---|---|---|
| **Signups** | New account registrations per month | 500/mo |
| **Signup-to-activation rate** | % of users who connect first account within 24h | > 60% |
| **Time to first insight** | Median time from signup to viewing first dashboard with data | < 10 minutes |
| **Organic traffic** | Monthly unique visitors from search/social | 5,000/mo |

### 7.2 Engagement Metrics

| KPI | Definition | Target (6 months) |
|---|---|---|
| **Weekly Active Users (WAU)** | Users who log in and view dashboard at least once per week | > 40% of total users |
| **Comments analyzed per user per month** | Average number of comments processed | > 2,000 |
| **Dashboard views per session** | Average pages viewed per login | > 3 |
| **Sync frequency** | Average syncs triggered per user per week | > 2 |
| **Feature adoption rate** | % of users using AI Health Reports | > 50% |

### 7.3 Revenue Metrics

| KPI | Definition | Target (12 months) |
|---|---|---|
| **Monthly Recurring Revenue (MRR)** | Total recurring revenue | $10,000 |
| **Average Revenue Per User (ARPU)** | MRR / total paying users | $35 |
| **Free-to-paid conversion rate** | % of free users who upgrade | > 5% |
| **Net Revenue Retention (NRR)** | Revenue retained from existing customers (including expansion) | > 100% |

### 7.4 Satisfaction Metrics

| KPI | Definition | Target |
|---|---|---|
| **Net Promoter Score (NPS)** | Likelihood to recommend (survey) | > 40 |
| **Monthly churn rate** | % of paying users who cancel | < 5% |
| **Customer support tickets** | Tickets per 100 active users per month | < 10 |
| **App store / review rating** | Average rating on G2/Capterra | > 4.5/5 |

### 7.5 Operational Metrics

| KPI | Definition | Target |
|---|---|---|
| **LLM cost per 1K comments** | Gemini API cost per 1,000 comments analyzed | < $0.50 |
| **Pipeline success rate** | % of sync/analysis runs that complete without errors | > 95% |
| **API uptime** | Percentage of time API is available | > 99.5% |
| **P95 API latency** | 95th percentile response time | < 500ms |

---

## 8. Pricing Strategy

### 8.1 Competitive Landscape

| Tool | Starting Price | Target Market | Sentiment Analysis |
|---|---|---|---|
| Brandwatch | Custom (~$800+/mo) | Enterprise | Advanced, multi-platform |
| Sprout Social | $199/mo per user | Mid-market to Enterprise | DNN-based, aggregate |
| Hootsuite | $99/mo per user | SMB to Mid-market | Via Talkwalker (acquired) |
| Mention | $49/mo | SMB | Basic keyword-based |
| Brand24 | $79/mo | SMB | Keyword + basic sentiment |
| **SentimentIQ** | **$29/mo** | **SMB, Creators, Small Agencies** | **AI-powered, comment-level** |

*Sources: [Hootsuite vs Brandwatch](https://www.hootsuite.com/hootsuite-vs-brandwatch), [Sprout vs Hootsuite](https://youscan.io/blog/sprout-social-vs-hootsuite/), [Hootsuite Sentiment Tools](https://blog.hootsuite.com/social-media-sentiment-analysis-tools/), [Brandwatch Sentiment Tools](https://www.brandwatch.com/blog/sentiment-analysis-tools/)*

### 8.2 Proposed Pricing Tiers

| | Free | Pro | Agency | Enterprise |
|---|---|---|---|---|
| **Price** | $0/mo | $29/mo | $99/mo | Custom |
| **Connections** | 1 | 5 | 20 | Unlimited |
| **Comments/month** | 500 | 10,000 | 50,000 | Unlimited |
| **Platforms** | YouTube, Instagram | All available | All available | All + priority for new |
| **AI Health Reports** | 1/week | Unlimited | Unlimited | Unlimited |
| **Data export (CSV)** | -- | Yes | Yes | Yes |
| **PDF reports** | -- | Basic | White-label | White-label |
| **Team members** | 1 | 1 | 5 | Unlimited |
| **Email alerts** | -- | Yes | Yes | Yes + custom rules |
| **API access** | -- | -- | -- | Yes |
| **SSO** | -- | -- | -- | Yes |
| **Dedicated support** | Community | Email | Priority email | Dedicated CSM |
| **Data retention** | 3 months | 12 months | 24 months | Custom |

### 8.3 Revenue Model Assumptions

| Assumption | Value |
|---|---|
| Free tier users (12 months) | 2,000 |
| Free-to-Pro conversion | 5% (100 users) |
| Pro users (direct signups) | 150 |
| Agency users | 30 |
| Enterprise users | 5 |
| **Projected MRR (12 months)** | **$250 x 5 + $99 x 30 + $29 x 250 = $11,470** |

### 8.4 LLM Cost Analysis

| Metric | Value |
|---|---|
| Gemini 2.0 Flash input cost | $0.10 / 1M tokens |
| Gemini 2.0 Flash output cost | $0.40 / 1M tokens |
| Average tokens per comment analysis | ~300 in + ~200 out |
| **Cost per comment** | **~$0.00011** |
| Cost per 10K comments (Pro tier) | ~$1.10 |
| Cost per 50K comments (Agency tier) | ~$5.50 |
| **Gross margin at Pro ($29/mo)** | **~96%** |

---

## 9. Risks and Mitigations

### 9.1 Platform Risk

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **YouTube blocks yt-dlp scraping** | HIGH | Medium | Monitor yt-dlp updates; evaluate YouTube Data API v3 as fallback (quota limits apply); implement graceful degradation |
| **Instagram blocks instaloader** | HIGH | High | Primary path already uses Graph API OAuth; instaloader is supplementary for public profiles; maintain both paths |
| **Instagram Graph API changes** | MEDIUM | Medium | Pin API version; monitor Meta developer changelog; maintain token refresh flow |
| **Platform TOS violations** | HIGH | Low | Review TOS regularly; prioritize official APIs over scraping; legal review of data usage |

### 9.2 Technical Risk

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **Gemini API rate limits at scale** | MEDIUM | Medium | Implement exponential backoff; batch optimization; evaluate fallback LLMs (Claude, GPT-4o-mini); cache analysis results |
| **LLM costs exceed projections** | MEDIUM | Low | Cost tracking per analysis (already implemented); per-user quotas; prompt optimization to reduce token usage |
| **Database performance at 1M+ comments** | MEDIUM | Medium | Add database indexes (partially done); implement pagination everywhere; consider read replicas; archive old data |
| **Celery worker reliability** | MEDIUM | Medium | Implement task retries with exponential backoff; dead letter queue; health monitoring; worker auto-restart |

### 9.3 Business Risk

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **Low free-to-paid conversion** | HIGH | Medium | Optimize onboarding; demonstrate clear value in free tier; implement upgrade prompts at natural friction points |
| **High churn rate** | HIGH | Medium | Regular engagement emails; new feature announcements; customer success outreach; exit surveys |
| **Competitor price war** | MEDIUM | Low | Differentiate on depth of analysis (comment-level) and language support rather than price alone |
| **Slow market adoption** | MEDIUM | Medium | Content marketing (blog, YouTube tutorials); community building; partnership with marketing agencies |

### 9.4 Compliance & Legal Risk

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **GDPR compliance** | HIGH | High (for EU users) | Implement data deletion endpoints; privacy policy; cookie consent; data processing agreements |
| **LGPD compliance (Brazil)** | HIGH | High (primary market) | Similar to GDPR; appoint DPO; implement consent management; data residency considerations |
| **User data breach** | CRITICAL | Low | Encrypt sensitive data at rest (tokens already encrypted); HTTPS; security audits; breach notification plan |
| **Comment data ownership** | MEDIUM | Medium | Clear terms of service regarding data processing; users own their data; right to deletion |

---

## Appendix A: Data Model Summary

The current data model consists of 6 core entities:

```
User (1) ----< SocialConnection (1) ----< Post (1) ----< Comment (1) ----< CommentAnalysis
  |                    |                        |
  |                    |                        +----< PostAnalysisSummary (1:1)
  |                    |
  +----< PipelineRun >----+
```

| Entity | Key Fields |
|---|---|
| **User** | id (UUID), email, password_hash, name, avatar_url, plan, google_id |
| **SocialConnection** | id, user_id, platform, username, display_name, profile_url, followers_count, access_token_enc, status |
| **Post** | id, connection_id, platform, platform_post_id, content_text, like/comment/share/view counts, published_at |
| **Comment** | id, post_id, connection_id, platform_comment_id, author_name, text_original, text_clean, like_count, status |
| **CommentAnalysis** | id, comment_id, model, prompt_version, score_0_10, polarity, intensity, emotions, topics, sarcasm, summary_pt, confidence |
| **PostAnalysisSummary** | id, post_id, total_comments, avg_score, avg_polarity, emotions_distribution, topics_frequency, sentiment_distribution |
| **PipelineRun** | id, user_id, connection_id, run_type, status, posts/comments fetched/analyzed, llm_calls, errors, cost |

## Appendix B: API Surface

| Module | Endpoint | Method | Description |
|---|---|---|---|
| Auth | `/auth/register` | POST | Create account |
| Auth | `/auth/login` | POST | Email login |
| Auth | `/auth/google` | POST | Google OAuth login |
| Auth | `/auth/refresh` | POST | Refresh access token |
| Auth | `/auth/me` | GET | Current user profile |
| Connections | `/connections` | GET | List user connections |
| Connections | `/connections/{id}` | GET | Get connection detail |
| Connections | `/connections/{id}` | DELETE | Remove connection |
| Connections | `/connections/youtube` | POST | Connect YouTube channel |
| Connections | `/connections/instagram` | POST | Connect Instagram (public) |
| Connections | `/connections/instagram/auth-url` | GET | Get Instagram OAuth URL |
| Connections | `/connections/instagram/callback` | GET | Instagram OAuth callback |
| Connections | `/connections/{id}/sync` | POST | Trigger sync pipeline |
| Posts | `/posts` | GET | List posts (paginated, filterable) |
| Posts | `/posts/{id}` | GET | Post detail with comments + analysis |
| Dashboard | `/dashboard/summary` | GET | General dashboard data |
| Dashboard | `/dashboard/connection/{id}` | GET | Connection-specific dashboard |
| Dashboard | `/dashboard/trends` | GET | Sentiment trends (day/week/month) |
| Dashboard | `/dashboard/health-report` | GET | AI-generated health report |
| Pipeline | `/pipeline/runs` | GET | List pipeline runs |
| Pipeline | `/pipeline/runs/{id}` | GET | Pipeline run detail |
| Pipeline | `/pipeline/runs/{id}/status` | GET | Pipeline run status |
| Pipeline | `/pipeline/runs/{id}/stream` | GET | SSE progress stream |
| Comments | `/comments` | GET | List comments (filtered, paginated, with analysis) |

---

*This document is a living artifact and will be updated as the product evolves. All stakeholders are encouraged to provide feedback via the product backlog.*
