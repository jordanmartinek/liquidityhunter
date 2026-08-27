import React, { useState, useEffect } from 'react';
import { useResearch } from '@/lib/researchStore';
import { alertZoneManager } from '@/lib/bangerFeatures';
import { ladderAudio } from '@/lib/ladderAudio';
import { cn } from '@/lib/utils';

/**
 * AlertZonesPanel — create/manage custom price alert zones
 */
export default function AlertZonesPanel() {
  const { lastPrice, isLive } = useResearch();
  const [zones, setZones] = useState(() => alertZoneManager.getZones());
  const [showForm, setShowForm] = useState(false);
  const [highPrice, setHighPrice] = useState('');
  const [lowPrice, setLowPrice] = useState('');
  const [label, setLabel] = useState('');
  const [triggered, setTriggered] = useState([]);

  // Check zones on price update
  useEffect(() => {
    if (!isLive || lastPrice <= 0) return;
    const newTriggers = alertZoneManager.checkPrice(lastPrice);
    if (newTriggers.length > 0) {
      setTriggered(prev => [...newTriggers.map(z => z.id), ...prev].slice(0, 5));
      ladderAudio.proximity(newTriggers[0].id); // Audio alert
    }
    setZones([...alertZoneManager.getZones()]);
  }, [lastPrice, isLive]);

  const handleAdd = () => {
    if (!highPrice || !lowPrice) return;
    alertZoneManager.addZone(parseFloat(highPrice), parseFloat(lowPrice), label);
    setZones([...alertZoneManager.getZones()]);
    setShowForm(false);
    setHighPrice('');
    setLowPrice('');
    setLabel('');
  };

  const handleRemove = (id) => {
    alertZoneManager.removeZone(id);
    setZones([...alertZoneManager.getZones()]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-medium text-amber-400">🔔 Alert Zones</span>
        <button onClick={() => setShowForm(!showForm)}
          className="text-[9px] text-slate-500 hover:text-amber-400 px-1.5 py-0.5 rounded border border-terminal-border hover:border-amber-500/30">
          {showForm ? '✕' : '+ Zone'}
        </button>
      </div>

      {showForm && (
        <div className="space-y-1.5 p-2 rounded border border-amber-500/20 bg-amber-500/5">
          <div className="flex gap-1">
            <input type="number" value={highPrice} onChange={e => setHighPrice(e.target.value)}
              placeholder="High price" className="flex-1 h-6 px-2 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none focus:border-amber-500/50" />
            <input type="number" value={lowPrice} onChange={e => setLowPrice(e.target.value)}
              placeholder="Low price" className="flex-1 h-6 px-2 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none focus:border-amber-500/50" />
          </div>
          <div className="flex gap-1">
            <input type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder="Label" className="flex-1 h-6 px-2 bg-slate-900 border border-slate-800 rounded text-[9px] text-slate-300 focus:outline-none focus:border-amber-500/50" />
            <button onClick={handleAdd} className="px-3 h-6 rounded text-[9px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Zone list */}
      {zones.length > 0 ? (
        <div className="space-y-1">
          {zones.map(zone => {
            const isTriggered = triggered.includes(zone.id);
            const priceInZone = lastPrice >= zone.lowPrice && lastPrice <= zone.highPrice;
            return (
              <div key={zone.id} className={cn('flex items-center justify-between px-2 py-1 rounded border text-[9px]',
                priceInZone ? 'border-amber-500/40 bg-amber-500/10 animate-pulse' :
                zone.active ? 'border-terminal-border bg-terminal-surface/50' :
                'border-slate-800 bg-slate-900/30 opacity-50'
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">{zone.label}</span>
                  <span className="text-slate-500 font-mono tabular-nums">{zone.lowPrice.toFixed(0)}–{zone.highPrice.toFixed(0)}</span>
                  {priceInZone && <span className="text-amber-400 font-bold">⚡ INSIDE</span>}
                </div>
                <div className="flex items-center gap-1">
                  {zone.triggerCount > 0 && <span className="text-[7px] text-slate-600">×{zone.triggerCount}</span>}
                  <button onClick={() => handleRemove(zone.id)} className="text-slate-600 hover:text-red-400">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : !showForm && (
        <p className="text-[8px] text-slate-600 italic">Add zones between levels to get alerted on manipulation areas</p>
      )}
    </div>
  );
}
