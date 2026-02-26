import asyncio
import httpx
import time
import uuid

API_URL = "http://localhost:8000/api/v1"

async def test_auth_and_limits():
    async with httpx.AsyncClient() as client:
        # 1. Create a dynamic user for testing
        test_email = f"stress_test_{uuid.uuid4().hex[:8]}@example.com"
        test_password = "SecurePassword123!"
        print(f"[*] Registering test user: {test_email}")
        
        res = await client.post(f"{API_URL}/auth/register", json={
            "email": test_email,
            "password": test_password,
            "name": "Stress Test User"
        })
        
        if res.status_code != 201:
            print(f"[!] Erro ao registrar: {res.text}")
            return
            
        token = res.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        print("[*] Usuário registrado com sucesso.")

        # 2. Test Platform limits (Security / API Business Logic)
        print("[*] Testando limite de contas por plataforma (Instagram)...")
        # Add first Instagram account
        res1 = await client.post(f"{API_URL}/connections/instagram", json={
            "channel_handle": "neymarjr"
        }, headers=headers)
        
        if res1.status_code == 201 or res1.status_code == 200:
            print("[+] Primeira conta do Instagram adicionada com sucesso.")
        else:
            print(f"[-] Falha na 1a conta do instagram: {res1.text}")
            
        # Add second Instagram account (Should Fail!)
        res2 = await client.post(f"{API_URL}/connections/instagram", json={
            "channel_handle": "cristiano"
        }, headers=headers)
        
        if res2.status_code == 403:
            print("[+] Bloqueio bem-sucedido de 2a conta (Max 1 Conta por Plataforma respetado).")
        else:
            print(f"[!] ERRO DE SEGURANÇA: Limitador Falhou! Status: {res2.status_code}, Resposta: {res2.text}")

async def stress_test_auth():
    print("\n[*] Iniciando teste de STRESS (Múltiplas requisições simultâneas)...")
    async def make_request(client, i):
        start = time.time()
        res = await client.get(f"{API_URL}/health")
        latency = time.time() - start
        return res.status_code, latency

    async with httpx.AsyncClient() as client:
        tasks = [make_request(client, i) for i in range(100)] # 100 requests concurrently
        results = await asyncio.gather(*tasks)
        
        success_count = sum(1 for status, _ in results if status == 200)
        avg_latency = sum(lat for _, lat in results) / len(results)
        
        print(f"[+] Status do Stress Test: {success_count}/100 requisições bem-sucedidas.")
        print(f"[+] Latência média: {avg_latency:.4f} segundos")

async def test_security_injections():
    print("\n[*] Iniciando Testes de Injeção...")
    async with httpx.AsyncClient() as client:
        # SQL Injection attempt in Login
        payload = {
            "email": "admin' OR '1'='1",
            "password": "blabla"
        }
        res = await client.post(f"{API_URL}/auth/login", json=payload)
        if res.status_code in [401, 404]:
            print("[+] Injeção SQL em Login prevenida (Status 401/404 esperado).")
        else:
            print(f"[!] Comportamento suspeito em Injeção SQL: {res.status_code}")

if __name__ == "__main__":
    asyncio.run(test_auth_and_limits())
    asyncio.run(stress_test_auth())
    asyncio.run(test_security_injections())
