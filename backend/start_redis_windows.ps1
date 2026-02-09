# Script para instalar e iniciar Redis no Windows
# Alternativa ao Docker para desenvolvimento local

param(
    [switch]$InstallOnly
)

$REDIS_VERSION = "5.0.14.1"
$REDIS_URL = "https://github.com/microsoftarchive/redis/releases/download/win-$REDIS_VERSION/Redis-x64-$REDIS_VERSION.msi"
$REDIS_INSTALL_PATH = "C:\Program Files\Redis"
$REDIS_SERVICE = "Redis"

function Test-RedisInstalled {
    return Test-Path "$REDIS_INSTALL_PATH\redis-server.exe"
}

function Test-RedisRunning {
    try {
        $service = Get-Service -Name $REDIS_SERVICE -ErrorAction SilentlyContinue
        return ($service -and $service.Status -eq 'Running')
    } catch {
        return $false
    }
}

function Install-Redis {
    Write-Host "📥 Baixando Redis $REDIS_VERSION..." -ForegroundColor Yellow
    $installerPath = "$env:TEMP\redis-installer.msi"
    
    try {
        Invoke-WebRequest -Uri $REDIS_URL -OutFile $installerPath -UseBasicParsing
        Write-Host "🔧 Instalando Redis..." -ForegroundColor Yellow
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", $installerPath, "/quiet", "/norestart" -Wait
        Remove-Item $installerPath -ErrorAction SilentlyContinue
        Write-Host "✅ Redis instalado com sucesso!" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ Erro ao instalar Redis: $_" -ForegroundColor Red
        return $false
    }
}

function Start-RedisService {
    try {
        $service = Get-Service -Name $REDIS_SERVICE -ErrorAction SilentlyContinue
        if (-not $service) {
            Write-Host "❌ Serviço Redis não encontrado" -ForegroundColor Red
            return $false
        }
        
        if ($service.Status -eq 'Running') {
            Write-Host "✅ Redis já está rodando" -ForegroundColor Green
            return $true
        }
        
        Start-Service -Name $REDIS_SERVICE
        Write-Host "🚀 Redis iniciado!" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ Erro ao iniciar Redis: $_" -ForegroundColor Red
        return $false
    }
}

# Main
Write-Host "`n🔄 Verificando Redis..." -ForegroundColor Cyan

if (-not (Test-RedisInstalled)) {
    Write-Host "⚠️  Redis não está instalado" -ForegroundColor Yellow
    $install = Read-Host "Deseja instalar o Redis agora? (S/N)"
    if ($install -eq 'S' -or $install -eq 's') {
        if (-not (Install-Redis)) {
            exit 1
        }
    } else {
        Write-Host "❌ Redis é necessário para o Celery funcionar" -ForegroundColor Red
        Write-Host "   Alternativas:" -ForegroundColor Yellow
        Write-Host "   1. Instale Redis manualmente: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Yellow
        Write-Host "   2. Use Docker Desktop para Windows" -ForegroundColor Yellow
        Write-Host "   3. Use Redis Cloud (gratuito): https://redis.com/try-free/" -ForegroundColor Yellow
        exit 1
    }
}

if ($InstallOnly) {
    exit 0
}

if (-not (Start-RedisService)) {
    Write-Host "`n⚠️  Tentando iniciar Redis manualmente..." -ForegroundColor Yellow
    if (Test-Path "$REDIS_INSTALL_PATH\redis-server.exe") {
        Start-Process -FilePath "$REDIS_INSTALL_PATH\redis-server.exe" -WindowStyle Hidden
        Start-Sleep -Seconds 2
    }
}

# Testar conexão
Start-Sleep -Seconds 1
try {
    $test = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
    if ($test.TcpTestSucceeded) {
        Write-Host "✅ Redis conectado em localhost:6379" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Redis pode não estar respondendo na porta 6379" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Não foi possível testar conexão com Redis" -ForegroundColor Yellow
}
