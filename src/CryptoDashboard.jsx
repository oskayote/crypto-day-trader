import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
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
  { label: "Conservative", color: "#26a69a", targetMul: 0.7, stopMul: 0.7 },
  { label: "Moderate", color: "#d4a017", targetMul: 1.0, stopMul: 1.0 },
  { label: "Aggressive", color: "#ef5350", targetMul: 1.5, stopMul: 1.3 },
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
  bitcoin: { price: 84250, change: -0.8 }, ethereum: { price: 1835, change: 1.2 },
  solana: { price: 138.5, change: -2.1 }, ripple: { price: 2.34, change: 3.5 },
  cardano: { price: 0.71, change: -0.4 }, dogecoin: { price: 0.168, change: 1.8 },
  polkadot: { price: 4.12, change: 0.6 }, "avalanche-2": { price: 21.4, change: -1.5 },
  chainlink: { price: 13.8, change: 2.3 }, polygon: { price: 0.22, change: -0.3 },
};

const TYPE_COLORS = {
  Scalp: "#26c6da", Long: "#26a69a", Breakout: "#ffb74d",
  "Dip Buy": "#ab47bc", Momentum: "#ff7043", Reversal: "#ec407a",
};

const T = {
  bg: "#0c0e16", surface: "#151822", surfaceRaised: "#1b1f2e",
  border: "#232738", borderLight: "#2d3348", text: "#e1e3ea",
  textSoft: "#8b90a0", textDim: "#4e5468", accent: "#7c4dff",
  accentSoft: "#7c4dff25", green: "#26a69a", greenSoft: "#26a69a20",
  red: "#ef5350", redSoft: "#ef535020", yellow: "#d4a017", yellowSoft: "#d4a01720",
  mono: "'JetBrains Mono','Fira Code','SF Mono',monospace",
  sans: "'DM Sans','Helvetica Neue',sans-serif",
};

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */

function fmt(v) {
  if (v == null || isNaN(v)) return "—";
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1000) return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(4);
  return v.toFixed(6);
}

function genSparkline(base, ch) {
  const d = []; let v = base * (1 - Math.abs(ch) / 100);
  for (let i = 0; i < 48; i++) { v += v * ((ch > 0 ? 0.3 : -0.3) + (Math.random() - 0.5) * 1.2) / 100; d.push(v); }
  return d;
}

async function safeFetch(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
  const r = await fetch(url, { signal: c.signal, mode: "cors" }); clearTimeout(t);
  if (!r.ok) throw new Error(r.status); return r.json();
}

function sGet(k) {
  return new Promise((res) => {
    if (typeof window !== "undefined" && window.storage?.get)
      window.storage.get(k).then((r) => res(r?.value || null)).catch(() => { try { res(localStorage.getItem(k)); } catch { res(null); } });
    else try { res(localStorage.getItem(k)); } catch { res(null); }
  });
}
function sSet(k, v) { if (typeof window !== "undefined" && window.storage?.set) try { window.storage.set(k, v); } catch {} try { localStorage.setItem(k, v); } catch {} }
function sDel(k) { if (typeof window !== "undefined" && window.storage?.delete) try { window.storage.delete(k); } catch {} try { localStorage.removeItem(k); } catch {} }

/* ═══════════════════════════════════════════════════════════════
   ANALYSIS + SIGNAL GENERATION
   ═══════════════════════════════════════════════════════════════ */

function analyzeOHLC(candles) {
  if (!candles || candles.length < 10) return null;
  const recent = candles.slice(-14);
  let atrSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const h = recent[i][2], l = recent[i][3], pc = recent[i - 1][4];
    atrSum += Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  const atr = atrSum / (recent.length - 1);
  const closes = candles.map((c) => parseFloat(c[4]));
  const highs = candles.map((c) => parseFloat(c[2]));
  const lows = candles.map((c) => parseFloat(c[3]));
  const allLvl = [...highs.slice(-20), ...lows.slice(-20)].sort((a, b) => a - b);
  const pr = closes[closes.length - 1], th = pr * 0.003;
  const clusters = []; let cur = [allLvl[0]];
  for (let i = 1; i < allLvl.length; i++) {
    if (allLvl[i] - allLvl[i - 1] < th) cur.push(allLvl[i]);
    else { if (cur.length >= 2) clusters.push(cur.reduce((a, b) => a + b, 0) / cur.length); cur = [allLvl[i]]; }
  }
  if (cur.length >= 2) clusters.push(cur.reduce((a, b) => a + b, 0) / cur.length);
  const sup = clusters.filter((c) => c < pr).sort((a, b) => b - a)[0] || pr * 0.985;
  const res = clusters.filter((c) => c > pr).sort((a, b) => a - b)[0] || pr * 1.015;
  const vP = (atr / pr) * 100;
  const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const mom = ((pr - sma10) / sma10) * 100;
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const trend = pr > sma20 ? "up" : "down";
  let g = 0, ls = 0; const rp = Math.min(14, closes.length - 1);
  for (let i = closes.length - rp; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else ls += Math.abs(d); }
  const rsi = ls === 0 ? 100 : 100 - 100 / (1 + (g / rp) / (ls / rp));
  return { atr, sup, res, vP, mom, rsi, pr, trend };
}

function mkSignal(coin, md, type, desc, eL, eH, tL, tH, stop, conf, an, rk) {
  const tm = rk?.targetMul || 1, sm = rk?.stopMul || 1, ae = (eL + eH) / 2;
  const rd = ((tL + tH) / 2) - ae, sd = ae - stop;
  const aL = ae + rd * tm, aH = ae + (tH - ae + (tH - tL) / 2) * tm, aS = ae - sd * sm;
  conf = Math.max(10, Math.min(95, Math.round(conf)));
  const at = (aL + aH) / 2, pp = ((at - ae) / ae) * 100, lp = Math.abs((aS - ae) / ae) * 100;
  const rr = lp > 0 ? pp / lp : 1;
  const sc = (pp / 6) * 0.35 + (conf / 100) * 0.35 + Math.min(rr / 3, 1) * 0.3;
  return {
    symbol: coin.symbol, name: coin.name, coinId: coin.id, coinColor: coin.color,
    type, typeColor: TYPE_COLORS[type] || "#78909c", desc,
    entryLow: eL, entryHigh: eH, targetLow: aL, targetHigh: aH, stop: aS,
    rr: "1:" + rr.toFixed(1), confidence: conf, profitPct: pp, score: sc,
    bid: md.bid, ask: md.ask, spread: md.spread,
    atrPct: an?.vP || null, rsi: an?.rsi || null, momentum: an?.mom || null,
    supportLevel: an?.sup || null, resistanceLevel: an?.res || null, trend: an?.trend || null,
  };
}

function genSignals(coin, md, an, rk) {
  const sigs = [], p = md.price, ch = md.change24h || 0;
  if (!an) { const a = p * 0.012; sigs.push(mkSignal(coin, md, "Scalp", `${coin.symbol} scalp`, p - a * 0.3, p, p + a * 1.8, p + a * 2.2, p - a * 1.2, 55, null, rk)); return sigs; }
  const { atr, sup, res, vP, mom, rsi, trend } = an;
  if (vP > 0.3) { let c = 60; if (mom > 0.5) c += 8; if (rsi < 60) c += 5; if (md.spread != null && md.spread < 0.05) c += 5; sigs.push(mkSignal(coin, md, "Scalp", `${coin.symbol} scalp — vol ${vP.toFixed(1)}%`, p - atr * 0.4, p, p + atr * 1.5, p + atr * 2.0, p - atr * 1.2, c, an, rk)); }
  if (trend === "up" || mom > 0.3) { let c = 55; if (trend === "up") c += 10; if (rsi < 65) c += 5; if (ch > 2) c += 5; sigs.push(mkSignal(coin, md, "Long", `${coin.symbol} long — ${trend} trend`, p - atr * 0.5, p + atr * 0.1, p + atr * 3, p + atr * 4, p - atr * 1.8, c, an, rk)); }
  if (((res - p) / p) * 100 < 2 && mom > 0) { let c = 58; if (vP > 0.5) c += 6; sigs.push(mkSignal(coin, md, "Breakout", `${coin.symbol} breakout near $${fmt(res)}`, res * 0.998, res * 1.005, res + atr * 2.5, res + atr * 3.5, res - atr * 1.2, c, an, rk)); }
  if (rsi < 40 || ch < -2) { let c = 52; if (rsi < 30) c += 10; if (((p - sup) / p) * 100 < 1.5) c += 8; sigs.push(mkSignal(coin, md, "Dip Buy", `${coin.symbol} dip — RSI ${rsi.toFixed(0)} near $${fmt(sup)}`, sup * 0.997, sup * 1.005, sup + atr * 2.5, sup + atr * 3.5, sup - atr * 1.5, c, an, rk)); }
  if (mom > 1 && vP > 0.4) { let c = 62; if (ch > 3) c += 8; if (trend === "up") c += 6; sigs.push(mkSignal(coin, md, "Momentum", `${coin.symbol} momentum +${mom.toFixed(1)}%`, p - atr * 0.2, p + atr * 0.1, p + atr * 2, p + atr * 3, p - atr * 1.5, c, an, rk)); }
  if (rsi < 30 && trend === "down" && ch < -3) { let c = 45; if (rsi < 25) c += 8; sigs.push(mkSignal(coin, md, "Reversal", `${coin.symbol} reversal RSI ${rsi.toFixed(0)}`, p - atr * 0.3, p + atr * 0.1, p + atr * 3, p + atr * 4.5, p - atr * 2, c, an, rk)); }
  if (sigs.length === 0) sigs.push(mkSignal(coin, md, "Scalp", `${coin.symbol} range scalp`, p - atr * 0.5, p, p + atr * 2, p + atr * 2.8, p - atr * 1.3, 50, an, rk));
  return sigs;
}

