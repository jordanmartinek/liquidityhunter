import React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  destructive: 'bg-red-500/20 text-red-300 border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  secondary: 'bg-zinc-700/50 text-zinc-300 border-zinc-600',
  outline: 'bg-transparent text-zinc-300 border-zinc-600',
};

export function Badge({ className, variant = 'default', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
