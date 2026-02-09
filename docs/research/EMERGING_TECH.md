# Emerging Technologies Research

> Last updated: February 2026 | SentimentIQ R&D

---

## Table of Contents

1. [LLM Pipeline Tools](#1-llm-pipeline-tools)
2. [RAG (Retrieval Augmented Generation)](#2-rag-retrieval-augmented-generation)
3. [Vector Databases](#3-vector-databases)
4. [New LLM Models (2025-2026)](#4-new-llm-models-2025-2026)
5. [Multimodal Analysis](#5-multimodal-analysis)

---

## 1. LLM Pipeline Tools

### LangChain

**Current State:** LangChain remains the most popular Python framework for building LLM-powered applications. It provides modular components -- prompt templates, chains, memory systems, and output parsers -- that simplify integration of LLMs into backend pipelines.

**Pros:**
- Rapid prototyping with extensive component library
- Easy integration with FastAPI (our current backend)
- Large ecosystem: 2,000+ integrations with LLM providers, vector stores, tools
- Built-in support for structured output parsing (ideal for sentiment JSON responses)
- Active community with frequent updates

**Cons:**
- High abstraction overhead -- adds complexity to simple use cases
- Debugging complex chains is challenging; limited visibility into intermediate states
- Linear execution model struggles with complex orchestration
- Version churn: breaking changes between releases are common
- Performance overhead from abstraction layers

### LangGraph

**Current State:** LangGraph is LangChain's graph-based framework for building stateful, multi-actor AI applications. It models workflows as directed graphs where nodes are processing steps and edges define flow.

**Pros:**
- Built-in state management with automatic persistence and checkpointing
- Advanced error handling: retry from specific nodes, fallback strategies
- Excellent for complex multi-step analysis (e.g., extract topics -> classify sentiment -> detect emotions -> generate summary)
- Supports human-in-the-loop review checkpoints
- Debugging transparency: replay execution and inspect each node

**Cons:**
- High learning curve; graph-based mental model takes time
- Overkill for straightforward linear pipelines
- Complexity grows with large workflows; debugging overhead increases
- Smaller ecosystem compared to vanilla LangChain

### LlamaIndex

**Current State:** LlamaIndex (formerly GPT Index) focuses on connecting LLMs with external data. In 2025 it achieved a 35% boost in retrieval accuracy and 40% faster document retrieval speeds compared to LangChain for data-heavy applications.

**Key Features:**
- LlamaParse: advanced PDF parsing that preserves document structure
- LlamaIndex Classify: rules-based document classification service
- Built-in multi-step workflows with parallel processing
- Excellent for indexing and querying large comment datasets

**Best For:** Building knowledge bases from comment data, creating searchable indexes of historical analysis results.

### Comparison: Custom Prompts (Current) vs Framework-Based

| Aspect | Custom Prompts (Current) | LangChain | LangGraph |
|--------|-------------------------|-----------|-----------|
| **Complexity** | Low | Medium | High |
| **Flexibility** | Full control | Moderate (framework constraints) | High (graph-based) |
| **Maintenance** | Manual prompt management | Framework updates may break | Framework updates may break |
| **Error Handling** | Custom try/catch | Built-in retries | Advanced retry per node |
| **Observability** | Custom logging | LangSmith integration | Built-in replay/inspect |
| **Performance** | Minimal overhead | ~10-15% overhead | ~15-20% overhead |
| **Learning Curve** | None (already built) | 1-2 weeks | 2-4 weeks |
| **Best For** | Simple, linear pipelines | Multi-provider, chained tasks | Complex, stateful workflows |

### Recommendation for SentimentIQ

**Short-term: Keep custom prompts.** Our current Gemini-based pipeline is relatively linear (extract comments -> analyze with LLM -> store results). The overhead of adopting a framework is not justified yet.

**Medium-term: Consider LangChain** when we add multiple LLM providers (e.g., switching between Gemini and open-source models based on cost) or when we need structured multi-step pipelines (e.g., topic extraction -> ABSA -> emotion detection -> summary generation).

**Long-term: Evaluate LangGraph** if we build complex agent-based features like the AI Copilot (chat with your data), where stateful multi-turn interactions with branching logic are needed.

---

## 2. RAG (Retrieval Augmented Generation)

### What is RAG?

RAG combines LLM generation with external knowledge retrieval. Instead of relying solely on the LLM's training data, RAG retrieves relevant documents from a knowledge base and includes them in the prompt context.

### How RAG Could Help SentimentIQ

| Use Case | Description | ROI |
|----------|-------------|-----|
| **Brand-Specific Context** | Store brand guidelines, product info, and industry jargon. When analyzing sentiment, the LLM understands that "bricked" in tech means broken, not a building material. | High |
| **Historical Analysis** | Retrieve past sentiment trends for a brand when generating health reports. "Sentiment dropped 15% compared to last month's average." | High |
| **Competitor Context** | Store public knowledge about competitors to provide comparative insights. | Medium |
| **Response Suggestions** | Retrieve best-practice responses to common negative comment types. | Medium |
| **Custom Dictionaries** | Brand-specific slang, abbreviations, and PT-BR internet jargon that LLMs may not fully understand. | Medium |

### Implementation Approach

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Comments    │────>│  Embedding   │────>│  Vector DB  │
│  & Context   │     │  Model       │     │  (pgvector) │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
┌─────────────┐     ┌──────────────┐           │ Retrieve
│  User Query  │────>│  Embed Query │───────────┘
│  or Comment  │     └──────────────┘           │
└─────────────┘                                 ▼
                    ┌──────────────┐     ┌─────────────┐
                    │  Augmented   │<────│  Top-K      │
                    │  Prompt      │     │  Results    │
                    └──────┬───────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  LLM (Gemini │
                    │  / Claude)   │
                    └──────────────┘
```

### Implementation Steps

1. **Add pgvector extension** to existing PostgreSQL database (minimal infrastructure change)
2. **Create embeddings table** for comments and brand context documents
3. **Use an embedding model** (e.g., `text-embedding-3-small` from OpenAI at $0.02/1M tokens, or `text-embedding-004` from Google)
4. **Build retrieval layer** that fetches relevant context before LLM analysis
5. **Augment existing prompts** with retrieved context

### Estimated Complexity and ROI

| Aspect | Assessment |
|--------|------------|
| **Implementation Time** | 2-3 weeks for basic RAG pipeline |
| **Infrastructure Change** | Minimal -- pgvector extension on existing PostgreSQL |
| **Cost Impact** | +$5-20/month for embedding API calls (depends on volume) |
| **Performance Impact** | +200-500ms per analysis (embedding + retrieval) |
| **Quality Improvement** | 15-25% improvement in domain-specific accuracy |
| **ROI** | **High** -- relatively low effort, meaningful quality improvement |

### Key Decision: When to Implement RAG

RAG is most valuable when:
- Users report that sentiment analysis misunderstands domain-specific language
- We expand to industry-specific verticals (e.g., gaming, finance, healthcare)
- We build the AI Copilot feature (natural language queries about data)
- We need to generate contextual health reports with historical awareness

---

## 3. Vector Databases

### Comparison Matrix

| Database | Type | Cost (Startup) | Ease of Setup | Performance | Max Scale | Best For |
|----------|------|----------------|---------------|-------------|-----------|----------|
| **pgvector** | Extension | Free (existing PG) | Trivial | Good (<10M vectors) | ~50M vectors | MVPs using PostgreSQL |
| **pgvectorscale** | Extension | Free | Easy | Excellent | ~100M vectors | Production PostgreSQL |
| **ChromaDB** | Embedded | Free (OSS) | Very Easy | Good (small data) | ~1M vectors | Prototyping |
| **Qdrant** | Dedicated | Free (OSS) / $25+/mo cloud | Moderate | Excellent | Billions | Production at scale |
| **Weaviate** | Dedicated | Free (OSS) / $25+/mo cloud | Moderate | Excellent | Billions | Multi-modal search |
| **Pinecone** | Managed | Free tier / $70+/mo | Easy | Excellent | Billions | Enterprise, zero-ops |
| **Milvus** | Dedicated | Free (OSS) | Complex | Excellent | Billions+ | Extreme scale |

### Detailed Analysis for SentimentIQ

#### pgvector (Recommended for MVP)

**Why it is the best choice for us:**
- We already use PostgreSQL -- zero new infrastructure
- Comments and their embeddings live in the same database, same transactions
- HNSW index provides excellent query performance for our scale
- pgvectorscale (by Timescale) adds DiskANN indexing for better performance at scale
- Benchmarks show pgvector + pgvectorscale achieves 28x lower p95 latency than Pinecone s1 at 99% recall, at 75% less cost

**Implementation:**
```sql
-- Enable extension
CREATE EXTENSION vector;

-- Add embedding column to comments table
ALTER TABLE comments ADD COLUMN embedding vector(768);

-- Create HNSW index for fast similarity search
CREATE INDEX ON comments USING hnsw (embedding vector_cosine_ops);

-- Find similar comments
SELECT id, content, 1 - (embedding <=> query_embedding) as similarity
FROM comments
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

**Limitations:**
- Beyond 50-100M vectors, dedicated vector DBs perform better
- No built-in hybrid search (text + vector) -- needs manual implementation

#### When to Migrate Away from pgvector

Consider a dedicated vector database when:
- Comment volume exceeds 50M+ embeddings
- You need sub-10ms query latency at scale
- You require advanced features like multi-modal search
- At that point, **Qdrant** (Rust-based, excellent performance, open-source) is the best next step

### Use Cases for SentimentIQ

| Use Case | Description | Priority |
|----------|-------------|----------|
| **Similar Comment Clustering** | Find comments expressing similar sentiments/topics | High |
| **Deduplication** | Detect near-duplicate or spam comments | High |
| **Semantic Search** | Search comments by meaning, not just keywords | Medium |
| **Brand Context Retrieval** | RAG: retrieve relevant brand info for analysis | Medium |
| **Anomaly Detection** | Find comments that are semantically outliers | Low |

---

## 4. New LLM Models (2025-2026)

### Pricing and Capability Comparison

| Model | Provider | Input $/1M tokens | Output $/1M tokens | Context Window | Sentiment Strength | Notes |
|-------|----------|-------------------|--------------------|--------------|--------------------|-------|
| **Gemini 2.0 Flash** (current) | Google | ~$0.075 | ~$0.30 | 1M tokens | Good | Our current model; being deprecated June 2026 |
| **Gemini 2.5 Flash** | Google | ~$0.15 | ~$0.60 | 1M tokens | Very Good | Direct upgrade path, better reasoning |
| **Gemini 3 Flash** | Google | ~$0.20 | ~$0.80 | 1M+ tokens | Excellent | 80%+ better reasoning, new default |
| **Gemini 3 Pro** | Google | $2-4 | $12-18 | 1M+ tokens | Excellent | Premium tier |
| **GPT-4.1 mini** | OpenAI | ~$0.40 | ~$1.60 | 1M tokens | Very Good | 83% cheaper than GPT-4o, strong instruction following |
| **GPT-4.1** | OpenAI | ~$2.50 | ~$10 | 1M tokens | Excellent | Best for complex analysis |
| **GPT-5** | OpenAI | ~$5 | ~$20 | 1M+ tokens | State-of-art | Released Aug 2025, supersedes all GPT-4 variants |
| **Claude Haiku 4.5** | Anthropic | $1 | $5 | 200K tokens | Very Good | Best value for structured tasks |
| **Claude Sonnet 4.5** | Anthropic | $3 | $15 | 200K tokens | Excellent | Strong reasoning + instruction following |
| **Claude Opus 4.5** | Anthropic | $5 | $25 | 200K tokens | State-of-art | Flagship; best coding model |
| **DeepSeek-V3.2** | DeepSeek | $0.028 | $0.11 | 128K tokens | Good | 10x cheaper than GPT-5, open weights |
| **DeepSeek R1** | DeepSeek | $0.27 | $1.10 | 128K tokens | Very Good | 27x cheaper than o1, strong reasoning |
| **Llama 4 Scout** | Meta (OSS) | Free (self-host) | Free (self-host) | 10M tokens | Good | 128K effective context, open source |
| **Qwen 3** | Alibaba (OSS) | Free (self-host) | Free (self-host) | 200K tokens | Very Good | Best multilingual OSS model |
| **Mistral Large 3** | Mistral (OSS) | Free (self-host) | Free (self-host) | 128K tokens | Good | 41B active params, strong European language support |

### Migration Priority: Gemini 2.0 Flash Deprecation

**CRITICAL:** Gemini 2.0 Flash is scheduled for deprecation in June 2026. We must migrate to Gemini 2.5 Flash or Gemini 3 Flash.

**Recommended Migration Path:**
1. **Immediate (Q1 2026):** Upgrade to Gemini 2.5 Flash -- minimal code changes, better performance
2. **Q2 2026:** Evaluate Gemini 3 Flash as it stabilizes
3. **Future:** Consider multi-model strategy (see below)

### Multi-Model Strategy

For a sentiment analysis product, different models excel at different tasks:

| Task | Recommended Model | Reasoning |
|------|-------------------|-----------|
| **Bulk Comment Analysis** | Gemini 3 Flash or DeepSeek-V3.2 | Cheapest per token, good enough quality |
| **Complex Emotion/ABSA** | Claude Sonnet 4.5 or GPT-4.1 | Better nuance and structured output |
| **AI Copilot (Chat)** | Claude Sonnet 4.5 | Best conversational + analytical ability |
| **Report Generation** | GPT-4.1 or Claude Sonnet 4.5 | Strong long-form writing |
| **PT-BR Specific** | Gemini 3 Flash or Qwen 3 | Best multilingual coverage |

### Open Source: Can They Replace Paid APIs?

**Yes, for basic sentiment analysis.** Models like Qwen 3, Llama 4, and DeepSeek can handle standard sentiment classification (positive/neutral/negative + score) at quality comparable to paid APIs.

**No, for advanced analysis.** Complex tasks like ABSA, emotion detection with Plutchik's wheel, or nuanced sarcasm detection still benefit from frontier models (GPT-5, Claude Sonnet 4.5, Gemini 3 Pro).

**Cost Consideration:** Self-hosting a 70B parameter model requires GPU infrastructure ($500-2,000/month for cloud GPU). For our volume, API-based models are likely cheaper until we process 1M+ comments/month.

### PT-BR Specific Models

| Model | Type | Notes |
|-------|------|-------|
| **BERTimbau** (Base/Large) | Encoder (BERT) | Best PT-BR BERT model; excellent for classification fine-tuning; by NeuralMind |
| **Sabia-2** (Maritaca AI) | Decoder (GPT-like) | Brazilian Portuguese LLM; matches GPT-3.5 on 90%+ of PT-BR exams; 10x cheaper than GPT-4 |
| **DeBERTinha** | Encoder (DeBERTa) | DeBERTa V3 XSmall adapted for PT-BR; lightweight |
| **FinBERT-PT-BR** | Encoder (BERT) | Financial sentiment specific to PT-BR |
| **Gervasio-PT-BR** | Decoder (GPT) | GPT-family decoder for Brazilian Portuguese |

**Recommendation:** For PT-BR sentiment analysis, use Gemini or Claude (excellent multilingual support) for the primary pipeline. If we need a specialized PT-BR model for fine-tuning or edge cases, BERTimbau Large is the best foundation model.

---

## 5. Multimodal Analysis

### Image Sentiment Analysis

**Current State (2025-2026):**
- Multimodal models (GPT-4o, Gemini 3, Claude Sonnet 4.5) can analyze images and text together
- Academic research achieves 81.63% F1-score on multimodal sentiment benchmarks (CH-SIMS)
- Key challenge: image and text in the same post can express contradictory sentiments

**Approaches:**
1. **LLM Vision APIs** (Recommended): Send post image + text to GPT-4o or Gemini Vision for joint analysis. Simple to implement, good accuracy.
2. **Specialized Models** (CLIP + ViT + BERT fusion): Higher accuracy but complex to deploy and maintain.
3. **Multi-Agent Framework** (SentiMM): Multiple specialized agents process text and visual inputs separately, then fuse results. State-of-the-art but complex.

**Implementation for SentimentIQ:**
```python
# Simple approach using Gemini Vision
response = model.generate_content([
    "Analyze the sentiment of this social media post. "
    "Consider both the image and the caption text.",
    image_part,  # Post image/thumbnail
    f"Caption: {post.caption}"
])
```

**Cost Impact:** Image analysis costs ~2-5x more tokens than text-only analysis.

### Video Sentiment from Thumbnails/Frames

**Approach:** Extract key frames from video content and analyze them alongside text metadata (title, description, tags).

**Implementation:**
1. Use yt-dlp (already integrated) to extract thumbnail
2. Optionally extract 3-5 key frames at intervals
3. Send to multimodal LLM with video metadata

**ROI:** Medium. Thumbnails alone provide useful context (clickbait detection, emotional tone of imagery). Full frame analysis is expensive for marginal gains.

### Audio Sentiment from Voice Comments

**Current State:**
- Speech Emotion Recognition (SER) achieves 91-98% accuracy on benchmarks
- Modern approaches: MFCC features + CNN/LSTM/Transformer architectures
- Key prosodic features: pitch, intensity, speech rate, voice quality

**Available Tools:**
- **OpenAI Whisper**: Transcription + can be paired with text sentiment
- **Google Speech-to-Text**: Real-time transcription with confidence scores
- **pyAudioAnalysis**: Open-source Python library for audio feature extraction
- **SpeechBrain**: Open-source toolkit for speech processing (includes emotion recognition)

**Relevance for SentimentIQ:** Low priority. YouTube and Instagram comments are text-based. Audio sentiment would only apply if we analyze video/audio content itself (e.g., YouTube video transcripts, Instagram Reels audio). This is a future differentiator, not an MVP feature.

### Multimodal Analysis Priority Matrix

| Capability | Implementation Effort | Cost Impact | User Value | Priority |
|-----------|----------------------|-------------|------------|----------|
| Image + Text sentiment | Low (use existing LLM APIs) | Medium (+tokens) | High | **P1** |
| Thumbnail analysis | Low | Low | Medium | **P2** |
| Video frame analysis | Medium | High | Medium | **P3** |
| Audio/voice sentiment | High | High | Low (for our use case) | **P4** |

### Recommendation

Start with **image + text sentiment** using Gemini Vision or GPT-4o vision. This requires minimal infrastructure change (just pass the image URL to the LLM along with the comment text) and provides meaningful additional context for post-level sentiment analysis. Instagram posts with images are particularly well-suited for this.

---

## Summary of Recommendations

| Technology | Recommendation | Timeline | Effort |
|-----------|----------------|----------|--------|
| LangChain/LangGraph | Keep custom prompts now; adopt LangChain when multi-model | 3-6 months | Medium |
| LlamaIndex | Not needed yet; useful for AI Copilot feature | 6+ months | Medium |
| RAG | Implement when adding domain-specific analysis or AI Copilot | 2-4 months | Medium |
| pgvector | **Adopt now** -- add to existing PostgreSQL for similarity search | 1-2 weeks | Low |
| Gemini 2.5/3 Flash | **Migrate now** -- 2.0 Flash being deprecated | ASAP | Low |
| Multi-model strategy | Implement routing between cheap/premium models | 2-3 months | Medium |
| Open-source LLMs | Evaluate Qwen 3 for cost reduction at scale | 3-6 months | High |
| PT-BR models | Use BERTimbau for specialized tasks; main LLMs handle PT-BR well | As needed | Low |
| Image sentiment | Add multimodal analysis using existing LLM vision APIs | 1-2 months | Low |
| Audio/video sentiment | Future differentiator; not priority | 6+ months | High |
