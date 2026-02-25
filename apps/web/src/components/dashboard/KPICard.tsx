import { ReactNode } from 'react';
import { Card, CardBody } from '../ui/Card';
import { cn } from '@/utils/cn';

export interface KPICardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const colorClasses = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-yellow-50 text-yellow-600',
  danger: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-600',
};

export function KPICard({
  title,
  value,
  icon,
  trend,
  subtitle,
  color = 'primary',
  className,
}: KPICardProps) {
  return (
    <Card variant="bordered" className={className}>
      <CardBody>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {trend && (
                <span
                  className={cn(
                    'text-sm font-medium',
                    trend.isPositive ? 'text-green-600' : 'text-red-600',
                  )}
                >
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg',
                colorClasses[color],
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
