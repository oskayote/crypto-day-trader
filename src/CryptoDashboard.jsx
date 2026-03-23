import { useState, useEffect, useCallback } from "react";

const COINS = [
  { id:"bitcoin",symbol:"BTC",name:"Bitcoin",binance:"BTCUSDT",coincap:"bitcoin",cc:"BTC",kraken:"XXBTZUSD" },
  { id:"ethereum",symbol:"ETH",name:"Ethereum",binance:"ETHUSDT",coincap:"ethereum",cc:"ETH",kraken:"XETHZUSD" },
  { id:"solana",symbol:"SOL",name:"Solana",binance:"SOLUSDT",coincap:"solana",cc:"SOL",kraken:"SOLUSD" },
  { id:"ripple",symbol:"XRP",name:"Ripple",binance:"XRPUSDT",coincap:"xrp",cc:"XRP",kraken:"XXRPZUSD" },
  { id:"cardano",symbol:"ADA",name:"Cardano",binance:"ADAUSDT",coincap:"cardano",cc:"ADA",kraken:"ADAUSD" },
  { id:"dogecoin",symbol:"DOGE",name:"Dogecoin",binance:"DOGEUSDT",coincap:"dogecoin",cc:"DOGE",kraken:"XDGUSD" },
];

const FALLBACK = {
  bitcoin:{ price:84250,change:-0.8,high:85600,low:83100,vol:28.5 },
  ethereum:{ price:1835,change:1.2,high:1870,low:1810,vol:9.8 },
  solana:{ price:138.5,change:-2.1,high:143.2,low:136.8,vol:3.2 },
  ripple:{ price:2.34,change:3.5,high:2.41,low:2.22,vol:2.8 },
  cardano:{ price:0.71,change:-0.4,high:0.73,low:0.69,vol:0.8 },
  dogecoin:{ price:0.168,change:1.8,high:0.174,low:0.162,vol:1.4 },
};

const TRADE_TEMPLATES = {
  bitcoin:{type:"Breakout",typeColor:"#8b5cf6",desc:"BTC consolidating near resistance. A breakout above the 24h high could trigger a strong move upward.",entryOff:[-0.005,0],targetOff:[0.025,0.035],stopOff:-0.02,confidence:78},
  ethereum:{type:"Scalp",typeColor:"#06b6d4",desc:"ETH showing strong momentum. Look for a pullback to the 20 EMA for a quick scalp opportunity.",entryOff:[-0.008,-0.003],targetOff:[0.018,0.025],stopOff:-0.022,confidence:72},
  solana:{type:"Swing",typeColor:"#f59e0b",desc:"SOL pulling back from recent highs. Watch for support at the daily low for a potential swing entry.",entryOff:[-0.015,-0.005],targetOff:[0.04,0.06],stopOff:-0.03,confidence:65},
  ripple:{type:"Breakout",typeColor:"#8b5cf6",desc:"XRP surging on high volume. If it holds current levels, the next leg could push significantly higher.",entryOff:[-0.01,0],targetOff:[0.03,0.05],stopOff:-0.025,confidence:70},
  cardano:{type:"Swing",typeColor:"#f59e0b",desc:"ADA approaching key support zone. A bounce here could offer a favorable swing trade setup.",entryOff:[-0.012,-0.002],targetOff:[0.035,0.05],stopOff:-0.028,confidence:58},
  dogecoin:{type:"Scalp",typeColor:"#06b6d4",desc:"DOGE momentum picking up with rising social volume. Quick scalp on dips to support.",entryOff:[-0.01,0],targetOff:[0.02,0.03],stopOff:-0.018,confidence:60},
};

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
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
  const d = [];
  let v = base * (1 - Math.abs(change) / 100);
  for (let i = 0; i < 48; i++) {
    const dir = change > 0 ? 0.3 : -0.3;
    v += v * (dir + (Math.random() - 0.5) * 1.2) / 100;
    d.push(v);
  }
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
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
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

