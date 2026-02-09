# Script para iniciar Celery no Windows
# Autor: Kimi Agent

param(
    [string]$Pool = "solo",
    [string]$LogLevel = "info"
)

Write-Host "🚀 Iniciando Celery Worker (Windows Mode)" -ForegroundColor Green
Write-Host "Pool: $Pool | Log Level: $LogLevel" -ForegroundColor Cyan

# Verifica se Redis está rodando
try {
    $redisTest = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
    if (-not $redisTest.TcpTestSucceeded) {
        Write-Host "⚠️  AVISO: Redis não está rodando na porta 6379!" -ForegroundColor Yellow
        Write-Host "   Inicie o Redis primeiro: docker run -d -p 6379:6379 redis:latest" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Redis conectado" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Não foi possível verificar Redis" -ForegroundColor Yellow
}

# Inicia o worker
$env:PYTHONPATH = "."
celery -A app.tasks.celery_app worker --loglevel=$LogLevel --pool=$Pool
