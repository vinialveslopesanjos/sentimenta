import requests
import json
import time

XPOZ_TOKEN = "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4"
XPOZ_BASE = "https://mcp.xpoz.ai/mcp"

xpoz_headers = {
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
    for i in range(10):
        res = call_mcp("checkOperationStatus", {"operationId": op_id}, req_id=100+i)
        text = get_text(res)
        if "status: running" in text or "status: pending" in text:
            print(f"  Polling [{i+1}]...", flush=True)
            time.sleep(5)
        else:
            return text
    return ""

def main():
    print("Fetching comments for post 3778998106370274639...")
    res = call_mcp("getInstagramCommentsByPostId", {
        "postId": "3778998106370274639",
        "count": 10
    })
    text = get_text(res)
    print("INITIAL RESPONSE:")
    print(text[:300])

    op_id = None
    for line in text.split('\n'):
        if 'operationId:' in line:
            op_id = line.split('operationId:')[-1].strip()
            break
            
    if op_id:
        print(f"Polling op: {op_id}")
        text = poll(op_id)
        
    print("\nFINAL TEXT:")
    print(text[:1500])
    
    with open("d:/vscode/Projetos/social_media_sentiment/scripts/debug_comments.txt", "w", encoding="utf-8") as f:
        f.write(text)

if __name__ == "__main__":
    main()
