# SentimentIQ - Information Architecture

> Last updated: February 2026
> Version: 1.0

---

## Table of Contents

1. [Current Navigation Structure](#current-navigation-structure)
2. [Proposed Navigation Structure](#proposed-navigation-structure)
3. [Detailed Changes and Rationale](#detailed-changes-and-rationale)
4. [Content Hierarchy](#content-hierarchy)
5. [Key User Flows](#key-user-flows)
6. [Page Naming Conventions](#page-naming-conventions)
7. [Mobile Considerations](#mobile-considerations)
8. [Component Architecture](#component-architecture)
9. [Implementation Roadmap](#implementation-roadmap)

---

## Current Navigation Structure

Based on analysis of the existing codebase (`frontend/app/` directory and `(dashboard)/layout.tsx`), the current navigation and page structure is:

```
SentimentIQ (current)
│
├── / (Landing Page)
│   └── Public marketing page with CTA to login/register
│
├── /login (Auth Page)
│   └── Email+password login OR Google OAuth
│   └── Register option on same page
│
├── SIDEBAR NAVIGATION (authenticated):
│   ├── Dashboard (/dashboard)
│   │   └── General overview: KPIs, sentiment donut, trend chart, AI health report
│   │   └── Connected platforms list with sync buttons
│   │   └── Recent posts preview
│   │
│   ├── Conexoes (/connect)
│   │   └── Connect YouTube (handle input)
│   │   └── Connect Instagram (OAuth flow)
│   │   └── Manage existing connections
│   │
│   └── Logs (/logs)
│       └── Pipeline run history with status/details
│
├── NESTED PAGES (not in sidebar):
│   ├── /dashboard/connection/[id]
│   │   └── Per-connection dashboard: KPIs, trends, emotions, topics, engagement
│   │   └── Posts list for this connection
│   │   └── Comments table with filters
│   │
│   └── /posts/[id]
│       └── Post detail with comments and analysis
│
└── USER MENU (sidebar footer):
    └── User avatar + name + email
    └── Logout button ("Sair")
```

### Current Sidebar Navigation Items

From `frontend/app/(dashboard)/layout.tsx`:
```typescript
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/connect", label: "Conexoes", icon: "link" },
  { href: "/logs", label: "Logs", icon: "terminal" },
];
```

### Observations on Current Structure

**Strengths:**
- Simple 3-item sidebar is clean and not overwhelming.
- Dashboard as the entry point is correct (most important page).
- The connection detail page (`/dashboard/connection/[id]`) is properly nested under dashboard.
- Post detail page (`/posts/[id]`) is accessible from both the general and connection dashboards.

**Weaknesses:**
- Only 3 navigation items -- missing dedicated sections for Analytics, Posts, Comments, and Settings.
- The "Logs" label is developer-facing, not user-friendly. Most users do not think in terms of "pipeline logs."
- There is no Settings or Profile page.
- There is no dedicated Comments explorer at the top level.
- The connection management and connection analytics are in different sections (Connections page vs Dashboard/connection/[id]).
- No breadcrumb navigation for nested pages.
- Posts page is not accessible from the sidebar; only reachable from dashboard cards.
- Mobile navigation is not implemented (the sidebar is fixed 224px wide with no collapse).

---

## Proposed Navigation Structure

```
SentimentIQ (proposed)
│
├── / (Landing Page)                           [PUBLIC]
│   ├── Hero section with product demo
│   ├── Feature highlights
│   ├── Pricing section
│   ├── Social proof / testimonials
│   └── CTA: Sign up free
│
├── /login                                      [PUBLIC]
│   └── Login (email/password + Google OAuth)
│   └── Register tab/toggle
│
├── SIDEBAR NAVIGATION (authenticated):
│   │
│   ├── Dashboard (/dashboard)                  [LEVEL 1]
│   │   ├── General Summary (KPIs, donut, trend)
│   │   ├── AI Health Report
│   │   ├── Platform cards with quick scores
│   │   └── Recent posts feed
│   │
│   ├── Connections (/connections)              [NEW URL]
│   │   ├── Connection List (manage, add, delete)
│   │   └── /connections/[id]                   [LEVEL 2]
│   │       ├── Connection Dashboard (KPIs, charts)
│   │       ├── Posts tab
│   │       └── Comments tab
│   │
│   ├── Analytics (/analytics)                  [NEW]
│   │   ├── Trends (cross-connection trends)
│   │   ├── Comparisons (side-by-side)
│   │   └── Reports (AI Health Reports archive)
│   │
│   ├── Comments (/comments)                    [NEW]
│   │   └── Global comment explorer
│   │   └── Filters: connection, post, sentiment, emotion, date
│   │   └── Search functionality
│   │
│   ├── Activity (/activity)                    [RENAMED from Logs]
│   │   └── Sync history with status
│   │   └── Error details
│   │   └── Usage metrics
│   │
│   └── Settings (/settings)                    [NEW]
│       ├── Profile (/settings/profile)
│       │   └── Name, email, avatar, password change
│       ├── Notifications (/settings/notifications)
│       │   └── Email alerts, threshold configuration
│       └── Billing (/settings/billing)
│           └── Current plan, upgrade, invoices
│
├── NESTED PAGES:
│   ├── /connections/[id]                       [Connection Detail]
│   └── /posts/[id]                             [Post Detail]
│
└── USER MENU (sidebar footer):
    ├── User avatar + name
    ├── Quick settings link
    └── Logout
```

### Proposed Sidebar Navigation Items

```typescript
const navItems = [
  { href: "/dashboard",   label: "Dashboard",   icon: "LayoutDashboard" },
  { href: "/connections",  label: "Connections",  icon: "Link" },
  { href: "/analytics",   label: "Analytics",    icon: "BarChart3" },
  { href: "/comments",    label: "Comments",     icon: "MessageSquare" },
  { href: "/activity",    label: "Activity",     icon: "Clock" },
  { href: "/settings",    label: "Settings",     icon: "Settings" },
];
```

---

## Detailed Changes and Rationale

### Change 1: Rename "Conexoes" to "Connections" and change URL

| Aspect | Current | Proposed | Rationale |
|--------|---------|----------|-----------|
| Label | "Conexoes" | "Connections" | English UI consistency (if targeting international market) |
| URL | `/connect` | `/connections` | Noun-based URL is RESTful and standard |
| Scope | Add + manage connections | Add + manage + view connection detail | Consolidate connection-related pages |

Currently, the Connection Dashboard lives under `/dashboard/connection/[id]`. This is confusing because users navigate to "Dashboard" and then end up in a connection-specific view. Moving connection detail views to `/connections/[id]` makes the information architecture more intuitive:

- `/connections` = list and manage all connections
- `/connections/[id]` = deep dive into one connection

### Change 2: Add "Analytics" Section

| Feature | Current Location | Proposed Location |
|---------|-----------------|-------------------|
| Sentiment trends | General Dashboard (embedded) | Analytics > Trends (dedicated view) |
| Cross-connection comparison | Does not exist | Analytics > Comparisons (new) |
| AI Health Reports | General Dashboard (embedded) | Analytics > Reports (archive of past reports) |

The Analytics section provides a dedicated space for deep analysis that goes beyond the daily dashboard check. This serves Ricardo (agency analyst) who needs detailed trend analysis and Marina (SM manager) who needs to build reports.

### Change 3: Add "Comments" Top-Level Page

Currently, the Comments Table is embedded within the Connection Dashboard. There is no way to explore comments across all connections. A top-level Comments page addresses:

- Marina's need to quickly find negative comments across all accounts.
- Ricardo's need to search for specific keywords across all client accounts.
- Luana's need to filter comments by sentiment to manage emotional exposure.

### Change 4: Rename "Logs" to "Activity"

| Aspect | Current | Proposed | Rationale |
|--------|---------|----------|-----------|
| Label | "Logs" | "Activity" | User-friendly language; "logs" is developer jargon |
| URL | `/logs` | `/activity` | Matches new terminology |
| Content | Pipeline run history | Sync history + usage metrics | Expanded scope |

### Change 5: Add "Settings" Section

No settings page currently exists. Users cannot:
- Change their name or password
- Configure notification preferences
- View their billing/subscription status

This is a critical gap for any SaaS application.

---

## Content Hierarchy

### Level 0: Global Elements (Always Visible)

```
+------------------+------------------------------------------+
|  SIDEBAR (56px)  |            MAIN CONTENT AREA             |
|                  |                                          |
|  Logo            |  [Breadcrumb: Dashboard > Connection]    |
|                  |                                          |
|  Navigation      |  [Page Title]                            |
|  - Dashboard     |                                          |
|  - Connections   |  [Primary Content]                       |
|  - Analytics     |  - KPI cards                             |
|  - Comments      |  - Charts                                |
|  - Activity      |  - Tables                                |
|  - Settings      |  - Reports                               |
|                  |                                          |
|  User Menu       |                                          |
|  - Avatar/Name   |                                          |
|  - Logout        |                                          |
+------------------+------------------------------------------+
```

### Level 1: Dashboard (Overview)

```
[Dashboard]
├── KPI Cards Row (4 cards)
│   ├── Total Connections
│   ├── Total Posts
│   ├── Total Comments (X analyzed)
│   └── Average Sentiment Score
├── Sentiment Donut + AI Health Report (2-column)
├── Sentiment Trend Chart (full width, with granularity selector)
├── Connected Platforms (cards with sync buttons)
└── Recent Posts (list with links to detail)
```

### Level 2: Connection Detail

```
[Connection: @username (Platform)]
├── Back Navigation (breadcrumb)
├── Connection Header (avatar, name, followers, last sync)
├── KPI Cards Row (6 cards: score, weighted, polarity, comments, views, likes)
├── Sentiment Trend Chart (with granularity)
├── Emotions + Topics Charts (2-column)
├── Sentiment Distribution + Engagement (2-column)
├── Posts List (links to post detail)
└── Comments Table (with filters and search)
```

### Level 3: Post Detail

```
[Post: "Post title or preview..."]
├── Back Navigation (to connection or posts list)
├── Post Metadata (platform, date, likes, comments, views, URL)
├── Post Content (text, link to original)
├── Sentiment Summary (if analyzed)
│   ├── Average score
│   ├── Distribution breakdown
│   └── Top emotions and topics
└── Comments List (with individual analysis per comment)
    └── Per comment: text, author, sentiment score, emotions, topics, sarcasm flag
```

---

## Key User Flows

### Flow 1: First-Time Onboarding

```
LANDING PAGE
    │ Click "Sign Up Free"
    v
LOGIN/REGISTER PAGE
    │ Register with email or Google OAuth
    v
DASHBOARD (empty state)
    │ Sees "Connect your first account" CTA
    │ Click "Connect"
    v
CONNECTIONS PAGE
    │ Choose YouTube or Instagram
    │ Enter handle / complete OAuth
    v
CONNECTIONS PAGE (account added)
    │ Auto-sync triggers (proposed) OR click "Sync"
    v
SYNC IN PROGRESS
    │ Progress indicator shows scraping + analysis stages
    │ "Analyzing 142 comments... ~2 min remaining"
    v
DASHBOARD (populated)
    │ KPIs, sentiment donut, trend chart visible
    │ "Aha!" moment -- user sees real data
    v
ONBOARDING TOOLTIPS (proposed)
    │ "This is your sentiment score" / "Click here for details"
    v
CONNECTION DETAIL (optional)
    │ User clicks on their connection card
    │ Deep dive into emotions, topics, comments
    v
RETURN NEXT DAY (retention)
```

**Critical metrics for this flow:**
- Time from registration to first populated dashboard: target < 5 minutes
- Completion rate through the full flow: target > 70%

### Flow 2: Daily Sentiment Check (Marina)

```
OPEN APP (bookmark or direct URL)
    │ Lands on Dashboard (default page)
    v
SCAN KPI CARDS
    │ Check overall sentiment score
    │ Check total comments analyzed
    v
DECISION POINT: Score normal?
    │
    ├── YES: Quick scan of trend chart -> Done (2 min session)
    │
    └── NO (score dropped):
        │ Click on the connection with the issue
        v
        CONNECTION DETAIL
            │ Review sentiment trend for this connection
            │ Check emotion chart (is anger spiking?)
            v
        COMMENTS TABLE (filtered: negative)
            │ Read top negative comments
            │ Identify the issue
            v
        TAKE ACTION (external)
            │ Respond to comments on platform
            │ Escalate to team if needed
            v
        RETURN TO DASHBOARD
            │ Trigger re-sync after addressing the issue
```

**Critical metrics for this flow:**
- Time to identify a sentiment problem: target < 3 minutes
- Clicks from dashboard to negative comments: target 3 clicks or fewer

### Flow 3: Monthly Report Generation (Ricardo)

```
OPEN APP
    │
    v
ANALYTICS > REPORTS (proposed)
    │ Generate new AI Health Report for Client A
    v
AI HEALTH REPORT
    │ Review AI-generated insights
    │ Note key metrics and recommendations
    v
CONNECTION DETAIL (Client A)
    │ Set date range: last 30 days
    │ Review: sentiment trend, emotions, topics
    │ Note: avg score, distribution %, top topics
    v
EXPORT (proposed)
    │ Export dashboard as PDF
    │ Export specific charts as PNG
    v
REPEAT FOR CLIENTS B, C, D...
    │ Switch connections from sidebar or connections list
    v
ANALYTICS > COMPARISONS (proposed)
    │ Compare all clients side-by-side
    │ Identify best/worst performers
    v
COMPILE REPORT (external)
    │ Use exported data in Google Slides / client report
    v
DONE
```

**Critical metrics for this flow:**
- Time to generate one client report section: target < 10 minutes
- Number of clicks to switch between clients: target 2 clicks

### Flow 4: Content Strategy Analysis (Luana)

```
OPEN APP (mobile or desktop)
    │
    v
DASHBOARD
    │ Quick check of overall score
    v
CONNECTION DETAIL (YouTube)
    │ Scroll to Posts list
    │ Compare sentiment scores across recent videos
    v
IDENTIFY TOP POST
    │ Click on the post with highest sentiment
    v
POST DETAIL
    │ Read AI summary of comments
    │ Note: top emotions (admiration, joy, surprise)
    │ Note: top topics ("tutorial", "beginner friendly")
    v
COMMENTS (filtered: positive)
    │ Read representative positive comments
    │ Note themes: what specifically do people love?
    v
REPEAT FOR LOWEST POST
    │ Back to posts list
    │ Click on post with lowest sentiment
    │ Note what went wrong
    v
CONTENT PLANNING (external)
    │ Plan next video based on positive-sentiment topics
    │ Avoid patterns from negative-sentiment content
```

**Critical metrics for this flow:**
- Time to identify best and worst performing content: target < 5 minutes
- Ease of comparing per-post sentiment: should be visible in the posts list

---

## Page Naming Conventions

### URL Conventions

| Pattern | Example | Rule |
|---------|---------|------|
| Top-level pages | `/dashboard`, `/connections` | Lowercase, plural nouns |
| Detail pages | `/connections/[id]` | Parent + dynamic segment |
| Nested settings | `/settings/profile` | Parent + sub-page noun |
| Action-oriented pages | `/connections/new` | Parent + action verb (proposed) |

### Page Title Conventions

| Page | Title | Breadcrumb |
|------|-------|------------|
| General Dashboard | "Dashboard" | Dashboard |
| Connection Detail | "[Platform] @[username]" | Dashboard > [Platform] @[username] |
| Post Detail | "[Post preview text...]" | Dashboard > [Platform] > Post |
| Connections List | "Connections" | Connections |
| Analytics Trends | "Trends" | Analytics > Trends |
| Comments Explorer | "Comments" | Comments |
| Activity Log | "Activity" | Activity |
| Settings Profile | "Profile" | Settings > Profile |

### Component Naming Conventions (Existing Pattern)

The codebase follows these conventions (from `frontend/components/`):

| Type | Convention | Examples |
|------|-----------|----------|
| UI primitives | Lowercase filename | `button.tsx`, `card.tsx`, `input.tsx` |
| Feature components | PascalCase filename | `CommentsTable.tsx`, `SyncButton.tsx`, `AIHealthReport.tsx` |
| Chart components | PascalCase in `charts/` folder | `SentimentDonut.tsx`, `EmotionChart.tsx` |
| Animation components | PascalCase in `animations/` folder | `PageTransition.tsx`, `FadeIn.tsx` |
| Pages | `page.tsx` in route directory | `app/(dashboard)/dashboard/page.tsx` |
| Layouts | `layout.tsx` in route directory | `app/(dashboard)/layout.tsx` |

---

## Mobile Considerations

### Current State

The current layout uses a **fixed 224px (w-56) sidebar** that does not collapse on mobile. The main content area uses `max-w-6xl` (1152px) which works on desktop but creates a poor experience on mobile devices.

From `layout.tsx`:
```html
<div className="min-h-screen flex">
  <aside className="w-56 border-r border-border flex flex-col">
  <!-- Fixed sidebar, no responsive behavior -->
```

### Proposed Mobile Layout

#### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Bottom tab navigation, stacked content |
| Tablet | 768px - 1024px | Collapsible sidebar, 2-column grids |
| Desktop | > 1024px | Fixed sidebar, multi-column grids |

#### Mobile Navigation (Bottom Tabs)

On screens below 768px, replace the sidebar with a bottom tab bar:

```
+-------------------------------------------+
|  [Page Title]                    [Avatar]  |
|-------------------------------------------|
|                                           |
|           MAIN CONTENT                    |
|           (full width, stacked)           |
|                                           |
|                                           |
+-------------------------------------------+
| [Home] [Connect] [Analytics] [More...]    |
+-------------------------------------------+
```

- **5 visible tabs**: Dashboard, Connections, Analytics, Comments, More
- **"More" menu**: Activity, Settings, Logout
- Active tab highlighted with accent color

#### Mobile Content Adaptations

| Component | Desktop | Mobile |
|-----------|---------|--------|
| KPI cards | 4-column grid | 2-column grid |
| Charts (donut, trend) | Side-by-side | Stacked vertically |
| Comments table | Full table with columns | Card layout (stacked info) |
| Connection cards | 2-column grid | Single column, full width |
| Sidebar | 224px fixed | Hidden, replaced by bottom tabs |
| Page padding | 32px (p-8) | 16px (p-4) |
| Font sizes | Standard | Slightly reduced headings |

#### Touch Targets

- All interactive elements must be minimum 44x44px (Apple HIG recommendation).
- Buttons in the sidebar/tabs must have generous padding.
- Swipe gestures could be added for switching between connections (future enhancement).

#### Mobile-Specific Features (Proposed)

1. **Pull-to-refresh** on Dashboard and Connection Detail pages.
2. **Swipe between connections** on the connection detail page.
3. **Quick-action floating button** for triggering sync.
4. **Simplified charts** that hide legends on mobile and show data on tap.
5. **Collapsible sections** on connection detail to reduce scrolling.

---

## Component Architecture

### Proposed Component Tree

```
app/
├── (public)/
│   ├── page.tsx                          (landing)
│   └── (auth)/login/page.tsx             (login/register)
│
├── (dashboard)/
│   ├── layout.tsx                        (sidebar + main content wrapper)
│   ├── dashboard/
│   │   └── page.tsx                      (general dashboard)
│   ├── connections/
│   │   ├── page.tsx                      (connections list + add)
│   │   └── [id]/page.tsx                 (connection detail dashboard)
│   ├── analytics/
│   │   ├── page.tsx                      (trends overview)
│   │   ├── comparisons/page.tsx          (side-by-side comparison)
│   │   └── reports/page.tsx              (AI report archive)
│   ├── comments/
│   │   └── page.tsx                      (global comment explorer)
│   ├── activity/
│   │   └── page.tsx                      (sync history / pipeline logs)
│   ├── posts/
│   │   └── [id]/page.tsx                 (post detail)
│   └── settings/
│       ├── page.tsx                      (redirects to profile)
│       ├── profile/page.tsx              (user profile)
│       ├── notifications/page.tsx        (alert configuration)
│       └── billing/page.tsx              (plan and invoices)

components/
├── ui/                                    (design system primitives)
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── badge.tsx
│   ├── avatar.tsx
│   ├── tooltip.tsx
│   ├── skeleton.tsx
│   ├── toast.tsx
│   ├── tabs.tsx                          (new: for settings sub-nav)
│   ├── select.tsx                        (new: for dropdowns)
│   ├── date-picker.tsx                   (new: for date ranges)
│   └── modal.tsx                         (new: for confirmations)
│
├── charts/                                (data visualization)
│   ├── SentimentDonut.tsx
│   ├── SentimentTrendChart.tsx
│   ├── EmotionChart.tsx
│   ├── TopicsChart.tsx
│   ├── EngagementChart.tsx
│   └── ComparisonChart.tsx               (new: side-by-side comparison)
│
├── layout/                                (new: layout components)
│   ├── Sidebar.tsx                       (extracted from layout.tsx)
│   ├── MobileNav.tsx                     (new: bottom tab navigation)
│   ├── Breadcrumb.tsx                    (new: navigation breadcrumbs)
│   └── PageHeader.tsx                    (new: consistent page headers)
│
├── features/                              (new: feature-specific components)
│   ├── CommentsTable.tsx                 (moved from root)
│   ├── SyncButton.tsx                    (moved from root)
│   ├── AIHealthReport.tsx                (moved from root)
│   ├── PipelineLogViewer.tsx             (moved from root)
│   ├── KPICard.tsx                       (moved from root)
│   ├── GranularitySelector.tsx           (moved from root)
│   ├── ConnectionCard.tsx                (new: reusable connection card)
│   ├── PostCard.tsx                      (new: reusable post card)
│   └── SentimentBadge.tsx               (new: sentiment score display)
│
├── animations/
│   ├── PageTransition.tsx
│   ├── FadeIn.tsx
│   └── StaggerList.tsx
│
└── hooks/                                 (custom React hooks)
    ├── useGoogleLogin.ts                 (existing)
    ├── useAuth.ts                        (new: centralized auth state)
    ├── useDashboard.ts                   (new: dashboard data fetching)
    ├── useConnection.ts                  (new: connection data fetching)
    └── useMobile.ts                      (new: mobile detection hook)
```

---

## Implementation Roadmap

### Phase 1: Foundation (1-2 Sprints)

**Goal**: Improve navigation and fix mobile experience without changing existing functionality.

| Task | Effort | Files Affected |
|------|--------|---------------|
| Extract Sidebar into its own component | Small | `layout.tsx`, new `Sidebar.tsx` |
| Add mobile responsive sidebar (collapsible/bottom tabs) | Medium | `layout.tsx`, new `MobileNav.tsx` |
| Add breadcrumb navigation | Small | New `Breadcrumb.tsx`, all pages |
| Rename "Logs" to "Activity" in sidebar | Trivial | `layout.tsx` |
| Add Settings placeholder page | Small | New `settings/page.tsx` |
| Responsive grid adjustments for all dashboard cards | Medium | Multiple page files |

### Phase 2: Navigation Restructure (2-3 Sprints)

**Goal**: Implement the proposed navigation architecture.

| Task | Effort | Files Affected |
|------|--------|---------------|
| Move connection detail from `/dashboard/connection/[id]` to `/connections/[id]` | Medium | Route structure, links |
| Create top-level Comments explorer page | Medium | New `comments/page.tsx` |
| Create Analytics section with Trends view | Medium | New `analytics/page.tsx` |
| Update all internal links to new routes | Medium | All page/component files |
| Add redirect from old URLs to new ones | Small | Next.js middleware |

### Phase 3: New Features (3-4 Sprints)

**Goal**: Build out the proposed new sections.

| Task | Effort | Files Affected |
|------|--------|---------------|
| Settings > Profile page | Medium | New `settings/profile/page.tsx`, API |
| Settings > Notifications page | Medium | New page + backend endpoints |
| Analytics > Comparisons (cross-connection) | Large | New page + backend API |
| Analytics > Reports (report archive) | Medium | New page + backend storage |
| Global comment search and advanced filters | Medium | New page, API updates |

### Phase 4: Polish (Ongoing)

| Task | Effort |
|------|--------|
| Onboarding tooltips and guided tour | Medium |
| Keyboard shortcuts | Small |
| Accessibility audit (ARIA labels, focus management) | Medium |
| Performance optimization (lazy loading, code splitting) | Medium |
| A/B testing framework for UI experiments | Large |
