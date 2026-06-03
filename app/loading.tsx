import { PageShellSkeleton } from '@/components/skeletons/app-skeletons';

export default function Loading() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <PageShellSkeleton />
    </main>
  );
}
