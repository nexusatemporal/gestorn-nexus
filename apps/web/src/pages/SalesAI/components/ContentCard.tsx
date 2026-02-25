/**
 * ══════════════════════════════════════════════════════════════════════════
 * 📄 CONTENT CARD - Card reutilizável para exibir conteúdo
 * ══════════════════════════════════════════════════════════════════════════
 */

import { ReactNode } from 'react';
import { clsx } from 'clsx';

interface ContentCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  variant?: 'default' | 'bordered' | 'elevated';
  className?: string;
}

export function ContentCard({
  title,
  subtitle,
  icon,
  children,
  actions,
  variant = 'default',
  className,
}: ContentCardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg bg-white p-4',
        {
          'border border-gray-200': variant === 'bordered',
          'shadow-sm': variant === 'elevated',
        },
        className
      )}
    >
      {/* Header */}
      {(title || icon || actions) && (
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-orange-600">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-sm text-zinc-500">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Content */}
      <div className="text-zinc-600">{children}</div>
    </div>
  );
}
