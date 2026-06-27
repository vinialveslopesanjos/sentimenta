import uuid
import os
import psycopg2
from datetime import datetime, timezone
from app.core.security import hash_password

if os.getenv("ALLOW_LEGACY_ADMIN_SCRIPT") != "1":
    raise SystemExit("Legacy script disabled. Set ALLOW_LEGACY_ADMIN_SCRIPT=1, DATABASE_URL, TARGET_EMAIL, TARGET_PASSWORD, and TARGET_USERNAME.")

DB_URL = os.getenv("DATABASE_URL")
TARGET_EMAIL = os.getenv("TARGET_EMAIL")
TARGET_PASSWORD = os.getenv("TARGET_PASSWORD")
TARGET_USERNAME = os.getenv("TARGET_USERNAME")

if not all([DB_URL, TARGET_EMAIL, TARGET_PASSWORD, TARGET_USERNAME]):
    raise SystemExit("DATABASE_URL, TARGET_EMAIL, TARGET_PASSWORD, and TARGET_USERNAME are required.")

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # 1. Create the new user
    user_id = uuid.uuid4()
    email = TARGET_EMAIL
    password = TARGET_PASSWORD
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
    username = TARGET_USERNAME
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
