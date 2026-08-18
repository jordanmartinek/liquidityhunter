import React, { useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import { useCockpit } from '@/lib/cockpitStore';

// Generate simulated initial candle data (placeholder until live feed)
function generateInitialData(currentPrice) {
  const data = [];
  const now = Math.floor(Date.now() / 1000);
  const interval = 300; // 5-minute candles
  const numBars = 200;
  let price = currentPrice || 20000;

  for (let i = numBars; i >= 0; i--) {
    const time = now - i * interval;
    const volatility = price * 0.001;
    const open = price;
    const close = open + (Math.random() - 0.48) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    data.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });
    price = close;
  }
  return data;
}

function generateVolumeData(candleData) {
  return candleData.map((candle) => ({
    time: candle.time,
    value: Math.floor(Math.random() * 50000) + 5000,
    color: candle.close >= candle.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
  }));
}

export default function TradingViewChart() {
  const { symbol, levels, liquidity, currentPrice, updatePrice, setup } = useCockpit();
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const priceLinesRef = useRef([]);
  const resizeObserverRef = useRef(null);

  // Create chart on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#070b12' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
      },
      grid: {
        vertLines: { color: '#0d1320' },
        horzLines: { color: '#0d1320' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#334155', style: LineStyle.Dashed, width: 1 },
        horzLine: { color: '#334155', style: LineStyle.Dashed, width: 1 },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: true,
      handleScroll: true,
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
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

    // Generate initial data
    const basePrice = currentPrice > 0 ? currentPrice : 20000;
    const candles = generateInitialData(basePrice);
    const volumes = generateVolumeData(candles);

    candleSeries.setData(candles);
    volumeSeries.setData(volumes);

    // Set last price in store if not already set
    if (currentPrice === 0 && candles.length > 0) {
      updatePrice(candles[candles.length - 1].close);
    }

    // Crosshair move — update price display
    chart.subscribeCrosshairMove((param) => {
      if (param.seriesData && param.seriesData.get(candleSeries)) {
        // Could use for hover price display
      }
    });

    // Resize observer
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserverRef.current.observe(containerRef.current);

    // Simulate live updates
    let lastCandle = candles[candles.length - 1];
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const volatility = lastCandle.close * 0.0003;
      const change = (Math.random() - 0.48) * volatility;
      const newClose = parseFloat((lastCandle.close + change).toFixed(2));
      const newHigh = parseFloat(Math.max(lastCandle.high, newClose + Math.random() * volatility * 0.3).toFixed(2));
      const newLow = parseFloat(Math.min(lastCandle.low, newClose - Math.random() * volatility * 0.3).toFixed(2));

      // Check if we need a new candle (every 5 minutes)
      const candleTime = Math.floor(now / 300) * 300;
      if (candleTime > lastCandle.time) {
        lastCandle = {
          time: candleTime,
          open: newClose,
          high: newClose,
          low: newClose,
          close: newClose,
        };
        volumeSeries.update({
          time: candleTime,
          value: Math.floor(Math.random() * 50000) + 5000,
          color: 'rgba(34,197,94,0.3)',
        });
      } else {
        lastCandle = {
          ...lastCandle,
          high: newHigh,
          low: newLow,
          close: newClose,
        };
      }

      candleSeries.update(lastCandle);
      volumeSeries.update({
        time: lastCandle.time,
        value: Math.floor(Math.random() * 50000) + 5000,
        color: newClose >= lastCandle.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol]);

  // Draw levels and liquidity zones as price lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Remove old price lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current.removePriceLine(line);
      } catch (e) {
        // line may already be removed
      }
    });
    priceLinesRef.current = [];

    // Draw market levels
    levels.forEach((level) => {
      const color = level.direction === 'support' ? '#22c55e' :
                    level.direction === 'resistance' ? '#ef4444' : '#64748b';
      const line = candleSeriesRef.current.createPriceLine({
        price: level.price,
        color,
        lineWidth: level.strength >= 4 ? 2 : 1,
        lineStyle: level.strength >= 3 ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${level.name || level.type} (${level.timeframe})`,
      });
      priceLinesRef.current.push(line);

      // Draw zone width if present
      if (level.zone_width > 0) {
        const upperLine = candleSeriesRef.current.createPriceLine({
          price: level.price + level.zone_width,
          color: color + '60',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '',
        });
        const lowerLine = candleSeriesRef.current.createPriceLine({
          price: level.price - level.zone_width,
          color: color + '60',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '',
        });
        priceLinesRef.current.push(upperLine, lowerLine);
      }
    });

    // Draw liquidity zones
    liquidity.forEach((zone) => {
      const color = zone.type.includes('Buy') || zone.type.includes('High')
        ? '#06b6d4' : '#f97316';

      const upperLine = candleSeriesRef.current.createPriceLine({
        price: zone.upper,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: `${zone.name || zone.type} ↑`,
      });
      const lowerLine = candleSeriesRef.current.createPriceLine({
        price: zone.lower,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: false,
        title: `${zone.name || zone.type} ↓`,
      });
      priceLinesRef.current.push(upperLine, lowerLine);
    });

    // Draw Fibonacci levels if setup has swing points
    if (setup.swing_high > 0 && setup.swing_low > 0) {
      const range = setup.swing_high - setup.swing_low;
      const fibs = setup.direction === 'Long'
        ? [
            { level: 0.705, price: setup.swing_high - range * 0.705, color: '#eab308' },
            { level: 0.786, price: setup.swing_high - range * 0.786, color: '#f97316' },
            { level: 0.886, price: setup.swing_high - range * 0.886, color: '#ef4444' },
          ]
        : [
            { level: 0.705, price: setup.swing_low + range * 0.705, color: '#eab308' },
            { level: 0.786, price: setup.swing_low + range * 0.786, color: '#f97316' },
            { level: 0.886, price: setup.swing_low + range * 0.886, color: '#ef4444' },
          ];

      fibs.forEach((fib) => {
        const line = candleSeriesRef.current.createPriceLine({
          price: parseFloat(fib.price.toFixed(2)),
          color: fib.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `${fib.level}`,
        });
        priceLinesRef.current.push(line);
      });
    }
  }, [levels, liquidity, setup.swing_high, setup.swing_low, setup.direction]);

  return (
    <div className="w-full h-full relative rounded overflow-hidden border border-terminal-border">
      <div ref={containerRef} className="w-full h-full" />
      {/* Symbol badge */}
      <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
        <span className="text-xs font-bold text-slate-400 bg-terminal-bg/80 px-2 py-0.5 rounded border border-terminal-border">
          {symbol} • 5m
        </span>
      </div>
    </div>
  );
}
