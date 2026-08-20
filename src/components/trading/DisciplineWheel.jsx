import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

function getSegmentColor(index, total) {
  const ratio = index / Math.max(1, total - 1);
  if (ratio <= 0.2) return '#ef4444';
  if (ratio <= 0.4) return '#f97316';
  if (ratio <= 0.6) return '#eab308';
  if (ratio <= 0.8) return '#22c55e';
  return '#2dd4bf';
}

export default function DisciplineWheel({ rules = [], executionScore = 0, trades = [], maxTrades = 3, liquidityTarget = null }) {
  const entryRules = rules.filter(r => r.category === 'entry');
  const totalRules = entryRules.length;
  const checkedCount = entryRules.filter(r => r.enabled).length;
  const isTrapped = executionScore >= 80;

  const size = 240;
  const center = size / 2;
  const outerRadius = 100;
  const innerRadius = 60;
  const gap = 0.06;

  const glowColor = useMemo(() => {
    if (executionScore >= 80) return { r: 45, g: 212, b: 191 };
    if (executionScore >= 60) return { r: 34, g: 197, b: 94 };
    if (executionScore >= 40) return { r: 234, g: 179, b: 8 };
    return { r: 239, g: 68, b: 68 };
  }, [executionScore]);
  const glowRgb = `${glowColor.r}, ${glowColor.g}, ${glowColor.b}`;

  const segments = useMemo(() => {
    if (totalRules === 0) return [];
    const anglePerSegment = (2 * Math.PI) / totalRules;
    return entryRules.map((rule, i) => {
      const startAngle = i * anglePerSegment - Math.PI / 2 + gap / 2;
      const endAngle = (i + 1) * anglePerSegment - Math.PI / 2 - gap / 2;
      const x1O = center + outerRadius * Math.cos(startAngle);
      const y1O = center + outerRadius * Math.sin(startAngle);
      const x2O = center + outerRadius * Math.cos(endAngle);
      const y2O = center + outerRadius * Math.sin(endAngle);
      const x1I = center + innerRadius * Math.cos(endAngle);
      const y1I = center + innerRadius * Math.sin(endAngle);
      const x2I = center + innerRadius * Math.cos(startAngle);
      const y2I = center + innerRadius * Math.sin(startAngle);
      const largeArc = anglePerSegment - gap > Math.PI ? 1 : 0;
      const path = `M ${x1O} ${y1O} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2O} ${y2O} L ${x1I} ${y1I} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x2I} ${y2I} Z`;
      const midAngle = (startAngle + endAngle) / 2;
      const labelRadius = (outerRadius + innerRadius) / 2;
      const labelX = center + labelRadius * Math.cos(midAngle);
      const labelY = center + labelRadius * Math.sin(midAngle);
      return { path, rule, labelX, labelY, color: getSegmentColor(i, totalRules) };
    });
  }, [entryRules, totalRules]);

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative">
        <div className="absolute rounded-full" style={{
          width: size + 40, height: size + 40, top: -20, left: -20,
          background: `radial-gradient(circle, rgba(${glowRgb}, ${0.05 + (executionScore / 100) * 0.3}) 0%, transparent 70%)`,
          boxShadow: `0 0 ${20 + (executionScore / 100) * 60}px rgba(${glowRgb}, ${0.1 + (executionScore / 100) * 0.4})`,
          transition: 'all 0.6s ease',
        }} />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative z-10">
          {liquidityTarget && (
            <circle cx={center} cy={center} r={outerRadius + 6} fill="none"
              stroke={liquidityTarget === 'bsl' ? '#10b981' : liquidityTarget === 'ssl' ? '#ef4444' : '#f59e0b'}
              strokeWidth={2} strokeDasharray="5 3" opacity={0.5} />
          )}
          {segments.map(({ path, rule, labelX, labelY, color }) => (
            <g key={rule.id}>
              <path d={path}
                fill={rule.enabled ? color : 'rgba(39, 39, 42, 0.3)'}
                stroke={rule.enabled ? color : '#27272a'}
                strokeWidth={rule.enabled ? 1.5 : 0.5}
                opacity={rule.enabled ? 0.9 : 0.35}
                filter={rule.enabled ? `drop-shadow(0 0 4px ${color})` : 'none'}
                className="transition-all duration-300"
              />
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central"
                fill={rule.enabled ? '#fff' : '#52525b'} fontSize={totalRules > 6 ? '7' : '8'}
                className="select-none pointer-events-none">
                {rule.title.slice(0, 4).toUpperCase()}
              </text>
            </g>
          ))}
          <circle cx={center} cy={center} r={innerRadius - 5}
            fill="rgba(9, 9, 11, 0.9)"
            stroke={`rgba(${glowRgb}, ${0.2 + (executionScore / 100) * 0.5})`}
            strokeWidth={1.5} />
          {isTrapped ? (
            <>
              <text x={center} y={center - 6} textAnchor="middle" fill="#2dd4bf" fontSize="9" fontWeight="700" className="select-none uppercase">Traders</text>
              <text x={center} y={center + 7} textAnchor="middle" fill="#2dd4bf" fontSize="9" fontWeight="700" className="select-none uppercase">Trapped</text>
              <text x={center} y={center + 22} textAnchor="middle" fill="#2dd4bf" fontSize="10" className="select-none tabular-nums">{executionScore}%</text>
            </>
          ) : (
            <>
              <text x={center} y={center - 2} textAnchor="middle" fill="#fafafa" fontSize="20" fontWeight="bold" className="select-none tabular-nums">{checkedCount}/{totalRules}</text>
              <text x={center} y={center + 16} textAnchor="middle" fill={`rgb(${glowRgb})`} fontSize="10" className="select-none">{executionScore}%</text>
            </>
          )}
        </svg>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[10px] text-zinc-500">Trades:</span>
        <span className="text-xs font-mono tabular-nums text-zinc-300">{trades.length}/{maxTrades}</span>
      </div>
    </div>
  );
}
