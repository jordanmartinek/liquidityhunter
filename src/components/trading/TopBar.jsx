import React from 'react';
import React from 'react';
import { Crosshair, Mic, MicOff } from 'lucide-react';
import { useResearch } from '@/lib/researchStore';
import { useVoiceInput } from '@/lib/useVoiceInput';
import { INSTRUMENTS } from '@/lib/constants';
import { exportBackup, importBackupFromFile } from '@/lib/backup';

/**
 * Parse a spoken price from voice transcript.
 * Handles: "21450", "twenty one thousand four hundred fifty",
 * "21,450", "twenty one four fifty", etc.
 */
function parseSpokenPrice(text) {
  // First: try to find a raw number (digits, commas, decimals)
  const cleaned = text.replace(/,/g, '').replace(/\s+/g, ' ').trim();

  // Look for a number pattern (4-6 digits, optionally with decimal)
  const numberMatch = cleaned.match(/(\d{4,6}(?:\.\d{1,2})?)/);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }

  // Try to interpret word-based numbers
  const wordToNum = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    hundred: 100, thousand: 1000,
  };

  const words = cleaned.toLowerCase().split(/\s+/);
  let total = 0;
  let current = 0;

  for (const word of words) {
    if (wordToNum[word] !== undefined) {
      const val = wordToNum[word];
      if (val === 1000) {
        current = current === 0 ? 1000 : current * 1000;
        total += current;
        current = 0;
      } else if (val === 100) {
        current = current === 0 ? 100 : current * 100;
      } else {
        current += val;
      }
    }
  }
  total += current;

  return total > 0 ? total : 0;
}

export default function TopBar() {
  const { symbol, setSymbol, lastPrice, updateLastPrice, currentDate, isLive, priceStale } = useResearch();
  const [priceInput, setPriceInput] = React.useState('');
  const { isListening, transcript, startListening, stopListening, isSupported } = useVoiceInput();
  const backupFileRef = React.useRef(null);

  const handleExport = () => {
    const n = exportBackup();
    // brief confirmation without a blocking dialog
    console.log(`[LH] Backed up ${n} keys`);
  };
  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!confirm('Restore from this backup? It will overwrite your current levels, trades, journal and settings, then reload.')) {
      e.target.value = '';
      return;
    }
    const { restored, error } = await importBackupFromFile(file);
    e.target.value = '';
    if (error) { alert('Restore failed: ' + error); return; }
    alert(`Restored ${restored} items. Reloading…`);
    window.location.reload();
  };

  const handlePriceSubmit = (e) => {
    e.preventDefault();
    if (priceInput) {
      updateLastPrice(priceInput);
      setPriceInput('');
    }
  };

  // Voice: parse spoken price and update
  const handleVoicePrice = (voiceText) => {
    const price = parseSpokenPrice(voiceText);
    if (price > 0) {
      updateLastPrice(price);
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(handleVoicePrice);
    }
  };

  const displayDate = new Date(currentDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="h-12 bg-terminal-surface border-b border-terminal-border flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Crosshair size={16} className="text-accent-blue" />
        <span className="text-sm font-bold text-slate-200">LiquidityHunter</span>
      </div>

      <div className="w-px h-6 bg-terminal-border" />

      {/* Instrument quick-switch — one-click chips */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Instrument">
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst.symbol}
            onClick={() => setSymbol(inst.symbol)}
            aria-pressed={symbol === inst.symbol}
            title={inst.symbol}
            className={`px-2 py-1 rounded text-xs font-semibold transition-colors border ${
              symbol === inst.symbol
                ? 'bg-accent-blue/20 border-accent-blue/50 text-white'
                : 'bg-terminal-bg border-terminal-border text-slate-400 hover:text-slate-200'
            }`}
          >
            {inst.label}
          </button>
        ))}
      </div>

      {/* Last Price */}
      <div className="flex items-center gap-2">
        <form onSubmit={handlePriceSubmit} className="flex items-center gap-1">
          <input
            type="number"
            step="0.01"
            placeholder="Last price..."
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="w-28 bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-xs tabular-nums text-slate-200"
          />
          <button type="submit" className="btn btn-ghost text-[10px]">Set</button>
        </form>

        {/* Voice price button */}
        {isSupported && (
          <button
            onClick={toggleVoice}
            className={`p-1.5 rounded transition-all ${
              isListening
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : 'text-slate-500 hover:text-white hover:bg-accent-blue/20 border border-transparent hover:border-accent-blue/30'
            }`}
            title={isListening ? 'Stop — processing price' : 'Speak price (e.g. "21450")'}
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
        )}

        {/* Live transcript while listening */}
        {isListening && transcript && (
          <span className="text-[10px] text-red-400/70 italic animate-pulse">
            "{transcript}"
          </span>
        )}

        {/* Current price display */}
        {lastPrice > 0 && !isListening && (
          <div className="flex items-center gap-1.5">
            {isLive && !priceStale && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live from TradingView" />}
            {isLive && priceStale && <div className="w-2 h-2 rounded-full bg-amber-400" title="Market closed — price stale" />}
            <span className="text-sm font-bold tabular-nums text-white">
              {lastPrice.toFixed(2)}
            </span>
            {isLive && !priceStale && <span className="text-[9px] text-emerald-400/70">LIVE</span>}
            {isLive && priceStale && <span className="text-[9px] text-amber-400/70">CLOSED</span>}
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Backup / Restore */}
      <button onClick={handleExport} title="Back up all data (levels, trades, journal, settings) to a file"
        className="text-[10px] px-1.5 py-1 rounded border border-terminal-border text-slate-500 hover:text-teal-400 hover:border-teal-500/40">
        ⬇ Backup
      </button>
      <button onClick={() => backupFileRef.current?.click()} title="Restore from a backup file (overwrites current data)"
        className="text-[10px] px-1.5 py-1 rounded border border-terminal-border text-slate-500 hover:text-amber-400 hover:border-amber-500/40">
        ⬆ Restore
      </button>
      <input ref={backupFileRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />

      {/* Date */}
      <span className="text-xs text-slate-500 ml-2">{displayDate}</span>
    </div>
  );
}
