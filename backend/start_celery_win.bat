@echo off
chcp 65001 >nul
echo 🚀 Iniciando Celery Worker (Windows Mode)
echo Pool: solo ^| Log Level: info
echo.

set PYTHONPATH=.
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo

pause
