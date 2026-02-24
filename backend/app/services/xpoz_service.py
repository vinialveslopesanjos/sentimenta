import json
import logging
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
            prof[k.strip()] = v.strip().strip('"')
            
    return prof
