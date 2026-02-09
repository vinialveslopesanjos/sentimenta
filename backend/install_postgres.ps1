# Instalacao do PostgreSQL no Windows (sem Docker)
# Versao: PostgreSQL 16

$ErrorActionPreference = "Stop"

$PG_VERSION = "16.3-1"
$PG_URL = "https://get.enterprisedb.com/postgresql/postgresql-$PG_VERSION-windows-x64.exe"
$PG_INSTALL_DIR = "C:\Program Files\PostgreSQL\16"
$PG_DATA_DIR = "C:\Program Files\PostgreSQL\16\data"
$PG_SERVICE = "postgresql-x64-16"

Write-Host "Instalador PostgreSQL para Windows" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Verificar se ja esta instalado
if (Test-Path "$PG_INSTALL_DIR\bin\psql.exe") {
    Write-Host "[OK] PostgreSQL ja esta instalado!" -ForegroundColor Green

    $service = Get-Service -Name $PG_SERVICE -ErrorAction SilentlyContinue
    if ($service -and $service.Status -eq 'Running') {
        Write-Host "[OK] PostgreSQL ja esta rodando!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "[AVISO] PostgreSQL instalado mas parado. Iniciando..." -ForegroundColor Yellow
        Start-Service -Name $PG_SERVICE
        exit 0
    }
}

# Download
Write-Host ""
Write-Host "[DOWNLOAD] Baixando PostgreSQL $PG_VERSION..." -ForegroundColor Yellow
Write-Host "   Isso pode levar alguns minutos..." -ForegroundColor Gray

$installerPath = "$env:TEMP\postgresql_installer.exe"

try {
    Invoke-WebRequest -Uri $PG_URL -OutFile $installerPath -UseBasicParsing
    Write-Host "[OK] Download concluido!" -ForegroundColor Green
} catch {
    Write-Host "[ERRO] Erro no download. Tentando URL alternativa..." -ForegroundColor Red
    # URL alternativa (postgresql.org)
    $PG_URL = "https://sbp.enterprisedb.com/getfile.jsp?fileid=1259100"
    Invoke-WebRequest -Uri $PG_URL -OutFile $installerPath -UseBasicParsing
}

# Instalacao silenciosa
Write-Host ""
Write-Host "[INSTALACAO] Instalando PostgreSQL..." -ForegroundColor Yellow
Write-Host "   Senha padrao: sentiment" -ForegroundColor Gray
Write-Host "   Porta: 5432" -ForegroundColor Gray
Write-Host "   User: postgres" -ForegroundColor Gray

$arguments = @(
    "--mode unattended",
    "--unattendedmodeui minimal",
    "--serverport 5432",
    "--superpassword sentiment",
    "--enable_acledit 1"
) -join " "

Start-Process -FilePath $installerPath -ArgumentList $arguments -Wait

# Limpar
Remove-Item $installerPath -ErrorAction SilentlyContinue

# Verificar instalacao
if (Test-Path "$PG_INSTALL_DIR\bin\psql.exe") {
    Write-Host ""
    Write-Host "[OK] PostgreSQL instalado com sucesso!" -ForegroundColor Green

    # Adicionar ao PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$PG_INSTALL_DIR\bin*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$PG_INSTALL_DIR\bin", "User")
        Write-Host "[OK] Adicionado ao PATH do usuario" -ForegroundColor Green
    }

    # Iniciar servico
    Write-Host ""
    Write-Host "[START] Iniciando servico PostgreSQL..." -ForegroundColor Yellow
    Start-Service -Name $PG_SERVICE -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 3

    # Criar database e usuario para o projeto
    Write-Host ""
    Write-Host "[DATABASE] Criando database 'sentiment_db'..." -ForegroundColor Yellow

    $env:PGPASSWORD = "sentiment"
    $psqlExe = "$PG_INSTALL_DIR\bin\psql.exe"

    & $psqlExe -U postgres -c "CREATE DATABASE sentiment_db;" 2>$null
    & $psqlExe -U postgres -c "CREATE USER sentiment WITH PASSWORD 'sentiment';" 2>$null
    & $psqlExe -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE sentiment_db TO sentiment;" 2>$null
    & $psqlExe -U postgres -d sentiment_db -c "GRANT ALL ON SCHEMA public TO sentiment;" 2>$null

    Write-Host "[OK] Database criado!" -ForegroundColor Green

} else {
    Write-Host ""
    Write-Host "[ERRO] Instalacao pode ter falhado. Verifique manualmente." -ForegroundColor Red
    exit 1
}

# Resumo
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "[SUCESSO] PostgreSQL instalado e configurado!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Informacoes de conexao:" -ForegroundColor White
Write-Host "   Host: localhost" -ForegroundColor Gray
Write-Host "   Porta: 5432" -ForegroundColor Gray
Write-Host "   Database: sentiment_db" -ForegroundColor Gray
Write-Host "   Usuario: sentiment" -ForegroundColor Gray
Write-Host "   Senha: sentiment" -ForegroundColor Gray
Write-Host ""
Write-Host "Connection string:" -ForegroundColor White
Write-Host "   postgresql://sentiment:sentiment@localhost:5432/sentiment_db" -ForegroundColor Cyan
Write-Host ""
Write-Host "[IMPORTANTE] Reinicie o PowerShell para usar 'psql' de qualquer lugar" -ForegroundColor Yellow
