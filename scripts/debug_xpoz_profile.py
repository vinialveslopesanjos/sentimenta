import json
import requests
import time

XPOZ_TOKEN   = "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4"
XPOZ_BASE    = "https://mcp.xpoz.ai/mcp"
xpoz_headers = {
    "Authorization": f"Bearer {XPOZ_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

def call_mcp(name, arguments):
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
        "id": 1
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
        res = call_mcp("checkOperationStatus", {"operationId": op_id})
        text = get_text(res)
        if "status: running" in text or "status: pending" in text:
            time.sleep(2)
        else:
            return text
    return ""

def test():
    res = call_mcp("getInstagramUser", {"identifier": "carnelos.lucas", "identifierType": "username"})
    text = get_text(res)
    op_id = None
    for line in text.split('\n'):
        if 'operationId:' in line:
            op_id = line.split('operationId:')[-1].strip()
    
    if op_id:
        text = poll(op_id)
    
    print("RESULT:\n", text[:1500])

if __name__ == "__main__":
    test()
