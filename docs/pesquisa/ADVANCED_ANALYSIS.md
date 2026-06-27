# Advanced Analysis Techniques Research

> Last updated: February 2026 | SentimentIQ R&D

---

## Table of Contents

1. [Emotion Detection](#1-emotion-detection)
2. [Network Analysis](#2-network-analysis)
3. [Bot Detection](#3-bot-detection)
4. [Trend Forecasting](#4-trend-forecasting)
5. [Topic Clustering](#5-topic-clustering)
6. [Aspect-Based Sentiment Analysis (ABSA)](#6-aspect-based-sentiment-analysis-absa)

---

## 1. Emotion Detection

### Beyond Positive/Neutral/Negative

Our current system classifies comments into positive, neutral, and negative with a 1-10 score. Fine-grained emotion detection goes much further, identifying specific emotions that provide actionable insights.

### Plutchik's Wheel of Emotions

Plutchik's model defines 8 basic emotions, each with 3 intensity levels:

| Basic Emotion | Low Intensity | Mid Intensity | High Intensity |
|--------------|---------------|---------------|----------------|
| **Joy** | Serenity | Joy | Ecstasy |
| **Trust** | Acceptance | Trust | Admiration |
| **Fear** | Apprehension | Fear | Terror |
| **Surprise** | Distraction | Surprise | Amazement |
| **Sadness** | Pensiveness | Sadness | Grief |
| **Disgust** | Boredom | Disgust | Loathing |
| **Anger** | Annoyance | Anger | Rage |
| **Anticipation** | Interest | Anticipation | Vigilance |

**Compound Emotions (Dyads):**
- Joy + Trust = Love
- Trust + Fear = Submission
- Fear + Surprise = Awe
- Anger + Disgust = Contempt
- Joy + Anticipation = Optimism
- Sadness + Anger = Envy

### Implementation Approaches

#### Approach 1: LLM Prompt Engineering (Recommended)

Extend our current Gemini prompt to include emotion classification:

```python
EMOTION_PROMPT = """
Analyze this comment and provide:
1. Sentiment: positive/neutral/negative with score 1-10
2. Primary emotion: one of [joy, trust, fear, surprise, sadness, disgust, anger, anticipation]
3. Emotion intensity: low/medium/high
4. Secondary emotion (if applicable)
5. Compound emotion (if applicable): e.g., "optimism" (joy + anticipation)

Comment: "{comment_text}"

Respond in JSON format:
{
  "sentiment": "positive",
  "score": 8,
  "primary_emotion": "joy",
  "emotion_intensity": "high",
  "secondary_emotion": "surprise",
  "compound_emotion": "delight"
}
"""
```

**Pros:** Zero additional infrastructure; works with any LLM; easy to iterate on prompts
**Cons:** Consistency varies; LLMs may hallucinate emotions; costs more tokens per call
**Accuracy:** ~82% agreement with human annotators (based on recent research)

#### Approach 2: Specialized Emotion Models

Fine-tuned transformer models for emotion classification:

| Model | Emotions | Accuracy | Language | Notes |
|-------|----------|----------|----------|-------|
| **GoEmotions** (Google) | 27 emotions + neutral | 46% F1 (multi-label) | English | Based on Reddit comments |
| **EmoRoBERTa** | 28 emotions | ~65% F1 | English | RoBERTa fine-tuned on GoEmotions |
| **BERTimbau + emotion** | 6-8 emotions | ~70% F1 | PT-BR | Requires custom fine-tuning |
| **XLM-RoBERTa emotion** | 8 emotions | ~72% F1 | Multilingual | Good for PT-BR out of the box |

**Pros:** Consistent, fast inference, lower cost per call
**Cons:** Requires model hosting, limited to trained emotion set, less flexible

#### Approach 3: Hybrid (Best Quality)

1. Use specialized model for initial emotion classification (fast, cheap)
2. Use LLM for complex/ambiguous cases and compound emotion detection
3. Use LLM for emotion explanation and insight generation

### How Competitors Implement This

| Competitor | Approach | Emotions | Notes |
|-----------|----------|----------|-------|
| **Brandwatch** | Proprietary NLP + rules | 6 emotions | Industry standard |
| **Sprinklr** | ML + LLM hybrid | 8+ emotions | Enterprise-grade |
| **MonkeyLearn** | Custom ML models | Configurable | User trains models |
| **Talkwalker** | Deep learning | 5 emotions | Includes image sentiment |
| **Meltwater** | NLP pipeline | 6 emotions | Multilingual |

### Visualization

**PyPlutchik** is an open-source Python library for visualizing emotion distributions on Plutchik's wheel. Each petal is sized by emotion proportion in the corpus.

### Recommendation

**Implement Approach 1 (LLM Prompt Engineering) immediately.** It requires zero infrastructure change -- just extend our existing Gemini prompt to output emotion data. Store emotion fields in the Analysis model. Add emotion visualizations to the dashboard using our existing recharts setup.

**Database schema addition:**
```sql
ALTER TABLE analyses ADD COLUMN primary_emotion VARCHAR(20);
ALTER TABLE analyses ADD COLUMN emotion_intensity VARCHAR(10);
ALTER TABLE analyses ADD COLUMN secondary_emotion VARCHAR(20);
ALTER TABLE analyses ADD COLUMN compound_emotion VARCHAR(30);
```

---

## 2. Network Analysis

### Concept

Analyze relationships between commenters, comment threads, and engagement patterns to identify influential users, communities, and conversation dynamics.

### Capabilities

#### 2.1 Influential Commenter Identification

**Metrics for Influence:**
- Comment frequency (prolific commenters)
- Reply count received (conversations sparked)
- Like/reaction count on comments
- Comment-to-reply ratio
- Sentiment influence (do their comments shift subsequent sentiment?)

**Implementation:**
```python
import networkx as nx

# Build commenter interaction graph
G = nx.DiGraph()

for comment in comments:
    G.add_node(comment.author, comments=comment_count)
    if comment.reply_to:
        G.add_edge(comment.reply_to.author, comment.author)

# Calculate centrality metrics
pagerank = nx.pagerank(G)
betweenness = nx.betweenness_centrality(G)

# Top influencers = high PageRank + high betweenness
influencers = sorted(pagerank.items(), key=lambda x: x[1], reverse=True)[:10]
```

#### 2.2 Community Detection

Identify clusters of commenters who frequently interact:

**Algorithms Available in NetworkX:**
- **Louvain** (community_louvain): Fast, good quality, most popular
- **Leiden**: Improved version of Louvain, guarantees connected communities
- **Label Propagation**: Fastest, good for large networks
- **Girvan-Newman**: Edge betweenness-based, slower but interpretable

**Use Case:** Detect "fan communities," "critic groups," or "bot clusters" within comment sections.

#### 2.3 Engagement Graph Analysis

Model the conversation structure:
```
Post
├── Comment A (positive)
│   ├── Reply A1 (agrees)
│   ├── Reply A2 (disagrees) → debate subthread
│   │   └── Reply A2a (escalation)
│   └── Reply A3 (neutral)
├── Comment B (negative)
│   └── Reply B1 (support)
└── Comment C (question)
    └── Reply C1 (answer)
```

**Insights extractable:**
- Debate ratio (% of threads with mixed sentiment)
- Thread depth distribution
- Sentiment propagation patterns (do negative comments breed more negativity?)
- Response time patterns

### Tools

| Tool | Purpose | Difficulty | Notes |
|------|---------|-----------|-------|
| **NetworkX** | Graph analysis in Python | Low | Excellent for MVP; pure Python |
| **igraph** | High-performance graph analysis | Low | Faster than NetworkX for large graphs |
| **Neo4j** | Graph database | High | Overkill unless graph queries are primary feature |
| **Gephi** | Graph visualization | Medium | Desktop tool for exploration, not production |

### Assessment

| Aspect | Rating |
|--------|--------|
| **Implementation Effort** | Medium (2-3 weeks) |
| **Infrastructure Change** | None (NetworkX is a pip install) |
| **User Value** | Medium -- niche but insightful for power users |
| **Priority** | P3 -- nice differentiator, not core |

### Recommendation

**Medium-term implementation.** Start with basic influencer identification (comment frequency + reply count) which requires no graph library. Add NetworkX-based community detection when we have sufficient comment volume per post to make it meaningful (100+ comments per analysis). This feature best suits a "Pro" tier.

---

## 3. Bot Detection

### Why It Matters

Bot comments distort sentiment analysis:
- Spam bots inflate positive sentiment (fake praise)
- Attack bots amplify negative sentiment (coordinated criticism)
- Bots can represent 5-15% of comments on popular posts
- Removing bots improves sentiment accuracy by 10-20%

### Detection Approaches

#### Approach 1: Heuristic Rules (Quick Win)

```python
def is_likely_bot(comment, user_history):
    flags = 0

    # Timing patterns
    if comment.posted_within_seconds_of_post < 5:
        flags += 2  # Posted suspiciously fast

    # Content patterns
    if contains_url(comment.text) and len(comment.text) < 50:
        flags += 2  # Short comment with link = likely spam

    if is_duplicate_text(comment.text, recent_comments):
        flags += 3  # Duplicate or near-duplicate content

    # User patterns (if available)
    if user_history.account_age_days < 7:
        flags += 1  # Very new account

    if user_history.comment_frequency > 100_per_hour:
        flags += 3  # Inhuman posting speed

    # Emoji-only or repetitive characters
    if emoji_ratio(comment.text) > 0.8:
        flags += 1

    return flags >= 4  # Threshold
```

**Pros:** Fast, no external dependencies, interpretable
**Cons:** Easily bypassed by sophisticated bots; needs constant tuning

#### Approach 2: ML-Based Classification

| Model | Approach | Accuracy | Notes |
|-------|----------|----------|-------|
| **Botometer** (Indiana Univ.) | Feature-based ML | ~85% | Twitter-focused; uses profile + content features |
| **BERT-based classifiers** | Fine-tuned transformers | ~90% | Need labeled training data |
| **LLM-based detection** | Prompt-based | ~80% | "Is this comment likely from a bot?" |
| **Graph-based** | Network analysis | ~88% | Analyzes interaction patterns |

#### Approach 3: LLM-Assisted (Practical for SentimentIQ)

Add bot detection to our existing analysis prompt:

```python
BOT_DETECTION_PROMPT = """
In addition to sentiment analysis, assess whether this comment
appears to be from a bot or automated account. Consider:
- Is the language generic or templated?
- Does it contain suspicious links?
- Is the content relevant to the post?
- Are there signs of automated generation?

Provide: bot_probability (0.0 to 1.0) and bot_reason (if > 0.5)
"""
```

#### Approach 4: External Services

| Service | Focus | Cost | Integration |
|---------|-------|------|-------------|
| **Spikerz** | Social media bot removal | Subscription | API-based; connects to platform APIs |
| **DataDome** | Bot detection (web traffic) | Enterprise pricing | Not ideal for social media comments |
| **Botometer API** | Twitter bot detection | Free (limited) | Twitter-specific |

### Impact on Sentiment Accuracy

| Scenario | Without Bot Filtering | With Bot Filtering | Improvement |
|----------|----------------------|-------------------|-------------|
| Normal post | 78% accuracy | 85% accuracy | +7% |
| Targeted attack | 45% accuracy | 80% accuracy | +35% |
| Spam campaign | 50% accuracy | 82% accuracy | +32% |

### Recommendation

**Implement in two phases:**

1. **Phase 1 (Quick Win):** Add heuristic rules + LLM prompt addition for bot probability scoring. Store `bot_probability` in the Comment model. Filter out high-probability bots from sentiment aggregation. Cost: ~1 week, zero infrastructure.

2. **Phase 2 (Medium-term):** Build a labeled dataset from Phase 1 classifications (human-reviewed). Train a lightweight classifier (e.g., sklearn RandomForest on comment features). Use as pre-filter before LLM analysis to reduce costs.

**Schema addition:**
```sql
ALTER TABLE comments ADD COLUMN bot_probability FLOAT DEFAULT 0.0;
ALTER TABLE comments ADD COLUMN is_filtered BOOLEAN DEFAULT FALSE;
```

---

## 4. Trend Forecasting

### Concept

Use time series analysis on historical sentiment data to predict future sentiment trends, detect anomalies early, and alert users to potential crises.

### Methods Comparison

| Method | Best For | Accuracy | Complexity | Notes |
|--------|---------|----------|------------|-------|
| **Moving Average** | Smoothing noise | Low | Very Low | Good for baseline visualization |
| **ARIMA** | Short-term, stationary data | Medium | Low | Captures linear relationships |
| **Prophet** (Meta) | Business time series with seasonality | Medium-High | Low | Automatic handling of holidays, missing data |
| **LSTM/GRU** | Complex non-linear patterns | High | High | Needs large training data |
| **LLM-based** | Narrative insights + prediction | Medium | Low | "Based on the trend, sentiment is likely to..." |
| **Hybrid (Prophet + LLM)** | Best of both | High | Medium | Quantitative + qualitative forecast |

### Prophet for Sentiment Forecasting (Recommended)

**Why Prophet:**
- Developed by Meta, actively maintained
- Handles missing data gracefully (common in sentiment time series)
- Automatic seasonality detection (day-of-week, time-of-day patterns)
- Easy to use with minimal configuration
- Python library: `pip install prophet`

**Implementation:**
```python
from prophet import Prophet
import pandas as pd

# Prepare sentiment time series
df = pd.DataFrame({
    'ds': sentiment_dates,      # timestamps
    'y': sentiment_scores,       # average daily sentiment score
})

# Fit model
model = Prophet(
    changepoint_prior_scale=0.05,  # sensitivity to trend changes
    seasonality_prior_scale=10,
)
model.fit(df)

# Predict next 7 days
future = model.make_future_dataframe(periods=7)
forecast = model.predict(future)

# Anomaly detection: actual vs predicted
anomalies = df[abs(df['y'] - forecast['yhat']) > 2 * forecast['yhat_upper']]
```

### Early Warning System

**Architecture:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Celery Beat   │────>│ Check Latest │────>│ Compare to   │
│ (hourly/daily)│     │ Sentiment    │     │ Forecast     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────┴───────┐
                                           │  Anomaly?     │
                                           └──────┬───────┘
                                          No      │      Yes
                                          │       │       │
                                          ▼       │       ▼
                                       [Log]      │  ┌──────────┐
                                                  │  │ Alert    │
                                                  │  │ (Email/  │
                                                  │  │  Push/   │
                                                  │  │  In-app) │
                                                  │  └──────────┘
```

**Alert Thresholds:**
- **Warning:** Sentiment drops >15% from 7-day average
- **Alert:** Sentiment drops >25% from 7-day average
- **Crisis:** Sentiment drops >40% or negative comment volume spikes >3x

### Recommendation

**Medium-term implementation (1-2 months).** Prophet is the best fit: it is easy to implement, handles our data characteristics well, and provides both forecasting and anomaly detection. The early warning system uses our existing Celery Beat infrastructure for scheduling checks.

**Dependencies:**
- Minimum 30 days of historical sentiment data per connection
- Celery Beat scheduling (already have Celery)
- Email/notification infrastructure

---

## 5. Topic Clustering

### Concept

Automatically discover what topics commenters are discussing, without predefined categories. Track how topics evolve over time.

### Methods Comparison

| Method | Quality | Speed | Interpretability | Notes |
|--------|---------|-------|------------------|-------|
| **LDA** (Latent Dirichlet Allocation) | Medium | Fast | Good | Traditional; bag-of-words based |
| **BERTopic** | High | Medium | Excellent | Transformer embeddings + clustering |
| **LLM-based clustering** | Very High | Slow | Excellent | Most flexible but expensive |
| **K-Means on embeddings** | Medium | Very Fast | Low | Simple but requires K |
| **HDBSCAN on embeddings** | High | Fast | Medium | No need to specify K |

### BERTopic (Recommended)

**Pipeline:**
1. Generate embeddings (Sentence-BERT / any embedding model)
2. Dimensionality reduction (UMAP)
3. Clustering (HDBSCAN)
4. Topic representation (c-TF-IDF + optional LLM labeling)

**Why BERTopic:**
- State-of-the-art topic discovery for short texts (comments)
- Built-in LLM integration for human-readable topic labels
- Dynamic topic modeling (track topic evolution over time)
- Supports hierarchical topics (fine-grained -> broad categories)
- Active development (v0.16+ in 2025)

**Implementation:**
```python
from bertopic import BERTopic
from sentence_transformers import SentenceTransformer

# Use multilingual model for PT-BR support
embedding_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

# Create BERTopic model with LLM labeling
topic_model = BERTopic(
    embedding_model=embedding_model,
    nr_topics="auto",  # automatic topic count
    verbose=True
)

# Fit on comments
topics, probs = topic_model.fit_transform(comment_texts)

# Get topic info
topic_info = topic_model.get_topic_info()
# Topic 0: "video quality, resolution, 4k, editing"
# Topic 1: "music, background, soundtrack, intro"
# Topic 2: "price, expensive, worth it, value"

# Topic evolution over time
topics_over_time = topic_model.topics_over_time(
    comment_texts, timestamps
)
```

### LLM-Enhanced Topic Labels

Recent research (2025) shows that using LLMs for topic label generation produces more diverse and coherent topic names:

```python
from bertopic.representation import LangChain
from langchain_google_genai import ChatGoogleGenerativeAI

# Use Gemini for topic labeling
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

representation_model = LangChain(
    llm,
    prompt="Based on these keywords and documents, generate a short, "
           "descriptive topic label: [KEYWORDS] [DOCUMENTS]"
)

topic_model = BERTopic(representation_model=representation_model)
```

### Topic Evolution Tracking

Track how conversation topics shift over time:

```
Week 1: [Product Quality: 40%] [Customer Service: 30%] [Price: 30%]
Week 2: [Product Quality: 25%] [Customer Service: 45%] [Price: 20%] [Shipping: 10%]
Week 3: [Shipping: 50%] [Customer Service: 30%] [Product Quality: 15%] [Returns: 5%]
                ↑ Shipping issues emerging as dominant topic
```

### Recommendation

**Medium-term implementation (2-3 weeks).** BERTopic is the clear winner for our use case. It handles short texts (comments) well, supports multilingual content (PT-BR), and integrates with our existing Gemini model for label generation.

**Implementation plan:**
1. Install BERTopic + sentence-transformers
2. Generate embeddings for comments (reuse for pgvector)
3. Run clustering on a per-connection or per-post basis
4. Store topic assignments in analysis results
5. Build topic evolution chart in frontend (using existing recharts)

**Note:** BERTopic embeddings are the same embeddings we'd use for pgvector similarity search -- **double ROI from a single embedding pipeline.**

---

## 6. Aspect-Based Sentiment Analysis (ABSA)

### Concept

Instead of one sentiment per comment, detect sentiment for each aspect/feature mentioned:

**Example:**
> "The video quality is amazing but the audio is terrible and the intro is way too long"

| Aspect | Sentiment | Score |
|--------|-----------|-------|
| Video quality | Positive | 9 |
| Audio | Negative | 2 |
| Intro length | Negative | 3 |

### Current State of the Art (2025)

- Top ABSA systems exceed 90% F1 on standard benchmarks
- LLM-based approaches achieve comparable performance to fine-tuned models in zero-shot
- Cross-lingual ABSA datasets now cover 21 languages including Portuguese
- Joint multi-task learning (extract aspects + classify sentiment together) is the dominant approach

### Implementation Approaches

#### Approach 1: LLM Prompt Engineering (Recommended Start)

```python
ABSA_PROMPT = """
Analyze this comment and identify ALL aspects/features mentioned,
with their individual sentiment.

Comment: "{comment_text}"

For each aspect found, provide:
- aspect: the specific feature or topic mentioned
- sentiment: positive/neutral/negative
- score: 1-10
- quote: the relevant text snippet

Respond in JSON:
{
  "aspects": [
    {
      "aspect": "video quality",
      "sentiment": "positive",
      "score": 9,
      "quote": "The video quality is amazing"
    },
    {
      "aspect": "audio",
      "sentiment": "negative",
      "score": 2,
      "quote": "the audio is terrible"
    }
  ],
  "overall_sentiment": "mixed",
  "overall_score": 5
}
"""
```

**Pros:** Works immediately with our existing Gemini pipeline; flexible; handles any aspect
**Cons:** Higher token cost; output structure may vary; needs validation

#### Approach 2: Fine-Tuned ABSA Models

| Model | Approach | F1 Score | Language | Notes |
|-------|----------|----------|----------|-------|
| **InstructABSA** | Instruction-tuned T5 | ~87% F1 | English | Fine-tuned specifically for ABSA |
| **BERT + GCN** | Graph-based | ~85% F1 | English | Uses syntax tree + attention |
| **SetFit-ABSA** | Few-shot fine-tuned | ~80% F1 | Multilingual | Works with minimal training data |
| **XLM-RoBERTa-ABSA** | Cross-lingual | ~78% F1 | 21 languages | Includes Portuguese |

#### Approach 3: Hybrid Pipeline

```
Comment → [Aspect Extraction (NLP/LLM)] → [Aspect Sentiment Classification (LLM)] → [Aggregation]
```

1. **Extract aspects** using lightweight NER or keyword extraction
2. **Classify sentiment** per aspect using LLM (cheaper: only aspect snippets sent to LLM)
3. **Aggregate** to post-level and connection-level aspect summaries

### Aggregated Aspect Insights

The real value of ABSA comes from aggregation across many comments:

```
Brand Dashboard - Aspect Sentiment Summary (Last 30 Days)
┌─────────────────────┬───────────┬──────────────┬────────────┐
│ Aspect              │ Mentions  │ Avg Score    │ Trend      │
├─────────────────────┼───────────┼──────────────┼────────────┤
│ Video Quality       │ 1,247     │ 8.2 (↑0.3)  │ Improving  │
│ Audio/Sound         │ 892       │ 4.1 (↓1.2)  │ Declining  │ ← Alert!
│ Content/Topics      │ 2,103     │ 7.5 (→)     │ Stable     │
│ Upload Frequency    │ 456       │ 6.3 (↑0.8)  │ Improving  │
│ Thumbnail/Branding  │ 234       │ 7.8 (→)     │ Stable     │
│ Customer Service    │ 178       │ 3.2 (↓0.5)  │ Declining  │ ← Alert!
└─────────────────────┴───────────┴──────────────┴────────────┘
```

### Database Schema for ABSA

```sql
CREATE TABLE aspect_sentiments (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER REFERENCES analyses(id),
    comment_id INTEGER REFERENCES comments(id),
    aspect VARCHAR(100) NOT NULL,
    sentiment VARCHAR(10) NOT NULL,  -- positive/neutral/negative
    score SMALLINT NOT NULL,         -- 1-10
    quote TEXT,                       -- relevant text snippet
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_aspect_sentiments_aspect ON aspect_sentiments(aspect);
CREATE INDEX idx_aspect_sentiments_analysis ON aspect_sentiments(analysis_id);
```

### Recommendation

**High priority -- major differentiator.** ABSA is the single most valuable advanced analysis feature for SentimentIQ. It transforms our product from a simple "is it positive or negative?" tool into a granular insights platform.

**Implementation plan:**
1. **Phase 1 (1 week):** Add ABSA to LLM prompt; store aspect data; display per-comment aspects
2. **Phase 2 (2 weeks):** Build aggregation queries; add aspect summary dashboard; trend tracking
3. **Phase 3 (1 month):** Aspect-level alerts; cross-post aspect comparison; aspect evolution over time

---

## Summary of Recommendations

| Technique | Priority | Effort | Impact | Timeline |
|-----------|----------|--------|--------|----------|
| **ABSA** | P0 | Medium | Very High | 2-4 weeks |
| **Emotion Detection** | P1 | Low | High | 1 week |
| **Bot Detection (heuristic)** | P2 | Low | High | 1 week |
| **Topic Clustering (BERTopic)** | P3 | Medium | High | 2-3 weeks |
| **Trend Forecasting (Prophet)** | P4 | Medium | High | 2-4 weeks |
| **Bot Detection (ML)** | P5 | Medium | Medium | 1-2 months |
| **Network Analysis** | P6 | Medium | Medium | 2-3 weeks |

### Shared Infrastructure

Several features share the same underlying infrastructure:

```
Embedding Pipeline (one-time setup)
    ├── pgvector similarity search
    ├── BERTopic topic clustering
    ├── Comment deduplication
    └── RAG retrieval

Celery Beat scheduling (already exists)
    ├── Trend forecasting jobs
    ├── Anomaly detection checks
    └── Alert dispatching

LLM prompt extensions (minimal change)
    ├── Emotion detection
    ├── ABSA
    └── Bot probability scoring
```

Building the embedding pipeline first unlocks multiple features simultaneously.
