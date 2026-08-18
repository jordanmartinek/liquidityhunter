import React, { useEffect, useRef } from 'react';
import { useCockpit } from '@/lib/cockpitStore';

// Map internal symbols to TradingView-compatible symbols
const SYMBOL_MAP = {
  'NQ1!': 'PEPPERSTONE:NAS100',
  'MNQ1!': 'PEPPERSTONE:NAS100',
  'ES1!': 'PEPPERSTONE:US500',
  'MES1!': 'PEPPERSTONE:US500',
};

export default function TradingViewChart() {
  const { symbol } = useCockpit();
  const containerRef = useRef(null);

  const tvSymbol = SYMBOL_MAP[symbol] || 'PEPPERSTONE:NAS100';

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '5',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#070b12',
      gridColor: '#0d1320',
      allow_symbol_change: true,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      studies: ['STD;Volume'],
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);
  }, [tvSymbol]);

  return (
    <div className="w-full h-full relative rounded overflow-hidden border border-terminal-border">
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full h-full"
      />
    </div>
  );
}
