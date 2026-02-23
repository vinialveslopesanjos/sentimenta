import requests
import json
import sys

TOKEN = "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4"
BASE_URL = "https://mcp.xpoz.ai/mcp"
USERNAME = "carnelos.lucas"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def call_tool(name, arguments):
    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": name,
            "arguments": arguments
        },
        "id": 1
    }
    response = requests.post(BASE_URL, headers=headers, json=payload)
    if response.status_code != 200:
        print(f"Error calling {name}: {response.status_code} - {response.text}")
        return None
    return response.json()

def main():
    print(f"Fetching data for Instagram user: {USERNAME}")
    results = {}

    # 1. Get User Profile
    user_data = call_tool("getInstagramUserByUsername", {"username": USERNAME})
    if user_data:
        results["profile"] = user_data.get("result", {}).get("content", [{}])[0].get("text", "No data")
    
    # 2. Get Recent Posts
    posts_data = call_tool("getInstagramPostsByUsername", {"username": USERNAME, "count": 5})
    if posts_data:
        results["posts"] = posts_data.get("result", {}).get("content", [{}])[0].get("text", "No data")

    # Save to file
    with open("instagram_data_carnelos_lucas.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=4, ensure_ascii=False)
    
    print("Data saved to instagram_data_carnelos_lucas.json")

if __name__ == "__main__":
    main()
