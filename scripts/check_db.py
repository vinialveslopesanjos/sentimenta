import psycopg2

try:
    conn = psycopg2.connect("postgresql://sentiment:sentiment@localhost:5432/sentiment_db")
    cur = conn.cursor()
    
    # List all tables
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
    tables = [r[0] for r in cur.fetchall()]
    print("TABLES:", tables)
    
    # For each table, show columns and row count
    for t in tables:
        cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='{t}' ORDER BY ordinal_position")
        cols = cur.fetchall()
        cur.execute(f"SELECT COUNT(*) FROM {t}")
        count = cur.fetchone()[0]
        print(f"\n--- {t.upper()} ({count} rows) ---")
        for c in cols:
            print(f"  {c[0]:40s} {c[1]}")
    
    conn.close()
except Exception as e:
    print(f"ERROR: {e}")
