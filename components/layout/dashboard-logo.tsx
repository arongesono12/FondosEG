import Image from 'next/image';

import { cn } from '@/lib/utils';

type DashboardLogoSize = 'sm' | 'md' | 'lg';

interface DashboardLogoProps {
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  priority?: boolean;
  showLabel?: boolean;
  size?: DashboardLogoSize;
}

const iconSizeClasses: Record<DashboardLogoSize, string> = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
};

const labelSizeClasses: Record<DashboardLogoSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
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
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('relative bg-brand-gradient p-1.5 shadow-inner flex items-center justify-center rounded-full', iconSizeClasses[size], iconClassName)}>
        <div className="relative w-full h-full">
          <Image
            src="/logo fondosEG/FondosEG-logo.png"
            alt="FondosEG"
            fill
            priority={priority}
            sizes="(max-width: 768px) 48px, 64px"
            className="object-contain"
          />
        </div>
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
