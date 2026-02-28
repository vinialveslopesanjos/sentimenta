$env:PGPASSWORD = 'sentiment'
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'sentiment_db' AND pid <> pg_backend_pid();"
Start-Sleep -Seconds 1
psql -U postgres -c "DROP DATABASE IF EXISTS sentiment_db;"
psql -U postgres -c "CREATE DATABASE sentiment_db OWNER sentiment;"
psql -U postgres -d sentiment_db -c "GRANT ALL ON SCHEMA public TO sentiment;"
Write-Host "Banco recriado com sucesso!" -ForegroundColor Green
