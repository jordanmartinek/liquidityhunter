import React, { useState } from 'react';
import { Shield } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simple local auth — no backend needed
    if (username.trim() && password.length >= 4) {
      const user = { username: username.trim(), id: Date.now() };
      localStorage.setItem('dt_auth', JSON.stringify(user));
      onLogin(user);
    } else {
      setError('Enter a username and password (4+ chars)');
    }
  };

  return (
    <div className="h-screen w-screen bg-terminal-bg flex items-center justify-center">
      <div className="w-96 panel">
        <div className="p-6 border-b border-terminal-border flex items-center justify-center gap-3">
          <Shield size={28} className="text-accent-blue" />
          <div>
            <h1 className="text-xl font-bold text-white">DisciplineTrader</h1>
            <p className="text-xs text-slate-500">Trading Discipline Execution System</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 block mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              placeholder="trader"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-accent-blue hover:bg-blue-600 text-white rounded font-medium text-sm transition-colors"
          >
            Enter Cockpit
          </button>

          <p className="text-center text-[10px] text-slate-600">
            Local-only auth — data stored in your browser
          </p>
        </form>
      </div>
    </div>
  );
}
