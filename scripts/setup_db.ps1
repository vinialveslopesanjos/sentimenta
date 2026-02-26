# Script para criar usuario e banco de dados no PostgreSQL
$env:PGPASSWORD = 'sentiment'
$PG = 'psql'
$ADMIN = 'postgres'

Write-Host "=== Criando usuario sentiment ===" -ForegroundColor Cyan
& $PG -U $ADMIN -c "DO `$`$BEGIN IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'sentiment') THEN CREATE USER sentiment WITH PASSWORD 'sentiment'; END IF; END`$`$;"

Write-Host "=== Criando banco sentiment_db ===" -ForegroundColor Cyan
$dbExists = & $PG -U $ADMIN -tAc "SELECT 1 FROM pg_database WHERE datname='sentiment_db';"
if ($dbExists -ne '1') {
    & $PG -U $ADMIN -c "CREATE DATABASE sentiment_db OWNER sentiment;"
    Write-Host "[OK] Banco sentiment_db criado" -ForegroundColor Green
} else {
    Write-Host "[OK] Banco sentiment_db ja existe" -ForegroundColor Yellow
}

Write-Host "=== Garantindo privilegios ===" -ForegroundColor Cyan
& $PG -U $ADMIN -c "GRANT ALL PRIVILEGES ON DATABASE sentiment_db TO sentiment;"
& $PG -U $ADMIN -d sentiment_db -c "GRANT ALL ON SCHEMA public TO sentiment;"

Write-Host ""
Write-Host "=== Testando conexao do usuario sentiment ===" -ForegroundColor Cyan
$env:PGPASSWORD = 'sentiment'
$test = & $PG -U sentiment -d sentiment_db -c "SELECT current_user, current_database();" 2>&1
Write-Host $test

Write-Host ""
Write-Host "=== Banco de dados configurado com sucesso! ===" -ForegroundColor Green
