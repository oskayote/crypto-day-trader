import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & CONFIG
   ═══════════════════════════════════════════════════════════════ */

const COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", binance: "BTCUSDT", cc: "BTC", krakenWs: "XBT/USD", krakenOhlc: "XXBTZUSD", color: "#F7931A" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", binance: "ETHUSDT", cc: "ETH", krakenWs: "ETH/USD", krakenOhlc: "XETHZUSD", color: "#627EEA" },
  { id: "solana", symbol: "SOL", name: "Solana", binance: "SOLUSDT", cc: "SOL", krakenWs: "SOL/USD", krakenOhlc: "SOLUSD", color: "#9945FF" },
  { id: "ripple", symbol: "XRP", name: "Ripple", binance: "XRPUSDT", cc: "XRP", krakenWs: "XRP/USD", krakenOhlc: "XXRPZUSD", color: "#00AAE4" },
  { id: "cardano", symbol: "ADA", name: "Cardano", binance: "ADAUSDT", cc: "ADA", krakenWs: "ADA/USD", krakenOhlc: "ADAUSD", color: "#0033AD" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", binance: "DOGEUSDT", cc: "DOGE", krakenWs: "DOGE/USD", krakenOhlc: "XDGUSD", color: "#C2A633" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", binance: "DOTUSDT", cc: "DOT", krakenWs: "DOT/USD", krakenOhlc: "DOTUSD", color: "#E6007A" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", binance: "AVAXUSDT", cc: "AVAX", krakenWs: "AVAX/USD", krakenOhlc: "AVAXUSD", color: "#E84142" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", binance: "LINKUSDT", cc: "LINK", krakenWs: "LINK/USD", krakenOhlc: "LINKUSD", color: "#2A5ADA" },
  { id: "polygon", symbol: "POL", name: "Polygon", binance: "POLUSDT", cc: "POL", krakenWs: "POL/USD", krakenOhlc: "POLUSD", color: "#8247E5" },
];

const RISK_PROFILES = [
  { label: "Conservative", icon: "◆", color: "#26a69a", targetMul: 0.7, stopMul: 0.7, desc: "Tighter targets, tighter stops" },
  { label: "Moderate", icon: "◈", color: "#d4a017", targetMul: 1.0, stopMul: 1.0, desc: "Balanced risk/reward" },
  { label: "Aggressive", icon: "◇", color: "#ef5350", targetMul: 1.5, stopMul: 1.3, desc: "Wider targets, wider stops" },
];

const FEE_TIERS = [
  { label: "Starter", maker: 0.16, taker: 0.26 },
  { label: "Intermediate", maker: 0.14, taker: 0.24 },
  { label: "Advanced", maker: 0.12, taker: 0.22 },
  { label: "Pro", maker: 0.08, taker: 0.18 },
  { label: "Expert", maker: 0.04, taker: 0.14 },
  { label: "Elite", maker: 0.00, taker: 0.10 },
];

const FALLBACK_PRICES = {
  bitcoin: { price: 84250, change: -0.8 },
  ethereum: { price: 1835, change: 1.2 },
  solana: { price: 138.5, change: -2.1 },
  ripple: { price: 2.34, change: 3.5 },
  cardano: { price: 0.71, change: -0.4 },
  dogecoin: { price: 0.168, change: 1.8 },
  polkadot: { price: 4.12, change: 0.6 },
  "avalanche-2": { price: 21.4, change: -1.5 },
  chainlink: { price: 13.8, change: 2.3 },
  polygon: { price: 0.22, change: -0.3 },
};

const TRADE_TYPE_COLORS = {
  Scalp: "#26c6da",
  Long: "#26a69a",
  Breakout: "#ffb74d",
  "Dip Buy": "#ab47bc",
  Momentum: "#ff7043",
  Reversal: "#ec407a",
};

/* ═══════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

function formatPrice(v) {
  if (v == null || isNaN(v)) return "—";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Math.abs(v) >= 1) return v.toFixed(2);
  if (Math.abs(v) >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

function formatCompact(v) {
  if (v >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

function generateSparkline(basePrice, changePercent) {
  const data = [];
  let value = basePrice * (1 - Math.abs(changePercent) / 100);
  for (let i = 0; i < 48; i++) {
    value += value * ((changePercent > 0 ? 0.3 : -0.3) + (Math.random() - 0.5) * 1.2) / 100;
    data.push(value);
  }
  return data;
}

async function safeFetch(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  const response = await fetch(url, { signal: controller.signal, mode: "cors" });
  clearTimeout(timeout);
  if (!response.ok) throw new Error(response.status);
  return response.json();
}

function storageGet(key) {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.storage?.get) {
      window.storage.get(key).then((r) => resolve(r?.value || null)).catch(() => {
        try { resolve(localStorage.getItem(key)); } catch { resolve(null); }
      });
    } else {
      try { resolve(localStorage.getItem(key)); } catch { resolve(null); }
    }
  });
}

function storageSet(key, value) {
  if (typeof window !== "undefined" && window.storage?.set) {
    try { window.storage.set(key, value); } catch {}
  }
  try { localStorage.setItem(key, value); } catch {}
}

function storageDelete(key) {
  if (typeof window !== "undefined" && window.storage?.delete) {
    try { window.storage.delete(key); } catch {}
  }
  try { localStorage.removeItem(key); } catch {}
}

/* ═══════════════════════════════════════════════════════════════
   TECHNICAL ANALYSIS
   ═══════════════════════════════════════════════════════════════ */

function analyzeOHLC(candles) {
  if (!candles || candles.length < 10) return null;

  const recent = candles.slice(-14);
  let atrSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const high = recent[i][2], low = recent[i][3], prevClose = recent[i - 1][4];
    atrSum += Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
  }
  const atr = atrSum / (recent.length - 1);

  const closes = candles.map((c) => parseFloat(c[4]));
  const highs = candles.map((c) => parseFloat(c[2]));
  const lows = candles.map((c) => parseFloat(c[3]));

  const allLevels = [...highs.slice(-20), ...lows.slice(-20)].sort((a, b) => a - b);
  const currentPrice = closes[closes.length - 1];
  const threshold = currentPrice * 0.003;

  // Cluster support/resistance levels
  const clusters = [];
  let currentCluster = [allLevels[0]];
  for (let i = 1; i < allLevels.length; i++) {
    if (allLevels[i] - allLevels[i - 1] < threshold) {
      currentCluster.push(allLevels[i]);
    } else {
      if (currentCluster.length >= 2) {
        clusters.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
      }
      currentCluster = [allLevels[i]];
    }
  }
  if (currentCluster.length >= 2) {
    clusters.push(currentCluster.reduce((a, b) => a + b, 0) / currentCluster.length);
  }

  const support = clusters.filter((c) => c < currentPrice).sort((a, b) => b - a)[0] || currentPrice * 0.985;
  const resistance = clusters.filter((c) => c > currentPrice).sort((a, b) => a - b)[0] || currentPrice * 1.015;

  const volatilityPct = (atr / currentPrice) * 100;
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const momentum = ((currentPrice - sma10) / sma10) * 100;
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const trend = currentPrice > sma20 ? "up" : "down";

  // RSI
  let gains = 0, losses = 0;
  const period = Math.min(14, closes.length - 1);
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  const rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / period / (losses / period));

  return { atr, support, resistance, volatilityPct, momentum, rsi, currentPrice, trend };
}

/* ═══════════════════════════════════════════════════════════════
   TRADE SIGNAL GENERATION
   ═══════════════════════════════════════════════════════════════ */

function createTrade(coin, marketData, type, desc, entryLow, entryHigh, targetLow, targetHigh, stopLoss, confidence, analysis, riskProfile) {
  const tm = riskProfile?.targetMul || 1;
  const sm = riskProfile?.stopMul || 1;
  const avgEntry = (entryLow + entryHigh) / 2;
  const rawTarget = ((targetLow + targetHigh) / 2) - avgEntry;
  const rawStop = avgEntry - stopLoss;

  const adjTargetLow = avgEntry + rawTarget * tm;
  const adjTargetHigh = avgEntry + (targetHigh - avgEntry + (targetHigh - targetLow) / 2) * tm;
  const adjStop = avgEntry - rawStop * sm;

  confidence = Math.max(10, Math.min(95, Math.round(confidence)));

  const avgTarget = (adjTargetLow + adjTargetHigh) / 2;
  const profitPct = ((avgTarget - avgEntry) / avgEntry) * 100;
  const lossPct = Math.abs((adjStop - avgEntry) / avgEntry) * 100;
  const rewardRisk = lossPct > 0 ? profitPct / lossPct : 1;
  const score = (profitPct / 6) * 0.35 + (confidence / 100) * 0.35 + Math.min(rewardRisk / 3, 1) * 0.3;

  return {
    symbol: coin.symbol, name: coin.name, coinId: coin.id, coinColor: coin.color,
    type, typeColor: TRADE_TYPE_COLORS[type] || "#78909c",
    desc, entryLow, entryHigh, targetLow: adjTargetLow, targetHigh: adjTargetHigh,
    stop: adjStop, rr: "1:" + rewardRisk.toFixed(1), confidence, direction: "Long",
    profitPct, score, bid: marketData.bid, ask: marketData.ask, spread: marketData.spread,
    atrPct: analysis?.volatilityPct || null, rsi: analysis?.rsi || null,
    momentum: analysis?.momentum || null, supportLevel: analysis?.support || null,
    resistanceLevel: analysis?.resistance || null, trend: analysis?.trend || null,
  };
}

