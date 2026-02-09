# Inicia o Backend FastAPI

Write-Host "🚀 Iniciando Backend..." -ForegroundColor Cyan

$env:PYTHONPATH = "."

Write-Host "📊 Configuração:" -ForegroundColor Gray
Write-Host "   Database: PostgreSQL" -ForegroundColor Gray
Write-Host "   Redis: localhost:6379" -ForegroundColor Gray
Write-Host ""

uvicorn app.main:app --reload --port 8000
