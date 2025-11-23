import os
import json
import io
import base64
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# DB & AI Libraries
import google.generativeai as genai
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from thefuzz import process, fuzz

# Audio Library
from gtts import gTTS

# PDF Library
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

# 1. SETUP & CONFIGURATION
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is missing in .env file")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash-preview-09-2025')

app = FastAPI(title="VoiceBill AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE MODELS ---
class ProductDB(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    keywords = Column(Text)
    price = Column(Float)
    stock_qty = Column(Integer)

class CustomerDB(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    balance = Column(Float, default=0.0)

class TransactionDB(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    total_amount = Column(Float)
    summary = Column(Text)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- DATA MODELS ---

class CartItemInput(BaseModel):
    product_id: int
    quantity: int

class VoiceCommand(BaseModel):
    text: str
    cart_context: List[CartItemInput] = [] 

class CartItem(BaseModel):
    product_id: int
    name: str
    quantity: int
    unit_price: float
    total_price: float

class VoiceResponse(BaseModel):
    message: str
    cart: List[CartItem]
    action_type: str
    audio_base64: Optional[str] = None
    transaction_id: Optional[int] = None

# --- HELPER FUNCTIONS ---

def generate_audio(text: str):
    try:
        tts = gTTS(text=text, lang='en', tld='co.in')
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return base64.b64encode(fp.read()).decode('utf-8')
    except Exception as e:
        print(f"Audio Error: {e}")
        return None

def interpret_intent_with_gemini(text: str):
    prompt = f"""
    You are a cashier API. Extract data from: "{text}"
    Return JSON:
    {{
        "intent": "add_to_cart" | "remove_from_cart" | "checkout" | "check_stock" | "create_product",
        "items": [ {{ "product_name": "string", "quantity": number }} ],
        "new_product": {{ "name": "string", "price": number, "stock": number }}
    }}
    """
    try:
        response = model.generate_content(prompt)
        cleaned = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
    except Exception as e:
        return {"intent": "error"}

def fuzzy_search_db(db: Session, spoken_name: str):
    all_products = db.query(ProductDB).all()
    if not all_products: return None
    choices = {p.id: f"{p.name} {p.keywords}" for p in all_products}
    best = process.extractOne(spoken_name, choices, scorer=fuzz.token_set_ratio)
    if best and best[1] > 60:
        return db.query(ProductDB).filter(ProductDB.id == best[2]).first()
    return None

def generate_pdf_receipt(txn_id, items_summary, total_amount):
    directory = "receipts"
    if not os.path.exists(directory):
        os.makedirs(directory)
    
    filename = f"{directory}/bill_{txn_id}.pdf"
    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter
    
    c.setFont("Helvetica-Bold", 20)
    c.drawString(200, height - 50, "VOICE SHOP BILL")
    c.setFont("Helvetica", 12)
    c.drawString(50, height - 80, f"Receipt ID: #{txn_id}")
    c.drawString(50, height - 100, f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    c.line(50, height - 110, 550, height - 110)
    
    y = height - 140
    c.drawString(50, y, "ITEMS:")
    y -= 20
    c.setFont("Helvetica", 10)
    for item in items_summary:
        c.drawString(70, y, item)
        y -= 15
    
    c.line(50, y - 10, 550, y - 10)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(400, y - 40, f"TOTAL: Rs. {total_amount}")
    c.save()
    return filename

# --- MAIN API ENDPOINT ---

@app.post("/process-command", response_model=VoiceResponse)
async def process_command(command: VoiceCommand, db: Session = Depends(get_db)):
    ai_data = interpret_intent_with_gemini(command.text)
    intent = ai_data.get("intent")
    
    final_message = ""
    cart_response = []
    action = "error"
    new_txn_id = None

    if intent == "add_to_cart":
        action = "add"
        msg_parts = []
        for item in ai_data.get("items", []):
            p_name = item.get("product_name")
            qty = item.get("quantity", 1)
            product = fuzzy_search_db(db, p_name)
            if product:
                total = qty * product.price
                cart_response.append(CartItem(
                    product_id=product.id, name=product.name, quantity=qty,
                    unit_price=product.price, total_price=total
                ))
                msg_parts.append(f"{qty} {product.name}")
            else:
                msg_parts.append(f"couldn't find {p_name}")
        final_message = "Added " + ", ".join(msg_parts)

    elif intent == "create_product":
        new_prod = ai_data.get("new_product")
        if new_prod:
            try:
                db_prod = ProductDB(
                    name=new_prod['name'], 
                    keywords=new_prod['name'].lower(),
                    price=new_prod['price'],
                    stock_qty=new_prod.get('stock', 0)
                )
                db.add(db_prod)
                db.commit()
                final_message = f"Created {new_prod['name']}."
                action = "create"
            except:
                final_message = "Error creating product."

    elif intent == "checkout":
        if not command.cart_context:
            final_message = "Cart is empty."
        else:
            total_bill = 0.0
            summary_list = []
            try:
                for item in command.cart_context:
                    product = db.query(ProductDB).filter(ProductDB.id == item.product_id).first()
                    if product:
                        product.stock_qty -= item.quantity
                        item_total = product.price * item.quantity
                        total_bill += item_total
                        summary_list.append(f"{item.quantity} x {product.name} - Rs.{item_total}")

                if total_bill > 0:
                    new_txn = TransactionDB(total_amount=total_bill, summary=", ".join(summary_list))
                    db.add(new_txn)
                    db.commit()
                    db.refresh(new_txn)
                    generate_pdf_receipt(new_txn.id, summary_list, total_bill)
                    final_message = f"Bill saved. Total is {total_bill} rupees."
                    action = "checkout"
                    new_txn_id = new_txn.id
            except Exception as e:
                db.rollback()
                final_message = f"Error: {str(e)}"
    
    elif intent == "check_stock":
        msg_parts = []
        for item in ai_data.get("items", []):
            p_name = item.get("product_name")
            product = fuzzy_search_db(db, p_name)
            if product:
                msg_parts.append(f"{product.name}: {product.stock_qty} left")
        final_message = ". ".join(msg_parts)
        action = "info"

    else:
        final_message = "I didn't understand that."

    audio_data = generate_audio(final_message)

    return VoiceResponse(
        message=final_message,
        cart=cart_response,
        action_type=action,
        audio_base64=audio_data,
        transaction_id=new_txn_id
    )

@app.get("/download-bill/{txn_id}")
async def download_bill(txn_id: int):
    file_path = f"receipts/bill_{txn_id}.pdf"
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type='application/pdf', filename=f"Bill_{txn_id}.pdf")
    raise HTTPException(status_code=404, detail="Bill not found")

# --- DASHBOARD API ENDPOINTS (Restored!) ---
@app.get("/api/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    sales = db.query(TransactionDB).all()
    total_sales = sum(t.total_amount for t in sales)
    low_stock_count = db.query(ProductDB).filter(ProductDB.stock_qty < 10).count()
    customers = db.query(CustomerDB).all()
    total_credit = sum(c.balance for c in customers if c.balance > 0)
    return {"total_sales": total_sales, "low_stock_count": low_stock_count, "total_credit": total_credit}

@app.get("/api/transactions")
def get_recent_transactions(db: Session = Depends(get_db)):
    return db.query(TransactionDB).order_by(TransactionDB.id.desc()).limit(10).all()

@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    return db.query(ProductDB).all()

@app.get("/api/customers")
def get_customers(db: Session = Depends(get_db)):
    return db.query(CustomerDB).order_by(CustomerDB.balance.desc()).all()