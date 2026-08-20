import React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-teal-500 text-zinc-950 hover:bg-teal-400 font-medium',
  destructive: 'bg-red-600 text-white hover:bg-red-500',
  outline: 'border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-100',
  secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
  ghost: 'hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100',
  link: 'text-teal-400 underline-offset-4 hover:underline',
};

const sizes = {
  default: 'h-10 px-4 py-2',
  sm: 'h-8 px-3 text-sm',
  lg: 'h-12 px-6 text-lg',
  icon: 'h-10 w-10',
};

export function Button({ className, variant = 'default', size = 'default', disabled, children, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md text-sm font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
