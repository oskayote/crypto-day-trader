import { useState, useEffect, useCallback, useRef } from "react";

const COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", binance: "BTCUSDT", cc: "BTC", kraken: "XXBTZUSD", krakenWs: "XBT/USD", krakenOhlc: "XXBTZUSD" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", binance: "ETHUSDT", cc: "ETH", kraken: "XETHZUSD", krakenWs: "ETH/USD", krakenOhlc: "XETHZUSD" },
  { id: "solana", symbol: "SOL", name: "Solana", binance: "SOLUSDT", cc: "SOL", kraken: "SOLUSD", krakenWs: "SOL/USD", krakenOhlc: "SOLUSD" },
  { id: "ripple", symbol: "XRP", name: "Ripple", binance: "XRPUSDT", cc: "XRP", kraken: "XXRPZUSD", krakenWs: "XRP/USD", krakenOhlc: "XXRPZUSD" },
  { id: "cardano", symbol: "ADA", name: "Cardano", binance: "ADAUSDT", cc: "ADA", kraken: "ADAUSD", krakenWs: "ADA/USD", krakenOhlc: "ADAUSD" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", binance: "DOGEUSDT", cc: "DOGE", kraken: "XDGUSD", krakenWs: "DOGE/USD", krakenOhlc: "XDGUSD" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", binance: "DOTUSDT", cc: "DOT", kraken: "DOTUSD", krakenWs: "DOT/USD", krakenOhlc: "DOTUSD" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", binance: "AVAXUSDT", cc: "AVAX", kraken: "AVAXUSD", krakenWs: "AVAX/USD", krakenOhlc: "AVAXUSD" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", binance: "LINKUSDT", cc: "LINK", kraken: "LINKUSD", krakenWs: "LINK/USD", krakenOhlc: "LINKUSD" },
  { id: "polygon", symbol: "POL", name: "Polygon", binance: "POLUSDT", cc: "POL", kraken: "POLUSD", krakenWs: "POL/USD", krakenOhlc: "POLUSD" },
];

const RISK_PROFILES = [
  { label: "Conservative", emoji: "🛡️", color: "#22c55e", targetMult: 0.7, stopMult: 0.7, desc: "Tighter targets & stops" },
  { label: "Moderate", emoji: "⚖️", color: "#f59e0b", targetMult: 1.0, stopMult: 1.0, desc: "Balanced risk/reward" },
  { label: "Aggressive", emoji: "🔥", color: "#ef4444", targetMult: 1.5, stopMult: 1.3, desc: "Wider targets, more risk" },
];

const FEE_TIERS = [
  { label: "Starter", maker: 0.16, taker: 0.26 },
  { label: "Intermediate", maker: 0.14, taker: 0.24 },
  { label: "Advanced", maker: 0.12, taker: 0.22 },
  { label: "Pro", maker: 0.08, taker: 0.18 },
  { label: "Expert", maker: 0.04, taker: 0.14 },
  { label: "Elite", maker: 0.00, taker: 0.10 },
];

const FALLBACK_DATA = {
  bitcoin: { price: 84250, change: -0.8, high: 85600, low: 83100, vol: 28.5 },
  ethereum: { price: 1835, change: 1.2, high: 1870, low: 1810, vol: 9.8 },
  solana: { price: 138.5, change: -2.1, high: 143.2, low: 136.8, vol: 3.2 },
  ripple: { price: 2.34, change: 3.5, high: 2.41, low: 2.22, vol: 2.8 },
  cardano: { price: 0.71, change: -0.4, high: 0.73, low: 0.69, vol: 0.8 },
  dogecoin: { price: 0.168, change: 1.8, high: 0.174, low: 0.162, vol: 1.4 },
  polkadot: { price: 4.12, change: 0.6, high: 4.25, low: 4.02, vol: 0.5 },
  "avalanche-2": { price: 21.4, change: -1.5, high: 22.1, low: 20.9, vol: 0.7 },
  chainlink: { price: 13.8, change: 2.3, high: 14.1, low: 13.4, vol: 0.9 },
  polygon: { price: 0.22, change: -0.3, high: 0.225, low: 0.215, vol: 0.3 },
};

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
    v += v * ((change > 0 ? 0.3 : -0.3) + (Math.random() - 0.5) * 1.2) / 100;
    d.push(v);
  }
  return d;
}

async function safeFetch(url, timeout) {
  const ms = timeout || 10000;
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, ms);
  const resp = await fetch(url, { signal: ctrl.signal, mode: "cors" });
  clearTimeout(timer);
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  return resp.json();
}

function MiniChartComponent(props) {
  var data = props.data;
  var color = props.color;
  var mobile = props.mobile;
  if (!data || data.length < 2) return null;
  var h = mobile ? 30 : 36;
  var w = mobile ? 90 : 110;
  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = max - min || 1;
  var pts = data.map(function (v, i) {
    return (i / (data.length - 1)) * w + "," + (h - ((v - min) / range) * h);
  }).join(" ");
  var gid = "gr" + Math.random().toString(36).slice(2, 8);
  return (
    <svg width={w} height={h} viewBox={"0 0 " + w + " " + h}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={"0," + h + " " + pts + " " + w + "," + h} fill={"url(#" + gid + ")"} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function ConfidenceBarComponent(props) {
  var value = props.value;
  var bg = value >= 70 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1e293b" }}>
        <div style={{ width: value + "%", height: "100%", borderRadius: 3, background: bg }} />
      </div>
      <span style={{ fontSize: 12, color: "#94a3b8", minWidth: 28 }}>{value}%</span>
    </div>
  );
}

function SourceDotComponent(props) {
  var status = props.status;
  var label = props.label;
  var c = status === "live" ? "#22c55e" : status === "error" ? "#ef4444" : "#f59e0b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: c, boxShadow: status === "live" ? "0 0 5px " + c : "none" }} />
      <span style={{ color: status === "live" ? "#94a3b8" : "#64748b" }}>{label}</span>
    </div>
  );
}

