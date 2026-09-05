import React, { useEffect, useRef } from 'react';
import { useResearch } from '@/lib/researchStore';
import { TV_SYMBOL_MAP } from '@/lib/constants';

export default function TradingViewChart({ overlay = false, opacity = 1, interactive = false }) {
  const { symbol } = useResearch();
  const containerRef = useRef(null);
  const widgetId = useRef(`tv_chart_${Date.now()}`);

  const tvSymbol = TV_SYMBOL_MAP[symbol] || 'PEPPERSTONE:NAS100';

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    // Create a container div for the widget
    const widgetDiv = document.createElement('div');
    widgetDiv.id = widgetId.current;
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      if (window.TradingView) {
        new window.TradingView.widget({
          container_id: widgetId.current,
          autosize: true,
          symbol: tvSymbol,
          interval: '15',
          timezone: 'America/Lima',
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#070b12',
          enable_publishing: false,
          allow_symbol_change: !overlay || interactive,
          save_image: false,
          // In interactive overlay mode show TradingView's own toolbars so the
          // user can change timeframe / zoom via the widget's native UI (the
          // iframe is cross-origin, so we can't drive it programmatically).
          hide_side_toolbar: overlay && !interactive,
          hide_top_toolbar: overlay && !interactive,
          hide_legend: overlay && !interactive,
          withdateranges: !overlay || interactive,
          drawings_access: { type: 'all' },
          studies: [],
          overrides: {
            'paneProperties.background': '#070b12',
            'paneProperties.backgroundType': 'solid',
            'paneProperties.gridProperties.color': '#0d1320',
            'paneProperties.vertGridProperties.color': '#0d1320',
            'paneProperties.horzGridProperties.color': '#0d1320',
            'scalesProperties.backgroundColor': '#070b12',
            'scalesProperties.lineColor': '#1e293b',
            'scalesProperties.textColor': '#94a3b8',
          },
        });
      }
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [tvSymbol, overlay, interactive]);

  // When used as a subtle overlay on the ladder: no border and caller-controlled
  // opacity. Click-through by default so the ladder stays usable — UNLESS
  // interactive, in which case pointer events pass to the TradingView widget so
  // you can change timeframe / zoom on it directly.
  if (overlay) {
    return (
      <div
        className="w-full h-full"
        style={{ opacity, pointerEvents: interactive ? 'auto' : 'none' }}
      >
        <div ref={containerRef} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative rounded overflow-hidden border border-terminal-border">
      <div
        ref={containerRef}
        className="w-full h-full"
      />
    </div>
  );
}
