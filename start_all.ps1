# Inicia todo o ambiente de desenvolvimento
# Redis + Backend + Celery + Frontend

$ROOT = "D:\vscode\Projetos\social_media_sentiment"

Write-Host "🚀 Iniciando ambiente completo..." -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Redis
$redisRunning = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue | Select-Object -ExpandProperty TcpTestSucceeded
if (-not $redisRunning) {
    Write-Host "⚠️  Iniciando Redis..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& 'C:\Redis\redis-server.exe'" -WindowStyle Normal
    Start-Sleep -Seconds 2
} else {
    Write-Host "✅ Redis já está rodando" -ForegroundColor Green
}

# 2. Backend
Write-Host "🟢 Iniciando Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; .venv\Scripts\activate; `$env:PYTHONPATH='.'; uvicorn app.main:app --reload --port 8000" -WindowStyle Normal

Start-Sleep -Seconds 2

# 3. Celery
Write-Host "🟡 Iniciando Celery Worker..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; .venv\Scripts\activate; `$env:PYTHONPATH='.'; celery -A app.tasks.celery_app worker --loglevel=info --pool=solo" -WindowStyle Normal

Start-Sleep -Seconds 2

# 4. Frontend
Write-Host "🔵 Iniciando Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\frontend'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "✅ Todos os serviços iniciados!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Acesse: http://localhost:5173" -ForegroundColor White
Write-Host "📚 API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Para parar, feche as janelas do PowerShell" -ForegroundColor Yellow
