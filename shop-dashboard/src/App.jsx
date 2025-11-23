import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, ShoppingCart, Users, RefreshCw, 
  Moon, Sun, Monitor, Info, AlertTriangle, TrendingUp, 
  Mic, MicOff, FileText, Play, Download, Heart, Code
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// --- CONFIGURATION ---
// We use your local backend URL
const API_URL = "http://127.0.0.1:8000/api";
const PROCESS_CMD_URL = "http://127.0.0.1:8000/process-command";
const BASE_URL = "http://127.0.0.1:8000";

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('auto'); 
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Dashboard Data States
  const [stats, setStats] = useState({ total_sales: 0, low_stock_count: 0, total_credit: 0 });
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  // --- VOICE BILL STATES (Replaces script.js variables) ---
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [billCart, setBillCart] = useState([]); // This replaces 'currentCart' from script.js
  const [aiResponse, setAiResponse] = useState("");
  const [lastTxnId, setLastTxnId] = useState(null); // Replaces 'lastTransactionId'
  const recognitionRef = useRef(null);

  // --- THEME LOGIC ---
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'auto') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  // --- DATA FETCHING ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, txnsRes, prodRes, custRes] = await Promise.all([
        fetch(`${API_URL}/stats`),
        fetch(`${API_URL}/transactions`),
        fetch(`${API_URL}/products`),
        fetch(`${API_URL}/customers`)
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (txnsRes.ok) setTransactions(await txnsRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- VOICE LOGIC (Replaces script.js logic) ---
  const startListening = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event) => {
        let final_transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final_transcript += event.results[i][0].transcript;
          }
        }
        if (final_transcript) {
          setTranscript(final_transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } else {
      alert("Voice recognition not supported. Please use Chrome.");
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

const processVoiceCommand = async () => {
    if (!transcript) return;
    setLoading(true);
    setAiResponse("Processing...");

    try {
        // Map cart to backend format
        const cartContext = billCart.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity
        }));

        const response = await fetch(PROCESS_CMD_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transcript, cart_context: cartContext })
        });

        const data = await response.json();

        // 1. Play Audio
        if (data.audio_base64) {
            const audio = new Audio("data:audio/mp3;base64," + data.audio_base64);
            audio.play();
        }

        // 2. Update UI
        setAiResponse(data.message);

        // 3. Handle Cart Actions
        if (data.action_type === "add") {
            const newCart = [...billCart];
            data.cart.forEach(newItem => {
                const existing = newCart.find(i => i.product_id === newItem.product_id);
                if (existing) {
                    existing.quantity += newItem.quantity;
                    existing.total_price += newItem.total_price;
                } else {
                    newCart.push(newItem);
                }
            });
            setBillCart(newCart);
        } else if (data.action_type === "remove") {
             const idsToRemove = data.cart.map(i => i.product_id);
             setBillCart(billCart.filter(i => !idsToRemove.includes(i.product_id)));
        } else if (data.action_type === "checkout") {
            setBillCart([]); 
            if (data.transaction_id) {
                setLastTxnId(data.transaction_id); 
            }
        }

        // --- THE MAGIC FIX: FORCE DASHBOARD UPDATE ---
        // This makes the Inventory and Sales charts update instantly 
        // after ANY voice command (Creating products, checkout, etc.)
        await fetchData(); 

    } catch (error) {
        console.error("Error:", error);
        setAiResponse("Error connecting to server.");
    } finally {
        setLoading(false);
    }
  };

  const downloadBill = () => {
      if (lastTxnId) {
          window.open(`${BASE_URL}/download-bill/${lastTxnId}`, '_blank');
      } else {
          alert("No bill generated yet. Say 'Checkout' first.");
      }
  };

  // --- HEADER ---
  const Header = () => (
    <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <button onClick={() => setActiveTab('dashboard')} className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
            AgentOne
          </button>
          <nav className="hidden md:flex space-x-1">
            {['dashboard', 'inventory', 'ledger', 'voice bill'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab 
                    ? 'bg-blue-50 text-blue-700 dark:bg-gray-700 dark:text-blue-400' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab === 'dashboard' && <LayoutDashboard size={16} />}
                {tab === 'inventory' && <ShoppingCart size={16} />}
                {tab === 'ledger' && <Users size={16} />}
                {tab === 'voice bill' && <Mic size={16} />}
                <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={fetchData} disabled={loading} className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-all ${loading ? 'animate-spin text-blue-500' : ''}`}>
            <RefreshCw size={18} />
          </button>
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
          <button onClick={() => setActiveTab('about')} className={`p-2 transition-colors ${activeTab === 'about' ? 'text-blue-600 bg-blue-50 dark:bg-gray-700' : 'text-gray-500 hover:text-blue-600'}`}>
            <Info size={18} />
          </button>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex">
            {['light', 'auto', 'dark'].map((m) => (
              <button key={m} onClick={() => setTheme(m)} className={`p-1.5 rounded-md transition-all ${theme === m ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                {m === 'light' && <Sun size={14} />} {m === 'auto' && <Monitor size={14} />} {m === 'dark' && <Moon size={14} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );

  // --- VIEW: DASHBOARD ---
  const DashboardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Total Sales Today</p>
        <h3 className="text-2xl font-bold mt-1">₹{stats.total_sales}</h3>
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
        <h3 className={`text-2xl font-bold mt-1 ${stats.low_stock_count > 0 ? 'text-red-500' : 'text-gray-700'}`}>{stats.low_stock_count} Items</h3>
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">Total Credit</p>
        <h3 className="text-2xl font-bold mt-1 text-orange-500">₹{stats.total_credit}</h3>
      </div>
      <div className="md:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Live Sales Trend</h3>
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
            <LineChart data={transactions.length > 0 ? transactions.map((t, i) => ({ name: i, amount: t.total_amount })) : [{name: 0, amount: 0}]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" hide /><YAxis stroke="#9CA3AF" />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', color: '#fff' }} />
              <Line type="monotone" dataKey="amount" stroke="#4F46E5" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
          {transactions.map((txn) => (
            <div key={txn.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div><p className="font-medium text-sm">Bill #{txn.id}</p><p className="text-xs text-gray-500 dark:text-gray-400 truncate w-32">{txn.summary}</p></div>
              <span className="font-bold text-green-600">+₹{txn.total_amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // --- VIEW: INVENTORY ---
  const InventoryView = () => (
    <div className="max-w-7xl mx-auto p-6 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
           <h2 className="text-lg font-bold">Inventory Status</h2>
           <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-500">{products.length} Items</span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
            <tr><th className="px-6 py-3 text-xs uppercase">Product</th><th className="px-6 py-3 text-xs uppercase">Price</th><th className="px-6 py-3 text-xs uppercase">Stock</th><th className="px-6 py-3 text-xs uppercase">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <td className="px-6 py-4 font-medium">{p.name}</td><td className="px-6 py-4">₹{p.price}</td><td className="px-6 py-4">{p.stock_qty}</td>
                <td className="px-6 py-4">{p.stock_qty < 10 ? <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Low Stock</span> : <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">In Stock</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- VIEW: LEDGER ---
  const LedgerView = () => (
    <div className="max-w-7xl mx-auto p-6 animate-fade-in">
       <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700"><h2 className="text-lg font-bold">Customer Khata</h2></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {customers.map((c) => (
            <div key={c.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">{c.name.charAt(0).toUpperCase()}</div>
                <div><h4 className="font-bold">{c.name}</h4><p className="text-xs text-gray-500">#{c.id}</p></div>
              </div>
              <p className={`font-bold ${c.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>₹{c.balance}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // --- VIEW: VOICE BILL (THE NEW TAB!) ---
  const VoiceBillView = () => (
    <div className="max-w-7xl mx-auto p-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left: Controls (Replaces index.html buttons) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold mb-2">🎙️ Voice Terminal</h2>
                <p className="text-gray-500 text-sm">Speak items to build a bill instantly.</p>
            </div>
            
            {/* Mic Button */}
            <div className="flex justify-center mb-6">
                <button 
                  onClick={isListening ? stopListening : startListening}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${isListening ? 'bg-red-500 animate-pulse ring-4 ring-red-200' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {isListening ? <MicOff size={40} className="text-white" /> : <Mic size={40} className="text-white" />}
                </button>
            </div>

            {/* Transcript (Replaces textarea in index.html) */}
            <div className="flex-1 mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Live Transcript</label>
                <textarea 
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Transcript appears here..."
                    className="w-full h-32 p-4 rounded-lg bg-gray-50 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                />
            </div>

            {/* Actions (Process + Download) */}
            <div className="grid grid-cols-2 gap-4">
                <button 
                    onClick={processVoiceCommand}
                    disabled={loading || !transcript}
                    className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold disabled:opacity-50 transition-colors"
                >
                    <Play size={18} /> <span>Process Command</span>
                </button>
                <button 
                    onClick={downloadBill}
                    disabled={!lastTxnId}
                    className="flex items-center justify-center space-x-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                    <Download size={18} /> <span>Download PDF</span>
                </button>
            </div>

            {/* AI Feedback */}
            {aiResponse && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-gray-700/50 rounded-lg border border-blue-100 dark:border-gray-600">
                    <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">🤖 Agent: "{aiResponse}"</p>
                </div>
            )}
        </div>

        {/* Right: Live Preview (Replaces Preview Alert) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
                <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="text-blue-600" /> Live Bill Preview</h2>
                {billCart.length > 0 && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{billCart.length} Items</span>}
            </div>

            {billCart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <ShoppingCart size={48} className="mb-4 opacity-20" />
                    <p>Cart is empty.</p>
                    <p className="text-sm">Say "Add 2 Maggi" to start.</p>
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                                <tr>
                                    <th className="px-4 py-2 text-xs uppercase">Item</th>
                                    <th className="px-4 py-2 text-xs uppercase text-center">Qty</th>
                                    <th className="px-4 py-2 text-xs uppercase text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {billCart.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-3 font-medium">{item.name}</td>
                                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right">₹{item.total_price}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center text-xl font-bold">
                            <span>Total</span>
                            <span className="text-blue-600">
                                ₹{billCart.reduce((sum, item) => sum + item.total_price, 0)}
                            </span>
                        </div>
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );

  // --- VIEW: ABOUT US ---
  const AboutView = () => (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><Mic size={32} /></div>
        <h1 className="text-3xl font-bold mb-2">We are <span className="text-blue-600">Innovate Technique</span></h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">Revolutionizing local retail with the power of Voice AI.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><TrendingUp size={20} /></div><h2 className="text-xl font-bold">The Idea</h2></div>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">AgentOne is a "Hands-Free" operating system designed for Indian retailers. By using natural voice commands to handle billing, inventory, and khata, we let shopkeepers focus on what matters most—their customers.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Code size={20} /></div><h2 className="text-xl font-bold">Who We Are</h2></div>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">Innovate Technique is a team of passionate developers. We believe that advanced AI shouldn't be complicated. We build technology that is invisible, intuitive, and impactful.</p>
        </div>
      </div>
      <div className="mt-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">Made with <Heart size={14} className="text-red-500 fill-current" /> by Innovate Technique</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 text-gray-900 dark:text-gray-100 font-sans">
      <Header />
      <main className="pt-4 pb-12">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'ledger' && <LedgerView />}
        {activeTab === 'voice bill' && <VoiceBillView />}
        {activeTab === 'about' && <AboutView />}
      </main>
    </div>
  );
}

export default App;