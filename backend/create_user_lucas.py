import uuid
import psycopg2
from datetime import datetime, timezone
from app.core.security import hash_password

DB_URL = "postgresql://sentiment:sentiment@localhost:5432/sentiment_db"

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 1. Create the new user
    user_id = uuid.uuid4()
    email = "admin_lucas@sentimenta.com"
    password = "1234"
    hashed_password = hash_password(password)
    now = datetime.now(timezone.utc)

    cur.execute("SELECT id FROM users WHERE email=%s", (email,))
    existing_user = cur.fetchone()

    if existing_user:
        print(f"User {email} already exists with ID: {existing_user[0]}")
        user_id = existing_user[0]
        cur.execute("UPDATE users SET password_hash=%s WHERE id=%s", (hashed_password, user_id))
    else:
        print(f"Creating user {email}...")
        cur.execute("""
            INSERT INTO users (id, email, password_hash, name, plan, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (str(user_id), email, hashed_password, "Admin Lucas", "pro", now, now))
    
    # 2. Transfer the connection
    username = "carnelos.lucas"
    cur.execute("SELECT id, user_id FROM social_connections WHERE username=%s", (username,))
    conn_row = cur.fetchone()

    if conn_row:
        conn_id = conn_row[0]
        old_user_id = conn_row[1]
        print(f"Found connection for {username} (ID: {conn_id}). Current User ID: {old_user_id}")
        
        cur.execute("UPDATE social_connections SET user_id=%s WHERE id=%s", (str(user_id), conn_id))
        print(f"Successfully transferred {username} to {email}")
    else:
        print(f"Could not find connection for {username}")

    conn.commit()
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
