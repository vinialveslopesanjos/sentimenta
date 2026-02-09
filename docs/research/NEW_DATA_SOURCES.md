# New Data Sources Research

> Last updated: February 2026 | SentimentIQ R&D

---

## Table of Contents

1. [TikTok](#1-tiktok)
2. [Twitter/X](#2-twitterx)
3. [LinkedIn](#3-linkedin)
4. [Reddit](#4-reddit)
5. [Telegram](#5-telegram)
6. [WhatsApp Business](#6-whatsapp-business)
7. [Threads (Meta)](#7-threads-meta)
8. [Platform Comparison Matrix](#8-platform-comparison-matrix)

---

## 1. TikTok

### API Status and Access

**Official APIs:**
- **TikTok Content Posting API**: OAuth-based, for posting content. Not useful for reading comments.
- **TikTok Research API**: Available to academic researchers from non-profit universities in the US and Europe. Provides access to public video data, comments, and user profiles. **Not available for commercial use.**
- **TikTok Business API**: For advertisers and marketing partners. Limited to campaign management, not organic comment analysis.

**Access Requirements:**
- Developer account registration + approval process
- OAuth 2.0 authentication required
- Research API requires academic affiliation
- Commercial data access requires partnership agreement with ByteDance

### Comment Structure and Volume

- Comments are nested (replies to comments)
- Rich metadata: likes, timestamps, user info
- Very high volume: popular videos can have 100K+ comments
- Comments tend to be short (1-3 sentences), emoji-heavy, and use heavy slang/abbreviations
- Multiple languages in same comment section is common

### Scraping Alternatives

| Method | Legal Risk | Reliability | Cost |
|--------|-----------|-------------|------|
| **TikTok Research API** | None (official) | High | Free (academic only) |
| **Third-party APIs** (SociaVault, Bright Data, Apify) | Medium | Medium-High | $50-500/month |
| **Custom web scraping** | Medium-High | Low (anti-bot measures) | Dev time + proxies |
| **yt-dlp** | Medium | Medium | Free |

**Legal Considerations:**
- TikTok's Terms of Service explicitly prohibit automated data collection
- Public data scraping is legally gray -- courts have sometimes ruled in favor of scraping public data (hiQ vs LinkedIn)
- GDPR/LGPD implications for processing user comments
- Third-party API services handle the scraping risk themselves

### Assessment

| Metric | Rating |
|--------|--------|
| **API Availability** | Limited -- no commercial API for reading comments |
| **Cost** | $50-500/month via third-party services |
| **Legal Risk** | Medium -- ToS violation, but public data |
| **Implementation Difficulty** | 3/5 -- requires third-party service or scraping |
| **User Value** | 5/5 -- TikTok is the #1 platform for Gen Z; huge demand |
| **Comment Volume/Quality** | Very high volume; short, emoji-heavy, slang-rich |

### Recommendation

**High priority, but approach carefully.** Use a third-party data provider (e.g., SociaVault or Bright Data) rather than building our own scraper. This offloads legal risk and maintenance burden. TikTok comment analysis would be a major differentiator for SentimentIQ. Consider offering TikTok as a "beta" feature with clear disclaimers about data access limitations.

---

## 2. Twitter/X

### API v2 Current Pricing (2025-2026)

| Tier | Monthly Cost | Read Limit | Write Limit | Use Case |
|------|-------------|------------|-------------|----------|
| **Free** | $0 | 0 (write-only) | 1,500 tweets/month | Posting only |
| **Basic** | $200/month | 15,000 tweets/month | 50,000 tweets/month | Small apps |
| **Pro** | $5,000/month | 1M tweets/month | 300K tweets/month | Business analytics |
| **Enterprise** | $42,000+/month | Full firehose | Unlimited | Large-scale analytics |

### Pay-Per-Use Pilot

X has introduced a pilot program with credit-based pricing. Developers pay only for API requests made. However, this is a limited pilot -- not yet available to all developers.

### Is It Viable for a Startup?

**No, not at current pricing.** The Basic tier ($200/month) only provides 15,000 tweets -- far too few for meaningful sentiment analysis. The Pro tier ($5,000/month) is prohibitively expensive for an early-stage startup.

**Alternative Approaches:**
1. **Third-party data providers**: Services like SocialBlade, Brandwatch, or SociaVault may offer cheaper access
2. **Nitter instances** (if still operational): Public tweet access without API
3. **Social listening tools**: Embed within existing tools that already have X API access
4. **Wait for pay-per-use**: Monitor the pilot program for broader availability

### Assessment

| Metric | Rating |
|--------|--------|
| **API Availability** | Available but extremely expensive |
| **Cost** | $200-5,000/month (Basic to Pro) |
| **Legal Risk** | Low (official API) |
| **Implementation Difficulty** | 2/5 (well-documented API) |
| **User Value** | 4/5 (important platform, but declining for some demographics) |
| **Comment Volume/Quality** | Medium-high; tweets are short but information-dense |

### Recommendation

**Not recommended for MVP.** The $5,000/month Pro tier is needed for meaningful analysis, which is unsustainable for a startup. Revisit if the pay-per-use model becomes broadly available or if pricing changes. If a customer specifically requests X/Twitter analysis, consider offering it as a premium add-on that covers the API cost.

---

## 3. LinkedIn

### API Capabilities

**LinkedIn Pages API:**
- Manage company page content (posts, articles)
- Access engagement metrics (likes, comments, shares)
- Respond to comments on company posts
- Requires LinkedIn Marketing Solutions partnership

**Comments API:**
- Access comments on posts via `socialActions` endpoint
- Both personal and organization comments accessible
- Comment URN-based identification system

### Limitations

| Limitation | Details |
|-----------|---------|
| **Partner Requirements** | Must be an official LinkedIn Partner for most API features |
| **Rate Limits** | Daily limits (unpublished) reset at midnight UTC; 429 errors when exceeded |
| **Data Storage** | Cannot store profile information beyond person URNs |
| **Scope** | Only comments on your own or managed pages; cannot access competitor comments |
| **Content Types** | Text comments only; no access to reactions breakdown |
| **Application Review** | LinkedIn reviews all API applications; approval is not guaranteed |

### What's Possible vs Restricted

| Feature | Possible | Restricted |
|---------|----------|------------|
| Read comments on your pages | Yes | -- |
| Read comments on competitor pages | -- | Yes |
| Comment engagement metrics | Yes | -- |
| Commenter profile data | Limited | Full profiles |
| Historical comment data | Recent only | Full history |
| Post performance analytics | Yes (Pages API) | -- |
| Direct messaging analytics | -- | Yes |

### Assessment

| Metric | Rating |
|--------|--------|
| **API Availability** | Restricted -- requires partnership |
| **Cost** | Free (API calls), but partnership process is costly in time |
| **Legal Risk** | Low (official API) |
| **Implementation Difficulty** | 4/5 -- partnership approval is the bottleneck |
| **User Value** | 3/5 -- valuable for B2B brands, not consumer brands |
| **Comment Volume/Quality** | Low volume; professional tone, less emotional |

### Recommendation

**Low priority for MVP.** LinkedIn's comment volumes are typically low, and the sentiment signal is weaker (professional context suppresses strong emotions). The partnership requirement adds significant friction. Consider for a future "Enterprise" tier targeting B2B brands that specifically need LinkedIn analytics.

---

## 4. Reddit

### API Changes and Current Pricing

**History:** Reddit's API was completely free until June 2023, when they introduced paid tiers, causing the shutdown of many third-party clients (Apollo, RIF, etc.).

**Current Pricing:**
- **Free tier**: 100 requests/minute (OAuth), 10 requests/minute (unauthenticated), 10,000 monthly total
- **Paid tier**: $0.24 per 1,000 API calls
- Additional restrictions on data collection scope

**Rate Limits:**
- 60 requests/minute for OAuth-authenticated apps
- 10-minute rolling window tracking
- Per-OAuth-client enforcement
- 2025 update: pre-approval now required for new API applications

### Comment Analysis Opportunities

Reddit comments are exceptionally valuable for sentiment analysis:
- **Long-form opinions**: Reddit comments average 50-200 words (vs. 10-30 on other platforms)
- **Threaded discussions**: Rich context from reply chains
- **Subreddit targeting**: Analyze brand mentions in specific communities
- **Upvote/downvote signal**: Built-in community sentiment indicator
- **Public data**: All subreddit comments are public by default

**Use Cases:**
- Brand subreddit monitoring (e.g., r/iPhone, r/Tesla)
- Product launch reception analysis
- Customer complaint pattern detection
- Competitor comparison threads

### Assessment

| Metric | Rating |
|--------|--------|
| **API Availability** | Available with restrictions |
| **Cost** | ~$24/10K calls (paid) or limited free tier |
| **Legal Risk** | Low (official API) |
| **Implementation Difficulty** | 2/5 -- well-documented REST API (PRAW library for Python) |
| **User Value** | 4/5 -- rich, detailed comments with high sentiment signal |
| **Comment Volume/Quality** | Medium volume; very high quality (long, detailed, opinionated) |

### Recommendation

**Medium priority -- good value proposition.** Reddit's comment quality is exceptional for sentiment analysis. The free tier is sufficient for initial testing and small-scale analysis. Implementation is straightforward with the PRAW Python library. This could be a strong differentiator, especially for tech, gaming, and consumer electronics brands.

**Implementation approach:**
```python
import praw

reddit = praw.Reddit(
    client_id="...",
    client_secret="...",
    user_agent="SentimentIQ/1.0"
)

# Get comments from a subreddit
subreddit = reddit.subreddit("brandname")
for comment in subreddit.comments(limit=100):
    analyze_sentiment(comment.body, comment.score)
```

---

## 5. Telegram

### Business API Capabilities

**Telegram Bot API:**
- Free, well-documented API
- Create bots that can join groups/channels
- Read all messages in groups where bot has access
- No rate limits for reading (only for sending: 30 msg/sec to groups)
- Supports both public channels and private groups (with invite)

**Telegram Business Features (2025):**
- Business hours, location, quick replies
- Automated messages and chatbot support
- Available for Telegram Premium users

### Channel/Group Monitoring

| Feature | Capability |
|---------|-----------|
| Public channel messages | Full access via bot or Telethon/Pyrogram |
| Group messages | Access when bot is a member |
| User reactions | Available (emoji reactions) |
| Reply threads | Supported |
| Message editing/deletion tracking | Available |
| Media messages | Available (photos, videos, documents) |
| Historical messages | Limited backfill through API |

**Tools:**
- **Telethon**: Python MTProto library for Telegram (more powerful than Bot API)
- **Pyrogram**: Alternative Python Telegram library
- **Bot API**: Official HTTP API for bots

### Privacy Considerations

- Private group messages require bot membership (user must add bot)
- GDPR/LGPD: processing group messages has privacy implications
- User consent is needed for private groups
- Public channels: messages are publicly accessible

### Assessment

| Metric | Rating |
|--------|--------|
| **API Availability** | Excellent -- free, well-documented |
| **Cost** | Free |
| **Legal Risk** | Low for public channels; Medium for private groups |
| **Implementation Difficulty** | 2/5 -- excellent Python libraries |
| **User Value** | 2/5 -- niche (Telegram is popular in crypto, tech, some regions) |
| **Comment Volume/Quality** | Variable; can be very high in active groups |

### Recommendation

**Low priority for MVP.** Telegram has a smaller addressable market compared to YouTube/Instagram/TikTok. However, it is extremely easy to implement and free. Could be a "nice to have" feature that appeals to specific niches (crypto communities, tech channels, PT-BR Telegram groups which are popular in Brazil).

---

## 6. WhatsApp Business

### Business API Capabilities (2025)

**WhatsApp Business Platform:**
- Cloud API (hosted by Meta) and On-Premises API
- Send/receive messages, rich media, interactive buttons
- Groups API launched October 2025: manage group conversations at scale
- Webhook notifications for incoming messages
- Message templates for outbound

**Groups API Features (New 2025):**
- Create and manage groups programmatically
- Monitor new members, removals, group info changes
- Receive all messages shared in groups
- Automated responses and message scheduling

### Sentiment Monitoring Possibilities

| Feature | Feasibility |
|---------|------------|
| Customer support chat sentiment | High -- direct customer interactions |
| Group conversation monitoring | Medium -- requires group setup |
| Broadcast channel feedback | Low -- one-way communication |
| Voice message transcription | Medium -- requires ASR pipeline |

### Limitations

- **No access to personal/external WhatsApp groups** -- only business-managed groups
- **Conversation-based pricing**: Meta charges per 24-hour conversation window
  - Marketing: $0.025-0.06/conversation
  - Utility: $0.01-0.03/conversation
  - Service (user-initiated): $0.005-0.02/conversation
- **No bulk historical data access** -- only real-time message flow
- **Phone number required** for business account
- **Template approval** needed for outbound messages

### Assessment

| Metric | Rating |
|--------|--------|
| **API Availability** | Available via Meta Business Platform |
| **Cost** | Per-conversation pricing ($0.005-0.06/conversation) |
| **Legal Risk** | Low (official API with user consent) |
| **Implementation Difficulty** | 3/5 -- Meta review process, webhook infrastructure |
| **User Value** | 3/5 -- valuable for customer service teams |
| **Comment Volume/Quality** | Low-medium; but very honest/direct feedback |

### Recommendation

**Not recommended for MVP.** WhatsApp Business API is designed for customer communication, not social media monitoring. The sentiment data available is limited to business-managed conversations. This is more of an integration for "customer support sentiment" rather than "social media sentiment." Could be valuable in a future "Customer Voice" product expansion.

---

## 7. Threads (Meta)

### API Availability

**Status:** The Threads API launched on June 18, 2024, and has been expanding throughout 2025.

**Key Milestones:**
- June 2024: Initial launch with basic posting and profile endpoints
- July 2025: Major API expansion with comprehensive developer tools
- September 2025: Profiles without linked Instagram accounts can use API
- October 2025: GIF support added; advertising integration launched

### Available Endpoints

| Endpoint | Capability |
|----------|-----------|
| **Publishing** | Create text, image, video, carousel posts |
| **Media Management** | Retrieve media, manage published content |
| **Reply Management** | Read and manage replies, control reply audience |
| **User Profiles** | Fetch user info including verification status |
| **Insights** | Post-level and account-level analytics |
| **Webhooks** | Real-time notifications for comments/replies |

### Integration Potential

**Strong advantage for SentimentIQ:**
- We already have Instagram OAuth via Meta Developer App
- Threads API uses the same Meta Business Platform
- Authentication can be shared between Instagram and Threads
- Same Meta App can access both platforms

**What We Can Analyze:**
- Replies to user's Threads posts (direct sentiment on content)
- Engagement metrics (likes, reposts, quotes)
- Reply threads and conversation chains
- Post performance over time

### Assessment

| Metric | Rating |
|--------|--------|
| **API Availability** | Good -- official API with expanding features |
| **Cost** | Free (part of Meta Platform) |
| **Legal Risk** | Very Low (official API, same Meta auth we already use) |
| **Implementation Difficulty** | 1/5 -- same Meta ecosystem we already use |
| **User Value** | 3/5 -- growing platform; X/Twitter alternative |
| **Comment Volume/Quality** | Medium; similar to Twitter-style short posts |

### Recommendation

**High priority -- quick win.** Since we already have Meta Developer App and Instagram OAuth, adding Threads support requires minimal effort. The API is free and well-documented. This is the easiest new platform to add and provides immediate value to users who are already on Instagram. Implementation could reuse much of our existing Instagram connection flow.

**Implementation approach:**
- Extend existing Instagram OAuth scope to include Threads permissions
- Create new `ThreadsService` in backend, reusing `InstagramService` patterns
- Add Threads as a connection type in the frontend

---

## 8. Platform Comparison Matrix

### Quick Reference

| Platform | API Quality | Cost/Mo | Legal Risk | Impl. Difficulty | User Value | **Priority** |
|----------|------------|---------|------------|-----------------|------------|-------------|
| **Threads** | Good | Free | Very Low | 1/5 | 3/5 | **P0 -- Quick Win** |
| **TikTok** | Limited | $50-500 | Medium | 3/5 | 5/5 | **P1 -- High Value** |
| **Reddit** | Good | Free-$24/10K | Low | 2/5 | 4/5 | **P2 -- Good ROI** |
| **Twitter/X** | Good | $200-5,000 | Low | 2/5 | 4/5 | **P4 -- Too Expensive** |
| **Telegram** | Excellent | Free | Low | 2/5 | 2/5 | **P3 -- Niche** |
| **LinkedIn** | Restricted | Free* | Low | 4/5 | 3/5 | **P5 -- Enterprise Only** |
| **WhatsApp** | Limited scope | Per-msg | Low | 3/5 | 3/5 | **P6 -- Different Product** |

*LinkedIn requires partnership approval

### Recommended Expansion Roadmap

```
Phase 1 (Month 1):     Threads -- leverage existing Meta auth
Phase 2 (Month 2-3):   TikTok -- via third-party data provider
Phase 3 (Month 3-4):   Reddit -- direct API integration with PRAW
Phase 4 (Month 6+):    Twitter/X -- only if pricing improves or customer demands
Phase 5 (Enterprise):  LinkedIn -- for B2B-focused customers
```

### Revenue Impact Estimation

| Platform | Addressable Users | Pricing Potential | Revenue Impact |
|----------|------------------|-------------------|---------------|
| Current (YT + IG) | Base | Included | -- |
| + Threads | +15% users | Included (free to add) | Low incremental |
| + TikTok | +40% users | Premium feature ($10-20/mo extra) | High |
| + Reddit | +20% users | Included or freemium | Medium |
| + Twitter/X | +25% users | Premium ($20-30/mo to cover API cost) | Medium-High |
