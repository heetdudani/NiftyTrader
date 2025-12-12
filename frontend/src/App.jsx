import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, TrendingUp, X, ShoppingCart, DollarSign, Activity, LayoutDashboard, BarChart2, List, PieChart, Filter, Calendar, Mail, Lock, LogIn, LogOut } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';

const API_URL = "http://localhost:8000/api";

// --- LOGIN COMPONENT ---
const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email === "dudani217@gmail.com" && password === "Heet@2004") {
      onLogin();
    } else {
      setError("Invalid Email or Password");
      // Shake animation trigger could go here
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md p-8 rounded-2xl shadow-2xl shadow-black/50">
        <div className="text-center mb-8">
          <div className="mx-auto bg-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Activity className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
          <p className="text-gray-400 text-sm mt-2">Sign in to access TradePro Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center font-bold">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase ml-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <LogIn size={18} /> Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const lotSize = 75;
  const [niftyLtp, setNiftyLtp] = useState(0);
  const [mainRows, setMainRows] = useState([]);
  const [positions, setPositions] = useState([]);
  const [strikes, setStrikes] = useState([]);
  const [todayRealized, setTodayRealized] = useState(0);

  // --- REFS FOR INTERVAL ACCESS ---
  const mainRowsRef = React.useRef(mainRows);
  const positionsRef = React.useRef(positions);

  // Sync Refs with State
  useEffect(() => { mainRowsRef.current = mainRows; }, [mainRows]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState(null);
  const [selectedStrike, setSelectedStrike] = useState("");

  // --- 1. INITIAL LOAD & TIMERS ---
  useEffect(() => {
    fetchNifty();
    fetchInitialRows();
    fetchStrikes();
    fetchPositions();
    fetchTodayRealized();

    const priceInterval = setInterval(() => {
      fetchNifty();
      updatePrices(); 
    }, 1000);

    const greekInterval = setInterval(() => {
      updateGreeks();
    }, 10000);

    return () => {
      clearInterval(priceInterval);
      clearInterval(greekInterval);
    };
  }, []); 

  // --- 2. API CALLS ---
  const fetchNifty = async () => {
    try {
      const res = await fetch(`${API_URL}/nifty-ltp`);
      const data = await res.json();
      setNiftyLtp(data.ltp);
    } catch (e) { }
  };

  const fetchInitialRows = async () => {
    try {
      const res = await fetch(`${API_URL}/initial-rows`);
      const data = await res.json();
      setMainRows(data.map(r => ({ ...r, disabled: false })));
    } catch (e) { console.error("Start Backend first!"); }
  };

  const updateGreeks = async () => {
    try {
      const res = await fetch(`${API_URL}/initial-rows`);
      const data = await res.json();

      setMainRows(prev => prev.map(oldRow => {
        const freshRow = data.find(d => d.token === oldRow.token);
        if (freshRow) {
          return {
            ...oldRow,
            iv: freshRow.iv,
            delta: freshRow.delta
          };
        }
        return oldRow;
      }));
    } catch (e) { }
  };

  const fetchStrikes = async () => {
    try {
      const res = await fetch(`${API_URL}/strikes`);
      const data = await res.json();
      setStrikes(data);
    } catch (e) { }
  };

  const fetchPositions = async () => {
    try {
      const res = await fetch(`${API_URL}/positions`);
      const data = await res.json();
      setPositions(data);
    } catch (e) { }
  };

  // NEW: Fetch logs to calculate Realized Profit for Today
  const fetchTodayRealized = async () => {
    try {
      const res = await fetch(`${API_URL}/trade-logs`);
      const data = await res.json();
      const todayStr = new Date().toDateString();
      
      const sum = data.reduce((acc, log) => {
        // Check if trade is closed AND bought (closed) today
        if (log.Status === "CLOSED" && log["Buy Date Time"]) {
             const logDate = new Date(log["Buy Date Time"]).toDateString();
             if (logDate === todayStr) {
                 return acc + (log.Profit || 0);
             }
        }
        return acc;
      }, 0);
      setTodayRealized(sum);
    } catch (e) { }
  };

  const updatePrices = async () => {
    const currentRows = mainRowsRef.current;
    const currentPositions = positionsRef.current;

    const tokens = [
      ...currentRows.map(r => r.token),
      ...currentPositions.map(r => r.token)
    ].join(',');

    if (!tokens) return;

    try {
      const res = await fetch(`${API_URL}/refresh-prices?tokens=${tokens}`);
      const prices = await res.json();

      setMainRows(prev => prev.map(row => ({
        ...row,
        ltp: prices[row.token] || row.ltp
      })));

      setPositions(prev => prev.map(row => ({
        ...row,
        currentLtp: prices[row.token] || row.currentLtp
      })));
    } catch (e) { }
  };


  // --- 3. INTERACTION LOGIC ---

  // --- LOGIC TO HIGHLIGHT ROWS IF DIFF <= 1 ---
  const watchlistHighlight = useMemo(() => {
    // We assume the watchlist typically has 2 rows (e.g. CE and PE pair)
    if (mainRows.length < 2) return false;
    
    const price1 = parseFloat(mainRows[0].ltp) || 0;
    const price2 = parseFloat(mainRows[1].ltp) || 0;
    
    return Math.abs(price1 - price2) <= 1;
  }, [mainRows]);

  const openUpdateModal = (index) => {
    setEditingRowIndex(index);
    setIsModalOpen(true);
  };

  const handleUpdateRow = async () => {
    if (!selectedStrike) return;
    const existingRow = mainRows[editingRowIndex];
    const type = existingRow.symbol.includes("CE") ? "CE" : "PE";

    try {
      const res = await fetch(`${API_URL}/get-row`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strike: selectedStrike, type: type })
      });

      if (!res.ok) throw new Error("Not found");
      const newData = await res.json();

      const newRows = [...mainRows];
      newRows[editingRowIndex] = { ...newData, disabled: false };
      setMainRows(newRows);

      setIsModalOpen(false);
      setSelectedStrike("");
    } catch (err) {
      alert("Strike not found in JSON data!");
    }
  };

  const handleSell = async (index) => {
    const row = mainRows[index];
    const orderData = {
      strike: String(parseInt(row.strike)),
      type: row.symbol.includes('CE') ? 'CE' : 'PE',
      token: String(row.token),
      buyltp: parseFloat(row.ltp)
    };

    try {
      await fetch(`${API_URL}/log-sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      fetchPositions();
    } catch (e) { console.error("Failed to log sell:", e); }

    const newPos = {
      ...row,
      buyltp: row.ltp,
      currentLtp: row.ltp,
      uniqueId: Date.now() + Math.random()
    };
    setPositions([...positions, newPos]);
  };

  const handleSellAll = async () => {
    const rowsToSell = mainRows;
    if (rowsToSell.length === 0) return;

    const ordersPayload = rowsToSell.map(row => ({
      strike: String(parseInt(row.strike)),
      type: row.symbol.includes('CE') ? 'CE' : 'PE',
      token: String(row.token),
      buyltp: parseFloat(row.ltp)
    }));

    try {
      await fetch(`${API_URL}/log-sell-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: ordersPayload })
      });
      fetchPositions();
    } catch (e) { console.error("Failed to log bulk sell:", e); }

    const newPositions = [];
    rowsToSell.forEach(row => {
      newPositions.push({
        ...row,
        buyltp: row.ltp,
        currentLtp: row.ltp,
        uniqueId: Date.now() + Math.random()
      });
    });
    setPositions([...positions, ...newPositions]);
  };

  const handleBuy = async (token) => {
    try {
      await fetch(`${API_URL}/buy-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: String(token) })
      });
      setPositions(prev => prev.filter(p => p.token !== token));
      // Refresh realized profit after closing a trade
      fetchTodayRealized();
    } catch (e) { console.error("Failed to sync buy:", e); }
  };

  const handleBuyAll = async () => {
    try {
      await fetch(`${API_URL}/buy-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      setPositions([]);
      // Refresh realized profit after closing trades
      fetchTodayRealized(); 
    } catch (e) { console.error("Failed to sync buy all:", e); }
  };

  // --- HELPER: GROUP POSITIONS BY STRIKE ---
  const groupedPositions = positions.reduce((acc, pos) => {
    const s = parseInt(pos.strike);
    if (!acc[s]) acc[s] = { ce: null, pe: null };
    if (pos.symbol.includes('CE')) acc[s].ce = pos;
    else acc[s].pe = pos;
    return acc;
  }, {});

  const sortedStrikes = Object.keys(groupedPositions).sort((a, b) => a - b);

  // --- CALCULATE OPEN P&L ---
  const openProfit = positions.reduce((acc, pos) => {
    const buy = pos.buyltp || 0;
    const cur = pos.currentLtp || 0;
    return acc + ((buy - cur) * lotSize);
  }, 0);

  // Total Daily Profit = Realized (Today) + Open P&L
  const totalDailyProfit = todayRealized + openProfit;

  const StandardCells = ({ pos }) => {
    const buy = pos.buyltp || 0;
    const cur = pos.currentLtp || 0;
    const profit = (buy - cur) * lotSize;
    const isProfit = profit >= 0;

    return (
      <>
        <td className="px-4 py-3 font-mono text-gray-300 whitespace-nowrap">{parseInt(pos.strike)}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pos.symbol.includes('CE') ? 'text-green-300 bg-green-900/30' : 'text-red-300 bg-red-900/30'}`}>
            {pos.symbol.includes('CE') ? 'CE' : 'PE'}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-gray-400 font-mono whitespace-nowrap">{buy.toFixed(2)}</td>
        <td className="px-4 py-3 text-right text-white font-bold font-mono whitespace-nowrap">{cur.toFixed(2)}</td>
        <td className={`px-4 py-3 text-right font-mono font-bold whitespace-nowrap ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
          {profit.toFixed(2)}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <button onClick={() => handleBuy(pos.token)} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95">
            BUY
          </button>
        </td>
      </>
    );
  };

  return (
    <div className="pb-28 relative min-h-screen">
      {/* HEADER */}
      <div className="flex justify-center pt-8 pb-6 px-4">
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 px-6 sm:px-10 py-4 rounded-3xl shadow-2xl shadow-blue-900/20 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent group-hover:translate-x-full transition-transform duration-1000"></div>
          <div className="text-gray-400 text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase mb-1">NIFTY 50 INDEX</div>
          <div className="text-4xl sm:text-5xl font-mono font-bold text-white flex items-center justify-center gap-3">
            {niftyLtp.toFixed(2)}
            <span className="flex h-2 w-2 sm:h-3 sm:w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-full w-full bg-green-500"></span>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mt-4">

        {/* --- MAIN TABLE (WATCHLIST) --- */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 overflow-hidden shadow-xl h-fit">
          <div className="p-4 sm:p-5 border-b border-slate-700 flex flex-wrap justify-between items-center bg-slate-800 gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-blue-400 flex items-center gap-2">
              <TrendingUp size={20} /> Watchlist
            </h2>
            <button onClick={handleSellAll} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95 flex items-center gap-2">
              <DollarSign size={14} /> SELL ALL
            </button>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Strike</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Type</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">LTP</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">IV</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">Delta</th>
                  <th className="px-4 py-4 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">

                {mainRows.map((row, idx) => {
                  return (
                    <tr key={idx} className={`transition-all hover:bg-slate-700/30`}>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button onClick={() => openUpdateModal(idx)} className="bg-slate-700 hover:bg-blue-600 text-blue-200 px-3 py-1 rounded border border-slate-600 font-mono transition-colors">
                          {parseInt(row.strike)}
                        </button>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${row.symbol.includes('CE') ? 'text-green-400 bg-green-900/30' : 'text-red-400 bg-red-900/30'}`}>
                          {row.symbol.includes('CE') ? 'CE' : 'PE'}
                        </span>
                      </td>
                      {/* --- LTP CELL HIGHLIGHT ONLY --- */}
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <span className={`px-3 py-1.5 rounded-md font-mono text-base transition-all duration-300 ${watchlistHighlight ? 'bg-green-500 text-white shadow-lg shadow-green-500/40 font-bold scale-110 inline-block' : 'text-white'}`}>
                          {typeof row.ltp === 'number' ? row.ltp.toFixed(2) : row.ltp}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-400 font-mono whitespace-nowrap">{row.iv}</td>
                      <td className="px-4 py-4 text-right text-gray-400 font-mono whitespace-nowrap">{row.delta}</td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <button onClick={() => handleSell(idx)} className="bg-red-500/90 hover:bg-red-500 text-white px-6 py-1.5 rounded-md font-bold text-xs shadow-lg shadow-red-500/20 transition-all active:scale-95">
                          SELL
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- POSITION TABLE --- */}
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 overflow-hidden shadow-xl h-fit">
          <div className="p-4 sm:p-5 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-800 gap-4">
            <h2 className="text-lg sm:text-xl font-bold text-purple-400 flex items-center gap-2">
              <ShoppingCart size={20} /> Positions
            </h2>
            <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-4">
              <div className={`text-base font-mono font-bold ${openProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                Open P&L: {openProfit.toFixed(2)}
              </div>
              <button onClick={handleBuyAll} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2">
                <RefreshCcw size={14} /> BUY ALL
              </button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Strike</th>
                  <th className="px-4 py-4 text-left whitespace-nowrap">Type</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">Buy Price</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">Cur. Price</th>
                  <th className="px-4 py-4 text-right whitespace-nowrap">Profit</th>
                  <th className="px-4 py-4 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-500 italic">No open positions</td>
                  </tr>
                ) : (
                  sortedStrikes.map(strike => {
                    const { ce, pe } = groupedPositions[strike];
                    return (
                      <React.Fragment key={strike}>
                        {ce && (<tr className="hover:bg-slate-700/30 transition-colors"><StandardCells pos={ce} /></tr>)}
                        {pe && (<tr className="hover:bg-slate-700/30 transition-colors"><StandardCells pos={pe} /></tr>)}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD STICKY FOOTER --- */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-600 px-8 py-3 rounded-full shadow-2xl flex items-center gap-4">
          <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Today's Profit</span>
          <div className={`text-2xl font-mono font-bold ${totalDailyProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalDailyProfit >= 0 ? '+' : ''}{totalDailyProfit.toFixed(2)}
          </div>
        </div>
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-2xl p-6 shadow-2xl transform transition-all scale-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity size={18} className="text-yellow-400" /> Change Strike
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-gray-400 text-xs uppercase font-bold mb-2 ml-1">Select New Strike</label>
              <select
                value={selectedStrike}
                onChange={(e) => setSelectedStrike(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-lg appearance-none cursor-pointer"
              >
                <option value="">-- Select Strike --</option>
                {strikes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button
              onClick={handleUpdateRow}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-95"
            >
              Update Watchlist
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- COMPONENT: ANALYSIS ---
const Analysis = () => {
  const [logs, setLogs] = useState([]);
  const [viewType, setViewType] = useState('table'); 

  const [filters, setFilters] = useState({
    optionType: 'ALL', 
    outcome: 'ALL',    
    timeframe: 'ALL',  
  });

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); 
    return () => clearInterval(interval);
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/trade-logs`);
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Failed to fetch logs");
    }
  };

  const filteredLogs = useMemo(() => {
    const now = new Date();
    return logs.filter(log => {
      // 1. Option Type
      if (filters.optionType !== 'ALL' && log.Type !== filters.optionType) return false;

      // 2. Outcome (Profit vs Loss)
      if (filters.outcome !== 'ALL') {
        const pnl = log.Profit;
        if (pnl === null || pnl === undefined) return false; 
        if (filters.outcome === 'PROFIT' && pnl <= 0) return false;
        if (filters.outcome === 'LOSS' && pnl >= 0) return false;
      }

      // 3. Timeframe (Based on Sell Date Time)
      if (filters.timeframe !== 'ALL' && log["Sell Date Time"]) {
        const logDate = new Date(log["Sell Date Time"]);
        const d1 = new Date(logDate.toDateString());
        const d2 = new Date(now.toDateString());

        if (filters.timeframe === 'DAY') {
          if (d1.getTime() !== d2.getTime()) return false;
        } else if (filters.timeframe === 'WEEK') {
          const diffTime = Math.abs(d2 - d1);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 7) return false;
        } else if (filters.timeframe === 'MONTH') {
          if (logDate.getMonth() !== now.getMonth() || logDate.getFullYear() !== now.getFullYear()) return false;
        }
      }
      return true;
    });
  }, [logs, filters]);

  // --- Calculate Filtered Total Profit ---
  const filteredTotalProfit = useMemo(() => {
    return filteredLogs.reduce((acc, log) => {
      if (log.Profit !== null && log.Profit !== undefined) {
        return acc + log.Profit;
      }
      return acc;
    }, 0);
  }, [filteredLogs]);

  // --- CHART DATA PREP ---
  const strikeData = filteredLogs.reduce((acc, log) => {
    const s = parseInt(log.Strike);
    const existing = acc.find(item => item.strike === s);
    if (existing) existing.count += 1;
    else acc.push({ strike: s, count: 1 });
    return acc;
  }, []).sort((a, b) => a.strike - b.strike);

  const profitData = filteredLogs
    .filter(log => log.Profit !== null && log.Profit !== undefined)
    .map((log, i) => ({
      id: i + 1,
      time: log["Sell Date Time"],
      strike: log.Strike,
      type: log.Type,
      profit: log.Profit
    }));

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 mt-8 pb-28 relative min-h-screen">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="text-blue-500" /> Trade Analysis
        </h2>

        <div className="flex flex-wrap gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700 w-full xl:w-auto items-center">
          <div className="hidden md:flex items-center px-2 text-gray-400"><Filter size={18} /></div>

          <select value={filters.timeframe} onChange={(e) => handleFilterChange('timeframe', e.target.value)} className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 outline-none">
            <option value="ALL">All Time</option>
            <option value="MONTH">This Month</option>
            <option value="WEEK">This Week</option>
            <option value="DAY">Today</option>
          </select>

          <select value={filters.optionType} onChange={(e) => handleFilterChange('optionType', e.target.value)} className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 outline-none">
            <option value="ALL">CE & PE</option>
            <option value="CE">CE Only</option>
            <option value="PE">PE Only</option>
          </select>

          <select value={filters.outcome} onChange={(e) => handleFilterChange('outcome', e.target.value)} className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 outline-none">
            <option value="ALL">All P&L</option>
            <option value="PROFIT">Profit Only</option>
            <option value="LOSS">Loss Only</option>
          </select>
        </div>

        <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex shrink-0 w-full xl:w-auto">
          <button onClick={() => setViewType('chart')} className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewType === 'chart' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><PieChart size={16} /> Visuals</button>
          <button onClick={() => setViewType('table')} className={`flex-1 flex justify-center items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewType === 'table' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><List size={16} /> Logs</button>
        </div>
      </div>

      {viewType === 'chart' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-300 mb-4">Trades by Strike</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strikeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="strike" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} width={30} />
                  <Tooltip cursor={{ fill: '#334155', opacity: 0.4 }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
                    {strikeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8b5cf6' : '#a78bfa'} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 p-4 sm:p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2"><DollarSign size={20} className="text-green-400" /> Realized P&L</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="id" stroke="#94a3b8" fontSize={12} tick={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} width={40} />
                  <Tooltip cursor={{ fill: '#334155', opacity: 0.4 }} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                  <ReferenceLine y={0} stroke="#475569" />
                  <Bar dataKey="profit" radius={[2, 2, 0, 0]}>
                    {profitData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#4ade80' : '#f87171'} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Strike</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Type</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Sell Time</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Sell LTP</th>
                  <th className="px-6 py-4 text-left whitespace-nowrap">Buy Time</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Buy LTP</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Nifty Spot</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No logs found.</td></tr>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-3 font-mono font-bold text-blue-300 whitespace-nowrap">{log.Strike ? parseInt(log.Strike) : '-'}</td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`uppercase font-bold text-xs px-2 py-1 rounded ${log.Type === 'CE' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>{log.Type}</span>
                      </td>
                      <td className="px-6 py-3 font-mono text-gray-400 whitespace-nowrap text-xs">{log["Sell Date Time"]}</td>
                      <td className="px-6 py-3 text-right font-mono text-white whitespace-nowrap">{log["Sell LTP"]?.toFixed(2)}</td>
                      <td className="px-6 py-3 font-mono text-gray-400 whitespace-nowrap text-xs">{log["Buy Date Time"] || '-'}</td>
                      <td className="px-6 py-3 text-right font-mono text-white whitespace-nowrap">{log["Buy LTP"] ? log["Buy LTP"].toFixed(2) : '-'}</td>
                      <td className="px-6 py-3 text-right font-mono text-gray-400 whitespace-nowrap">{log["Nifty Price"]?.toFixed(2)}</td>
                      <td className={`px-6 py-3 text-right font-mono font-bold whitespace-nowrap ${
                        (log.Profit !== null && log.Profit !== undefined) 
                          ? (log.Profit >= 0 ? 'text-green-400' : 'text-red-400') 
                          : 'text-gray-500'
                      }`}>
                        {(log.Profit !== null && log.Profit !== undefined) ? log.Profit.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* --- ANALYSIS STICKY FOOTER --- */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className="bg-slate-800/90 backdrop-blur-xl border border-slate-600 px-8 py-3 rounded-full shadow-2xl flex items-center gap-4">
          <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Filtered Profit</span>
          <div className={`text-2xl font-mono font-bold ${filteredTotalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {filteredTotalProfit >= 0 ? '+' : ''}{filteredTotalProfit.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-blue-500 selection:text-white">
      <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-auto md:h-16 py-3 md:py-0 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Activity size={20} className="text-white" /></div>
            <span className="font-bold text-xl tracking-tight">Trade<span className="text-blue-500">Pro</span></span>
          </div>
          <div className="flex bg-slate-800 p-1 rounded-xl w-full sm:w-auto justify-center sm:justify-start">
            <button onClick={() => setActiveTab("dashboard")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "dashboard" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-white hover:bg-slate-700"}`}><LayoutDashboard size={16} /> Dashboard</button>
            <button onClick={() => setActiveTab("analysis")} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "analysis" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-white hover:bg-slate-700"}`}><BarChart2 size={16} /> Analysis</button>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div></div>
            <button onClick={() => setIsAuthenticated(false)} className="text-gray-400 hover:text-red-400 transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </div>
      <div className="pt-4">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "analysis" && <Analysis />}
      </div>
    </div>
  );
}