/* ═══════════════════════════════════════════════════════════════
   SMALL COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function useContainerWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(ref.current);
    setWidth(ref.current.clientWidth);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function ConfBar({ value }) {
  const c = value >= 70 ? T.green : value >= 50 ? T.yellow : T.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.border }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: 2, background: c, transition: "width .4s" }} />
      </div>
      <span style={{ fontSize: 10, color: T.textSoft, fontFamily: T.mono, minWidth: 26 }}>{value}%</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OHLC CHART — with signal overlay + open position lines
   ═══════════════════════════════════════════════════════════════ */

function OHLCChart({ candles, coin, currentPrice, previewSignal, openPositions, isMobile, tradeAmounts, balance, fees, onEnterTrade }) {
  const containerRef = useRef(null);
  const containerW = useContainerWidth(containerRef);
  const W = containerW || (isMobile ? 360 : 620);
  const H = isMobile ? 220 : Math.min(360, Math.max(240, W * 0.5));
  const pL = 8, pR = isMobile ? 52 : 62, pT = 12, pB = 20;
  const cW = W - pL - pR, cH = H - pT - pB;

  if (!candles || candles.length < 5) return (
    <div style={{ background: T.surface, borderRadius: 8, height: H, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}` }}>
      <span style={{ color: T.textDim, fontSize: 12 }}>Loading chart data...</span>
    </div>
  );

  const display = candles.slice(-60);
  const allH = display.map(c => c[2]), allL = display.map(c => c[3]);
  let max = Math.max(...allH), min = Math.min(...allL);

  if (previewSignal) { max = Math.max(max, previewSignal.targetHigh); min = Math.min(min, previewSignal.stop); }
  const coinPositions = openPositions.filter(t => t.coinId === coin.id);
  coinPositions.forEach(t => { max = Math.max(max, t.targetPrice); min = Math.min(min, t.stopPrice); });

  const range = max - min || 1;
  max += range * 0.06; min -= range * 0.06;
  const totalRange = max - min;

  const yPos = (p) => pT + cH * (1 - (p - min) / totalRange);
  const candleW = Math.max(2, (cW / display.length) * 0.6);
  const gap = cW / display.length;

  const gridLines = [];
  for (let i = 0; i <= 6; i++) gridLines.push(min + (totalRange * i) / 6);

  const sigPreview = previewSignal && previewSignal.coinId === coin.id ? previewSignal : null;

  return (
    <div ref={containerRef} style={{ background: T.surface, borderRadius: 8, border: `1px solid ${T.border}`, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "6px 10px" : "8px 12px", borderBottom: `1px solid ${T.border}`, flexWrap: "wrap", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: coin.color }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{coin.symbol}/USD</span>
          <span style={{ fontSize: 10, color: T.textDim }}>15m</span>
          {sigPreview && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: sigPreview.typeColor + "20", color: sigPreview.typeColor, fontWeight: 600, fontFamily: T.mono }}>Previewing: {sigPreview.type}</span>}
          {coinPositions.length > 0 && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: T.accentSoft, color: T.accent, fontWeight: 600, fontFamily: T.mono }}>{coinPositions.length} open</span>}
        </div>
        {currentPrice && <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: T.mono }}>${fmt(currentPrice)}</span>}
      </div>

      <div style={{ position: "relative" }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
          {gridLines.map((price, i) => (
            <g key={i}>
              <line x1={pL} y1={yPos(price)} x2={pL + cW} y2={yPos(price)} stroke={T.border} strokeWidth="0.5" />
              <text x={W - pR + 4} y={yPos(price) + 3} fill={T.textDim} fontSize="8" fontFamily={T.mono}>{fmt(price)}</text>
            </g>
          ))}

          {coinPositions.map((pos, pi) => {
            const entryY = yPos(pos.entryPrice), tpY = yPos(pos.targetPrice), slY = yPos(pos.stopPrice);
            return (
              <g key={`pos-${pi}`}>
                <rect x={pL} y={tpY} width={cW} height={Math.max(0, entryY - tpY)} fill={T.green} fillOpacity="0.04" />
                <rect x={pL} y={entryY} width={cW} height={Math.max(0, slY - entryY)} fill={T.red} fillOpacity="0.04" />
                <line x1={pL} y1={entryY} x2={pL + cW} y2={entryY} stroke={T.accent} strokeWidth="1" strokeDasharray="6,3" />
                <line x1={pL} y1={tpY} x2={pL + cW} y2={tpY} stroke={T.green} strokeWidth="0.8" strokeDasharray="4,3" />
                <line x1={pL} y1={slY} x2={pL + cW} y2={slY} stroke={T.red} strokeWidth="0.8" strokeDasharray="4,3" />
                <rect x={W - pR + 1} y={entryY - 7} width={pR - 4} height={14} rx="2" fill={T.accent} fillOpacity="0.15" />
                <text x={W - pR + 4} y={entryY + 3} fill={T.accent} fontSize="7" fontWeight="600" fontFamily={T.mono}>IN ${fmt(pos.entryPrice)}</text>
                <rect x={W - pR + 1} y={tpY - 7} width={pR - 4} height={14} rx="2" fill={T.green} fillOpacity="0.15" />
                <text x={W - pR + 4} y={tpY + 3} fill={T.green} fontSize="7" fontWeight="600" fontFamily={T.mono}>TP ${fmt(pos.targetPrice)}</text>
                <rect x={W - pR + 1} y={slY - 7} width={pR - 4} height={14} rx="2" fill={T.red} fillOpacity="0.15" />
                <text x={W - pR + 4} y={slY + 3} fill={T.red} fontSize="7" fontWeight="600" fontFamily={T.mono}>SL ${fmt(pos.stopPrice)}</text>
              </g>
            );
          })}

          {sigPreview && (
            <g>
              <rect x={pL} y={yPos(sigPreview.entryHigh)} width={cW} height={Math.max(0, yPos(sigPreview.entryLow) - yPos(sigPreview.entryHigh))} fill={T.accent} fillOpacity="0.08" />
              <rect x={pL} y={yPos(sigPreview.targetHigh)} width={cW} height={Math.max(0, yPos(sigPreview.targetLow) - yPos(sigPreview.targetHigh))} fill={T.green} fillOpacity="0.1" />
              <line x1={pL} y1={yPos(sigPreview.stop)} x2={pL + cW} y2={yPos(sigPreview.stop)} stroke={T.red} strokeWidth="1.2" strokeDasharray="6,4" />
              <rect x={pL + 4} y={yPos((sigPreview.entryLow + sigPreview.entryHigh) / 2) - 8} width={56} height={16} rx="3" fill={T.accent} fillOpacity="0.9" />
              <text x={pL + 8} y={yPos((sigPreview.entryLow + sigPreview.entryHigh) / 2) + 3} fill="#fff" fontSize="8" fontWeight="700" fontFamily={T.mono}>ENTRY</text>
              <rect x={pL + 4} y={yPos((sigPreview.targetLow + sigPreview.targetHigh) / 2) - 8} width={56} height={16} rx="3" fill={T.green} fillOpacity="0.9" />
              <text x={pL + 8} y={yPos((sigPreview.targetLow + sigPreview.targetHigh) / 2) + 3} fill="#fff" fontSize="8" fontWeight="700" fontFamily={T.mono}>TARGET</text>
              <rect x={pL + 4} y={yPos(sigPreview.stop) - 8} width={42} height={16} rx="3" fill={T.red} fillOpacity="0.9" />
              <text x={pL + 8} y={yPos(sigPreview.stop) + 3} fill="#fff" fontSize="8" fontWeight="700" fontFamily={T.mono}>STOP</text>
              <rect x={W - pR + 1} y={yPos((sigPreview.targetLow + sigPreview.targetHigh) / 2) - 7} width={pR - 4} height={14} rx="2" fill={T.green} />
              <text x={W - pR + 4} y={yPos((sigPreview.targetLow + sigPreview.targetHigh) / 2) + 3} fill="#fff" fontSize="7" fontWeight="700" fontFamily={T.mono}>${fmt((sigPreview.targetLow + sigPreview.targetHigh) / 2)}</text>
              <rect x={W - pR + 1} y={yPos(sigPreview.stop) - 7} width={pR - 4} height={14} rx="2" fill={T.red} />
              <text x={W - pR + 4} y={yPos(sigPreview.stop) + 3} fill="#fff" fontSize="7" fontWeight="700" fontFamily={T.mono}>${fmt(sigPreview.stop)}</text>
            </g>
          )}

          {display.map((c, i) => {
            const open = c[1], high = c[2], low = c[3], close = c[4];
            const bull = close >= open;
            const col = bull ? T.green : T.red;
            const x = pL + i * gap + gap / 2;
            const bTop = yPos(Math.max(open, close)), bBot = yPos(Math.min(open, close));
            const bH = Math.max(1, bBot - bTop);
            return (
              <g key={i}>
                <line x1={x} y1={yPos(high)} x2={x} y2={yPos(low)} stroke={col} strokeWidth="1" />
                <rect x={x - candleW / 2} y={bTop} width={candleW} height={bH} fill={col} rx="0.5" />
              </g>
            );
          })}

          {currentPrice && (
            <g>
              <line x1={pL} y1={yPos(currentPrice)} x2={pL + cW} y2={yPos(currentPrice)} stroke="#7c4dff" strokeWidth="0.8" strokeDasharray="2,2" />
              <rect x={W - pR + 1} y={yPos(currentPrice) - 8} width={pR - 4} height={16} rx="3" fill="#7c4dff" />
              <text x={W - 4} y={yPos(currentPrice) + 3} fill="#fff" fontSize="8" fontWeight="700" textAnchor="end" fontFamily={T.mono}>{fmt(currentPrice)}</text>
            </g>
          )}
        </svg>

        {sigPreview && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px",
            background: "linear-gradient(transparent, rgba(12,14,22,.95) 40%)",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: sigPreview.typeColor }}>{sigPreview.type}</span>
              <span style={{ fontSize: 10, color: T.green, fontFamily: T.mono, fontWeight: 600 }}>+{sigPreview.profitPct.toFixed(1)}%</span>
              <span style={{ fontSize: 10, color: T.textSoft, fontFamily: T.mono }}>{sigPreview.rr}</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {tradeAmounts.map((amt) => {
                const canAfford = amt + amt * (fees.taker / 100) <= balance;
                return (
                  <button key={amt} onClick={(e) => { e.stopPropagation(); onEnterTrade(sigPreview, amt); }}
                    disabled={!canAfford}
                    style={{
                      background: canAfford ? T.accent : T.surfaceRaised,
                      border: "none", borderRadius: 5, padding: "5px 12px",
                      fontSize: 11, fontWeight: 700, cursor: canAfford ? "pointer" : "not-allowed",
                      color: canAfford ? "#fff" : T.textDim, fontFamily: T.mono,
                    }}>
                    ${amt}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EQUITY CURVE
   ═══════════════════════════════════════════════════════════════ */

function EquityCurve({ closedTrades, isMobile }) {
  const sb = 5000;
  if (closedTrades.length < 2) return null;
  const W = isMobile ? 320 : 500, H = isMobile ? 80 : 90;
  const pL = 42, pR = 8, pT = 6, pB = 12;
  const cW = W - pL - pR, cH = H - pT - pB;
  const eq = [sb]; closedTrades.forEach((t) => eq.push(eq[eq.length - 1] + t.pnl));
  let mx = Math.max(...eq), mn = Math.min(...eq), rg = mx - mn || 1;
  mx += rg * 0.05; mn -= rg * 0.05; rg = mx - mn;
  const yE = (v) => pT + cH * (1 - (v - mn) / rg);
  const pts = eq.map((v, i) => `${pL + (i / Math.max(eq.length - 1, 1)) * cW},${yE(v)}`).join(" ");
  const fp = `${pL},${yE(sb)} ${pts} ${pL + cW},${yE(sb)}`;
  const fin = eq[eq.length - 1], tp = fin - sb, col = tp >= 0 ? T.green : T.red;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: isMobile ? 8 : 12, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>Equity Curve</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: col, fontFamily: T.mono }}>{tp >= 0 ? "+" : ""}${fmt(tp)} ({((tp / sb) * 100).toFixed(1)}%)</span>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
        <line x1={pL} y1={yE(sb)} x2={pL + cW} y2={yE(sb)} stroke={T.textDim} strokeWidth="0.4" strokeDasharray="3,3" />
        <polygon points={fp} fill={col} fillOpacity="0.08" />
        <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" />
        <circle cx={pL} cy={yE(sb)} r="2.5" fill={T.textDim} />
        <circle cx={pL + cW} cy={yE(fin)} r="3.5" fill={col} stroke={T.surface} strokeWidth="1.5" />
        <text x={pL - 3} y={yE(sb) + 3} fill={T.textDim} fontSize="7" textAnchor="end" fontFamily={T.mono}>${sb}</text>
        <text x={pL + cW + 3} y={yE(fin) + 3} fill={col} fontSize="7" fontFamily={T.mono}>${fin.toFixed(0)}</text>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CLOSED TRADE CHART
   ═══════════════════════════════════════════════════════════════ */

function ClosedChart({ trade, isMobile }) {
  const hist = trade.chartSnapshot || [];
  if (hist.length < 3) return null;
  const W = isMobile ? 300 : 440, H = isMobile ? 70 : 60;
  const pL = 22, pR = 44, pT = 4, pB = 6;
  const cW = W - pL - pR, cH = H - pT - pB;
  const ap = [...hist.map(h => h.p), trade.targetPrice, trade.stopPrice, trade.entryPrice, trade.exitPrice];
  let mx = Math.max(...ap), mn = Math.min(...ap), rg = mx - mn || 1;
  mx += rg * 0.05; mn -= rg * 0.05; rg = mx - mn;
  const yP = (p) => pT + cH * (1 - (p - mn) / rg);
  const xP = (i) => pL + (i / Math.max(hist.length - 1, 1)) * cW;
  const pts = hist.map((h, i) => `${xP(i)},${yP(h.p)}`).join(" ");
  const col = trade.pnl >= 0 ? T.green : T.red;
  return (
    <div style={{ background: T.bg, borderRadius: 6, padding: 4, marginTop: 4 }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", width: "100%", height: "auto" }}>
        <line x1={pL} y1={yP(trade.entryPrice)} x2={pL + cW} y2={yP(trade.entryPrice)} stroke={T.accent} strokeWidth="0.5" strokeDasharray="3,3" />
        <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={pL} cy={yP(trade.entryPrice)} r="2.5" fill={T.accent} />
        <circle cx={xP(hist.length - 1)} cy={yP(trade.exitPrice)} r="3" fill={col} stroke={T.bg} strokeWidth="1" />
        <text x={pL + cW + 3} y={yP(trade.exitPrice) + 3} fill={col} fontSize="7" fontWeight="700" fontFamily={T.mono}>${fmt(trade.exitPrice)}</text>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIGNAL CARD
   ═══════════════════════════════════════════════════════════════ */

function SignalCard({ sig, i, isPreview, onPreview, amounts, bal, fees, onTrade, mob }) {
  const tap = mob ? 40 : 32;
  const fs = mob ? { xs: 9, sm: 10, md: 12 } : { xs: 10, sm: 11, md: 13 };
  return (
    <div style={{
      background: isPreview ? T.surfaceRaised : T.surface,
      border: `1px solid ${isPreview ? T.accent : T.border}`,
      borderRadius: 10, padding: mob ? 12 : 12, position: "relative",
      transition: "border-color .2s, background .2s",
    }}>
      {i === 0 && <div style={{ position: "absolute", top: -1, right: 12, background: T.yellow, color: "#000", fontSize: 8, fontWeight: 700, padding: "2px 8px", borderRadius: "0 0 5px 5px", fontFamily: T.mono }}>TOP</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6, cursor: "pointer" }} onClick={onPreview}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: sig.coinColor }} />
          <span style={{ fontWeight: 700, fontSize: fs.md + 2, color: T.text }}>{sig.symbol}</span>
          <span style={{ fontSize: fs.xs, padding: "3px 8px", borderRadius: 5, background: sig.typeColor + "18", color: sig.typeColor, fontWeight: 600 }}>{sig.type}</span>
          <span style={{ fontSize: fs.xs, padding: "3px 6px", borderRadius: 5, background: T.greenSoft, color: T.green, fontWeight: 600, fontFamily: T.mono }}>+{sig.profitPct.toFixed(1)}%</span>
          {sig.trend && <span style={{ fontSize: fs.xs, color: sig.trend === "up" ? T.green : T.red, fontFamily: T.mono }}>{sig.trend === "up" ? "▲" : "▼"}</span>}
        </div>
        <button style={{ background: isPreview ? T.accent : T.accentSoft, border: "none", borderRadius: 5, padding: mob ? "6px 12px" : "4px 10px", fontSize: fs.xs, color: isPreview ? "#fff" : T.accent, cursor: "pointer", fontWeight: 600, fontFamily: T.mono, whiteSpace: "nowrap", minHeight: tap - 8 }}>
          {isPreview ? "Previewing" : "Preview ◎"}
        </button>
      </div>

      <p style={{ fontSize: fs.sm, color: T.textSoft, lineHeight: 1.5, margin: "0 0 8px" }}>{sig.desc}</p>

      <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
        {sig.rsi != null && <span style={{ background: T.bg, borderRadius: 5, padding: "3px 8px", fontSize: fs.xs, fontFamily: T.mono }}><span style={{ color: T.textDim }}>RSI </span><span style={{ color: sig.rsi > 70 ? T.red : sig.rsi < 30 ? T.green : T.yellow, fontWeight: 600 }}>{sig.rsi.toFixed(0)}</span></span>}
        {sig.atrPct != null && <span style={{ background: T.bg, borderRadius: 5, padding: "3px 8px", fontSize: fs.xs, fontFamily: T.mono }}><span style={{ color: T.textDim }}>VOL </span><span style={{ color: T.accent, fontWeight: 600 }}>{sig.atrPct.toFixed(1)}%</span></span>}
        <span style={{ background: T.bg, borderRadius: 5, padding: "3px 8px", fontSize: fs.xs, fontFamily: T.mono }}><span style={{ color: T.textDim }}>R/R </span><span style={{ color: T.yellow, fontWeight: 600 }}>{sig.rr}</span></span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr", gap: 5, marginBottom: 8 }}>
        {[
          { l: "ENTRY", v: `$${fmt(sig.entryLow)}–${fmt(sig.entryHigh)}`, c: T.accent },
          { l: "TARGET", v: `$${fmt(sig.targetLow)}–${fmt(sig.targetHigh)}`, c: T.green },
          { l: "STOP", v: `$${fmt(sig.stop)}`, c: T.red },
        ].map((x, j) => (
          <div key={j} style={{ background: T.bg, borderRadius: 6, padding: mob ? "7px 8px" : "5px 7px" }}>
            <div style={{ fontSize: fs.xs - 1, color: T.textDim, fontFamily: T.mono, letterSpacing: 0.5, marginBottom: 1 }}>{x.l}</div>
            <div style={{ fontSize: fs.sm, fontWeight: 600, color: x.c, fontFamily: T.mono, wordBreak: "break-all" }}>{x.v}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: fs.xs - 1, color: T.textDim, marginBottom: 3, fontFamily: T.mono }}>CONFIDENCE</div>
        <ConfBar value={sig.confidence} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 10, borderTop: `1px solid ${T.border}`, alignItems: "center" }}>
        <span style={{ fontSize: fs.xs, color: T.accent, fontWeight: 600, fontFamily: T.mono }}>PAPER</span>
        {amounts.map(amt => {
          const ok = amt + amt * (fees.taker / 100) <= bal;
          return (
            <button key={amt} onClick={() => onTrade(sig, amt)} disabled={!ok} style={{
              background: ok ? T.accentSoft : T.surfaceRaised,
              border: `1px solid ${ok ? T.accent + "60" : T.border}`,
              borderRadius: 6, padding: mob ? "8px 16px" : "6px 14px",
              fontSize: fs.sm, fontWeight: 700,
              cursor: ok ? "pointer" : "not-allowed",
              color: ok ? T.text : T.textDim, fontFamily: T.mono,
              minHeight: tap - 4,
            }}>${amt}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */

export default function App() {
  const [winW, setWinW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const mob = winW < 520;
  const tablet = winW >= 520 && winW < 960;
  const compact = winW < 960; // mob or tablet
  useEffect(() => { const h = () => setWinW(window.innerWidth); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const [time, setTime] = useState(new Date());
  const [selCoin, setSelCoin] = useState(COINS[0]);
  const [page, setPage] = useState("signals");
  const [sigFilter, setSigFilter] = useState("all");
  const [amounts, setAmounts] = useState([100, 500, 1000]);
  const [editAmts, setEditAmts] = useState(false);
  const [amtText, setAmtText] = useState("100, 500, 1000");

  const [merged, setMerged] = useState({});
  const [globalD, setGlobalD] = useState(null);
  const [fg, setFg] = useState(null);
  const [srcSt, setSrcSt] = useState({ ws: "loading", cg: "loading", bn: "loading", cc: "loading", fg: "loading", oh: "loading" });
  const [ohlc, setOhlc] = useState({});
  const [fallback, setFallback] = useState(false);
  const [wsOn, setWsOn] = useState(false);
  const [wsTick, setWsTick] = useState(0);
  const [klive, setKlive] = useState({});

  const [loaded, setLoaded] = useState(false);
  const [bal, setBal] = useState(5000);
  const [openT, setOpenT] = useState([]);
  const [closedT, setClosedT] = useState([]);
  const [risk, setRisk] = useState(1);
  const [feeIdx, setFeeIdx] = useState(0);
  const [notif, setNotif] = useState(null);
  const [expTrade, setExpTrade] = useState(null);
  const [editTId, setEditTId] = useState(null);
  const [editTP, setEditTP] = useState("");
  const [editSL, setEditSL] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const [expClosed, setExpClosed] = useState(null);
  const [showAcct, setShowAcct] = useState(false);
  const [editBal, setEditBal] = useState(false);
  const [balText, setBalText] = useState("5000");
  const [showSettings, setShowSettings] = useState(false);
  const [previewSig, setPreviewSig] = useState(null);

  const wsRef = useRef(null), klRef = useRef({}), rcRef = useRef(null);
  const fees = FEE_TIERS[feeIdx];

  // Persistence
  useEffect(() => { (async () => { try { const r = await sGet("pts"); if (r) { const s = JSON.parse(r); if (s.bal != null) setBal(s.bal); if (s.ot) setOpenT(s.ot); if (s.ct) setClosedT(s.ct); if (s.ft != null) setFeeIdx(s.ft); if (s.rl != null) setRisk(s.rl); if (s.am) setAmounts(s.am); } } catch {} setLoaded(true); })(); }, []);
  useEffect(() => { if (!loaded) return; sSet("pts", JSON.stringify({ bal, ot: openT.map(t => ({ ...t, priceHistory: (t.priceHistory || []).slice(-50) })), ct: closedT.slice(-100).map(t => ({ ...t, chartSnapshot: (t.chartSnapshot || []).slice(-60) })), ft: feeIdx, rl: risk, am: amounts })); }, [bal, openT, closedT, feeIdx, risk, amounts, loaded]);

  useEffect(() => { if (!openT.length) return; setOpenT(p => p.map(t => { const cp = merged[t.coinId]?.price; if (!cp) return t; const h = t.priceHistory || []; if (!h.length || Date.now() - h[h.length - 1].t > 5000) return { ...t, priceHistory: [...h, { p: cp, t: Date.now() }].slice(-200) }; return t; })); }, [wsTick, merged]);
  useEffect(() => { if (!openT.length) return; openT.forEach(t => { const cp = merged[t.coinId]?.price; if (!cp) return; if (cp >= t.targetPrice) closeTrade(t.id, "Target ✅"); else if (cp <= t.stopPrice) closeTrade(t.id, "Stop ❌"); }); }, [merged, wsTick]);

  function enterTrade(sig, amt) {
    const ep = (sig.entryLow + sig.entryHigh) / 2, tp = (sig.targetLow + sig.targetHigh) / 2;
    const fee = amt * (fees.taker / 100), cost = amt + fee;
    if (cost > bal) { notify("Insufficient balance", T.red); return; }
    const id = Date.now(), now = new Date();
    const ts = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + now.toLocaleTimeString();
    setBal(b => b - cost);
    setOpenT(p => [...p, { id, symbol: sig.symbol, coinId: sig.coinId, type: sig.type, entryPrice: ep, targetPrice: tp, stopPrice: sig.stop, coins: amt / ep, investAmt: amt, entryFee: fee, enteredAt: ts, enteredMs: now.getTime(), priceHistory: [{ p: ep, t: Date.now() }], riskLabel: RISK_PROFILES[risk].label, rr: sig.rr }]);
    notify(`Opened ${sig.symbol} $${amt}`, T.green);
    setPreviewSig(null);
  }

  function closeTrade(id, reason) {
    setOpenT(p => { const t = p.find(x => x.id === id); if (!t) return p;
      const cp = merged[t.coinId]?.price || t.entryPrice, gv = t.coins * cp, xf = gv * (fees.maker / 100), net = gv - xf, pnl = net - t.investAmt - t.entryFee, pp = (pnl / t.investAmt) * 100;
      const now = new Date(), ts = now.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + now.toLocaleTimeString();
      const dMs = t.enteredMs ? now.getTime() - t.enteredMs : 0;
      const dur = dMs < 60000 ? `${Math.round(dMs / 1000)}s` : dMs < 3600000 ? `${Math.floor(dMs / 60000)}m` : `${Math.floor(dMs / 3600000)}h ${Math.floor((dMs % 3600000) / 60000)}m`;
      setBal(b => b + net);
      setClosedT(c => [...c, { ...t, exitPrice: cp, exitFee: xf, pnl, pnlPct: pp, reason: reason || "Manual", closedAt: ts, duration: dur, chartSnapshot: (t.priceHistory || []).slice(-100) }]);
      notify(`${t.symbol} ${reason || "Closed"} ${pnl >= 0 ? "+" : ""}$${fmt(pnl)}`, pnl >= 0 ? T.green : T.red);
      if (expTrade === id) setExpTrade(null);
      return p.filter(x => x.id !== id);
    });
  }

  function modTrade(id) {
    setOpenT(p => p.map(t => { if (t.id !== id) return t; const u = { ...t }; const tp = parseFloat(editTP), sl = parseFloat(editSL); if (!isNaN(tp) && tp > t.entryPrice) u.targetPrice = tp; if (!isNaN(sl) && sl < t.entryPrice) u.stopPrice = sl; return u; }));
    setEditTId(null); notify("TP/SL updated", T.accent);
  }

  function notify(msg, color) { setNotif({ msg, color }); setTimeout(() => setNotif(null), 2500); }
  function saveAmts() { const p = amtText.split(",").map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0); if (p.length) { setAmounts(p); setEditAmts(false); } }

  const openPnl = useMemo(() => openT.reduce((s, t) => { const cp = merged[t.coinId]?.price || t.entryPrice; return s + (t.coins * cp * (1 - fees.maker / 100) - t.investAmt - t.entryFee); }, 0), [openT, merged, fees]);
  const closedPnl = useMemo(() => closedT.reduce((s, t) => s + t.pnl, 0), [closedT]);
  const wins = useMemo(() => closedT.filter(t => t.pnl > 0).length, [closedT]);
  const equity = bal + openT.reduce((s, t) => s + t.investAmt + t.entryFee, 0) + openPnl;

  const allSigs = useMemo(() =>
    COINS.flatMap(c => { const d = merged[c.id]; if (!d?.price) return []; return genSignals(c, d, analyzeOHLC(ohlc[c.id] || null), RISK_PROFILES[risk]); }).sort((a, b) => b.score - a.score),
    [merged, ohlc, risk]
  );
  const sigTypes = useMemo(() => ["all", ...new Set(allSigs.map(t => t.type.toLowerCase()))], [allSigs]);
  const filtSigs = sigFilter === "all" ? allSigs : allSigs.filter(t => t.type.toLowerCase() === sigFilter);

  const fgD = fg || { value: 62, label: "Greed" };
  const fgC = fgD.value > 55 ? T.green : fgD.value > 45 ? T.yellow : T.red;
  const liveSrc = Object.values(srcSt).filter(s => s === "live").length;
  const hasPrices = Object.values(merged).some(m => m.price != null);

  // WebSocket
  const connectWS = useCallback(() => {
    try {
      if (wsRef.current?.readyState < 2) return;
      const ws = new WebSocket("wss://ws.kraken.com"); wsRef.current = ws;
      ws.onopen = () => { setWsOn(true); setSrcSt(p => ({ ...p, ws: "live" })); ws.send(JSON.stringify({ event: "subscribe", pair: COINS.map(c => c.krakenWs), subscription: { name: "ticker" } })); };
      ws.onmessage = (e) => { try { const d = JSON.parse(e.data); if (Array.isArray(d) && d.length >= 4) { const tk = d[1], pn = d[3], co = COINS.find(c => c.krakenWs === pn); if (co && tk?.c) { const l = parseFloat(tk.c[0]), o = parseFloat(tk.o[0]); klRef.current = { ...klRef.current, [co.id]: { price: l, bid: parseFloat(tk.b[0]), ask: parseFloat(tk.a[0]), high: parseFloat(tk.h[1]), low: parseFloat(tk.l[1]), vol: parseFloat(tk.v[1]) * l, change: ((l - o) / o) * 100, spread: ((parseFloat(tk.a[0]) - parseFloat(tk.b[0])) / l) * 100, ts: Date.now() } }; setKlive({ ...klRef.current }); setWsTick(p => p + 1); } } } catch {} };
      ws.onclose = () => { setWsOn(false); setSrcSt(p => ({ ...p, ws: "error" })); rcRef.current = setTimeout(connectWS, 5000); };
      ws.onerror = () => setSrcSt(p => ({ ...p, ws: "error" }));
    } catch {}
  }, []);
  useEffect(() => { connectWS(); return () => { if (wsRef.current) wsRef.current.close(); if (rcRef.current) clearTimeout(rcRef.current); }; }, [connectWS]);

  const fetchOHLC = useCallback(async () => {
    const r = {}; let ok = 0;
    for (const coin of COINS) { try { const d = await safeFetch(`https://api.kraken.com/0/public/OHLC?pair=${coin.krakenOhlc}&interval=15`); if (d.result) { const k = Object.keys(d.result).find(x => x !== "last"); if (k) { r[coin.id] = d.result[k].slice(-100).map(c => [c[0], parseFloat(c[1]), parseFloat(c[2]), parseFloat(c[3]), parseFloat(c[4]), parseFloat(c[5]), parseFloat(c[6])]); ok++; } } await new Promise(r2 => setTimeout(r2, 300)); } catch {} }
    setOhlc(r); setSrcSt(p => ({ ...p, oh: ok > 0 ? "live" : "error" }));
  }, []);

  const fetchAll = useCallback(async () => {
    const pd = {}; COINS.forEach(c => { pd[c.id] = { prices: [], ch: [], hi: [], lo: [], vol: [], spark: null, sn: [] }; }); let any = false;
    COINS.forEach(c => { const k = klRef.current[c.id]; if (k && Date.now() - k.ts < 120000) { pd[c.id].prices.push(k.price); pd[c.id].ch.push(k.change); pd[c.id].hi.push(k.high); pd[c.id].lo.push(k.low); pd[c.id].vol.push(k.vol); pd[c.id].sn.push("WS"); any = true; } });
    try { const d = await safeFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS.map(c => c.id).join(",")}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`); d.forEach(c => { if (pd[c.id]) { pd[c.id].prices.push(c.current_price); if (c.price_change_percentage_24h != null) pd[c.id].ch.push(c.price_change_percentage_24h); if (c.high_24h) pd[c.id].hi.push(c.high_24h); if (c.total_volume) pd[c.id].vol.push(c.total_volume); if (c.sparkline_in_7d?.price) pd[c.id].spark = c.sparkline_in_7d.price.slice(-48); pd[c.id].sn.push("CG"); } }); setSrcSt(p => ({ ...p, cg: "live" })); any = true; } catch { setSrcSt(p => ({ ...p, cg: "error" })); }
    try { const d = await safeFetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(COINS.map(c => c.binance).filter(Boolean))}`); d.forEach(t => { const co = COINS.find(c => c.binance === t.symbol); if (co && pd[co.id]) { pd[co.id].prices.push(parseFloat(t.lastPrice)); pd[co.id].ch.push(parseFloat(t.priceChangePercent)); pd[co.id].sn.push("BN"); } }); setSrcSt(p => ({ ...p, bn: "live" })); any = true; } catch { setSrcSt(p => ({ ...p, bn: "error" })); }
    try { const d = await safeFetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${COINS.map(c => c.cc).join(",")}&tsyms=USD`); if (d.RAW) COINS.forEach(c => { const r2 = d.RAW[c.cc]?.USD; if (r2 && pd[c.id]) { pd[c.id].prices.push(r2.PRICE); if (r2.CHANGEPCT24HOUR != null) pd[c.id].ch.push(r2.CHANGEPCT24HOUR); pd[c.id].sn.push("CC"); } }); setSrcSt(p => ({ ...p, cc: "live" })); any = true; } catch { setSrcSt(p => ({ ...p, cc: "error" })); }
    try { const d = await safeFetch("https://api.alternative.me/fng/?limit=1"); if (d.data?.[0]) setFg({ value: parseInt(d.data[0].value), label: d.data[0].value_classification }); setSrcSt(p => ({ ...p, fg: "live" })); } catch { setSrcSt(p => ({ ...p, fg: "error" })); }
    try { const d = await safeFetch("https://api.coingecko.com/api/v3/global"); if (d.data) setGlobalD(d.data); } catch {}
    if (!any) { const m = {}; COINS.forEach(c => { const f = FALLBACK_PRICES[c.id]; if (f) m[c.id] = { price: f.price, change24h: f.change, sparkline: genSparkline(f.price, f.change), sourceCount: 0, sourceNames: ["FB"], bid: null, ask: null, spread: null }; }); setMerged(m); setFallback(true); return; }
    setFallback(false); const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const m = {}; COINS.forEach(c => { const p2 = pd[c.id], ap = avg(p2.prices), kl = klRef.current[c.id]; if (!ap) return; m[c.id] = { price: ap, change24h: avg(p2.ch), high24h: p2.hi.length ? Math.max(...p2.hi) : null, volume: avg(p2.vol), sparkline: p2.spark || genSparkline(ap, avg(p2.ch) || 0), sourceCount: p2.prices.length, sourceNames: [...new Set(p2.sn)], bid: kl?.bid || null, ask: kl?.ask || null, spread: kl?.spread || null }; }); setMerged(m);
  }, []);

  useEffect(() => { fetchAll(); fetchOHLC(); const i1 = setInterval(fetchAll, 60000), i2 = setInterval(fetchOHLC, 300000); return () => { clearInterval(i1); clearInterval(i2); }; }, []);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!Object.keys(klive).length) return; setMerged(p => { const n = { ...p }; COINS.forEach(c => { const k = klive[c.id]; if (k && n[c.id]) { n[c.id] = { ...n[c.id], bid: k.bid, ask: k.ask, spread: k.spread }; if (k.ts > (n[c.id]._t || 0)) { n[c.id].price = n[c.id].price ? n[c.id].price * 0.4 + k.price * 0.6 : k.price; n[c.id].change24h = k.change; n[c.id]._t = k.ts; } } }); return n; }); }, [wsTick]);

  // Touch-friendly sizing
  const tap = mob ? 40 : 32; // min tap target
  const pad = mob ? "10px" : tablet ? "14px" : "20px";
  const fs = { xs: mob ? 9 : 10, sm: mob ? 10 : 11, md: mob ? 12 : 13, lg: mob ? 14 : 16 };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: T.sans, WebkitTextSizeAdjust: "100%", paddingBottom: mob ? 56 : 0 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {notif && <div style={{ position: "fixed", top: mob ? 8 : 12, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: notif.color, color: "#fff", padding: mob ? "10px 18px" : "8px 22px", borderRadius: 8, fontSize: fs.md, fontWeight: 600, boxShadow: `0 6px 24px ${notif.color}50`, fontFamily: T.mono, maxWidth: "92vw" }}>{notif.msg}</div>}

      {/* ═══ TOP BAR ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `8px ${pad}`, borderBottom: `1px solid ${T.border}`, background: T.surface, position: mob ? "sticky" : "relative", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: mob ? 6 : 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: `linear-gradient(135deg, ${T.accent}, #b388ff)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>C</div>
            {!mob && <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.3 }}>CryptoTrader</span>}
          </div>
          <div style={{ display: "flex", gap: mob ? 8 : 14, alignItems: "center", marginLeft: mob ? 2 : 10, fontSize: fs.sm, fontFamily: T.mono }}>
            <div style={{ color: T.textSoft }}><span style={{ color: T.textDim, fontSize: fs.xs }}>BAL </span><span style={{ fontWeight: 600 }}>${bal.toFixed(0)}</span></div>
            <div><span style={{ color: T.textDim, fontSize: fs.xs }}>P&L </span><span style={{ fontWeight: 600, color: (openPnl + closedPnl) >= 0 ? T.green : T.red }}>{(openPnl + closedPnl) >= 0 ? "+" : ""}${fmt(openPnl + closedPnl)}</span></div>
            {openT.length > 0 && !mob && <div><span style={{ color: T.textDim, fontSize: fs.xs }}>OPEN </span><span style={{ fontWeight: 600, color: T.accent }}>{openT.length}</span></div>}
            <button onClick={() => setShowAcct(!showAcct)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 8px", minHeight: tap - 6, fontSize: fs.xs, color: T.textDim, cursor: "pointer" }}>{showAcct ? "−" : "⋯"}</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {wsOn && <div style={{ display: "flex", alignItems: "center", gap: 4, background: T.greenSoft, borderRadius: 5, padding: "3px 8px" }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, animation: "pulse 2s infinite" }} /><span style={{ fontSize: fs.xs, color: T.green, fontWeight: 600, fontFamily: T.mono }}>LIVE</span></div>}
          {!mob && <span style={{ fontSize: fs.xs, color: T.textDim, fontFamily: T.mono }}>{time.toLocaleTimeString()}</span>}
          <button onClick={() => { fetchAll(); fetchOHLC(); }} style={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 10px", minHeight: tap - 6, fontSize: fs.sm, color: T.textSoft, cursor: "pointer" }}>↻</button>
        </div>
      </div>

      {/* ═══ Expandable account drawer ═══ */}
      {showAcct && (
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: `10px ${pad}` }}>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(3, 1fr)" : tablet ? "repeat(3, 1fr)" : "repeat(5, 1fr)", gap: mob ? 8 : 12, marginBottom: 10 }}>
            {[
              { l: "CASH", v: editBal ? null : `$${bal.toFixed(2)}`, c: T.text },
              { l: "EQUITY", v: `$${equity.toFixed(2)}`, c: T.text },
              { l: "OPEN P&L", v: `${openPnl >= 0 ? "+" : ""}$${fmt(openPnl)}`, c: openPnl >= 0 ? T.green : T.red },
              { l: "REALIZED", v: `${closedPnl >= 0 ? "+" : ""}$${fmt(closedPnl)}`, c: closedPnl >= 0 ? T.green : T.red },
              { l: "WIN%", v: closedT.length > 0 ? `${((wins / closedT.length) * 100).toFixed(0)}% (${wins}/${closedT.length})` : "—", c: T.textSoft },
            ].map((s, i) => (
              <div key={i} style={{ background: T.bg, borderRadius: 6, padding: mob ? "8px" : "6px 10px" }}>
                <div style={{ fontSize: fs.xs, color: T.textDim, letterSpacing: 0.5, fontFamily: T.mono, marginBottom: 2 }}>{s.l}</div>
                {s.l === "CASH" && editBal ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input value={balText} onChange={e => setBalText(e.target.value)} style={{ background: T.surfaceRaised, border: `1px solid ${T.accent}`, borderRadius: 4, padding: "4px 6px", fontSize: fs.md, color: T.text, width: 70, outline: "none", fontFamily: T.mono }} />
                    <button onClick={() => { const v = parseFloat(balText); if (!isNaN(v) && v >= 0) { setBal(v); setEditBal(false); } }} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: fs.xs, cursor: "pointer", minHeight: tap - 8 }}>✓</button>
                  </div>
                ) : <div style={{ fontWeight: 600, color: s.c, cursor: s.l === "CASH" ? "pointer" : "default", fontSize: fs.md, fontFamily: T.mono }} onClick={() => { if (s.l === "CASH") { setBalText(bal.toFixed(0)); setEditBal(true); } }}>{s.v}</div>}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
            <button onClick={() => setShowSettings(!showSettings)} style={{ background: T.surfaceRaised, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 12px", fontSize: fs.xs, color: T.textSoft, cursor: "pointer", minHeight: tap - 4 }}>⚙ Settings</button>
            <button onClick={() => { setBal(5000); setOpenT([]); setClosedT([]); sDel("pts"); }} style={{ background: T.redSoft, border: `1px solid ${T.red}30`, borderRadius: 5, padding: "6px 12px", fontSize: fs.xs, color: T.red, cursor: "pointer", minHeight: tap - 4 }}>Reset</button>
          </div>

          {showSettings && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, marginTop: 8, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", gap: 4 }}>
                {RISK_PROFILES.map((rp, i) => (
                  <button key={i} onClick={() => setRisk(i)} style={{ background: risk === i ? `${rp.color}15` : "transparent", border: `1px solid ${risk === i ? rp.color : T.border}`, borderRadius: 6, padding: mob ? "8px 14px" : "6px 12px", cursor: "pointer", fontSize: fs.sm, fontWeight: 600, color: risk === i ? rp.color : T.textSoft, minHeight: tap }}>{rp.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: fs.xs, color: T.textDim, fontFamily: T.mono }}>FEE</span>
                <select value={feeIdx} onChange={e => setFeeIdx(parseInt(e.target.value))} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "6px 8px", fontSize: fs.sm, color: T.textSoft, fontFamily: T.mono, outline: "none", minHeight: tap }}>
                  {FEE_TIERS.map((t2, i) => <option key={i} value={i}>{t2.label} ({t2.maker}%/{t2.taker}%)</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {Object.entries(srcSt).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: v === "live" ? T.green : v === "error" ? T.red : T.yellow }} />
                    <span style={{ fontSize: fs.xs, color: T.textDim, fontFamily: T.mono }}>{k.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {openT.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: fs.xs, color: T.textDim, fontFamily: T.mono, marginBottom: 6 }}>OPEN POSITIONS</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {openT.map(t => {
                  const cp = merged[t.coinId]?.price || t.entryPrice;
                  const pnl = t.coins * cp * (1 - fees.maker / 100) - t.investAmt - t.entryFee;
                  return (
                    <div key={t.id} style={{ background: T.bg, borderRadius: 6, padding: mob ? "6px 10px" : "5px 8px", display: "flex", alignItems: "center", gap: 8, border: `1px solid ${pnl >= 0 ? T.green : T.red}15`, fontSize: fs.sm, fontFamily: T.mono }}>
                      <span style={{ fontWeight: 700, color: T.text }}>{t.symbol}</span>
                      <span style={{ color: T.textDim }}>${t.investAmt}</span>
                      <span style={{ fontWeight: 600, color: pnl >= 0 ? T.green : T.red }}>{pnl >= 0 ? "+" : ""}${fmt(pnl)}</span>
                      <button onClick={() => closeTrade(t.id, "Manual")} style={{ background: T.redSoft, border: "none", borderRadius: 4, padding: "4px 8px", fontSize: fs.xs, color: T.red, cursor: "pointer", minHeight: tap - 10 }}>×</button>
                      <button onClick={() => { setEditTId(editTId === t.id ? null : t.id); setEditTP(t.targetPrice.toString()); setEditSL(t.stopPrice.toString()); }} style={{ background: T.accentSoft, border: "none", borderRadius: 4, padding: "4px 8px", fontSize: fs.xs, color: T.accent, cursor: "pointer", minHeight: tap - 10 }}>✎</button>
                    </div>
                  );
                })}
              </div>
              {editTId && openT.find(t => t.id === editTId) && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div><div style={{ fontSize: fs.xs, color: T.green, fontFamily: T.mono, marginBottom: 2 }}>TP</div><input value={editTP} onChange={e => setEditTP(e.target.value)} style={{ background: T.bg, border: `1px solid ${T.green}40`, borderRadius: 5, padding: "6px 8px", fontSize: fs.md, color: T.green, width: mob ? 100 : 90, outline: "none", fontFamily: T.mono }} /></div>
                  <div><div style={{ fontSize: fs.xs, color: T.red, fontFamily: T.mono, marginBottom: 2 }}>SL</div><input value={editSL} onChange={e => setEditSL(e.target.value)} style={{ background: T.bg, border: `1px solid ${T.red}40`, borderRadius: 5, padding: "6px 8px", fontSize: fs.md, color: T.red, width: mob ? 100 : 90, outline: "none", fontFamily: T.mono }} /></div>
                  <button onClick={() => modTrade(editTId)} style={{ background: T.accent, color: "#fff", border: "none", borderRadius: 5, padding: "8px 16px", fontSize: fs.sm, fontWeight: 700, cursor: "pointer", minHeight: tap }}>Apply</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ NAV — top on desktop/tablet, bottom on mobile ═══ */}
      {loaded && !mob && (
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          {[{ key: "signals", label: `Signals (${allSigs.length})` }, { key: "log", label: `Log${closedT.length > 0 ? ` (${closedT.length})` : ""}` }].map(tab => (
            <button key={tab.key} onClick={() => setPage(tab.key)} style={{ flex: 1, padding: "10px 0", fontSize: fs.sm, fontWeight: 600, cursor: "pointer", border: "none", borderBottom: page === tab.key ? `2px solid ${T.accent}` : "2px solid transparent", background: "transparent", color: page === tab.key ? T.text : T.textDim, minHeight: tap }}>{tab.label}</button>
          ))}
        </div>
      )}

      {fallback && <div style={{ background: T.yellowSoft, borderBottom: `1px solid ${T.yellow}30`, padding: `6px ${pad}`, display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: fs.sm, color: T.yellow }}>⚠ Sample data</span><button onClick={fetchAll} style={{ background: T.yellow, color: "#000", border: "none", borderRadius: 5, padding: "4px 12px", fontSize: fs.sm, fontWeight: 600, cursor: "pointer", minHeight: tap - 4 }}>Retry</button></div>}

      <div style={{ padding: pad }}>
        {/* ═══ SIGNALS PAGE ═══ */}
        {loaded && page === "signals" && hasPrices && (
          <div style={{ display: compact ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: tablet ? "1fr 300px" : "1fr 360px", gap: compact ? 10 : 14 }}>

            {/* LEFT: Chart area */}
            <div style={{ position: mob ? "sticky" : "relative", top: mob ? 46 : "auto", zIndex: mob ? 10 : "auto", background: T.bg }}>
              {/* Market stats */}
              <div style={{ display: "flex", gap: mob ? 10 : 14, marginBottom: 8, fontSize: fs.sm, fontFamily: T.mono, flexWrap: "wrap" }}>
                <div><span style={{ color: T.textDim, fontSize: fs.xs }}>MKT </span><span style={{ fontWeight: 600 }}>${globalD ? (globalD.total_market_cap.usd / 1e12).toFixed(2) : "2.84"}T</span></div>
                <div><span style={{ color: T.textDim, fontSize: fs.xs }}>VOL </span><span style={{ fontWeight: 600 }}>${globalD ? (globalD.total_volume.usd / 1e9).toFixed(1) : "98.2"}B</span></div>
                <div><span style={{ color: T.textDim, fontSize: fs.xs }}>F&G </span><span style={{ fontWeight: 600, color: fgC }}>{fgD.value} {fgD.label}</span></div>
              </div>

              {/* Coin ticker — larger touch targets on mobile */}
              <div style={{ display: "flex", gap: mob ? 6 : 4, overflowX: "auto", marginBottom: 8, WebkitOverflowScrolling: "touch", paddingBottom: 4, msOverflowStyle: "none", scrollbarWidth: "none" }}>
                {COINS.map(c => {
                  const d = merged[c.id]; if (!d?.price) return null;
                  const ch = d.change24h || 0, chC = ch >= 0 ? T.green : T.red;
                  const sel = selCoin.id === c.id;
                  const hasSig = allSigs.some(s => s.coinId === c.id);
                  return (
                    <button key={c.id} onClick={() => { setSelCoin(c); setPreviewSig(null); }} style={{
                      background: sel ? T.surfaceRaised : "transparent",
                      border: `1.5px solid ${sel ? T.accent : T.border}`, borderRadius: 8,
                      padding: mob ? "8px 12px" : "5px 10px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                      minWidth: 0, whiteSpace: "nowrap", flexShrink: 0,
                      minHeight: tap,
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
                      <span style={{ fontSize: fs.sm, fontWeight: 600, color: sel ? T.text : T.textSoft }}>{c.symbol}</span>
                      <span style={{ fontSize: fs.xs, color: chC, fontFamily: T.mono, fontWeight: 600 }}>{ch >= 0 ? "+" : ""}{ch.toFixed(1)}%</span>
                      {hasSig && <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.yellow }} />}
                    </button>
                  );
                })}
              </div>

              {/* OHLC Chart — fluid width via containerRef */}
              <OHLCChart candles={ohlc[selCoin.id]} coin={selCoin} currentPrice={merged[selCoin.id]?.price} previewSignal={previewSig} openPositions={openT} isMobile={mob} tradeAmounts={amounts} balance={bal} fees={fees} onEnterTrade={enterTrade} />
            </div>

            {/* RIGHT: Signal list */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: fs.lg, fontWeight: 700 }}>Signals</span>
                  <span style={{ fontSize: fs.xs, padding: "2px 6px", borderRadius: 4, background: T.yellowSoft, color: T.yellow, fontWeight: 700, fontFamily: T.mono }}>BETA</span>
                </div>
                {editAmts ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <input value={amtText} onChange={e => setAmtText(e.target.value)} style={{ background: T.bg, border: `1px solid ${T.accent}`, borderRadius: 5, padding: "4px 8px", fontSize: fs.sm, color: T.text, width: 90, outline: "none", fontFamily: T.mono }} />
                    <button onClick={saveAmts} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: fs.xs, cursor: "pointer", minHeight: tap - 8 }}>✓</button>
                    <button onClick={() => setEditAmts(false)} style={{ background: T.surfaceRaised, color: T.textSoft, border: "none", borderRadius: 4, padding: "4px 8px", fontSize: fs.xs, cursor: "pointer", minHeight: tap - 8 }}>×</button>
                  </div>
                ) : <button onClick={() => { setAmtText(amounts.join(", ")); setEditAmts(true); }} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 5, padding: "4px 10px", fontSize: fs.xs, color: T.textDim, cursor: "pointer", fontFamily: T.mono, minHeight: tap - 6 }}>✎ ${amounts.join("/$")}</button>}
              </div>

              {/* Signal type filter — scrollable, larger taps */}
              <div style={{ display: "flex", gap: mob ? 6 : 4, overflowX: "auto", marginBottom: 10, WebkitOverflowScrolling: "touch", paddingBottom: 2 }}>
                {sigTypes.map(tp => (
                  <button key={tp} onClick={() => setSigFilter(tp)} style={{
                    background: sigFilter === tp ? T.accent : "transparent",
                    color: sigFilter === tp ? "#fff" : T.textDim,
                    border: `1px solid ${sigFilter === tp ? T.accent : T.border}`,
                    borderRadius: 6, padding: mob ? "8px 14px" : "5px 12px",
                    fontSize: fs.sm, fontWeight: 600, cursor: "pointer",
                    textTransform: "capitalize", whiteSpace: "nowrap",
                    minHeight: tap - 4,
                  }}>{tp}</button>
                ))}
              </div>

              {/* Signal cards */}
              <div style={{ maxHeight: compact ? "none" : "calc(100vh - 230px)", overflowY: compact ? "visible" : "auto", display: "flex", flexDirection: "column", gap: mob ? 8 : 6, paddingRight: compact ? 0 : 2 }}>
                {filtSigs.map((sig, i) => (
                  <SignalCard key={i} sig={sig} i={i} isPreview={previewSig === sig}
                    onPreview={() => { setSelCoin(COINS.find(c => c.id === sig.coinId) || selCoin); setPreviewSig(previewSig === sig ? null : sig); }}
                    amounts={amounts} bal={bal} fees={fees} onTrade={enterTrade} mob={mob} />
                ))}
              </div>
            </div>
          </div>
        )}

        {loaded && page === "signals" && !hasPrices && <div style={{ textAlign: "center", padding: 60 }}><div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>◌</div><div style={{ fontSize: fs.lg, fontWeight: 600 }}>Connecting to markets...</div></div>}

        {/* ═══ TRADE LOG ═══ */}
        {loaded && page === "log" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(3, 1fr)" : tablet ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: mob ? 6 : 8, marginBottom: 14 }}>
              {[
                { l: "TRADES", v: closedT.length, c: T.text }, { l: "WINS", v: wins, c: T.green },
                { l: "LOSSES", v: closedT.length - wins, c: T.red },
                { l: "WIN%", v: closedT.length > 0 ? `${((wins / closedT.length) * 100).toFixed(0)}%` : "—", c: T.yellow },
                { l: "TOTAL", v: `${closedPnl >= 0 ? "+" : ""}$${fmt(closedPnl)}`, c: closedPnl >= 0 ? T.green : T.red },
                { l: "AVG", v: closedT.length > 0 ? `${(closedPnl / closedT.length) >= 0 ? "+" : ""}$${fmt(closedPnl / closedT.length)}` : "—", c: closedPnl >= 0 ? T.green : T.red },
              ].map((s, i) => (
                <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: mob ? "10px" : "8px 10px" }}>
                  <div style={{ fontSize: fs.xs, color: T.textDim, fontFamily: T.mono, letterSpacing: 0.5 }}>{s.l}</div>
                  <div style={{ fontSize: mob ? 16 : 18, fontWeight: 700, color: s.c, fontFamily: T.mono }}>{s.v}</div>
                </div>
              ))}
            </div>
            <EquityCurve closedTrades={closedT} isMobile={compact} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: fs.md, fontWeight: 600 }}>History</span>
              <div style={{ display: "flex", gap: 4 }}>
                {["all", "wins", "losses"].map(f => (
                  <button key={f} onClick={() => setLogFilter(f)} style={{ background: logFilter === f ? T.accent : "transparent", color: logFilter === f ? "#fff" : T.textDim, border: `1px solid ${logFilter === f ? T.accent : T.border}`, borderRadius: 6, padding: mob ? "8px 14px" : "5px 12px", fontSize: fs.sm, fontWeight: 600, cursor: "pointer", textTransform: "capitalize", minHeight: tap }}>{f}</button>
                ))}
              </div>
            </div>
            {closedT.length === 0 && <div style={{ textAlign: "center", padding: 50, color: T.textDim, fontSize: fs.md }}>No trades yet</div>}
            {closedT.slice().reverse().filter(t => logFilter === "wins" ? t.pnl > 0 : logFilter === "losses" ? t.pnl <= 0 : true).map((trade, i) => {
              const w = trade.pnl > 0, isExp = expClosed === i, col = w ? T.green : T.red;
              return (
                <div key={i} style={{ background: T.surface, border: `1px solid ${col}12`, borderRadius: 10, padding: mob ? "12px" : "12px 14px", marginBottom: 8, cursor: "pointer" }} onClick={() => setExpClosed(isExp ? null : i)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: fs.lg, fontWeight: 700 }}>{trade.symbol}</span>
                        <span style={{ fontSize: fs.xs, padding: "2px 6px", borderRadius: 5, background: `${col}15`, color: col, fontWeight: 600 }}>{trade.type}</span>
                        <span style={{ fontSize: fs.xs, padding: "2px 6px", borderRadius: 5, background: `${col}10`, color: col, fontWeight: 700 }}>{trade.reason}</span>
                      </div>
                      <div style={{ fontSize: fs.xs, color: T.textDim, fontFamily: T.mono }}>{trade.rr && `R/R:${trade.rr} · `}{trade.duration}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: mob ? 16 : 18, fontWeight: 700, color: col, fontFamily: T.mono }}>{trade.pnl >= 0 ? "+" : ""}${fmt(trade.pnl)}</div>
                      <div style={{ fontSize: fs.sm, color: col, fontFamily: T.mono }}>{trade.pnlPct >= 0 ? "+" : ""}{trade.pnlPct.toFixed(1)}%</div>
                    </div>
                  </div>
                  {isExp && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
                        {[{ l: "INVESTED", v: `$${trade.investAmt}` }, { l: "ENTRY→EXIT", v: `$${fmt(trade.entryPrice)}→$${fmt(trade.exitPrice)}` }, { l: "FEES", v: `$${fmt(trade.entryFee + (trade.exitFee || 0))}`, c: T.yellow }, { l: "COINS", v: fmt(trade.coins) }].map((s, j) => (
                          <div key={j} style={{ background: T.bg, borderRadius: 6, padding: "8px 10px" }}>
                            <div style={{ fontSize: fs.xs, color: T.textDim, fontFamily: T.mono }}>{s.l}</div>
                            <div style={{ fontSize: fs.md, fontWeight: 600, color: s.c || T.text, fontFamily: T.mono }}>{s.v}</div>
                          </div>
                        ))}
                      </div>
                      <ClosedChart trade={trade} isMobile={compact} />
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 14, fontSize: fs.xs, color: T.textDim, marginTop: isExp ? 8 : 3, fontFamily: T.mono }}><span>↓ {trade.enteredAt}</span><span>↑ {trade.closedAt}</span></div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div style={{ padding: `10px ${pad}`, borderTop: `1px solid ${T.border}`, marginTop: 20 }}>
        <p style={{ fontSize: fs.xs, color: T.textDim, margin: 0, lineHeight: 1.6 }}><strong style={{ color: T.textSoft }}>Disclaimer:</strong> Paper trading with simulated funds. Signals from Kraken OHLC analysis. Not financial advice. Crypto involves significant risk.</p>
      </div>

      {/* ═══ MOBILE BOTTOM NAV ═══ */}
      {loaded && mob && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          display: "flex", background: T.surface,
          borderTop: `1px solid ${T.border}`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {[
            { key: "signals", label: "Signals", count: allSigs.length },
            { key: "log", label: "Log", count: closedT.length },
          ].map(tab => (
            <button key={tab.key} onClick={() => setPage(tab.key)} style={{
              flex: 1, padding: "10px 0 8px", fontSize: 11, fontWeight: 600,
              cursor: "pointer", border: "none",
              borderTop: page === tab.key ? `2px solid ${T.accent}` : "2px solid transparent",
              background: "transparent",
              color: page === tab.key ? T.text : T.textDim,
              minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}>
              <span>{tab.label}</span>
              {tab.count > 0 && <span style={{ fontSize: 9, color: page === tab.key ? T.accent : T.textDim, fontFamily: T.mono }}>{tab.count}</span>}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        button{transition:opacity .12s;-webkit-tap-highlight-color:transparent}
        button:hover{opacity:.85}
        button:active{opacity:.7}
        input,select{font-family:${T.mono};-webkit-appearance:none}
        @supports(padding: env(safe-area-inset-bottom)){
          body{padding-bottom:env(safe-area-inset-bottom)}
        }
      `}</style>
    </div>
  );
}
