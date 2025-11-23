import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

# 1. Load your password
load_dotenv()
# We need to modify the URL to connect to the system 'postgres' database first
original_url = os.getenv("DATABASE_URL")
# This trick replaces '/shop_voice_db' with '/postgres' so we can login to create the new one
system_url = original_url.replace("shop_voice_db", "postgres")

def fix_it():
    print("🔧 Attempting to fix database...")
    
    try:
        # Step 1: Connect to system DB to create the new Shop DB
        con = psycopg2.connect(system_url)
        con.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = con.cursor()
        
        # Check if it exists, if not create it
        try:
            cur.execute("CREATE DATABASE shop_voice_db;")
            print("✅ Database 'shop_voice_db' created successfully.")
        except psycopg2.errors.DuplicateDatabase:
            print("ℹ️ Database already exists. Skipping creation.")
        
        con.close()
        
        # Step 2: Now connect to the NEW database and create tables
        print("🏗️ Creating tables in shop_voice_db...")
        con_shop = psycopg2.connect(original_url)
        cur_shop = con_shop.cursor()
        
        # Run the Schema SQL
        cur_shop.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
        
        cur_shop.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                keywords TEXT,
                price DECIMAL(10,2),
                stock_qty INTEGER
            );
        """)
        
        cur_shop.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                balance DECIMAL(10,2) DEFAULT 0.0
            );
        """)
        
        cur_shop.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP DEFAULT NOW(),
                total_amount DECIMAL(10,2),
                summary TEXT
            );
        """)
        
        # Seed Data
        try:
            cur_shop.execute("INSERT INTO products (name, keywords, price, stock_qty) VALUES ('Maggi', 'noodles snack', 14.0, 100);")
            cur_shop.execute("INSERT INTO products (name, keywords, price, stock_qty) VALUES ('Coke', 'soda drink', 40.0, 20);")
            print("✅ Dummy data added.")
        except:
            pass # Data likely already there
            
        con_shop.commit()
        con_shop.close()
        
        print("\n🚀 FIX COMPLETE! You can now run 'uvicorn main:app --reload'")

    except Exception as e:
        print("\n❌ ERROR: Could not connect.")
        print(f"Details: {e}")
        print("Check your .env file password!")

if __name__ == "__main__":
    fix_it()