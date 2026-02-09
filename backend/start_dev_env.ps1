# Script completo para iniciar ambiente de desenvolvimento
# Inicia: Redis, Backend, Celery, Frontend

param(
    [switch]$SkipRedis,
    [switch]$SkipBackend,
    [switch]$SkipCelery,
    [switch]$SkipFrontend,
    [string]$CeleryPool = "solo"
)

$ROOT_DIR = "D:\vscode\Projetos\social_media_sentiment"
$REDIS_CONTAINER = "redis-sentiment"

function Write-Header($text) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Test-Command($cmd) {
    return [bool](Get-Command -Name $cmd -ErrorAction SilentlyContinue)
}

function Test-RedisRunning {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
        return $connection.TcpTestSucceeded
    } catch {
        return $false
    }
}

function Start-RedisDocker {
    try {
        $containerExists = docker ps -a --format "{{.Names}}" | Select-String -Pattern $REDIS_CONTAINER
        if ($containerExists) {
            docker start $REDIS_CONTAINER | Out-Null
        } else {
            docker run -d --name $REDIS_CONTAINER -p 6379:6379 redis:latest | Out-Null
        }
        return $true
    } catch {
        return $false
    }
}

# ============================================
# 1. REDIS
# ============================================
if (-not $SkipRedis) {
    Write-Header "1. VERIFICANDO REDIS"
    
    if (Test-RedisRunning) {
        Write-Host "✅ Redis já está rodando na porta 6379" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis não está rodando" -ForegroundColor Yellow
        
        # Tentar Docker primeiro
        if (Test-Command "docker") {
            Write-Host "🐳 Tentando iniciar Redis via Docker..." -ForegroundColor Yellow
            if (Start-RedisDocker) {
                Start-Sleep -Seconds 2
                if (Test-RedisRunning) {
                    Write-Host "✅ Redis iniciado via Docker!" -ForegroundColor Green
                } else {
                    Write-Host "❌ Falha ao iniciar Redis via Docker" -ForegroundColor Red
                }
            } else {
                Write-Host "❌ Docker disponível mas falhou ao iniciar container" -ForegroundColor Red
            }
        } else {
            Write-Host "⚠️  Docker não encontrado" -ForegroundColor Yellow
            Write-Host "`n🔧 OPÇÕES PARA RODAR REDIS:" -ForegroundColor Cyan
            Write-Host "   1. Instale Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor White
            Write-Host "   2. Rode: .\start_redis_windows.ps1 (instala Redis nativo no Windows)" -ForegroundColor White
            Write-Host "   3. Use Redis Cloud gratuito e configure REDIS_URL no .env" -ForegroundColor White
            Write-Host "`n   Ou pule esta etapa com: -SkipRedis" -ForegroundColor Gray
            
            $continue = Read-Host "`nDeseja continuar sem Redis? (S/N)"
            if ($continue -ne 'S' -and $continue -ne 's') {
                exit 1
            }
        }
    }
}

# ============================================
# 2. BACKEND (FastAPI)
# ============================================
if (-not $SkipBackend) {
    Write-Header "2. INICIANDO BACKEND (FastAPI)"
    
    Start-Job -Name "Backend" -ScriptBlock {
        param($root)
        Set-Location "$root\backend"
        . .venv\Scripts\activate
        $env:PYTHONPATH = "."
        uvicorn app.main:app --reload --port 8000
    } -ArgumentList $ROOT_DIR
    
    Write-Host "⏳ Aguardando backend iniciar..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    Write-Host "✅ Backend iniciado em http://localhost:8000" -ForegroundColor Green
}

# ============================================
# 3. CELERY WORKER
# ============================================
if (-not $SkipCelery) {
    Write-Header "3. INICIANDO CELERY WORKER"
    Write-Host "Pool: $CeleryPool" -ForegroundColor Gray
    
    Start-Job -Name "Celery" -ScriptBlock {
        param($root, $pool)
        Set-Location "$root\backend"
        . .venv\Scripts\activate
        $env:PYTHONPATH = "."
        celery -A app.tasks.celery_app worker --loglevel=info --pool=$pool
    } -ArgumentList $ROOT_DIR, $CeleryPool
    
    Start-Sleep -Seconds 2
    Write-Host "✅ Celery iniciado" -ForegroundColor Green
}

# ============================================
# 4. FRONTEND (React/Vite)
# ============================================
if (-not $SkipFrontend) {
    Write-Header "4. INICIANDO FRONTEND"
    
    Start-Job -Name "Frontend" -ScriptBlock {
        param($root)
        Set-Location "$root\frontend"
        npm run dev
    } -ArgumentList $ROOT_DIR
    
    Start-Sleep -Seconds 3
    Write-Host "✅ Frontend iniciado em http://localhost:5173" -ForegroundColor Green
}

# ============================================
# RESUMO
# ============================================
Write-Header "AMBIENTE INICIADO!"

Write-Host "📊 Serviços:" -ForegroundColor White
if (-not $SkipRedis)     { 
    if (Test-RedisRunning) {
        Write-Host "   🟢 Redis:    redis://localhost:6379" -ForegroundColor Green 
    } else {
        Write-Host "   🔴 Redis:    NÃO CONECTADO" -ForegroundColor Red
    }
}
if (-not $SkipBackend)   { Write-Host "   🟢 Backend:  http://localhost:8000" -ForegroundColor Green }
if (-not $SkipCelery)    { Write-Host "   🟢 Celery:   Pool=$CeleryPool" -ForegroundColor Green }
if (-not $SkipFrontend)  { Write-Host "   🟢 Frontend: http://localhost:5173" -ForegroundColor Green }

Write-Host "`n📚 Documentação API: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "📊 Flower (Celery):  http://localhost:5555 (se instalado)" -ForegroundColor Cyan

Write-Host "`n⚠️  Pressione CTRL+C para parar todos os serviços`n" -ForegroundColor Yellow

# Mantém os jobs rodando
try {
    while ($true) {
        Get-Job | Receive-Job
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`n🛑 Parando todos os serviços..." -ForegroundColor Yellow
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "✅ Ambiente encerrado" -ForegroundColor Green
}
