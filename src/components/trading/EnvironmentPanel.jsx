import React from 'react';
import { Globe } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';
import { STRUCTURE_TYPES, HTF_TIMEFRAMES, GAMMA_REGIMES } from '@/lib/constants';

export default function EnvironmentPanel() {
  const { context, saveContext } = useCockpit();

  const handleChange = (field, value) => {
    saveContext({ [field]: value });
  };

  return (
    <div className="panel flex flex-col">
      <div className="panel-header flex items-center gap-2">
        <Globe size={12} />
        <span>Environment</span>
      </div>

      <div className="panel-body space-y-2">
        {/* Structure */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Structure</label>
          <select
            value={context.structure || ''}
            onChange={(e) => handleChange('structure', e.target.value)}
            className="w-full text-xs mt-0.5"
          >
            <option value="">Select...</option>
            {STRUCTURE_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* HTF Structure */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">HTF Bias</label>
          <select
            value={context.htf_structure || ''}
            onChange={(e) => handleChange('htf_structure', e.target.value)}
            className="w-full text-xs mt-0.5"
          >
            <option value="">Select...</option>
            {HTF_TIMEFRAMES.map((tf) => (
              <option key={tf} value={tf}>{tf}</option>
            ))}
          </select>
        </div>

        {/* Gamma Regime */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Gamma Regime</label>
          <div className="flex gap-1 mt-0.5">
            {GAMMA_REGIMES.map((regime) => (
              <button
                key={regime}
                onClick={() => handleChange('gamma_regime', regime)}
                className={`btn flex-1 text-[10px] ${
                  context.gamma_regime === regime
                    ? regime === 'Positive' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : regime === 'Negative' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                    : 'btn-ghost'
                }`}
              >
                {regime}
              </button>
            ))}
          </div>
        </div>

        {/* GEX Levels */}
        <div className="grid grid-cols-3 gap-1">
          <div>
            <label className="text-[10px] text-slate-500">Call Wall</label>
            <input
              type="number"
              step="1"
              value={context.call_wall || ''}
              onChange={(e) => handleChange('call_wall', parseFloat(e.target.value) || 0)}
              className="w-full text-xs mt-0.5"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Put Wall</label>
            <input
              type="number"
              step="1"
              value={context.put_wall || ''}
              onChange={(e) => handleChange('put_wall', parseFloat(e.target.value) || 0)}
              className="w-full text-xs mt-0.5"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">γ Flip</label>
            <input
              type="number"
              step="1"
              value={context.gamma_flip || ''}
              onChange={(e) => handleChange('gamma_flip', parseFloat(e.target.value) || 0)}
              className="w-full text-xs mt-0.5"
              placeholder="0"
            />
          </div>
        </div>

        {/* Volatility Note */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Volatility Note</label>
          <input
            type="text"
            value={context.volatility_note || ''}
            onChange={(e) => handleChange('volatility_note', e.target.value)}
            className="w-full text-xs mt-0.5"
            placeholder="VIX, IVR, regime..."
          />
        </div>

        {/* Scenarios */}
        <div className="space-y-1.5 pt-1 border-t border-terminal-border">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Scenario Planning</label>
          <div>
            <label className="text-[10px] text-green-400">Primary</label>
            <input
              type="text"
              value={context.scenario_primary || ''}
              onChange={(e) => handleChange('scenario_primary', e.target.value)}
              className="w-full text-xs mt-0.5"
              placeholder="If price does X, then Y..."
            />
          </div>
          <div>
            <label className="text-[10px] text-amber-400">Alternative</label>
            <input
              type="text"
              value={context.scenario_alternative || ''}
              onChange={(e) => handleChange('scenario_alternative', e.target.value)}
              className="w-full text-xs mt-0.5"
              placeholder="If scenario 1 fails..."
            />
          </div>
          <div>
            <label className="text-[10px] text-red-400">No-Trade</label>
            <input
              type="text"
              value={context.scenario_notrade || ''}
              onChange={(e) => handleChange('scenario_notrade', e.target.value)}
              className="w-full text-xs mt-0.5"
              placeholder="Do NOT trade if..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
