import React from 'react';
import { cn } from '@/lib/utils';

export function Switch({ checked, onCheckedChange, className, disabled, ...props }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
        'border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-teal-500' : 'bg-zinc-700',
        className
      )}
      {...props}
    >
      <span className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
        checked ? 'translate-x-5' : 'translate-x-0'
      )} />
    </button>
  );
}
