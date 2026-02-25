import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { useUIStore } from '@/stores/useUIStore';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      ...props
    },
    ref
  ) => {
    const { theme } = useUIStore();
    const isDark = theme === 'dark';
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium mb-1',
              isDark ? 'text-zinc-400' : 'text-gray-700'
            )}
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2',
              isDark ? 'text-zinc-500' : 'text-gray-400'
            )}>
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-sm',
              isDark
                ? 'border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500'
                : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-nexus-orange/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              // ✅ Fix autocomplete background - sobrescreve estilos do Chrome
              '[&:-webkit-autofill]:!bg-zinc-800 [&:-webkit-autofill]:!text-white',
              '[&:-webkit-autofill]:shadow-[0_0_0_1000px_#27272a_inset]',
              '[&:-webkit-autofill:hover]:shadow-[0_0_0_1000px_#27272a_inset]',
              '[&:-webkit-autofill:focus]:shadow-[0_0_0_1000px_#27272a_inset]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2',
              isDark ? 'text-zinc-500' : 'text-gray-400'
            )}>
              {rightIcon}
            </div>
          )}
        </div>
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

Input.displayName = 'Input';
