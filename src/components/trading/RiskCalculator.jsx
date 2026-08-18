import React from 'react';
import { Calculator } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

export default function RiskCalculator() {
  const { risk, updateRisk, pointValue, symbol } = useCockpit();

  return (
    <div className="panel">
      <div className="panel-header flex items-center gap-2">
        <Calculator size={12} />
        <span>Risk Profile</span>
      </div>

      <div className="panel-body space-y-2">
        {/* Account & Limits */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Account</label>
            <input
              type="number"
              value={risk.account_size}
              onChange={(e) => updateRisk({ account_size: parseFloat(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Daily Loss Limit</label>
            <input
              type="number"
              value={risk.daily_loss_limit}
              onChange={(e) => updateRisk({ daily_loss_limit: parseFloat(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Max Risk $</label>
            <input
              type="number"
              value={risk.max_trade_risk}
              onChange={(e) => updateRisk({ max_trade_risk: parseFloat(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Max Cts</label>
            <input
              type="number"
              value={risk.max_contracts}
              onChange={(e) => updateRisk({ max_contracts: parseInt(e.target.value) || 1 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Max Trades</label>
            <input
              type="number"
              value={risk.max_trades}
              onChange={(e) => updateRisk({ max_trades: parseInt(e.target.value) || 1 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Max Consec. Losses</label>
            <input
              type="number"
              value={risk.max_consecutive_losses}
              onChange={(e) => updateRisk({ max_consecutive_losses: parseInt(e.target.value) || 1 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Point Value</label>
            <div className="text-xs tabular-nums mt-0.5 px-2 py-1 bg-terminal-bg border border-terminal-border rounded text-slate-300">
              ${pointValue} ({symbol.replace('1!', '')})
            </div>
          </div>
        </div>

        {/* Session Window */}
        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-terminal-border">
          <div>
            <label className="text-[10px] text-slate-500">Session Start</label>
            <input
              type="time"
              value={risk.session_start}
              onChange={(e) => updateRisk({ session_start: e.target.value })}
              className="w-full text-xs mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Session End</label>
            <input
              type="time"
              value={risk.session_end}
              onChange={(e) => updateRisk({ session_end: e.target.value })}
              className="w-full text-xs mt-0.5"
            />
          </div>
        </div>

        {/* Order Flow Thresholds */}
        <div className="grid grid-cols-2 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Vol Threshold</label>
            <input
              type="number"
              value={risk.volume_threshold}
              onChange={(e) => updateRisk({ volume_threshold: parseInt(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Imbalance Threshold</label>
            <input
              type="number"
              value={risk.imbalance_threshold}
              onChange={(e) => updateRisk({ imbalance_threshold: parseInt(e.target.value) || 0 })}
              className="w-full text-xs mt-0.5 tabular-nums"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
