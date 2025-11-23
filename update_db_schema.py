import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("DATABASE_URL")

def update_schema():
    try:
        con = psycopg2.connect(url)
        cur = con.cursor()
        
        print("🔄 Updating Database Schema...")
        
        # 1. Ensure Customers Table exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                balance DECIMAL(10,2) DEFAULT 0.0
            );
        """)
        
        # 2. Ensure Transactions Table exists (with summary)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP DEFAULT NOW(),
                total_amount DECIMAL(10,2),
                summary TEXT
            );
        """)
        
        con.commit()
        con.close()
        print("✅ Database updated successfully! You can now use Khata features.")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    update_schema()