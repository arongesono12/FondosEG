import { cn } from '@/lib/utils';

type DashboardLogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface DashboardLogoProps {
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  priority?: boolean;
  showLabel?: boolean;
  size?: DashboardLogoSize;
}

const iconSizeClasses: Record<DashboardLogoSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
  xl: 'h-16 w-16',
};

const labelSizeClasses: Record<DashboardLogoSize, string> = {
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-5xl',
};

export function DashboardLogo({
  className,
  iconClassName,
  labelClassName,
  priority = false,
  showLabel = true,
  size = 'md',
}: DashboardLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('relative flex items-center justify-center', iconSizeClasses[size], iconClassName)}>
        <img
          src="/logo%20fondosEG/FondosEG-logo.png"
          alt="FondosEG"
          fetchPriority={priority ? 'high' : undefined}
          className="h-full w-full object-contain"
        />
      </div>

      {showLabel && (
        <span
          className={cn(
            'font-bold tracking-tighter text-brand-gradient leading-none transition-all duration-300',
            labelSizeClasses[size],
            labelClassName
          )}
        >
          FondosEG
        </span>
      )}
    </div>
  );
}
