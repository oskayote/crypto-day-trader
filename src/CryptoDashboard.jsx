import { useState, useEffect, useCallback, useRef } from "react";

const COINS = [
  { id:"bitcoin",symbol:"BTC",name:"Bitcoin",binance:"BTCUSDT",cc:"BTC",kraken:"XXBTZUSD",krakenWs:"XBT/USD",krakenOhlc:"XXBTZUSD" },
  { id:"ethereum",symbol:"ETH",name:"Ethereum",binance:"ETHUSDT",cc:"ETH",kraken:"XETHZUSD",krakenWs:"ETH/USD",krakenOhlc:"XETHZUSD" },
  { id:"solana",symbol:"SOL",name:"Solana",binance:"SOLUSDT",cc:"SOL",kraken:"SOLUSD",krakenWs:"SOL/USD",krakenOhlc:"SOLUSD" },
  { id:"ripple",symbol:"XRP",name:"Ripple",binance:"XRPUSDT",cc:"XRP",kraken:"XXRPZUSD",krakenWs:"XRP/USD",krakenOhlc:"XXRPZUSD" },
  { id:"cardano",symbol:"ADA",name:"Cardano",binance:"ADAUSDT",cc:"ADA",kraken:"ADAUSD",krakenWs:"ADA/USD",krakenOhlc:"ADAUSD" },
  { id:"dogecoin",symbol:"DOGE",name:"Dogecoin",binance:"DOGEUSDT",cc:"DOGE",kraken:"XDGUSD",krakenWs:"DOGE/USD",krakenOhlc:"XDGUSD" },
  { id:"polkadot",symbol:"DOT",name:"Polkadot",binance:"DOTUSDT",cc:"DOT",kraken:"DOTUSD",krakenWs:"DOT/USD",krakenOhlc:"DOTUSD" },
  { id:"avalanche-2",symbol:"AVAX",name:"Avalanche",binance:"AVAXUSDT",cc:"AVAX",kraken:"AVAXUSD",krakenWs:"AVAX/USD",krakenOhlc:"AVAXUSD" },
  { id:"chainlink",symbol:"LINK",name:"Chainlink",binance:"LINKUSDT",cc:"LINK",kraken:"LINKUSD",krakenWs:"LINK/USD",krakenOhlc:"LINKUSD" },
  { id:"polygon",symbol:"POL",name:"Polygon",binance:"POLUSDT",cc:"POL",kraken:"POLUSD",krakenWs:"POL/USD",krakenOhlc:"POLUSD" },
];

const KRAKEN_FEE_TIERS = [
  { label:"Starter (< $50K)",maker:0.16,taker:0.26 },
  { label:"Intermediate ($50K–$100K)",maker:0.14,taker:0.24 },
  { label:"Advanced ($100K–$250K)",maker:0.12,taker:0.22 },
  { label:"Pro ($250K–$500K)",maker:0.08,taker:0.18 },
  { label:"Expert ($500K–$1M)",maker:0.04,taker:0.14 },
  { label:"Elite ($1M+)",maker:0.00,taker:0.10 },
];

const FALLBACK = {
  bitcoin:{price:84250,change:-0.8,high:85600,low:83100,vol:28.5},
  ethereum:{price:1835,change:1.2,high:1870,low:1810,vol:9.8},
  solana:{price:138.5,change:-2.1,high:143.2,low:136.8,vol:3.2},
  ripple:{price:2.34,change:3.5,high:2.41,low:2.22,vol:2.8},
  cardano:{price:0.71,change:-0.4,high:0.73,low:0.69,vol:0.8},
  dogecoin:{price:0.168,change:1.8,high:0.174,low:0.162,vol:1.4},
  "polkadot":{price:4.12,change:0.6,high:4.25,low:4.02,vol:0.5},
  "avalanche-2":{price:21.4,change:-1.5,high:22.1,low:20.9,vol:0.7},
  "chainlink":{price:13.8,change:2.3,high:14.1,low:13.4,vol:0.9},
  "polygon":{price:0.22,change:-0.3,high:0.225,low:0.215,vol:0.3},
};

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => { const h = () => setW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);
  return w;
}

