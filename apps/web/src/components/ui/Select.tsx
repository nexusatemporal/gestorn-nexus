import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { useUIStore } from '@/stores/useUIStore';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      options,
      placeholder,
      id,
      ...props
    },
    ref
  ) => {
    const { theme } = useUIStore();
    const isDark = theme === 'dark';
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'block text-sm font-medium mb-1',
              isDark ? 'text-zinc-400' : 'text-gray-700'
            )}
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-xl border px-4 py-3 text-sm',
            isDark
              ? 'border-zinc-700 bg-zinc-800 text-white'
              : 'border-gray-300 bg-white text-gray-900',
            'focus:outline-none focus:ring-2 focus:ring-nexus-orange/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
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

Select.displayName = 'Select';
