# Innovative Product Experiences Research

> Last updated: February 2026 | SentimentIQ R&D

---

## Table of Contents

1. [Gamification](#1-gamification)
2. [Proactive Alerts](#2-proactive-alerts)
3. [Competitive Benchmarking](#3-competitive-benchmarking)
4. [Predictive Analytics](#4-predictive-analytics)
5. [AI Copilot](#5-ai-copilot)
6. [Report Generation](#6-report-generation)

---

## 1. Gamification

### Overview

Gamification applies game mechanics (points, badges, streaks, leaderboards) to non-game contexts to increase user engagement and retention. In B2B SaaS, well-designed gamification can increase engagement rates by up to 40%.

### Examples from Analytics Tools

| Tool | Gamification Elements | Context |
|------|----------------------|---------|
| **HubSpot Academy** | Certifications, badges, shareable credentials | Training completion |
| **Salesforce Trailhead** | Badges, points, ranks (Ranger, Mountaineer) | Learning paths |
| **Plecto** | Contests, virtual coins, Reward Store | Sales performance |
| **Autodesk** | Gamified trial experience | Product onboarding (+40% engagement, +15% conversion) |
| **Duolingo** | Streaks, XP, leagues, hearts | Daily usage retention |

### Gamification Ideas for SentimentIQ

| Feature | Description | Appropriateness | Effort |
|---------|-------------|----------------|--------|
| **Sentiment Streaks** | "Your sentiment has been positive for 7 consecutive days!" | Medium -- motivates engagement monitoring | Low |
| **Analysis Milestones** | "You've analyzed 10,000 comments!" badge | High -- celebrates platform usage | Low |
| **Response Rate Badge** | "Quick Responder: replied to 90% of negative comments within 1 hour" | High -- drives actionable behavior | Medium |
| **Health Score Leaderboard** | Compare sentiment health across your connections/channels | Medium -- internal benchmarking | Medium |
| **Weekly Challenge** | "Improve your average sentiment by 5% this week" | Low -- sentiment isn't always controllable | Low |
| **Onboarding Checklist** | Progress bar for: connect account, first sync, first analysis, view dashboard | Very High -- proven onboarding tactic | Low |

### Is Gamification Appropriate for B2B?

**Yes, but with restraint.** B2B gamification works best when it:
- Encourages platform adoption (onboarding checklists, feature discovery)
- Celebrates achievements that matter to the business (milestones, streaks)
- Provides useful competitive context (benchmarks, not trivial badges)

**Avoid:** Childish badges, unnecessary point systems, or gamification that trivializes serious sentiment data. A PR crisis is not a "game."

### Recommendation

**Implement onboarding checklist first (P1).** This is the most universally effective gamification pattern in SaaS. Track completion of: connect first account, run first sync, view dashboard, set up alerts, analyze first post. Display as a progress bar in the dashboard.

**Later, add sentiment streaks and milestones (P3).** These provide retention nudges without being inappropriate for a B2B context.

---

## 2. Proactive Alerts

### Overview

Proactive alerting transforms SentimentIQ from a retrospective dashboard into a real-time monitoring system. Rather than users logging in to discover problems, the system notifies them immediately when something requires attention.

### Alert Types

| Alert Type | Trigger | Urgency | Channel |
|-----------|---------|---------|---------|
| **Sentiment Drop** | Score drops >15% from 7-day average | Warning | In-app + Email |
| **Sentiment Crisis** | Score drops >40% or negative volume 3x spike | Critical | In-app + Email + Push |
| **Positive Spike** | Score rises >20% from 7-day average | Informational | In-app |
| **Viral Content** | Comment volume 5x above normal | Informational | In-app + Email |
| **Bot Attack** | Bot probability spike >30% of comments | Warning | In-app + Email |
| **Topic Emergence** | New topic appears in >20% of comments | Informational | In-app |
| **Sync Failure** | Pipeline fails or connection expires | System | In-app + Email |
| **Scheduled Report** | Weekly/monthly summary ready | Informational | Email |

### Anomaly Detection Approaches

#### Approach 1: Statistical Thresholds (Quick Win)

```python
def check_sentiment_anomaly(connection_id):
    # Get recent data
    recent_avg = get_avg_sentiment(connection_id, days=1)
    baseline_avg = get_avg_sentiment(connection_id, days=7)
    baseline_std = get_std_sentiment(connection_id, days=7)

    # Z-score based detection
    if baseline_std > 0:
        z_score = (recent_avg - baseline_avg) / baseline_std

        if z_score < -2.0:  # 2 standard deviations below
            create_alert(
                connection_id=connection_id,
                type="SENTIMENT_DROP",
                severity="warning",
                message=f"Sentiment dropped to {recent_avg:.1f} "
                        f"(baseline: {baseline_avg:.1f})",
                z_score=z_score
            )
        if z_score < -3.0:  # 3 standard deviations below
            upgrade_alert_severity("critical")
```

#### Approach 2: Prophet-Based Forecasting

Use Prophet (see Advanced Analysis doc) to predict expected sentiment range. Alert when actual values fall outside the prediction interval.

```python
def prophet_anomaly_check(connection_id):
    forecast = get_prophet_forecast(connection_id)
    actual = get_latest_sentiment(connection_id)

    if actual < forecast['yhat_lower']:
        create_alert(
            type="SENTIMENT_ANOMALY",
            severity="warning",
            message=f"Sentiment ({actual:.1f}) below expected range "
                    f"({forecast['yhat_lower']:.1f} - {forecast['yhat_upper']:.1f})"
        )
```

#### Approach 3: LLM-Powered Insights

When an anomaly is detected, use LLM to explain why:

```python
def explain_anomaly(connection_id, alert):
    recent_comments = get_recent_negative_comments(connection_id, limit=20)
    topics = get_recent_topics(connection_id)

    explanation = llm.generate(f"""
    Sentiment for this channel dropped significantly.
    Recent negative comments: {recent_comments}
    Trending topics: {topics}

    Explain in 2-3 sentences what likely caused this sentiment drop
    and suggest 1-2 actions the channel owner could take.
    """)

    alert.explanation = explanation
    alert.save()
```

### Notification Infrastructure

| Channel | Implementation | Cost | User Preference |
|---------|---------------|------|-----------------|
| **In-app notifications** | WebSocket or polling + notification bell UI | Free | Always on |
| **Email** | SendGrid / Resend / AWS SES | $0-20/month | Configurable |
| **Push notifications** | Web Push API (browser) | Free | Opt-in |
| **Slack webhook** | Simple HTTP POST | Free | Enterprise users |
| **SMS** | Twilio ($0.0075/msg) | Pay per message | Critical only |

### Alert Management UI

```
┌─────────────────────────────────────────────────┐
│ Alerts                                    [Settings]
├─────────────────────────────────────────────────┤
│ 🔴 CRITICAL  2h ago                              │
│ Sentiment crisis on @BrandYouTube                │
│ Score dropped from 7.2 to 3.1 (-57%)            │
│ "Audio quality issues after latest upload"        │
│ [View Details] [Dismiss] [Mute 24h]              │
├─────────────────────────────────────────────────┤
│ 🟡 WARNING   6h ago                              │
│ Unusual bot activity on @BrandInstagram          │
│ 35% of new comments flagged as potential bots    │
│ [View Details] [Dismiss]                          │
├─────────────────────────────────────────────────┤
│ 🟢 INFO      1d ago                              │
│ New topic trending: "shipping delays"            │
│ Appeared in 23% of comments this week            │
│ [View Details] [Dismiss]                          │
└─────────────────────────────────────────────────┘
```

### Implementation via Celery Beat

```python
# tasks/alert_tasks.py
from celery import shared_task
from celery.schedules import crontab

@shared_task
def check_all_connections_for_anomalies():
    connections = SocialConnection.query.filter_by(active=True).all()
    for conn in connections:
        check_sentiment_anomaly(conn.id)
        check_volume_anomaly(conn.id)
        check_bot_activity(conn.id)

# Schedule: run every hour
celery_app.conf.beat_schedule = {
    'check-anomalies-hourly': {
        'task': 'tasks.alert_tasks.check_all_connections_for_anomalies',
        'schedule': crontab(minute=0),  # Every hour
    },
}
```

### Database Schema

```sql
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    connection_id INTEGER REFERENCES social_connections(id),
    type VARCHAR(50) NOT NULL,          -- SENTIMENT_DROP, SENTIMENT_CRISIS, etc.
    severity VARCHAR(20) NOT NULL,       -- info, warning, critical
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    explanation TEXT,                     -- LLM-generated explanation
    metadata JSONB,                      -- z_score, threshold, etc.
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    read_at TIMESTAMP,
    dismissed_at TIMESTAMP
);

CREATE TABLE alert_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT FALSE,
    slack_webhook_url VARCHAR(500),
    min_severity VARCHAR(20) DEFAULT 'warning',  -- minimum severity for notifications
    quiet_hours_start TIME,
    quiet_hours_end TIME
);
```

### Recommendation

**High priority (P1).** Proactive alerts are perhaps the most impactful feature for user retention. A user who gets an email alert "Your sentiment dropped 30% -- here's why" is far more likely to engage with the platform than one who has to remember to check a dashboard.

**Phase 1 (1-2 weeks):** Statistical threshold alerts + in-app notification UI + email via SendGrid
**Phase 2 (2-4 weeks):** Prophet-based anomaly detection + LLM explanations
**Phase 3 (1 month):** Slack integration + custom alert rules + alert digest emails

---

## 3. Competitive Benchmarking

### Overview

Allow users to compare their sentiment performance against industry benchmarks and (optionally) competitors. This is one of the most requested features in social media analytics.

### Implementation Approaches

#### Approach 1: Industry Benchmarks (No Competitor Data Needed)

Aggregate anonymized sentiment data from all SentimentIQ users to create industry benchmarks:

```
Your Brand (YouTube): 7.2 average sentiment
Industry Average (Tech YouTube): 6.8
Industry Top 10%: 8.1+
Industry Bottom 10%: <4.5

Your Performance: Above Average (Top 30%)
```

**How to Build:**
1. Categorize connections by industry during onboarding
2. Aggregate anonymized sentiment scores across all users in same industry
3. Display percentile ranking

**Privacy:** Only aggregated, anonymized data is used. No individual brand data is exposed.

#### Approach 2: Public Data Benchmarking

Analyze publicly available benchmark reports:

| Source | Data Available | Update Frequency |
|--------|---------------|-----------------|
| **Sprout Social Benchmarks** | Engagement rates by industry/platform | Annual |
| **Rival IQ Benchmark Report** | Engagement + posting frequency by industry | Annual |
| **Emplifi Benchmarks** | Response rates, sentiment indicators | Quarterly |
| **Dash Social Benchmarks** | Platform-specific performance metrics | Annual |

Incorporate published benchmark data into our platform to provide context without analyzing competitor data directly.

#### Approach 3: Opt-In Competitor Tracking (Premium)

Allow users to add public competitor channels for monitoring:

```
┌─────────────────────────────────────────────────────┐
│ Competitive Overview                                  │
├──────────────┬──────────┬──────────┬────────────────┤
│ Brand        │ Sentiment│ Volume   │ Top Emotion    │
├──────────────┼──────────┼──────────┼────────────────┤
│ Your Brand   │ 7.2 ★    │ 2,340    │ Joy (45%)      │
│ Competitor A │ 6.1      │ 1,890    │ Anger (30%)    │
│ Competitor B │ 8.0      │ 4,120    │ Trust (50%)    │
│ Industry Avg │ 6.8      │ 2,100    │ Joy (35%)      │
└──────────────┴──────────┴──────────┴────────────────┘
```

**Legal consideration:** Analyzing publicly available comments on public profiles is generally permissible, but framing it carefully ("public sentiment monitoring") rather than "competitor spying" is important.

### Key Competitive Metrics

| Metric | Description | How to Calculate |
|--------|-------------|-----------------|
| **Sentiment Score** | Average sentiment (1-10) | Direct from analysis |
| **Sentiment Velocity** | Rate of sentiment change | Derivative of sentiment over time |
| **Positive/Negative Ratio** | Ratio of positive to negative comments | Simple count ratio |
| **Engagement Quality** | Sentiment-weighted engagement | engagement * sentiment_score |
| **Share of Voice** | % of industry conversation volume | user_volume / industry_volume |
| **Crisis Recovery Time** | Days to return to baseline after drop | Time from trough to recovery |

### Recommendation

**Medium priority -- implement incrementally.**

1. **Phase 1 (Quick Win):** Add industry selection to onboarding. Display user's sentiment against hardcoded industry averages from published benchmark reports.

2. **Phase 2 (1-2 months):** Build internal anonymous benchmarking once we have 50+ active users. Display percentile rankings.

3. **Phase 3 (Premium):** Allow adding public competitor channels for monitoring. This requires the same analysis pipeline but applied to competitor content.

---

## 4. Predictive Analytics

### Overview

Use historical data and AI to predict future outcomes -- which posts will perform well, how audience sentiment will evolve, and what content strategies are most effective.

### Virality Prediction

**Current State:** AI-based virality prediction achieves ~82% accuracy in sentiment prediction and ~90% in network propagation prediction. However, predicting exact virality is inherently unreliable -- content virality has a large random component.

**What We Can Predict:**
| Prediction | Accuracy | Method | Value |
|-----------|----------|--------|-------|
| Engagement range (high/medium/low) | ~75% | Historical pattern matching | High |
| Sentiment trajectory (improving/declining) | ~82% | Time series + LLM | High |
| Crisis probability (next 7 days) | ~70% | Anomaly detection + trends | Very High |
| Best posting time | ~85% | Historical engagement analysis | Medium |
| Content type performance | ~80% | Category + historical data | Medium |

**Practical Approach for SentimentIQ:**

Rather than predicting exact virality (unreliable), provide actionable predictions:

```python
def generate_predictions(connection_id):
    history = get_sentiment_history(connection_id, days=90)
    recent_topics = get_recent_topics(connection_id)
    posting_patterns = get_posting_patterns(connection_id)

    prediction = llm.generate(f"""
    Based on this channel's 90-day sentiment history, recent topics,
    and posting patterns, provide:

    1. Sentiment forecast: Will sentiment likely improve, stay stable,
       or decline in the next 7 days? Why?
    2. Risk assessment: Probability of a sentiment crisis (0-100%)
    3. Content recommendation: What topics/formats historically
       perform best for this channel?
    4. Timing recommendation: Best days/times to post based on
       engagement patterns

    History: {history}
    Topics: {recent_topics}
    Patterns: {posting_patterns}
    """)

    return prediction
```

### Audience Growth Prediction

Correlate sentiment trends with follower growth:

```
If sentiment increases by 1 point → Expected follower growth: +2.3%
If sentiment decreases by 1 point → Expected follower loss: -1.5%
If comment volume doubles → Expected follower growth: +5.1%
```

These correlations can be computed from historical data once we have sufficient time series for each connection.

### Content Strategy Recommendations

```
┌─────────────────────────────────────────────────────┐
│ AI Content Strategy Recommendations                   │
├─────────────────────────────────────────────────────┤
│ Based on your last 90 days of data:                  │
│                                                       │
│ 1. Your tutorial-style posts receive 35% higher      │
│    sentiment than product showcase posts              │
│                                                       │
│ 2. Posts published on Tuesday/Wednesday between       │
│    2-4 PM get 40% more positive engagement           │
│                                                       │
│ 3. Topics about "sustainability" are trending         │
│    positively in your audience (+0.8 sentiment/week)  │
│                                                       │
│ 4. Warning: "customer service" topic sentiment is     │
│    declining. Consider addressing publicly.           │
└─────────────────────────────────────────────────────┘
```

### Recommendation

**Medium-term (2-3 months).** Predictive analytics requires sufficient historical data (minimum 60-90 days per connection). Start building the data foundation now; implement predictions once data volume justifies it.

**Phase 1:** Collect and store enriched historical data (sentiment time series, topics, engagement)
**Phase 2:** Build correlation analysis (sentiment vs. engagement, topics vs. sentiment)
**Phase 3:** Add LLM-generated predictions and content strategy recommendations

---

## 5. AI Copilot

### Overview

An AI-powered conversational interface that lets users ask natural language questions about their sentiment data. This is the highest-impact premium feature for differentiation.

### Example Interactions

```
User: "Why did my sentiment drop last week?"

AI: "Your average sentiment dropped from 7.3 to 5.1 between Jan 15-22.
The primary cause was your video 'Product Update v2.0' posted Jan 16,
which received 312 negative comments (vs. your average of 45). The main
complaints were about the new pricing model (mentioned in 67% of negative
comments) and removed features (28%). Your other posts maintained normal
sentiment levels."

User: "What should I respond to the pricing complaints?"

AI: "Based on the 208 pricing-related complaints, the main concerns are:
1. Price increase without new features (45% of complaints)
2. No grandfathering for existing users (32%)
3. Competitors offering similar features cheaper (23%)

Suggested response template:
'Thank you for your feedback on our pricing. We hear your concerns about
[specific concern]. We're committed to [action]. For existing users,
we're exploring [grandfathering option]...'

Would you like me to draft personalized responses for the top 10 most-
liked negative comments?"
```

### Implementation Architecture

```
┌─────────────────┐     ┌──────────────────────────────┐
│ Chat UI (React)  │────>│ /api/copilot/chat             │
│                  │     │                                │
│ Message history  │     │ 1. Parse user query            │
│ Streaming resp.  │     │ 2. Determine intent            │
│ Suggested Qs     │     │ 3. Generate SQL/filter         │
└─────────────────┘     │ 4. Execute data retrieval      │
                        │ 5. Augment prompt with data    │
                        │ 6. Stream LLM response         │
                        └──────────────────────────────┘
                                      │
                        ┌─────────────┴────────────────┐
                        │        Data Sources           │
                        │                               │
                        │  PostgreSQL (comments, posts, │
                        │  analyses, connections)       │
                        │                               │
                        │  pgvector (similar comments,  │
                        │  semantic search)             │
                        │                               │
                        │  Aggregated metrics (cached)  │
                        └──────────────────────────────┘
```

### Technical Approach: Text-to-SQL + RAG

**Text-to-SQL** converts natural language questions into database queries. Combined with RAG for context retrieval, this enables the copilot to:

1. **Understand the question** (intent classification)
2. **Generate SQL** to retrieve relevant data
3. **Retrieve context** (brand info, historical patterns) via RAG
4. **Generate insight** using LLM with data + context

**Implementation:**
```python
# Backend: /routers/copilot.py

@router.post("/chat")
async def copilot_chat(request: CopilotRequest, user: User = Depends(get_current_user)):
    # 1. Build context
    schema_context = get_user_schema_context(user.id)  # Tables, columns available
    data_context = get_recent_data_summary(user.id)     # Latest metrics

    # 2. Generate SQL from natural language
    sql_response = await llm.generate(f"""
    Given this database schema: {schema_context}
    And this user's data summary: {data_context}

    Convert this question to a SQL query:
    "{request.message}"

    Return ONLY safe SELECT queries. Never modify data.
    """)

    # 3. Execute query safely
    results = execute_readonly_query(sql_response.sql)

    # 4. Generate insight
    insight = await llm.generate_stream(f"""
    The user asked: "{request.message}"
    Query results: {results}
    Historical context: {data_context}

    Provide a clear, actionable answer with specific numbers and dates.
    If relevant, suggest next steps or follow-up actions.
    """)

    return StreamingResponse(insight)
```

**Key Tools:**
- **Vanna 2.0**: Open-source text-to-SQL framework, production-ready since late 2025
- **LangChain SQL Agent**: Alternative approach using LangChain's SQL toolkit
- **Custom implementation**: For full control over security and query generation

### Security Considerations

- **Read-only database connection** for copilot queries
- **Query validation**: Only allow SELECT statements; no JOINs to other users' data
- **Row-level security**: Ensure queries are scoped to current user's data
- **Token limits**: Cap response length and query complexity
- **Rate limiting**: Prevent abuse of expensive LLM calls

### Recommended LLM for Copilot

**Claude Sonnet 4.5** is the recommended model for the copilot feature:
- Excellent at structured reasoning and data analysis
- Strong SQL generation capabilities
- Natural conversational ability
- Extended thinking for complex multi-step analysis
- $3/$15 per million tokens (reasonable for chat interaction volume)

### Suggested Questions Feature

Pre-populate with contextually relevant questions:

```python
def generate_suggested_questions(connection_id):
    return [
        "Why did sentiment change this week?",
        "What are the most common complaints?",
        "When is the best time to post?",
        "Which topics get the most positive responses?",
        "Show me the most influential commenters",
        f"Compare this month to last month",
    ]
```

### Recommendation

**Long-term, high-impact feature (3-6 months).** The AI Copilot is the ultimate premium differentiator -- it transforms raw data into conversational insights. However, it requires:
- Mature data pipeline (sufficient historical data)
- RAG infrastructure (pgvector + embeddings)
- Careful security implementation
- Higher LLM costs (conversational queries are token-heavy)

**Implement after:** Proactive alerts, ABSA, topic clustering, and trend forecasting are in place. These features generate the data that makes the copilot valuable.

---

## 6. Report Generation

### Overview

Automated, branded PDF reports that users can share with clients, stakeholders, or team members. This is essential for agency use cases and a strong revenue driver for premium tiers.

### Report Types

| Report Type | Audience | Frequency | Content |
|------------|----------|-----------|---------|
| **Weekly Summary** | Brand managers | Weekly | Key metrics, top/bottom posts, trends |
| **Monthly Analysis** | Executives | Monthly | Deep analysis, comparisons, recommendations |
| **Crisis Report** | Crisis team | On-demand | Incident timeline, impact assessment, recovery plan |
| **Client Report** | Agency clients | Weekly/Monthly | White-label branded summary |
| **Campaign Report** | Marketing team | Post-campaign | Sentiment during campaign period |

### White-Label Features for Agencies

```
┌───────────────────────────────────────────┐
│  [Agency Logo]                              │
│                                             │
│  Monthly Sentiment Report                   │
│  Client: Brand X                            │
│  Period: January 2026                       │
│                                             │
│  Prepared by: [Agency Name]                 │
│  Powered by SentimentIQ                     │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Executive Summary                    │   │
│  │ AI-generated overview of key findings│   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ [Sentiment Trend Chart]              │   │
│  │ [Emotion Distribution]               │   │
│  │ [Topic Breakdown]                    │   │
│  │ [Top Posts by Engagement]            │   │
│  │ [Recommendations]                    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Footer with Agency Branding]              │
└───────────────────────────────────────────┘
```

### Technical Implementation

#### PDF Generation Options

| Library | Language | Quality | Ease | Notes |
|---------|----------|---------|------|-------|
| **WeasyPrint** | Python | High | Medium | HTML/CSS to PDF; great for styled reports |
| **ReportLab** | Python | High | Low | Low-level PDF generation; full control |
| **Puppeteer/Playwright** | Node.js | Excellent | Medium | Headless browser rendering; best visual fidelity |
| **react-pdf** | React | Good | Easy | React components to PDF; matches frontend style |
| **wkhtmltopdf** | CLI | Medium | Easy | HTML to PDF converter |

**Recommended: WeasyPrint** for backend-generated reports (matches our Python stack) or **Playwright** for pixel-perfect rendering of our Next.js dashboard components.

#### Implementation Flow

```python
# Backend: /routers/reports.py

@router.post("/reports/generate")
async def generate_report(
    request: ReportRequest,
    user: User = Depends(get_current_user)
):
    # 1. Gather data
    summary = await dashboardApi.get_summary(request.connection_id, request.period)
    trends = await dashboardApi.get_trends(request.connection_id, request.period)
    top_posts = await postsApi.get_top_posts(request.connection_id, request.period)

    # 2. Generate AI summary
    ai_summary = await llm.generate(f"""
    Write a professional executive summary for this sentiment report.
    Period: {request.period}
    Key metrics: {summary}
    Trends: {trends}
    Include 3-5 key findings and 2-3 recommendations.
    """)

    # 3. Render HTML template
    html = render_template("report_template.html", {
        "brand": request.brand_name,
        "period": request.period,
        "summary": summary,
        "ai_summary": ai_summary,
        "trends": trends,
        "top_posts": top_posts,
        "branding": get_user_branding(user.id)  # White-label settings
    })

    # 4. Convert to PDF
    pdf = weasyprint.HTML(string=html).write_pdf()

    # 5. Store and return
    report_url = upload_to_storage(pdf, f"report_{request.period}.pdf")
    return {"url": report_url}
```

#### Scheduling

```python
# Celery Beat schedule for automated reports
celery_app.conf.beat_schedule = {
    'weekly-reports': {
        'task': 'tasks.report_tasks.generate_weekly_reports',
        'schedule': crontab(day_of_week=1, hour=8, minute=0),  # Monday 8 AM
    },
    'monthly-reports': {
        'task': 'tasks.report_tasks.generate_monthly_reports',
        'schedule': crontab(day_of_month=1, hour=8, minute=0),  # 1st of month
    },
}
```

### Email Delivery

```python
# Using SendGrid for report delivery
async def send_report_email(user, report_url, period):
    await sendgrid.send(
        to=user.email,
        template_id="report_template",
        dynamic_data={
            "user_name": user.name,
            "period": period,
            "report_url": report_url,
            "key_metric": f"Average sentiment: {avg_score:.1f}",
        }
    )
```

### Pricing Model for Reports

| Tier | Reports | White-Label | Scheduling | Cost |
|------|---------|-------------|------------|------|
| **Free** | 1/month, basic | No | No | $0 |
| **Pro** | Unlimited, full | No | Weekly + Monthly | $29/mo |
| **Agency** | Unlimited, full | Yes (logo, colors, footer) | Custom | $79/mo |

### Recommendation

**Medium priority (1-2 months).** Report generation is straightforward to implement and has clear monetization potential, especially for the agency use case. The LLM-generated executive summary adds significant value over pure data exports.

**Phase 1 (2 weeks):** Basic PDF report with WeasyPrint, manual generation, email delivery
**Phase 2 (2 weeks):** Scheduling via Celery Beat, report history
**Phase 3 (2 weeks):** White-label branding, template customization

---

## Summary of Recommendations

| Feature | Priority | Effort | Impact | Revenue Potential |
|---------|----------|--------|--------|-------------------|
| **Proactive Alerts** | P0 | 2-4 weeks | Very High | Core feature (retention) |
| **Onboarding Gamification** | P1 | 1 week | High | Indirect (activation) |
| **Report Generation** | P2 | 4-6 weeks | High | Direct (agency tier) |
| **Competitive Benchmarking** | P3 | 2-4 weeks | Medium-High | Premium feature |
| **Predictive Analytics** | P4 | 2-3 months | High | Premium feature |
| **AI Copilot** | P5 | 3-6 months | Very High | Premium feature (major differentiator) |
| **Advanced Gamification** | P6 | 2 weeks | Low-Medium | Indirect (retention) |

### Feature Dependencies

```
Foundation Layer (build first):
├── Proactive Alerts (uses Celery Beat + email infrastructure)
├── ABSA + Topics + Emotions (enriched data for all features above)
└── Embedding Pipeline (pgvector, enables RAG + similarity + copilot)

Middle Layer:
├── Report Generation (uses enriched data + LLM summaries)
├── Trend Forecasting (uses time series data + Prophet)
└── Competitive Benchmarking (uses aggregated anonymous data)

Premium Layer:
├── Predictive Analytics (uses all historical data)
└── AI Copilot (uses RAG + text-to-SQL + full data access)
```
