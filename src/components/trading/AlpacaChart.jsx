import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import { useResearch } from '@/lib/researchStore';
import { getStrengthConfig } from '@/lib/constants';

const ALPACA_WS_URL = 'wss://stream.data.alpaca.markets/v2/iex';
const ALPACA_REST_URL = 'https://data.alpaca.markets/v2/stocks';
const SYMBOL = 'QQQ';

// Get Alpaca credentials from localStorage
function getAlpacaKeys() {
  return {
    key: localStorage.getItem('lh_alpaca_key') || '',
    secret: localStorage.getItem('lh_alpaca_secret') || '',
  };
}

export function saveAlpacaKeys(key, secret) {
  localStorage.setItem('lh_alpaca_key', key);
  localStorage.setItem('lh_alpaca_secret', secret);
}

export function hasAlpacaKeys() {
  const { key, secret } = getAlpacaKeys();
  return key.length > 0 && secret.length > 0;
}

export default function AlpacaChart() {
  const { levels, lastPrice, updateLastPrice } = useResearch();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const wsRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [barCount, setBarCount] = useState(0);

  // Fetch historical bars on mount
  const fetchHistoricalBars = useCallback(async () => {
    const { key, secret } = getAlpacaKeys();
    if (!key || !secret) return [];

    try {
      const end = new Date().toISOString();
      const start = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days

      const url = `${ALPACA_REST_URL}/${SYMBOL}/bars?timeframe=5Min&start=${start}&end=${end}&limit=500&adjustment=raw&feed=iex`;
      const response = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': key,
          'APCA-API-SECRET-KEY': secret,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();
      const bars = (data.bars || []).map((bar) => ({
        time: Math.floor(new Date(bar.t).getTime() / 1000),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      }));

      return bars;
    } catch (e) {
      console.error('Failed to fetch historical bars:', e);
      setError(`Historical data: ${e.message}`);
      return [];
    }
  }, []);

  // Connect WebSocket for real-time bars
  const connectWebSocket = useCallback(() => {
    const { key, secret } = getAlpacaKeys();
    if (!key || !secret) {
      setError('No Alpaca API keys configured');
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(ALPACA_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate
      ws.send(JSON.stringify({
        action: 'auth',
        key: key,
        secret: secret,
      }));
    };

    ws.onmessage = (event) => {
      const messages = JSON.parse(event.data);

      for (const msg of messages) {
        if (msg.T === 'success' && msg.msg === 'authenticated') {
          setConnected(true);
          setError(null);
          // Subscribe to minute bars for QQQ
          ws.send(JSON.stringify({
            action: 'subscribe',
            bars: [SYMBOL],
          }));
        }

        if (msg.T === 'error') {
          setError(msg.msg || 'Authentication failed');
          setConnected(false);
        }

        // Bar update
        if (msg.T === 'b' && msg.S === SYMBOL) {
          const bar = {
            time: Math.floor(new Date(msg.t).getTime() / 1000),
            open: msg.o,
            high: msg.h,
            low: msg.l,
            close: msg.c,
          };

          if (candleSeriesRef.current) {
            candleSeriesRef.current.update(bar);
          }
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: bar.time,
              value: msg.v,
              color: bar.close >= bar.open ? 'rgba(45,212,191,0.3)' : 'rgba(239,68,68,0.3)',
            });
          }

          // Update last price in research store
          updateLastPrice(bar.close);
          setBarCount((prev) => prev + 1);
        }
      }
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          connectWebSocket();
        }
      }, 5000);
    };
  }, [updateLastPrice]);

  // Create chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#71717a',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: '#18181b' },
        horzLines: { color: '#18181b' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3f3f46', style: LineStyle.Dashed, width: 1 },
        horzLine: { color: '#3f3f46', style: LineStyle.Dashed, width: 1 },
      },
      rightPriceScale: {
        borderColor: '#27272a',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#27272a',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: true,
      handleScroll: true,
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#2dd4bf',
      downColor: '#ef4444',
      borderUpColor: '#2dd4bf',
      borderDownColor: '#ef4444',
      wickUpColor: '#2dd4bf',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    // Volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Resize observer
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    resizeObserverRef.current.observe(containerRef.current);

    // Load historical data then connect WebSocket
    fetchHistoricalBars().then((bars) => {
      if (bars.length > 0) {
        candleSeries.setData(bars);
        volumeSeries.setData(bars.map((b) => ({
          time: b.time,
          value: b.volume,
          color: b.close >= b.open ? 'rgba(45,212,191,0.3)' : 'rgba(239,68,68,0.3)',
        })));
        setBarCount(bars.length);
        // Set last price from most recent bar
        updateLastPrice(bars[bars.length - 1].close);
      }
      connectWebSocket();
    });

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Draw levels as price lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Remove old price lines
    priceLinesRef.current.forEach((line) => {
      try { candleSeriesRef.current.removePriceLine(line); } catch (e) {}
    });
    priceLinesRef.current = [];

    // Draw research levels
    levels.forEach((level) => {
      if (level.sweep_status === 'Swept') return; // Don't draw swept levels

      const strength = getStrengthConfig(level.strength);
      const isBSL = level.side === 'Buy-Side';
      const isTested = level.sweep_status === 'Tested';

      const line = candleSeriesRef.current.createPriceLine({
        price: level.price,
        color: strength.color,
        lineWidth: level.strength >= 4 ? 2 : 1,
        lineStyle: isTested ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: `${isBSL ? '▲' : '▼'} ${level.name || level.pool_type}`,
      });
      priceLinesRef.current.push(line);
    });
  }, [levels]);

  return (
    <div className="w-full h-full relative rounded overflow-hidden border border-zinc-800">
      <div ref={containerRef} className="w-full h-full" />

      {/* Status bar */}
      <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none z-10">
        <span className="text-[10px] font-bold text-zinc-400 bg-zinc-950/80 px-2 py-0.5 rounded border border-zinc-800">
          QQQ • 1m • Alpaca
        </span>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
        {connected && (
          <span className="text-[9px] text-emerald-400/70 bg-zinc-950/80 px-1.5 py-0.5 rounded">LIVE</span>
        )}
      </div>

      {/* Level count */}
      {levels.filter(l => l.sweep_status !== 'Swept').length > 0 && (
        <div className="absolute top-2 right-2 pointer-events-none z-10">
          <span className="text-[9px] text-teal-400/70 bg-zinc-950/80 px-1.5 py-0.5 rounded border border-teal-500/20">
            {levels.filter(l => l.sweep_status !== 'Swept').length} levels drawn
          </span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute bottom-2 left-2 right-2 z-10">
          <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
