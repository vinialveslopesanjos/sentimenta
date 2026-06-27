#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sentimenta}"

echo "== host =="
hostnamectl || true

echo
echo "== resources =="
df -h || true
free -h || true
uptime || true

echo
echo "== network =="
ss -tulpn || true
ufw status verbose || true

echo
echo "== services =="
systemctl --no-pager --type=service --state=running || true
supervisorctl status || true
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' || true

echo
echo "== sentimenta git =="
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" status --short --branch || true
  git -C "$APP_DIR" log -1 --oneline --decorate --date=iso --format='%h %d %cd %s' || true
fi

echo
echo "== sentimenta config files =="
ls -la "$APP_DIR" 2>/dev/null || true
ls -la "$APP_DIR/backups" 2>/dev/null || true
find "$APP_DIR/backups" -maxdepth 1 -type f -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' 2>/dev/null | sort | tail -20 || true

echo
echo "== masked env keys =="
if [ -f "$APP_DIR/.env" ]; then
  sed -E 's/^([^#=]+)=.*/\1=***MASKED***/' "$APP_DIR/.env" | sort || true
fi

echo
echo "== cron =="
crontab -l || true

echo
echo "== nginx =="
nginx -T 2>/dev/null | sed -n '/server_name .*sentimenta/,+80p' || true
