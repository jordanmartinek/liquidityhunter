import { cn } from '@/lib/utils';

export default function CompactModeToggle({ compact, onToggle }) {
  return (
    <button onClick={onToggle} className="p-1 rounded text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-zinc-800/50"
      title={compact ? 'Expand view' : 'Compact view'}>
      {compact ? '⊞' : '⊟'}
    </button>
  );
}
