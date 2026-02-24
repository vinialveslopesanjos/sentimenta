import psycopg2

conn = psycopg2.connect("postgresql://sentiment:sentiment@localhost:5432/sentiment_db")
cur = conn.cursor()
cur.execute("SELECT id, username, platform, platform_user_id, followers_count, status FROM social_connections")
rows = cur.fetchall()
for r in rows:
    print(r)
cur.execute("SELECT id, email FROM users")
users = cur.fetchall()
for u in users:
    print("USER:", u)
conn.close()
