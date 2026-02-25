/**
 * ══════════════════════════════════════════════════════════════════════════
 * ⏳ LOADING INDICATOR - Skeleton e spinner de loading
 * ══════════════════════════════════════════════════════════════════════════
 */

import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';

interface LoadingIndicatorProps {
  variant?: 'spinner' | 'skeleton' | 'dots';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const SPINNER_SIZES = {
  sm: 16,
  md: 24,
  lg: 32,
};

export function LoadingIndicator({
  variant = 'spinner',
  size = 'md',
  text,
  className,
}: LoadingIndicatorProps) {
  const theme = useUIStore((state) => state.theme);
  const isDark = theme === 'dark';

  if (variant === 'spinner') {
    return (
      <div className={clsx('flex items-center justify-center gap-2', className)}>
        <Loader2 className="animate-spin text-nexus-orange" size={SPINNER_SIZES[size]} />
        {text && <span className="text-sm text-zinc-500">{text}</span>}
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div className={clsx('flex items-center justify-center gap-1', className)}>
        <div className="h-2 w-2 animate-bounce rounded-full bg-nexus-orange [animation-delay:-0.3s]" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-nexus-orange [animation-delay:-0.15s]" />
        <div className="h-2 w-2 animate-bounce rounded-full bg-nexus-orange" />
      </div>
    );
  }

  // Skeleton
  return (
    <div className={clsx('space-y-3', className)}>
      <div className={clsx('h-4 w-full animate-pulse rounded', isDark ? 'bg-zinc-800' : 'bg-gray-200')} />
      <div className={clsx('h-4 w-3/4 animate-pulse rounded', isDark ? 'bg-zinc-800' : 'bg-gray-200')} />
      <div className={clsx('h-4 w-5/6 animate-pulse rounded', isDark ? 'bg-zinc-800' : 'bg-gray-200')} />
    </div>
  );
}
