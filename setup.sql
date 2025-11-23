CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS products;
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    keywords TEXT,
    price DECIMAL(10,2),
    stock_qty INTEGER
);

DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    balance DECIMAL(10,2) DEFAULT 0.0
);

DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    total_amount DECIMAL(10,2),
    summary TEXT
);

INSERT INTO products (name, keywords, price, stock_qty) VALUES 
('Tata Salt', 'namak salt', 20.0, 50),
('Maggi', 'noodles magi snack', 14.0, 100),
('Coke', 'cola drink soda thanda', 40.0, 24),
('Lux Soap', 'soap sabun body', 35.0, 30);

INSERT INTO customers (name, balance) VALUES ('Rahul', 500.00), ('Amit', 0.00);

SELECT * FROM products;