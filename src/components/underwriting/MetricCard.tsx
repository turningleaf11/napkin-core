import { cn } from '../../lib/utils';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  status?: 'pass' | 'fail' | 'warning' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MetricCard({
  label,
  value,
  subValue,
  status = 'neutral',
  size = 'md',
  className,
}: MetricCardProps) {
  const statusColors = {
    pass: 'border-l-green-500 bg-green-50/50 dark:bg-green-950/20',
    fail: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
    warning: 'border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20',
    neutral: 'border-l-primary/30',
  };

  const statusIcons = {
    pass: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    fail: <XCircle className="h-4 w-4 text-red-500" />,
    warning: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    neutral: null,
  };

  const sizeClasses = {
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  const valueSizes = {
    sm: 'text-lg font-semibold',
    md: 'text-xl font-bold',
    lg: 'text-2xl font-bold',
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-l-4 bg-card',
        statusColors[status],
        sizeClasses[size],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className={cn('text-foreground', valueSizes[size])}>{value}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
          )}
        </div>
        {statusIcons[status]}
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  className?: string;
}

export function MetricRow({ label, value, className }: MetricRowProps) {
  return (
    <div className={cn('flex justify-between items-center py-1.5 border-b border-border/50 last:border-0', className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