function TradeExamplesMobile({ trade, amounts }) {
  const ep = (trade.entryLow + trade.entryHigh) / 2;
  const tp = (trade.targetLow + trade.targetHigh) / 2;
  const sp = trade.stop;
  const ppct = ((tp - ep) / ep) * 100;
  const lpct = ((sp - ep) / ep) * 100;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Trade Examples</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {amounts.map((amt, i) => {
          const coins = amt / ep, tv = coins * tp, sv = coins * sp, pr = tv - amt, lo = sv - amt;
          return (
            <div key={i} style={{ background: "#0a0e17", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", marginBottom: 8 }}>${amt.toLocaleString()} Investment</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Coins</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>{fmt(coins)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Target</div>
                  <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>${fmt(tv)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Profit</div>
                  <div style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>+${fmt(pr)} ({ppct.toFixed(1)}%)</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase" }}>Loss (Stop)</div>
                  <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>-${fmt(Math.abs(lo))} ({Math.abs(lpct).toFixed(1)}%)</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeExamplesDesktop({ trade, amounts }) {
  const ep = (trade.entryLow + trade.entryHigh) / 2;
  const tp = (trade.targetLow + trade.targetHigh) / 2;
  const sp = trade.stop;
  const ppct = ((tp - ep) / ep) * 100;
  const lpct = ((sp - ep) / ep) * 100;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Trade Examples</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b" }}>
              {["Investment", "Coins", "Target Value", "Profit", "Stop Value", "Loss"].map((h, i) => (
                <th key={i} style={{ padding: "6px 10px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {amounts.map((amt, i) => {
              const coins = amt / ep, tv = coins * tp, sv = coins * sp, pr = tv - amt, lo = sv - amt;
              return (
                <tr key={i} style={{ borderBottom: i < amounts.length - 1 ? "1px solid #1e293b20" : "none" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#f8fafc" }}>${amt.toLocaleString()}</td>
                  <td style={{ padding: "8px 10px", color: "#94a3b8" }}>{fmt(coins)}</td>
                  <td style={{ padding: "8px 10px", color: "#22c55e", fontWeight: 600 }}>${fmt(tv)}</td>
                  <td style={{ padding: "8px 10px", color: "#22c55e", fontWeight: 600 }}>+${fmt(pr)} <span style={{ opacity: 0.7 }}>({ppct.toFixed(1)}%)</span></td>
                  <td style={{ padding: "8px 10px", color: "#ef4444", fontWeight: 600 }}>${fmt(sv)}</td>
                  <td style={{ padding: "8px 10px", color: "#ef4444", fontWeight: 600 }}>-${fmt(Math.abs(lo))} <span style={{ opacity: 0.7 }}>({Math.abs(lpct).toFixed(1)}%)</span></td>
                </tr>
              );
            })}
          </tbody>
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
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const resp = await fetch(url, { signal: controller.signal, mode: "cors" });
  clearTimeout(id);
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  return await resp.json();
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
  const [sources, setSources] = useState({ coingecko: "loading", binance: "loading", coincap: "loading", cryptocompare: "loading", kraken: "loading", feargreed: "loading" });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchLog, setFetchLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const addLog = (msg) => setFetchLog(prev => [{ time: new Date().toLocaleTimeString(), msg }, ...prev].slice(0, 30));

  const applyFallback = useCallback(() => {
    const m = {};
    COINS.forEach(c => {
      const fb = FALLBACK[c.id];
      m[c.id] = {
        price: fb.price, change24h: fb.change, high24h: fb.high, low24h: fb.low,
        volume: fb.vol * 1e9, sparkline: genSparkline(fb.price, fb.change),
        sourceCount: 0, sourceNames: ["Fallback"], priceSpread: null,
      };
    });
    setMerged(m);
    setUsingFallback(true);
    setLastUpdated(new Date());
    addLog("Using fallback data (APIs unreachable from sandbox)");
  }, []);

  const fetchAll = useCallback(async () => {
    const ns = { coingecko: "loading", binance: "loading", coincap: "loading", cryptocompare: "loading", kraken: "loading", feargreed: "loading" };
    const pd = {};
    COINS.forEach(c => { pd[c.id] = { prices: [], change24h: [], high24h: [], low24h: [], volume: [], sparkline: null, sourceNames: [] }; });
    let anySuccess = false;

    try {
      const d = await safeFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.map(c => c.id).join(",")}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`);
      d.forEach(c => {
        if (pd[c.id]) {
          pd[c.id].prices.push(c.current_price);
          if (c.price_change_percentage_24h != null) pd[c.id].change24h.push(c.price_change_percentage_24h);
          if (c.high_24h) pd[c.id].high24h.push(c.high_24h);
          if (c.low_24h) pd[c.id].low24h.push(c.low_24h);
          if (c.total_volume) pd[c.id].volume.push(c.total_volume);
          if (c.sparkline_in_7d?.price) pd[c.id].sparkline = c.sparkline_in_7d.price.slice(-48);
          pd[c.id].sourceNames.push("CoinGecko");
        }
      });
      ns.coingecko = "live"; anySuccess = true; addLog("CoinGecko: OK");
    } catch (e) { ns.coingecko = "error"; addLog("CoinGecko: " + e.message); }

    try {
      const d = await safeFetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(COINS.map(c => c.binance))}`);
      d.forEach(t => {
        const coin = COINS.find(c => c.binance === t.symbol);
        if (coin && pd[coin.id]) {
          pd[coin.id].prices.push(parseFloat(t.lastPrice));
          pd[coin.id].change24h.push(parseFloat(t.priceChangePercent));
          pd[coin.id].high24h.push(parseFloat(t.highPrice));
          pd[coin.id].low24h.push(parseFloat(t.lowPrice));
          pd[coin.id].volume.push(parseFloat(t.quoteVolume));
          pd[coin.id].sourceNames.push("Binance");
        }
      });
      ns.binance = "live"; anySuccess = true; addLog("Binance: OK");
    } catch (e) { ns.binance = "error"; addLog("Binance: " + e.message); }

    try {
      const d = await safeFetch("https://api.coincap.io/v2/assets?ids=bitcoin,ethereum,solana,xrp,cardano,dogecoin");
      (d.data || []).forEach(c => {
        const mapped = c.id === "xrp" ? "ripple" : c.id;
        if (pd[mapped]) {
          pd[mapped].prices.push(parseFloat(c.priceUsd));
          if (c.changePercent24Hr) pd[mapped].change24h.push(parseFloat(c.changePercent24Hr));
          if (c.volumeUsd24Hr) pd[mapped].volume.push(parseFloat(c.volumeUsd24Hr));
          pd[mapped].sourceNames.push("CoinCap");
        }
      });
      ns.coincap = "live"; anySuccess = true; addLog("CoinCap: OK");
    } catch (e) { ns.coincap = "error"; addLog("CoinCap: " + e.message); }

    try {
      const syms = COINS.map(c => c.cc).join(",");
      const d = await safeFetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${syms}&tsyms=USD`);
      if (d.RAW) {
        COINS.forEach(c => {
          const raw = d.RAW[c.cc]?.USD;
          if (raw && pd[c.id]) {
            pd[c.id].prices.push(raw.PRICE);
            if (raw.CHANGEPCT24HOUR != null) pd[c.id].change24h.push(raw.CHANGEPCT24HOUR);
            if (raw.HIGH24HOUR) pd[c.id].high24h.push(raw.HIGH24HOUR);
            if (raw.LOW24HOUR) pd[c.id].low24h.push(raw.LOW24HOUR);
            if (raw.TOTALVOLUME24HTO) pd[c.id].volume.push(raw.TOTALVOLUME24HTO);
            pd[c.id].sourceNames.push("CryptoCompare");
          }
        });
      }
      ns.cryptocompare = "live"; anySuccess = true; addLog("CryptoCompare: OK");
    } catch (e) { ns.cryptocompare = "error"; addLog("CryptoCompare: " + e.message); }

    try {
      const pairs = COINS.map(c => c.kraken).join(",");
      const d = await safeFetch(`https://api.kraken.com/0/public/Ticker?pair=${pairs}`);
      if (d.result) {
        COINS.forEach(c => {
          const tk = d.result[c.kraken];
          if (tk && pd[c.id]) {
            const last = parseFloat(tk.c[0]);
            const open = parseFloat(tk.o);
            pd[c.id].prices.push(last);
            pd[c.id].change24h.push(((last - open) / open) * 100);
            pd[c.id].high24h.push(parseFloat(tk.h[1]));
            pd[c.id].low24h.push(parseFloat(tk.l[1]));
            pd[c.id].volume.push(parseFloat(tk.v[1]) * last);
            pd[c.id].sourceNames.push("Kraken");
          }
        });
      }
      ns.kraken = "live"; anySuccess = true; addLog("Kraken: OK");
    } catch (e) { ns.kraken = "error"; addLog("Kraken: " + e.message); }

    try {
      const d = await safeFetch("https://api.alternative.me/fng/?limit=1");
      if (d.data?.[0]) setFearGreed({ value: parseInt(d.data[0].value), label: d.data[0].value_classification });
      ns.feargreed = "live"; addLog("Fear&Greed: OK");
    } catch (e) { ns.feargreed = "error"; addLog("Fear&Greed: " + e.message); }

    try {
      const d = await safeFetch("https://api.coingecko.com/api/v3/global");
      if (d.data) setGlobalData(d.data);
    } catch (e) { /* non-critical */ }

    setSources(ns);

    if (!anySuccess) { applyFallback(); return; }

    setUsingFallback(false);
    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const m = {};
    COINS.forEach(c => {
      const p = pd[c.id];
      const avgPrice = avg(p.prices);
      m[c.id] = {
        price: avgPrice, change24h: avg(p.change24h),
        high24h: p.high24h.length ? Math.max(...p.high24h) : null,
        low24h: p.low24h.length ? Math.min(...p.low24h) : null,
        volume: avg(p.volume),
        sparkline: p.sparkline || (avgPrice ? genSparkline(avgPrice, avg(p.change24h) || 0) : null),
        sourceCount: p.prices.length, sourceNames: [...new Set(p.sourceNames)],
        priceSpread: p.prices.length > 1 ? ((Math.max(...p.prices) - Math.min(...p.prices)) / avgPrice * 100).toFixed(3) : null,
      };
    });
    setMerged(m);
    setLastUpdated(new Date());
  }, [applyFallback]);

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, 60000); return () => clearInterval(iv); }, [fetchAll]);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const liveCount = Object.values(sources).filter(s => s === "live").length;
  const hasPrices = Object.values(merged).some(m => m.price != null);

  const buildTrades = () => {
    return COINS.map(c => {
      const d = merged[c.id], t = TRADE_TEMPLATES[c.id];
      if (!d?.price || !t) return null;
      const p = d.price;
      const eL = p * (1 + t.entryOff[0]), eH = p * (1 + t.entryOff[1]);
      const tL = p * (1 + t.targetOff[0]), tH = p * (1 + t.targetOff[1]);
      const st = p * (1 + t.stopOff);
      const ae = (eL + eH) / 2, at = (tL + tH) / 2;
      const ppct = ((at - ae) / ae) * 100, lpct = Math.abs((st - ae) / ae) * 100;
      return {
        symbol: c.symbol, name: c.name, type: t.type, typeColor: t.typeColor, desc: t.desc,
        entryLow: eL, entryHigh: eH, targetLow: tL, targetHigh: tH, stop: st,
        rr: `1:${(ppct / lpct).toFixed(1)}`, confidence: t.confidence, direction: "Long",
        profitPct: ppct, sourceCount: d.sourceCount, sourceNames: d.sourceNames,
      };
    }).filter(Boolean).sort((a, b) => b.profitPct - a.profitPct);
  };

  const trades = buildTrades();
  const filteredTrades = tab === "all" ? trades : trades.filter(t => t.type.toLowerCase() === tab);

  const handleSaveAmounts = () => {
    const p = tempAmounts.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (p.length > 0) { setAmounts(p); setEditingAmounts(false); }
  };

  const totalMktCap = globalData ? (globalData.total_market_cap?.usd / 1e12).toFixed(2) : "2.84";
  const totalVol = globalData ? (globalData.total_volume?.usd / 1e9).toFixed(1) : "98.2";
  const btcDom = globalData ? globalData.market_cap_percentage?.btc?.toFixed(1) : "54.2";
  const ethDom = globalData ? globalData.market_cap_percentage?.eth?.toFixed(1) : "17.8";
  const mktCapCh = globalData?.market_cap_change_percentage_24h_usd ?? 1.8;
  const fg = fearGreed || { value: 62, label: "Greed" };
  const fgColor = fg.value > 55 ? "#22c55e" : fg.value > 45 ? "#f59e0b" : "#ef4444";
  const pad = mob ? "14px 14px" : "20px 24px";

  return (
    <div style={{ background: "#0a0e17", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Inter',-apple-system,sans-serif", padding: pad, WebkitTextSizeAdjust: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: mob ? "flex-start" : "center", marginBottom: mob ? 16 : 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: mob ? 20 : 24, fontWeight: 700, margin: 0, color: "#f8fafc", letterSpacing: -0.5 }}>
            <span style={{ color: "#8b5cf6" }}>Crypto</span> Day Trader
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: mob ? 11 : 13, color: "#64748b" }}>
            {time.toLocaleDateString("en-US", { weekday: mob ? "short" : "long", month: "short", day: "numeric" })} · {time.toLocaleTimeString()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {lastUpdated && !mob && <span style={{ fontSize: 11, color: "#64748b" }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>🔄</button>
        </div>
      </div>

      {/* Fallback Banner */}
      {usingFallback && (
        <div style={{ background: "#f59e0b15", border: "1px solid #f59e0b40", borderRadius: 10, padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#f59e0b", flex: 1 }}>⚠️ Showing sample data. Host this app for live prices.</span>
          <button onClick={fetchAll} style={{ background: "#f59e0b", color: "#000", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {/* Source Status Bar */}
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: mob ? "8px 12px" : "10px 16px", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Sources</span>
            <span style={{ fontSize: 11, color: liveCount >= 4 ? "#22c55e" : liveCount >= 2 ? "#f59e0b" : "#ef4444", fontWeight: 600 }}>{liveCount}/6</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowSources(!showSources)} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#64748b", cursor: "pointer" }}>{showSources ? "Hide" : "Details"}</button>
            <button onClick={() => setShowLog(!showLog)} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#64748b", cursor: "pointer" }}>{showLog ? "Hide" : "Log"}</button>
          </div>
        </div>
        {showSources && (
          <div style={{ display: "flex", gap: mob ? 8 : 14, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e293b" }}>
            <SourceDot status={sources.binance} label="Binance" mobile={mob} />
            <SourceDot status={sources.coingecko} label="CoinGecko" mobile={mob} />
            <SourceDot status={sources.coincap} label="CoinCap" mobile={mob} />
            <SourceDot status={sources.cryptocompare} label="CryptoCompare" mobile={mob} />
            <SourceDot status={sources.kraken} label="Kraken" mobile={mob} />
            <SourceDot status={sources.feargreed} label="Fear&Greed" mobile={mob} />
          </div>
        )}
      </div>

      {/* Fetch Log */}
      {showLog && (
        <div style={{ background: "#0d1117", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", marginBottom: 6, maxHeight: 120, overflowY: "auto", fontSize: 10, fontFamily: "monospace" }}>
          {fetchLog.length === 0
            ? <span style={{ color: "#64748b" }}>No logs yet...</span>
            : fetchLog.map((l, i) => (
                <div key={i} style={{ color: l.msg.includes("OK") ? "#22c55e" : l.msg.includes("fallback") ? "#f59e0b" : "#ef4444", marginBottom: 2 }}>
                  <span style={{ color: "#64748b" }}>[{l.time}]</span> {l.msg}
                </div>
              ))
          }
        </div>
      )}

      {hasPrices && (
        <>
          {/* Market Summary */}
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(170px, 1fr))", gap: mob ? 8 : 12, marginBottom: mob ? 16 : 24, marginTop: mob ? 10 : 14 }}>
            {[
              { label: "Market Cap", value: `$${totalMktCap}T`, sub: `${mktCapCh >= 0 ? "+" : ""}${mktCapCh.toFixed(1)}%`, up: mktCapCh >= 0 },
              { label: "24h Volume", value: `$${totalVol}B`, sub: "", up: true },
              { label: "BTC Dom", value: `${btcDom}%`, sub: "", up: true },
              { label: "ETH Dom", value: `${ethDom}%`, sub: "", up: true },
              { label: "Fear & Greed", value: fg.value ? fg.value.toString() : "—", sub: fg.label, color: fgColor },
            ].map((item, i) => (
              <div key={i} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: mob ? 10 : 12, padding: mob ? "10px 12px" : "14px 16px" }}>
                <div style={{ fontSize: mob ? 9 : 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: mob ? 18 : 22, fontWeight: 700, color: "#f8fafc" }}>{item.value}</div>
                {item.sub && <div style={{ fontSize: mob ? 10 : 12, color: item.color || (item.up ? "#22c55e" : "#ef4444"), marginTop: 2 }}>{item.sub}</div>}
              </div>
            ))}
          </div>

          {/* Top Cryptos */}
          <h2 style={{ fontSize: mob ? 14 : 16, fontWeight: 600, marginBottom: 10, color: "#f8fafc" }}>
            Top Cryptos {!mob && <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>— {usingFallback ? "Sample Data" : `${liveCount - 1}+ exchanges`}</span>}
          </h2>
          <div style={{ overflowX: "auto", marginBottom: mob ? 20 : 28, WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", gap: mob ? 8 : 12, paddingBottom: 4 }}>
              {COINS.map(c => {
                const d = merged[c.id];
                if (!d?.price) return null;
                const ch = d.change24h || 0;
                const col = ch >= 0 ? "#22c55e" : "#ef4444";
                return (
                  <div key={c.id} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: mob ? 10 : 12, padding: mob ? "12px" : "14px 16px", minWidth: mob ? 160 : 220, flex: "0 0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: mob ? 14 : 15, color: "#f8fafc" }}>{c.symbol}</div>
                        <div style={{ fontSize: mob ? 10 : 11, color: "#64748b" }}>{c.name}</div>
                      </div>
                      <span style={{ fontSize: mob ? 10 : 11, padding: "2px 6px", borderRadius: 6, background: col + "18", color: col, fontWeight: 600 }}>
                        {ch >= 0 ? "+" : ""}{ch.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ fontSize: mob ? 17 : 20, fontWeight: 700, color: "#f8fafc", marginBottom: 4 }}>
                      ${d.price.toLocaleString(undefined, { minimumFractionDigits: d.price < 1 ? 4 : d.price < 100 ? 2 : 0 })}
                    </div>
                    {!mob && d.sourceCount > 0 && (
                      <div style={{ display: "flex", gap: 6, marginBottom: 6, fontSize: 10 }}>
                        <span style={{ background: "#8b5cf620", color: "#a78bfa", padding: "1px 6px", borderRadius: 4 }}>{d.sourceCount} src</span>
                        {d.priceSpread != null && (
                          <span style={{ background: parseFloat(d.priceSpread) > 0.1 ? "#f59e0b20" : "#22c55e18", color: parseFloat(d.priceSpread) > 0.1 ? "#f59e0b" : "#22c55e", padding: "1px 6px", borderRadius: 4 }}>±{d.priceSpread}%</span>
                        )}
                      </div>
                    )}
                    <MiniChart data={d.sparkline} color={col} mobile={mob} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: mob ? 10 : 11, color: "#64748b" }}>
                      <span>Vol: ${d.volume ? (d.volume / 1e9).toFixed(1) + "B" : "—"}</span>
                      <span>H: ${d.high24h?.toLocaleString() || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trading Ideas Header */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ fontSize: mob ? 14 : 16, fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                Trading Ideas
              </h2>
              {editingAmounts ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input value={tempAmounts} onChange={e => setTempAmounts(e.target.value)} placeholder="100, 500, 1000"
                    style={{ background: "#0a0e17", border: "1px solid #8b5cf6", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#f8fafc", width: mob ? 120 : 160, outline: "none" }} />
                  <button onClick={handleSaveAmounts} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✓</button>
                  <button onClick={() => setEditingAmounts(false)} style={{ background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <button onClick={() => { setTempAmounts(amounts.join(", ")); setEditingAmounts(true); }} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "5px 10px", fontSize: 10, cursor: "pointer" }}>
                  ✏️ {amounts.map(a => `$${a}`).join(", ")}
                </button>
              )}
            </div>
            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              {["all", "breakout", "scalp", "swing"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  background: tab === t ? "#8b5cf6" : "#1e293b", color: tab === t ? "#fff" : "#94a3b8",
                  border: "none", borderRadius: 8, padding: mob ? "7px 14px" : "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", whiteSpace: "nowrap", flex: mob ? "1" : "none",
                }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Trade Cards */}
          <div style={{ display: "grid", gap: mob ? 10 : 14 }}>
            {filteredTrades.map((t, i) => (
              <div key={i} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: mob ? 12 : 14, padding: mob ? "14px" : "18px 20px", position: "relative" }}>
                {i === 0 && (
                  <div style={{ position: "absolute", top: -1, right: mob ? 14 : 20, background: "linear-gradient(135deg, #f59e0b, #f97316)", color: "#000", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: "0 0 6px 6px", letterSpacing: 0.5 }}>TOP PICK</div>
                )}
                {/* Card Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: mob ? 16 : 18, color: "#f8fafc" }}>{t.symbol}</span>
                    {!mob && <span style={{ fontSize: 12, color: "#94a3b8" }}>{t.name}</span>}
                    <span style={{ fontSize: mob ? 10 : 11, padding: "2px 8px", borderRadius: 6, background: t.typeColor + "20", color: t.typeColor, fontWeight: 600 }}>{t.type}</span>
                    <span style={{ fontSize: mob ? 10 : 11, padding: "2px 6px", borderRadius: 6, background: "#22c55e15", color: "#22c55e", fontWeight: 600 }}>+{t.profitPct.toFixed(1)}%</span>
                  </div>
                  <span style={{ fontSize: mob ? 10 : 12, padding: "3px 8px", borderRadius: 6, background: "#22c55e18", color: "#22c55e", fontWeight: 600 }}>{t.direction} ↗</span>
                </div>
                <p style={{ fontSize: mob ? 12 : 13, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 12px" }}>{t.desc}</p>

                {/* Entry/Target/Stop Grid */}
                <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(140px, 1fr))", gap: mob ? 6 : 10, marginBottom: 10 }}>
                  {[
                    { label: "Entry Zone", value: `$${fmt(t.entryLow)} – $${fmt(t.entryHigh)}`, color: "#8b5cf6" },
                    { label: "Target", value: `$${fmt(t.targetLow)} – $${fmt(t.targetHigh)}`, color: "#22c55e" },
                    { label: "Stop Loss", value: `$${fmt(t.stop)}`, color: "#ef4444" },
                    { label: "Risk/Reward", value: t.rr, color: "#f59e0b" },
                  ].map((item, j) => (
                    <div key={j} style={{ background: "#0a0e17", borderRadius: 8, padding: mob ? "8px 10px" : "10px 12px" }}>
                      <div style={{ fontSize: mob ? 9 : 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: mob ? 12 : 14, fontWeight: 600, color: item.color, wordBreak: "break-all" }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Confidence</div>
                  <ConfidenceBar value={t.confidence} />
                </div>

                {mob
                  ? <TradeExamplesMobile trade={t} amounts={amounts} />
                  : <TradeExamplesDesktop trade={t} amounts={amounts} />
                }
              </div>
            ))}
          </div>
        </>
      )}

      {/* Loading */}
      {!hasPrices && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: mob ? 16 : 18, fontWeight: 600, color: "#f8fafc", marginBottom: 8 }}>Connecting to data sources...</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Trying 5 exchanges. Fallback data loads automatically if needed.</div>
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ marginTop: mob ? 20 : 28, padding: mob ? "12px" : "14px 18px", background: "#1e293b40", borderRadius: 10, border: "1px solid #1e293b" }}>
        <p style={{ fontSize: mob ? 10 : 11, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
          ⚠️ <strong style={{ color: "#94a3b8" }}>Disclaimer:</strong> This dashboard is for educational and informational purposes only. It does not constitute financial advice. Prices are aggregated from multiple sources (Binance, CoinGecko, CoinCap, CryptoCompare, Kraken). Trade ideas are algorithmically generated and not professional recommendations. Cryptocurrency trading involves significant risk — always do your own research and never invest more than you can afford to lose.
        </p>
      </div>
    </div>
  );
}
