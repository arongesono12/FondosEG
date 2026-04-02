import { create } from 'zustand';
import type { User, Transfer } from '@/types';

interface AppState {
  user: User | null;
  isLoading: boolean;
  preferredCurrency: string;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setPreferredCurrency: (currency: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isLoading: true,
  preferredCurrency: 'XAF',
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setPreferredCurrency: (currency) => {
    set({ preferredCurrency: currency });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('preferredCurrency', currency);
      } catch {
        // Ignore localStorage errors
      }
    }
  },
}));

interface TransferState {
  transfers: Transfer[];
  setTransfers: (transfers: Transfer[]) => void;
  addTransfer: (transfer: Transfer) => void;
  removeTransfer: (id: string) => void;
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: [],
  setTransfers: (transfers) => set({ transfers }),
  addTransfer: (transfer) =>
    set((state) => ({ transfers: [transfer, ...state.transfers] })),
  removeTransfer: (id) =>
    set((state) => ({
      transfers: state.transfers.filter((t) => t.id !== id),
    })),
}));

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
