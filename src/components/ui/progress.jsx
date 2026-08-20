import React from 'react';
import { cn } from '@/lib/utils';

export function Progress({ value = 0, max = 100, className, barClassName, ...props }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-zinc-800', className)} {...props}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500 ease-out',
          percentage >= 70 ? 'bg-teal-500' : percentage >= 40 ? 'bg-amber-500' : 'bg-red-500',
          barClassName
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
