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
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-14 w-14',
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
