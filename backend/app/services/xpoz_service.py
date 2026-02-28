import json
import logging
import re
import time
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)

# Fallback token if not in settings, although it should be there.
XPOZ_TOKEN = getattr(settings, "XPOZ_TOKEN", "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4")
XPOZ_BASE = "https://mcp.xpoz.ai/mcp"

def _call_mcp(name: str, arguments: dict) -> dict:
    headers = {
        "Authorization": f"Bearer {XPOZ_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
        "id": 1
    }
    try:
        r = requests.post(XPOZ_BASE, headers=headers, json=payload, timeout=30)
        r.encoding = 'utf-8'
        for line in r.text.split('\n'):
            if line.startswith('data: '):
                return json.loads(line[6:])
    except Exception as e:
        logger.error(f"XPoz _call_mcp error: {e}")
    return {}

def _get_text(res: dict) -> str:
    try:
        return res.get("result", {}).get("content", [])[0].get("text", "")
    except Exception:
        return ""

def _call_mcp_with_polling(name: str, arguments: dict, max_polls: int = 12, poll_interval: float = 5.0) -> dict:
    """Call XPoz MCP and poll for async operations that return an operationId."""
    res = _call_mcp(name, arguments)
    text = _get_text(res)

    match = re.search(r'operationId:\s*(\S+)', text)
    if not match:
        return res

    op_id = match.group(1)
    logger.info(f"XPoz async operation {op_id} for {name}, polling...")

    for i in range(max_polls):
        time.sleep(poll_interval)
        poll_res = _call_mcp("checkOperationStatus", {"operationId": op_id})
        poll_text = _get_text(poll_res)
        if "status: running" not in poll_text[:200]:
            logger.info(f"XPoz operation {op_id} completed after {i+1} polls")
            return poll_res

    logger.warning(f"XPoz operation {op_id} timed out after {max_polls} polls")
    return res

def get_instagram_profile(username: str) -> dict:
    """Gets quick profile statistics from XPoz for Instagram"""
    args = {
        "identifier": username,
        "identifierType": "username",
        "fields": [
            "id", "username", "fullName", "biography", "isPrivate", 
            "isVerified", "followerCount", "followingCount", "mediaCount", 
            "profilePicUrl", "externalUrl"
        ]
    }
    res = _call_mcp("getInstagramUser", args)
    text = _get_text(res)
    
    # Text arrives as a YAML-like string from XPoz
    prof = {}
    for line in text.split('\n'):
        s = line.strip()
        if ':' in s and not s.startswith('success') and not s.startswith('data'):
            k, _, v = s.partition(':')
            v_clean = v.strip().strip('"')
            if v_clean and v_clean != "null":
                prof[k.strip()] = v_clean
                
    # Fallback to Instaloader if critical public stats are missing or null
    try:
        follower_count = prof.get("followerCount")
        media_count = prof.get("mediaCount")
        if follower_count is None or str(follower_count) == "null" or str(media_count) == "null":
            import instaloader
            L = instaloader.Instaloader()
            ipf = instaloader.Profile.from_username(L.context, username)
            prof["followerCount"] = str(ipf.followers)
            prof["mediaCount"] = str(ipf.mediacount)
            prof["followingCount"] = prof.get("followingCount", str(ipf.followees))
            if "profilePicUrl" not in prof or str(prof["profilePicUrl"]) == "null":
                prof["profilePicUrl"] = ipf.profile_pic_url
            if "fullName" not in prof or str(prof["fullName"]) == "null":
                prof["fullName"] = ipf.full_name
            if "biography" not in prof or str(prof["biography"]) == "null":
                prof["biography"] = ipf.biography
    except Exception as e:
        logger.error(f"Instaloader fallback failed for {username}: {e}")
            
    return prof
