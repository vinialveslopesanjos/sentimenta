#!/bin/bash
# =============================================================
#  Sentimenta — Script de Setup da VPS Hostinger (Ubuntu 24.04)
#  Rodar como root: bash setup_vps.sh
# =============================================================

set -e  # Para imediatamente se qualquer comando falhar

# ─── Configurações (editar antes de rodar) ───────────────────

DB_PASSWORD="MUDE_ESTA_SENHA_FORTE_12345"
REDIS_PASSWORD="REDIS_SENHA_FORTE_AQUI"
GITHUB_REPO="https://github.com/vinialveslopesanjos/sentimenta.git"
GIT_BRANCH="main"
APP_DIR="/opt/sentimenta"
DOMAIN="sentimenta.com.br"   # Configurar DNS antes de rodar certbot

# Chaves de API (ou configure depois via .env)
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
GEMINI_API_KEY=""
APIFY_API_TOKEN=""

# ─── Cores para output ───────────────────────────────────────

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%T)] $1${NC}"; }
warn() { echo -e "${YELLOW}[AVISO] $1${NC}"; }

# ─── 1. Sistema ───────────────────────────────────────────────

log "Atualizando sistema..."
apt update -qq && apt upgrade -y -qq

log "Instalando dependências do sistema..."
apt install -y -qq \
    postgresql-16 postgresql-client-16 \
    redis-server \
    python3.12 python3.12-venv python3-pip \
    nginx certbot python3-certbot-nginx \
    supervisor \
    git curl wget ufw \
    build-essential libpq-dev

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# ─── 2. PostgreSQL ────────────────────────────────────────────

log "Configurando PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

sudo -u postgres psql -c "CREATE USER sentimenta WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE sentimenta_db OWNER sentimenta;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sentimenta_db TO sentimenta;" 2>/dev/null || true

# ─── 3. Redis ─────────────────────────────────────────────────

log "Configurando Redis..."
sed -i "s/# requirepass foobared/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
sed -i "s/bind 127.0.0.1 ::1/bind 127.0.0.1/" /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server

# ─── 4. Clonar projeto ────────────────────────────────────────

log "Clonando repositório..."
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git fetch origin
    git checkout "$GIT_BRANCH"
    git pull origin "$GIT_BRANCH"
else
    git clone --branch "$GIT_BRANCH" "$GITHUB_REPO" "$APP_DIR"
fi

# ─── 5. Backend Python ────────────────────────────────────────

log "Configurando backend Python..."
cd "$APP_DIR/backend"
python3.12 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt

# ─── 6. .env ─────────────────────────────────────────────────

log "Criando arquivo .env..."
cat > "$APP_DIR/.env" << EOF
# === SENTIMENTA — Produção ===

# Database
DATABASE_URL=postgresql://sentimenta:${DB_PASSWORD}@localhost:5432/sentimenta_db

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379/0

# JWT Auth
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# AI
GEMINI_API_KEY=${GEMINI_API_KEY}
GEMINI_MODEL=gemini-2.0-flash

# Scraping
APIFY_API_TOKEN=${APIFY_API_TOKEN}

# Celery
CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@localhost:6379/0
CELERY_RESULT_BACKEND=redis://:${REDIS_PASSWORD}@localhost:6379/1

# App
DEBUG=false
APP_URL=https://${DOMAIN}
INSTAGRAM_REDIRECT_URI=https://${DOMAIN}/api/v1/connections/instagram/callback
EOF

# ─── 7. Migrations ────────────────────────────────────────────

log "Rodando migrations do banco..."
cd "$APP_DIR/backend"
source .venv/bin/activate
alembic upgrade head || log "Migrations falhou — verifique o banco e rode manualmente"

# ─── 8. Node.js — instalar dependências e buildar ─────────────

log "Instalando dependências Node.js..."
cd "$APP_DIR"
npm install

log "Buildando packages compartilhadas..."
npm run build:packages

log "Buildando frontend Next.js..."
cd "$APP_DIR/frontend"
npm run build

log "Buildando mobile PWA..."
cd "$APP_DIR"
npm run build --workspace=@sentimenta/mobile

# ─── 9. Supervisor ────────────────────────────────────────────

