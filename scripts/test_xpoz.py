import sys
import asyncio
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.services.xpoz_service import _call_mcp, _get_text
from app.services.instagram_scrape_service import _parse_xpoz_list

def test_xpoz_instagram_comments():
    print("Testing Instagram comments for leandrotwin...")
    try:
        # We need a shortcode. Let's get posts first
        res = _call_mcp("getInstagramPostsByUser", {
            "username": "leandrotwin",
            "limit": 1,
            "userPrompt": "Get 1 recent post from instagram user leandrotwin"
        })
        text = _get_text(res)
        items = _parse_xpoz_list(text)
        print("Parsed posts:", len(items))
        if not items:
            print("Raw text:", text[:500])
            return
            
        shortcode = items[0].get("shortcode") or items[0].get("id")
        print("Shortcode:", shortcode)
        
        # Now get comments
        res_comments = _call_mcp("getInstagramCommentsByPostId", {
            "shortcode": shortcode,
            "limit": 5,
            "userPrompt": f"Get comments for instagram post {shortcode}"
        })
        text_comments = _get_text(res_comments)
        
        print("\nRAW COMMENTS TEXT:")
        print(text_comments)
        
        comment_items = _parse_xpoz_list(text_comments)
        print("\nPARSED COMMENTS:", len(comment_items))
        for c in comment_items:
            print(c)
            
    except Exception as e:
        print("Error:", e)

def test_twitter():
    print("\n----------------\nTesting Twitter for pivetemaromba...")
    try:
        from app.services.twitter_service import get_twitter_profile
        profile = get_twitter_profile("pivetemaromba")
        print("Twitter Profile:", profile)
        
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_xpoz_instagram_comments()
    test_twitter()
