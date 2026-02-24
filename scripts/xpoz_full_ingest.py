"""
XPoz Full Ingest Script - carnelos.lucas (Instagram)
======================================================
v2 - With proper CSV-like line parser for XPoz format.
"""

import uuid
import hashlib
import json
import time
import csv
import io
import requests
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone

# Register UUID adapter
psycopg2.extras.register_uuid()

# ─── CONFIG ──────────────────────────────────────────────────────────────────
XPOZ_TOKEN   = "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4"
XPOZ_BASE    = "https://mcp.xpoz.ai/mcp"
DB_URL       = "postgresql://sentiment:sentiment@localhost:5432/sentiment_db"
USERNAME     = "carnelos.lucas"
EXISTING_USER_ID = uuid.UUID("ebbb0d27-e896-41be-9045-0716137a5278")
MAX_POLL     = 30
POLL_SLEEP   = 6
MAX_COMM     = 50   # comments per post

# ─── XPOZ CLIENT ─────────────────────────────────────────────────────────────
xpoz_headers = {
    "Authorization": f"Bearer {XPOZ_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

_req_id = 0

def call_mcp(name, arguments):
    global _req_id
    _req_id += 1
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
        "id": _req_id
    }
    r = requests.post(XPOZ_BASE, headers=xpoz_headers, json=payload)
    r.encoding = 'utf-8'
    for line in r.text.split('\n'):
        if line.startswith('data: '):
            return json.loads(line[6:])
    return None

def get_text(res):
    try:
        return res["result"]["content"][0]["text"]
    except Exception:
        return ""

def poll(op_id):
    for i in range(MAX_POLL):
        res = call_mcp("checkOperationStatus", {"operationId": op_id})
        text = get_text(res)
        if "status: running" in text or "status: pending" in text:
            print(f"  ⏳ Polling [{i+1}/{MAX_POLL}]...", flush=True)
            time.sleep(POLL_SLEEP)
        else:
            return text
    print("  ⚠️  Poll timeout")
    return ""

def get_op_id(text):
    for line in text.split('\n'):
        if 'operationId:' in line:
            return line.split('operationId:')[-1].strip()
    return None

def fetch_and_poll(tool, args):
    res = call_mcp(tool, args)
    text = get_text(res)
    op_id = get_op_id(text)
    if op_id:
        text = poll(op_id)
    return text

# ─── PARSERS ─────────────────────────────────────────────────────────────────
def parse_posts(text):
    """
    XPoz format example line:
      3778998106370274639_461836327,"Caption text",carnelos.lucas,"2025-12-02T00:00:00.000Z"
    """
    posts = []
    lines = text.split('\n')
    for line in lines:
        line = line.strip()
        # Must start with digits (post_id pattern)
        if not line or not line[0].isdigit():
            continue
        # Skip pagination lines
        if ':' in line and not '_' in line.split(':')[0]:
            continue
        try:
            reader = csv.reader(io.StringIO(line))
            parts = next(reader)
            if len(parts) >= 4:
                post_id_raw = parts[0].strip()
                caption     = parts[1].strip() if len(parts) > 1 else ""
                uname       = parts[2].strip() if len(parts) > 2 else ""
                date_str    = parts[3].strip() if len(parts) > 3 else ""
                # post id is "3778998106370274639_461836327"
                plat_post_id = post_id_raw.split('_')[0] if '_' in post_id_raw else post_id_raw
                posts.append({
                    "id": plat_post_id,
                    "raw_id": post_id_raw,
                    "caption": caption if caption.lower() != "null" else "",
                    "username": uname,
                    "createdAt": date_str,
                })
        except Exception:
            pass
    return posts