function generateTradeSignals(coin, marketData, analysis, riskProfile) {
  const signals = [];
  const price = marketData.price;
  const change = marketData.change24h || 0;

  if (!analysis) {
    const a = price * 0.012;
    signals.push(createTrade(coin, marketData, "Scalp", `${coin.symbol} range scalp`, price - a * 0.3, price, price + a * 1.8, price + a * 2.2, price - a * 1.2, 55, null, riskProfile));
    return signals;
  }

  const { atr, support, resistance, volatilityPct, momentum, rsi, trend } = analysis;

  if (volatilityPct > 0.3) {
    let conf = 60;
    if (momentum > 0.5) conf += 8;
    if (rsi < 60) conf += 5;
    if (marketData.spread != null && marketData.spread < 0.05) conf += 5;
    signals.push(createTrade(coin, marketData, "Scalp", `${coin.symbol} scalp — vol ${volatilityPct.toFixed(1)}%`, price - atr * 0.4, price, price + atr * 1.5, price + atr * 2.0, price - atr * 1.2, conf, analysis, riskProfile));
  }

  if (trend === "up" || momentum > 0.3) {
    let conf = 55;
    if (trend === "up") conf += 10;
    if (rsi < 65) conf += 5;
    if (change > 2) conf += 5;
    signals.push(createTrade(coin, marketData, "Long", `${coin.symbol} long — ${trend} trend`, price - atr * 0.5, price + atr * 0.1, price + atr * 3, price + atr * 4, price - atr * 1.8, conf, analysis, riskProfile));
  }

  if (((resistance - price) / price) * 100 < 2 && momentum > 0) {
    let conf = 58;
    if (volatilityPct > 0.5) conf += 6;
    signals.push(createTrade(coin, marketData, "Breakout", `${coin.symbol} breakout near $${formatPrice(resistance)}`, resistance * 0.998, resistance * 1.005, resistance + atr * 2.5, resistance + atr * 3.5, resistance - atr * 1.2, conf, analysis, riskProfile));
  }

  if (rsi < 40 || change < -2) {
    let conf = 52;
    if (rsi < 30) conf += 10;
    if (((price - support) / price) * 100 < 1.5) conf += 8;
    signals.push(createTrade(coin, marketData, "Dip Buy", `${coin.symbol} dip — RSI ${rsi.toFixed(0)} near $${formatPrice(support)}`, support * 0.997, support * 1.005, support + atr * 2.5, support + atr * 3.5, support - atr * 1.5, conf, analysis, riskProfile));
  }

  if (momentum > 1 && volatilityPct > 0.4) {
    let conf = 62;
    if (change > 3) conf += 8;
    if (trend === "up") conf += 6;
    signals.push(createTrade(coin, marketData, "Momentum", `${coin.symbol} momentum +${momentum.toFixed(1)}%`, price - atr * 0.2, price + atr * 0.1, price + atr * 2, price + atr * 3, price - atr * 1.5, conf, analysis, riskProfile));
  }

  if (rsi < 30 && trend === "down" && change < -3) {
    let conf = 45;
    if (rsi < 25) conf += 8;
    signals.push(createTrade(coin, marketData, "Reversal", `${coin.symbol} reversal RSI ${rsi.toFixed(0)}`, price - atr * 0.3, price + atr * 0.1, price + atr * 3, price + atr * 4.5, price - atr * 2, conf, analysis, riskProfile));
  }

  if (signals.length === 0) {
    signals.push(createTrade(coin, marketData, "Scalp", `${coin.symbol} range scalp`, price - atr * 0.5, price, price + atr * 2, price + atr * 2.8, price - atr * 1.3, 50, analysis, riskProfile));
  }

  return signals;
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function Sparkline({ data, color, width = 100, height = 32 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(" ");
  const gradientId = `sg${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${gradientId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ConfidenceBar({ value }) {
  const color = value >= 70 ? "#26a69a" : value >= 50 ? "#d4a017" : "#ef5350";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#1c2030" }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: 2, background: color, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: 11, color: "#8a8f9c", fontFamily: "'JetBrains Mono', monospace", minWidth: 28 }}>{value}%</span>
    </div>
  );
}

function StatusDot({ status, label }) {
  const color = status === "live" ? "#26a69a" : status === "error" ? "#ef5350" : "#d4a017";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%", background: color,
        boxShadow: status === "live" ? `0 0 6px ${color}` : "none",
        animation: status === "live" ? "pulse 2s infinite" : "none",
      }} />
      <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
    </div>
  );
}

function LiveTradeChart({ trade, currentPrice, isMobile }) {
  const hist = trade.priceHistory || [];
  if (hist.length < 2) return (
    <div style={{ background: "#141620", borderRadius: 6, padding: 12, marginTop: 8, textAlign: "center", color: "#6b7280", fontSize: 11 }}>
      Collecting price data... ({hist.length} ticks)
    </div>
  );

  const W = isMobile ? 320 : 500, H = isMobile ? 120 : 110;
  const pL = 30, pR = 52, pT = 8, pB = 14;
  const cW = W - pL - pR, cH = H - pT - pB;

  const allPrices = [...hist.map((h) => h.p), trade.targetPrice, trade.stopPrice, trade.entryPrice];
  if (currentPrice) allPrices.push(currentPrice);
  let max = Math.max(...allPrices), min = Math.min(...allPrices);
  const range = max - min || 1;
  max += range * 0.05; min -= range * 0.05;
  const totalRange = max - min;

  const yPos = (p) => pT + cH * (1 - (p - min) / totalRange);
  const xPos = (i) => pL + (i / Math.max(hist.length - 1, 1)) * cW;

  const points = hist.map((h, i) => `${xPos(i)},${yPos(h.p)}`).join(" ");
  const entryY = yPos(trade.entryPrice), targetY = yPos(trade.targetPrice), stopY = yPos(trade.stopPrice);
  const lastX = xPos(hist.length - 1);
  const lastY = currentPrice ? yPos(currentPrice) : yPos(hist[hist.length - 1].p);
  const pnl = currentPrice ? currentPrice - trade.entryPrice : 0;
  const pnlPct = (pnl / trade.entryPrice * 100).toFixed(2);
  const color = pnl >= 0 ? "#26a69a" : "#ef5350";

  const fillPoints = `${pL},${entryY} ${hist.map((h, i) => `${xPos(i)},${yPos(h.p)}`).join(" ")} ${lastX},${entryY}`;

  const startTime = new Date(hist[0].t);
  const endTime = new Date(hist[hist.length - 1].t);
  const elapsed = Math.round((endTime - startTime) / 1000);
  const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <div style={{ background: "#141620", borderRadius: 6, padding: isMobile ? 8 : 10, marginTop: 8, maxWidth: isMobile ? "100%" : 520 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#e0e2e8", fontFamily: "'JetBrains Mono', monospace" }}>{trade.symbol}/USD</span>
          <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{pnl >= 0 ? "+" : ""}{pnlPct}%</span>
        </div>
        <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "'JetBrains Mono', monospace" }}>{elapsedStr} · {hist.length} ticks</span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
        <rect x={pL} y={targetY} width={cW} height={Math.max(0, entryY - targetY)} fill="#26a69a" fillOpacity="0.04" />
        <rect x={pL} y={entryY} width={cW} height={Math.max(0, stopY - entryY)} fill="#ef5350" fillOpacity="0.04" />
        <line x1={pL} y1={targetY} x2={pL + cW} y2={targetY} stroke="#26a69a" strokeWidth="0.7" strokeDasharray="4,3" />
        <line x1={pL} y1={entryY} x2={pL + cW} y2={entryY} stroke="#7c4dff" strokeWidth="0.7" strokeDasharray="4,3" />
        <line x1={pL} y1={stopY} x2={pL + cW} y2={stopY} stroke="#ef5350" strokeWidth="0.7" strokeDasharray="4,3" />
        <polygon points={fillPoints} fill={color} fillOpacity="0.06" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <circle cx={pL} cy={entryY} r="3.5" fill="#7c4dff" stroke="#141620" strokeWidth="1.5" />
        <circle cx={lastX} cy={lastY} r="4.5" fill={color} stroke="#141620" strokeWidth="1.5" />
        <text x={3} y={targetY + 3} fill="#26a69a" fontSize="7" fontFamily="'JetBrains Mono', monospace">TP</text>
        <text x={3} y={entryY + 3} fill="#7c4dff" fontSize="7" fontFamily="'JetBrains Mono', monospace">IN</text>
        <text x={3} y={stopY + 3} fill="#ef5350" fontSize="7" fontFamily="'JetBrains Mono', monospace">SL</text>
        <text x={pL + cW + 3} y={entryY + 3} fill="#7c4dff" fontSize="7" fontFamily="'JetBrains Mono', monospace">${formatPrice(trade.entryPrice)}</text>
        <text x={pL + cW + 3} y={targetY + 3} fill="#26a69a" fontSize="7" fontFamily="'JetBrains Mono', monospace">${formatPrice(trade.targetPrice)}</text>
        <text x={pL + cW + 3} y={stopY + 3} fill="#ef5350" fontSize="7" fontFamily="'JetBrains Mono', monospace">${formatPrice(trade.stopPrice)}</text>
        {currentPrice && <text x={pL + cW + 3} y={lastY + 3} fill={color} fontSize="8" fontWeight="700" fontFamily="'JetBrains Mono', monospace">${formatPrice(currentPrice)}</text>}
      </svg>
    </div>
  );
}

function ClosedTradeChart({ trade, isMobile }) {
  const hist = trade.chartSnapshot || [];
  if (hist.length < 3) return <div style={{ fontSize: 10, color: "#4a5068", padding: 6 }}>No chart data</div>;

  const W = isMobile ? 310 : 460, H = isMobile ? 90 : 80;
  const pL = 26, pR = 48, pT = 6, pB = 8;
  const cW = W - pL - pR, cH = H - pT - pB;

  const allPrices = [...hist.map((h) => h.p), trade.targetPrice, trade.stopPrice, trade.entryPrice, trade.exitPrice];
  let max = Math.max(...allPrices), min = Math.min(...allPrices);
  const range = max - min || 1;
  max += range * 0.05; min -= range * 0.05;
  const totalRange = max - min;

  const yPos = (p) => pT + cH * (1 - (p - min) / totalRange);
  const xPos = (i) => pL + (i / Math.max(hist.length - 1, 1)) * cW;

  const points = hist.map((h, i) => `${xPos(i)},${yPos(h.p)}`).join(" ");
  const isWin = trade.pnl >= 0;
  const color = isWin ? "#26a69a" : "#ef5350";

  return (
    <div style={{ background: "#141620", borderRadius: 6, padding: 4, marginTop: 6, maxWidth: isMobile ? "100%" : 480 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
        <line x1={pL} y1={yPos(trade.targetPrice)} x2={pL + cW} y2={yPos(trade.targetPrice)} stroke="#26a69a" strokeWidth="0.6" strokeDasharray="4,3" />
        <line x1={pL} y1={yPos(trade.entryPrice)} x2={pL + cW} y2={yPos(trade.entryPrice)} stroke="#7c4dff" strokeWidth="0.6" strokeDasharray="4,3" />
        <line x1={pL} y1={yPos(trade.stopPrice)} x2={pL + cW} y2={yPos(trade.stopPrice)} stroke="#ef5350" strokeWidth="0.6" strokeDasharray="4,3" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={pL} cy={yPos(trade.entryPrice)} r="3" fill="#7c4dff" />
        <circle cx={xPos(hist.length - 1)} cy={yPos(trade.exitPrice)} r="3.5" fill={color} stroke="#141620" strokeWidth="1" />
        <text x={1} y={yPos(trade.targetPrice) + 3} fill="#26a69a" fontSize="6" fontFamily="'JetBrains Mono', monospace">TP</text>
        <text x={1} y={yPos(trade.entryPrice) + 3} fill="#7c4dff" fontSize="6" fontFamily="'JetBrains Mono', monospace">IN</text>
        <text x={1} y={yPos(trade.stopPrice) + 3} fill="#ef5350" fontSize="6" fontFamily="'JetBrains Mono', monospace">SL</text>
        <text x={pL + cW + 3} y={yPos(trade.exitPrice) + 3} fill={color} fontSize="7" fontWeight="700" fontFamily="'JetBrains Mono', monospace">${formatPrice(trade.exitPrice)}</text>
      </svg>
    </div>
  );
}

function EquityCurve({ closedTrades, startingBalance = 5000, isMobile }) {
  if (closedTrades.length < 2) return null;

  const W = isMobile ? 320 : 500, H = isMobile ? 100 : 110;
  const pL = 44, pR = 10, pT = 8, pB = 14;
  const cW = W - pL - pR, cH = H - pT - pB;

  const equity = [startingBalance];
  closedTrades.forEach((t) => equity.push(equity[equity.length - 1] + t.pnl));

  let max = Math.max(...equity), min = Math.min(...equity);
  const range = max - min || 1;
  max += range * 0.05; min -= range * 0.05;
  const totalRange = max - min;

  const yPos = (v) => pT + cH * (1 - (v - min) / totalRange);
  const points = equity.map((v, i) => `${pL + (i / Math.max(equity.length - 1, 1)) * cW},${yPos(v)}`).join(" ");
  const fillPoints = `${pL},${yPos(startingBalance)} ${points} ${pL + cW},${yPos(startingBalance)}`;
  const finalEquity = equity[equity.length - 1];
  const totalPnl = finalEquity - startingBalance;
  const color = totalPnl >= 0 ? "#26a69a" : "#ef5350";

  return (
    <div style={{ background: "#181a24", border: "1px solid #1f2233", borderRadius: 8, padding: isMobile ? 10 : 14, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e2e8" }}>Equity Curve</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
          {totalPnl >= 0 ? "+" : ""}${formatPrice(totalPnl)} ({((totalPnl / startingBalance) * 100).toFixed(1)}%)
        </span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
        <line x1={pL} y1={yPos(startingBalance)} x2={pL + cW} y2={yPos(startingBalance)} stroke="#4a5068" strokeWidth="0.4" strokeDasharray="3,3" />
        <polygon points={fillPoints} fill={color} fillOpacity="0.08" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx={pL} cy={yPos(startingBalance)} r="3" fill="#4a5068" />
        <circle cx={pL + cW} cy={yPos(finalEquity)} r="4" fill={color} stroke="#181a24" strokeWidth="1.5" />
        <text x={pL - 3} y={yPos(startingBalance) + 3} fill="#6b7280" fontSize="7" textAnchor="end" fontFamily="'JetBrains Mono', monospace">${startingBalance}</text>
        <text x={pL + cW + 3} y={yPos(finalEquity) + 3} fill={color} fontSize="7" fontFamily="'JetBrains Mono', monospace">${finalEquity.toFixed(0)}</text>
      </svg>
    </div>
  );
}

/* Mini OHLC Chart for selected coin */
function OHLCChart({ candles, coin, currentPrice, isMobile }) {
  if (!candles || candles.length < 5) return (
    <div style={{ background: "#141620", borderRadius: 8, padding: 20, textAlign: "center", color: "#4a5068", fontSize: 12, border: "1px solid #1f2233" }}>
      Loading chart data...
    </div>
  );

  const W = isMobile ? 340 : 560, H = isMobile ? 180 : 220;
  const pL = 50, pR = 12, pT = 12, pB = 20;
  const cW = W - pL - pR, cH = H - pT - pB;

  const displayCandles = candles.slice(-50);
  const allH = displayCandles.map(c => c[2]);
  const allL = displayCandles.map(c => c[3]);
  let max = Math.max(...allH), min = Math.min(...allL);
  const range = max - min || 1;
  max += range * 0.05; min -= range * 0.05;
  const totalRange = max - min;

  const yPos = (p) => pT + cH * (1 - (p - min) / totalRange);
  const candleWidth = Math.max(2, (cW / displayCandles.length) * 0.65);
  const gap = cW / displayCandles.length;

  const gridLines = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const price = min + (totalRange * i) / steps;
    gridLines.push(price);
  }

  return (
    <div style={{ background: "#141620", borderRadius: 8, padding: isMobile ? 8 : 12, border: "1px solid #1f2233" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: coin.color }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e0e2e8" }}>{coin.symbol}/USD</span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>15m</span>
        </div>
        {currentPrice && (
          <span style={{ fontSize: 14, fontWeight: 700, color: "#e0e2e8", fontFamily: "'JetBrains Mono', monospace" }}>
            ${formatPrice(currentPrice)}
          </span>
        )}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
        {gridLines.map((price, i) => (
          <g key={i}>
            <line x1={pL} y1={yPos(price)} x2={pL + cW} y2={yPos(price)} stroke="#1f2233" strokeWidth="0.5" />
            <text x={pL - 4} y={yPos(price) + 3} fill="#4a5068" fontSize="8" textAnchor="end" fontFamily="'JetBrains Mono', monospace">
              {formatPrice(price)}
            </text>
          </g>
        ))}
        {displayCandles.map((c, i) => {
          const open = c[1], high = c[2], low = c[3], close = c[4];
          const bullish = close >= open;
          const color = bullish ? "#26a69a" : "#ef5350";
          const x = pL + i * gap + gap / 2;
          const bodyTop = yPos(Math.max(open, close));
          const bodyBottom = yPos(Math.min(open, close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);
          return (
            <g key={i}>
              <line x1={x} y1={yPos(high)} x2={x} y2={yPos(low)} stroke={color} strokeWidth="1" />
              <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={bullish ? color : color} stroke={color} strokeWidth="0.5" rx="0.5" />
            </g>
          );
        })}
        {currentPrice && (
          <>
            <line x1={pL} y1={yPos(currentPrice)} x2={pL + cW} y2={yPos(currentPrice)} stroke="#7c4dff" strokeWidth="0.8" strokeDasharray="3,2" />
            <rect x={pL + cW - 1} y={yPos(currentPrice) - 8} width={48} height={16} rx="3" fill="#7c4dff" />
            <text x={pL + cW + 23} y={yPos(currentPrice) + 3} fill="#fff" fontSize="8" textAnchor="middle" fontWeight="600" fontFamily="'JetBrains Mono', monospace">
              {formatPrice(currentPrice)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const isMobile = windowWidth < 700;

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Core state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedCoin, setSelectedCoin] = useState(COINS[0]);
  const [page, setPage] = useState("dashboard");
  const [signalFilter, setSignalFilter] = useState("all");
  const [tradeAmounts, setTradeAmounts] = useState([100, 500, 1000]);
  const [editingAmounts, setEditingAmounts] = useState(false);
  const [amountsText, setAmountsText] = useState("100, 500, 1000");

  // Market data
  const [mergedPrices, setMergedPrices] = useState({});
  const [globalData, setGlobalData] = useState(null);
  const [fearGreed, setFearGreed] = useState(null);
  const [sourceStatus, setSourceStatus] = useState({ ws: "loading", cg: "loading", bn: "loading", cc: "loading", fg: "loading", oh: "loading" });
  const [ohlcData, setOhlcData] = useState({});
  const [usingFallback, setUsingFallback] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsTickCount, setWsTickCount] = useState(0);
  const [krakenLive, setKrakenLive] = useState({});
  const [showSources, setShowSources] = useState(false);

  // Paper trading
  const [dataLoaded, setDataLoaded] = useState(false);
  const [balance, setBalance] = useState(5000);
  const [openTrades, setOpenTrades] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [riskLevel, setRiskLevel] = useState(1);
  const [feeTier, setFeeTier] = useState(0);
  const [showFeeSelector, setShowFeeSelector] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedTrade, setExpandedTrade] = useState(null);
  const [editingTradeId, setEditingTradeId] = useState(null);
  const [editTP, setEditTP] = useState("");
  const [editSL, setEditSL] = useState("");
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceText, setBalanceText] = useState("5000");
  const [logFilter, setLogFilter] = useState("all");
  const [expandedClosed, setExpandedClosed] = useState(null);
  const [showPositionPanel, setShowPositionPanel] = useState(true);

  // Refs
  const wsRef = useRef(null);
  const krakenRef = useRef({});
  const reconnectTimer = useRef(null);

  const fees = FEE_TIERS[feeTier];

  // ─── Persistence ───────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const raw = await storageGet("pts");
        if (raw) {
          const state = JSON.parse(raw);
          if (state.bal != null) setBalance(state.bal);
          if (state.ot) setOpenTrades(state.ot);
          if (state.ct) setClosedTrades(state.ct);
          if (state.ft != null) setFeeTier(state.ft);
          if (state.rl != null) setRiskLevel(state.rl);
          if (state.am) setTradeAmounts(state.am);
        }
      } catch {}
      setDataLoaded(true);
    }
    load();
  }, []);

  useEffect(() => {
    if (!dataLoaded) return;
    storageSet("pts", JSON.stringify({
      bal: balance,
      ot: openTrades.map((t) => ({ ...t, priceHistory: (t.priceHistory || []).slice(-50) })),
      ct: closedTrades.slice(-100).map((t) => ({ ...t, chartSnapshot: (t.chartSnapshot || []).slice(-60) })),
      ft: feeTier, rl: riskLevel, am: tradeAmounts,
    }));
  }, [balance, openTrades, closedTrades, feeTier, riskLevel, tradeAmounts, dataLoaded]);

  // ─── Price history tracking ────────────────────────────────
  useEffect(() => {
    if (!openTrades.length) return;
    setOpenTrades((prev) => prev.map((t) => {
      const cp = mergedPrices[t.coinId]?.price;
      if (!cp) return t;
      const hist = t.priceHistory || [];
      if (!hist.length || Date.now() - hist[hist.length - 1].t > 5000) {
        return { ...t, priceHistory: [...hist, { p: cp, t: Date.now() }].slice(-200) };
      }
      return t;
    }));
  }, [wsTickCount, mergedPrices]);

  // ─── Auto TP/SL execution ─────────────────────────────────
  useEffect(() => {
    if (!openTrades.length) return;
    openTrades.forEach((t) => {
      const cp = mergedPrices[t.coinId]?.price;
      if (!cp) return;
      if (cp >= t.targetPrice) closeTrade(t.id, "Target ✅");
      else if (cp <= t.stopPrice) closeTrade(t.id, "Stop ❌");
    });
  }, [mergedPrices, wsTickCount]);

  // ─── Trade functions ───────────────────────────────────────
  function enterTrade(signal, amount) {
    const entryPrice = (signal.entryLow + signal.entryHigh) / 2;
    const targetPrice = (signal.targetLow + signal.targetHigh) / 2;
    const fee = amount * (fees.taker / 100);
    const cost = amount + fee;

    if (cost > balance) {
      showNotification("Insufficient balance", "#ef5350");
      return;
    }

    const id = Date.now();
    const now = new Date();
    const timestamp = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + now.toLocaleTimeString();

    setBalance((b) => b - cost);
    setOpenTrades((prev) => [...prev, {
      id, symbol: signal.symbol, coinId: signal.coinId, type: signal.type,
      entryPrice, targetPrice, stopPrice: signal.stop, coins: amount / entryPrice,
      investAmt: amount, entryFee: fee, enteredAt: timestamp, enteredMs: now.getTime(),
      priceHistory: [{ p: entryPrice, t: Date.now() }], riskLabel: RISK_PROFILES[riskLevel].label,
      rr: signal.rr,
    }]);
    showNotification(`Opened ${signal.symbol} $${amount}`, "#26a69a");
    setExpandedTrade(id);
    setShowPositionPanel(true);
  }

  function closeTrade(id, reason) {
    setOpenTrades((prev) => {
      const trade = prev.find((t) => t.id === id);
      if (!trade) return prev;

      const cp = mergedPrices[trade.coinId]?.price || trade.entryPrice;
      const grossValue = trade.coins * cp;
      const exitFee = grossValue * (fees.maker / 100);
      const netValue = grossValue - exitFee;
      const pnl = netValue - trade.investAmt - trade.entryFee;
      const pnlPct = (pnl / trade.investAmt) * 100;

      const now = new Date();
      const timestamp = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + now.toLocaleTimeString();
      const durationMs = trade.enteredMs ? now.getTime() - trade.enteredMs : 0;
      const duration = durationMs < 60000 ? `${Math.round(durationMs / 1000)}s` :
        durationMs < 3600000 ? `${Math.floor(durationMs / 60000)}m` :
          `${Math.floor(durationMs / 3600000)}h ${Math.floor((durationMs % 3600000) / 60000)}m`;

      setBalance((b) => b + netValue);
      setClosedTrades((c) => [...c, {
        ...trade, exitPrice: cp, exitFee, pnl, pnlPct,
        reason: reason || "Manual", closedAt: timestamp, duration,
        chartSnapshot: (trade.priceHistory || []).slice(-100),
      }]);
      showNotification(`${trade.symbol} ${reason || "Closed"} ${pnl >= 0 ? "+" : ""}$${formatPrice(pnl)}`, pnl >= 0 ? "#26a69a" : "#ef5350");
      if (expandedTrade === id) setExpandedTrade(null);
      return prev.filter((t) => t.id !== id);
    });
  }

  function modifyTrade(id) {
    setOpenTrades((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const newTP = parseFloat(editTP);
      const newSL = parseFloat(editSL);
      const updated = { ...t };
      if (!isNaN(newTP) && newTP > t.entryPrice) updated.targetPrice = newTP;
      if (!isNaN(newSL) && newSL < t.entryPrice) updated.stopPrice = newSL;
      return updated;
    }));
    setEditingTradeId(null);
    showNotification("TP/SL updated", "#7c4dff");
  }

  function showNotification(message, color) {
    setNotification({ message, color });
    setTimeout(() => setNotification(null), 2500);
  }

  // ─── Computed values ───────────────────────────────────────
  const openPnl = useMemo(() => openTrades.reduce((sum, t) => {
    const cp = mergedPrices[t.coinId]?.price || t.entryPrice;
    return sum + (t.coins * cp * (1 - fees.maker / 100) - t.investAmt - t.entryFee);
  }, 0), [openTrades, mergedPrices, fees]);

  const closedPnl = useMemo(() => closedTrades.reduce((sum, t) => sum + t.pnl, 0), [closedTrades]);
  const winCount = useMemo(() => closedTrades.filter((t) => t.pnl > 0).length, [closedTrades]);
  const totalEquity = balance + openTrades.reduce((s, t) => s + t.investAmt + t.entryFee, 0) + openPnl;

  const allSignals = useMemo(() =>
    COINS.flatMap((coin) => {
      const data = mergedPrices[coin.id];
      if (!data?.price) return [];
      return generateTradeSignals(coin, data, analyzeOHLC(ohlcData[coin.id] || null), RISK_PROFILES[riskLevel]);
    }).sort((a, b) => b.score - a.score),
    [mergedPrices, ohlcData, riskLevel]
  );

  const signalTypes = useMemo(() => ["all", ...new Set(allSignals.map((t) => t.type.toLowerCase()))], [allSignals]);
  const filteredSignals = signalFilter === "all" ? allSignals : allSignals.filter((t) => t.type.toLowerCase() === signalFilter);

  function saveAmounts() {
    const parsed = amountsText.split(",").map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n) && n > 0);
    if (parsed.length > 0) { setTradeAmounts(parsed); setEditingAmounts(false); }
  }

  const fgData = fearGreed || { value: 62, label: "Greed" };
  const fgColor = fgData.value > 55 ? "#26a69a" : fgData.value > 45 ? "#d4a017" : "#ef5350";

  // ─── WebSocket (Kraken) ────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    try {
      if (wsRef.current?.readyState < 2) return;
      const ws = new WebSocket("wss://ws.kraken.com");
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        setSourceStatus((p) => ({ ...p, ws: "live" }));
        ws.send(JSON.stringify({
          event: "subscribe",
          pair: COINS.map((c) => c.krakenWs),
          subscription: { name: "ticker" },
        }));
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (Array.isArray(data) && data.length >= 4) {
            const ticker = data[1], pairName = data[3];
            const coin = COINS.find((c) => c.krakenWs === pairName);
            if (coin && ticker?.c) {
              const lastPrice = parseFloat(ticker.c[0]);
              const openPrice = parseFloat(ticker.o[0]);
              krakenRef.current = { ...krakenRef.current };
              krakenRef.current[coin.id] = {
                price: lastPrice, bid: parseFloat(ticker.b[0]), ask: parseFloat(ticker.a[0]),
                high: parseFloat(ticker.h[1]), low: parseFloat(ticker.l[1]),
                vol: parseFloat(ticker.v[1]) * lastPrice,
                change: ((lastPrice - openPrice) / openPrice) * 100,
                spread: ((parseFloat(ticker.a[0]) - parseFloat(ticker.b[0])) / lastPrice) * 100,
                ts: Date.now(),
              };
              setKrakenLive({ ...krakenRef.current });
              setWsTickCount((p) => p + 1);
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        setSourceStatus((p) => ({ ...p, ws: "error" }));
        reconnectTimer.current = setTimeout(connectWebSocket, 5000);
      };
      ws.onerror = () => setSourceStatus((p) => ({ ...p, ws: "error" }));
    } catch {}
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectWebSocket]);

  // ─── OHLC data fetch ──────────────────────────────────────
  const fetchOHLC = useCallback(async () => {
    const result = {};
    let successCount = 0;
    for (const coin of COINS) {
      try {
        const data = await safeFetch(`https://api.kraken.com/0/public/OHLC?pair=${coin.krakenOhlc}&interval=15`);
        if (data.result) {
          const key = Object.keys(data.result).find((k) => k !== "last");
          if (key) {
            result[coin.id] = data.result[key].slice(-100).map((c) => [c[0], parseFloat(c[1]), parseFloat(c[2]), parseFloat(c[3]), parseFloat(c[4]), parseFloat(c[5]), parseFloat(c[6])]);
            successCount++;
          }
        }
        await new Promise((r) => setTimeout(r, 300));
      } catch {}
    }
    setOhlcData(result);
    setSourceStatus((p) => ({ ...p, oh: successCount > 0 ? "live" : "error" }));
  }, []);

  // ─── All prices fetch ─────────────────────────────────────
  const fetchAllPrices = useCallback(async () => {
    const priceData = {};
    COINS.forEach((c) => { priceData[c.id] = { prices: [], changes: [], highs: [], lows: [], volumes: [], sparkline: null, sources: [] }; });
    let anySuccess = false;

    // Kraken WS data
    COINS.forEach((c) => {
      const k = krakenRef.current[c.id];
      if (k && Date.now() - k.ts < 120000) {
        priceData[c.id].prices.push(k.price);
        priceData[c.id].changes.push(k.change);
        priceData[c.id].highs.push(k.high);
        priceData[c.id].lows.push(k.low);
        priceData[c.id].volumes.push(k.vol);
        priceData[c.id].sources.push("WS");
        anySuccess = true;
      }
    });

    // CoinGecko
    try {
      const data = await safeFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.map((c) => c.id).join(",")}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`);
      data.forEach((coin) => {
        if (priceData[coin.id]) {
          priceData[coin.id].prices.push(coin.current_price);
          if (coin.price_change_percentage_24h != null) priceData[coin.id].changes.push(coin.price_change_percentage_24h);
          if (coin.high_24h) priceData[coin.id].highs.push(coin.high_24h);
          if (coin.total_volume) priceData[coin.id].volumes.push(coin.total_volume);
          if (coin.sparkline_in_7d?.price) priceData[coin.id].sparkline = coin.sparkline_in_7d.price.slice(-48);
          priceData[coin.id].sources.push("CG");
        }
      });
      setSourceStatus((p) => ({ ...p, cg: "live" }));
      anySuccess = true;
    } catch { setSourceStatus((p) => ({ ...p, cg: "error" })); }

    // Binance
    try {
      const data = await safeFetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(COINS.map((c) => c.binance).filter(Boolean))}`);
      data.forEach((t) => {
        const coin = COINS.find((c) => c.binance === t.symbol);
        if (coin && priceData[coin.id]) {
          priceData[coin.id].prices.push(parseFloat(t.lastPrice));
          priceData[coin.id].changes.push(parseFloat(t.priceChangePercent));
          priceData[coin.id].sources.push("BN");
        }
      });
      setSourceStatus((p) => ({ ...p, bn: "live" }));
      anySuccess = true;
    } catch { setSourceStatus((p) => ({ ...p, bn: "error" })); }

    // CryptoCompare
    try {
      const data = await safeFetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${COINS.map((c) => c.cc).join(",")}&tsyms=USD`);
      if (data.RAW) {
        COINS.forEach((c) => {
          const raw = data.RAW[c.cc]?.USD;
          if (raw && priceData[c.id]) {
            priceData[c.id].prices.push(raw.PRICE);
            if (raw.CHANGEPCT24HOUR != null) priceData[c.id].changes.push(raw.CHANGEPCT24HOUR);
            priceData[c.id].sources.push("CC");
          }
        });
      }
      setSourceStatus((p) => ({ ...p, cc: "live" }));
      anySuccess = true;
    } catch { setSourceStatus((p) => ({ ...p, cc: "error" })); }

    // Fear & Greed
    try {
      const data = await safeFetch("https://api.alternative.me/fng/?limit=1");
      if (data.data?.[0]) setFearGreed({ value: parseInt(data.data[0].value), label: data.data[0].value_classification });
      setSourceStatus((p) => ({ ...p, fg: "live" }));
    } catch { setSourceStatus((p) => ({ ...p, fg: "error" })); }

    // Global data
    try {
      const data = await safeFetch("https://api.coingecko.com/api/v3/global");
      if (data.data) setGlobalData(data.data);
    } catch {}

    // Merge or fallback
    if (!anySuccess) {
      const fallback = {};
      COINS.forEach((c) => {
        const fb = FALLBACK_PRICES[c.id];
        if (fb) fallback[c.id] = { price: fb.price, change24h: fb.change, sparkline: generateSparkline(fb.price, fb.change), sourceCount: 0, sourceNames: ["FB"], bid: null, ask: null, spread: null };
      });
      setMergedPrices(fallback);
      setUsingFallback(true);
      return;
    }

    setUsingFallback(false);
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const merged = {};
    COINS.forEach((c) => {
      const pd = priceData[c.id];
      const avgPrice = avg(pd.prices);
      const kl = krakenRef.current[c.id];
      if (!avgPrice) return;
      merged[c.id] = {
        price: avgPrice, change24h: avg(pd.changes), high24h: pd.highs.length ? Math.max(...pd.highs) : null,
        volume: avg(pd.volumes), sparkline: pd.sparkline || generateSparkline(avgPrice, avg(pd.changes) || 0),
        sourceCount: pd.prices.length, sourceNames: [...new Set(pd.sources)],
        bid: kl?.bid || null, ask: kl?.ask || null, spread: kl?.spread || null,
      };
    });
    setMergedPrices(merged);
  }, []);

  useEffect(() => {
    fetchAllPrices();
    fetchOHLC();
    const i1 = setInterval(fetchAllPrices, 60000);
    const i2 = setInterval(fetchOHLC, 300000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Merge Kraken WS ticks into prices
  useEffect(() => {
    if (!Object.keys(krakenLive).length) return;
    setMergedPrices((prev) => {
      const next = { ...prev };
      COINS.forEach((c) => {
        const kl = krakenLive[c.id];
        if (kl && next[c.id]) {
          next[c.id] = { ...next[c.id], bid: kl.bid, ask: kl.ask, spread: kl.spread };
          if (kl.ts > (next[c.id]._t || 0)) {
            next[c.id].price = next[c.id].price ? next[c.id].price * 0.4 + kl.price * 0.6 : kl.price;
            next[c.id].change24h = kl.change;
            next[c.id]._t = kl.ts;
          }
        }
      });
      return next;
    });
  }, [wsTickCount]);

  const liveSourceCount = Object.values(sourceStatus).filter((s) => s === "live").length;
  const hasPriceData = Object.values(mergedPrices).some((m) => m.price != null);
  const selectedCoinData = mergedPrices[selectedCoin.id];
  const selectedCoinChange = selectedCoinData?.change24h || 0;

  // ─── CSS ──────────────────────────────────────────────────
  const t = {
    bg: "#0f1118",
    surface: "#181a24",
    surfaceAlt: "#1f2233",
    border: "#262838",
    borderHover: "#363850",
    text: "#e0e2e8",
    textMuted: "#8a8f9c",
    textDim: "#4a5068",
    accent: "#7c4dff",
    accentDim: "#7c4dff30",
    green: "#26a69a",
    greenDim: "#26a69a20",
    red: "#ef5350",
    redDim: "#ef535020",
    yellow: "#d4a017",
    yellowDim: "#d4a01720",
  };

  const panelStyle = { background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10 };
  const monoFont = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div style={{ background: t.bg, minHeight: "100vh", color: t.text, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", WebkitTextSizeAdjust: "100%" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* ─── NOTIFICATION ─── */}
      {notification && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999,
          background: notification.color, color: "#fff", padding: "10px 24px", borderRadius: 8,
          fontSize: 13, fontWeight: 600, boxShadow: `0 8px 32px ${notification.color}40`, maxWidth: "90vw",
          textAlign: "center", fontFamily: monoFont,
        }}>
          {notification.message}
        </div>
      )}

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: isMobile ? "12px 14px" : "12px 24px", borderBottom: `1px solid ${t.border}`,
        background: t.surface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${t.accent}, #b388ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>C</div>
            {!isMobile && <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.5 }}>CryptoTrader</span>}
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, color: t.yellow, background: t.yellowDim, padding: "2px 6px", borderRadius: 4, letterSpacing: 1, fontFamily: monoFont }}>PAPER</span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {wsConnected && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: t.greenDim, border: `1px solid ${t.green}30`, borderRadius: 6, padding: "4px 10px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.green, animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 10, color: t.green, fontWeight: 600, fontFamily: monoFont }}>LIVE</span>
            </div>
          )}
          <span style={{ fontSize: 11, color: t.textMuted, fontFamily: monoFont }}>
            {currentTime.toLocaleTimeString()}
          </span>
          <button onClick={() => { fetchAllPrices(); fetchOHLC(); }} style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, color: t.textMuted, cursor: "pointer" }}>↻</button>
        </div>
      </div>

      {/* ═══ NAV TABS ═══ */}
      {dataLoaded && (
        <div style={{ display: "flex", background: t.surface, borderBottom: `1px solid ${t.border}` }}>
          {[
            { key: "dashboard", label: "Dashboard", icon: "◉" },
            { key: "log", label: `Trade Log${closedTrades.length > 0 ? ` (${closedTrades.length})` : ""}`, icon: "☰" },
          ].map((tab) => (
            <button key={tab.key} onClick={() => setPage(tab.key)} style={{
              flex: 1, padding: "10px 0", fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: "none", borderBottom: page === tab.key ? `2px solid ${t.accent}` : "2px solid transparent",
              background: "transparent", color: page === tab.key ? t.text : t.textDim,
              transition: "all 0.2s",
            }}>
              <span style={{ marginRight: 4 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: isMobile ? "12px" : "16px 24px" }}>

        {/* ═══════════════════ DASHBOARD ═══════════════════ */}
        {dataLoaded && page === "dashboard" && (
          <>
            {/* ─── Account Panel ─── */}
            <div style={{ ...panelStyle, padding: isMobile ? 12 : 16, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>Paper Account</span>
                  <span style={{ fontSize: 9, color: t.green, fontFamily: monoFont }}>● Saved</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setShowPositionPanel(!showPositionPanel)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 5, padding: "2px 8px", fontSize: 11, color: t.textDim, cursor: "pointer" }}>{showPositionPanel ? "−" : "+"}</button>
                  <button onClick={() => { setBalance(5000); setOpenTrades([]); setClosedTrades([]); storageDelete("pts"); }} style={{ background: t.redDim, border: `1px solid ${t.red}30`, borderRadius: 5, padding: "2px 8px", fontSize: 10, color: t.red, cursor: "pointer" }}>Reset</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 8 }}>
                {[
                  { label: "CASH", value: editingBalance ? null : `$${balance.toFixed(2)}`, color: t.text, editable: true },
                  { label: "EQUITY", value: `$${totalEquity.toFixed(2)}`, color: t.text },
                  { label: "OPEN P&L", value: `${openPnl >= 0 ? "+" : ""}$${formatPrice(openPnl)}`, color: openPnl >= 0 ? t.green : t.red },
                  { label: "REALIZED", value: `${closedPnl >= 0 ? "+" : ""}$${formatPrice(closedPnl)}`, color: closedPnl >= 0 ? t.green : t.red },
                  { label: "WIN RATE", value: closedTrades.length > 0 ? `${((winCount / closedTrades.length) * 100).toFixed(0)}%` : "—", color: t.text, sub: `${winCount}/${closedTrades.length}` },
                ].map((stat, i) => (
                  <div key={i} style={{ background: t.bg, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: t.textDim, marginBottom: 3, fontFamily: monoFont, letterSpacing: 0.5 }}>{stat.label}</div>
                    {stat.editable && editingBalance ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input value={balanceText} onChange={(e) => setBalanceText(e.target.value)} style={{ background: t.surfaceAlt, border: `1px solid ${t.accent}`, borderRadius: 5, padding: "2px 6px", fontSize: 14, color: t.text, width: 80, outline: "none", fontFamily: monoFont }} />
                        <button onClick={() => { const v = parseFloat(balanceText); if (!isNaN(v) && v >= 0) { setBalance(v); setEditingBalance(false); } }} style={{ background: t.green, color: "#fff", border: "none", borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>✓</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: stat.color, fontFamily: monoFont }}>{stat.value}</span>
                        {stat.editable && <button onClick={() => { setBalanceText(balance.toFixed(0)); setEditingBalance(true); }} style={{ background: "none", border: "none", fontSize: 11, cursor: "pointer", color: t.textDim }}>✎</button>}
                        {stat.sub && <span style={{ fontSize: 10, color: t.textDim, fontFamily: monoFont }}>{stat.sub}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Open positions in account panel */}
              {showPositionPanel && openTrades.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: t.textDim, marginBottom: 6, fontFamily: monoFont }}>OPEN POSITIONS ({openTrades.length})</div>
                  {openTrades.map((trade) => {
                    const cp = mergedPrices[trade.coinId]?.price || trade.entryPrice;
                    const pnl = trade.coins * cp * (1 - fees.maker / 100) - trade.investAmt - trade.entryFee;
                    const isExpanded = expandedTrade === trade.id;
                    return (
                      <div key={trade.id} style={{ background: t.bg, borderRadius: 8, padding: 10, marginBottom: 4, border: `1px solid ${pnl >= 0 ? t.green : t.red}15` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: t.text }}>{trade.symbol}</span>
                            <span style={{ fontSize: 10, color: t.textDim, fontFamily: monoFont }}>{trade.type} · ${trade.investAmt} · {trade.enteredAt}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: pnl >= 0 ? t.green : t.red, fontFamily: monoFont }}>{pnl >= 0 ? "+" : ""}${formatPrice(pnl)}</span>
                            <button onClick={(e) => { e.stopPropagation(); closeTrade(trade.id, "Manual"); }} style={{ background: t.redDim, border: `1px solid ${t.red}30`, borderRadius: 5, padding: "3px 8px", fontSize: 10, color: t.red, cursor: "pointer", fontWeight: 600 }}>Close</button>
                            <button onClick={(e) => { e.stopPropagation(); if (editingTradeId === trade.id) { setEditingTradeId(null); } else { setEditingTradeId(trade.id); setEditTP(trade.targetPrice.toString()); setEditSL(trade.stopPrice.toString()); } }} style={{ background: t.accentDim, border: `1px solid ${t.accent}30`, borderRadius: 5, padding: "3px 8px", fontSize: 10, color: t.accent, cursor: "pointer" }}>{editingTradeId === trade.id ? "Cancel" : "TP/SL"}</button>
                          </div>
                        </div>
                        {editingTradeId === trade.id && (
                          <div style={{ background: t.surfaceAlt, borderRadius: 6, padding: 8, marginTop: 6, display: "flex", gap: 6, alignItems: "flex-end", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                            <div>
                              <div style={{ fontSize: 9, color: t.green, marginBottom: 2, fontFamily: monoFont }}>TARGET</div>
                              <input value={editTP} onChange={(e) => setEditTP(e.target.value)} style={{ background: t.bg, border: `1px solid ${t.green}40`, borderRadius: 5, padding: "5px 8px", fontSize: 12, color: t.green, width: 90, outline: "none", fontFamily: monoFont }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: t.red, marginBottom: 2, fontFamily: monoFont }}>STOP</div>
                              <input value={editSL} onChange={(e) => setEditSL(e.target.value)} style={{ background: t.bg, border: `1px solid ${t.red}40`, borderRadius: 5, padding: "5px 8px", fontSize: 12, color: t.red, width: 90, outline: "none", fontFamily: monoFont }} />
                            </div>
                            <button onClick={() => modifyTrade(trade.id)} style={{ background: t.accent, color: "#fff", border: "none", borderRadius: 5, padding: "7px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Apply</button>
                          </div>
                        )}
                        {isExpanded && <LiveTradeChart trade={trade} currentPrice={cp} isMobile={isMobile} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── Settings Row ─── */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              {/* Risk selector */}
              <div style={{ ...panelStyle, padding: "8px 12px", flex: isMobile ? "1 1 100%" : 1, display: "flex", gap: 6 }}>
                {RISK_PROFILES.map((rp, i) => {
                  const active = riskLevel === i;
                  return (
                    <button key={i} onClick={() => setRiskLevel(i)} style={{
                      flex: 1, background: active ? `${rp.color}15` : "transparent",
                      border: `1.5px solid ${active ? rp.color : t.border}`, borderRadius: 8,
                      padding: "6px 4px", cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: active ? rp.color : t.textMuted }}>{rp.label}</div>
                      <div style={{ fontSize: 8, color: t.textDim, fontFamily: monoFont }}>{rp.targetMul}x/{rp.stopMul}x</div>
                    </button>
                  );
                })}
              </div>

              {/* Fee tier + Sources */}
              <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                <div style={{ ...panelStyle, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: t.yellow, fontWeight: 700, fontFamily: monoFont }}>Fee</span>
                  <span style={{ fontSize: 10, color: t.textMuted, fontFamily: monoFont }}>{fees.maker}%/{fees.taker}%</span>
                  <button onClick={() => setShowFeeSelector(!showFeeSelector)} style={{ background: t.yellowDim, border: "none", borderRadius: 4, padding: "2px 8px", fontSize: 9, color: t.yellow, cursor: "pointer" }}>{showFeeSelector ? "×" : "Edit"}</button>
                </div>
                <div style={{ ...panelStyle, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: t.textDim, fontFamily: monoFont }}>SRC</span>
                  <span style={{ fontSize: 10, color: liveSourceCount >= 4 ? t.green : t.yellow, fontWeight: 600, fontFamily: monoFont }}>{liveSourceCount}/6</span>
                  <button onClick={() => setShowSources(!showSources)} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 4, padding: "2px 6px", fontSize: 9, color: t.textDim, cursor: "pointer" }}>{showSources ? "−" : "+"}</button>
                </div>
              </div>
            </div>

            {showFeeSelector && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 10 }}>
                {FEE_TIERS.map((tier, i) => (
                  <button key={i} onClick={() => { setFeeTier(i); setShowFeeSelector(false); }} style={{
                    ...panelStyle, padding: "8px 10px", cursor: "pointer", textAlign: "left",
                    borderColor: feeTier === i ? t.yellow : t.border, background: feeTier === i ? t.yellowDim : t.surface,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: feeTier === i ? t.yellow : t.textMuted }}>{tier.label}</div>
                    <div style={{ fontSize: 9, color: t.textDim, fontFamily: monoFont }}>{tier.maker}% / {tier.taker}%</div>
                  </button>
                ))}
              </div>
            )}

            {showSources && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", ...panelStyle, padding: 10, marginBottom: 10 }}>
                <StatusDot status={sourceStatus.ws} label="Kraken WS" />
                <StatusDot status={sourceStatus.oh} label="OHLC" />
                <StatusDot status={sourceStatus.bn} label="Binance" />
                <StatusDot status={sourceStatus.cg} label="CoinGecko" />
                <StatusDot status={sourceStatus.cc} label="CryptoCompare" />
                <StatusDot status={sourceStatus.fg} label="Fear&Greed" />
              </div>
            )}

            {usingFallback && (
              <div style={{ background: t.yellowDim, border: `1px solid ${t.yellow}40`, borderRadius: 8, padding: "8px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: t.yellow, flex: 1 }}>⚠ Using sample data — live feeds unavailable</span>
                <button onClick={fetchAllPrices} style={{ background: t.yellow, color: "#000", border: "none", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Retry</button>
              </div>
            )}

            {hasPriceData && (
              <>
                {/* ─── Market Overview ─── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <div style={{ ...panelStyle, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: t.textDim, marginBottom: 3, fontFamily: monoFont, letterSpacing: 0.5 }}>MKT CAP</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: monoFont }}>${globalData ? (globalData.total_market_cap.usd / 1e12).toFixed(2) : "2.84"}T</div>
                  </div>
                  <div style={{ ...panelStyle, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: t.textDim, marginBottom: 3, fontFamily: monoFont, letterSpacing: 0.5 }}>24H VOL</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: monoFont }}>${globalData ? (globalData.total_volume.usd / 1e9).toFixed(1) : "98.2"}B</div>
                  </div>
                  <div style={{ ...panelStyle, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9, color: t.textDim, marginBottom: 3, fontFamily: monoFont, letterSpacing: 0.5 }}>FEAR & GREED</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: monoFont }}>{fgData.value || "—"}</div>
                    {fgData.label && <div style={{ fontSize: 10, color: fgColor, fontWeight: 600 }}>{fgData.label}</div>}
                  </div>
                </div>

                {/* ─── Coin Watchlist + Chart ─── */}
                <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "240px 1fr", gap: 10, marginBottom: 14 }}>
                  {/* Watchlist */}
                  <div style={{ ...panelStyle, padding: 0, overflow: "hidden", marginBottom: isMobile ? 10 : 0 }}>
                    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border}` }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, letterSpacing: 0.5 }}>WATCHLIST</span>
                    </div>
                    <div style={{ maxHeight: isMobile ? 200 : 400, overflowY: "auto", overflowX: isMobile ? "auto" : "hidden", display: isMobile ? "flex" : "block", gap: isMobile ? 0 : undefined }}>
                      {COINS.map((coin) => {
                        const data = mergedPrices[coin.id];
                        if (!data?.price) return null;
                        const change = data.change24h || 0;
                        const changeColor = change >= 0 ? t.green : t.red;
                        const isSelected = selectedCoin.id === coin.id;
                        return (
                          <div key={coin.id} onClick={() => setSelectedCoin(coin)} style={{
                            padding: isMobile ? "8px 12px" : "8px 12px",
                            minWidth: isMobile ? 140 : undefined,
                            cursor: "pointer", borderBottom: isMobile ? "none" : `1px solid ${t.border}10`,
                            background: isSelected ? `${t.accent}10` : "transparent",
                            borderLeft: isSelected ? `2px solid ${t.accent}` : "2px solid transparent",
                            transition: "all 0.15s",
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: coin.color }} />
                                <span style={{ fontWeight: 600, fontSize: 12, color: t.text }}>{coin.symbol}</span>
                              </div>
                              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: changeColor + "15", color: changeColor, fontWeight: 600, fontFamily: monoFont }}>
                                {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                              </span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: t.text, fontFamily: monoFont }}>
                                ${data.price < 1 ? data.price.toFixed(4) : data.price < 100 ? data.price.toFixed(2) : formatPrice(data.price)}
                              </span>
                              <Sparkline data={data.sparkline} color={changeColor} width={50} height={18} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* OHLC Chart */}
                  <OHLCChart candles={ohlcData[selectedCoin.id]} coin={selectedCoin} currentPrice={selectedCoinData?.price} isMobile={isMobile} />
                </div>

                {/* ─── Trade Signals ─── */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h2 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, margin: 0, color: t.text }}>Trade Signals</h2>
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: t.yellowDim, color: t.yellow, fontWeight: 700, fontFamily: monoFont, letterSpacing: 0.5 }}>BETA</span>
                      <span style={{ fontSize: 11, color: t.textDim }}>({filteredSignals.length})</span>
                    </div>
                    {editingAmounts ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <input value={amountsText} onChange={(e) => setAmountsText(e.target.value)} style={{ background: t.bg, border: `1px solid ${t.accent}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, color: t.text, width: 100, outline: "none", fontFamily: monoFont }} />
                        <button onClick={saveAmounts} style={{ background: t.green, color: "#fff", border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✓</button>
                        <button onClick={() => setEditingAmounts(false)} style={{ background: t.surfaceAlt, color: t.textMuted, border: "none", borderRadius: 5, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>×</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAmountsText(tradeAmounts.join(", ")); setEditingAmounts(true); }} style={{ background: t.surfaceAlt, color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontFamily: monoFont }}>
                        ✎ {tradeAmounts.map((a) => `$${a}`).join(", ")}
                      </button>
                    )}
                  </div>

                  {/* Signal type filter */}
                  <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 10, WebkitOverflowScrolling: "touch" }}>
                    {signalTypes.map((type) => (
                      <button key={type} onClick={() => setSignalFilter(type)} style={{
                        background: signalFilter === type ? t.accent : t.surfaceAlt,
                        color: signalFilter === type ? "#fff" : t.textMuted,
                        border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11,
                        fontWeight: 600, cursor: "pointer", textTransform: "capitalize", whiteSpace: "nowrap",
                        transition: "all 0.15s",
                      }}>
                        {type}
                      </button>
                    ))}
                  </div>

                  {/* Signal cards */}
                  <div style={{ display: "grid", gap: 10 }}>
                    {filteredSignals.map((signal, i) => (
                      <div key={i} style={{ ...panelStyle, padding: isMobile ? 12 : 16, position: "relative" }}>
                        {i === 0 && (
                          <div style={{
                            position: "absolute", top: -1, right: 16,
                            background: `linear-gradient(135deg, ${t.yellow}, #ff9800)`, color: "#000",
                            fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: "0 0 6px 6px",
                            fontFamily: monoFont, letterSpacing: 0.5,
                          }}>TOP</div>
                        )}

                        {/* Signal header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: isMobile ? 15 : 17, color: t.text }}>{signal.symbol}</span>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, background: signal.typeColor + "18", color: signal.typeColor, fontWeight: 600 }}>{signal.type}</span>
                          <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: t.greenDim, color: t.green, fontWeight: 600, fontFamily: monoFont }}>+{signal.profitPct.toFixed(1)}%</span>
                          {signal.trend && (
                            <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: signal.trend === "up" ? t.greenDim : t.redDim, color: signal.trend === "up" ? t.green : t.red, fontFamily: monoFont }}>
                              {signal.trend === "up" ? "▲" : "▼"}
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: isMobile ? 11 : 12, color: t.textMuted, lineHeight: 1.5, margin: "0 0 10px" }}>{signal.desc}</p>

                        {/* Technical indicators */}
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                          {signal.rsi != null && (
                            <span style={{ background: t.bg, borderRadius: 5, padding: "3px 8px", fontSize: 10, fontFamily: monoFont }}>
                              <span style={{ color: t.textDim }}>RSI </span>
                              <span style={{ color: signal.rsi > 70 ? t.red : signal.rsi < 30 ? t.green : t.yellow, fontWeight: 600 }}>{signal.rsi.toFixed(0)}</span>
                            </span>
                          )}
                          {signal.atrPct != null && (
                            <span style={{ background: t.bg, borderRadius: 5, padding: "3px 8px", fontSize: 10, fontFamily: monoFont }}>
                              <span style={{ color: t.textDim }}>VOL </span>
                              <span style={{ color: t.accent, fontWeight: 600 }}>{signal.atrPct.toFixed(1)}%</span>
                            </span>
                          )}
                          {signal.supportLevel != null && (
                            <span style={{ background: t.bg, borderRadius: 5, padding: "3px 8px", fontSize: 10, fontFamily: monoFont }}>
                              <span style={{ color: t.textDim }}>S: </span>
                              <span style={{ color: "#26c6da", fontWeight: 600 }}>${formatPrice(signal.supportLevel)}</span>
                            </span>
                          )}
                          {signal.resistanceLevel != null && (
                            <span style={{ background: t.bg, borderRadius: 5, padding: "3px 8px", fontSize: 10, fontFamily: monoFont }}>
                              <span style={{ color: t.textDim }}>R: </span>
                              <span style={{ color: t.yellow, fontWeight: 600 }}>${formatPrice(signal.resistanceLevel)}</span>
                            </span>
                          )}
                        </div>

                        {/* Entry/Target/Stop/RR grid */}
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
                          {[
                            { label: "ENTRY", value: `$${formatPrice(signal.entryLow)}–${formatPrice(signal.entryHigh)}`, color: t.accent },
                            { label: "TARGET", value: `$${formatPrice(signal.targetLow)}–${formatPrice(signal.targetHigh)}`, color: t.green },
                            { label: "STOP", value: `$${formatPrice(signal.stop)}`, color: t.red },
                            { label: "R/R", value: signal.rr, color: t.yellow },
                          ].map((item, j) => (
                            <div key={j} style={{ background: t.bg, borderRadius: 6, padding: "7px 10px" }}>
                              <div style={{ fontSize: 9, color: t.textDim, marginBottom: 2, fontFamily: monoFont, letterSpacing: 0.5 }}>{item.label}</div>
                              <div style={{ fontSize: isMobile ? 11 : 13, fontWeight: 600, color: item.color, wordBreak: "break-all", fontFamily: monoFont }}>{item.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Confidence */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4, fontFamily: monoFont, letterSpacing: 0.5 }}>CONFIDENCE</div>
                          <ConfidenceBar value={signal.confidence} />
                        </div>

                        {/* Trade buttons */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "10px 0 0", borderTop: `1px solid ${t.border}` }}>
                          <span style={{ fontSize: 10, color: t.accent, fontWeight: 600, alignSelf: "center", fontFamily: monoFont }}>PAPER:</span>
                          {tradeAmounts.map((amount) => {
                            const canAfford = amount + amount * (fees.taker / 100) <= balance;
                            return (
                              <button key={amount} onClick={() => enterTrade(signal, amount)} disabled={!canAfford} style={{
                                background: canAfford ? t.accentDim : t.surfaceAlt,
                                border: `1px solid ${canAfford ? t.accent : t.border}`,
                                borderRadius: 6, padding: isMobile ? "8px 14px" : "8px 18px",
                                fontSize: 12, fontWeight: 700, cursor: canAfford ? "pointer" : "not-allowed",
                                color: canAfford ? t.text : t.textDim, fontFamily: monoFont,
                                transition: "all 0.15s",
                              }}>
                                ${amount}
                              </button>
                            );
                          })}
                        </div>

                        {/* Trade examples table (desktop only) */}
                        {!isMobile && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4, fontFamily: monoFont }}>
                              EXAMPLES <span style={{ color: t.yellow, fontWeight: 700 }}>· {fees.taker}%/{fees.maker}%</span>
                            </div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: monoFont }}>
                              <thead>
                                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                                  {["$", "Coins", "+Profit", "P%", "-Loss", "L%"].map((h, j) => (
                                    <th key={j} style={{ padding: "4px 6px", textAlign: "left", color: t.textDim, fontSize: 9, fontWeight: 600 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {tradeAmounts.map((amount, j) => {
                                  const ep = (signal.entryLow + signal.entryHigh) / 2;
                                  const tp = (signal.targetLow + signal.targetHigh) / 2;
                                  const coins = amount / ep;
                                  const profit = coins * tp * (1 - fees.maker / 100) - amount * (1 + fees.taker / 100) + amount;
                                  const loss = coins * signal.stop * (1 - fees.maker / 100) - amount * (1 + fees.taker / 100) + amount;
                                  return (
                                    <tr key={j}>
                                      <td style={{ padding: "5px 6px", fontWeight: 600, color: t.text }}>${amount}</td>
                                      <td style={{ padding: "5px 6px", color: t.textMuted }}>{formatPrice(coins)}</td>
                                      <td style={{ padding: "5px 6px", color: t.green, fontWeight: 600 }}>+${formatPrice(profit)}</td>
                                      <td style={{ padding: "5px 6px", color: t.green }}>{(profit / amount * 100).toFixed(1)}%</td>
                                      <td style={{ padding: "5px 6px", color: t.red, fontWeight: 600 }}>${formatPrice(Math.abs(loss))}</td>
                                      <td style={{ padding: "5px 6px", color: t.red }}>{(loss / amount * 100).toFixed(1)}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!hasPriceData && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>◌</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Connecting to markets...</div>
                <div style={{ fontSize: 11, color: t.textDim, marginTop: 4 }}>Fetching live data from multiple sources</div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════ TRADE LOG ═══════════════════ */}
        {dataLoaded && page === "log" && (
          <div>
            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, 1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "TRADES", value: closedTrades.length, color: t.text },
                { label: "WINS", value: winCount, color: t.green },
                { label: "LOSSES", value: closedTrades.length - winCount, color: t.red },
                { label: "WIN %", value: closedTrades.length > 0 ? `${((winCount / closedTrades.length) * 100).toFixed(0)}%` : "—", color: t.yellow },
                { label: "TOTAL P&L", value: `${closedPnl >= 0 ? "+" : ""}$${formatPrice(closedPnl)}`, color: closedPnl >= 0 ? t.green : t.red },
                { label: "AVG", value: closedTrades.length > 0 ? `${closedPnl / closedTrades.length >= 0 ? "+" : ""}$${formatPrice(closedPnl / closedTrades.length)}` : "—", color: closedPnl >= 0 ? t.green : t.red },
              ].map((stat, i) => (
                <div key={i} style={{ ...panelStyle, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: t.textDim, marginBottom: 3, fontFamily: monoFont, letterSpacing: 0.5 }}>{stat.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: stat.color, fontFamily: monoFont }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <EquityCurve closedTrades={closedTrades} isMobile={isMobile} />

            {/* Open trades */}
            {openTrades.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: "0 0 10px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: t.green }}>●</span> Open Positions ({openTrades.length})
                </h3>
                {openTrades.map((trade) => {
                  const cp = mergedPrices[trade.coinId]?.price || trade.entryPrice;
                  const pnl = trade.coins * cp * (1 - fees.maker / 100) - trade.investAmt - trade.entryFee;
                  const pnlPct = (pnl / trade.investAmt) * 100;
                  const isExpanded = expandedTrade === trade.id;
                  return (
                    <div key={trade.id} style={{ ...panelStyle, padding: "12px 14px", marginBottom: 6, borderColor: pnl >= 0 ? `${t.green}25` : `${t.red}25` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8, cursor: "pointer" }} onClick={() => setExpandedTrade(isExpanded ? null : trade.id)}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: t.text }}>{trade.symbol}</span>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: "#26c6da18", color: "#26c6da", fontWeight: 600 }}>{trade.type}</span>
                            {trade.riskLabel && <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: t.surfaceAlt, color: t.textDim }}>{trade.riskLabel}</span>}
                          </div>
                          <div style={{ fontSize: 10, color: t.textDim, fontFamily: monoFont }}>{trade.enteredAt}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: pnl >= 0 ? t.green : t.red, fontFamily: monoFont }}>{pnl >= 0 ? "+" : ""}${formatPrice(pnl)}</div>
                          <div style={{ fontSize: 10, color: pnl >= 0 ? t.green : t.red, fontFamily: monoFont }}>{pnlPct.toFixed(1)}%</div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, fontSize: 10, fontFamily: monoFont }}>
                        <div><span style={{ color: t.textDim }}>Invest: </span><span style={{ color: t.text, fontWeight: 600 }}>${trade.investAmt}</span></div>
                        <div><span style={{ color: t.textDim }}>Entry: </span><span style={{ color: t.accent, fontWeight: 600 }}>${formatPrice(trade.entryPrice)}</span></div>
                        <div><span style={{ color: t.textDim }}>TP: </span><span style={{ color: t.green, fontWeight: 600 }}>${formatPrice(trade.targetPrice)}</span></div>
                        <div><span style={{ color: t.textDim }}>SL: </span><span style={{ color: t.red, fontWeight: 600 }}>${formatPrice(trade.stopPrice)}</span></div>
                      </div>

                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        <button onClick={(e) => { e.stopPropagation(); closeTrade(trade.id, "Manual"); }} style={{ background: t.redDim, border: `1px solid ${t.red}30`, borderRadius: 5, padding: "5px 12px", fontSize: 11, color: t.red, cursor: "pointer", fontWeight: 600 }}>Close</button>
                        <button onClick={() => setExpandedTrade(isExpanded ? null : trade.id)} style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 5, padding: "5px 12px", fontSize: 11, color: t.textMuted, cursor: "pointer" }}>{isExpanded ? "Hide" : "Chart"}</button>
                        <button onClick={(e) => { e.stopPropagation(); if (editingTradeId === trade.id) { setEditingTradeId(null); } else { setEditingTradeId(trade.id); setEditTP(trade.targetPrice.toString()); setEditSL(trade.stopPrice.toString()); } }} style={{ background: t.accentDim, border: `1px solid ${t.accent}30`, borderRadius: 5, padding: "5px 12px", fontSize: 11, color: t.accent, cursor: "pointer" }}>{editingTradeId === trade.id ? "Cancel" : "Modify TP/SL"}</button>
                      </div>

                      {editingTradeId === trade.id && (
                        <div style={{ background: t.bg, borderRadius: 6, padding: 10, marginTop: 8, display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                          <div>
                            <div style={{ fontSize: 9, color: t.green, marginBottom: 3, fontFamily: monoFont }}>TARGET</div>
                            <input value={editTP} onChange={(e) => setEditTP(e.target.value)} style={{ background: t.surfaceAlt, border: `1px solid ${t.green}40`, borderRadius: 5, padding: "6px 10px", fontSize: 13, color: t.green, width: 100, outline: "none", fontFamily: monoFont }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: t.red, marginBottom: 3, fontFamily: monoFont }}>STOP</div>
                            <input value={editSL} onChange={(e) => setEditSL(e.target.value)} style={{ background: t.surfaceAlt, border: `1px solid ${t.red}40`, borderRadius: 5, padding: "6px 10px", fontSize: 13, color: t.red, width: 100, outline: "none", fontFamily: monoFont }} />
                          </div>
                          <button onClick={() => modifyTrade(trade.id)} style={{ background: t.accent, color: "#fff", border: "none", borderRadius: 5, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Apply</button>
                        </div>
                      )}
                      {isExpanded && <LiveTradeChart trade={trade} currentPrice={cp} isMobile={isMobile} />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Closed trades */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0 }}>History ({closedTrades.length})</h3>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", "wins", "losses"].map((f) => (
                  <button key={f} onClick={() => setLogFilter(f)} style={{
                    background: logFilter === f ? t.accent : t.surfaceAlt,
                    color: logFilter === f ? "#fff" : t.textDim,
                    border: "none", borderRadius: 5, padding: "5px 12px", fontSize: 11,
                    fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                  }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {closedTrades.length === 0 && (
              <div style={{ textAlign: "center", padding: 40, color: t.textDim }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>◌</div>
                <div style={{ fontSize: 13 }}>No trades yet — open your first position from the dashboard</div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {closedTrades.slice().reverse()
                .filter((t) => logFilter === "wins" ? t.pnl > 0 : logFilter === "losses" ? t.pnl <= 0 : true)
                .map((trade, i) => {
                  const isWin = trade.pnl > 0;
                  const isExpanded = expandedClosed === i;
                  const color = isWin ? t.green : t.red;
                  return (
                    <div key={i} style={{ ...panelStyle, padding: isMobile ? 12 : 14, cursor: "pointer", borderColor: `${color}15` }} onClick={() => setExpandedClosed(isExpanded ? null : i)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{trade.symbol}</span>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: `${color}18`, color, fontWeight: 600 }}>{trade.type}</span>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 5, background: `${color}12`, color, fontWeight: 700 }}>{trade.reason}</span>
                            {trade.riskLabel && <span style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: t.surfaceAlt, color: t.textDim }}>{trade.riskLabel}</span>}
                          </div>
                          <div style={{ fontSize: 10, color: t.textDim, fontFamily: monoFont }}>
                            {trade.rr && <span>R/R:{trade.rr} · </span>}
                            {trade.duration && <span>{trade.duration}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: monoFont }}>{trade.pnl >= 0 ? "+" : ""}${formatPrice(trade.pnl)}</div>
                          <div style={{ fontSize: 12, color, fontFamily: monoFont }}>{trade.pnlPct >= 0 ? "+" : ""}{trade.pnlPct.toFixed(1)}%</div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div>
                          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
                            {[
                              { label: "INVESTED", value: `$${trade.investAmt}` },
                              { label: "ENTRY → EXIT", value: `$${formatPrice(trade.entryPrice)} → $${formatPrice(trade.exitPrice)}` },
                              { label: "FEES", value: `$${formatPrice(trade.entryFee + (trade.exitFee || 0))}`, color: t.yellow },
                              { label: "COINS", value: formatPrice(trade.coins) },
                            ].map((item, j) => (
                              <div key={j} style={{ background: t.bg, borderRadius: 6, padding: "8px 10px" }}>
                                <div style={{ fontSize: 9, color: t.textDim, fontFamily: monoFont }}>{item.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: item.color || t.text, fontFamily: monoFont }}>{item.value}</div>
                              </div>
                            ))}
                          </div>
                          <ClosedTradeChart trade={trade} isMobile={isMobile} />
                        </div>
                      )}

                      <div style={{ display: "flex", gap: isMobile ? 12 : 20, fontSize: 10, color: t.textDim, marginTop: isExpanded ? 8 : 0, fontFamily: monoFont }}>
                        <span>↓ {trade.enteredAt}</span>
                        <span>↑ {trade.closedAt}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {!dataLoaded && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <span style={{ color: t.textDim }}>Loading...</span>
          </div>
        )}

        {/* ─── Disclaimer ─── */}
        <div style={{ marginTop: 24, padding: 12, background: `${t.surfaceAlt}60`, borderRadius: 8, border: `1px solid ${t.border}` }}>
          <p style={{ fontSize: 10, color: t.textDim, margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: t.textMuted }}>Disclaimer:</strong> Paper trading with simulated funds. Signals generated from Kraken OHLC technical analysis. Not financial advice. Cryptocurrency involves significant risk of loss.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #262838; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #363850; }
        button { transition: opacity 0.15s; }
        button:hover { opacity: 0.85; }
        input { font-family: 'JetBrains Mono', monospace; }
      `}</style>
    </div>
  );
}
