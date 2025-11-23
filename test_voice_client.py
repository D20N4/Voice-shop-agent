import speech_recognition as sr
import requests
import pyttsx3
import time

# CONFIGURATION
API_URL = "http://127.0.0.1:8000/process-command"

# GLOBAL STATE (The Client Memory)
CURRENT_CART = [] 

# Initialize Text-to-Speech engine
engine = pyttsx3.init()
engine.setProperty('rate', 150) 

def speak(text):
    print(f"🗣️ Shopkeeper App: {text}")
    engine.say(text)
    engine.runAndWait()

def update_local_cart(action_type, server_cart_items):
    """
    Updates the CURRENT_CART list based on what the server returned.
    """
    global CURRENT_CART
    
    if action_type == "add":
        # Add new items to our local memory
        for item in server_cart_items:
            # Check if item already exists to merge quantities
            found = False
            for existing in CURRENT_CART:
                if existing['product_id'] == item['product_id']:
                    existing['quantity'] += item['quantity']
                    existing['total_price'] += item['total_price']
                    found = True
                    break
            if not found:
                CURRENT_CART.append(item)
                
    elif action_type == "remove":
        # Simple remove logic: If server says removed, we clear those items locally
        # In a complex app, we'd decrease specific quantities
        items_to_remove = [i['product_id'] for i in server_cart_items]
        CURRENT_CART = [c for c in CURRENT_CART if c['product_id'] not in items_to_remove]
        
    elif action_type == "checkout":
        # Clear cart after successful checkout
        CURRENT_CART = []

def listen_and_process():
    recognizer = sr.Recognizer()
    
    with sr.Microphone() as source:
        print("\nAdjusting for ambient noise... (Wait)")
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        
        # Display current cart status
        cart_count = sum(i['quantity'] for i in CURRENT_CART)
        print(f"✅ Ready! (Items in Memory: {cart_count})")
        
        try:
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=8)
            print("Processing...")
            
            text = recognizer.recognize_google(audio, language="en-IN")
            print(f"🎤 You said: '{text}'")
            
            # PREPARE PAYLOAD
            # We must send the 'cart_context' so the backend knows what we have
            context = [{"product_id": i['product_id'], "quantity": i['quantity']} for i in CURRENT_CART]
            
            payload = {
                "text": text,
                "cart_context": context
            }
            
            print("📡 Sending to Backend...")
            response = requests.post(API_URL, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                
                # 1. Update Local Memory
                update_local_cart(data['action_type'], data.get('cart', []))
                
                # 2. Speak Response
                speak(data['message'])
                
                # 3. Print Cart to Screen
                if CURRENT_CART:
                    print("\n--- 🛒 YOUR CART ---")
                    total_val = 0
                    for item in CURRENT_CART:
                        print(f"- {item['name']}: {item['quantity']} units (Rs. {item['unit_price']}/each)")
                        total_val += (item['quantity'] * item['unit_price'])
                    print(f"   Total Value: Rs. {total_val}")
                    print("--------------------")
                else:
                    print("\n[Cart is Empty]")
                    
            else:
                speak("Server error.")
                print(response.text)

        except sr.UnknownValueError:
            print("❌ Could not understand audio.")
        except sr.RequestError:
            print("❌ Internet connection failed.")
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    speak("System Online. Memory Active.")
    while True:
        # Automatically loop, or wait for Enter? 
        # Let's wait for Enter to prevent it listening to its own voice
        input("\nPress Enter to speak...")
        listen_and_process()
