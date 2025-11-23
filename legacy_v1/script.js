const recordBtn = document.getElementById("recordBtn");
const transcriptBox = document.getElementById("transcript");
const output = document.getElementById("output");
const generateBtn = document.getElementById("generateBtn");
const previewBtn = document.getElementById("previewBtn");
const downloadBtn = document.getElementById("downloadBtn");

let currentCart = [];
let lastTransactionId = null; // Store the ID of the last generated bill

// UPDATE THIS URL IF DEPLOYING TO RENDER
const API_URL = "https://shopbackend-o425.onrender.com/process-command"; 
// If downloading files, we need the base URL without "/process-command"
const BASE_URL = "https://shopbackend-o425.onrender.com";

let recognition;

if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = true; 
    recognition.lang = "en-IN"; 

    recognition.onstart = () => {
        recordBtn.innerText = "👂 Listening...";
        recordBtn.style.backgroundColor = "#ff4b2b";
        transcriptBox.placeholder = "Listening...";
    };

    recognition.onend = () => {
        recordBtn.innerText = "🎤 Tap to Speak";
        recordBtn.style.backgroundColor = "#00f2fe";
    };

    recognition.onresult = function (event) {
        let final_transcript = "";
        let interim_transcript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final_transcript += event.results[i][0].transcript;
            } else {
                interim_transcript += event.results[i][0].transcript;
            }
        }
        if (final_transcript) {
            transcriptBox.value = final_transcript;
        } else {
            transcriptBox.value = interim_transcript;
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
    };
} else {
    alert("Voice recognition not supported. Use Chrome/Edge.");
}

recordBtn.addEventListener("click", () => {
    if (recognition) recognition.start();
});

generateBtn.addEventListener("click", async () => {
    const text = transcriptBox.value.trim();
    if (!text) return;

    output.innerHTML = "<i>Processing...</i>";

    try {
        const cartContext = currentCart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity
        }));

        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text, cart_context: cartContext })
        });

        const data = await response.json();

        // 1. PLAY SERVER AUDIO (High Quality)
        if (data.audio_base64) {
            playServerAudio(data.audio_base64);
        } else {
            speakResponse(data.message);
        }

        // 2. Save Transaction ID if checkout happened
        if (data.action_type === "checkout" && data.transaction_id) {
            lastTransactionId = data.transaction_id;
            console.log("Bill Generated with ID:", lastTransactionId);
        }

        handleServerResponse(data);
        renderCart();
        output.innerHTML = `<p style="color: #4facfe; font-weight: bold;">🤖 ${data.message}</p>`;

    } catch (error) {
        console.error(error);
        output.innerHTML = `<p style="color: red;">❌ Error: ${error.message}</p>`;
    }
});

// --- NEW BUTTON LOGIC ---

previewBtn.addEventListener("click", () => {
    if (currentCart.length === 0) {
        alert("Cart is empty! Add items first.");
        return;
    }
    // Simple alert preview for now
    let previewText = "PREVIEW:\n";
    let total = 0;
    currentCart.forEach(item => {
        previewText += `${item.name} x ${item.quantity} = ₹${item.total_price}\n`;
        total += item.total_price;
    });
    previewText += `\nTOTAL: ₹${total}`;
    alert(previewText);
});

downloadBtn.addEventListener("click", () => {
    if (lastTransactionId) {
        // Open the download URL in a new tab
        const downloadUrl = `${BASE_URL}/download-bill/${lastTransactionId}`;
        window.open(downloadUrl, '_blank');
    } else {
        alert("No bill generated yet! Say 'Checkout' or click Generate Bill first.");
    }
});

// --- NEW AUDIO PLAYER ---
function playServerAudio(base64String) {
    const audio = new Audio("data:audio/mp3;base64," + base64String);
    audio.play();
}

// --- HELPER FUNCTIONS ---

function handleServerResponse(data) {
    if (data.action_type === "add") {
        data.cart.forEach(newItem => {
            const existing = currentCart.find(i => i.product_id === newItem.product_id);
            if (existing) {
                existing.quantity += newItem.quantity;
                existing.total_price += newItem.total_price;
            } else {
                currentCart.push(newItem);
            }
        });
    } 
    else if (data.action_type === "remove") {
        const idsToRemove = data.cart.map(i => i.product_id);
        currentCart = currentCart.filter(i => !idsToRemove.includes(i.product_id));
    }
    else if (data.action_type === "checkout") {
        currentCart = []; 
    }
}

function renderCart() {
    const cartContainer = document.getElementById("cart-display") || createCartContainer();
    if (currentCart.length === 0) {
        cartContainer.innerHTML = ""; 
        return;
    }
    let html = `<div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 10px; margin-top: 20px;">
        <table style="width:100%; text-align:left; font-size:14px; color: white; border-collapse: collapse;">
        <tr style="border-bottom:1px solid white;"><th>Item</th><th>Qty</th><th>Price</th></tr>`;
    let grandTotal = 0;
    currentCart.forEach(item => {
        html += `<tr><td>${item.name}</td><td>${item.quantity}</td><td>₹${item.total_price}</td></tr>`;
        grandTotal += item.total_price;
    });
    html += `</table><h3 style="text-align:right; margin-top:10px; color: #00f2fe;">Total: ₹${grandTotal}</h3></div>`;
    cartContainer.innerHTML = html;
}

function createCartContainer() {
    const div = document.createElement("div");
    div.id = "cart-display";
    document.querySelector(".container").appendChild(div);
    return div;
}

function speakResponse(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
}