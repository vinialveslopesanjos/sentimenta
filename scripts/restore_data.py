import requests
import json

TOKEN = "K3A5NyyhdkSEc846EUvAlu5tSwziHbbCSTFWRGX7jCPPLR2yT2zpubtrg44wH9w519O1tF4"
BASE_URL = "https://mcp.xpoz.ai/mcp"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream"
}

def call_mcp(method, params, request_id):
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": request_id
    }
    response = requests.post(BASE_URL, headers=headers, json=payload)
    for line in response.text.split('\n'):
        if line.startswith('data: '):
            return json.loads(line[6:])
    return None

def main():
    username = "carnelos.lucas"
    print(f"Recuperando dados para {username}...")
    
    # 1. Get Instagram User
    profile_tool_res = call_mcp("tools/call", {
        "name": "getInstagramUser",
        "arguments": {
            "identifier": username,
            "identifierType": "username"
        }
    }, 1)
    
    # 2. Get Instagram Posts (Sample)
    posts_tool_res = call_mcp("tools/call", {
        "name": "getInstagramPostsByUser",
        "arguments": {
            "identifier": username,
            "identifierType": "username",
            "count": 5
        }
    }, 2)
    
    final_data = {
        "profile": profile_tool_res,
        "posts_operation": posts_tool_res
    }
    
    target_file = r"d:\vscode\Projetos\social_media_sentiment\scripts\instagram_data_carnelos_lucas.json"
    with open(target_file, "w", encoding="utf-8") as f:
        json.dump(final_data, f, indent=4, ensure_ascii=False)
    
    print(f"Pronto! Arquivo restaurado em: {target_file}")

if __name__ == "__main__":
    main()
