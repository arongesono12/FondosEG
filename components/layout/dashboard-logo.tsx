import Image from 'next/image';

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
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
  xl: 'h-24 w-24',
};

const labelSizeClasses: Record<DashboardLogoSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-4xl',
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
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className={cn('relative flex items-center justify-center', iconSizeClasses[size], iconClassName)}>
        <div className="relative w-full h-full">
          <Image
            src="/logo fondosEG/FondosEG-logo.png"
            alt="FondosEG"
            width={144}
            height={144}
            priority={priority}
            className="object-contain w-full h-full"
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