def parse_comments(text):
    """
    Parses XPoz comment output. Comments usually come as key: value YAML blocks or as CSV.
    """
    blocks = []
    lines = text.split('\n')
    current = {}
    in_results = False

    for line in lines:
        s = line.strip()
        if 'results[' in s or s.startswith('results:'):
            in_results = True
            continue
        if not in_results:
            continue
        
        # Check if it looks like a CSV row: "123","comment text",username,...
        if len(s) > 0 and (s[0].isdigit() or s[0] == '"'):
            try:
                reader = csv.reader(io.StringIO(s))
                parts = next(reader)
                if len(parts) >= 2:
                    current = {
                        "id": parts[0].strip(),
                        "text": parts[1].strip() if len(parts) > 1 else "",
                        "ownerUsername": parts[2].strip() if len(parts) > 2 else "",
                        "timestamp": parts[3].strip() if len(parts) > 3 else ""
                    }
                    blocks.append(current)
            except Exception:
                pass
            current = {}
            continue

        # Otherwise, parse as YAML block
        if s.startswith('- ') and ':' in s:
            if current:
                blocks.append(current)
            current = {}
            s = s[2:]  # strip '- '

        if ':' in s:
            key, _, val = s.partition(':')
            key = key.strip()
            val = val.strip().strip('"')
            if key and val:
                current[key] = val

    if current:
        blocks.append(current)

    return blocks

def safe_int(v, default=0):
    try:
        return int(str(v).replace(',', '').strip())
    except Exception:
        return default

def safe_dt(v):
    if not v:
        return None
    try:
        if str(v).isdigit():
            return datetime.fromtimestamp(int(v), tz=timezone.utc)
        return datetime.fromisoformat(v.replace('Z', '+00:00'))
    except Exception:
        return None

def make_hash(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:64]

def add_col(cur, table, col, col_type):
    cur.execute(f"""
        SELECT 1 FROM information_schema.columns
        WHERE table_name='{table}' AND column_name='{col}'
    """)
    if not cur.fetchone():
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        print(f"  ✅ Added {table}.{col}")

