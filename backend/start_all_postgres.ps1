# Inicia ambiente completo com PostgreSQL (sem Docker)
# Redis + PostgreSQL + Backend + Celery + Frontend

$ROOT = "D:\vscode\Projetos\social_media_sentiment"

Write-Host "Iniciando ambiente completo (PostgreSQL)" -ForegroundColor Cyan
Write-Host ""

# Verificar Redis
$redisRunning = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded
if (-not $redisRunning) {
    Write-Host "[REDIS] Iniciando Redis..." -ForegroundColor Red
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& 'C:\Redis\redis-server.exe'" -WindowStyle Normal
    Start-Sleep -Seconds 2
} else {
    Write-Host "[OK] Redis ja esta rodando" -ForegroundColor Green
}

# Verificar PostgreSQL
try {
    $pgService = Get-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue
    if ($pgService -and $pgService.Status -eq 'Running') {
        Write-Host "[OK] PostgreSQL ja esta rodando" -ForegroundColor Green
    } else {
        Write-Host "[POSTGRES] Iniciando PostgreSQL..." -ForegroundColor Blue
        Start-Service -Name "postgresql-x64-16" -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    }
} catch {
    Write-Host "[AVISO] PostgreSQL nao encontrado. Rode primeiro: .\install_postgres.ps1" -ForegroundColor Yellow
}

# Backend
Write-Host "[BACKEND] Iniciando Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; .venv\Scripts\activate; `$env:PYTHONPATH='.'; uvicorn app.main:app --reload --port 8000" -WindowStyle Normal

Start-Sleep -Seconds 3

# Celery
Write-Host "[CELERY] Iniciando Celery Worker..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; .venv\Scripts\activate; `$env:PYTHONPATH='.'; celery -A app.tasks.celery_app worker --loglevel=info --pool=solo" -WindowStyle Normal

Start-Sleep -Seconds 2

# Frontend
Write-Host "[FRONTEND] Iniciando Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\frontend'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "[SUCESSO] Todos os servicos iniciados!" -ForegroundColor Green
Write-Host ""
Write-Host "Acesse: http://localhost:3000" -ForegroundColor White
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
