"""
Script para criar tabelas e usuários de teste no banco de dados.
"""
import sys
import os

sys.path.insert(0, '.')
os.environ.setdefault('DATABASE_URL', 'postgresql://sentiment:sentiment@localhost:5432/sentiment_db')

from app.db.session import Base, engine, SessionLocal
from app.models import user  # noqa - registra models
# Importa todos os models para garantir que estao registrados
try:
    import app.models.social_connection
    import app.models.post
    import app.models.comment
    import app.models.pipeline_run
except Exception as e:
    print(f"[WARN] Alguns models nao carregaram: {e}")

print("=== Criando todas as tabelas ===")
Base.metadata.create_all(bind=engine)
print("[OK] Tabelas criadas com sucesso!")

# Criar usuarios de teste
from app.services.auth_service import register_user, create_tokens
from sqlalchemy.orm import Session

db: Session = SessionLocal()

USERS = [
    {"email": "leandrotwin@test.sentimenta.com", "password": "LeandroTest@2024", "name": "Teste - Leandro Twin"},
    {"email": "historiapublica@test.sentimenta.com", "password": "HistoriaTest@2024", "name": "Teste - Historia Publica"},
]

for u in USERS:
    try:
        user_obj = register_user(db, u["email"], u["password"], u["name"])
        tokens = create_tokens(user_obj)
        print(f"[OK] Usuario criado: {u['email']}")
        print(f"     Access Token: {tokens['access_token'][:50]}...")
    except ValueError as e:
        print(f"[INFO] {u['email']}: {e} (provavelmente ja existe)")
    except Exception as e:
        print(f"[ERRO] {u['email']}: {e}")

db.close()
print("\n=== Setup concluido! ===")
print("\nLogins de teste:")
for u in USERS:
    print(f"  Email: {u['email']}")
    print(f"  Senha: {u['password']}")
    print()