function TradeChartComponent(props) {
  var trade = props.trade;
  var currentPrice = props.currentPrice;
  var mobile = props.mobile;
  var hist = trade.priceHistory || [];
  if (hist.length < 2) {
    return (
      <div style={{ background: "#0a0e17", borderRadius: 10, padding: 12, marginTop: 8, textAlign: "center", color: "#64748b", fontSize: 11 }}>
        <div style={{ marginBottom: 4 }}>📊 Collecting price data... ({hist.length} ticks)</div>
        <div style={{ fontSize: 10, color: "#475569" }}>Chart appears after 2+ price updates</div>
      </div>
    );
  }
  var W = mobile ? 320 : 560;
  var H = mobile ? 160 : 200;
  var padL = 45;
  var padR = 60;
  var padT = 15;
  var padB = 25;
  var chartW = W - padL - padR;
  var chartH = H - padT - padB;

  var allPrices = hist.map(function (h) { return h.p; });
  allPrices.push(trade.targetPrice, trade.stopPrice, trade.entryPrice);
  if (currentPrice) allPrices.push(currentPrice);
  var maxP = Math.max.apply(null, allPrices);
  var minP = Math.min.apply(null, allPrices);
  var range = maxP - minP || 1;
  // Add 5% padding
  maxP = maxP + range * 0.05;
  minP = minP - range * 0.05;
  range = maxP - minP;

  function yP(p) { return padT + chartH * (1 - (p - minP) / range); }
  function xP(i) { return padL + (i / Math.max(hist.length - 1, 1)) * chartW; }

  var pts = hist.map(function (h, i) { return xP(i) + "," + yP(h.p); }).join(" ");

  var entryY = yP(trade.entryPrice);
  var targetY = yP(trade.targetPrice);
  var stopY = yP(trade.stopPrice);
  var lastX = xP(hist.length - 1);
  var lastY = currentPrice ? yP(currentPrice) : yP(hist[hist.length - 1].p);
  var pnl = currentPrice ? currentPrice - trade.entryPrice : hist[hist.length - 1].p - trade.entryPrice;
  var pnlPct = (pnl / trade.entryPrice * 100).toFixed(2);
  var pnlColor = pnl >= 0 ? "#22c55e" : "#ef4444";

  // Build fill area between entry line and price line
  var fillPts = padL + "," + entryY;
  hist.forEach(function (h, i) { fillPts += " " + xP(i) + "," + yP(h.p); });
  fillPts += " " + lastX + "," + entryY;

  // Time labels
  var startTime = new Date(hist[0].t);
  var endTime = new Date(hist[hist.length - 1].t);
  var elapsed = Math.round((endTime - startTime) / 1000);
  var elapsedStr = elapsed < 60 ? elapsed + "s" : Math.floor(elapsed / 60) + "m " + (elapsed % 60) + "s";

  return (
    <div style={{ background: "#0a0e17", borderRadius: 10, padding: mobile ? 8 : 12, marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#f8fafc" }}>📊 {trade.symbol} {trade.type}</span>
          <span style={{ fontSize: 10, color: pnlColor, fontWeight: 700 }}>{pnl >= 0 ? "+" : ""}{pnlPct}%</span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#64748b" }}>
          <span>⏱ {elapsedStr}</span>
          <span>{hist.length} ticks</span>
        </div>
      </div>
      <svg width={W} height={H} viewBox={"0 0 " + W + " " + H} style={{ display: "block", width: "100%", height: "auto" }}>
        {/* Target zone fill */}
        <rect x={padL} y={targetY} width={chartW} height={Math.max(0, entryY - targetY)} fill="#22c55e06" />
        {/* Stop zone fill */}
        <rect x={padL} y={entryY} width={chartW} height={Math.max(0, stopY - entryY)} fill="#ef444406" />

        {/* Horizontal grid lines */}
        <line x1={padL} y1={targetY} x2={padL + chartW} y2={targetY} stroke="#22c55e" strokeWidth="1" strokeDasharray="6,4" />
        <line x1={padL} y1={entryY} x2={padL + chartW} y2={entryY} stroke="#8b5cf6" strokeWidth="1" strokeDasharray="6,4" />
        <line x1={padL} y1={stopY} x2={padL + chartW} y2={stopY} stroke="#ef4444" strokeWidth="1" strokeDasharray="6,4" />

        {/* P&L fill area */}
        <polygon points={fillPts} fill={pnlColor} fillOpacity="0.08" />

        {/* Price line */}
        <polyline points={pts} fill="none" stroke={pnlColor} strokeWidth="2.5" strokeLinejoin="round" />

        {/* Entry marker */}
        <circle cx={padL} cy={entryY} r="5" fill="#8b5cf6" stroke="#0a0e17" strokeWidth="2" />
        {/* Current price marker */}
        <circle cx={lastX} cy={lastY} r="6" fill={pnlColor} stroke="#0a0e17" strokeWidth="2" />
        {/* Pulse ring on current */}
        <circle cx={lastX} cy={lastY} r="10" fill="none" stroke={pnlColor} strokeWidth="1" opacity="0.4" />

        {/* Left labels */}
        <rect x={0} y={targetY - 8} width={42} height={16} rx="3" fill="#22c55e20" />
        <text x={21} y={targetY + 4} fill="#22c55e" fontSize="9" textAnchor="middle" fontWeight="600">TARGET</text>
        <rect x={0} y={entryY - 8} width={42} height={16} rx="3" fill="#8b5cf620" />
        <text x={21} y={entryY + 4} fill="#8b5cf6" fontSize="9" textAnchor="middle" fontWeight="600">ENTRY</text>
        <rect x={0} y={stopY - 8} width={42} height={16} rx="3" fill="#ef444420" />
        <text x={21} y={stopY + 4} fill="#ef4444" fontSize="9" textAnchor="middle" fontWeight="600">STOP</text>

        {/* Right price labels */}
        <text x={padL + chartW + 4} y={targetY + 4} fill="#22c55e" fontSize="9" fontWeight="600">{"$" + fmt(trade.targetPrice)}</text>
        <text x={padL + chartW + 4} y={entryY + 4} fill="#8b5cf6" fontSize="9" fontWeight="600">{"$" + fmt(trade.entryPrice)}</text>
        <text x={padL + chartW + 4} y={stopY + 4} fill="#ef4444" fontSize="9" fontWeight="600">{"$" + fmt(trade.stopPrice)}</text>
        {currentPrice && <text x={padL + chartW + 4} y={lastY + 4} fill={pnlColor} fontSize="10" fontWeight="700">{"$" + fmt(currentPrice)}</text>}

        {/* Time axis */}
        <text x={padL} y={H - 4} fill="#475569" fontSize="8">Start</text>
        <text x={padL + chartW} y={H - 4} fill="#475569" fontSize="8" textAnchor="end">Now</text>
      </svg>
    </div>
  );
}

function TradeExamplesComponent(props) {
  var trade = props.trade;
  var amounts = props.amounts;
  var fees = props.fees;
  var mobile = props.mobile;
  var ep = (trade.entryLow + trade.entryHigh) / 2;
  var tp = (trade.targetLow + trade.targetHigh) / 2;
  var sp = trade.stop;
  var ef = fees.taker / 100;
  var xf = fees.maker / 100;

  if (mobile) {
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
          Examples <span style={{ color: "#f97316", fontWeight: 700 }}>• Fees</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {amounts.map(function (amt, i) {
            var coins = amt / ep;
            var nt = coins * tp * (1 - xf) - amt * (1 + ef) + amt;
            var ns = coins * sp * (1 - xf) - amt * (1 + ef) + amt;
            return (
              <div key={i} style={{ background: "#0a0e17", borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>${amt.toLocaleString()}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div><div style={{ fontSize: 9, color: "#64748b" }}>PROFIT</div><div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>+${fmt(nt)}</div></div>
                  <div><div style={{ fontSize: 9, color: "#64748b" }}>LOSS</div><div style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>${fmt(ns)}</div></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
        Examples <span style={{ color: "#f97316", fontWeight: 700 }}>• Fees ({fees.taker}%/{fees.maker}%)</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e293b" }}>
              {["Invest", "Coins", "Net Profit", "P%", "Net Loss", "L%"].map(function (h, idx) {
                return (<th key={idx} style={{ padding: "5px 8px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>);
              })}
            </tr>
          </thead>
          <tbody>
            {amounts.map(function (amt, i) {
              var coins = amt / ep;
              var nt = coins * tp * (1 - xf) - amt * (1 + ef) + amt;
              var ns = coins * sp * (1 - xf) - amt * (1 + ef) + amt;
              var np = (nt / amt) * 100;
              var nl = (ns / amt) * 100;
              return (
                <tr key={i} style={{ borderBottom: i < amounts.length - 1 ? "1px solid #1e293b20" : "none" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 600, color: "#f8fafc" }}>${amt.toLocaleString()}</td>
                  <td style={{ padding: "6px 8px", color: "#94a3b8" }}>{fmt(coins)}</td>
                  <td style={{ padding: "6px 8px", color: "#22c55e", fontWeight: 600 }}>+${fmt(nt)}</td>
                  <td style={{ padding: "6px 8px", color: "#22c55e", fontWeight: 600 }}>{np.toFixed(1)}%</td>
                  <td style={{ padding: "6px 8px", color: "#ef4444", fontWeight: 600 }}>${fmt(Math.abs(ns))}</td>
                  <td style={{ padding: "6px 8px", color: "#ef4444", fontWeight: 600 }}>{nl.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== ANALYSIS =====
function analyzeOhlc(candles) {
  if (!candles || candles.length < 10) return null;
  var recent = candles.slice(-14);
  var atrSum = 0;
  for (var i = 1; i < recent.length; i++) {
    var h = recent[i][2], l = recent[i][3], pc = recent[i - 1][4];
    atrSum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  var atr = atrSum / (recent.length - 1);
  var closes = candles.map(function (c) { return parseFloat(c[4]); });
  var highs = candles.map(function (c) { return parseFloat(c[2]); });
  var lows = candles.map(function (c) { return parseFloat(c[3]); });
  var allLevels = highs.slice(-20).concat(lows.slice(-20)).sort(function (a, b) { return a - b; });
  var price = closes[closes.length - 1];
  var threshold = price * 0.003;
  var clusters = [];
  var cluster = [allLevels[0]];
  for (var j = 1; j < allLevels.length; j++) {
    if (allLevels[j] - allLevels[j - 1] < threshold) { cluster.push(allLevels[j]); }
    else { if (cluster.length >= 2) clusters.push(cluster.reduce(function (a, b) { return a + b; }, 0) / cluster.length); cluster = [allLevels[j]]; }
  }
  if (cluster.length >= 2) clusters.push(cluster.reduce(function (a, b) { return a + b; }, 0) / cluster.length);
  var sups = clusters.filter(function (c) { return c < price; }).sort(function (a, b) { return b - a; });
  var ress = clusters.filter(function (c) { return c > price; }).sort(function (a, b) { return a - b; });
  var sup = sups[0] || price * 0.985;
  var res = ress[0] || price * 1.015;
  var volPct = (atr / price) * 100;
  var sma10 = closes.slice(-10).reduce(function (a, b) { return a + b; }, 0) / 10;
  var sma20 = closes.slice(-20).reduce(function (a, b) { return a + b; }, 0) / Math.min(20, closes.length);
  var mom = ((price - sma10) / sma10) * 100;
  var trend = price > sma20 ? "up" : "down";
  var gains = 0, losses = 0;
  var rp = Math.min(14, closes.length - 1);
  for (var k = closes.length - rp; k < closes.length; k++) {
    var diff = closes[k] - closes[k - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  var rsi = losses === 0 ? 100 : 100 - (100 / (1 + (gains / rp) / (losses / rp)));
  return { atr: atr, sup: sup, res: res, volPct: volPct, mom: mom, rsi: rsi, price: price, trend: trend };
}

function makeTrade(coin, md, type, tc, desc, eL, eH, tL, tH, stop, conf, analysis, risk) {
  var rm = risk || { targetMult: 1, stopMult: 1 };
  var ae = (eL + eH) / 2;
  // Apply risk multipliers to target distance and stop distance
  var rawTargetDist = ((tL + tH) / 2) - ae;
  var rawStopDist = ae - stop;
  var adjTL = ae + rawTargetDist * rm.targetMult;
  var adjTH = ae + (tH - ae + (tH - tL) / 2) * rm.targetMult;
  var adjStop = ae - rawStopDist * rm.stopMult;
  conf = Math.max(10, Math.min(95, Math.round(conf)));
  var at = (adjTL + adjTH) / 2;
  var ppct = ((at - ae) / ae) * 100;
  var lpct = Math.abs((adjStop - ae) / ae) * 100;
  var rr = lpct > 0 ? ppct / lpct : 1;
  var score = (ppct / 6) * 0.35 + (conf / 100) * 0.35 + Math.min(rr / 3, 1) * 0.3;
  return {
    symbol: coin.symbol, name: coin.name, type: type, typeColor: tc, desc: desc,
    entryLow: eL, entryHigh: eH, targetLow: adjTL, targetHigh: adjTH, stop: adjStop,
    rr: "1:" + rr.toFixed(1), confidence: conf, direction: "Long", profitPct: ppct, score: score,
    bid: md.bid, ask: md.ask, spread: md.spread,
    atrPct: analysis ? analysis.volPct : null, rsi: analysis ? analysis.rsi : null,
    momentum: analysis ? analysis.mom : null, supportLevel: analysis ? analysis.sup : null,
    resistanceLevel: analysis ? analysis.res : null, trend: analysis ? analysis.trend : null,
    coinId: coin.id,
  };
}

function generateTrades(coin, md, analysis, risk) {
  var trades = [];
  var p = md.price;
  var ch = md.change24h || 0;
  if (!analysis) {
    var atr = p * 0.012;
    trades.push(makeTrade(coin, md, "Scalp", "#06b6d4", coin.symbol + " — scalp opportunity.", p - atr * 0.3, p, p + atr * 1.8, p + atr * 2.2, p - atr * 1.2, 55, null, risk));
    return trades;
  }
  var atr2 = analysis.atr;
  var sup = analysis.sup;
  var res = analysis.res;
  var volPct = analysis.volPct;
  var mom = analysis.mom;
  var rsi = analysis.rsi;
  var trend = analysis.trend;

  // Scalp
  if (volPct > 0.3) {
    var c1 = 60;
    if (mom > 0.5) c1 += 8;
    if (rsi < 60) c1 += 5;
    if (md.spread != null && md.spread < 0.05) c1 += 5;
    trades.push(makeTrade(coin, md, "Scalp", "#06b6d4",
      coin.symbol + " scalp — vol " + volPct.toFixed(1) + "%, " + (mom > 0 ? "bullish" : "bearish") + " momentum. Target " + ((p + atr2 * 2.0 - p) / p * 100).toFixed(1) + "% move.",
      p - atr2 * 0.4, p, p + atr2 * 1.5, p + atr2 * 2.0, p - atr2 * 1.2, c1, analysis, risk));
  }

  // Long
  if (trend === "up" || mom > 0.3) {
    var c2 = 55;
    if (trend === "up") c2 += 10;
    if (rsi < 65) c2 += 5;
    if (ch > 2) c2 += 5;
    trades.push(makeTrade(coin, md, "Long", "#22c55e",
      coin.symbol + " long — " + trend + " trend, targeting " + ((p + atr2 * 4.0 - p) / p * 100).toFixed(1) + "% gain with wider stop.",
      p - atr2 * 0.5, p + atr2 * 0.1, p + atr2 * 3.0, p + atr2 * 4.0, p - atr2 * 1.8, c2, analysis, risk));
  }

  // Breakout
  if (((res - p) / p) * 100 < 2 && mom > 0) {
    var c3 = 58;
    if (volPct > 0.5) c3 += 6;
    if (ch > 1) c3 += 5;
    trades.push(makeTrade(coin, md, "Breakout", "#f59e0b",
      coin.symbol + " breakout — pressing resistance $" + fmt(res) + ". Break could trigger " + ((res + atr2 * 3.5 - res) / res * 100).toFixed(1) + "% run.",
      res * 0.998, res * 1.005, res + atr2 * 2.5, res + atr2 * 3.5, res - atr2 * 1.2, c3, analysis, risk));
  }

  // Dip Buy
  if (rsi < 40 || ch < -2) {
    var c4 = 52;
    if (rsi < 30) c4 += 10;
    if (((p - sup) / p) * 100 < 1.5) c4 += 8;
    trades.push(makeTrade(coin, md, "Dip Buy", "#8b5cf6",
      coin.symbol + " dip buy — oversold RSI " + rsi.toFixed(0) + " near support $" + fmt(sup) + ". Aggressive reversal targeting " + ((sup + atr2 * 3.5 - sup) / sup * 100).toFixed(1) + "% bounce.",
      sup * 0.997, sup * 1.005, sup + atr2 * 2.5, sup + atr2 * 3.5, sup - atr2 * 1.5, c4, analysis, risk));
  }

  // Momentum
  if (mom > 1 && volPct > 0.4) {
    var c5 = 62;
    if (ch > 3) c5 += 8;
    if (trend === "up") c5 += 6;
    trades.push(makeTrade(coin, md, "Momentum", "#f97316",
      coin.symbol + " momentum — " + mom.toFixed(1) + "% above SMA, " + ch.toFixed(1) + "% 24h. Riding the wave.",
      p - atr2 * 0.2, p + atr2 * 0.1, p + atr2 * 2.0, p + atr2 * 3.0, p - atr2 * 1.5, c5, analysis, risk));
  }

  // Reversal
  if (rsi < 30 && trend === "down" && ch < -3) {
    var c6 = 45;
    if (rsi < 25) c6 += 8;
    trades.push(makeTrade(coin, md, "Reversal", "#ec4899",
      coin.symbol + " reversal — deeply oversold RSI " + rsi.toFixed(0) + ", down " + Math.abs(ch).toFixed(1) + "%. Contrarian high risk/reward play.",
      p - atr2 * 0.3, p + atr2 * 0.1, p + atr2 * 3.0, p + atr2 * 4.5, p - atr2 * 2.0, c6, analysis, risk));
  }

  if (trades.length === 0) {
    trades.push(makeTrade(coin, md, "Scalp", "#06b6d4", coin.symbol + " — range scalp.", p - atr2 * 0.5, p, p + atr2 * 2.0, p + atr2 * 2.8, p - atr2 * 1.3, 50, analysis, risk));
  }
  return trades;
}

export default function CryptoDashboard() {
  var width = useWidth();
  var mob = width < 640;
  var st = useState;

  var _tab = st("all"), tab = _tab[0], setTab = _tab[1];
  var _time = st(new Date()), time = _time[0], setTime = _time[1];
  var _amounts = st([100, 500, 1000]), amounts = _amounts[0], setAmounts = _amounts[1];
  var _editAmts = st(false), editAmts = _editAmts[0], setEditAmts = _editAmts[1];
  var _tmpAmts = st("100, 500, 1000"), tmpAmts = _tmpAmts[0], setTmpAmts = _tmpAmts[1];
  var _merged = st({}), merged = _merged[0], setMerged = _merged[1];
  var _globalData = st(null), globalData = _globalData[0], setGlobalData = _globalData[1];
  var _fearGreed = st(null), fearGreed = _fearGreed[0], setFearGreed = _fearGreed[1];
  var _sources = st({ krakenWs: "loading", coingecko: "loading", binance: "loading", cryptocompare: "loading", feargreed: "loading", krakenOhlc: "loading" }), sources = _sources[0], setSources = _sources[1];
  var _ohlcData = st({}), ohlcData = _ohlcData[0], setOhlcData = _ohlcData[1];
  var _lastUp = st(null), setLastUp = _lastUp[1];
  var _usingFb = st(false), usingFb = _usingFb[0], setUsingFb = _usingFb[1];
  var _showSrc = st(false), showSrc = _showSrc[0], setShowSrc = _showSrc[1];
  var _feeTier = st(0), feeTier = _feeTier[0], setFeeTier = _feeTier[1];
  var _showFee = st(false), showFee = _showFee[0], setShowFee = _showFee[1];
  var _wsConn = st(false), wsConn = _wsConn[0], setWsConn = _wsConn[1];
  var _wsTick = st(0), wsTick = _wsTick[0], setWsTick = _wsTick[1];
  var _krakenLive = st({}), krakenLive = _krakenLive[0], setKrakenLive = _krakenLive[1];

  var _balance = st(5000), balance = _balance[0], setBalance = _balance[1];
  var _openTrades = st([]), openTrades = _openTrades[0], setOpenTrades = _openTrades[1];
  var _closedTrades = st([]), closedTrades = _closedTrades[0], setClosedTrades = _closedTrades[1];
  var _editBal = st(false), editBal = _editBal[0], setEditBal = _editBal[1];
  var _tmpBal = st("5000"), tmpBal = _tmpBal[0], setTmpBal = _tmpBal[1];
  var _showPort = st(true), showPort = _showPort[0], setShowPort = _showPort[1];
  var _notif = st(null), notif = _notif[0], setNotif = _notif[1];
  var _expTrade = st(null), expTrade = _expTrade[0], setExpTrade = _expTrade[1];
  var _riskLevel = st(1), riskLevel = _riskLevel[0], setRiskLevel = _riskLevel[1];

  var wsRef = useRef(null);
  var klRef = useRef({});
  var rcTimer = useRef(null);
  var fees = FEE_TIERS[feeTier];

  function useWidth() {
    var _w = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
    useEffect(function () {
      function h() { _w[1](window.innerWidth); }
      window.addEventListener("resize", h);
      return function () { window.removeEventListener("resize", h); };
    }, []);
    return _w[0];
  }

  // Price history recording
  useEffect(function () {
    if (openTrades.length === 0) return;
    setOpenTrades(function (prev) {
      return prev.map(function (t) {
        var cp = merged[t.coinId] ? merged[t.coinId].price : null;
        if (!cp) return t;
        var hist = t.priceHistory || [];
        if (hist.length === 0 || Date.now() - hist[hist.length - 1].t > 5000) {
          return Object.assign({}, t, { priceHistory: hist.concat([{ p: cp, t: Date.now() }]).slice(-200) });
        }
        return t;
      });
    });
  }, [wsTick, merged]);

  // Auto close
  useEffect(function () {
    if (openTrades.length === 0) return;
    openTrades.forEach(function (t) {
      var cp = merged[t.coinId] ? merged[t.coinId].price : null;
      if (!cp) return;
      if (cp >= t.targetPrice) closeTrade(t.id, "Target ✅");
      else if (cp <= t.stopPrice) closeTrade(t.id, "Stop ❌");
    });
  }, [merged, wsTick]);

  function enterTrade(trade, amt) {
    var ep = (trade.entryLow + trade.entryHigh) / 2;
    var tp = (trade.targetLow + trade.targetHigh) / 2;
    var fee = amt * (fees.taker / 100);
    var cost = amt + fee;
    if (cost > balance) { setNotif({ m: "Not enough balance!", c: "#ef4444" }); setTimeout(function () { setNotif(null); }, 3000); return; }
    var coins = amt / ep;
    var tradeId = Date.now();
    setBalance(function (b) { return b - cost; });
    setOpenTrades(function (prev) {
      return prev.concat([{
        id: tradeId, symbol: trade.symbol, coinId: trade.coinId || COINS.find(function (c) { return c.symbol === trade.symbol; }).id,
        type: trade.type, entryPrice: ep, targetPrice: tp, stopPrice: trade.stop, coins: coins, investAmt: amt, entryFee: fee,
        enteredAt: new Date().toLocaleTimeString(), status: "open", priceHistory: [{ p: ep, t: Date.now() }]
      }]);
    });
    setNotif({ m: "Opened " + trade.symbol + " " + trade.type + " — $" + amt, c: "#22c55e" });
    setTimeout(function () { setNotif(null); }, 3000);
    // Auto-expand the new trade's chart
    setExpTrade(tradeId);
    setShowPort(true);
  }

  function closeTrade(id, reason) {
    setOpenTrades(function (prev) {
      var t = prev.find(function (x) { return x.id === id; });
      if (!t) return prev;
      var cp = merged[t.coinId] ? merged[t.coinId].price : t.entryPrice;
      var gv = t.coins * cp;
      var xf = gv * (fees.maker / 100);
      var net = gv - xf;
      var pnl = net - t.investAmt - t.entryFee;
      var pnlPct = (pnl / t.investAmt) * 100;
      setBalance(function (b) { return b + net; });
      setClosedTrades(function (ct) { return ct.concat([Object.assign({}, t, { exitPrice: cp, pnl: pnl, pnlPct: pnlPct, reason: reason || "Manual", closedAt: new Date().toLocaleTimeString() })]); });
      setNotif({ m: t.symbol + " " + reason + " " + (pnl >= 0 ? "+" : "") + "$" + fmt(pnl), c: pnl >= 0 ? "#22c55e" : "#ef4444" });
      setTimeout(function () { setNotif(null); }, 3000);
      if (expTrade === id) setExpTrade(null);
      return prev.filter(function (x) { return x.id !== id; });
    });
  }

  var openPnl = openTrades.reduce(function (s, t) {
    var cp = merged[t.coinId] ? merged[t.coinId].price : t.entryPrice;
    return s + (t.coins * cp * (1 - fees.maker / 100) - t.investAmt - t.entryFee);
  }, 0);
  var closedPnl = closedTrades.reduce(function (s, t) { return s + t.pnl; }, 0);
  var wins = closedTrades.filter(function (t) { return t.pnl > 0; }).length;
  var invested = openTrades.reduce(function (s, t) { return s + t.investAmt + t.entryFee; }, 0);
  var totalEq = balance + invested + openPnl;

  // WebSocket
  var connectWs = useCallback(function () {
    try {
      if (wsRef.current && wsRef.current.readyState < 2) return;
      var ws = new WebSocket("wss://ws.kraken.com");
      wsRef.current = ws;
      ws.onopen = function () {
        setWsConn(true); setSources(function (p) { return Object.assign({}, p, { krakenWs: "live" }); });
        ws.send(JSON.stringify({ event: "subscribe", pair: COINS.map(function (c) { return c.krakenWs; }), subscription: { name: "ticker" } }));
      };
      ws.onmessage = function (e) {
        try {
          var d = JSON.parse(e.data);
          if (Array.isArray(d) && d.length >= 4) {
            var tk = d[1], pn = d[3];
            var coin = COINS.find(function (c) { return c.krakenWs === pn; });
            if (coin && tk && tk.c) {
              var last = parseFloat(tk.c[0]), open = parseFloat(tk.o[0]);
              klRef.current = Object.assign({}, klRef.current);
              klRef.current[coin.id] = { price: last, bid: parseFloat(tk.b[0]), ask: parseFloat(tk.a[0]), high: parseFloat(tk.h[1]), low: parseFloat(tk.l[1]), vol: parseFloat(tk.v[1]) * last, change: ((last - open) / open) * 100, spread: ((parseFloat(tk.a[0]) - parseFloat(tk.b[0])) / last) * 100, ts: Date.now() };
              setKrakenLive(Object.assign({}, klRef.current));
              setWsTick(function (p) { return p + 1; });
            }
          }
        } catch (err) { /* ignore */ }
      };
      ws.onclose = function () { setWsConn(false); setSources(function (p) { return Object.assign({}, p, { krakenWs: "error" }); }); rcTimer.current = setTimeout(connectWs, 5000); };
      ws.onerror = function () { setSources(function (p) { return Object.assign({}, p, { krakenWs: "error" }); }); };
    } catch (err) { /* ignore */ }
  }, []);

  useEffect(function () { connectWs(); return function () { if (wsRef.current) wsRef.current.close(); if (rcTimer.current) clearTimeout(rcTimer.current); }; }, [connectWs]);

  var fetchOhlc = useCallback(function () {
    var doFetch = async function () {
      var res = {}; var ok = 0;
      for (var i = 0; i < COINS.length; i++) {
        try {
          var d = await safeFetch("https://api.kraken.com/0/public/OHLC?pair=" + COINS[i].krakenOhlc + "&interval=15");
          if (d.result) { var k = Object.keys(d.result).find(function (x) { return x !== "last"; }); if (k) { res[COINS[i].id] = d.result[k].slice(-100).map(function (c) { return [c[0], parseFloat(c[1]), parseFloat(c[2]), parseFloat(c[3]), parseFloat(c[4]), parseFloat(c[5]), parseFloat(c[6])]; }); ok++; } }
          await new Promise(function (r) { setTimeout(r, 300); });
        } catch (e) { /* skip */ }
      }
      setOhlcData(res);
      setSources(function (p) { return Object.assign({}, p, { krakenOhlc: ok > 0 ? "live" : "error" }); });
    };
    doFetch();
  }, []);

  var fetchAll = useCallback(function () {
    var doFetch = async function () {
      var pd = {};
      COINS.forEach(function (c) { pd[c.id] = { prices: [], change24h: [], high24h: [], low24h: [], volume: [], sparkline: null, sourceNames: [] }; });
      var any = false;

      COINS.forEach(function (c) {
        var kl = klRef.current[c.id];
        if (kl && Date.now() - kl.ts < 120000) {
          pd[c.id].prices.push(kl.price); pd[c.id].change24h.push(kl.change); pd[c.id].high24h.push(kl.high); pd[c.id].low24h.push(kl.low); pd[c.id].volume.push(kl.vol); pd[c.id].sourceNames.push("WS"); any = true;
        }
      });

      try {
        var d = await safeFetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" + COINS.map(function (c) { return c.id; }).join(",") + "&order=market_cap_desc&sparkline=true&price_change_percentage=24h");
        d.forEach(function (c) { if (pd[c.id]) { pd[c.id].prices.push(c.current_price); if (c.price_change_percentage_24h != null) pd[c.id].change24h.push(c.price_change_percentage_24h); if (c.high_24h) pd[c.id].high24h.push(c.high_24h); if (c.total_volume) pd[c.id].volume.push(c.total_volume); if (c.sparkline_in_7d && c.sparkline_in_7d.price) pd[c.id].sparkline = c.sparkline_in_7d.price.slice(-48); pd[c.id].sourceNames.push("CG"); } });
        setSources(function (p) { return Object.assign({}, p, { coingecko: "live" }); }); any = true;
      } catch (e) { setSources(function (p) { return Object.assign({}, p, { coingecko: "error" }); }); }

      try {
        var syms = COINS.map(function (c) { return c.binance; }).filter(Boolean);
        var d2 = await safeFetch("https://api.binance.com/api/v3/ticker/24hr?symbols=" + JSON.stringify(syms));
        d2.forEach(function (t) { var coin = COINS.find(function (c) { return c.binance === t.symbol; }); if (coin && pd[coin.id]) { pd[coin.id].prices.push(parseFloat(t.lastPrice)); pd[coin.id].change24h.push(parseFloat(t.priceChangePercent)); pd[coin.id].sourceNames.push("BN"); } });
        setSources(function (p) { return Object.assign({}, p, { binance: "live" }); }); any = true;
      } catch (e) { setSources(function (p) { return Object.assign({}, p, { binance: "error" }); }); }

      try {
        var d3 = await safeFetch("https://min-api.cryptocompare.com/data/pricemultifull?fsyms=" + COINS.map(function (c) { return c.cc; }).join(",") + "&tsyms=USD");
        if (d3.RAW) COINS.forEach(function (c) { var r = d3.RAW[c.cc] ? d3.RAW[c.cc].USD : null; if (r && pd[c.id]) { pd[c.id].prices.push(r.PRICE); if (r.CHANGEPCT24HOUR != null) pd[c.id].change24h.push(r.CHANGEPCT24HOUR); pd[c.id].sourceNames.push("CC"); } });
        setSources(function (p) { return Object.assign({}, p, { cryptocompare: "live" }); }); any = true;
      } catch (e) { setSources(function (p) { return Object.assign({}, p, { cryptocompare: "error" }); }); }

      try { var d4 = await safeFetch("https://api.alternative.me/fng/?limit=1"); if (d4.data && d4.data[0]) setFearGreed({ value: parseInt(d4.data[0].value), label: d4.data[0].value_classification }); setSources(function (p) { return Object.assign({}, p, { feargreed: "live" }); }); } catch (e) { setSources(function (p) { return Object.assign({}, p, { feargreed: "error" }); }); }
      try { var d5 = await safeFetch("https://api.coingecko.com/api/v3/global"); if (d5.data) setGlobalData(d5.data); } catch (e) { /* skip */ }

      if (!any) {
        var m = {};
        COINS.forEach(function (c) { var fb = FALLBACK_DATA[c.id]; if (fb) m[c.id] = { price: fb.price, change24h: fb.change, high24h: fb.high, low24h: fb.low, volume: fb.vol * 1e9, sparkline: genSparkline(fb.price, fb.change), sourceCount: 0, sourceNames: ["FB"], bid: null, ask: null, spread: null }; });
        setMerged(m); setUsingFb(true); setLastUp(new Date()); return;
      }
      setUsingFb(false);
      function avg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; }
      var m2 = {};
      COINS.forEach(function (c) {
        var p2 = pd[c.id]; var ap = avg(p2.prices); var kl = klRef.current[c.id];
        if (!ap) return;
        m2[c.id] = { price: ap, change24h: avg(p2.change24h), high24h: p2.high24h.length ? Math.max.apply(null, p2.high24h) : null, low24h: p2.low24h.length ? Math.min.apply(null, p2.low24h) : null, volume: avg(p2.volume), sparkline: p2.sparkline || genSparkline(ap, avg(p2.change24h) || 0), sourceCount: p2.prices.length, sourceNames: Array.from(new Set(p2.sourceNames)), bid: kl ? kl.bid : null, ask: kl ? kl.ask : null, spread: kl ? kl.spread : null };
      });
      setMerged(m2); setLastUp(new Date());
    };
    doFetch();
  }, []);

  useEffect(function () { fetchAll(); fetchOhlc(); var i1 = setInterval(fetchAll, 60000); var i2 = setInterval(fetchOhlc, 300000); return function () { clearInterval(i1); clearInterval(i2); }; }, []);
  useEffect(function () { var t = setInterval(function () { setTime(new Date()); }, 1000); return function () { clearInterval(t); }; }, []);
  useEffect(function () {
    if (!Object.keys(krakenLive).length) return;
    setMerged(function (prev) {
      var n = Object.assign({}, prev);
      COINS.forEach(function (c) { var kl = krakenLive[c.id]; if (kl && n[c.id]) { n[c.id] = Object.assign({}, n[c.id], { bid: kl.bid, ask: kl.ask, spread: kl.spread }); if (kl.ts > (n[c.id]._t || 0)) { n[c.id].price = n[c.id].price ? (n[c.id].price * 0.4 + kl.price * 0.6) : kl.price; n[c.id].change24h = kl.change; n[c.id]._t = kl.ts; } } });
      return n;
    });
  }, [wsTick]);

  var liveCount = Object.values(sources).filter(function (s) { return s === "live"; }).length;
  var hasPrices = Object.values(merged).some(function (m) { return m.price != null; });

  var allTrades = COINS.flatMap(function (c) {
    var d = merged[c.id];
    if (!d || !d.price) return [];
    return generateTrades(c, d, analyzeOhlc(ohlcData[c.id] || null), RISK_PROFILES[riskLevel]);
  }).sort(function (a, b) { return b.score - a.score; });

  var tradeTypes = ["all"].concat(Array.from(new Set(allTrades.map(function (t) { return t.type.toLowerCase(); }))));
  var filteredTrades = tab === "all" ? allTrades : allTrades.filter(function (t) { return t.type.toLowerCase() === tab; });

  function saveAmts() { var p = tmpAmts.split(",").map(function (s) { return parseFloat(s.trim()); }).filter(function (n) { return !isNaN(n) && n > 0; }); if (p.length > 0) { setAmounts(p); setEditAmts(false); } }

  var fg = fearGreed || { value: 62, label: "Greed" };
  var fgColor = fg.value > 55 ? "#22c55e" : fg.value > 45 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ background: "#0a0e17", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Inter',-apple-system,sans-serif", padding: mob ? "12px" : "20px 24px", WebkitTextSizeAdjust: "100%" }}>
      {notif && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: notif.c, color: "#fff", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", maxWidth: "90vw", textAlign: "center" }}>{notif.m}</div>}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: mob ? "flex-start" : "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: mob ? 20 : 24, fontWeight: 700, margin: 0, color: "#f8fafc" }}><span style={{ color: "#8b5cf6" }}>Crypto</span> Day Trader</h1>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>{time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {time.toLocaleTimeString()}</p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {wsConn && <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#22c55e15", border: "1px solid #22c55e30", borderRadius: 8, padding: "4px 8px" }}><div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} /><span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>LIVE</span></div>}
          <button onClick={function () { fetchAll(); fetchOhlc(); }} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>🔄</button>
        </div>
      </div>

      {/* Paper Portfolio */}
      <div style={{ background: "linear-gradient(135deg,#111827,#0f172a)", border: "1px solid #8b5cf640", borderRadius: 14, padding: mob ? "12px" : "16px 20px", marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#8b5cf6" }}>📋 Paper Trading</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={function () { setShowPort(!showPort); }} style={{ background: "none", border: "1px solid #334155", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#64748b", cursor: "pointer" }}>{showPort ? "−" : "+"}</button>
            <button onClick={function () { setBalance(5000); setOpenTrades([]); setClosedTrades([]); }} style={{ background: "#ef444420", border: "1px solid #ef444440", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#ef4444", cursor: "pointer" }}>Reset</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(5,1fr)", gap: 8 }}>
          <div style={{ background: "#0a0e17", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 9, color: "#64748b" }}>CASH</div>
            {editBal ? (
              <div style={{ display: "flex", gap: 4 }}>
                <input value={tmpBal} onChange={function (e) { setTmpBal(e.target.value); }} style={{ background: "#111827", border: "1px solid #8b5cf6", borderRadius: 6, padding: "2px 6px", fontSize: 14, color: "#f8fafc", width: 80, outline: "none" }} />
                <button onClick={function () { var v = parseFloat(tmpBal); if (!isNaN(v) && v >= 0) { setBalance(v); setEditBal(false); } }} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✓</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>${balance.toFixed(2)}</span>
                <button onClick={function () { setTmpBal(balance.toFixed(0)); setEditBal(true); }} style={{ background: "none", border: "none", fontSize: 11, cursor: "pointer", color: "#64748b" }}>✏️</button>
              </div>
            )}
          </div>
          <div style={{ background: "#0a0e17", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9, color: "#64748b" }}>EQUITY</div><div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>${totalEq.toFixed(2)}</div></div>
          <div style={{ background: "#0a0e17", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9, color: "#64748b" }}>OPEN P&L</div><div style={{ fontSize: 16, fontWeight: 700, color: openPnl >= 0 ? "#22c55e" : "#ef4444" }}>{openPnl >= 0 ? "+" : ""}${fmt(openPnl)}</div></div>
          <div style={{ background: "#0a0e17", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9, color: "#64748b" }}>REALIZED</div><div style={{ fontSize: 16, fontWeight: 700, color: closedPnl >= 0 ? "#22c55e" : "#ef4444" }}>{closedPnl >= 0 ? "+" : ""}${fmt(closedPnl)}</div></div>
          <div style={{ background: "#0a0e17", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9, color: "#64748b" }}>WIN RATE</div><div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>{closedTrades.length > 0 ? ((wins / closedTrades.length) * 100).toFixed(0) + "%" : "—"} <span style={{ fontSize: 10, color: "#64748b" }}>({wins}/{closedTrades.length})</span></div></div>
        </div>

        {showPort && openTrades.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Open ({openTrades.length})</div>
            {openTrades.map(function (t) {
              var cp = merged[t.coinId] ? merged[t.coinId].price : t.entryPrice;
              var pnl = t.coins * cp * (1 - fees.maker / 100) - t.investAmt - t.entryFee;
              var pnlPct = (pnl / t.investAmt) * 100;
              var isExp = expTrade === t.id;
              return (
                <div key={t.id} style={{ background: "#0a0e17", borderRadius: 10, padding: "10px 12px", marginBottom: 6, border: "1px solid " + (pnl >= 0 ? "#22c55e20" : "#ef444420") }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, cursor: "pointer" }} onClick={function () { setExpTrade(isExp ? null : t.id); }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>{t.symbol}</span>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{t.type} · ${t.investAmt}</span>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>@ ${fmt(t.entryPrice)} → ${fmt(cp)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>{pnl >= 0 ? "+" : ""}${fmt(pnl)} ({pnlPct.toFixed(1)}%)</span>
                      <button onClick={function (e) { e.stopPropagation(); closeTrade(t.id, "Manual"); }} style={{ background: "#ef444420", border: "1px solid #ef444440", borderRadius: 6, padding: "3px 8px", fontSize: 10, color: "#ef4444", cursor: "pointer" }}>Close</button>
                      <span style={{ fontSize: 10, color: "#64748b" }}>{isExp ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  {isExp && <TradeChartComponent trade={t} currentPrice={cp} mobile={mob} />}
                </div>
              );
            })}
          </div>
        )}

        {showPort && closedTrades.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>History ({closedTrades.length})</div>
            <div style={{ maxHeight: 100, overflowY: "auto" }}>
              {closedTrades.slice().reverse().slice(0, 10).map(function (t, i) {
                return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "3px 6px", background: "#111827", borderRadius: 4, marginBottom: 2 }}>
                    <span style={{ color: "#94a3b8" }}>{t.symbol} {t.type} · ${t.investAmt} · {t.reason}</span>
                    <span style={{ fontWeight: 600, color: t.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{t.pnl >= 0 ? "+" : ""}${fmt(t.pnl)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Risk Profile Selector */}
      <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: mob ? "8px 10px" : "10px 16px", marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Risk Level</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {RISK_PROFILES.map(function (rp, i) {
            var active = riskLevel === i;
            return (
              <button key={i} onClick={function () { setRiskLevel(i); }} style={{
                background: active ? rp.color + "20" : "#0a0e17",
                border: "2px solid " + (active ? rp.color : "#1e293b"),
                borderRadius: 10, padding: mob ? "8px 6px" : "10px 12px", cursor: "pointer", textAlign: "center",
                transition: "all 0.2s",
              }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{rp.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: active ? rp.color : "#94a3b8" }}>{rp.label}</div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{rp.desc}</div>
                <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>Target: {rp.targetMult}x · Stop: {rp.stopMult}x</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fees + Sources */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ background: "#111827", border: "1px solid #f9731630", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <span style={{ fontSize: 10, color: "#f97316", fontWeight: 700 }}>🐙</span>
          <span style={{ fontSize: 10, color: "#94a3b8" }}>{fees.maker}%/{fees.taker}%</span>
          <button onClick={function () { setShowFee(!showFee); }} style={{ background: "#f9731620", border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 9, color: "#f97316", cursor: "pointer", marginLeft: "auto" }}>{showFee ? "Close" : "Change"}</button>
        </div>
        <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#64748b" }}>SRC</span>
          <span style={{ fontSize: 10, color: liveCount >= 4 ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>{liveCount}/7</span>
          <button onClick={function () { setShowSrc(!showSrc); }} style={{ background: "none", border: "1px solid #334155", borderRadius: 4, padding: "2px 6px", fontSize: 9, color: "#64748b", cursor: "pointer" }}>{showSrc ? "−" : "+"}</button>
        </div>
      </div>
      {showFee && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 6 }}>
          {FEE_TIERS.map(function (t, i) {
            return (
              <button key={i} onClick={function () { setFeeTier(i); setShowFee(false); }} style={{ background: feeTier === i ? "#f9731625" : "#0a0e17", border: "1px solid " + (feeTier === i ? "#f97316" : "#1e293b"), borderRadius: 6, padding: "6px 8px", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: feeTier === i ? "#f97316" : "#94a3b8" }}>{t.label}</div>
                <div style={{ fontSize: 9, color: "#64748b" }}>{t.maker}%/{t.taker}%</div>
              </button>
            );
          })}
        </div>
      )}
      {showSrc && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", background: "#111827", borderRadius: 8, padding: "8px 12px", marginBottom: 6 }}>
          <SourceDotComponent status={sources.krakenWs} label="Kraken WS" />
          <SourceDotComponent status={sources.krakenOhlc} label="OHLC" />
          <SourceDotComponent status={sources.binance} label="Binance" />
          <SourceDotComponent status={sources.coingecko} label="CoinGecko" />
          <SourceDotComponent status={sources.cryptocompare} label="CC" />
          <SourceDotComponent status={sources.feargreed} label="F&G" />
        </div>
      )}

      {usingFb && (
        <div style={{ background: "#f59e0b15", border: "1px solid #f59e0b40", borderRadius: 10, padding: "8px 12px", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#f59e0b", flex: 1 }}>⚠️ Sample data — host for live</span>
          <button onClick={fetchAll} style={{ background: "#f59e0b", color: "#000", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {hasPrices && (
        <>
          {/* Market */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12, marginTop: 8 }}>
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9, color: "#64748b" }}>MARKET CAP</div><div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>${globalData ? (globalData.total_market_cap.usd / 1e12).toFixed(2) : "2.84"}T</div></div>
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9, color: "#64748b" }}>24H VOL</div><div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>${globalData ? (globalData.total_volume.usd / 1e9).toFixed(1) : "98.2"}B</div></div>
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: "8px 10px" }}><div style={{ fontSize: 9, color: "#64748b" }}>FEAR & GREED</div><div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>{fg.value || "—"}</div>{fg.label && <div style={{ fontSize: 10, color: fgColor }}>{fg.label}</div>}</div>
          </div>

          {/* Coins */}
          <div style={{ overflowX: "auto", marginBottom: 14, WebkitOverflowScrolling: "touch" }}>
            <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
              {COINS.map(function (c) {
                var d = merged[c.id];
                if (!d || !d.price) return null;
                var ch = d.change24h || 0;
                var col = ch >= 0 ? "#22c55e" : "#ef4444";
                return (
                  <div key={c.id} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: "10px", minWidth: mob ? 130 : 170, flex: "0 0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#f8fafc" }}>{c.symbol}</span>
                      <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 5, background: col + "18", color: col, fontWeight: 600 }}>{ch >= 0 ? "+" : ""}{ch.toFixed(1)}%</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 3 }}>${d.price.toLocaleString(undefined, { minimumFractionDigits: d.price < 1 ? 4 : d.price < 100 ? 2 : 0 })}</div>
                    <MiniChartComponent data={d.sparkline} color={col} mobile={mob} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trade Ideas */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ fontSize: mob ? 14 : 16, fontWeight: 600, color: "#f8fafc", margin: 0 }}>Trade Ideas <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>({filteredTrades.length})</span></h2>
              {editAmts ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <input value={tmpAmts} onChange={function (e) { setTmpAmts(e.target.value); }} style={{ background: "#0a0e17", border: "1px solid #8b5cf6", borderRadius: 8, padding: "5px 8px", fontSize: 11, color: "#f8fafc", width: 110, outline: "none" }} />
                  <button onClick={saveAmts} style={{ background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, padding: "5px 7px", fontSize: 11, cursor: "pointer" }}>✓</button>
                  <button onClick={function () { setEditAmts(false); }} style={{ background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: 6, padding: "5px 7px", fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <button onClick={function () { setTmpAmts(amounts.join(", ")); setEditAmts(true); }} style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "4px 10px", fontSize: 10, cursor: "pointer" }}>✏️ {amounts.map(function (a) { return "$" + a; }).join(", ")}</button>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              {tradeTypes.map(function (tp) {
                return (
                  <button key={tp} onClick={function () { setTab(tp); }} style={{ background: tab === tp ? "#8b5cf6" : "#1e293b", color: tab === tp ? "#fff" : "#94a3b8", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", whiteSpace: "nowrap" }}>{tp}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gap: mob ? 10 : 12 }}>
            {filteredTrades.map(function (t, i) {
              return (
                <div key={i} style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: mob ? "12px" : "16px 18px", position: "relative" }}>
                  {i === 0 && <div style={{ position: "absolute", top: -1, right: 14, background: "linear-gradient(135deg,#f59e0b,#f97316)", color: "#000", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: "0 0 6px 6px" }}>TOP</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: mob ? 15 : 17, color: "#f8fafc" }}>{t.symbol}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: t.typeColor + "20", color: t.typeColor, fontWeight: 600 }}>{t.type}</span>
                      <span style={{ fontSize: 10, padding: "2px 5px", borderRadius: 6, background: "#22c55e15", color: "#22c55e", fontWeight: 600 }}>+{t.profitPct.toFixed(1)}%</span>
                      {t.trend && <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 5, background: t.trend === "up" ? "#22c55e15" : "#ef444415", color: t.trend === "up" ? "#22c55e" : "#ef4444" }}>{t.trend === "up" ? "↑ Up" : "↓ Down"}</span>}
                    </div>
                  </div>
                  <p style={{ fontSize: mob ? 11 : 12, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 8px" }}>{t.desc}</p>

                  <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
                    {t.rsi != null && <span style={{ background: "#0a0e17", borderRadius: 5, padding: "2px 7px", fontSize: 10 }}><span style={{ color: "#64748b" }}>RSI </span><span style={{ color: t.rsi > 70 ? "#ef4444" : t.rsi < 30 ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>{t.rsi.toFixed(0)}</span></span>}
                    {t.atrPct != null && <span style={{ background: "#0a0e17", borderRadius: 5, padding: "2px 7px", fontSize: 10 }}><span style={{ color: "#64748b" }}>Vol </span><span style={{ color: "#8b5cf6", fontWeight: 600 }}>{t.atrPct.toFixed(1)}%</span></span>}
                    {t.supportLevel != null && <span style={{ background: "#0a0e17", borderRadius: 5, padding: "2px 7px", fontSize: 10 }}><span style={{ color: "#64748b" }}>S:</span><span style={{ color: "#06b6d4", fontWeight: 600 }}>${fmt(t.supportLevel)}</span></span>}
                    {t.resistanceLevel != null && <span style={{ background: "#0a0e17", borderRadius: 5, padding: "2px 7px", fontSize: 10 }}><span style={{ color: "#64748b" }}>R:</span><span style={{ color: "#f59e0b", fontWeight: 600 }}>${fmt(t.resistanceLevel)}</span></span>}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4,1fr)", gap: 6, marginBottom: 8 }}>
                    {[
                      { l: "Entry", v: "$" + fmt(t.entryLow) + "–" + fmt(t.entryHigh), c: "#8b5cf6" },
                      { l: "Target", v: "$" + fmt(t.targetLow) + "–" + fmt(t.targetHigh), c: "#22c55e" },
                      { l: "Stop", v: "$" + fmt(t.stop), c: "#ef4444" },
                      { l: "R/R", v: t.rr, c: "#f59e0b" },
                    ].map(function (x, j) {
                      return (
                        <div key={j} style={{ background: "#0a0e17", borderRadius: 8, padding: "7px 9px" }}>
                          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>{x.l}</div>
                          <div style={{ fontSize: mob ? 11 : 13, fontWeight: 600, color: x.c, wordBreak: "break-all" }}>{x.v}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>Confidence</div>
                    <ConfidenceBarComponent value={t.confidence} />
                  </div>

                  {/* Paper Trade Buttons */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid #1e293b" }}>
                    <span style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 600, display: "flex", alignItems: "center" }}>📋 Paper:</span>
                    {amounts.map(function (amt) {
                      var ok = amt + amt * (fees.taker / 100) <= balance;
                      return (
                        <button key={amt} onClick={function () { enterTrade(t, amt); }} disabled={!ok} style={{ background: ok ? "#8b5cf620" : "#1e293b", border: "1px solid " + (ok ? "#8b5cf6" : "#334155"), borderRadius: 8, padding: mob ? "7px 12px" : "7px 16px", fontSize: 12, fontWeight: 700, cursor: ok ? "pointer" : "not-allowed", color: ok ? "#f8fafc" : "#475569" }}>
                          ${amt}
                        </button>
                      );
                    })}
                  </div>

                  {!mob && <TradeExamplesComponent trade={t} amounts={amounts} fees={fees} mobile={false} />}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!hasPrices && (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc" }}>Connecting...</div>
        </div>
      )}

      <div style={{ marginTop: 20, padding: "10px", background: "#1e293b40", borderRadius: 10, border: "1px solid #1e293b" }}>
        <p style={{ fontSize: 10, color: "#64748b", margin: 0, lineHeight: 1.6 }}>⚠️ <strong style={{ color: "#94a3b8" }}>Disclaimer:</strong> Paper trading uses simulated money. Trade signals use Kraken OHLC analysis (S/R, ATR, RSI, momentum, trend). Not financial advice. Crypto involves significant risk.</p>
      </div>
      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}"}</style>
    </div>
  );
}
