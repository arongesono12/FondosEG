'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'standard' | 'metric' | 'nested';
  interactive?: boolean;
  asChild?: boolean;
}

const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  ({ className, variant = 'standard', interactive = false, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div';

    return (
      <Comp
        ref={ref}
        data-dashboard-card={variant}
        data-interactive={interactive ? 'true' : undefined}
        className={cn(
          'dashboard-card-surface',
          variant === 'metric' && 'dashboard-card-metric',
          variant === 'nested' && 'dashboard-card-nested',
          interactive && 'dashboard-card-interactive',
          className,
        )}
        {...props}
      />
    );
  },
);
DashboardCard.displayName = 'DashboardCard';

const DashboardCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('dashboard-card-header', className)} {...props} />
));
DashboardCardHeader.displayName = 'DashboardCardHeader';

const DashboardCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('dashboard-card-content', className)} {...props} />
));
DashboardCardContent.displayName = 'DashboardCardContent';

const DashboardCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('dashboard-card-footer', className)} {...props} />
));
DashboardCardFooter.displayName = 'DashboardCardFooter';

export {
  DashboardCard,
  DashboardCardContent,
  DashboardCardFooter,
  DashboardCardHeader,
};
