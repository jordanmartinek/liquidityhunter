import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'levelQueued', label: 'Queue' },
  { key: 'sweeping', label: 'Sweeping' },
  { key: 'swept', label: 'Swept' },
  { key: 'displacementConfirmed', label: 'Displacement' },
  { key: 'rulesScore', label: 'Rules' },
  { key: 'trapped', label: 'TRAPPED' },
  { key: 'executed', label: 'Execute' },
];

function getStepCompleted(step, props) {
  switch (step.key) {
    case 'levelQueued': return !!props.levelQueued;
    case 'sweeping': return !!props.sweeping;
    case 'swept': return !!props.swept;
    case 'displacementConfirmed': return !!props.displacementConfirmed;
    case 'rulesScore': return props.rulesScore >= 80;
    case 'trapped': return !!props.trapped;
    case 'executed': return !!props.executed;
    default: return false;
  }
}

export default function PipelineBar(props) {
  return (
    <div className="flex items-center w-full gap-0">
      {STEPS.map((step, i) => {
        const completed = getStepCompleted(step, props);
        const isActive = !completed && (i === 0 || getStepCompleted(STEPS[i - 1], props));
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn('w-2 h-2 rounded-full transition-all', completed ? 'bg-teal-400' : 'bg-zinc-700', isActive && 'animate-pulse ring-1 ring-teal-400/40')} />
              <span className={cn('text-[8px] mt-0.5 whitespace-nowrap hidden sm:block', completed ? 'text-teal-400' : 'text-zinc-600')}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={cn('h-[1px] w-3 sm:w-5 mx-0.5', completed ? 'bg-teal-400/40' : 'bg-zinc-800')} />}
          </div>
        );
      })}
    </div>
  );
}
