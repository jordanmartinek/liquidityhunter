import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({ children, content, className }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && content && (
        <div className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1',
          'text-xs text-zinc-200 bg-zinc-800 border border-zinc-700',
          'rounded shadow-lg whitespace-nowrap z-50 animate-fade-in',
          className
        )}>
          {content}
        </div>
      )}
    </div>
  );
}
