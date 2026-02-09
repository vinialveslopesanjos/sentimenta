# Configuração do Redis no Windows

O Celery precisa do Redis (ou outro broker) para funcionar. Aqui estão as opções:

## Opção 1: Redis Nativo (Recomendado para Windows sem Docker)

### Instalação Automática
```powershell
cd D:\vscode\Projetos\social_media_sentiment\backend
.\start_redis_windows.ps1
```

### Instalação Manual
1. Baixe o MSI: https://github.com/microsoftarchive/redis/releases
2. Instale com as opções padrão
3. O serviço iniciará automaticamente

### Verificar se está rodando
```powershell
Get-Service Redis
# ou
redis-cli ping  # deve retornar "PONG"
```

---

## Opção 2: Docker Desktop (Melhor longo prazo)

1. Instale: https://www.docker.com/products/docker-desktop
2. Reinicie o computador
3. Rode:
```powershell
docker run -d --name redis -p 6379:6379 redis:latest
```

---

## Opção 3: Redis Cloud (Gratuito, sem instalar nada)

1. Crie conta em: https://redis.com/try-free/
2. Crie um database
3. Copie a URL de conexão
4. Edite `backend/.env`:
```env
REDIS_URL=redis://default:sua_senha@seu_host.redis-cloud.com:porta
```

---

## Opção 4: Memurai (Alternativa Windows)

Redis compatível nativo para Windows:
https://www.memurai.com/

---

## Testar Conexão

Depois de instalar qualquer opção:
```powershell
# Testar porta
Test-NetConnection -ComputerName localhost -Port 6379

# Ou com redis-cli
redis-cli ping
```

---

## Troubleshooting

### Erro: "Connection refused"
- Redis não está rodando
- Porta 6379 está bloqueada pelo firewall

### Erro: "Authentication required"
- Redis Cloud precisa de senha na URL
- Verifique `REDIS_URL` no `.env`

### Erro no Celery: "Unable to load celery application"
```powershell
# Certifique-se de estar na pasta backend
cd D:\vscode\Projetos\social_media_sentiment\backend
$env:PYTHONPATH = "."
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```
