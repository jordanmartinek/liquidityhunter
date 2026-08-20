import React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800/50',
        'px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500',
        'focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500',
        'disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        className
      )}
      {...props}
    />
  );
}
