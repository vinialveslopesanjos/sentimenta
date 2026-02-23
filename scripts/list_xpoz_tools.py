import requests
import json

TOKEN = "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4"
BASE_URL = "https://mcp.xpoz.ai/mcp"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

def call_mcp(method, params=None):
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params or {},
        "id": 1
    }
    try:
        response = requests.post(BASE_URL, headers=headers, json=payload)
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def main():
    print("Checking available tools...")
    tools = call_mcp("tools/list")
    
    # Check if we got tools
    if "result" in tools and "tools" in tools["result"]:
        print("Success! Tool names found:")
        for t in tools["result"]["tools"]:
            print(f"- {t['name']}")
    
    with open("xpoz_tools_list.json", "w", encoding="utf-8") as f:
        json.dump(tools, f, indent=4)
    print("Saved tools list to xpoz_tools_list.json")

if __name__ == "__main__":
    main()