function fmt(v) {
  if (v == null || isNaN(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(v) >= 1) return v.toFixed(2);
  if (Math.abs(v) >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

function genSparkline(base, change) {
  const d = []; let v = base * (1 - Math.abs(change) / 100);
  for (let i = 0; i < 48; i++) { v += v * ((change > 0 ? 0.3 : -0.3) + (Math.random() - 0.5) * 1.2) / 100; d.push(v); }
  return d;
}

function MiniChart({ data, color, mobile }) {
  if (!data || data.length < 2) return null;
  const h = mobile ? 35 : 40, w = mobile ? 100 : 120;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const gid = `g${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function ConfidenceBar({ value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1e293b" }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: 3, background: value >= 70 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444" }} />
      </div>
      <span style={{ fontSize: 12, color: "#94a3b8", minWidth: 32 }}>{value}%</span>
    </div>
  );
}

function TradeExamplesMobile({ trade, amounts, fees }) {
  const ep = (trade.entryLow + trade.entryHigh) / 2, tp = (trade.targetLow + trade.targetHigh) / 2, sp = trade.stop;
  const entryFee = fees.taker / 100, exitFee = fees.maker / 100;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
        Trade Examples <span style={{ color: "#f97316", fontWeight: 700 }}>• Kraken Fees</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {amounts.map((amt, i) => {
          const coins = amt / ep, gt = coins * tp, gs = coins * sp;
          const nt = gt * (1 - exitFee) - amt * (1 + entryFee) + amt, ns = gs * (1 - exitFee) - amt * (1 + entryFee) + amt;
          const np = (nt / amt) * 100, nl = (ns / amt) * 100;
          const tf = (amt * entryFee) + (gt * exitFee);
          return (
            <div key={i} style={{ background: "#0a0e17", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 8 }}>${amt.toLocaleString()}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><div style={{ fontSize: 10, color: "#64748b" }}>COINS</div><div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{fmt(coins)}</div></div>
                <div><div style={{ fontSize: 10, color: "#64748b" }}>FEES</div><div style={{ fontSize: 13, color: "#f97316", fontWeight: 600 }}>${fmt(tf)}</div></div>
                <div><div style={{ fontSize: 10, color: "#64748b" }}>NET PROFIT</div><div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>+${fmt(nt)} ({np.toFixed(1)}%)</div></div>
                <div><div style={{ fontSize: 10, color: "#64748b" }}>NET LOSS</div><div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>{fmt(ns)} ({nl.toFixed(1)}%)</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeExamplesDesktop({ trade, amounts, fees }) {
  const ep = (trade.entryLow + trade.entryHigh) / 2, tp = (trade.targetLow + trade.targetHigh) / 2, sp = trade.stop;
  const entryFee = fees.taker / 100, exitFee = fees.maker / 100;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
        Trade Examples <span style={{ color: "#f97316", fontWeight: 700 }}>• Kraken Fees ({fees.taker}% / {fees.maker}%)</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ borderBottom: "1px solid #1e293b" }}>
            {["Invest", "Coins", "Fees", "Net Profit", "P%", "Net Loss", "L%"].map((h, i) => (
              <th key={i} style={{ padding: "6px 10px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{amounts.map((amt, i) => {
            const coins = amt / ep, gt = coins * tp, gs = coins * sp;
            const nt = gt * (1 - exitFee) - amt * (1 + entryFee) + amt, ns = gs * (1 - exitFee) - amt * (1 + entryFee) + amt;
            const np = (nt / amt) * 100, nl = (ns / amt) * 100;
            const tf = (amt * entryFee) + (gt * exitFee);
            return (
              <tr key={i} style={{ borderBottom: i < amounts.length - 1 ? "1px solid #1e293b20" : "none" }}>
                <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f8fafc" }}>${amt.toLocaleString()}</td>
                <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{fmt(coins)}</td>
                <td style={{ padding: "8px 10px", color: "#f97316", fontWeight: 600 }}>${fmt(tf)}</td>
                <td style={{ padding: "8px 10px", color: "#22c55e", fontWeight: 600 }}>+${fmt(nt)}</td>
                <td style={{ padding: "8px 10px", color: "#22c55e", fontWeight: 600 }}>{np.toFixed(1)}%</td>
                <td style={{ padding: "8px 10px", color: "#ef4444", fontWeight: 600 }}>${fmt(Math.abs(ns))}</td>
                <td style={{ padding: "8px 10px", color: "#ef4444", fontWeight: 600 }}>{nl.toFixed(1)}%</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

function SourceDot({ status, label, mobile }) {
  const c = status === "live" ? "#22c55e" : status === "error" ? "#ef4444" : "#f59e0b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: mobile ? 10 : 11 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: c, boxShadow: status === "live" ? `0 0 6px ${c}` : "none", flexShrink: 0 }} />
      <span style={{ color: status === "live" ? "#94a3b8" : "#64748b" }}>{label}</span>
    </div>
  );
}

async function safeFetch(url, timeout = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  const resp = await fetch(url, { signal: ctrl.signal, mode: "cors" });
  clearTimeout(id);
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  return await resp.json();
}

// ===== SMART TRADE ENGINE =====
function analyzeOhlc(candles) {
  if (!candles || candles.length < 10) return null;
  // ATR (Average True Range) over last 14 candles for dynamic stops
  const recent = candles.slice(-14);
  let atrSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const h = recent[i][2], l = recent[i][3], pc = recent[i - 1][4];
    atrSum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  const atr = atrSum / (recent.length - 1);

  // Support/Resistance from pivot points
  const closes = candles.map(c => parseFloat(c[4]));
  const highs = candles.map(c => parseFloat(c[2]));
  const lows = candles.map(c => parseFloat(c[3]));
  const last20H = highs.slice(-20), last20L = lows.slice(-20);

  // Find S/R clusters: group nearby highs/lows
  const allLevels = [...last20H, ...last20L].sort((a, b) => a - b);
  const price = closes[closes.length - 1];
  const threshold = price * 0.003; // 0.3% cluster threshold

  const clusters = [];
  let cluster = [allLevels[0]];
  for (let i = 1; i < allLevels.length; i++) {
    if (allLevels[i] - allLevels[i - 1] < threshold) {
      cluster.push(allLevels[i]);
    } else {
      if (cluster.length >= 2) clusters.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);
      cluster = [allLevels[i]];
    }
  }
  if (cluster.length >= 2) clusters.push(cluster.reduce((a, b) => a + b, 0) / cluster.length);

  // Nearest support (below price) and resistance (above price)
  const supports = clusters.filter(c => c < price).sort((a, b) => b - a);
  const resistances = clusters.filter(c => c > price).sort((a, b) => a - b);
  const support = supports[0] || price * 0.985;
  const resistance = resistances[0] || price * 1.015;

  // Volatility score (ATR as % of price)
  const volatilityPct = (atr / price) * 100;

  // Momentum: compare last close to 10-period SMA
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const momentum = ((price - sma10) / sma10) * 100;

  // RSI approximation (14-period)
  let gains = 0, losses = 0;
  const rsiPeriod = Math.min(14, closes.length - 1);
  for (let i = closes.length - rsiPeriod; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / rsiPeriod, avgLoss = losses / rsiPeriod;
  const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  return { atr, support, resistance, volatilityPct, momentum, rsi, price, sma10 };
}

function generateScalpTrade(coin, marketData, analysis) {
  const p = marketData.price;
  const ch = marketData.change24h || 0;
  if (!analysis) {
    // Fallback to simple generation
    const atr = p * 0.008;
    return fallbackTrade(coin, p, ch, atr, marketData);
  }

  const { atr, support, resistance, volatilityPct, momentum, rsi } = analysis;
  const distToSupport = ((p - support) / p) * 100;
  const distToResist = ((resistance - p) / p) * 100;

  // Determine trade type based on price action
  let type, typeColor, desc, entryLow, entryHigh, targetLow, targetHigh, stop;
  let conf = 50;

  if (rsi < 35 && distToSupport < 1.5) {
    // Oversold near support → Bounce scalp
    type = "Bounce"; typeColor = "#22c55e";
    desc = `${coin.symbol} is oversold (RSI ${rsi.toFixed(0)}) near support at $${fmt(support)}. Look for a quick bounce off this level.`;
    entryLow = support; entryHigh = support + atr * 0.3;
    targetLow = p + atr * 0.8; targetHigh = p + atr * 1.2;
    stop = support - atr * 0.8;
    conf = 72;
  } else if (rsi > 65 && distToResist < 1) {
    // Overbought near resistance → Rejection scalp (still long bias for safety)
    type = "Fade"; typeColor = "#ef4444";
    desc = `${coin.symbol} is overbought (RSI ${rsi.toFixed(0)}) near resistance at $${fmt(resistance)}. Wait for a pullback to enter.`;
    entryLow = p - atr * 1.0; entryHigh = p - atr * 0.5;
    targetLow = p + atr * 0.3; targetHigh = p + atr * 0.6;
    stop = p - atr * 1.5;
    conf = 55;
  } else if (momentum > 0.5 && volatilityPct > 0.4) {
    // Strong momentum + volatility → Momentum scalp
    type = "Momentum"; typeColor = "#8b5cf6";
    desc = `${coin.symbol} has strong upward momentum (${momentum.toFixed(1)}% above SMA). High volatility (${volatilityPct.toFixed(1)}%) creates scalp opportunity.`;
    entryLow = p - atr * 0.3; entryHigh = p;
    targetLow = p + atr * 1.0; targetHigh = p + atr * 1.5;
    stop = p - atr * 1.0;
    conf = 68;
  } else if (distToResist < 1.5 && momentum > 0) {
    // Near resistance with momentum → Breakout scalp
    type = "Breakout"; typeColor = "#f59e0b";
    desc = `${coin.symbol} is pushing toward resistance at $${fmt(resistance)}. A clean break could trigger a quick move up.`;
    entryLow = resistance * 0.999; entryHigh = resistance * 1.002;
    targetLow = resistance + atr * 1.0; targetHigh = resistance + atr * 1.8;
    stop = resistance - atr * 0.8;
    conf = 62;
  } else if (distToSupport < 2 && momentum < 0) {
    // Dipping toward support → Support scalp
    type = "Support"; typeColor = "#06b6d4";
    desc = `${coin.symbol} is pulling back toward support at $${fmt(support)}. Watch for buyers to step in at this level.`;
    entryLow = support * 0.998; entryHigh = support * 1.003;
    targetLow = support + atr * 1.0; targetHigh = support + atr * 1.5;
    stop = support - atr * 1.0;
    conf = 65;
  } else {
    // Range scalp
    type = "Range"; typeColor = "#94a3b8";
    desc = `${coin.symbol} is ranging between $${fmt(support)} and $${fmt(resistance)}. Scalp from the lower range toward mid-range.`;
    const mid = (support + resistance) / 2;
    entryLow = support + (mid - support) * 0.1; entryHigh = support + (mid - support) * 0.3;
    targetLow = mid; targetHigh = mid + (resistance - mid) * 0.3;
    stop = support - atr * 0.5;
    conf = 50;
  }

  // Confidence adjustments
  if (ch > 3) conf += 6; else if (ch > 1) conf += 3;
  if (ch < -3) conf -= 6; else if (ch < -1) conf -= 3;
  if (marketData.sourceCount >= 4) conf += 4;
  if (marketData.spread != null && marketData.spread < 0.05) conf += 5;
  if (volatilityPct > 0.3 && volatilityPct < 1.5) conf += 4; // sweet spot for scalping
  if (volatilityPct > 2) conf -= 5; // too volatile
  conf = Math.max(10, Math.min(95, Math.round(conf)));

  const ae = (entryLow + entryHigh) / 2, at = (targetLow + targetHigh) / 2;
  const ppct = ((at - ae) / ae) * 100, lpct = Math.abs((stop - ae) / ae) * 100;
  const rr = lpct > 0 ? ppct / lpct : 1;
  const score = (ppct / 5) * 0.4 + (conf / 100) * 0.35 + Math.min(rr / 3, 1) * 0.25;

  return {
    symbol: coin.symbol, name: coin.name, type, typeColor, desc,
    entryLow, entryHigh, targetLow, targetHigh, stop,
    rr: `1:${rr.toFixed(1)}`, confidence: conf, direction: "Long",
    profitPct: ppct, sourceCount: marketData.sourceCount, sourceNames: marketData.sourceNames, score,
    bid: marketData.bid, ask: marketData.ask, spread: marketData.spread,
    // Extra scalp data
    atr: analysis.atr, atrPct: volatilityPct, rsi, momentum,
    supportLevel: support, resistanceLevel: resistance,
  };
}

function fallbackTrade(coin, p, ch, atr, md) {
  const entry = p - atr * 0.3, target = p + atr * 1.2, stop = p - atr * 1.0;
  const ppct = ((target - entry) / entry) * 100, lpct = Math.abs((stop - entry) / entry) * 100;
  return {
    symbol: coin.symbol, name: coin.name, type: "Scalp", typeColor: "#06b6d4",
    desc: `${coin.symbol} shows potential for a quick scalp. Enter on a dip and target a 1:1.2 R/R.`,
    entryLow: entry, entryHigh: p, targetLow: target * 0.998, targetHigh: target * 1.002, stop,
    rr: `1:${(ppct / lpct).toFixed(1)}`, confidence: 50, direction: "Long",
    profitPct: ppct, sourceCount: md.sourceCount || 0, sourceNames: md.sourceNames || [], score: 0.3,
    bid: md.bid, ask: md.ask, spread: md.spread, atr, atrPct: (atr / p) * 100, rsi: 50, momentum: ch,
    supportLevel: p * 0.985, resistanceLevel: p * 1.015,
  };
}

export default function CryptoDashboard() {
  const width = useWindowWidth();
  const mob = width < 640;
  const [tab, setTab] = useState("all");
  const [time, setTime] = useState(new Date());
  const [amounts, setAmounts] = useState([100, 500, 1000]);
  const [editingAmounts, setEditingAmounts] = useState(false);
  const [tempAmounts, setTempAmounts] = useState("100, 500, 1000");
  const [merged, setMerged] = useState({});
  const [globalData, setGlobalData] = useState(null);
  const [fearGreed, setFearGreed] = useState(null);
  const [sources, setSources] = useState({ krakenWs: "loading", coingecko: "loading", binance: "loading", coincap: "loading", cryptocompare: "loading", kraken: "loading", feargreed: "loading", krakenOhlc: "loading" });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchLog, setFetchLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [feeTier, setFeeTier] = useState(0);
  const [showFeeSelect, setShowFeeSelect] = useState(false);
  const [krakenLive, setKrakenLive] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const [wsTickCount, setWsTickCount] = useState(0);
  const [ohlcData, setOhlcData] = useState({});
  const wsRef = useRef(null);
  const krakenLiveRef = useRef({});
  const reconnectTimer = useRef(null);

  const addLog = (msg) => setFetchLog(prev => [{ time: new Date().toLocaleTimeString(), msg }, ...prev].slice(0, 30));
  const fees = KRAKEN_FEE_TIERS[feeTier];

  // Fetch Kraken OHLC for smart analysis
  const fetchOhlc = useCallback(async () => {
    const results = {};
    let success = 0;
    for (const coin of COINS) {
      try {
        const d = await safeFetch(`https://api.kraken.com/0/public/OHLC?pair=${coin.krakenOhlc}&interval=15`);
        if (d.result) {
          const key = Object.keys(d.result).find(k => k !== "last");
          if (key) {
            results[coin.id] = d.result[key].slice(-100).map(c => [
              c[0], parseFloat(c[1]), parseFloat(c[2]), parseFloat(c[3]), parseFloat(c[4]), parseFloat(c[5]), parseFloat(c[6])
            ]);
            success++;
          }
        }
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 300));
      } catch (e) { /* skip individual failures */ }
    }
    setOhlcData(results);
    setSources(prev => ({ ...prev, krakenOhlc: success > 0 ? "live" : "error" }));
    addLog(`Kraken OHLC: ${success}/${COINS.length} coins loaded`);
  }, []);

  // Kraken WebSocket
  const connectWebSocket = useCallback(() => {
    try {
      if (wsRef.current && wsRef.current.readyState < 2) return;
      const ws = new WebSocket("wss://ws.kraken.com");
      wsRef.current = ws;
      ws.onopen = () => {
        setWsConnected(true);
        setSources(prev => ({ ...prev, krakenWs: "live" }));
        addLog("Kraken WebSocket: Connected");
        ws.send(JSON.stringify({ event: "subscribe", pair: COINS.map(c => c.krakenWs), subscription: { name: "ticker" } }));
      };
      ws.onmessage = (event) => {
        try {
          const d = JSON.parse(event.data);
          if (Array.isArray(d) && d.length >= 4) {
            const ticker = d[1], pairName = d[3];
            const coin = COINS.find(c => c.krakenWs === pairName);
            if (coin && ticker && ticker.c) {
              const last = parseFloat(ticker.c[0]), open = parseFloat(ticker.o[0]);
              krakenLiveRef.current = { ...krakenLiveRef.current, [coin.id]: {
                price: last, bid: parseFloat(ticker.b[0]), ask: parseFloat(ticker.a[0]),
                high: parseFloat(ticker.h[1]), low: parseFloat(ticker.l[1]), vol: parseFloat(ticker.v[1]) * last,
                change: ((last - open) / open) * 100, spread: ((parseFloat(ticker.a[0]) - parseFloat(ticker.b[0])) / last) * 100, ts: Date.now()
              }};
              setKrakenLive({ ...krakenLiveRef.current });
              setWsTickCount(prev => prev + 1);
            }
          }
        } catch (e) {}
      };
      ws.onclose = () => { setWsConnected(false); setSources(prev => ({ ...prev, krakenWs: "error" })); reconnectTimer.current = setTimeout(connectWebSocket, 5000); };
      ws.onerror = () => { setSources(prev => ({ ...prev, krakenWs: "error" })); };
    } catch (e) { setSources(prev => ({ ...prev, krakenWs: "error" })); }
  }, []);

  useEffect(() => { connectWebSocket(); return () => { if (wsRef.current) wsRef.current.close(); if (reconnectTimer.current) clearTimeout(reconnectTimer.current); }; }, [connectWebSocket]);

  const applyFallback = useCallback(() => {
    const m = {};
    COINS.forEach(c => { const fb = FALLBACK[c.id]; if (fb) { m[c.id] = { price: fb.price, change24h: fb.change, high24h: fb.high, low24h: fb.low, volume: fb.vol * 1e9, sparkline: genSparkline(fb.price, fb.change), sourceCount: 0, sourceNames: ["Fallback"], priceSpread: null, bid: null, ask: null, spread: null }; } });
    setMerged(m); setUsingFallback(true); setLastUpdated(new Date());
  }, []);

  const fetchAll = useCallback(async () => {
    const ns = { ...sources, coingecko: "loading", binance: "loading", coincap: "loading", cryptocompare: "loading", kraken: "loading", feargreed: "loading" };
    const pd = {};
    COINS.forEach(c => { pd[c.id] = { prices: [], change24h: [], high24h: [], low24h: [], volume: [], sparkline: null, sourceNames: [] }; });
    let anySuccess = false;

    COINS.forEach(c => { const kl = krakenLiveRef.current[c.id]; if (kl && Date.now() - kl.ts < 120000) { pd[c.id].prices.push(kl.price); pd[c.id].change24h.push(kl.change); pd[c.id].high24h.push(kl.high); pd[c.id].low24h.push(kl.low); pd[c.id].volume.push(kl.vol); pd[c.id].sourceNames.push("Kraken WS"); anySuccess = true; } });

    try {
      const d = await safeFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.map(c => c.id).join(",")}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`);
      d.forEach(c => { if (pd[c.id]) { pd[c.id].prices.push(c.current_price); if (c.price_change_percentage_24h != null) pd[c.id].change24h.push(c.price_change_percentage_24h); if (c.high_24h) pd[c.id].high24h.push(c.high_24h); if (c.low_24h) pd[c.id].low24h.push(c.low_24h); if (c.total_volume) pd[c.id].volume.push(c.total_volume); if (c.sparkline_in_7d?.price) pd[c.id].sparkline = c.sparkline_in_7d.price.slice(-48); pd[c.id].sourceNames.push("CoinGecko"); } });
      ns.coingecko = "live"; anySuccess = true; addLog("CoinGecko: OK");
    } catch (e) { ns.coingecko = "error"; }

    try {
      const syms = COINS.map(c => c.binance).filter(Boolean);
      const d = await safeFetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(syms)}`);
      d.forEach(t => { const coin = COINS.find(c => c.binance === t.symbol); if (coin && pd[coin.id]) { pd[coin.id].prices.push(parseFloat(t.lastPrice)); pd[coin.id].change24h.push(parseFloat(t.priceChangePercent)); pd[coin.id].high24h.push(parseFloat(t.highPrice)); pd[coin.id].low24h.push(parseFloat(t.lowPrice)); pd[coin.id].volume.push(parseFloat(t.quoteVolume)); pd[coin.id].sourceNames.push("Binance"); } });
      ns.binance = "live"; anySuccess = true; addLog("Binance: OK");
    } catch (e) { ns.binance = "error"; }

    try {
      const d = await safeFetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${COINS.map(c => c.cc).join(",")}&tsyms=USD`);
      if (d.RAW) { COINS.forEach(c => { const raw = d.RAW[c.cc]?.USD; if (raw && pd[c.id]) { pd[c.id].prices.push(raw.PRICE); if (raw.CHANGEPCT24HOUR != null) pd[c.id].change24h.push(raw.CHANGEPCT24HOUR); if (raw.HIGH24HOUR) pd[c.id].high24h.push(raw.HIGH24HOUR); if (raw.LOW24HOUR) pd[c.id].low24h.push(raw.LOW24HOUR); pd[c.id].sourceNames.push("CryptoCompare"); } }); }
      ns.cryptocompare = "live"; anySuccess = true; addLog("CryptoCompare: OK");
    } catch (e) { ns.cryptocompare = "error"; }

    try { const d = await safeFetch("https://api.alternative.me/fng/?limit=1"); if (d.data?.[0]) setFearGreed({ value: parseInt(d.data[0].value), label: d.data[0].value_classification }); ns.feargreed = "live"; } catch (e) { ns.feargreed = "error"; }
    try { const d = await safeFetch("https://api.coingecko.com/api/v3/global"); if (d.data) setGlobalData(d.data); } catch (e) {}

    setSources(prev => ({ ...prev, ...ns }));
    if (!anySuccess) { applyFallback(); return; }
    setUsingFallback(false);
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const m = {};
    COINS.forEach(c => {
      const p = pd[c.id], avgPrice = avg(p.prices), kl = krakenLiveRef.current[c.id];
      if (!avgPrice) return;
      m[c.id] = { price: avgPrice, change24h: avg(p.change24h), high24h: p.high24h.length ? Math.max(...p.high24h) : null, low24h: p.low24h.length ? Math.min(...p.low24h) : null, volume: avg(p.volume), sparkline: p.sparkline || genSparkline(avgPrice, avg(p.change24h) || 0), sourceCount: p.prices.length, sourceNames: [...new Set(p.sourceNames)], priceSpread: p.prices.length > 1 ? ((Math.max(...p.prices) - Math.min(...p.prices)) / avgPrice * 100).toFixed(3) : null, bid: kl?.bid || null, ask: kl?.ask || null, spread: kl?.spread || null };
    });
    setMerged(m); setLastUpdated(new Date());
  }, [applyFallback]);

  useEffect(() => { fetchAll(); fetchOhlc(); const iv = setInterval(fetchAll, 60000); const iv2 = setInterval(fetchOhlc, 300000); return () => { clearInterval(iv); clearInterval(iv2); }; }, []);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (Object.keys(krakenLive).length === 0) return;
    setMerged(prev => {
      const next = { ...prev };
      COINS.forEach(c => { const kl = krakenLive[c.id]; if (kl && next[c.id]) { next[c.id] = { ...next[c.id], bid: kl.bid, ask: kl.ask, spread: kl.spread }; if (kl.ts > (next[c.id]._wsTs || 0)) { next[c.id].price = next[c.id].price ? (next[c.id].price * 0.4 + kl.price * 0.6) : kl.price; next[c.id].change24h = kl.change; next[c.id]._wsTs = kl.ts; } } });
      return next;
    });
  }, [wsTickCount]);

  const liveCount = Object.values(sources).filter(s => s === "live").length;
  const hasPrices = Object.values(merged).some(m => m.price != null);

  const buildTrades = () => {
    return COINS.map(c => {
      const d = merged[c.id];
      if (!d?.price) return null;
      const analysis = analyzeOhlc(ohlcData[c.id] || null);
      return generateScalpTrade(c, d, analysis);
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  };

  const trades = buildTrades();
  const tradeTypes = ["all", ...new Set(trades.map(t => t.type.toLowerCase()))];
  const filteredTrades = tab === "all" ? trades : trades.filter(t => t.type.toLowerCase() === tab);
  const handleSaveAmounts = () => { const p = tempAmounts.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0); if (p.length > 0) { setAmounts(p); setEditingAmounts(false); } };

  const totalMktCap = globalData ? (globalData.total_market_cap?.usd / 1e12).toFixed(2) : "2.84";
  const totalVol = globalData ? (globalData.total_volume?.usd / 1e9).toFixed(1) : "98.2";
  const btcDom = globalData ? globalData.market_cap_percentage?.btc?.toFixed(1) : "54.2";
  const ethDom = globalData ? globalData.market_cap_percentage?.eth?.toFixed(1) : "17.8";
  const mktCapCh = globalData?.market_cap_change_percentage_24h_usd ?? 1.8;
  const fg = fearGreed || { value: 62, label: "Greed" };
  const fgColor = fg.value > 55 ? "#22c55e" : fg.value > 45 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ background: "#0a0e17", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Inter',-apple-system,sans-serif", padding: mob ? "14px" : "20px 24px", WebkitTextSizeAdjust: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: mob ? "flex-start" : "center", marginBottom: mob ? 14 : 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: mob ? 20 : 24, fontWeight: 700, margin: 0, color: "#f8fafc", letterSpacing: -0.5 }}><span style={{ color: "#8b5cf6" }}>Crypto</span> Day Trader</h1>
          <p style={{ margin: "4px 0 0", fontSize: mob ? 11 : 13, color: "#64748b" }}>{time.toLocaleDateString("en-US", { weekday: mob ? "short" : "long", month: "short", day: "numeric" })} · {time.toLocaleTimeString()}</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {wsConnected && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#22c55e15", border: "1px solid #22c55e30", borderRadius: 8, padding: "4px 10px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite", boxShadow: "0 0 8px #22c55e" }} />
              <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>KRAKEN LIVE</span>
            </div>
          )}
          <button onClick={() => { fetchAll(); fetchOhlc(); }} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>🔄</button>
        </div>
      </div>

      {/* Kraken Fee Tier */}
      <div style={{ background: "#111827", border: "1px solid #f9731630", borderRadius: 10, padding: mob ? "8px 12px" : "10px 16px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#f97316", fontWeight: 700, textTransform: "uppercase" }}>🐙 Kraken Fees</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Maker: {fees.maker}% · Taker: {fees.taker}%</span>
          </div>
          <button onClick={() => setShowFeeSelect(!showFeeSelect)} style={{ background: "#f9731620", border: "1px solid #f9731640", borderRadius: 6, padding: "3px 10px", fontSize: 10, color: "#f97316", cursor: "pointer", fontWeight: 600 }}>{showFeeSelect ? "Close" : "Change"}</button>
        </div>
        {showFeeSelect && (
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: 6, marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e293b" }}>
            {KRAKEN_FEE_TIERS.map((tier, i) => (
              <button key={i} onClick={() => { setFeeTier(i); setShowFeeSelect(false); }} style={{ background: feeTier === i ? "#f9731625" : "#0a0e17", border: `1px solid ${feeTier === i ? "#f97316" : "#1e293b"}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: feeTier === i ? "#f97316" : "#94a3b8" }}>{tier.label}</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>Maker: {tier.maker}% · Taker: {tier.taker}%</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {usingFallback && (
        <div style={{ background: "#f59e0b15", border: "1px solid #f59e0b40", borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#f59e0b", flex: 1 }}>⚠️ Sample data. Host for live prices.</span>
          <button onClick={fetchAll} style={{ background: "#f59e0b", color: "#000", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Sources */}
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: mob ? "8px 12px" : "10px 16px", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Sources</span>
            <span style={{ fontSize: 11, color: liveCount >= 5 ? "#22c55e" : liveCount >= 3 ? "#f59e0b" : "#ef4444", fontWeight: 600 }}>{liveCount}/8</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowSources(!showSources)} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#64748b", cursor: "pointer" }}>{showSources ? "Hide" : "Details"}</button>
            <button onClick={() => setShowLog(!showLog)} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#64748b", cursor: "pointer" }}>{showLog ? "Hide" : "Log"}</button>
          </div>
        </div>
        {showSources && (
          <div style={{ display: "flex", gap: mob ? 8 : 14, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e293b" }}>
            <SourceDot status={sources.krakenWs} label="Kraken WS" mobile={mob} />
            <SourceDot status={sources.krakenOhlc} label="Kraken OHLC" mobile={mob} />
            <SourceDot status={sources.kraken} label="Kraken REST" mobile={mob} />
            <SourceDot status={sources.binance} label="Binance" mobile={mob} />
            <SourceDot status={sources.coingecko} label="CoinGecko" mobile={mob} />
            <SourceDot status={sources.coincap} label="CoinCap" mobile={mob} />
            <SourceDot status={sources.cryptocompare} label="CryptoCompare" mobile={mob} />
            <SourceDot status={sources.feargreed} label="Fear&Greed" mobile={mob} />
          </div>
        )}
      </div>

      {showLog && (
        <div style={{ background: "#0d1117", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", marginBottom: 6, maxHeight: 120, overflowY: "auto", fontSize: 10, fontFamily: "monospace" }}>
          {fetchLog.map((l, i) => (
            <div key={i} style={{ color: l.msg.includes("OK") || l.msg.includes("Connected") || l.msg.includes("loaded") ? "#22c55e" : "#ef4444", marginBottom: 2 }}>
              <span style={{ color: "#64748b" }}>[{l.time}]</span> {l.msg}
            </div>
          ))}
        </div>
      )}

      {hasPrices && (
        <>
          {/* Market Summary */}
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(170px, 1fr))", gap: mob ? 8 : 12, marginBottom: mob ? 16 : 24, marginTop: mob ? 10 : 14 }}>
            {[
              { label: "Market Cap", value: `$${totalMktCap}T`, sub: `${mktCapCh >= 0 ? "+" : ""}${mktCapCh.toFixed(1)}%`, up: mktCapCh >= 0 },
              { label: "24h Volume", value: `$${totalVol}B` },
              { label: "BTC Dom", value: `${btcDom}%` },
              { label: "ETH Dom", value: `${ethDom}%` },
              { label: "Fear & Greed", value: fg.value ? fg.value.toString() : "—", sub: fg.label, color: fgColor },
            ].map((item, i) => (
              <div key={i} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: mob ? 10 : 12, padding: mob ? "10px 12px" : "14px 16px" }}>
                <div style={{ fontSize: mob ? 9 : 11, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: mob ? 18 : 22, fontWeight: 700, color: "#f8fafc" }}>{item.value}</div>
                {item.sub && <div style={{ fontSize: mob ? 10 : 12, color: item.color || (item.up ? "#22c55e" : "#ef4444"), marginTop: 2 }}>{item.sub}</div>}
              </div>
            ))}
          </div>

          {/* Top Cryptos */}
          <h2 style={{ fontSize: mob ? 14 : 16, fontWeight: 600, marginBottom: 10, color: "#f8fafc" }}>Top Cryptos <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>— 10 coins tracked</span></h2>
          <div style={{ overflowX: "auto", marginBottom: mob ? 20 : 28, WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", gap: mob ? 8 : 12, paddingBottom: 4 }}>
              {COINS.map(c => {
                const d = merged[c.id]; if (!d?.price) return null;
                const ch = d.change24h || 0, col = ch >= 0 ? "#22c55e" : "#ef4444";
                return (
                  <div key={c.id} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: mob ? 10 : 12, padding: mob ? "12px" : "14px 16px", minWidth: mob ? 155 : 200, flex: "0 0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                      <div><div style={{ fontWeight: 700, fontSize: mob ? 14 : 15, color: "#f8fafc" }}>{c.symbol}</div><div style={{ fontSize: 10, color: "#64748b" }}>{c.name}</div></div>
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: col + "18", color: col, fontWeight: 600 }}>{ch >= 0 ? "+" : ""}{ch.toFixed(1)}%</span>
                    </div>
                    <div style={{ fontSize: mob ? 17 : 20, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>${d.price.toLocaleString(undefined, { minimumFractionDigits: d.price < 1 ? 4 : d.price < 100 ? 2 : 0 })}</div>
                    {d.bid != null && <div style={{ display: "flex", gap: 6, marginBottom: 4, fontSize: 9 }}><span style={{ color: "#22c55e" }}>B: ${fmt(d.bid)}</span><span style={{ color: "#ef4444" }}>A: ${fmt(d.ask)}</span></div>}
                    <MiniChart data={d.sparkline} color={col} mobile={mob} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trading Ideas */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ fontSize: mob ? 14 : 16, fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                Scalp Ideas {!mob && <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>— Smart S/R + ATR Stops • {trades.length} signals</span>}
              </h2>
              {editingAmounts ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input value={tempAmounts} onChange={e => setTempAmounts(e.target.value)} style={{ background: "#0a0e17", border: "1px solid #8b5cf6", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#f8fafc", width: mob ? 120 : 160, outline: "none" }} />
                  <button onClick={handleSaveAmounts} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✓</button>
                  <button onClick={() => setEditingAmounts(false)} style={{ background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <button onClick={() => { setTempAmounts(amounts.join(", ")); setEditingAmounts(true); }} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px", fontSize: 10, cursor: "pointer" }}>✏️ {amounts.map(a => `$${a}`).join(", ")}</button>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              {tradeTypes.map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: tab === t ? "#8b5cf6" : "#1e293b", color: tab === t ? "#fff" : "#94a3b8",
                  border: "none", borderRadius: 8, padding: mob ? "7px 12px" : "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", whiteSpace: "nowrap",
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: mob ? 10 : 14 }}>
            {filteredTrades.map((t, i) => (
              <div key={i} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: mob ? 12 : 14, padding: mob ? "14px" : "18px 20px", position: "relative" }}>
                {i === 0 && <div style={{ position: "absolute", top: -1, right: mob ? 14 : 20, background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#000", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: "0 0 6px 6px" }}>TOP PICK</div>}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: mob ? 16 : 18, color: "#f8fafc" }}>{t.symbol}</span>
                    {!mob && <span style={{ fontSize: 12, color: "#94a3b8" }}>{t.name}</span>}
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: t.typeColor + "20", color: t.typeColor, fontWeight: 600 }}>{t.type}</span>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#22c55e15", color: "#22c55e", fontWeight: 600 }}>+{t.profitPct.toFixed(1)}%</span>
                  </div>
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "#22c55e18", color: "#22c55e", fontWeight: 600 }}>{t.direction} ↗</span>
                </div>
                <p style={{ fontSize: mob ? 12 : 13, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 10px" }}>{t.desc}</p>

                {/* Smart Indicators */}
                <div style={{ display: "flex", gap: mob ? 6 : 10, marginBottom: 10, flexWrap: "wrap" }}>
                  {t.rsi != null && <div style={{ background: "#0a0e17", borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>
                    <span style={{ color: "#64748b" }}>RSI </span><span style={{ color: t.rsi > 70 ? "#ef4444" : t.rsi < 30 ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>{t.rsi.toFixed(0)}</span>
                  </div>}
                  {t.atrPct != null && <div style={{ background: "#0a0e17", borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>
                    <span style={{ color: "#64748b" }}>Volatility </span><span style={{ color: "#8b5cf6", fontWeight: 600 }}>{t.atrPct.toFixed(2)}%</span>
                  </div>}
                  {t.momentum != null && <div style={{ background: "#0a0e17", borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>
                    <span style={{ color: "#64748b" }}>Mom </span><span style={{ color: t.momentum > 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>{t.momentum > 0 ? "+" : ""}{t.momentum.toFixed(2)}%</span>
                  </div>}
                  {t.supportLevel != null && <div style={{ background: "#0a0e17", borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>
                    <span style={{ color: "#64748b" }}>S: </span><span style={{ color: "#06b6d4", fontWeight: 600 }}>${fmt(t.supportLevel)}</span>
                  </div>}
                  {t.resistanceLevel != null && <div style={{ background: "#0a0e17", borderRadius: 6, padding: "4px 8px", fontSize: 10 }}>
                    <span style={{ color: "#64748b" }}>R: </span><span style={{ color: "#f59e0b", fontWeight: 600 }}>${fmt(t.resistanceLevel)}</span>
                  </div>}
                </div>

                {t.bid != null && (
                  <div style={{ background: "#0a0e17", borderRadius: 8, padding: "6px 10px", marginBottom: 10, display: "flex", gap: mob ? 8 : 16, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#f97316", fontWeight: 600 }}>🐙 LIVE</span>
                    <span style={{ fontSize: 10, color: "#22c55e" }}>Bid: ${fmt(t.bid)}</span>
                    <span style={{ fontSize: 10, color: "#ef4444" }}>Ask: ${fmt(t.ask)}</span>
                    <span style={{ fontSize: 10, color: "#f59e0b" }}>Spread: {t.spread?.toFixed(3)}%</span>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(130px, 1fr))", gap: mob ? 6 : 10, marginBottom: 10 }}>
                  {[
                    { label: "Entry Zone", value: `$${fmt(t.entryLow)} – $${fmt(t.entryHigh)}`, color: "#8b5cf6" },
                    { label: "Target", value: `$${fmt(t.targetLow)} – $${fmt(t.targetHigh)}`, color: "#22c55e" },
                    { label: "Stop (ATR)", value: `$${fmt(t.stop)}`, color: "#ef4444" },
                    { label: "Risk/Reward", value: t.rr, color: "#f59e0b" },
                  ].map((item, j) => (
                    <div key={j} style={{ background: "#0a0e17", borderRadius: 8, padding: mob ? "8px 10px" : "10px 12px" }}>
                      <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: mob ? 12 : 14, fontWeight: 600, color: item.color, wordBreak: "break-all" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Confidence</div><ConfidenceBar value={t.confidence} /></div>
                {mob ? <TradeExamplesMobile trade={t} amounts={amounts} fees={fees} /> : <TradeExamplesDesktop trade={t} amounts={amounts} fees={fees} />}
              </div>
            ))}
          </div>
        </>
      )}

      {!hasPrices && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: mob ? 16 : 18, fontWeight: 600, color: "#f8fafc", marginBottom: 8 }}>Connecting & analyzing markets...</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Fetching prices + OHLC data for smart signal generation.</div>
        </div>
      )}

      <div style={{ marginTop: mob ? 20 : 28, padding: mob ? "12px" : "14px 18px", background: "#1e293b40", borderRadius: 10, border: "1px solid #1e293b" }}>
        <p style={{ fontSize: mob ? 10 : 11, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          ⚠️ <strong style={{ color: "#94a3b8" }}>Disclaimer:</strong> This dashboard is for educational purposes only. It does not constitute financial advice. Trading signals use algorithmic analysis of Kraken OHLC data (support/resistance, ATR, RSI, momentum) and are not professional recommendations. Fees based on Kraken Pro fee schedules. Cryptocurrency trading involves significant risk — always DYOR.
        </p>
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
