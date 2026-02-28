from sqlalchemy import create_engine, text
import os

db_url = 'postgresql://sentiment:sentiment@localhost:5432/sentiment_db'
engine = create_engine(db_url)

with engine.connect() as conn:
    try:
        users = conn.execute(text('SELECT email FROM users')).fetchall()
        print(f"USUARIOS ENCONTRADOS: {[u[0] for u in users]}")
    except Exception as e:
        print(f"Erro ao buscar usuarios: {e}")

    try:
        conns = conn.execute(text('SELECT platform, username FROM social_connections')).fetchall()
        print(f"CONEXOES ATIVAS: {[f'{c[0]}:{c[1]}' for c in conns]}")
    except Exception as e:
        print(f"Erro ao buscar conexoes: {e}")

    try:
        posts = conn.execute(text('SELECT count(*) FROM posts')).scalar()
        comments = conn.execute(text('SELECT count(*) FROM comments')).scalar()
        print(f"STATUS DE DADOS:")
        print(f" - Posts: {posts}")
        print(f" - Comentarios: {comments}")
    except Exception as e:
        print(f"Erro ao buscar contagens: {e}")