# ─── MAIN ────────────────────────────────────────────────────────────────────
def main():
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()
    print("✅ Connected to PostgreSQL\n")

    # ── 1. Schema migration ───────────────────────────────────────────────────
    print("═══ STEP 1: Schema Migration ═══")
    # posts
    add_col(cur, "posts", "save_count",     "INTEGER DEFAULT 0")
    add_col(cur, "posts", "video_duration", "REAL")
    add_col(cur, "posts", "thumbnail_url",  "TEXT")
    add_col(cur, "posts", "is_video",       "BOOLEAN DEFAULT FALSE")
    add_col(cur, "posts", "hashtags",       "JSON")
    add_col(cur, "posts", "mentions",       "JSON")
    add_col(cur, "posts", "location_name",  "TEXT")
    add_col(cur, "posts", "ingest_source",  "VARCHAR(50) DEFAULT 'apify'")
    # social_connections
    add_col(cur, "social_connections", "following_count", "INTEGER DEFAULT 0")
    add_col(cur, "social_connections", "biography",       "TEXT")
    add_col(cur, "social_connections", "is_verified",     "BOOLEAN DEFAULT FALSE")
    add_col(cur, "social_connections", "media_count",     "INTEGER DEFAULT 0")
    add_col(cur, "social_connections", "is_private",      "BOOLEAN DEFAULT FALSE")
    add_col(cur, "social_connections", "external_url",    "TEXT")
    add_col(cur, "social_connections", "ingest_source",   "VARCHAR(50) DEFAULT 'apify'")
    # comments
    add_col(cur, "comments", "author_id_platform", "VARCHAR(255)")
    add_col(cur, "comments", "ingest_source",      "VARCHAR(50) DEFAULT 'apify'")
    conn.commit()
    print("✅ Schema done\n")

    # ── 2. Fetch profile ──────────────────────────────────────────────────────
    print("═══ STEP 2: Fetch Profile ═══")
    profile_text = fetch_and_poll("getInstagramUser", {
        "identifier": USERNAME, "identifierType": "username"
    })
    print(profile_text[:300])

    # Parse simple key: value from profile
    prof = {}
    for line in profile_text.split('\n'):
        s = line.strip()
        if ':' in s and not s.startswith('success') and not s.startswith('data'):
            k, _, v = s.partition(':')
            prof[k.strip()] = v.strip().strip('"')

    ig_user_id   = prof.get("id", "")
    full_name    = prof.get("fullName", prof.get("name", USERNAME))
    followers    = safe_int(prof.get("followersCount", 0))
    following    = safe_int(prof.get("followingCount", 0))
    bio          = prof.get("biography", "")
    is_verified  = prof.get("isVerified", "false").lower() == "true"
    is_private   = prof.get("isPrivate", "false").lower() == "true"
    media_count  = safe_int(prof.get("mediaCount", 0))
    pic_url      = prof.get("profilePicUrl", "")
    ext_url      = prof.get("externalUrl", "")
    profile_url  = f"https://www.instagram.com/{USERNAME}/"
    print(f"  ig_user_id={ig_user_id} | followers={followers} | following={following}\n")

    # ── 3. Upsert social_connection ───────────────────────────────────────────
    print("═══ STEP 3: Upsert Connection ═══")
    cur.execute(
        "SELECT id FROM social_connections WHERE platform='instagram' AND username=%s",
        (USERNAME,)
    )
    row = cur.fetchone()
    if row:
        conn_id = row[0]
        cur.execute("""
            UPDATE social_connections SET
                platform_user_id=%s, display_name=%s, followers_count=%s,
                following_count=%s, biography=%s, is_verified=%s, is_private=%s,
                media_count=%s, profile_image_url=%s, profile_url=%s,
                external_url=%s, last_sync_at=%s, raw_profile_json=%s,
                ingest_source='xpoz'
            WHERE id=%s
        """, (ig_user_id, full_name, followers, following, bio,
              is_verified, is_private, media_count, pic_url,
              profile_url, ext_url, datetime.now(timezone.utc),
              json.dumps(prof), conn_id))
        print(f"  Updated: {conn_id}")
    else:
        conn_id = uuid.uuid4()
        cur.execute("""
            INSERT INTO social_connections
                (id, user_id, platform, platform_user_id, username, display_name,
                 followers_count, following_count, biography, is_verified, is_private,
                 media_count, profile_url, profile_image_url, external_url,
                 status, raw_profile_json, ingest_source, connected_at, last_sync_at)
            VALUES (%s,%s,'instagram',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                    'active',%s,'xpoz',%s,%s)
        """, (conn_id, EXISTING_USER_ID, ig_user_id, USERNAME, full_name,
              followers, following, bio, is_verified, is_private, media_count,
              profile_url, pic_url, ext_url,
              json.dumps(prof),
              datetime.now(timezone.utc), datetime.now(timezone.utc)))
        print(f"  Created: {conn_id}")
    conn.commit()

    # ── 4. Fetch posts ────────────────────────────────────────────────────────
    print("\n═══ STEP 4: Fetch All Posts ═══")
    posts_text = fetch_and_poll("getInstagramPostsByUser", {
        "identifier": USERNAME,
        "identifierType": "username",
        "count": 100
    })
    posts_raw = parse_posts(posts_text)
    print(f"  Parsed {len(posts_raw)} posts\n")

    # ── 5. Upsert posts ───────────────────────────────────────────────────────
    print("═══ STEP 5: Upsert Posts ═══")
    post_id_map = {}

    for p in posts_raw:
        plat_id  = p["id"]
        raw_id   = p.get("raw_id", plat_id)
        caption  = p.get("caption", "") or ""
        pub_at   = safe_dt(p.get("createdAt", ""))
        hashtags = [w for w in caption.split() if w.startswith('#')]
        mentions = [w for w in caption.split() if w.startswith('@')]
        shortcode_guess = raw_id  # use raw_id as post identifier
        post_url = f"https://www.instagram.com/p/XPOZ_{plat_id}/"

        cur.execute(
            "SELECT id FROM posts WHERE connection_id=%s AND platform_post_id=%s",
            (conn_id, plat_id)
        )
        existing = cur.fetchone()

        if existing:
            post_uuid = existing[0]
            cur.execute("""
                UPDATE posts SET
                    content_text=%s, content_clean=%s, published_at=%s,
                    hashtags=%s, mentions=%s, ingest_source='xpoz',
                    fetched_at=%s, raw_payload=%s
                WHERE id=%s
            """, (caption, caption, pub_at,
                  json.dumps(hashtags), json.dumps(mentions),
                  datetime.now(timezone.utc), json.dumps(p),
                  post_uuid))
            print(f"  ↺  Updated  {plat_id[:20]}...")
        else:
            post_uuid = uuid.uuid4()
            cur.execute("""
                INSERT INTO posts
                    (id, connection_id, platform, platform_post_id, post_type,
                     content_text, content_clean, media_urls, like_count, comment_count,
                     share_count, view_count, save_count, published_at, post_url,
                     raw_payload, fetched_at, is_video, hashtags, mentions, ingest_source)
                VALUES (%s,%s,'instagram',%s,'post',%s,%s,NULL,0,0,0,0,0,%s,%s,%s,%s,FALSE,%s,%s,'xpoz')
            """, (post_uuid, conn_id, plat_id,
                  caption, caption,
                  pub_at, post_url,
                  json.dumps(p), datetime.now(timezone.utc),
                  json.dumps(hashtags), json.dumps(mentions)))
            print(f"  ✅ Inserted {plat_id[:20]}...  caption={caption[:40]!r}")

        post_id_map[plat_id] = post_uuid

    conn.commit()
    print(f"\n✅ Posts done: {len(post_id_map)}\n")

    # ── 6. Fetch & ingest comments per post ───────────────────────────────────
    print("═══ STEP 6: Fetch Comments ═══")
    total_comments = 0

    for plat_post_id, post_uuid in list(post_id_map.items())[:30]:  # limit to 30 posts to save credits
        print(f"\n  Post {plat_post_id}:")
        comments_text = fetch_and_poll("getInstagramCommentsByPostId", {
            "postId": plat_post_id,
            "count": MAX_COMM
        })

        raw_comments = parse_comments(comments_text)
        print(f"    {len(raw_comments)} comments")

        for c in raw_comments:
            c_text = c.get("text", "")
            if not c_text:
                continue

            c_id     = c.get("id", make_hash(f"{plat_post_id}_{c_text}"))
            c_hash   = make_hash(c_text)
            c_author = c.get("ownerUsername", c.get("username", ""))
            c_name   = c.get("ownerFullName", c_author)
            c_uid    = c.get("ownerId", "")
            c_likes  = safe_int(c.get("likesCount", 0))
            c_rep    = safe_int(c.get("repliesCount", 0))
            c_at     = safe_dt(c.get("timestamp", c.get("createdAt", "")))

            cur.execute(
                "SELECT id FROM comments WHERE post_id=%s AND platform_comment_id=%s",
                (post_uuid, c_id)
            )
            if not cur.fetchone():
                try:
                    cur.execute("""
                        INSERT INTO comments
                            (id, post_id, connection_id, platform, platform_comment_id,
                             source_type, author_name, author_username, author_id_platform,
                             like_count, reply_count, published_at,
                             text_original, text_clean, text_hash,
                             raw_payload, status, ingest_source, created_at)
                        VALUES (%s,%s,%s,'instagram',%s,'comment',%s,%s,%s,
                                %s,%s,%s,%s,%s,%s,%s,'pending','xpoz',%s)
                    """, (uuid.uuid4(), post_uuid, conn_id, c_id,
                          c_name, c_author, c_uid,
                          c_likes, c_rep, c_at,
                          c_text, c_text, c_hash,
                          json.dumps(c), datetime.now(timezone.utc)))
                    total_comments += 1
                except Exception as e:
                    conn.rollback()
                    print(f"      ⚠️  {e}")

        conn.commit()
        time.sleep(0.5)

    # ── 7. Summary ────────────────────────────────────────────────────────────
    print("\n\n════════════════════════════════════════")
    print("  ✅ INGEST COMPLETE")
    print(f"  connection_id : {conn_id}")
    print(f"  Posts upserted: {len(post_id_map)}")
    print(f"  Comments added: {total_comments}")
    print("════════════════════════════════════════")

    cur.execute("SELECT COUNT(*) FROM posts WHERE connection_id=%s", (conn_id,))
    print(f"  DB posts  for @{USERNAME}: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM comments WHERE connection_id=%s", (conn_id,))
    print(f"  DB comments for @{USERNAME}: {cur.fetchone()[0]}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
