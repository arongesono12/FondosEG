import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardMetricProps {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}

/** Compact, non-interactive indicator shared by the dashboard and modules. */
export function DashboardMetric({ label, value, hint, className }: DashboardMetricProps) {
  return (
    <Card interactive={false} className={cn('dashboard-compact-metric min-w-0', className)}>
      <CardContent className="dashboard-metric-content">
        <p className="dashboard-metric-label">{label}</p>
        <p className="dashboard-metric-value">{value}</p>
        {hint && <p className="dashboard-metric-hint">{hint}</p>}
      </CardContent>
    </Card>
  );
}
