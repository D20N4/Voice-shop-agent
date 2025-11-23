# 🛒 Voice-Activated Retail Agent (AgentOne)

A "Hands-Free" operating system for retail shops designed to handle billing, inventory management, and customer ledgers (Khata) using natural voice commands.

![Project Status](https://img.shields.io/badge/Status-Active-green)
![Tech Stack](https://img.shields.io/badge/Stack-FullStack-blue)

## 🌟 Key Features

* **🎙️ Voice Billing:** Add items to cart using natural language (e.g., "Add 2 Maggi and 1 Coke"). Handles "Hinglish" and Indian accents.
* **🧠 AI-Powered Intent:** Uses Google Gemini 1.5 Flash to parse complex voice commands into structured JSON actions.
* **🔍 Fuzzy Search:** Finds products even if pronunciation is imperfect (e.g., "Magi" matches "Maggi Noodles") using PostgreSQL Trigrams.
* **📉 Live Dashboard:** A modern React + Tailwind UI showing real-time sales trends, low stock alerts, and ledger stats.
* **📒 Digital Khata (Ledger):** Manage customer credits and payments via voice (e.g., "Rahul paid 500 rupees").
* **📄 Automated Invoicing:** Generates downloadable PDF receipts automatically upon checkout.

## 🛠️ Tech Stack

* **Frontend:** React.js, Vite, Tailwind CSS, Recharts
* **Backend:** Python, FastAPI, SQLAlchemy
* **Database:** PostgreSQL (with `pg_trgm` extension)
* **AI & Voice:** Google Gemini API, SpeechRecognition, gTTS (Google Text-to-Speech)
* **Tools:** ReportLab (PDF), TheFuzz (Matching)

---

## 🚀 Installation & Setup

### 1. Prerequisites
* Python 3.10+
* Node.js & npm
* PostgreSQL

### 2. Database Setup
1.  Create a Postgres database named `shop_voice_db`.
2.  Run the SQL commands to create `products`, `customers`, and `transactions` tables.
3.  Enable the extension: `CREATE EXTENSION pg_trgm;`

### 3. Backend Setup (The Brain)
```bash
# Clone the repo
git clone [https://github.com/YOUR_USERNAME/voice-shop-agent.git](https://github.com/YOUR_USERNAME/voice-shop-agent.git)
cd voice-shop-agent

# Install Python dependencies
pip install -r requirements.txt

# Create .env file
# Add: DATABASE_URL=postgresql://user:pass@localhost/shop_voice_db
# Add: GEMINI_API_KEY=your_api_key

# Run Server
python -m uvicorn main:app --reload