log "Configurando Supervisor..."
cat > /etc/supervisor/conf.d/sentimenta.conf << EOF
[program:sentimenta-api]
command=${APP_DIR}/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
directory=${APP_DIR}/backend
environment=PATH="${APP_DIR}/backend/.venv/bin"
autostart=true
autorestart=true
stdout_logfile=/var/log/sentimenta-api.log
stderr_logfile=/var/log/sentimenta-api-error.log
user=root
stopwaitsecs=10

[program:sentimenta-celery]
command=${APP_DIR}/backend/.venv/bin/celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
directory=${APP_DIR}/backend
environment=PATH="${APP_DIR}/backend/.venv/bin"
autostart=true
autorestart=true
stdout_logfile=/var/log/sentimenta-celery.log
stderr_logfile=/var/log/sentimenta-celery-error.log
user=root
stopwaitsecs=30

[program:sentimenta-web]
command=/usr/bin/node_modules/.bin/next start --port 3000
directory=${APP_DIR}/frontend
environment=NODE_ENV="production",PORT="3000"
autostart=true
autorestart=true
stdout_logfile=/var/log/sentimenta-web.log
stderr_logfile=/var/log/sentimenta-web-error.log
user=root
stopwaitsecs=30
EOF

supervisorctl reread
supervisorctl update
supervisorctl start sentimenta-api sentimenta-celery sentimenta-web || true

# ─── 10. Nginx ────────────────────────────────────────────────

log "Configurando Nginx..."
cp "$APP_DIR/nginx_sentimenta.conf" /etc/nginx/sites-available/sentimenta
ln -sf /etc/nginx/sites-available/sentimenta /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

# ─── 11. Firewall ─────────────────────────────────────────────

log "Configurando firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ─── 12. SSL ──────────────────────────────────────────────────

warn "Para habilitar HTTPS, configure o DNS primeiro e então rode:"
warn "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
warn ""
warn "Verifique se o domínio já aponta para $(curl -s ifconfig.me) antes de rodar certbot."

# ─── 13. Script de atualização ────────────────────────────────

cat > /opt/sentimenta/scripts/deploy.sh << 'DEPLOY'
#!/bin/bash
# Atualizar Sentimenta na VPS — rodar como root
set -e
cd /opt/sentimenta

echo "🔄 Atualizando código..."
git pull origin main

echo "🐍 Atualizando backend..."
cd backend
source .venv/bin/activate
pip install -q -r requirements.txt
alembic upgrade head
cd ..

echo "📦 Buildando packages..."
npm install
npm run build:packages

echo "📱 Buildando mobile PWA..."
npm run build --workspace=@sentimenta/mobile

echo "🌐 Buildando frontend web..."
cd frontend && npm run build && cd ..

echo "🔁 Reiniciando serviços..."
supervisorctl restart sentimenta-api sentimenta-celery sentimenta-web

echo "✅ Deploy concluído!"
DEPLOY

chmod +x /opt/sentimenta/scripts/deploy.sh

# ─── Resumo ───────────────────────────────────────────────────

log "✅ Setup concluído!"
echo ""
echo "========================================="
echo " Sentimenta está rodando na VPS!"
echo "========================================="
echo ""
echo " → Web:        http://${DOMAIN}"
echo " → Mobile:     http://${DOMAIN}/app/"
echo " → API Docs:   http://${DOMAIN}/docs"
echo " → Health:     http://${DOMAIN}/health"
echo ""
echo " → Logs API:    tail -f /var/log/sentimenta-api.log"
echo " → Logs Web:    tail -f /var/log/sentimenta-web.log"
echo " → Logs Celery: tail -f /var/log/sentimenta-celery.log"
echo " → Status:      supervisorctl status"
echo ""
echo " Para atualizar: /opt/sentimenta/scripts/deploy.sh"
echo ""
warn "IMPORTANTE: edite /opt/sentimenta/.env e adicione:"
warn "  GEMINI_API_KEY=..."
warn "  APIFY_API_TOKEN=..."
warn "  INSTAGRAM_APP_ID=..."
warn "  INSTAGRAM_APP_SECRET=..."
warn "Depois reinicie: supervisorctl restart all"
