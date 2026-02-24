# Sentimenta - Script de Inicializacao
# Roda backend (FastAPI) + Celery + Frontend em janelas separadas
# Uso: .\start.ps1

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "        SENTIMENTA - Iniciando          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Verificar servicos de infraestrutura ---
$redis_ok = (Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue).TcpTestSucceeded
$pg_ok = (Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded

if (-not $redis_ok) {
    Write-Host "[ERRO] Redis nao esta rodando na porta 6379" -ForegroundColor Red
    Write-Host "       Inicie o servico Redis antes de continuar." -ForegroundColor Yellow
    Write-Host "       (Services > Redis > Start  ou  Start-Service Redis)" -ForegroundColor Gray
    exit 1
}
Write-Host "[OK] Redis rodando" -ForegroundColor Green

if (-not $pg_ok) {
    Write-Host "[ERRO] PostgreSQL nao esta rodando na porta 5432" -ForegroundColor Red
    Write-Host "       Inicie o servico PostgreSQL antes de continuar." -ForegroundColor Yellow
    Write-Host "       (Services > postgresql-x64-16 > Start)" -ForegroundColor Gray
    exit 1
}
Write-Host "[OK] PostgreSQL rodando" -ForegroundColor Green

# --- Backend (FastAPI) ---
Write-Host ""
Write-Host "[START] Backend FastAPI em http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "cd '$ROOT\backend'; `$env:PYTHONPATH='.'; .venv\Scripts\uvicorn.exe app.main:app --reload --port 8000"

Start-Sleep -Seconds 3

# --- Celery Worker ---
Write-Host "[START] Celery Worker ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "cd '$ROOT\backend'; `$env:PYTHONPATH='.'; .venv\Scripts\celery.exe -A app.tasks.celery_app worker --loglevel=info --pool=solo"

Start-Sleep -Seconds 2

# --- Frontend (Next.js) ---
Write-Host "[START] Frontend Next.js em http://localhost:3000 ..." -ForegroundColor Cyan

# Libera porta 3000 se estiver em uso
$port3000 = netstat -ano | Select-String ":3000 " | Select-String "LISTENING"
if ($port3000) {
    Write-Host "       Liberando porta 3000..." -ForegroundColor Yellow
    $port3000 | ForEach-Object {
        $pid_ = ($_ -split '\s+')[-1]
        if ($pid_ -match '^\d+$' -and $pid_ -ne '0') {
            Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1
}

Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "cd '$ROOT\frontend'; Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue; npm run dev"

# --- Resumo ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Tudo iniciado! Aguarde ~10s e acesse:" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:3000" -ForegroundColor White
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Feche as janelas PowerShell para parar." -ForegroundColor Gray
