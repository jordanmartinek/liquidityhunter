import React, { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export function Dialog({ open, onOpenChange, children }) {
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape' && onOpenChange) onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => onOpenChange?.(false)} />
      <div className="relative z-50 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-scale-in">
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ className, children, ...props }) {
  return <div className={cn('rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl', className)} {...props}>{children}</div>;
}

export function DialogHeader({ className, children, ...props }) {
  return <div className={cn('flex flex-col space-y-2 mb-4', className)} {...props}>{children}</div>;
}

export function DialogTitle({ className, children, ...props }) {
  return <h2 className={cn('text-xl font-semibold text-zinc-100', className)} {...props}>{children}</h2>;
}

export function DialogDescription({ className, children, ...props }) {
  return <p className={cn('text-sm text-zinc-400', className)} {...props}>{children}</p>;
}

export function DialogFooter({ className, children, ...props }) {
  return <div className={cn('flex justify-end gap-2 mt-6', className)} {...props}>{children}</div>;
}
