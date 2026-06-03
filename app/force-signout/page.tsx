'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth';
import { Skeleton } from '@/components/ui/skeleton';

export default function ForceSignOutPage() {
  const router = useRouter();

  useEffect(() => {
    const handleSignOut = async () => {
      console.log('Forcing sign out...');
      await signOutAction();
      router.push('/login');
      router.refresh();
    };
    handleSignOut();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="p-8 text-center space-y-4">
        <Skeleton className="mx-auto h-12 w-12 rounded-2xl" />
        <Skeleton className="mx-auto h-7 w-56 rounded-xl" />
        <Skeleton className="mx-auto h-4 w-80 max-w-full rounded-xl" />
        <Skeleton className="mx-auto h-10 w-40 rounded-2xl" />
      </div>
    </div>
  );
}
