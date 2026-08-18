import React, { useState, useMemo } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

export default function AuthorizationPanel() {
  const {
    setup,
    updateSetup,
    confirmation,
    confirmationCount,
    confirmationTotal,
    internalStructure,
    location,
    disciplineLocked,
    lockReason,
    risk,
    pointValue,
    saveTrade,
    logViolation,
    currentPrice,
    symbol,
    context,
    emotionalState,
  } = useCockpit();

  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [contracts, setContracts] = useState(1);

  // Authorization logic
  const auth = useMemo(() => {
    const locationValid = location !== '' && location === setup.location;
    const confirmationMet = confirmationCount >= confirmationTotal;
    const internalOk = internalStructure.structure_supports;
    const disciplineOk = !disciplineLocked;

    // Risk check
    const entryPrice = parseFloat(entry) || 0;
    const stopPrice = parseFloat(stop) || 0;
    const riskPoints = Math.abs(entryPrice - stopPrice);
    const riskDollars = riskPoints * contracts * pointValue;
    const riskOk = entryPrice > 0 && stopPrice > 0
      ? riskDollars <= risk.max_trade_risk && contracts <= risk.max_contracts
      : true; // Don't block if not yet filled in

    if (!disciplineOk) {
      return { state: 'LOCKED', color: 'text-red-400', icon: ShieldX, message: lockReason };
    }
    if (!confirmationMet || !internalOk) {
      return { state: 'WAIT', color: 'text-amber-400', icon: ShieldAlert, message: 'Confirmation incomplete' };
    }
    if (!locationValid) {
      return { state: 'CONDITIONS NOT MET', color: 'text-orange-400', icon: ShieldAlert, message: 'Location mismatch or not set' };
    }
    if (!riskOk) {
      return { state: 'RISK VIOLATION', color: 'text-red-400', icon: ShieldX, message: 'Risk exceeds limits' };
    }

    return { state: 'AUTHORIZED', color: 'text-green-400', icon: ShieldCheck, message: 'All conditions met' };
  }, [
    location, setup.location, confirmationCount, confirmationTotal,
    internalStructure.structure_supports, disciplineLocked, lockReason,
    entry, stop, contracts, pointValue, risk,
  ]);

  const handleExecute = () => {
    if (auth.state !== 'AUTHORIZED') {
      // Premature attempt — log violation
      logViolation({
        rule: 'PREMATURE_ENTRY',
        reason: `Attempted execute while ${auth.state}`,
        explanation: auth.message,
        overridden: false,
        market_state: setup.state,
      });
      return;
    }

    const entryPrice = parseFloat(entry);
    const stopPrice = parseFloat(stop);
    const targetPrice = parseFloat(target) || 0;
    const riskPoints = Math.abs(entryPrice - stopPrice);
    const riskDollars = riskPoints * contracts * pointValue;
    const rewardPoints = targetPrice > 0 ? Math.abs(targetPrice - entryPrice) : 0;
    const rr = riskPoints > 0 && rewardPoints > 0 ? (rewardPoints / riskPoints).toFixed(2) : 0;

    saveTrade({
      direction: setup.direction,
      setup_name: setup.name,
      environment: context.structure,
      gamma_regime: context.gamma_regime,
      location,
      entry: entryPrice,
      stop: stopPrice,
      target: targetPrice,
      contracts: parseInt(contracts),
      point_value: pointValue,
      risk_points: riskPoints,
      risk_dollars: riskDollars,
      reward_points: rewardPoints,
      rr: parseFloat(rr),
      result: 'Open',
      pnl: 0,
      mfe: 0,
      mae: 0,
      game_grade: 'A',
      good_loss: false,
      loss_reason: '',
      rule_violations: [],
      emotional_state: emotionalState,
      execution_score: 100,
      notes: '',
      entry_time: new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
      exit_time: '',
    });

    updateSetup({ state: 'Trade Active' });

    // Reset form
    setEntry('');
    setStop('');
    setTarget('');
    setContracts(1);
  };

  const AuthIcon = auth.icon;

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={12} />
          <span>Authorization</span>
        </div>
        <span className={`text-xs font-bold ${auth.color}`}>
          {auth.state}
        </span>
      </div>

      <div className="panel-body space-y-2">
        {/* Status Display */}
        <div className={`flex items-center gap-2 p-2 rounded border ${
          auth.state === 'AUTHORIZED'
            ? 'bg-green-500/10 border-green-500/30'
            : auth.state === 'LOCKED'
            ? 'bg-red-500/10 border-red-500/30'
            : 'bg-terminal-bg border-terminal-border'
        }`}>
          <AuthIcon size={16} className={auth.color} />
          <span className={`text-xs ${auth.color}`}>{auth.message}</span>
        </div>

        {/* Entry Parameters */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Entry</label>
            <input
              type="number"
              step="0.01"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Stop</label>
            <input
              type="number"
              step="0.01"
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Target</label>
            <input
              type="number"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Contracts</label>
            <input
              type="number"
              min="1"
              max={risk.max_contracts}
              value={contracts}
              onChange={(e) => setContracts(e.target.value)}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
        </div>

        {/* Quick Risk Display */}
        {entry && stop && (
          <div className="text-[10px] text-slate-400 space-y-0.5 pt-1 border-t border-terminal-border">
            <div className="flex justify-between">
              <span>Risk:</span>
              <span className="tabular-nums">
                {Math.abs(parseFloat(entry) - parseFloat(stop)).toFixed(2)} pts /
                ${(Math.abs(parseFloat(entry) - parseFloat(stop)) * contracts * pointValue).toFixed(0)}
              </span>
            </div>
            {target && (
              <div className="flex justify-between">
                <span>R:R:</span>
                <span className="tabular-nums text-green-400">
                  1:{(Math.abs(parseFloat(target) - parseFloat(entry)) / Math.abs(parseFloat(entry) - parseFloat(stop))).toFixed(1)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Execute Button */}
        <button
          onClick={handleExecute}
          disabled={auth.state !== 'AUTHORIZED'}
          className={`w-full py-2 rounded font-bold text-sm transition-all ${
            auth.state === 'AUTHORIZED'
              ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
              : 'bg-terminal-panel text-slate-600 cursor-not-allowed border border-terminal-border'
          }`}
        >
          {auth.state === 'AUTHORIZED' ? '⚡ EXECUTE TRADE' :
           auth.state === 'LOCKED' ? '🔒 LOCKED' :
           '⏳ ' + auth.state}
        </button>
      </div>
    </div>
  );
}
