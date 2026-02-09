# Instalação Portátil do Redis para Windows
# Não requer privilégios de admin

$ErrorActionPreference = "Stop"

$REDIS_VERSION = "3.0.504"
$REDIS_URL = "https://github.com/microsoftarchive/redis/releases/download/win-3.0.504/Redis-x64-3.0.504.zip"
$INSTALL_DIR = "C:\Redis"
$PROFILE_FILE = "$env:USERPROFILE\Documents\WindowsPowerShell\Profile.ps1"

Write-Host "🚀 Instalando Redis $REDIS_VERSION (Portátil)" -ForegroundColor Cyan

# Criar diretório
if (-not (Test-Path $INSTALL_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
}

# Download
Write-Host "📥 Baixando Redis..." -ForegroundColor Yellow
$zipPath = "$env:TEMP\redis.zip"
try {
    Invoke-WebRequest -Uri $REDIS_URL -OutFile $zipPath -UseBasicParsing
    Write-Host "✅ Download concluído" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro no download. Tentando URL alternativa..." -ForegroundColor Red
    # URL alternativa
    $REDIS_URL = "https://download.microsoft.com/download/1/3/6/1363EEF6-1713-4631-A5D4-4FB565CBC7D2/Redis-x64-3.0.504.zip"
    Invoke-WebRequest -Uri $REDIS_URL -OutFile $zipPath -UseBasicParsing
}

# Extrair
Write-Host "📦 Extraindo arquivos..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $INSTALL_DIR -Force
Remove-Item $zipPath -ErrorAction SilentlyContinue

# Verificar instalação
if (Test-Path "$INSTALL_DIR\redis-server.exe") {
    Write-Host "✅ Redis extraído para $INSTALL_DIR" -ForegroundColor Green
} else {
    Write-Host "❌ Erro: redis-server.exe não encontrado" -ForegroundColor Red
    exit 1
}

# Adicionar ao PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$INSTALL_DIR*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$INSTALL_DIR", "User")
    Write-Host "✅ Adicionado ao PATH do usuário" -ForegroundColor Green
}

# Criar script de inicialização
$startScript = @"
@echo off
echo Iniciando Redis Server...
cd /d "$INSTALL_DIR"
start "" redis-server.exe redis.windows.conf
"@
$startScript | Out-File -FilePath "$INSTALL_DIR\start-redis.bat" -Encoding ASCII

# Criar atalho na área de trabalho
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Start Redis.lnk")
$Shortcut.TargetPath = "$INSTALL_DIR\start-redis.bat"
$Shortcut.WorkingDirectory = $INSTALL_DIR
$Shortcut.IconLocation = "$INSTALL_DIR\redis-server.exe,0"
$Shortcut.Save()

Write-Host "`n✅ Instalação concluída!" -ForegroundColor Green
Write-Host "`n📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. Clique duplo no ícone 'Start Redis' na área de trabalho" -ForegroundColor White
Write-Host "   2. Ou execute: $INSTALL_DIR\start-redis.bat" -ForegroundColor White
Write-Host "   3. Ou execute: & '$INSTALL_DIR\redis-server.exe'" -ForegroundColor White
Write-Host "`n⚠️  Reinicie o PowerShell para usar 'redis-cli' de qualquer lugar" -ForegroundColor Yellow

# Iniciar Redis agora?
$startNow = Read-Host "`nDeseja iniciar o Redis agora? (S/N)"
if ($startNow -eq 'S' -or $startNow -eq 's') {
    Write-Host "🚀 Iniciando Redis..." -ForegroundColor Green
    Start-Process -FilePath "$INSTALL_DIR\redis-server.exe" -ArgumentList "$INSTALL_DIR\redis.windows.conf" -WindowStyle Normal
    Start-Sleep -Seconds 2
    
    # Testar
    try {
        $test = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue
        if ($test.TcpTestSucceeded) {
            Write-Host "✅ Redis está rodando na porta 6379!" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Redis pode estar iniciando, aguarde alguns segundos..." -ForegroundColor Yellow
        }
    } catch {}
}
