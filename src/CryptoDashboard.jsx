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
  var d = [];
  var v = base * (1 - Math.abs(change) / 100);
  for (var i = 0; i < 48; i++) {
    v += v * ((change > 0 ? 0.3 : -0.3) + (Math.random() - 0.5) * 1.2) / 100;
    d.push(v);
  }
  return d;
}

async function safeFetch(url, timeout) {
  var ms = timeout || 10000;
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, ms);
  var resp = await fetch(url, { signal: ctrl.signal, mode: "cors" });
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
  var W = mobile ? 320 : 480;
  var H = mobile ? 130 : 120;
  var padL = 30;
  var padR = 50;
  var padT = 10;
  var padB = 18;
  var chartW = W - padL - padR;
  var chartH = H - padT - padB;

  var allPrices = hist.map(function (h) { return h.p; });
  allPrices.push(trade.targetPrice, trade.stopPrice, trade.entryPrice);
  if (currentPrice) allPrices.push(currentPrice);
  var maxP = Math.max.apply(null, allPrices);
  var minP = Math.min.apply(null, allPrices);
  var range = maxP - minP || 1;
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

  var fillPts = padL + "," + entryY;
  hist.forEach(function (h, i) { fillPts += " " + xP(i) + "," + yP(h.p); });
  fillPts += " " + lastX + "," + entryY;

  var startTime = new Date(hist[0].t);
  var endTime = new Date(hist[hist.length - 1].t);
  var elapsed = Math.round((endTime - startTime) / 1000);
  var elapsedStr = elapsed < 60 ? elapsed + "s" : Math.floor(elapsed / 60) + "m " + (elapsed % 60) + "s";

  return (
    <div style={{ background: "#0a0e17", borderRadius: 10, padding: mobile ? 8 : 10, marginTop: 8, maxWidth: mobile ? "100%" : 520 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#f8fafc" }}>📊 {trade.symbol}</span>
          <span style={{ fontSize: 10, color: pnlColor, fontWeight: 700 }}>{pnl >= 0 ? "+" : ""}{pnlPct}%</span>
        </div>
        <div style={{ display: "flex", gap: 6, fontSize: 9, color: "#64748b" }}>
          <span>⏱ {elapsedStr}</span>
          <span>{hist.length} ticks</span>
        </div>
      </div>
      <svg width={W} height={H} viewBox={"0 0 " + W + " " + H} style={{ display: "block", width: "100%", height: "auto" }}>
        <rect x={padL} y={targetY} width={chartW} height={Math.max(0, entryY - targetY)} fill="#22c55e06" />
        <rect x={padL} y={entryY} width={chartW} height={Math.max(0, stopY - entryY)} fill="#ef444406" />
        <line x1={padL} y1={targetY} x2={padL + chartW} y2={targetY} stroke="#22c55e" strokeWidth="1" strokeDasharray="6,4" />
        <line x1={padL} y1={entryY} x2={padL + chartW} y2={entryY} stroke="#8b5cf6" strokeWidth="1" strokeDasharray="6,4" />
        <line x1={padL} y1={stopY} x2={padL + chartW} y2={stopY} stroke="#ef4444" strokeWidth="1" strokeDasharray="6,4" />
        <polygon points={fillPts} fill={pnlColor} fillOpacity="0.08" />
        <polyline points={pts} fill="none" stroke={pnlColor} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={padL} cy={entryY} r="5" fill="#8b5cf6" stroke="#0a0e17" strokeWidth="2" />
        <circle cx={lastX} cy={lastY} r="6" fill={pnlColor} stroke="#0a0e17" strokeWidth="2" />
        <circle cx={lastX} cy={lastY} r="8" fill="none" stroke={pnlColor} strokeWidth="1" opacity="0.3" />
        <text x={2} y={targetY + 3} fill="#22c55e" fontSize="8" fontWeight="600">TP</text>
        <text x={2} y={entryY + 3} fill="#8b5cf6" fontSize="8" fontWeight="600">Entry</text>
        <text x={2} y={stopY + 3} fill="#ef4444" fontSize="8" fontWeight="600">SL</text>
        <text x={padL + chartW + 3} y={targetY + 3} fill="#22c55e" fontSize="8">{"$" + fmt(trade.targetPrice)}</text>
        <text x={padL + chartW + 3} y={entryY + 3} fill="#8b5cf6" fontSize="8">{"$" + fmt(trade.entryPrice)}</text>
        <text x={padL + chartW + 3} y={stopY + 3} fill="#ef4444" fontSize="8">{"$" + fmt(trade.stopPrice)}</text>
        {currentPrice && <text x={padL + chartW + 3} y={lastY + 3} fill={pnlColor} fontSize="9" fontWeight="700">{"$" + fmt(currentPrice)}</text>}
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
    if (diff > 0) gains += diff; e
