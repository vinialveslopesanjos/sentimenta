import json
import requests

XPOZ_TOKEN   = "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4"
XPOZ_BASE    = "https://mcp.xpoz.ai/mcp"
xpoz_headers = {
    "Authorization": f"Bearer {XPOZ_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

r = requests.post(XPOZ_BASE, headers=xpoz_headers, json={'jsonrpc':'2.0','method':'tools/list','id':1})
r.encoding = 'utf-8'

with open('xpoz_tools.json', 'w', encoding='utf-8') as f:
    for line in r.text.split('\n'):
        if line.startswith('data: '):
            data = json.loads(line[6:])
            json.dump(data, f, indent=2)
            break
