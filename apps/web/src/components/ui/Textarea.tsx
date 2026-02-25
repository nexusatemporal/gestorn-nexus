import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { useUIStore } from '@/stores/useUIStore';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      id,
      ...props
    },
    ref
  ) => {
    const { theme } = useUIStore();
    const isDark = theme === 'dark';
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              'block text-sm font-medium mb-1',
              isDark ? 'text-zinc-400' : 'text-gray-700'
            )}
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-sm',
            isDark
              ? 'border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500'
              : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-nexus-orange/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'resize-y min-h-[80px]',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className={cn(
            'mt-1 text-sm',
            isDark ? 'text-zinc-500' : 'text-gray-500'
          )}>{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
