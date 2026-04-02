'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import type { User } from '@/types';

interface AppProviderProps {
  children: React.ReactNode;
  initialUser: User;
}

export function AppProvider({ children, initialUser }: AppProviderProps) {
  const { setUser, setLoading, setPreferredCurrency } = useAppStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    const storedCurrency = localStorage.getItem('preferredCurrency');
    if (storedCurrency) {
      setPreferredCurrency(storedCurrency);
    }
    
    setUser(initialUser);
    setLoading(false);
  }, [initialUser, setUser, setLoading, setPreferredCurrency]);

  return <>{children}</>;
}
