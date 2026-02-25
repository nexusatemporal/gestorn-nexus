import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * ══════════════════════════════════════════════════════════════════════════
 * CLASSNAME UTILITY
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Combina classes do Tailwind CSS com merge inteligente.
 *
 * USAGE:
 * ```tsx
 * <div className={cn('px-4', isActive && 'bg-blue-500', className)} />
 * ```
 */

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
