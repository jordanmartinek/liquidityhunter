import React from 'react';
import { cn } from '@/lib/utils';

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-800/50',
        'px-3 py-2 text-sm text-zinc-100',
        'focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'appearance-none cursor-pointer transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function SelectOption({ value, children, ...props }) {
  return <option value={value} className="bg-zinc-900 text-zinc-100" {...props}>{children}</option>;
}
