import React, { useEffect, useRef } from 'react';
import { useCockpit } from '@/lib/cockpitStore';

export default function TradingViewChart() {
  const { symbol } = useCockpit();
  const containerRef = useRef(null);

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
      symbol: symbol,
      interval: '5',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#070b12',
      gridColor: '#0d1320',
      allow_symbol_change: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      studies: ['STD;Volume'],
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="w-full h-full relative rounded overflow-hidden border border-terminal-border">
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full h-full"
      />
      {/* Fallback for when script can't load */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center text-slate-600 text-xs">
          <div className="text-2xl mb-2">📈</div>
          <div>TradingView Chart</div>
          <div className="text-[10px] text-slate-700 mt-1">{symbol} • 5m • Dark</div>
        </div>
      </div>
    </div>
  );
}
