import { ReactNode } from 'react';
import { Card, CardHeader, CardBody } from '../ui/Card';

export interface ChartContainerProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ChartContainer({
  title,
  description,
  children,
  action,
  className,
}: ChartContainerProps) {
  return (
    <Card variant="bordered" className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {description && (
              <p className="mt-1 text-sm text-gray-600">{description}</p>
            )}
          </div>
          {action && <div className="ml-4">{action}</div>}
        </div>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
