import { cn } from '@/lib/utils';

export default function SessionSummaryCard({ session }) {
  if (!session || (!session.daily_objective && !session.liquidityTarget && !session.daily_loss_limit && !session.max_trades)) return null;

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/30 rounded px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-zinc-400">
        {session.daily_objective && <span><span className="text-zinc-500">Obj:</span> <span className="text-zinc-300">{session.daily_objective}</span></span>}
        {session.daily_loss_limit > 0 && <span><span className="text-zinc-500">Loss Limit:</span> <span className="text-zinc-300">${session.daily_loss_limit}</span></span>}
        {session.max_trades && <span><span className="text-zinc-500">Max:</span> <span className="text-zinc-300">{session.max_trades} trades</span></span>}
      </div>
    </div>
  );
}
