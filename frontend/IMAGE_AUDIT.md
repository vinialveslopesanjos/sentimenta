# Image & Thumbnail Audit — Sentimenta Frontend

**Date:** 2026-03-03

---

## 1. Backend: Thumbnail Proxy Endpoint

**File:** `/opt/sentimenta/backend/app/routers/posts.py` (line 70-79)

```python
@router.get("/thumbnail")
def get_thumbnail_proxy(url: str = Query(..., min_length=5)):
    cached = cache_remote_image(url)
    if not cached or not cached.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(cached, media_type="image/*", headers={"Cache-Control": "public, max-age=604800"})
```

- Endpoint: `GET /api/v1/posts/thumbnail?url=<encoded_url>`
- Caches the remote image locally, serves it as a proxied file
- Returns 404 if download fails (no auth required on this endpoint)

---

## 2. Backend: How Images Are Stored

| Model | Field | Storage |
|---|---|---|
| `Post` | `media_urls` (JSON) | Dict with keys `url`, `thumbnail_url` |
| `SocialConnection` | `profile_image_url` (string) | Direct URL from platform API |

`thumbnail_url` is extracted from `media_urls` dict in dashboard router:
```python
p.media_urls.get("thumbnail_url") or p.media_urls.get("url")
```

---

## 3. Page-by-Page Audit

| # | Page | File | Image Type | Source Pattern | Proxy Used? | Fallback |
|---|---|---|---|---|---|---|
| 1 | Dashboard | `dashboard/page.tsx` | **Profile photo** (ConnectionCard) | `/api/v1/posts/thumbnail?url=<conn.profile_image_url>` | YES | Platform icon SVG (`/icons/instagram.svg` etc.) |
| 1 | Dashboard | `dashboard/page.tsx` | **Post thumbnail** (RecentPostItem) | `buildThumbnailSrc(post.thumbnail_url)` -> `/api/v1/posts/thumbnail?url=<url>` | YES | Material icon (`play_circle` or `image`) |
| 2 | Connection Detail | `dashboard/connection/[id]/page.tsx` | **Profile photo** (header) | `/api/v1/posts/thumbnail?url=<conn.profile_image_url>` | YES | Platform icon via `platformIcon()` |
| 2 | Connection Detail | `dashboard/connection/[id]/page.tsx` | **Post thumbnail** (post list) | `buildThumbnailSrc(post.thumbnail_url)` -> `/api/v1/posts/thumbnail?url=<url>` | YES | Material icon (`play_circle` or `image`) with `onError` fallback |
| 3 | Connect Profiles | `connect/page.tsx` | **Profile photo** (connected list) | `/api/v1/posts/thumbnail?url=<conn.profile_image_url>` | YES | `PlatformIcon` SVG component |
| 3 | Connect Profiles | `connect/page.tsx` | **Profile preview** (check result) | `potentials[p.id].profile_pic_url` **DIRECT URL** | **NO** | Empty `<div>` with bg-slate-200 |
| 4 | Compare | `compare/page.tsx` | **Profile photo** (score cards) | `/api/v1/posts/thumbnail?url=<c.profile_image_url>` | YES | **NONE** — renders nothing if null |
| 5 | Post Detail | `posts/[id]/page.tsx` | **Platform icon** only | `platformIcon(post.platform)` | N/A | No post thumbnail or profile photo shown |
| 6 | Logs | `logs/page.tsx` | **Platform icon** only | `platformIcon(run.platform)` | N/A | No images — only SVG icons |
| 7 | Settings | `settings/page.tsx` | **User avatar** | `user.avatar_url` **DIRECT URL** | **NO** | None visible in code |

---

## 4. Inconsistencies Found

### CRITICAL

1. **Connect page — profile preview uses direct URL (line 227)**
   - `potentials[p.id].profile_pic_url` is rendered as `<img src={...}>` directly
   - This bypasses the proxy and will break if the platform blocks hotlinking (Instagram CDN URLs expire)
   - **Fix:** Route through `/api/v1/posts/thumbnail?url=...`

2. **Settings page — user avatar uses direct URL (line 199)**
   - `user.avatar_url` rendered directly without proxy
   - Depending on avatar source (Google OAuth, etc.) this may or may not break
   - **Fix:** Route through proxy if URL is external, or keep as-is if it's a stable provider

### MODERATE

3. **Compare page — no fallback when profile_image_url is null (line 254-255)**
   - If `profile_image_url` is null, nothing renders (no icon, no placeholder)
   - All other pages show a platform icon as fallback
   - **Fix:** Add platform icon fallback like dashboard/connect pages

4. **Post Detail page — no post thumbnail shown**
   - Unlike dashboard and connection detail, the post detail page does not display the post's thumbnail image
   - This is arguably a feature gap rather than an inconsistency

### MINOR

5. **`buildThumbnailSrc` is duplicated in two files**
   - Defined identically in `dashboard/page.tsx` (line 31) and `dashboard/connection/[id]/page.tsx` (line 54)
   - **Fix:** Extract to a shared utility (e.g., `lib/helpers.ts`)

6. **Fallback styles differ slightly between pages**
   - Dashboard ConnectionCard uses `/icons/instagram.svg` static files
   - Connect page uses inline `<svg>` components (`PlatformIcon`)
   - Connection detail uses `platformIcon()` from `lib/helpers`
   - Three different approaches for the same visual result
   - **Fix:** Standardize on one approach (recommend `platformIcon()` from helpers)

---

## 5. Recommended Fixes

### Priority 1 — Fix proxy bypass

```tsx
// connect/page.tsx line 227 — change:
<img src={potentials[p.id].profile_pic_url} .../>
// to:
<img src={`/api/v1/posts/thumbnail?url=${encodeURIComponent(potentials[p.id].profile_pic_url)}`} .../>
```

### Priority 2 — Add missing fallback on compare page

```tsx
// compare/page.tsx line 254-255 — change:
{c.profile_image_url ? (
  <img src={`/api/v1/posts/thumbnail?url=...`} ... />
) : null}
// to:
{c.profile_image_url ? (
  <img src={`/api/v1/posts/thumbnail?url=...`} ... />
) : (
  <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
    {platformIcon(c.platform)}
  </div>
)}
```

### Priority 3 — Extract shared utility

```ts
// lib/image.ts
const API_URL = "/api/v1";

export function proxyImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return `${API_URL}/posts/thumbnail?url=${encodeURIComponent(url)}`;
  }
  return url;
}
```

Then replace all inline `buildThumbnailSrc` and manual `encodeURIComponent` calls with `proxyImageUrl()`.

### Priority 4 — Standardize platform icon fallback

Pick one approach (recommend `platformIcon()` from `lib/helpers.ts`) and use it everywhere. Remove `/icons/*.svg` static files and the inline `PlatformIcon` component from connect page.

---

## Summary

| Pattern | Pages Using It | Status |
|---|---|---|
| Proxy via `/api/v1/posts/thumbnail?url=` | Dashboard, Connection Detail, Connect (list), Compare | CORRECT |
| Direct external URL | Connect (preview), Settings (avatar) | NEEDS FIX |
| Platform icon fallback when no image | Dashboard, Connection Detail, Connect (list) | CORRECT |
| No fallback when no image | Compare | NEEDS FIX |
| `buildThumbnailSrc()` helper | Dashboard, Connection Detail | DUPLICATED |
