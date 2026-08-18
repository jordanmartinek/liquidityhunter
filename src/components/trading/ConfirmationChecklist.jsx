import React from 'react';
import { CheckCircle, Circle, ListChecks } from 'lucide-react';
import { useCockpit } from '@/lib/cockpitStore';

export default function ConfirmationChecklist() {
  const {
    confirmation,
    setConfirmation,
    confirmationCount,
    confirmationTotal,
    internalStructure,
    setInternalStructure,
  } = useCockpit();

  const toggleItem = (id) => {
    setConfirmation((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const allMet = confirmationCount === confirmationTotal;

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks size={12} />
          <span>Confirmation</span>
        </div>
        <span className={`text-xs tabular-nums font-bold ${
          allMet ? 'text-green-400' : confirmationCount > 0 ? 'text-amber-400' : 'text-slate-500'
        }`}>
          {confirmationCount}/{confirmationTotal}
        </span>
      </div>

      <div className="panel-body space-y-1">
        {/* Internal Structure Support */}
        <div className="pb-2 mb-2 border-b border-terminal-border">
          <button
            onClick={() =>
              setInternalStructure((prev) => ({
                ...prev,
                structure_supports: !prev.structure_supports,
              }))
            }
            className={`flex items-center gap-2 w-full text-left p-1 rounded transition-colors ${
              internalStructure.structure_supports
                ? 'text-green-400'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {internalStructure.structure_supports ? (
              <CheckCircle size={14} className="text-green-400 shrink-0" />
            ) : (
              <Circle size={14} className="shrink-0" />
            )}
            <span className="text-xs font-medium">Internal structure supports</span>
          </button>
        </div>

        {/* Order Flow Checklist */}
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
          Order Flow Confirmation
        </div>

        {confirmation.map((item) => (
          <button
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`flex items-center gap-2 w-full text-left p-1 rounded transition-colors ${
              item.checked ? 'text-green-400' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {item.checked ? (
              <CheckCircle size={14} className="text-green-400 shrink-0" />
            ) : (
              <Circle size={14} className="shrink-0" />
            )}
            <span className="text-xs">{item.label}</span>
          </button>
        ))}

        {/* Status */}
        {allMet && internalStructure.structure_supports && (
          <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded text-center">
            <span className="text-xs font-bold text-green-400">✓ CONFIRMATION COMPLETE</span>
          </div>
        )}
      </div>
    </div>
  );
}
