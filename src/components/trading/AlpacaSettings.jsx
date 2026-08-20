import React, { useState } from 'react';
import { saveAlpacaKeys, hasAlpacaKeys } from './AlpacaChart';

export default function AlpacaSettings({ onSave }) {
  const [key, setKey] = useState(localStorage.getItem('lh_alpaca_key') || '');
  const [secret, setSecret] = useState(localStorage.getItem('lh_alpaca_secret') || '');
  const [saved, setSaved] = useState(hasAlpacaKeys());

  const handleSave = () => {
    saveAlpacaKeys(key.trim(), secret.trim());
    setSaved(true);
    onSave?.();
  };

  return (
    <div className="space-y-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Alpaca API Keys</h4>
        {saved && <span className="text-[9px] text-emerald-400">✓ Connected</span>}
      </div>
      <div className="space-y-1.5">
        <input
          type="text"
          value={key}
          onChange={(e) => { setKey(e.target.value); setSaved(false); }}
          placeholder="API Key ID"
          className="w-full h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 font-mono focus:outline-none focus:border-teal-400/50"
        />
        <input
          type="password"
          value={secret}
          onChange={(e) => { setSecret(e.target.value); setSaved(false); }}
          placeholder="Secret Key"
          className="w-full h-7 px-2 bg-zinc-900 border border-zinc-800 rounded text-[10px] text-zinc-300 font-mono focus:outline-none focus:border-teal-400/50"
        />
      </div>
      {!saved && (
        <button
          onClick={handleSave}
          disabled={!key.trim() || !secret.trim()}
          className="w-full py-1.5 rounded text-[10px] font-medium bg-teal-400/10 border border-teal-400/50 text-teal-400 hover:bg-teal-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save & Connect
        </button>
      )}
      <p className="text-[9px] text-zinc-600">
        Get keys from <a href="https://app.alpaca.markets" target="_blank" rel="noopener" className="text-teal-400/70 hover:text-teal-400">app.alpaca.markets</a> → API Keys. Free plan works.
      </p>
    </div>
  );
}
