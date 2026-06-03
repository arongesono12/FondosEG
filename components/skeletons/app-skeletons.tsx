import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function PageShellSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6 md:space-y-8', className)}>
      <Skeleton className="h-36 w-full rounded-4xl" />
      <CardsGridSkeleton />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <PanelSkeleton rows={6} />
        <PanelSkeleton rows={5} />
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return <PageShellSkeleton />;
}

export function AuthPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md rounded-4xl border border-border/10 bg-card/60 p-6 shadow-xl">
      <div className="mb-8 flex flex-col items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-3xl" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <FormSkeleton rows={4} />
    </div>
  );
}

export function DevelopersPortalSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
      <div className="grid min-h-[70vh] items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <Skeleton className="h-8 w-36 rounded-full" />
          <Skeleton className="h-14 w-full max-w-xl rounded-3xl" />
          <Skeleton className="h-5 w-full max-w-lg" />
          <Skeleton className="h-5 w-3/4 max-w-md" />
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-12 w-36 rounded-2xl" />
            <Skeleton className="h-12 w-36 rounded-2xl" />
          </div>
        </div>
        <PanelSkeleton rows={6} />
      </div>
    </div>
  );
}

export function MarketingPageSkeleton() {
  return (
    <div className="min-h-screen space-y-10 bg-background px-4 py-8 md:px-8">
      <Skeleton className="mx-auto h-16 w-full max-w-6xl rounded-3xl" />
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <Skeleton className="h-8 w-32 rounded-full" />
          <Skeleton className="h-16 w-full rounded-4xl" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-12 w-40 rounded-2xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-4xl" />
      </div>
      <CardsGridSkeleton count={3} />
    </div>
  );
}

export function CardsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-3xl" />
      ))}
    </div>
  );
}

export function PanelSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-4xl border border-border/10 bg-card/40 p-5 shadow-sm', className)}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-10 w-10 rounded-2xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-2xl border border-border/5 bg-background/50 p-3">
            <Skeleton className="h-10 w-10 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-16 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-4xl border border-border/10 bg-card/40 p-4">
      <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <Skeleton key={columnIndex} className="h-10 rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-2xl" />
    </div>
  );
}

export function ModalListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-border/10 bg-background/60 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InlineFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11 w-full rounded-2xl" />
    </div>
  );
}
