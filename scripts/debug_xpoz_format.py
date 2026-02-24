"""
XPoz Full Ingest Script - carnelos.lucas (Instagram)
======================================================
DEBUG: First shows raw XPoz output to understand the actual format.
"""
import json
import time
import requests

XPOZ_TOKEN = "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4"
XPOZ_BASE_URL = "https://mcp.xpoz.ai/mcp"
TARGET_USERNAME = "carnelos.lucas"

headers = {
    "Authorization": f"Bearer {XPOZ_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

def call_mcp(name, arguments, req_id=1):
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
        "id": req_id
    }
    r = requests.post(XPOZ_BASE_URL, headers=headers, json=payload)
    for line in r.text.split('\n'):
        if line.startswith('data: '):
            return json.loads(line[6:])
    return None

def get_text(res):
    if res and "result" in res:
        content = res["result"].get("content", [])
        if content:
            return content[0].get("text", "")
    return ""

def poll_operation(op_id):
    for attempt in range(20):
        res = call_mcp("checkOperationStatus", {"operationId": op_id}, req_id=100 + attempt)
        text = get_text(res)
        if "status: running" in text or "status: pending" in text:
            print(f"  Polling [{attempt+1}]...", flush=True)
            time.sleep(5)
        else:
            return text
    return ""

# Get posts
print("Fetching posts for", TARGET_USERNAME)
posts_res = call_mcp("getInstagramPostsByUser", {
    "identifier": TARGET_USERNAME,
    "identifierType": "username",
    "count": 20
}, req_id=10)

posts_text = get_text(posts_res)
print("\n=== POSTS INITIAL RESPONSE ===")
print(posts_text[:300])

op_id = None
for line in posts_text.split('\n'):
    if 'operationId:' in line:
        op_id = line.split('operationId:')[-1].strip()
        break

if op_id:
    print(f"\nPolling op: {op_id}")
    posts_text = poll_operation(op_id)

# Save full raw output
with open("posts_raw_output.txt", "w", encoding="utf-8") as f:
    f.write(posts_text)
print("\nFull posts output saved to posts_raw_output.txt")
print("\nFirst 1000 chars of result:")
print(posts_text[:1000])
